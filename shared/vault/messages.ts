export type PublicKeyBytes =
  | { toBytes(): Uint8Array }
  | { toBuffer(): Uint8Array }
  | Uint8Array;

function publicKeyBytes(value: PublicKeyBytes): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if ("toBytes" in value) return value.toBytes();
  return value.toBuffer();
}

export function sessionIdToBytes(sessionId: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const encoded = new TextEncoder().encode(sessionId);
  bytes.set(encoded.subarray(0, 32));
  return bytes;
}

function setU64Le(
  target: Uint8Array,
  offset: number,
  value: bigint | number
): void {
  new DataView(
    target.buffer,
    target.byteOffset,
    target.byteLength
  ).setBigUint64(offset, BigInt(value), true);
}

function setI64Le(
  target: Uint8Array,
  offset: number,
  value: bigint | number
): void {
  new DataView(target.buffer, target.byteOffset, target.byteLength).setBigInt64(
    offset,
    BigInt(value),
    true
  );
}

export function buildClaimAuthorizationMessage({
  player,
  pool,
  amount,
  claimId,
  expiry,
}: {
  player: PublicKeyBytes;
  pool: PublicKeyBytes;
  amount: number | bigint;
  claimId: Uint8Array;
  expiry: number | bigint;
}): Uint8Array {
  const message = new Uint8Array(112);
  message.set(publicKeyBytes(player), 0);
  message.set(publicKeyBytes(pool), 32);
  setU64Le(message, 64, amount);
  message.set(claimId, 72);
  setI64Le(message, 104, expiry);
  return message;
}

export function buildMintAstrdsAuthorizationMessage({
  player,
  amount,
  sessionId,
  expiry,
}: {
  player: PublicKeyBytes;
  amount: bigint | number;
  sessionId: Uint8Array;
  expiry: number | bigint;
}): Uint8Array {
  const message = new Uint8Array(80);
  message.set(publicKeyBytes(player), 0);
  setU64Le(message, 32, amount);
  message.set(sessionId, 40);
  setI64Le(message, 72, expiry);
  return message;
}
