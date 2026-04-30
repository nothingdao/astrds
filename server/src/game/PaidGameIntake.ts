import type { SessionBinding } from "../../../shared/game/protocol.js";

export interface PaidGameIntakeClient {
  isActiveGameSession(args: {
    sessionId: string;
    walletAddress: string;
  }): Promise<boolean>;
}

export interface PaidGameIntakeResult {
  ok: boolean;
  binding?: SessionBinding;
  error?: string;
}

const NO_ACTIVE_SESSION = "No active session. Please insert a quarter.";

export class PaidGameIntake {
  private readonly client: PaidGameIntakeClient;

  constructor(client: PaidGameIntakeClient) {
    this.client = client;
  }

  async consume(
    binding: SessionBinding | undefined
  ): Promise<PaidGameIntakeResult> {
    const walletAddress = binding?.walletAddress;
    if (!walletAddress) {
      return { ok: false, error: NO_ACTIVE_SESSION };
    }

    const gameSessionId = binding?.gameSessionId;
    if (!gameSessionId) {
      return { ok: false, error: NO_ACTIVE_SESSION };
    }

    let isActive = false;
    try {
      isActive = await this.client.isActiveGameSession({
        sessionId: gameSessionId,
        walletAddress,
      });
    } catch (error) {
      console.error("Paid game intake failed", {
        error,
        walletAddress,
        gameSessionId,
      });
      return { ok: false, error: NO_ACTIVE_SESSION };
    }

    if (!isActive) {
      return { ok: false, error: NO_ACTIVE_SESSION };
    }

    return {
      ok: true,
      binding: { ...binding, walletAddress, gameSessionId },
    };
  }
}
