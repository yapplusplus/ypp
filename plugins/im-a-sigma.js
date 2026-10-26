import { definePlugin } from 'yapin.js-client/runtime';
import { appendToOutgoingMessages } from '../src/shared/outgoing.js';

export default definePlugin({
  id: 'im-a-sigma',
  name: 'Im a sigma',
  description: "Let's every one of your messages know that you're a sigma",
  version: '2.0.0',
  authors: [{ name: 'salami' }],
  tags: ['fun'],

  start(ctx) {
    appendToOutgoingMessages(ctx, " \n* (I'm a sigma)");
  },
});
