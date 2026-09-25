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
import { L2, withL2Skills, withL2Track } from './l2/index.js';
import { L2_SIEM_CASES } from './l2/siem-cases.js';
import { NIGHT_SHIFT } from './l2/night-shift.js';
import { L3, withL3Skills, withL3Track } from './l3/index.js';
import { L3_SIEM_CASES } from './l3/siem-cases.js';
import { MAJOR_INCIDENT } from './l3/major-incident.js';

export const CONTENT = {
  tracks: withL3Track(withL2Track(TRACKS)),
  skills: withL3Skills(withL2Skills(SKILLS)),
  items: [...HOST_ITEMS, ...NETWORK_ITEMS, ...L2.items, ...L3.items],
  lessons: [...HOST_LESSONS, ...NETWORK_LESSONS, ...L2.lessons, ...L3.lessons],
  misconceptions: [...MISCONCEPTIONS, ...L2.misconceptions, ...L3.misconceptions],
  scenarios: [...SCENARIOS, NIGHT_SHIFT, MAJOR_INCIDENT],
  siemCases: [...SIEM_CASES, ...AMBIGUOUS_CASES, ...L2_SIEM_CASES, ...L3_SIEM_CASES],
  tiers: TIERS,
};
