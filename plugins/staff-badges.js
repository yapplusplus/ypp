import { definePlugin } from 'yapin.js-client/runtime';
import { badgesFor } from '../src/assets/badges.js';

/**
 * The old version of this plugin had to work out whose message it was looking at by itself: it
 * wrapped fetch and the WebSocket, remembered every message's author, backfilled from Supabase with
 * your token, and repainted on a timer. The framework reads the user id off React instead, so all
 * that's left is saying who has which badge.
 */
export default definePlugin({
  id: 'staff-badges',
  name: 'Staff Badge',
  description: 'A badge for yap++ contributors/staff/helpers/eventwinners.',
  version: '2.0.0',
  authors: [{ name: 'salami' }],
  tags: ['badges'],
  enabledByDefault: true,

  badges: {
    id: 'ypp-staff',
    name: 'Yap++',
    priority: 10,
    get: (userId) => badgesFor(userId),
  },
});
