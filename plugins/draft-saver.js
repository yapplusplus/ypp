import { definePlugin } from 'yapin.js-client/runtime';
import { currentChannelId } from '../src/shared/yapper.js';

const INPUT = '.composer textarea, .composer-box textarea, textarea.msg-input';

/** Drafts kept at once, oldest dropped first. */
const KEEP = 50;

export default definePlugin({
  id: 'draft-saver',
  name: 'Draft Saver',
  description: "Saves your unsent message drafts per channel so you don't lose them if you refresh or switch channels. (By @ood)",
  version: '2.0.0',
  authors: [{ name: 'salami' }, { name: 'ood' }],
  tags: ['composer'],

  start(ctx) {
    let channel = currentChannelId();
    let restoring = false;
    let saveTimer = null;

    const key = (id) => `draft.${id}`;

    const save = (id, text) => {
      if (!id) return;
      if (text.trim()) ctx.storage.set(key(id), { text, at: Date.now() });
      else ctx.storage.delete(key(id));
      prune();
    };

    const prune = () => {
      const drafts = ctx.storage
        .keys()
        .filter((k) => k.startsWith('draft.'))
        .map((k) => ({ k, at: ctx.storage.get(k)?.at ?? 0 }))
        .sort((a, b) => b.at - a.at);
      for (const { k } of drafts.slice(KEEP)) ctx.storage.delete(k);
    };

    const restore = (input, id) => {
      const draft = id ? ctx.storage.get(key(id)) : null;
      if (!draft?.text || input.value === draft.text) return;
      restoring = true;
      input.value = draft.text;
      // React keeps its own copy of the value, so tell it the field changed.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      restoring = false;
    };

    ctx.observe(INPUT, (input) => {
      restore(input, channel);

      const onInput = () => {
        if (restoring) return;
        // Remember which channel this text was typed in: it may change before the save runs.
        const typedIn = channel;
        const text = input.value;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => save(typedIn, text), 400);
      };

      const onKeyDown = (event) => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        const sentIn = channel;
        clearTimeout(saveTimer);
        setTimeout(() => {
          if (!input.value.trim()) ctx.storage.delete(key(sentIn));
        }, 50);
      };

      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onKeyDown);
      return () => {
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKeyDown);
      };
    });

    // Yapin' empties the composer itself when you change channel, so the draft for the channel you
    // are leaving is already saved; this only puts the new channel's draft back.
    ctx.setInterval(() => {
      const now = currentChannelId();
      if (now === channel) return;
      channel = now;
      const input = document.querySelector(INPUT);
      if (input) restore(input, now);
    }, 500);

    ctx.onStop(() => clearTimeout(saveTimer));
  },
});
