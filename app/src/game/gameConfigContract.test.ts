import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_PROGRESSION_BANDS,
  normalizeGameConfig,
  parseGameConfigPayload,
} from "@shared/game/gameConfigContract";

const validPayload = () => ({
  ...DEFAULT_GAME_CONFIG,
  version: 99,
  progressionBands: DEFAULT_PROGRESSION_BANDS,
});

describe("game config contract", () => {
  it("normalizes partial persisted config with shared defaults", () => {
    const config = normalizeGameConfig({
      version: 7,
      applyToRunning: true,
      quarterUsd: 0.5,
      pillsPerTier: [1, 2, 3, 4, 5],
    });

    expect(config.version).toBe(7);
    expect(config.applyToRunning).toBe(true);
    expect(config.quarterUsd).toBe(0.5);
    expect(config.pillsPerTier).toEqual([1, 2, 3, 4, 5]);
    expect(config.tierBreakpointsUsd).toEqual(
      DEFAULT_GAME_CONFIG.tierBreakpointsUsd
    );
    expect(config.progressionBands).toEqual(DEFAULT_PROGRESSION_BANDS);
  });

  it("accepts a complete admin payload", () => {
    const result = parseGameConfigPayload(validPayload());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.config.astrdsPerPill).toEqual(
      DEFAULT_GAME_CONFIG.astrdsPerPill
    );
  });

  it("rejects malformed emission arrays and progression bands", () => {
    const result = parseGameConfigPayload({
      ...validPayload(),
      tierBreakpointsUsd: [1, 2],
      progressionBands: [{ id: "bad" }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Missing or invalid field: tierBreakpointsUsd"
    );
    expect(result.errors).toContain(
      "Missing or invalid field: progressionBands"
    );
  });

  it("requires all numeric config fields for admin payloads", () => {
    const payload = validPayload() as Record<string, unknown>;
    delete payload.shipRadius;

    const result = parseGameConfigPayload(payload);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing or invalid field: shipRadius");
  });
});
