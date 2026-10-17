export const BEHAVIOR_FIELD = "_behavior";
export const HONEYPOT_FIELD = "company_website";
export const CHALLENGE_TOKEN_FIELD = "_behavior_challenge_token";
export const POW_COUNTER_FIELD = "_behavior_pow_counter";

/** Browser telemetry is untrusted input and must only influence a risk heuristic. */
export interface BehaviorTelemetry {
  version: 1;
  startedAt: number;
  submittedAt: number;
  elapsedMs: number;
  mouseMoves: number;
  keyPresses: number;
  touchEvents: number;
}

export interface RiskDiagnostics {
  score: number;
  signals: string[];
  proofDifficulty: number;
}

export type ActionResult =
  | { status: "accepted" }
  | {
      status: "challenge";
      challenge: { token: string; nonce: string; salt: string; difficulty: number; expiresAt: number };
      diagnostics?: RiskDiagnostics;
    }
  | { status: "blocked"; reason: "honeypot" | "risk" | "invalid_challenge" }
  | { status: "error"; message: string };

export interface ChallengeStore {
  /** Atomically records a nonce only if it has not already been consumed. */
  consume(nonce: string, expiresAt: number): Promise<boolean>;
}
