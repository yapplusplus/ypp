import { definePlugin, svg } from 'yapin.js-client/runtime';

const RECORD_BUTTON = 'button[aria-label="Record a voice message"]';

const NOTE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
`;

/**
 * Sends an audio file as a voice message.
 *
 * Yapin' records voice messages from the microphone, so the file is played into a MediaStream and
 * handed to Yapin' when it asks for the microphone. Yapin' records what it is given, as usual.
 */
export default definePlugin({
  id: 'voice-messages',
  name: 'Custom voice messages',
  description: 'Send an audio file as a voice message!! Please do not use this to catfish people.',
  version: '0.1.0',
  authors: [{ name: 'salami' }],
  tags: ['composer'],

  start(ctx) {
    /** The file waiting to be played into the next recording, if any. */
    let armed = null;

    const picker = ctx.h('input', {
      type: 'file',
      accept: '.mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav,audio/x-wav',
      style: { display: 'none' },
      onChange() {
        const file = picker.files?.[0];
        picker.value = '';
        if (file) arm(file);
      },
    });
    document.body.append(picker);
    ctx.onStop(() => picker.remove());

    const arm = (file) => {
      armed = file;
      const record = document.querySelector(RECORD_BUTTON);
      if (record) {
        ctx.toast(`Sending ${file.name} as a voice message`, { type: 'info' });
        record.click();
      } else {
        ctx.toast(`Armed ${file.name}. Click the voice message button now.`, { type: 'info' });
      }
    };

    /** Decodes the armed file and plays it into a stream, as if it were a microphone. */
    const streamArmedFile = async () => {
      const file = armed;
      armed = null;
      const audio = new AudioContext();
      try {
        await audio.resume();
        const buffer = await audio.decodeAudioData(await file.arrayBuffer());
        const destination = audio.createMediaStreamDestination();
        const source = audio.createBufferSource();
        source.buffer = buffer;
        source.connect(destination);
        source.onended = () => {
          // Leave a moment for the recorder to take the tail before tearing the stream down.
          setTimeout(() => {
            for (const track of destination.stream.getTracks()) track.stop();
            void audio.close();
          }, 400);
        };
        source.start(audio.currentTime + 0.4);
        return destination.stream;
      } catch (error) {
        void audio.close();
        ctx.toast('Could not read that audio file', { type: 'error' });
        throw error;
      }
    };

    ctx.observe(RECORD_BUTTON, (record) => {
      const button = ctx.h('button', {
        type: 'button',
        class: 'icon-btn',
        attrs: { 'aria-label': 'Send an audio file as a voice message' },
        title: 'Send an audio file as a voice message',
        onClick(event) {
          event.preventDefault();
          event.stopPropagation();
          picker.click();
        },
      });
      button.append(svg(NOTE_ICON));
      record.parentNode?.insertBefore(button, record);
      return () => button.remove();
    });

    if (navigator.mediaDevices) {
      ctx.patch.instead(navigator.mediaDevices, 'getUserMedia', (args, original) => {
        const [constraints] = args;
        if (armed && constraints?.audio && !constraints.video) return streamArmedFile();
        return original(...args);
      });
    }

    ctx.onStop(() => {
      armed = null;
    });
  },
});
