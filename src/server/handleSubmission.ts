import { createHash } from "node:crypto";
import {
  BEHAVIOR_FIELD,
  CHALLENGE_TOKEN_FIELD,
  HONEYPOT_FIELD,
  POW_COUNTER_FIELD,
} from "../shared/types.js";
import type { ActionResult, ChallengeStore } from "../shared/types.js";
import { createProofOfWork, verifyProofOfWork } from "./proofOfWork.js";
import { parseBehaviorTelemetry, scoreBehavior, type RiskConfig } from "./risk.js";
import type { RateLimitStore } from "./rateLimit.js";

export type ChallengePolicy =
  | { mode: "always" }
  | { mode: "adaptive"; remainingTokensThreshold: number };

export interface SubmissionOptions {
  secret: string;
  challengeStore: ChallengeStore;
  /** Server-derived endpoint plus session/account scope; do not source this from submitted fields. */
  challengeScope: string;
  /** Select a server-enforced baseline; adaptive also uses the client heuristic as an extra signal. */
  challengePolicy: ChallengePolicy;
  /** Limits initial form submissions. Challenge verification uses a separate bucket. */
  rateLimit?: SubmissionRateLimitOptions;
  /** Optional override for challenge verification attempts; defaults to a separate bucket with the same policy as rateLimit. */
  verificationRateLimit?: SubmissionRateLimitOptions;
  risk?: Partial<RiskConfig>;
  /** Client telemetry may add suspicion in adaptive mode, but cannot lower the selected policy. */
  challengeThreshold?: number;
  proofDifficultyBits?: number;
  proofTtlMs?: number;
  /** Exposes heuristic details to a local demo; keep disabled in public production flows. */
  exposeDiagnostics?: boolean;
  /** Sum only known user-entered fields; never count the hidden telemetry or challenge fields. */
  textFields: readonly string[];
  /** Limits are checked before scoring and hashing. Files are rejected unless maxFileBytes is raised. */
  inputLimits?: Partial<SubmissionInputLimits>;
  onAccepted: (data: FormData) => Promise<void> | void;
  now?: () => number;
}

export interface SubmissionRateLimitOptions {
  store: RateLimitStore;
  key: string;
  capacity: number;
  refillWindowMs: number;
}

export interface SubmissionInputLimits {
  maxEntries: number;
  maxTotalBytes: number;
  maxFileBytes: number;
  maxFieldNameBytes: number;
}

const DEFAULT_INPUT_LIMITS: Readonly<SubmissionInputLimits> = {
  maxEntries: 32,
  maxTotalBytes: 64 * 1024,
  maxFileBytes: 0,
  maxFieldNameBytes: 128,
};

function resolveInputLimits(input?: Partial<SubmissionInputLimits>): SubmissionInputLimits {
  const limits = { ...DEFAULT_INPUT_LIMITS, ...input };
  if (!Number.isSafeInteger(limits.maxEntries) || limits.maxEntries < 1 || limits.maxEntries > 128 ||
      !Number.isSafeInteger(limits.maxTotalBytes) || limits.maxTotalBytes < 1 || limits.maxTotalBytes > 1_048_576 ||
      !Number.isSafeInteger(limits.maxFileBytes) || limits.maxFileBytes < 0 || limits.maxFileBytes > limits.maxTotalBytes ||
      !Number.isSafeInteger(limits.maxFieldNameBytes) || limits.maxFieldNameBytes < 1 || limits.maxFieldNameBytes > 256) {
    throw new Error("Invalid submission input limits.");
  }
  return limits;
}

function submissionFitsLimits(data: FormData, limits: SubmissionInputLimits): boolean {
  let count = 0;
  let totalBytes = 0;
  for (const [key, value] of data.entries()) {
    count += 1;
    if (count > limits.maxEntries) return false;
    if (key.length === 0 || key.length > limits.maxFieldNameBytes) return false;

    const keyBytes = Buffer.byteLength(key, "utf8");
    if (keyBytes > limits.maxFieldNameBytes) return false;
    totalBytes += keyBytes;

    if (typeof value === "string") {
      if (value.length > limits.maxTotalBytes) return false;
      totalBytes += Buffer.byteLength(value, "utf8");
    } else {
      if (!Number.isSafeInteger(value.size) || value.size < 0 || limits.maxFileBytes === 0 || value.size > limits.maxFileBytes) {
        return false;
      }
      if (value.name.length > limits.maxTotalBytes || value.type.length > limits.maxTotalBytes) return false;
      totalBytes += value.size + Buffer.byteLength(value.name, "utf8") + Buffer.byteLength(value.type, "utf8");
    }
    if (totalBytes > limits.maxTotalBytes) return false;
  }
  return true;
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function deriveVerificationRateLimit(rateLimit: SubmissionRateLimitOptions): SubmissionRateLimitOptions {
  return {
    ...rateLimit,
    // Keep proof attempts in a separate bucket even when a custom policy reuses the same key.
    key: createHash("sha256")
      .update(`behavior-captcha-verification\0${rateLimit.key}`)
      .digest("base64url"),
  };
}

function validChallengePolicy(
  policy: ChallengePolicy | undefined,
  rateLimit: SubmissionRateLimitOptions | undefined,
  challengeThreshold: number,
): policy is ChallengePolicy {
  if (!Number.isFinite(challengeThreshold) || challengeThreshold < 0 || challengeThreshold > 100) return false;
  if (policy?.mode === "always") return true;
  if (policy?.mode !== "adaptive" || !rateLimit || !Number.isSafeInteger(rateLimit.capacity) || rateLimit.capacity < 1) {
    return false;
  }
  return Number.isSafeInteger(policy.remainingTokensThreshold) &&
    policy.remainingTokensThreshold >= 0 &&
    policy.remainingTokensThreshold < rateLimit.capacity;
}

async function hashSubmission(data: FormData): Promise<string> {
  const hash = createHash("sha256");
  for (const [key, value] of data.entries()) {
    if (key === CHALLENGE_TOKEN_FIELD || key === POW_COUNTER_FIELD) continue;
    if (typeof value === "string") {
      hash.update(JSON.stringify([key, "text", value]));
    } else {
      const fileHash = createHash("sha256").update(Buffer.from(await value.arrayBuffer())).digest("base64url");
      hash.update(JSON.stringify([key, "file", value.name, value.type, value.size, fileHash]));
    }
    hash.update("\n");
  }
  return hash.digest("base64url");
}

export async function handleBehaviorSubmission(data: FormData, options: SubmissionOptions): Promise<ActionResult> {
  try {
    if (options.secret.length < 32) {
      return { status: "error", message: "La verificación no está configurada correctamente." };
    }
    if (!options.challengeScope || options.challengeScope.length > 512) {
      return { status: "error", message: "La verificación no está configurada correctamente." };
    }
    const challengeThreshold = options.challengeThreshold ?? 50;
    if (!validChallengePolicy(options.challengePolicy, options.rateLimit, challengeThreshold)) {
      return { status: "error", message: "La configuracion de verificacion no es valida." };
    }
    const inputLimits = resolveInputLimits(options.inputLimits);
    if (!submissionFitsLimits(data, inputLimits)) return { status: "blocked", reason: "invalid_input" };

    const challengeToken = asString(data.get(CHALLENGE_TOKEN_FIELD));
    const verificationLimit = options.verificationRateLimit ?? options.rateLimit;
    const rateLimit = challengeToken
      ? (verificationLimit ? deriveVerificationRateLimit(verificationLimit) : undefined)
      : options.rateLimit;
    let remainingTokens: number | undefined;
    if (rateLimit) {
      const limit = await rateLimit.store.consume(
        rateLimit.key,
        rateLimit.capacity,
        rateLimit.refillWindowMs,
        options.now?.(),
      );
      if (!limit.allowed) return { status: "blocked", reason: "risk" };
      if (!Number.isFinite(limit.remaining) || limit.remaining < 0) {
        return { status: "error", message: "No se pudo procesar el envio." };
      }
      if (!challengeToken) remainingTokens = limit.remaining;
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

    if (challengeToken) {
      const valid = await verifyProofOfWork({
        token: challengeToken,
        counter: asString(data.get(POW_COUNTER_FIELD)),
        secret: options.secret,
        scope: options.challengeScope,
        requestHash: await hashSubmission(data),
        store: options.challengeStore,
        now: options.now,
      });
      if (!valid) return { status: "blocked", reason: "invalid_challenge" };
      await options.onAccepted(data);
      return { status: "accepted" };
    }

    const shouldChallenge = options.challengePolicy.mode === "always" ||
      assessment.score > challengeThreshold ||
      (options.challengePolicy.mode === "adaptive" &&
        remainingTokens !== undefined &&
        remainingTokens <= options.challengePolicy.remainingTokensThreshold);
    if (shouldChallenge) {
      const challenge = createProofOfWork({
        secret: options.secret,
        scope: options.challengeScope,
        requestHash: await hashSubmission(data),
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
