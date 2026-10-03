// Pool expansion (v8): hand-written higher-order items per skill plus the
// parameterised generators in content/gen. Kept in its own folder so the
// original question files stay small and parallel edits do not collide.
import { GENERATED_ITEMS } from '../gen/index.js';
import { HAND } from './hand.js';

const FILES = [HAND];

export const MORE = {
  items: [...FILES.flatMap((f) => f.items), ...GENERATED_ITEMS],
  misconceptions: FILES.flatMap((f) => f.misconceptions || []),
};
