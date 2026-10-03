// Hands-on labs content: query-sandbox datasets and challenges, packet cases, detection-rule
// exercises. Imported by content/index.js as CONTENT.lab.
// Other streams can register extra query datasets with registerDataset() from ./datasets.js.
import { QUERY_CHALLENGES } from './query-challenges.js';
import { PACKET_CASES } from './packets.js';
import { RULE_EXERCISES } from './rules.js';

export { registerDataset, getDataset, datasetList } from './datasets.js';

export const LAB_CONTENT = {
  queryChallenges: QUERY_CHALLENGES,
  packetCases: PACKET_CASES,
  ruleExercises: RULE_EXERCISES,
};
