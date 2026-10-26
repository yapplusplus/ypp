import { definePlugin } from 'yapin.js-client/runtime';

/**
 * Stops the "… is typing" frame ever leaving your computer. Everything else on the socket goes
 * through untouched.
 */
export default definePlugin({
  id: 'silent-typing',
  name: 'SilentTyping',
  description: 'So sigma and mysterious #alphawolf',
  version: '0.1.0',
  authors: [{ name: 'salami' }],
  tags: ['privacy'],

  start(ctx) {
    ctx.patch.instead(WebSocket.prototype, 'send', (args, original) => {
      const [data] = args;
      if (typeof data === 'string') {
        try {
          if (JSON.parse(data)?.type === 'typing') return undefined;
        } catch {
          // Not JSON, so not a typing frame. Send it.
        }
      }
      return original(...args);
    });
  },
});
