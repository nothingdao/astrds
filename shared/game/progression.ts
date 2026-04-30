export type CurveMode = "fixed" | "linear" | "step" | "randomRange";
export type BudgetDistribution =
  | "even"
  | "random"
  | "early"
  | "late"
  | "manual";

export type CurvePolicy =
  | { mode: "fixed"; value: number }
  | { mode: "linear"; from: number; to: number }
  | { mode: "step"; start: number; increment: number; cap?: number }
  | {
      mode: "randomRange";
      min: number;
      max: number;
      seedMode?: "session" | "level";
    };

export type BudgetPolicy = {
  mode: "budget";
  count: number;
  distribution: BudgetDistribution;
  levels?: number[];
};

export interface LevelBandPolicy {
  id: string;
  fromLevel: number;
  toLevel: number;
  asteroidCount: CurvePolicy;
  asteroidSpeed: CurvePolicy;
  shipPickups: BudgetPolicy;
  powerups: BudgetPolicy;
  maxLives: CurvePolicy;
  chaos?: { enabled: boolean };
}

export interface LevelRuntimeConfig {
  level: number;
  asteroidCount: number;
  asteroidSpeedMultiplier: number;
  shipPickupAllowed: boolean;
  powerupBudget: number;
  maxLives: number;
}

export const DEFAULT_PROGRESSION_BANDS: LevelBandPolicy[] = [
  {
    id: "classic-1-30",
    fromLevel: 1,
    toLevel: 30,
    asteroidCount: { mode: "step", start: 2, increment: 1, cap: 10 },
    asteroidSpeed: { mode: "linear", from: 1, to: 1.45 },
    shipPickups: {
      mode: "budget",
      count: 30,
      distribution: "manual",
      levels: Array.from({ length: 30 }, (_, i) => i + 1),
    },
    powerups: {
      mode: "budget",
      count: 30,
      distribution: "manual",
      levels: Array.from({ length: 30 }, (_, i) => i + 1),
    },
    maxLives: { mode: "fixed", value: 5 },
    chaos: { enabled: false },
  },
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seeded01(seed: string): number {
  let x = hashString(seed) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 1000000) / 1000000;
}

export function getBandForLevel(
  bands: LevelBandPolicy[] | undefined,
  level: number
): LevelBandPolicy {
  const sorted = [...(bands?.length ? bands : DEFAULT_PROGRESSION_BANDS)].sort(
    (a, b) => a.fromLevel - b.fromLevel
  );
  return (
    sorted.find((band) => level >= band.fromLevel && level <= band.toLevel) ??
    sorted[sorted.length - 1]
  );
}

export function resolveCurve(
  policy: CurvePolicy,
  level: number,
  fromLevel: number,
  toLevel: number,
  seed = ""
): number {
  const span = Math.max(1, toLevel - fromLevel);
  const t = Math.max(0, Math.min(1, (level - fromLevel) / span));

  switch (policy.mode) {
    case "fixed":
      return policy.value;
    case "linear":
      return policy.from + (policy.to - policy.from) * t;
    case "step":
      return Math.min(
        policy.cap ?? Number.POSITIVE_INFINITY,
        policy.start + Math.max(0, level - fromLevel) * policy.increment
      );
    case "randomRange": {
      const key =
        policy.seedMode === "session"
          ? `${seed}:${fromLevel}-${toLevel}`
          : `${seed}:${level}`;
      return policy.min + (policy.max - policy.min) * seeded01(key);
    }
  }
}

export function budgetLevels(
  policy: BudgetPolicy,
  fromLevel: number,
  toLevel: number,
  seed = ""
): number[] {
  const levels = Array.from(
    { length: Math.max(0, toLevel - fromLevel + 1) },
    (_, i) => fromLevel + i
  );
  const count = Math.max(0, Math.min(levels.length, Math.floor(policy.count)));
  if (count === 0) return [];
  if (policy.distribution === "manual" && policy.levels?.length) {
    return [
      ...new Set(
        policy.levels.filter((level) => level >= fromLevel && level <= toLevel)
      ),
    ].slice(0, count);
  }
  if (count >= levels.length) return levels;

  if (policy.distribution === "early") return levels.slice(0, count);
  if (policy.distribution === "late") return levels.slice(-count);
  if (policy.distribution === "random") {
    return [...levels]
      .sort((a, b) => seeded01(`${seed}:${a}`) - seeded01(`${seed}:${b}`))
      .slice(0, count)
      .sort((a, b) => a - b);
  }

  return Array.from({ length: count }, (_, i) => {
    const idx = Math.round(((i + 1) * (levels.length + 1)) / (count + 1)) - 1;
    return levels[Math.max(0, Math.min(levels.length - 1, idx))];
  });
}

export function resolveLevelConfig(
  bands: LevelBandPolicy[] | undefined,
  level: number,
  sessionSeed = "preview"
): LevelRuntimeConfig {
  const band = getBandForLevel(bands, level);
  const seed = `${sessionSeed}:${band.id}`;
  const shipLevels = budgetLevels(
    band.shipPickups,
    band.fromLevel,
    band.toLevel,
    `${seed}:ships`
  );
  const powerupLevels = budgetLevels(
    band.powerups,
    band.fromLevel,
    band.toLevel,
    `${seed}:powerups`
  );

  return {
    level,
    asteroidCount: Math.max(
      0,
      Math.round(
        resolveCurve(
          band.asteroidCount,
          level,
          band.fromLevel,
          band.toLevel,
          `${seed}:asteroids`
        )
      )
    ),
    asteroidSpeedMultiplier: Math.max(
      0.1,
      resolveCurve(
        band.asteroidSpeed,
        level,
        band.fromLevel,
        band.toLevel,
        `${seed}:speed`
      )
    ),
    shipPickupAllowed: shipLevels.includes(level),
    powerupBudget: powerupLevels.filter((candidate) => candidate === level)
      .length,
    maxLives: Math.max(
      1,
      Math.round(
        resolveCurve(
          band.maxLives,
          level,
          band.fromLevel,
          band.toLevel,
          `${seed}:lives`
        )
      )
    ),
  };
}

export function buildProgressionPreview(
  bands: LevelBandPolicy[] | undefined,
  maxLevel = 30,
  sessionSeed = "preview"
): LevelRuntimeConfig[] {
  return Array.from({ length: maxLevel }, (_, i) =>
    resolveLevelConfig(bands, i + 1, sessionSeed)
  );
}
