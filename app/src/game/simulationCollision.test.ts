import { describe, expect, it } from "vitest";
import {
  bulletHitsAsteroid,
  checkCollision,
  segmentCircleCollision,
} from "@shared/game/simulationCollision";

describe("simulation collision rules", () => {
  it("detects overlapping circles", () => {
    expect(
      checkCollision(
        { position: { x: 0, y: 0 }, radius: 5 },
        { position: { x: 9, y: 0 }, radius: 5 }
      )
    ).toBe(true);
    expect(
      checkCollision(
        { position: { x: 0, y: 0 }, radius: 5 },
        { position: { x: 10, y: 0 }, radius: 5 }
      )
    ).toBe(false);
  });

  it("detects a line segment crossing a circle", () => {
    expect(
      segmentCircleCollision(
        { x: -10, y: 0 },
        { x: 10, y: 0 },
        { position: { x: 0, y: 0 }, radius: 2 }
      )
    ).toBe(true);
    expect(
      segmentCircleCollision(
        { x: -10, y: 5 },
        { x: 10, y: 5 },
        { position: { x: 0, y: 0 }, radius: 2 }
      )
    ).toBe(false);
  });

  it("uses swept bullet collision against asteroid visual radius", () => {
    const bullet = {
      position: { x: 10, y: 0 },
      previousPosition: { x: -10, y: 0 },
      radius: 1,
    };
    const asteroid = { position: { x: 0, y: 0 }, radius: 4 };

    expect(bulletHitsAsteroid(bullet, asteroid, 0)).toBe(true);
    expect(
      bulletHitsAsteroid(
        {
          ...bullet,
          position: { x: 10, y: 20 },
          previousPosition: { x: -10, y: 20 },
        },
        asteroid,
        0
      )
    ).toBe(false);
  });
});
