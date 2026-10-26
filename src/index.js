/**
 * Runs in the Yapin' page when Yap++ starts, before plugins do.
 *
 * The old client built its own settings panel out of two injected nav buttons. The framework draws
 * the Plugins, Themes and About pages, so what's left here is the part that was really Yap++'s own:
 * who made it, and what it promises not to do.
 *
 * @param {import('yapin.js-client/runtime').Client} client
 */
export default function setup(client) {
  client.logger.info(`${client.name} ${client.version} is HEREEEE BABEYYYY`);

  // The About header's tile sizes its contents for a line icon. The logo is a picture, so let it
  // fill the tile instead of floating at 26px in the middle of the accent square.
  client.styles.add(
    '.yc-about-logo{background:none}.yc-about-logo .yc-icon{width:100%;height:100%}.yc-about-logo .yc-icon img{border-radius:12px;object-fit:cover}',
    { id: 'ypp-about-logo' },
  );

  client.about.section('community', { title: 'Community', layout: 'chips', order: 35 });
  client.about.set('community.yapper', { label: 'Yapper', value: 'salami' });
  client.about.set('community.youtube', { label: 'YouTube', value: '@sedesuu', href: 'https://www.youtube.com/@sedesuu' });
  client.about.set('community.discord', {
    label: 'Discord',
    value: '.salamidev',
    href: 'https://discord.com/users/1384802116106719384',
  });

  client.pages.add({
    id: 'credits',
    title: 'Credits',
    icon: 'ypp',
    order: 40,
    render(root, { ui, h }) {
      root.append(
        ui.heading('😼 Yap++'),
        ui.hint('The cutest client modification for Yappin’.'),

        ui.section({
          title: 'Thank you',
          children: [
            h('p', null, 'Thank you for using Yap++ 😼'),
            h('p', null, 'Built by ', h('b', null, 'salami'), ', with our biggest helper and Co-Owner, the goat @Lemon 🥹'),
            h('p', null, 'Plugins by @shizu (Custom Background, Oneko, ImageSearch) and @ood (Draft Saver).'),
            h('p', null, 'The cat is ', ui.link({ href: 'https://github.com/adryd325/oneko.js', label: 'oneko.js by adryd325' }), '.'),
          ],
        }),

        ui.section({
          title: 'Ethics',
          children: [
            h(
              'p',
              null,
              'Yap++ does ',
              h('b', null, 'not'),
              ' save, distribute, or maliciously use your login tokens or login information. ' +
                'Everything it adds is drawn on your own screen, from your own computer.',
            ),
            ui.hint('Yap++ is unofficial. It is not made, supported or endorsed by Yappin’.'),
          ],
        }),

        ui.section({
          title: 'Contributing',
          children: [
            h('p', null, 'Plugins are welcome, as long as they:'),
            h(
              'ul',
              null,
              h('li', null, 'make no API calls anywhere except image-hosting services and Yappin’s own Supabase,'),
              h('li', null, 'do not raid or spam,'),
              h('li', null, 'do not break Yappin’s terms,'),
              h('li', null, "and cannot harm anyone's computer."),
            ),
            ui.link({ href: 'https://github.com/salami-reborn/yapplusplus', label: 'The original Yap++ repository' }),
          ],
        }),
      );
    },
  });
}
