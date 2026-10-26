import { definePlugin } from 'yapin.js-client/runtime';

const ENGINES = {
  'Google Lens': (url) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`,
  SauceNAO: (url) => `https://saucenao.com/search.php?url=${encodeURIComponent(url)}`,
  IQDB: (url) => `https://iqdb.org/?url=${encodeURIComponent(url)}`,
  'Trace.moe': (url) => `https://trace.moe/?url=${encodeURIComponent(url)}`,
  Yandex: (url) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(url)}`,
  Bing: (url) => `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encodeURIComponent(url)}`,
  TinEye: (url) => `https://www.tineye.com/search?url=${encodeURIComponent(url)}`,
};

export default definePlugin({
  id: 'image-search',
  name: 'ImageSearch',
  description: 'Find out if your E-girl is REALLY a girl.. (Credits to @shizu)',
  version: '2.0.0',
  authors: [{ name: 'salami' }, { name: 'shizu' }],
  tags: ['messages'],

  settings: {
    engines: {
      type: 'select',
      label: 'Search engines',
      description: 'Which engines the menu offers.',
      multiple: true,
      options: Object.keys(ENGINES),
      default: Object.keys(ENGINES),
    },
  },

  styles: `
    .ypp-rs-menu {
      position: fixed;
      z-index: 2147483646;
      min-width: 210px;
      max-width: 320px;
      background: var(--bg-float, #1e1f22);
      border: 1px solid var(--border, #3f4147);
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
      padding: 8px;
      color: var(--text, #dbdee1);
      font: 13px/1.4 var(--font, "Segoe UI", system-ui, sans-serif);
    }
    .ypp-rs-title { font-weight: 700; color: var(--accent, #e27ed3); padding: 4px 8px 8px; }
    .ypp-rs-thumb { display: flex; justify-content: center; margin-bottom: 6px; }
    .ypp-rs-thumb img { max-width: 180px; max-height: 120px; border-radius: 6px; object-fit: contain; }
    .ypp-rs-list { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .ypp-rs-item {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: inherit;
      padding: 7px 9px;
      cursor: pointer;
      font: inherit;
    }
    .ypp-rs-item:hover { background: var(--accent, #e27ed3); color: var(--on-accent, #fff); }
    .ypp-rs-sep { height: 1px; background: var(--border, #2b2d31); margin: 6px 4px; }
  `,

  start(ctx) {
    let menu = null;

    const close = () => {
      menu?.remove();
      menu = null;
    };
    ctx.onStop(close);

    /** The image under the pointer, if it is one worth searching for. */
    const imageURL = (target) => {
      const image = target?.closest?.('img');
      if (!image || (image.getAttribute('class') ?? '').includes('emoji')) return null;
      const source = image.currentSrc || image.getAttribute('src') || '';
      return source && !source.startsWith('data:') ? source : null;
    };

    const item = (label, onClick) =>
      ctx.h('button', { type: 'button', class: 'ypp-rs-item', onClick }, label);

    const open = (x, y, url) => {
      close();
      const chosen = ctx.settings.get('engines');
      menu = ctx.h(
        'div',
        { class: 'ypp-rs-menu' },
        ctx.h('div', { class: 'ypp-rs-title' }, 'Reverse Image Search'),
        ctx.h('div', { class: 'ypp-rs-thumb' }, ctx.h('img', { src: url, alt: '' })),
        ctx.h(
          'div',
          { class: 'ypp-rs-list' },
          Object.keys(ENGINES)
            .filter((name) => chosen.includes(name))
            .map((name) =>
              item(name, () => {
                ctx.client.openExternal(ENGINES[name](url));
                close();
              }),
            ),
        ),
        ctx.h('div', { class: 'ypp-rs-sep' }),
        item('Open image in new tab', () => {
          ctx.client.openExternal(url);
          close();
        }),
        item('Copy image URL', async () => {
          close();
          try {
            await navigator.clipboard.writeText(url);
            ctx.toast('Image URL copied', { type: 'success' });
          } catch {
            ctx.toast("Couldn't copy that URL", { type: 'error' });
          }
        }),
      );

      document.body.append(menu);

      // Keep the whole menu on screen, whichever corner it was opened in.
      const { width, height } = menu.getBoundingClientRect();
      menu.style.left = `${Math.min(Math.max(8, x), Math.max(8, innerWidth - width - 8))}px`;
      menu.style.top = `${Math.min(Math.max(8, y), Math.max(8, innerHeight - height - 8))}px`;
    };

    ctx.listen(
      document,
      'contextmenu',
      (event) => {
        const url = imageURL(event.target);
        if (!url) return;
        event.preventDefault();
        event.stopPropagation();
        open(event.clientX, event.clientY, url);
      },
      true,
    );

    ctx.listen(document, 'mousedown', (event) => {
      if (menu && !menu.contains(event.target)) close();
    }, true);
    ctx.listen(document, 'keydown', (event) => {
      if (event.key === 'Escape') close();
    }, true);
    ctx.listen(window, 'resize', close, true);
    ctx.listen(window, 'scroll', close, true);
  },
});
