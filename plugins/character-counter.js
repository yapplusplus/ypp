import { definePlugin } from 'yapin.js-client/runtime';

const INPUT = '.composer textarea, .composer-box textarea, textarea.msg-input';
const BOX = '.composer-box, .composer';

/**
 * How many characters you've typed, above the composer.
 *
 * The old version redrew ten times a second whether anything had changed or not. This one updates
 * when you type, and when the window moves under it.
 */
export default definePlugin({
  id: 'character-counter',
  name: 'Character Counter',
  description: 'Ripped straight from vencord. It shows the amount of characters you have typed in.',
  version: '0.1.0',
  authors: [{ name: 'salami' }],
  tags: ['composer'],

  settings: {
    warnAt: {
      type: 'number',
      label: 'Turn amber at',
      description: 'Characters typed before the count turns amber.',
      default: 500,
      min: 1,
      max: 100_000,
      integer: true,
    },
    dangerAt: {
      type: 'number',
      label: 'Turn red at',
      default: 1000,
      min: 1,
      max: 100_000,
      integer: true,
      // The schema checks its own default before there are any settings to compare against.
      validate: (value, settings) => !settings || value > settings.get('warnAt') || 'must be more than the amber count',
    },
  },

  styles: `
    #ypp-charcounter {
      position: fixed;
      z-index: 2147483000;
      pointer-events: none;
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      display: none;
    }
  `,

  start(ctx) {
    const counter = document.createElement('div');
    counter.id = 'ypp-charcounter';
    counter.setAttribute('aria-hidden', 'true');
    document.body.append(counter);
    ctx.onStop(() => counter.remove());

    const colorFor = (length) => {
      if (length >= ctx.settings.get('dangerAt')) return '#ff4b4b';
      if (length >= ctx.settings.get('warnAt')) return '#f0b232';
      return '#23a55a';
    };

    const update = () => {
      const input = document.querySelector(INPUT);
      const box = input?.closest(BOX) ?? document.querySelector(BOX);
      const rect = box?.getBoundingClientRect();
      if (!input || !rect || (rect.width === 0 && rect.height === 0)) {
        counter.style.display = 'none';
        return;
      }
      counter.textContent = String(input.value.length);
      counter.style.color = colorFor(input.value.length);
      counter.style.right = `${Math.max(0, window.innerWidth - rect.right)}px`;
      counter.style.bottom = `${Math.max(0, window.innerHeight - rect.top + 15)}px`;
      counter.style.display = 'block';
    };

    ctx.observe(INPUT, (input) => {
      const onInput = () => update();
      input.addEventListener('input', onInput);
      update();
      return () => {
        input.removeEventListener('input', onInput);
        update();
      };
    });

    ctx.listen(window, 'resize', update);
    ctx.onStop(ctx.settings.onChange(update));
  },
});
