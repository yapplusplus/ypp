import { definePlugin } from 'yapin.js-client/runtime';
import { currentUserId } from '../src/shared/yapper.js';
import images from '../src/assets/images.json';

/**
 * A verified badge on your own name, and only on your own screen. Nobody else sees it: it is drawn
 * here, never sent anywhere.
 *
 * The old version needed Staff Badge turned on to borrow its message/author map. It doesn't any
 * more, because the framework knows whose name a badge sits next to.
 */
export default definePlugin({
  id: 'fake-verified',
  name: 'Fake verified',
  description: 'Makes you have a verified badge! (only visible on your end)',
  version: '0.1.0',
  authors: [{ name: 'salami' }],
  tags: ['badges', 'fun'],

  settings: {
    userId: {
      type: 'text',
      label: 'User id',
      description: 'Leave empty to badge whoever is signed in. Set an id to badge someone else instead.',
      default: '',
      trim: true,
      pattern: '^$|^[0-9a-fA-F-]{8,64}$',
      patternMessage: 'must be a Yapin’ user id',
    },
  },

  start(ctx) {
    const badge = {
      id: 'verified',
      label: 'Verified',
      description: 'flex ts in screenshots lol',
      icon: images.verified,
      priority: 60,
    };

    let remove = null;
    const apply = () => {
      remove?.();
      remove = null;
      const id = ctx.settings.get('userId') || currentUserId();
      if (!id) {
        ctx.logger.warn("couldn't work out who you are; sign in, or set a user id in the plugin's settings");
        return;
      }
      remove = ctx.badges.add(id.toLowerCase(), badge);
    };

    apply();
    ctx.onStop(ctx.settings.onChange('userId', apply));
    // Signing in replaces the stored session, so look again once Yapin' has settled.
    ctx.setTimeout(apply, 5_000);
  },
});
