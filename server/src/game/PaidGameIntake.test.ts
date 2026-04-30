import { describe, expect, it, vi } from "vitest";
import { PaidGameIntake } from "./PaidGameIntake.js";

function client({ verified = true, consumed = true } = {}) {
  return {
    isVerifiedSession: vi.fn(async () => verified),
    consumeSession: vi.fn(async () => consumed),
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
    expect(convex.isVerifiedSession).not.toHaveBeenCalled();
    expect(convex.consumeSession).not.toHaveBeenCalled();
  });

  it("rejects an unverified session without consuming it", async () => {
    const convex = client({ verified: false });
    const intake = new PaidGameIntake(convex);

    const result = await intake.consume({
      walletAddress: "wallet-1",
      gameSessionId: "game-1",
    });

    expect(result.ok).toBe(false);
    expect(convex.isVerifiedSession).toHaveBeenCalledWith({
      walletAddress: "wallet-1",
    });
    expect(convex.consumeSession).not.toHaveBeenCalled();
  });

  it("rejects when consumption fails", async () => {
    const convex = client({ verified: true, consumed: false });
    const intake = new PaidGameIntake(convex);

    const result = await intake.consume({
      walletAddress: "wallet-1",
      gameSessionId: "game-1",
    });

    expect(result.ok).toBe(false);
    expect(convex.consumeSession).toHaveBeenCalledWith({
      walletAddress: "wallet-1",
    });
  });

  it("returns a normalized binding after verification and consumption", async () => {
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
