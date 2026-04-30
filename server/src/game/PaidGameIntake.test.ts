import { describe, expect, it, vi } from "vitest";
import { PaidGameIntake } from "./PaidGameIntake.js";

function client({ active = true } = {}) {
  return {
    isActiveGameSession: vi.fn(async () => active),
  };
}

describe("PaidGameIntake", () => {
  it("rejects missing wallet without touching Convex", async () => {
    const convex = client();
    const intake = new PaidGameIntake(convex);

    const result = await intake.consume({ gameSessionId: "game-1" });

    expect(result).toEqual({
      ok: false,
      error: "No active session. Please insert a quarter.",
    });
    expect(convex.isActiveGameSession).not.toHaveBeenCalled();
  });

  it("rejects missing game session without touching Convex", async () => {
    const convex = client();
    const intake = new PaidGameIntake(convex);

    const result = await intake.consume({ walletAddress: "wallet-1" });

    expect(result.ok).toBe(false);
    expect(convex.isActiveGameSession).not.toHaveBeenCalled();
  });

  it("rejects an inactive or mismatched game session", async () => {
    const convex = client({ active: false });
    const intake = new PaidGameIntake(convex);

    const result = await intake.consume({
      walletAddress: "wallet-1",
      gameSessionId: "game-1",
    });

    expect(result.ok).toBe(false);
    expect(convex.isActiveGameSession).toHaveBeenCalledWith({
      sessionId: "game-1",
      walletAddress: "wallet-1",
    });
  });

  it("returns a normalized binding for an active paid game session", async () => {
    const convex = client();
    const intake = new PaidGameIntake(convex);

    const result = await intake.consume({
      walletAddress: "wallet-1",
      gameSessionId: "game-1",
    });

    expect(result).toEqual({
      ok: true,
      binding: { walletAddress: "wallet-1", gameSessionId: "game-1" },
    });
  });
});
