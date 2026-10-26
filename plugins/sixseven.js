import { definePlugin } from 'yapin.js-client/runtime';
import { appendToOutgoingMessages } from '../src/shared/outgoing.js';

export default definePlugin({
  id: 'sixseven',
  name: 'SIXSEVEN',
  description: 'HIHI S-S-SIXSEVENNs (makes every message you send have 67)',
  version: '0.1.0',
  authors: [{ name: 'salami' }],
  tags: ['fun'],

  start(ctx) {
    appendToOutgoingMessages(ctx, ' 67');
  },
});
