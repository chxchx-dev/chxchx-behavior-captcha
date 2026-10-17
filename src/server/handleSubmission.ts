import {
  BEHAVIOR_FIELD,
  CHALLENGE_TOKEN_FIELD,
  HONEYPOT_FIELD,
  POW_COUNTER_FIELD,
} from "../shared/types";
import type { ActionResult, ChallengeStore } from "../shared/types";
import { createProofOfWork, verifyProofOfWork } from "./proofOfWork";
import { parseBehaviorTelemetry, scoreBehavior, type RiskConfig } from "./risk";
import type { RateLimitStore } from "./rateLimit";

export interface SubmissionOptions {
  secret: string;
  challengeStore: ChallengeStore;
  rateLimit?: { store: RateLimitStore; key: string; capacity: number; refillWindowMs: number };
  risk?: Partial<RiskConfig>;
  challengeThreshold?: number;
  blockThreshold?: number;
  proofDifficultyBits?: number;
  proofTtlMs?: number;
  /** Exposes heuristic details to a local demo; keep disabled in public production flows. */
  exposeDiagnostics?: boolean;
  /** Sum only known user-entered fields; never count the hidden telemetry or challenge fields. */
  textFields: readonly string[];
  onAccepted: (data: FormData) => Promise<void> | void;
  now?: () => number;
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export async function handleBehaviorSubmission(data: FormData, options: SubmissionOptions): Promise<ActionResult> {
  try {
    if (options.secret.length < 32) {
      return { status: "error", message: "La verificación no está configurada correctamente." };
    }
    if (options.rateLimit) {
      const limit = await options.rateLimit.store.consume(
        options.rateLimit.key,
        options.rateLimit.capacity,
        options.rateLimit.refillWindowMs,
        options.now?.(),
      );
      if (!limit.allowed) return { status: "blocked", reason: "risk" };
    }
    const honeypot = data.getAll(HONEYPOT_FIELD).some((value) => typeof value === "string" && value.length > 0)
      ? "filled"
      : "";
    const assessment = scoreBehavior({
      telemetry: parseBehaviorTelemetry(data.get(BEHAVIOR_FIELD)),
      honeypotValue: honeypot,
      validTextLength: options.textFields.reduce((total, field) => total + asString(data.get(field)).length, 0),
      config: options.risk,
    });
    if (assessment.honeypotTriggered) return { status: "blocked", reason: "honeypot" };

    const challengeToken = asString(data.get(CHALLENGE_TOKEN_FIELD));
    if (challengeToken) {
      const valid = await verifyProofOfWork({
        token: challengeToken,
        counter: asString(data.get(POW_COUNTER_FIELD)),
        secret: options.secret,
        store: options.challengeStore,
        now: options.now,
      });
      if (!valid) return { status: "blocked", reason: "invalid_challenge" };
      await options.onAccepted(data);
      return { status: "accepted" };
    }

    const challengeThreshold = options.challengeThreshold ?? 50;
    const blockThreshold = options.blockThreshold ?? 90;
    if (assessment.score >= blockThreshold) return { status: "blocked", reason: "risk" };
    if (assessment.score > challengeThreshold) {
      const challenge = createProofOfWork({
        secret: options.secret,
        difficultyBits: options.proofDifficultyBits,
        ttlMs: options.proofTtlMs,
        now: options.now,
      });
      return {
        status: "challenge",
        challenge,
        ...(options.exposeDiagnostics
          ? { diagnostics: { score: assessment.score, signals: assessment.signals, proofDifficulty: challenge.difficulty } }
          : {}),
      };
    }
    await options.onAccepted(data);
    return { status: "accepted" };
  } catch {
    return { status: "error", message: "No se pudo procesar el envío." };
  }
}
