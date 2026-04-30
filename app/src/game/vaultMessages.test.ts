import { describe, expect, it } from "vitest";
import {
  buildClaimAuthorizationMessage,
  buildMintAstrdsAuthorizationMessage,
  sessionIdToBytes,
} from "@shared/vault/messages";

const player = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1));
const pool = Uint8Array.from(Array.from({ length: 32 }, (_, i) => 101 + i));
const claimId = Uint8Array.from(Array.from({ length: 32 }, (_, i) => 201 + i));

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

describe("vault authorization messages", () => {
  it("encodes claim authorization as player || pool || amount || claimId || expiry", () => {
    const message = buildClaimAuthorizationMessage({
      player,
      pool,
      amount: 0x0102030405060708n,
      claimId,
      expiry: 0x0102030405060708n,
    });

    expect(message).toHaveLength(112);
    expect(hex(message.subarray(0, 32))).toBe(hex(player));
    expect(hex(message.subarray(32, 64))).toBe(hex(pool));
    expect(hex(message.subarray(64, 72))).toBe("0807060504030201");
    expect(hex(message.subarray(72, 104))).toBe(hex(claimId));
    expect(hex(message.subarray(104, 112))).toBe("0807060504030201");
  });

  it("encodes mint authorization as player || amount || sessionId || expiry", () => {
    const sessionId = sessionIdToBytes("game-session-1");
    const message = buildMintAstrdsAuthorizationMessage({
      player,
      amount: 0x0102030405060708n,
      sessionId,
      expiry: 0x0102030405060708n,
    });

    expect(message).toHaveLength(80);
    expect(hex(message.subarray(0, 32))).toBe(hex(player));
    expect(hex(message.subarray(32, 40))).toBe("0807060504030201");
    expect(hex(message.subarray(40, 72))).toBe(hex(sessionId));
    expect(hex(message.subarray(72, 80))).toBe("0807060504030201");
  });

  it("converts session IDs to zero-padded 32-byte identifiers", () => {
    const bytes = sessionIdToBytes("abc");

    expect(bytes).toHaveLength(32);
    expect([...bytes.slice(0, 3)]).toEqual([97, 98, 99]);
    expect([...bytes.slice(3)]).toEqual(Array(29).fill(0));
  });
});
