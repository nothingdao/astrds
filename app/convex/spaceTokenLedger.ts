export type SpaceDepositStatus =
  | "pending_verification"
  | "active"
  | "depleted"
  | "cancelled";

export type SpaceTokenSpawnMode = "steady" | "escalating" | "wave";
export type CollectionStatus = "pending" | "claiming" | "claimed";

export const SPAWN_TICKET_TTL_MS = 60_000;
export const MIN_ESCALATING_SPAWN_INTERVAL_S = 5;

export interface DepositAmounts {
  totalAmount: number;
  remainingAmount: number;
  tokensPerPill: number;
}

export interface SpawnPolicy {
  spawnMode?: SpaceTokenSpawnMode;
  spawnInterval?: number;
  escalationRate?: number;
  waveSize?: number;
  waveCooldown?: number;
}

export interface SpawnTicketPolicyArgs {
  policy: SpawnPolicy;
  now: number;
  level: number;
  lastIssuedAt?: number | null;
  ticketsInWindow?: number;
}

export interface CollectionTicketLike {
  used: boolean;
  expiresAt: number;
  playerWalletAddress: string;
  gameSessionId: unknown;
}

export interface CollectionDepositLike {
  status: SpaceDepositStatus;
  remainingAmount: number;
  tokensPerPill: number;
}

export function statusForRemaining(
  remainingAmount: number,
  tokensPerPill: number
): Extract<SpaceDepositStatus, "active" | "depleted"> {
  return remainingAmount < tokensPerPill ? "depleted" : "active";
}

export function validateDepositAmounts({
  totalAmount,
  remainingAmount,
  tokensPerPill,
}: DepositAmounts): void {
  if (
    remainingAmount < 0 ||
    tokensPerPill <= 0 ||
    remainingAmount > totalAmount
  ) {
    throw new Error("Invalid deposit amounts");
  }
}

export function remainingAfterCollection(deposit: CollectionDepositLike): {
  remainingAmount: number;
  status: Extract<SpaceDepositStatus, "active" | "depleted">;
} {
  const remainingAmount = deposit.remainingAmount - deposit.tokensPerPill;
  return {
    remainingAmount,
    status: statusForRemaining(remainingAmount, deposit.tokensPerPill),
  };
}

export function canPoolSpawnOrCollect(
  deposit: CollectionDepositLike | null | undefined
): boolean {
  if (!deposit || deposit.status === "cancelled") return false;
  return deposit.remainingAmount >= deposit.tokensPerPill;
}

export function canIssueSpawnTicket({
  policy,
  now,
  level,
  lastIssuedAt,
  ticketsInWindow = 0,
}: SpawnTicketPolicyArgs): boolean {
  const spawnMode = policy.spawnMode ?? "steady";
  const spawnInterval = policy.spawnInterval ?? 30;

  if (spawnMode === "steady") {
    return !lastIssuedAt || now - lastIssuedAt >= spawnInterval * 1000;
  }

  if (spawnMode === "escalating") {
    const rate = policy.escalationRate ?? 0.1;
    const effectiveInterval =
      Math.max(
        MIN_ESCALATING_SPAWN_INTERVAL_S,
        spawnInterval / (1 + rate * Math.max(1, level))
      ) * 1000;
    return !lastIssuedAt || now - lastIssuedAt >= effectiveInterval;
  }

  const waveSize = policy.waveSize ?? 3;
  return ticketsInWindow < waveSize;
}

export function waveWindowStart(now: number, policy: SpawnPolicy): number {
  return now - (policy.waveCooldown ?? 60) * 1000;
}

export function canUseSpawnTicket(
  ticket: CollectionTicketLike | null | undefined,
  args: { playerWalletAddress: string; gameSessionId: unknown; now: number }
): boolean {
  if (!ticket) return false;
  if (ticket.used) return false;
  if (ticket.expiresAt < args.now) return false;
  if (ticket.playerWalletAddress !== args.playerWalletAddress) return false;
  if (ticket.gameSessionId !== args.gameSessionId) return false;
  return true;
}

export function canReserveCollection(status: CollectionStatus): boolean {
  return status === "pending";
}

export function canRevertClaimingCollection(status: CollectionStatus): boolean {
  return status === "claiming";
}

export interface ClaimableCollectionLike {
  depositId: unknown;
  amount: number;
}

export function groupCollectionsByDeposit<T extends ClaimableCollectionLike>(
  collections: T[]
): Map<string, T[]> {
  const byDeposit = new Map<string, T[]>();
  for (const collection of collections) {
    const key = String(collection.depositId);
    const group = byDeposit.get(key);
    if (group) group.push(collection);
    else byDeposit.set(key, [collection]);
  }
  return byDeposit;
}

export function sumCollectionAmounts(
  collections: ClaimableCollectionLike[]
): number {
  return collections.reduce((sum, collection) => sum + collection.amount, 0);
}

export function hasClaimableAmount(
  collections: ClaimableCollectionLike[]
): boolean {
  return sumCollectionAmounts(collections) > 0;
}
