export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: () => number, maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error("maxExclusive must be positive");
  }
  return Math.floor(random() * maxExclusive);
}

export function pick<T>(random: () => number, values: readonly T[]): T {
  if (values.length === 0) {
    throw new Error("Cannot pick from an empty array");
  }
  return values[randomInt(random, values.length)];
}

export function sampleWithoutReplacement<T>(
  random: () => number,
  values: readonly T[],
  count: number
): T[] {
  const remaining = [...values];
  const selected: T[] = [];
  const target = Math.min(count, remaining.length);

  for (let index = 0; index < target; index += 1) {
    const pickedIndex = randomInt(random, remaining.length);
    selected.push(remaining[pickedIndex]);
    remaining.splice(pickedIndex, 1);
  }

  return selected;
}
