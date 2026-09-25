// Combines the skill map, question files, lessons, misconceptions, scenarios, SIEM cases
// and curriculum tiers into one
// CONTENT object. To add a new question or lesson file, import it here.
import { TRACKS, SKILLS } from './skills.js';
import { HOST_ITEMS } from './questions/host.js';
import { NETWORK_ITEMS } from './questions/network.js';
import { HOST_LESSONS } from './lessons/host.js';
import { NETWORK_LESSONS } from './lessons/network.js';
import { MISCONCEPTIONS } from './misconceptions.js';
import { SCENARIOS } from './scenarios.js';
import { SIEM_CASES } from './siem-cases.js';
import { AMBIGUOUS_CASES } from './siem-ambiguous.js';
import { TIERS } from './career.js';

export const CONTENT = {
  tracks: TRACKS,
  skills: SKILLS,
  items: [...HOST_ITEMS, ...NETWORK_ITEMS],
  lessons: [...HOST_LESSONS, ...NETWORK_LESSONS],
  misconceptions: MISCONCEPTIONS,
  scenarios: SCENARIOS,
  siemCases: [...SIEM_CASES, ...AMBIGUOUS_CASES],
  tiers: TIERS,
};
