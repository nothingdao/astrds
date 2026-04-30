import {
  DEFAULT_SIMULATION_CONFIG,
  type SimulationConfig,
} from "./simulation.js";
import {
  DEFAULT_PROGRESSION_BANDS,
  type LevelBandPolicy,
} from "./progression.js";
export { DEFAULT_PROGRESSION_BANDS };

export const DEFAULT_TIER_BREAKPOINTS_USD = [0.0024, 0.01, 0.05, 0.1] as const;
export const DEFAULT_PILLS_PER_TIER = [5, 10, 25, 50, 100] as const;
export const DEFAULT_ASTRDS_PER_PILL = [10, 5, 2, 1, 0.5] as const;
export const GAME_CONFIG_VERSION = 1;

export type GameConfig = SimulationConfig & {
  version: number;
  applyToRunning: boolean;
  quarterUsd: number;
  tierBreakpointsUsd: number[];
  pillsPerTier: number[];
  astrdsPerPill: number[];
};

export type GameConfigInput = Partial<GameConfig> & Record<string, unknown>;

export interface GameConfigParseResult {
  ok: boolean;
  config: GameConfig;
  errors: string[];
}

const SIMULATION_NUMBER_KEYS = Object.keys(DEFAULT_SIMULATION_CONFIG).filter(
  (key) =>
    typeof DEFAULT_SIMULATION_CONFIG[key as keyof SimulationConfig] === "number"
) as Array<keyof SimulationConfig>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readNumber(
  input: Record<string, unknown>,
  key: string,
  fallback: number,
  errors?: string[]
): number {
  const value = input[key];
  if (value === undefined) return fallback;
  if (isFiniteNumber(value)) return value;
  errors?.push(`Missing or invalid field: ${key}`);
  return fallback;
}

function readNumberArray(
  input: Record<string, unknown>,
  key: string,
  fallback: readonly number[],
  length: number,
  errors?: string[]
): number[] {
  const value = input[key];
  if (value === undefined) return [...fallback];
  if (
    Array.isArray(value) &&
    value.length === length &&
    value.every(isFiniteNumber)
  ) {
    return [...value];
  }
  errors?.push(`Missing or invalid field: ${key}`);
  return [...fallback];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isCurvePolicy(value: unknown): boolean {
  if (!isRecord(value) || typeof value.mode !== "string") return false;
  switch (value.mode) {
    case "fixed":
      return isFiniteNumber(value.value);
    case "linear":
      return isFiniteNumber(value.from) && isFiniteNumber(value.to);
    case "step":
      return (
        isFiniteNumber(value.start) &&
        isFiniteNumber(value.increment) &&
        (value.cap === undefined || isFiniteNumber(value.cap))
      );
    case "randomRange":
      return (
        isFiniteNumber(value.min) &&
        isFiniteNumber(value.max) &&
        (value.seedMode === undefined ||
          value.seedMode === "session" ||
          value.seedMode === "level")
      );
    default:
      return false;
  }
}

function isBudgetPolicy(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.mode !== "budget" || !isFiniteNumber(value.count)) return false;
  if (
    !["even", "random", "early", "late", "manual"].includes(
      String(value.distribution)
    )
  )
    return false;
  return (
    value.levels === undefined ||
    (Array.isArray(value.levels) && value.levels.every(isFiniteNumber))
  );
}

export function isLevelBandPolicy(value: unknown): value is LevelBandPolicy {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isFiniteNumber(value.fromLevel) &&
    isFiniteNumber(value.toLevel) &&
    isCurvePolicy(value.asteroidCount) &&
    isCurvePolicy(value.asteroidSpeed) &&
    isBudgetPolicy(value.shipPickups) &&
    isBudgetPolicy(value.powerups) &&
    isCurvePolicy(value.maxLives) &&
    (value.chaos === undefined ||
      (isRecord(value.chaos) && typeof value.chaos.enabled === "boolean"))
  );
}

function readProgressionBands(
  input: Record<string, unknown>,
  errors?: string[]
): LevelBandPolicy[] {
  const value = input.progressionBands;
  if (value === undefined) return DEFAULT_PROGRESSION_BANDS;
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isLevelBandPolicy)
  ) {
    return value;
  }
  errors?.push("Missing or invalid field: progressionBands");
  return DEFAULT_PROGRESSION_BANDS;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  version: GAME_CONFIG_VERSION,
  applyToRunning: false,
  ...DEFAULT_SIMULATION_CONFIG,
  quarterUsd: 0.25,
  tierBreakpointsUsd: [...DEFAULT_TIER_BREAKPOINTS_USD],
  pillsPerTier: [...DEFAULT_PILLS_PER_TIER],
  astrdsPerPill: [...DEFAULT_ASTRDS_PER_PILL],
};

export function normalizeGameConfig(input: unknown): GameConfig {
  return parseGameConfig(input).config;
}

export function parseGameConfig(
  input: unknown,
  options: { requireAll?: boolean } = {}
): GameConfigParseResult {
  const source = isRecord(input) ? input : {};
  const errors: string[] = [];
  const requireAll = options.requireAll === true;
  const read = (key: string, fallback: number) => {
    if (requireAll && source[key] === undefined)
      errors.push(`Missing or invalid field: ${key}`);
    return readNumber(source, key, fallback, errors);
  };
  const readArray = (
    key: string,
    fallback: readonly number[],
    length: number
  ) => {
    if (requireAll && source[key] === undefined)
      errors.push(`Missing or invalid field: ${key}`);
    return readNumberArray(source, key, fallback, length, errors);
  };

  const config: GameConfig = {
    ...DEFAULT_GAME_CONFIG,
    version: readNumber(source, "version", DEFAULT_GAME_CONFIG.version),
    applyToRunning: Boolean(
      source.applyToRunning ?? DEFAULT_GAME_CONFIG.applyToRunning
    ),
    quarterUsd: read("quarterUsd", DEFAULT_GAME_CONFIG.quarterUsd),
    tierBreakpointsUsd: readArray(
      "tierBreakpointsUsd",
      DEFAULT_TIER_BREAKPOINTS_USD,
      4
    ),
    pillsPerTier: readArray("pillsPerTier", DEFAULT_PILLS_PER_TIER, 5),
    astrdsPerPill: readArray("astrdsPerPill", DEFAULT_ASTRDS_PER_PILL, 5),
    progressionBands: readProgressionBands(source, errors),
  };

  for (const key of SIMULATION_NUMBER_KEYS) {
    (config as unknown as Record<string, number>)[key as string] = read(
      key as string,
      DEFAULT_SIMULATION_CONFIG[key] as number
    );
  }

  return {
    ok: errors.length === 0,
    config,
    errors: [...new Set(errors)],
  };
}

export function parseGameConfigPayload(input: unknown): GameConfigParseResult {
  return parseGameConfig(input, { requireAll: true });
}
