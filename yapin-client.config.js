import { readFileSync } from 'node:fs';
import { defineConfig } from 'yapin.js-client';

// The same art the owner badge uses, as a data URL, so the About page shows the real Yap++ logo
// instead of the generic cat icon. `about.logo` isn't resolved as a file path, so it goes in inline.
const images = JSON.parse(readFileSync(new URL('./src/assets/images.json', import.meta.url), 'utf8'));

// Every option is described in node_modules/yapin.js-client/docs/configuration.md.
export default defineConfig(({ mode }) => ({
  id: 'ypp',
  name: 'Yap++',
  description: "The cutest client modification for Yappin'.",
  authors: ['salami'],
  links: {
    source: 'https://github.com/salami-reborn/yapplusplus',
    youtube: 'https://www.youtube.com/@sedesuu',
  },
  icon: './assets/yppIcon-256.png',
  entry: './src/index.js',

  runtime: {
    // The old client logged everything as [Libyapcore]; this keeps the colour, not the noise.
    logColor: '#e27ed3',
    logLevel: mode === 'development' ? 'debug' : 'info',
  },

  plugins: {
    dirs: ['./plugins'],
    // Nothing is on until you turn it on.
    enabled: {},
  },

  themes: {
    dirs: ['./themes'],
    // The old Yap++ Settings panel had a "Custom CSS theme" box. This is that box.
    customCSS: {
      title: 'Custom CSS theme',
      description: 'Anything you write here is applied last, over every theme.',
    },
  },

  icons: {
    dirs: ['./icons'],
  },

  pages: {
    section: 'Yap++',
    // Without an `intro` the framework appends `null` under the heading, which the page prints as
    // the word "null" (it reaches DOM append(), not h(), so it isn't skipped).
    plugins: { intro: 'Everything Yap++ adds is a plugin. Turn on the ones you want.' },
    themes: { intro: 'Pick a theme, or write your own CSS at the bottom of the page.' },
  },

  about: {
    logo: images.owner,
    intro: 'Thank you for using Yap++ 😼',
  },

  security: {
    trustedAuthors: ['salami'],
  },

  welcome: {
    icon: 'ypp',
    title: 'Welcome to {name}',
    subtitle: 'The cutest client modification for Yappin’.',
    steps: [
      { icon: 'puzzle', title: 'Plugins', description: 'Everything Yap++ adds is a plugin. Turn them on in Settings → Plugins.' },
      { icon: 'palette', title: 'Themes', description: 'Pick a theme, set a background picture, or write your own CSS.' },
      { icon: 'shield', title: 'Yours alone', description: 'Yap++ never saves or sends your login details. Everything it adds is drawn on your screen.' },
    ],
  },

  installer: {
    preset: 'showcase',
    marketing: './installer/marketing.json',
    windows: {
      icon: './assets/Icon.ico',
      company: 'salami',
    },
  },
}));
