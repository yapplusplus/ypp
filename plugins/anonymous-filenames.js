import { definePlugin } from 'yapin.js-client/runtime';

/** What the old plugin randomised unless you changed the list in its settings. */
const DEFAULT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'];

const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'text/plain': 'txt',
};

const PATCHED = Symbol('ypp.renamed');

function randomName(extension) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let name = '';
  for (let i = 0; i < 16; i++) name += chars[Math.floor(Math.random() * chars.length)];
  return extension ? `${name}.${extension}` : name;
}

export default definePlugin({
  id: 'anonymous-filenames',
  name: 'Anonymised filenames',
  description:
    'Makes your filenames go hsduiyuyufdgydgy, so personally identifying information in a filename never leaves your computer. It renames the file; it does not strip metadata inside it.',
  version: '0.1.0',
  authors: [{ name: 'salami' }],
  tags: ['privacy', 'uploads'],

  settings: {
    types: {
      type: 'list',
      label: 'File types to rename',
      description: 'Anything uploaded with one of these content types gets a random name.',
      default: DEFAULT_TYPES,
      placeholder: 'image/bmp',
    },
  },

  start(ctx) {
    const rename = (file) => {
      if (!ctx.settings.get('types').includes(file.type)) return file;
      const fallback = file.name.includes('.') ? file.name.split('.').pop() : null;
      return new File([file], randomName(EXTENSIONS[file.type] ?? fallback), {
        type: file.type,
        lastModified: Date.now(),
      });
    };

    /** A copy of `form` with every file renamed, or `form` itself when nothing needed renaming. */
    const renameFiles = (form) => {
      if (form[PATCHED]) return form;
      const copy = new FormData();
      let changed = false;
      for (const [key, value] of form.entries()) {
        if (value instanceof File) {
          const renamed = rename(value);
          changed ||= renamed !== value;
          copy.append(key, renamed, renamed.name);
        } else {
          copy.append(key, value);
        }
      }
      if (!changed) return form;
      copy[PATCHED] = true;
      return copy;
    };

    ctx.patch.before(XMLHttpRequest.prototype, 'send', (args) => {
      if (args[0] instanceof FormData) args[0] = renameFiles(args[0]);
    });

    ctx.patch.before(window, 'fetch', (args) => {
      const [, init] = args;
      if (init?.body instanceof FormData) args[1] = { ...init, body: renameFiles(init.body) };
    });
  },
});
