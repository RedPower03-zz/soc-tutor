// Parameterised question generators.
//
// Each generator is { id, skill, count, bloom, make(rng) }. For seeds 1..count
// the builder calls make() with a PRNG seeded from (generator id, seed) and
// emits an item with the stable id `g-<generator>-<seed>` plus
// `generated: { gen, seed }`. Output is fully deterministic, so review cards and
// history keyed by item id keep pointing at the same question on every device.
//
// Stability rules (enforced by tests/generators.test.js through a fingerprint
// fixture): never renumber seeds or reuse a generator id for different logic.
// To change a generator's output, give it a new id (e.g. `subnet-hosts-2`);
// the old ids disappear and ensureState drops their cards cleanly.
// If two seeds of one generator produce the same question, the later seed is
// skipped (deterministically), so ids can have gaps.
import { makeRng } from './rng.js';
import L1_NET from './l1-net.js';
import L1_HOST from './l1-host.js';
import L2 from './l2.js';
import L3 from './l3.js';

export const GENERATORS = [...L1_NET, ...L1_HOST, ...L2, ...L3];

export function generateItem(gen, seed) {
  const r = makeRng(gen.id, seed);
  const body = gen.make(r);
  return {
    id: `g-${gen.id}-${seed}`,
    skill: gen.skill,
    bloom: gen.bloom,
    ...body,
    generated: { gen: gen.id, seed },
  };
}

export function buildGenerated(generators = GENERATORS) {
  const out = [];
  for (const gen of generators) {
    const seen = new Set();
    for (let seed = 1; seed <= gen.count; seed++) {
      const it = generateItem(gen, seed);
      const key = `${it.prompt}|${it.snippet || ''}|${it.answer ?? (it.accept || []).join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

export const GENERATED_ITEMS = buildGenerated();
