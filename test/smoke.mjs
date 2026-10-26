/**
 * Starts Yap++ in a headless browser against a page with the same markup Yapin' uses, turns on
 * every plugin, and checks that each one does what it says.
 *
 *   npm test                      # builds first, then runs
 *   CHROME_PATH=... npm test      # to pick the browser
 *
 * It can't prove a plugin still matches the real Yapin' (only Yapin' can say that), but it does
 * catch a plugin that throws on start, cleans up badly, or no longer finds what it is looking for
 * in the markup it expects.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const payload = join(root, 'dist', 'payload');

if (!existsSync(join(payload, 'runtime.js'))) {
  console.error('No build found. Run `npm run build` first.');
  process.exit(1);
}

const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const browser = browsers.find((path) => existsSync(path));
if (!browser) {
  console.log('No Chrome or Edge found; set CHROME_PATH. Skipping.');
  process.exit(0);
}

const runtime = readFileSync(join(payload, 'runtime.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(payload, 'manifest.json'), 'utf8'));
// The page is served from a file, not from Yapin'.
manifest.config.origins = ['null', 'file://'];
manifest.config.welcome = false;
manifest.config.whatsNew = false;

/** Whoever wrote the message in the page below. */
const AUTHOR = 'c5ccf056-9c36-4367-9d27-69c92424c7fe';
/** Yapin' message ids are UUIDs, and the plugins only recognise ids that look like one. */
const MESSAGE = '11111111-2222-3333-4444-555555555555';

const page = `<!doctype html>
<html data-theme="dark"><head><meta charset="utf-8"><style>
:root{--bg-side:#1b1c21;--bg-main:#222329;--bg-elev:#2b2c33;--bg-hover:#2f3038;--bg-active:#383944;--bg-input:#2d2e36;--text:#ececf1;--text-muted:#9c9daa;--border:#fff2;--accent:#ff6b4a;--danger:#f2555a;--success:#3fcf82;--radius:10px;--bg-float:#1b1c21}
body{margin:0;background:var(--bg-main);color:var(--text);font:15px system-ui}
.app{display:flex;flex-direction:column;height:400px}
.messages{flex:1;overflow:auto}
.msg{display:flex;gap:8px;padding:4px 12px}
.composer{display:flex;gap:6px;padding:8px 12px}
.composer textarea{flex:1}
.settings{display:flex}.settings-nav{width:180px;display:flex;flex-direction:column}
.settings-nav-label{font-size:11px}.settings-main{flex:1}
</style></head><body>
<div class="app">
  <div class="messages">
    <div class="msg" data-message-id="${MESSAGE}">
      <div class="msg-gutter"><button class="avatar"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""></button></div>
      <div class="msg-body">
        <div class="msg-head"><button class="msg-author">someone</button><span class="msg-time">12:00</span></div>
        <div class="msg-text">hello there</div>
      </div>
      <div class="msg-actions"><button aria-label="Reply">reply</button></div>
    </div>
  </div>
  <div class="composer-box">
    <div class="composer">
      <textarea></textarea>
      <button aria-label="Record a voice message">rec</button>
    </div>
  </div>
</div>
<img id="photo" src="https://example.com/cat.png" alt="">
<div class="modal"><div class="settings">
  <nav class="settings-nav"><div class="settings-nav-label">User settings</div><button class="active" id="host-account">My Account</button></nav>
  <section class="settings-main" id="host-main"><h2>My Account</h2></section>
</div></div>
<pre id="results">pending</pre>
<script>
// Yapin's own network and sockets, stubbed so nothing leaves the page.
const sent = [];
const fetched = [];
const serverDeleted = new Set();
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = (init?.method ?? 'GET').toUpperCase();
  fetched.push({ url, method, body: init?.body });
  if (url.includes('/rest/v1/messages') && method === 'DELETE') {
    serverDeleted.add(url.match(/id=eq\.([0-9a-f-]+)/i)?.[1]);
    return new Response(null, { status: 204 });
  }
  if (url.includes('/rest/v1/messages') && method === 'GET') {
    // Like the real thing: a deleted message is simply gone.
    const rows = serverDeleted.has(MESSAGE)
      ? []
      : [{ id: MESSAGE, channel_id: CHANNEL, author_id: ${JSON.stringify(AUTHOR)}, content: 'hello there', created_at: '2026-10-26T12:00:00Z' }];
    return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ id: '99999999-8888-7777-6666-555555555555' }), { headers: { 'content-type': 'application/json' } });
};
const CHANNEL = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const MESSAGE = '11111111-2222-3333-4444-555555555555';
// Headless Chrome hardly runs requestAnimationFrame without a compositor, so give the page
// a frame clock of its own. Anything that animates is tested with this, not with real frames.
window.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
window.cancelAnimationFrame = (id) => clearTimeout(id);
history.replaceState(null, '', location.pathname + '#/channel/' + CHANNEL);

class FakeSocket extends EventTarget {
  send(data) { sent.push(data); }
}
FakeSocket.prototype.constructor = FakeSocket;
Object.defineProperty(FakeSocket.prototype, 'onmessage', {
  configurable: true,
  get() { return this._onmessage ?? null; },
  set(fn) { this._onmessage = fn; },
});
// The plugins patch WebSocket.prototype, so the fake has to be the real one.
const RealSocket = WebSocket;
window.WebSocket = FakeSocket;
Object.defineProperty(window, 'WebSocket', { value: FakeSocket, writable: true, configurable: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = {};
const check = (name, value) => { results[name] = value; };

const client = (${runtime})().default(${JSON.stringify({ manifest, environment: { chrome: 'test' } })});

(async () => {
  try {
    await client.ready;
    const ids = client.plugins.list().map((p) => p.id);
    check('plugins', ids);

    for (const id of ids) await client.plugins.enable(id);
    await sleep(120);

    check('running', client.plugins.list().filter((p) => p.status === 'running').map((p) => p.id));
    check('notRunning', client.plugins.list().filter((p) => p.status !== 'running').map((p) => [p.id, p.status, String(p.error ?? '')]));

    /* character counter */
    const composer = document.querySelector('.composer textarea');
    composer.value = 'hello';
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(30);
    const counter = document.getElementById('ypp-charcounter');
    check('counterText', counter?.textContent);
    check('counterVisible', counter?.style.display === 'block');

    /* silent typing */
    const socket = Object.create(FakeSocket.prototype);
    sent.length = 0;
    WebSocket.prototype.send.call(socket, JSON.stringify({ type: 'typing' }));
    WebSocket.prototype.send.call(socket, JSON.stringify({ type: 'message', content: 'hi' }));
    check('typingSwallowed', sent.length === 1 && JSON.parse(sent[0]).type === 'message');

    /* nothing edits the messages you send any more */
    fetched.length = 0;
    await fetch('https://x/rest/v1/messages', { method: 'POST', body: JSON.stringify({ content: 'yo', channel_id: CHANNEL }) });
    check('sentUnchanged', JSON.parse(fetched.at(-1).body).content);

    /* anonymous filenames */
    const form = new FormData();
    form.append('file', new File(['x'], 'my-real-name.png', { type: 'image/png' }));
    fetched.length = 0;
    await fetch('https://x/storage/v1/object/attachments', { method: 'POST', body: form });
    const uploaded = fetched.at(-1).body.get('file');
    check('fileRenamed', uploaded.name !== 'my-real-name.png' && /^[a-z0-9]{16}\\.png$/.test(uploaded.name));

    /* double click reply */
    let replied = false;
    document.querySelector('.msg-actions button[aria-label=Reply]').addEventListener('click', () => { replied = true; });
    document.querySelector('.msg-text').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    check('doubleClickReplied', replied);

    /* custom background */
    client.plugins.get('custom-background').settings.set('url', 'https://example.com/bg.png');
    await sleep(30);
    check('backgroundCSS', [...document.adoptedStyleSheets].some((s) => [...s.cssRules].some((r) => r.cssText.includes('example.com/bg.png'))));

    /* draft saver */
    composer.value = 'a draft';
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(600);
    check('draftSaved', client.storage.namespace('plugin.draft-saver').get('draft.' + CHANNEL)?.text);

    /* oneko */
    const cat = document.getElementById('ypp-oneko');
    check('catExists', Boolean(cat));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 400 }));
    const was = cat.style.left;
    await sleep(1200);
    check('catMoved', cat.style.left !== was);

    /* voice messages */
    check('voiceButton', Boolean(document.querySelector('button[aria-label="Send an audio file as a voice message"]')));
    check('voiceButtonBeforeRecord', document.querySelector('button[aria-label="Send an audio file as a voice message"]')?.nextElementSibling?.getAttribute('aria-label') === 'Record a voice message');

    /* image search */
    document.getElementById('photo').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    await sleep(20);
    const menu = document.querySelector('.ypp-rs-menu');
    check('imageMenuEngines', [...(menu?.querySelectorAll('.ypp-rs-item') ?? [])].map((b) => b.textContent));
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await sleep(10);
    check('imageMenuClosed', !document.querySelector('.ypp-rs-menu'));

    /* message logger */
    await fetch('https://x/rest/v1/messages?channel_id=eq.' + CHANNEL + '&order=created_at');
    await sleep(30);
    await fetch('https://x/rest/v1/messages?id=eq.' + MESSAGE, { method: 'DELETE' });
    await sleep(900);
    check('deletedMarked', document.querySelector('.msg[data-message-id="${MESSAGE}"]')?.hasAttribute('data-yp-ghost'));
    check('stripShown', document.getElementById('ypp-ghost-strip')?.style.display === 'block');
    check('stripText', document.getElementById('ypp-ghost-strip')?.textContent);
    // Taken out of the page by Yapin', it comes back as a stand-in.
    document.querySelector('.msg[data-message-id="${MESSAGE}"]').remove();
    await sleep(900);
    const ghost = document.querySelector('.msg.ypp-ghost[data-message-id="${MESSAGE}"]');
    check('ghostRebuilt', Boolean(ghost));
    check('ghostText', ghost?.querySelector('.msg-text')?.textContent);
    check('ghostAuthor', ghost?.querySelector('.msg-author')?.textContent);
    check('onlyOneGhost', document.querySelectorAll('.msg.ypp-ghost[data-message-id="${MESSAGE}"]').length);
    // Deleted messages come back when Yapin' loads the channel again.
    const reloaded = await (await fetch('https://x/rest/v1/messages?channel_id=eq.' + CHANNEL)).json();
    check('deletedInHistory', reloaded.some((r) => r.id === MESSAGE));

    /* stopping everything puts the page back */
    for (const id of ids) await client.plugins.disable(id);
    await sleep(120);
    check('cleanCounter', !document.getElementById('ypp-charcounter'));
    check('cleanCat', !document.getElementById('ypp-oneko'));
    check('cleanVoiceButton', !document.querySelector('button[aria-label="Send an audio file as a voice message"]'));
    check('cleanGhosts', document.querySelectorAll('.msg.ypp-ghost, [data-yp-ghost]').length);
    check('cleanStrip', !document.getElementById('ypp-ghost-strip'));
    check('fetchRestored', !Object.prototype.hasOwnProperty.call(window, 'fetch') || window.fetch.toString().includes('fetched.push'));
    sent.length = 0;
    WebSocket.prototype.send.call(socket, JSON.stringify({ type: 'typing' }));
    check('typingSentAgain', sent.length === 1);

    check('errors', client.logger.history.entries.filter((e) => e.level === 'error').map((e) => e.message));
  } catch (error) {
    results.crash = String(error?.stack ?? error);
  }
  document.getElementById('results').textContent = JSON.stringify(results);
  document.title = 'done';
})();
</script></body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'ypp-smoke-'));
const file = join(dir, 'page.html');
writeFileSync(file, page);

const dom = execFileSync(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--virtual-time-budget=30000',
    '--dump-dom',
    `--user-data-dir=${join(dir, 'profile')}`,
    `file://${file.replace(/\\/g, '/')}`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180_000, stdio: ['ignore', 'pipe', 'ignore'] },
);

const dumped = dom.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
if (!dumped || dumped === 'pending') {
  console.error('The page never finished. Was the runtime built? Run `npm run build`.');
  process.exit(1);
}

const results = JSON.parse(dumped.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
if (results.crash) {
  console.error(results.crash);
  process.exit(1);
}

const PLUGINS = [
  'anonymous-filenames',
  'character-counter',
  'custom-background',
  'double-click-reply',
  'draft-saver',
  'image-search',
  'message-logger',
  'oneko',
  'silent-typing',
  'voice-messages',
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const checks = [
  ['every plugin is bundled', same([...results.plugins].sort(), PLUGINS)],
  ['every plugin starts', same([...results.running].sort(), PLUGINS), () => JSON.stringify(results.notRunning)],
  ['the counter counts', results.counterText === '5' && results.counterVisible === true],
  ['typing frames are swallowed', results.typingSwallowed === true],
  ['messages are sent as written', results.sentUnchanged === 'yo', () => results.sentUnchanged],
  ['uploads are renamed', results.fileRenamed === true],
  ['double click replies', results.doubleClickReplied === true],
  ['the background is applied', results.backgroundCSS === true],
  ['drafts are kept', results.draftSaved === 'a draft', () => results.draftSaved],
  ['the cat appears and moves', results.catExists === true && results.catMoved === true],
  ['the voice button sits before Record', results.voiceButton === true && results.voiceButtonBeforeRecord === true],
  ['the image menu offers every engine', results.imageMenuEngines?.length === 9, () => JSON.stringify(results.imageMenuEngines)],
  ['the image menu closes', results.imageMenuClosed === true],
  ['deleted messages turn red', results.deletedMarked === true],
  ['the deleted list appears', results.stripShown === true && /1 deleted message/.test(results.stripText ?? '')],
  ['a removed message is rebuilt once', results.ghostRebuilt === true && results.onlyOneGhost === 1],
  ['the stand-in keeps its text and author', results.ghostText === 'hello there' && /someone/.test(results.ghostAuthor ?? ''), () => `${results.ghostText} / ${results.ghostAuthor}`],
  ['deleted messages come back with history', results.deletedInHistory === true],
  ['stopping removes the counter, cat and button', results.cleanCounter === true && results.cleanCat === true && results.cleanVoiceButton === true],
  ['stopping removes every trace of deleted messages', results.cleanGhosts === 0 && results.cleanStrip === true],
  ['stopping restores fetch and the socket', results.fetchRestored === true && results.typingSentAgain === true],
  ['nothing was logged as an error', (results.errors ?? []).length === 0, () => JSON.stringify(results.errors)],
];

let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${ok ? '' : `  → ${detail?.() ?? ''}`}`);
  if (!ok) failed++;
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
