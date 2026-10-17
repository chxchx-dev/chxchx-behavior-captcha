"use client";

export interface ProofChallenge {
  nonce: string;
  salt: string;
  difficulty: number;
  expiresAt: number;
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
export async function solveProofOfWork(challenge: ProofChallenge): Promise<number> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is not available in this browser.");
  const encoder = new TextEncoder();
  for (let counter = 0; counter <= Number.MAX_SAFE_INTEGER; counter += 1) {
    if (Date.now() >= challenge.expiresAt) throw new Error("The security check expired.");
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${challenge.nonce}:${challenge.salt}:${counter}`),
    );
    if (hasLeadingZeroBits(new Uint8Array(digest), challenge.difficulty)) return counter;
    if (counter % 256 === 255) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Could not complete the security check.");
}
