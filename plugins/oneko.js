import { definePlugin } from 'yapin.js-client/runtime';
import images from '../src/assets/images.json';

/**
 * adryd325's sprite sheet, inlined by `npm run assets` from assets/sprites/oneko.gif. The old
 * plugin loaded it from GitHub on every start; this way the cat costs nothing and works offline.
 */
const SPRITE = images.oneko;

/** Where each pose sits on the sprite sheet, in 32px cells. */
const SPRITES = {
  idle: [[-3, -3]],
  alert: [[-7, -3]],
  scratchSelf: [[-5, 0], [-6, 0], [-7, 0]],
  scratchWallN: [[0, 0], [0, -1]],
  scratchWallS: [[-7, -1], [-6, -2]],
  scratchWallE: [[-2, -2], [-2, -3]],
  scratchWallW: [[-4, 0], [-4, -1]],
  tired: [[-3, -2]],
  sleeping: [[-2, 0], [-2, -1]],
  N: [[-1, -2], [-1, -3]],
  NE: [[0, -2], [0, -3]],
  E: [[-3, 0], [-3, -1]],
  SE: [[-5, -1], [-5, -2]],
  S: [[-6, -3], [-7, -2]],
  SW: [[-5, -3], [-6, -1]],
  W: [[-4, -2], [-4, -3]],
  NW: [[-1, 0], [-1, -1]],
};

/** adryd325's oneko.js, as the old plugin had it: a cat that chases the pointer. */
export default definePlugin({
  id: 'oneko',
  name: 'Oneko',
  description: 'A little cat that follows your mouse around (real) (credits: @shizu)',
  version: '2.0.0',
  authors: [{ name: 'salami' }, { name: 'shizu' }],
  tags: ['fun'],

  settings: {
    speed: {
      type: 'slider',
      label: 'Speed',
      min: 4,
      max: 24,
      step: 1,
      default: 10,
      unit: 'px',
    },
  },

  styles: `
    #ypp-oneko {
      width: 32px;
      height: 32px;
      position: fixed;
      pointer-events: none;
      image-rendering: pixelated;
      z-index: 2147483647;
      background-image: url("${SPRITE}");
    }
    @media (prefers-reduced-motion: reduce) {
      #ypp-oneko { display: none; }
    }
  `,

  start(ctx) {
    let nekoX = 32;
    let nekoY = 32;
    let mouseX = 32;
    let mouseY = 32;
    let frameCount = 0;
    let idleTime = 0;
    let idleAnimation = null;
    let idleAnimationFrame = 0;
    let lastFrame = 0;
    let raf = null;

    const cat = document.createElement('div');
    cat.id = 'ypp-oneko';
    cat.setAttribute('aria-hidden', 'true');
    cat.style.left = `${nekoX - 16}px`;
    cat.style.top = `${nekoY - 16}px`;
    document.body.append(cat);
    ctx.onStop(() => cat.remove());

    const setSprite = (name, frame) => {
      const poses = SPRITES[name] ?? SPRITES.idle;
      const [x, y] = poses[frame % poses.length];
      cat.style.backgroundPosition = `${x * 32}px ${y * 32}px`;
    };

    const resetIdle = () => {
      idleAnimation = null;
      idleAnimationFrame = 0;
    };

    const idle = () => {
      idleTime += 1;
      if (idleTime > 10 && Math.floor(Math.random() * 200) === 0 && idleAnimation === null) {
        const available = ['sleeping', 'scratchSelf'];
        if (nekoX < 32) available.push('scratchWallW');
        if (nekoY < 32) available.push('scratchWallN');
        if (nekoX > innerWidth - 32) available.push('scratchWallE');
        if (nekoY > innerHeight - 32) available.push('scratchWallS');
        idleAnimation = available[Math.floor(Math.random() * available.length)];
      }

      if (idleAnimation === 'sleeping') {
        if (idleAnimationFrame < 8) setSprite('tired', 0);
        else {
          setSprite('sleeping', Math.floor(idleAnimationFrame / 4));
          if (idleAnimationFrame > 192) resetIdle();
        }
      } else if (idleAnimation) {
        setSprite(idleAnimation, idleAnimationFrame);
        if (idleAnimationFrame > 9) resetIdle();
      } else {
        setSprite('idle', 0);
        return;
      }
      idleAnimationFrame += 1;
    };

    const step = () => {
      frameCount += 1;
      const speed = ctx.settings.get('speed');
      const diffX = nekoX - mouseX;
      const diffY = nekoY - mouseY;
      const distance = Math.hypot(diffX, diffY);

      if (distance < speed || distance < 48) {
        idle();
        return;
      }

      resetIdle();
      if (idleTime > 1) {
        setSprite('alert', 0);
        idleTime = Math.min(idleTime, 7) - 1;
        return;
      }

      let direction = '';
      if (diffY / distance > 0.5) direction += 'N';
      if (diffY / distance < -0.5) direction += 'S';
      if (diffX / distance > 0.5) direction += 'W';
      if (diffX / distance < -0.5) direction += 'E';
      setSprite(direction, frameCount);

      nekoX = Math.min(Math.max(16, nekoX - (diffX / distance) * speed), innerWidth - 16);
      nekoY = Math.min(Math.max(16, nekoY - (diffY / distance) * speed), innerHeight - 16);
      cat.style.left = `${nekoX - 16}px`;
      cat.style.top = `${nekoY - 16}px`;
    };

    ctx.listen(document, 'mousemove', (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    // The cat animates at 10fps, so only every tenth frame or so does anything.
    const loop = (time) => {
      raf = requestAnimationFrame(loop);
      if (time - lastFrame < 100) return;
      lastFrame = time;
      step();
    };
    raf = requestAnimationFrame(loop);
    ctx.onStop(() => cancelAnimationFrame(raf));
  },
});
