/**
 * Turns the pictures in assets/ into data URLs in src/assets/images.json.
 *
 * The framework's bundler inlines JSON and text, but not binary files, and a badge wants an
 * `https:` or `data:` icon. So the art is downscaled here and committed as data URLs, which keeps
 * Yap++ working offline without fetching anything to draw itself.
 *
 *   npm run assets
 *
 * Zero dependencies: PNGs are decoded, box-filtered and re-encoded with node:zlib. Files that
 * aren't 8-bit PNGs (the oneko sprite sheet, and whiteboxbadgeidkwhy.png, which is really a WebP)
 * are inlined as they are.
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The art, and the size it is drawn at most (badges render at 14-18px; 64 leaves retina room). */
const SOURCES = {
  staff: ['badges/Staffcontrib.png', 64],
  helper: ['badges/Helper.png', 64],
  vim: ['badges/Vim.png', 64],
  potato: ['badges/Cutepotato.png', 64],
  whitebox: ['badges/whiteboxbadgeidkwhy.png', 64],
  sigma: ['badges/Hefeelsverysigma.png', 64],
  chud: ['badges/CERTIFIEDCHUD.png', 64],
  owner: ['badges/yppIcon.png', 64],
  yapinjs: ['badges/yapjsbadge.png', 64],
  theog: ['badges/TheOG.png', 64],
  verified: ['badges/verified.webp', 64],
  // adryd325's oneko sprite sheet, not a badge: inlined whole so the cat needs no network.
  oneko: ['sprites/oneko.gif', 256],
};

/** The app icon the installer and About page use, from the same source art. */
const ICONS = { 'yppIcon-256.png': ['badges/yppIcon.png', 256] };

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i++) c = crcTable[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Reads an 8-bit, non-interlaced PNG into { width, height, pixels } as RGBA. */
function decodePNG(file) {
  if (!file.subarray(0, 8).equals(PNG_MAGIC)) return null;
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const depth = file[24];
  const colorType = file[25];
  const interlace = file[28];
  const channels = CHANNELS[colorType];
  if (depth !== 8 || interlace !== 0 || !channels) return null;

  const parts = [];
  for (let offset = 8; offset < file.length - 8; ) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT') parts.push(file.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const lines = Buffer.alloc(height * stride);

  // Undo the per-scanline filters (PNG spec 9.2). Each line starts with its filter type.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const line = lines.subarray(y * stride, y * stride + stride);
    const prior = y > 0 ? lines.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prior ? prior[x] : 0;
      const c = prior && x >= channels ? prior[x - channels] : 0;
      let value = src[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
      line[x] = value & 0xff;
    }
  }

  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    const d = i * 4;
    if (colorType === 6) pixels.set(lines.subarray(s, s + 4), d);
    else if (colorType === 2) {
      pixels.set(lines.subarray(s, s + 3), d);
      pixels[d + 3] = 255;
    } else if (colorType === 4) {
      pixels.fill(lines[s], d, d + 3);
      pixels[d + 3] = lines[s + 1];
    } else {
      pixels.fill(lines[s], d, d + 3);
      pixels[d + 3] = 255;
    }
  }
  return { width, height, pixels };
}

/**
 * Box-filtered downscale. Colour is averaged weighted by alpha, so transparent edges don't bleed
 * their (often black) colour into the visible pixels.
 */
function resize(image, size) {
  const scale = Math.min(size / image.width, size / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  if (width === image.width && height === image.height) return image;

  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * image.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let alpha = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const s = (sy * image.width + sx) * 4;
          const a = image.pixels[s + 3];
          r += image.pixels[s] * a;
          g += image.pixels[s + 1] * a;
          b += image.pixels[s + 2] * a;
          alpha += a;
          count++;
        }
      }
      const d = (y * width + x) * 4;
      out[d] = alpha ? Math.round(r / alpha) : 0;
      out[d + 1] = alpha ? Math.round(g / alpha) : 0;
      out[d + 2] = alpha ? Math.round(b / alpha) : 0;
      out[d + 3] = Math.round(alpha / count);
    }
  }
  return { width, height, pixels: out };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePNG({ width, height, pixels }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    PNG_MAGIC,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mimeOf(file, name) {
  if (file.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png';
  if (file.toString('latin1', 0, 4) === 'RIFF' && file.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (file.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
  if (file[0] === 0xff && file[1] === 0xd8) return 'image/jpeg';
  throw new Error(`${name} is not a PNG, WebP, GIF or JPEG`);
}

const images = {};
let total = 0;

for (const [name, [relative, size]] of Object.entries(SOURCES)) {
  const path = join(root, 'assets', relative);
  const file = readFileSync(path);
  const decoded = decodePNG(file);
  const out = decoded ? encodePNG(resize(decoded, size)) : file;
  const mime = decoded ? 'image/png' : mimeOf(file, relative);
  images[name] = `data:${mime};base64,${out.toString('base64')}`;
  total += images[name].length;
  const note = decoded ? `${decoded.width}x${decoded.height} -> ${size}px` : `inlined as ${mime}`;
  console.log(`${name.padEnd(10)} ${(file.length / 1024).toFixed(1)}KB -> ${(out.length / 1024).toFixed(1)}KB  (${note})`);
}

for (const [out, [relative, size]] of Object.entries(ICONS)) {
  const decoded = decodePNG(readFileSync(join(root, 'assets', relative)));
  if (!decoded) throw new Error(`${relative} must be a PNG to make ${out}`);
  const file = encodePNG(resize(decoded, size));
  writeFileSync(join(root, 'assets', out), file);
  console.log(`${out.padEnd(10)} written (${(file.length / 1024).toFixed(1)}KB, ${size}px)`);
}

writeFileSync(join(root, 'src', 'assets', 'images.json'), `${JSON.stringify(images, null, 2)}\n`);
console.log(`\nsrc/assets/images.json: ${Object.keys(images).length} images, ${(total / 1024).toFixed(1)}KB of data URLs`);
