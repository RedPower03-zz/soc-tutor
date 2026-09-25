// Combines the skill map and all question files into one CONTENT object.
// To add a new question file, import it here and add it to `items`.
import { TRACKS, SKILLS } from './skills.js';
import { HOST_ITEMS } from './questions/host.js';
import { NETWORK_ITEMS } from './questions/network.js';

export const CONTENT = {
  tracks: TRACKS,
  skills: SKILLS,
  items: [...HOST_ITEMS, ...NETWORK_ITEMS],
};
