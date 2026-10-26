/**
 * Who gets which badge. Ported from the old `plugins/badges.js`, which drew them by hand; the
 * framework draws them now, so this file is only data.
 *
 * The art is in images.json as data URLs, generated from assets/badges/ by `npm run assets`, so
 * badges work offline and nothing is fetched to show them.
 */
import images from './images.json';

/** Every badge Yap++ can show. `priority` sorts them: higher comes first. */
export const BADGES = {
  owner: {
    id: 'owner',
    label: 'Yap++ Owner',
    description: 'The owner of Yap++, I made it',
    icon: images.owner,
    priority: 50,
  },
  staff: {
    id: 'staff',
    label: 'Yap++ Contributor',
    description: 'Yap++ Contributor. Legend.',
    icon: images.staff,
    priority: 40,
  },
  helper: {
    id: 'helper',
    label: 'Yap++ Helper',
    description: 'Yap++ helper. Legend.',
    icon: images.helper,
    priority: 30,
  },
  yapinjs: {
    id: 'yapinjs',
    label: 'Yapin.js Developer',
    icon: images.yapinjs,
    priority: 20,
  },
  vim: {
    id: 'vim',
    label: 'VIM, The most goated text editor oat',
    icon: images.vim,
    priority: 10,
  },
  potato: {
    id: 'potato',
    label: 'Potato Goddess',
    icon: images.potato,
    priority: 10,
  },
  whitebox: {
    id: 'whitebox',
    label: 'tuffestbadgever',
    icon: images.whitebox,
    priority: 10,
  },
  sigma: {
    id: 'sigma',
    label: 'I feel so sigma!',
    icon: images.sigma,
    priority: 10,
  },
  chud: {
    id: 'chud',
    label: 'Certified chud basement dweller',
    icon: images.chud,
    priority: 10,
  },
  // The art shipped with Yap++ but was never awarded to anyone. Add ids to THE_OG to use it.
  theog: {
    id: 'theog',
    label: 'The OG',
    icon: images.theog,
    priority: 10,
  },
};

/**
 * Contributors and helpers, as the old plugin listed them. Some entries are only the first block
 * of a user id, so these are matched as prefixes, the way `isBadged` did.
 */
export const CONTRIBUTORS = [
  '77ae11af',
  '1720334f',
  'c5ccf056',
  'da302abc',
  'baebe68c-8944-4738-aa41-40d67a018c62',
  'c00c8a06-ec79-42ca-9b79-bfa3139a0d25',
  'e96e12b4-2bac-4d4e-8914-cdb7404abf9d',
  '13aa6b8b-f756-4dcb-b791-f6086ad1806e',
  'f1e42d68-12a0-43b0-956d-ed5b9f8fb9f2',
  '3d32bc29-8de7-4085-a8c9-22b3acf285f1',
  '2401d1d0-467c-40a8-888d-9f7526414690',
  'e2647b1f-e7fc-4c68-a630-00cfa1439d49',
];

export const HELPERS = [
  'c5ccf056-9c36-4367-9d27-69c92424c7fe',
  '1b2d9bda-4afc-466c-b661-3399b0ee7f7b',
  '3d32bc29-8de7-4085-a8c9-22b3acf285f1',
  '48eb0fcb-21ca-4171-899c-ca1ca29d9ee4',
  '2401d1d0-467c-40a8-888d-9f7526414690',
  'e2647b1f-e7fc-4c68-a630-00cfa1439d49',
];

export const THE_OG = [];

/** One badge each, for the people the old plugin called out by name. */
export const PERSONAL = {
  'c5ccf056-9c36-4367-9d27-69c92424c7fe': 'owner',
  '1e15f614-cb69-44a8-8684-b4cd0c0f5834': 'yapinjs',
  '3d32bc29-8de7-4085-a8c9-22b3acf285f1': 'vim',
  '9c2208e6-f8b4-44db-ac91-89a012ffb0a8': 'potato',
  'f2c4c4c8-d455-4f75-864e-dcbfe04ec71d': 'whitebox',
  '217ccb8c-3d7e-4720-a614-3788bf5dc3a9': 'sigma',
  'd70e83db-e45d-47be-9f1b-0ca8ea1b42d7': 'chud',
};

const matches = (id, list) => list.some((prefix) => id.startsWith(prefix));

/** Every Yap++ badge one person has earned. */
export function badgesFor(userId) {
  const id = String(userId ?? '').toLowerCase();
  if (!id) return [];
  const earned = [];
  if (matches(id, CONTRIBUTORS)) earned.push(BADGES.staff);
  if (matches(id, HELPERS)) earned.push(BADGES.helper);
  if (matches(id, THE_OG)) earned.push(BADGES.theog);
  const personal = PERSONAL[id];
  if (personal && BADGES[personal]) earned.push(BADGES[personal]);
  return earned;
}
