/**
 * 确定性随机工具：同一种子必得同一序列。
 * 算法为 mulberry32，输出 [0, 1) 浮点数。
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash32(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seedFor(base, label) {
  return (base ^ hash32(label)) >>> 0;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function randFloat(rng, min, max) {
  return min + rng() * (max - min);
}

export function randInt(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** 加权抽样：weights 与 items 等长且为正数。 */
export function weightedPick(rng, items, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** 指数分布（均值 mean），用于金额与延迟，产生长尾。 */
export function exponential(rng, mean) {
  return -Math.log(1 - rng()) * mean;
}

export function roundTo(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 无损抖动：给定期望值，返回相对偏差 ±pct。 */
export function jitter(rng, value, pct) {
  return value * (1 + (rng() * 2 - 1) * pct);
}
