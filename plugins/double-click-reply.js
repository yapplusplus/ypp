import { definePlugin } from 'yapin.js-client/runtime';

/** Things inside a message that have their own double-click meaning. */
const SKIP = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'img',
  'video',
  'audio',
  '.msg-actions',
  '.reactions',
  '.reply-preview',
  '.mention',
  '.msg-image',
  '.msg-linkimgs',
  '.msg-edited',
].join(', ');

export default definePlugin({
  id: 'double-click-reply',
  name: 'Double Click Reply',
  description: "Double click another dude's message to reply to it and your own to edit it",
  version: '2.0.0',
  authors: [{ name: 'salami' }],
  tags: ['messages'],

  start(ctx) {
    const messageFrom = (target) => {
      if (!target?.closest || target.closest(SKIP)) return null;
      const message = target.closest('.messages .msg[data-message-id]');
      // Message Logger's stand-ins for deleted messages have no buttons to press.
      return message && !message.hasAttribute('data-yp-ghost') ? message : null;
    };

    // Stop the second click selecting the whole paragraph before we act on it.
    ctx.listen(
      document,
      'mousedown',
      (event) => {
        if (event.button === 0 && event.detail >= 2 && messageFrom(event.target)) event.preventDefault();
      },
      true,
    );

    ctx.listen(
      document,
      'dblclick',
      (event) => {
        const message = messageFrom(event.target);
        if (!message) return;
        getSelection()?.removeAllRanges();
        const action =
          message.querySelector('.msg-actions button[aria-label="Edit"]') ??
          message.querySelector('.msg-actions button[aria-label="Reply"]');
        action?.click();
      },
      true,
    );
  },
});
