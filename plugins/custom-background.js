import { definePlugin } from 'yapin.js-client/runtime';

/** Only an image we can name safely goes into a CSS url(). */
function safeImageURL(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol === 'https:' || /^data:image\//i.test(url.href)) return url.href.replace(/["\\]/g, '\\$&');
  } catch {
    // Not a URL at all.
  }
  return null;
}

export default definePlugin({
  id: 'custom-background',
  name: 'Custom Background',
  description: 'Set a custom background!!! (Credits: @shizu)',
  version: '0.1.0',
  authors: [{ name: 'salami' }, { name: 'shizu' }],
  tags: ['looks'],

  settings: {
    url: {
      type: 'text',
      label: 'Image link',
      description: 'A direct https link to an image. The Themes page has a Custom CSS box for anything else.',
      default: '',
      trim: true,
      placeholder: 'https://example.com/image.png',
      validate: (value) => !value || Boolean(safeImageURL(value)) || 'must be an https link to an image',
    },
    opacity: {
      type: 'slider',
      label: 'Image strength',
      description: 'How much of the picture shows through Yapin’s own background.',
      min: 0,
      max: 100,
      step: 1,
      default: 50,
      unit: '%',
    },
  },

  /**
   * Yapin' paints its own background on nearly every panel, so each one has to be made see-through
   * for the picture behind it to show. Surfaces that need to stay readable (the composer, dialogs,
   * menus) keep theirs.
   */
  styles({ url, opacity }) {
    const image = safeImageURL(url);
    if (!image) return '';
    const overlay = `rgba(20, 21, 25, ${(1 - Math.min(100, Math.max(0, opacity)) / 100).toFixed(3)})`;
    return `
      .app {
        background-image: linear-gradient(${overlay}, ${overlay}), url("${image}") !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        background-attachment: fixed !important;
        background-color: var(--bg-main, #141519) !important;
      }

      nav.rail,
      aside.sidebar,
      aside.side-panel,
      main.main,
      .chat-wrap,
      .chat,
      .messages,
      .messages-inner,
      .main-head {
        background-color: transparent !important;
        background-image: none !important;
      }

      .user-bar {
        background-color: var(--bg-main, #141519) !important;
        background-image: none !important;
      }

      .composer-box,
      .invite-embed {
        background-color: var(--bg-input, #1e1f22) !important;
        background-image: none !important;
      }

      .overlay {
        background-color: rgba(0, 0, 0, 0.6) !important;
        backdrop-filter: blur(2px) !important;
      }

      .modal,
      .settings,
      .settings-nav,
      .settings-main,
      [role="dialog"],
      [role="menu"],
      .popout,
      .profile-card {
        background-color: var(--bg-main, #141519) !important;
        background-image: none !important;
      }

      .settings-main .input,
      .settings-main .btn.ghost {
        background-color: var(--bg-input, #1e1f22) !important;
      }
    `;
  },
});
