"use client";

export interface ProofChallenge {
  nonce: string;
  salt: string;
  difficulty: number;
  expiresAt: number;
}

export type ProofSolveFailureReason = "cancelled" | "timeout" | "expired" | "unavailable" | "invalid_challenge";

export interface ProofSolveStats {
  reason: ProofSolveFailureReason;
  attempts: number;
  elapsedMs: number;
}

export interface ProofSolveOptions {
  /** Stop checking after this long; defaults to 15 seconds and cannot exceed two minutes. */
  maxDurationMs?: number;
  signal?: AbortSignal;
}

export class ProofSolveError extends Error {
  constructor(readonly stats: ProofSolveStats, message: string) {
    super(message);
    this.name = "ProofSolveError";
  }
}

function hasLeadingZeroBits(bytes: Uint8Array, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  const remainingBits = bits % 8;
  for (let index = 0; index < fullBytes; index += 1) {
    if (bytes[index] !== 0) return false;
  }
  if (remainingBits === 0) return true;
  return (bytes[fullBytes]! >> (8 - remainingBits)) === 0;
}

/** Finds a small SHA-256 proof in the browser, yielding periodically to keep the UI responsive. */
export async function solveProofOfWork(challenge: ProofChallenge, options: ProofSolveOptions = {}): Promise<number> {
  const startedAt = performance.now();
  const maxDurationMs = options.maxDurationMs ?? 15_000;
  let attempts = 0;
  const fail = (reason: ProofSolveFailureReason, message: string): never => {
    throw new ProofSolveError({ reason, attempts, elapsedMs: Math.round(performance.now() - startedAt) }, message);
  };

  if (!Number.isSafeInteger(maxDurationMs) || maxDurationMs < 1_000 || maxDurationMs > 120_000 ||
      !Number.isInteger(challenge.difficulty) || challenge.difficulty < 8 || challenge.difficulty > 24 ||
      !Number.isSafeInteger(challenge.expiresAt)) {
    return fail("invalid_challenge", "The security check is invalid.");
  }
  if (!globalThis.crypto?.subtle) return fail("unavailable", "Web Crypto is not available in this browser.");

  const encoder = new TextEncoder();
  for (let counter = 0; counter <= Number.MAX_SAFE_INTEGER; counter += 1) {
    if (options.signal?.aborted) return fail("cancelled", "The security check was cancelled.");
    if (Date.now() >= challenge.expiresAt) return fail("expired", "The security check expired.");
    if (performance.now() - startedAt >= maxDurationMs) return fail("timeout", "The security check took too long.");
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${challenge.nonce}:${challenge.salt}:${counter}`),
    );
    attempts += 1;
    if (options.signal?.aborted) return fail("cancelled", "The security check was cancelled.");
    if (Date.now() >= challenge.expiresAt) return fail("expired", "The security check expired.");
    if (performance.now() - startedAt >= maxDurationMs) return fail("timeout", "The security check took too long.");
    if (hasLeadingZeroBits(new Uint8Array(digest), challenge.difficulty)) return counter;
    if (counter % 128 === 127) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return fail("timeout", "The security check could not be completed.");
}
