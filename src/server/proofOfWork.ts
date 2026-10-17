import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ChallengeStore } from "../shared/types";

interface ProofPayload {
  v: 1;
  nonce: string;
  salt: string;
  difficulty: number;
  expiresAt: number;
}

export interface ProofOfWorkConfig {
  secret: string;
  difficultyBits?: number;
  ttlMs?: number;
  now?: () => number;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function hasLeadingZeroBits(digest: Buffer, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  const remainingBits = bits % 8;
  for (let index = 0; index < fullBytes; index += 1) {
    if (digest[index] !== 0) return false;
  }
  if (remainingBits === 0) return true;
  return (digest[fullBytes]! >> (8 - remainingBits)) === 0;
}

function digestProof(nonce: string, salt: string, counter: number): Buffer {
  return createHash("sha256").update(`${nonce}:${salt}:${counter}`).digest();
}

export function createProofOfWork(config: ProofOfWorkConfig): {
  token: string;
  nonce: string;
  salt: string;
  difficulty: number;
  expiresAt: number;
} {
  if (config.secret.length < 32) throw new Error("Proof secret must contain at least 32 characters.");
  const difficulty = config.difficultyBits ?? 16;
  if (!Number.isInteger(difficulty) || difficulty < 8 || difficulty > 24) {
    throw new Error("Proof difficulty must be between 8 and 24 bits.");
  }
  const payload: ProofPayload = {
    v: 1,
    nonce: randomBytes(24).toString("base64url"),
    salt: randomBytes(16).toString("base64url"),
    difficulty,
    expiresAt: (config.now?.() ?? Date.now()) + (config.ttlMs ?? 2 * 60_000),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encoded}.${sign(encoded, config.secret)}`, ...payload };
}

export async function verifyProofOfWork(input: {
  token: string;
  counter: string;
  secret: string;
  store: ChallengeStore;
  now?: () => number;
}): Promise<boolean> {
  if (input.secret.length < 32 || input.token.length > 2_048 || !/^\d{1,16}$/.test(input.counter)) return false;
  const [encoded, suppliedSignature, extra] = input.token.split(".");
  if (!encoded || !suppliedSignature || extra !== undefined) return false;

  const expectedSignature = Buffer.from(sign(encoded, input.secret));
  const actualSignature = Buffer.from(suppliedSignature);
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return false;

  let payload: ProofPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ProofPayload;
  } catch {
    return false;
  }
  const now = input.now?.() ?? Date.now();
  if (payload.v !== 1 || typeof payload.nonce !== "string" || payload.nonce.length > 128 ||
      typeof payload.salt !== "string" || payload.salt.length > 128 ||
      !Number.isInteger(payload.difficulty) || payload.difficulty < 8 || payload.difficulty > 24 ||
      !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now) return false;

  const counter = Number(input.counter);
  if (!Number.isSafeInteger(counter) || counter < 0) return false;
  if (!hasLeadingZeroBits(digestProof(payload.nonce, payload.salt, counter), payload.difficulty)) return false;
  return input.store.consume(payload.nonce, payload.expiresAt);
}

/** Development-only store. Replace it with an atomic shared store for multiple server instances. */
export class InMemoryChallengeStore implements ChallengeStore {
  private readonly consumed = new Map<string, number>();

  async consume(nonce: string, expiresAt: number): Promise<boolean> {
    const now = Date.now();
    for (const [key, expiry] of this.consumed) if (expiry <= now) this.consumed.delete(key);
    if (this.consumed.has(nonce)) return false;
    this.consumed.set(nonce, expiresAt);
    return true;
  }
}
