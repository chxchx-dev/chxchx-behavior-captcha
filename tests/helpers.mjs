import { createHash } from "node:crypto";
import { InMemoryChallengeStore } from "../dist/server/proofOfWork.js";
import { InMemoryRateLimitStore } from "../dist/server/rateLimit.js";
import { CHALLENGE_TOKEN_FIELD, POW_COUNTER_FIELD } from "../dist/shared/types.js";

export const TEST_SECRET = "behavior-captcha-test-secret-at-least-32-characters";

export function createForm({ name = "Ada", message = "Hello", telemetry } = {}) {
  const data = new FormData();
  data.set("name", name);
  data.set("message", message);
  if (telemetry !== undefined) data.set("_behavior", JSON.stringify(telemetry));
  return data;
}

export function copyForm(data) {
  const copy = new FormData();
  data.forEach((value, key) => copy.append(key, value));
  return copy;
}

export function addProof(data, challenge, counter) {
  const copy = copyForm(data);
  copy.set(CHALLENGE_TOKEN_FIELD, challenge.token);
  copy.set(POW_COUNTER_FIELD, String(counter));
  return copy;
}

export function findProofCounter({ nonce, salt, difficulty }) {
  for (let counter = 0; counter <= Number.MAX_SAFE_INTEGER; counter += 1) {
    const digest = createHash("sha256").update(`${nonce}:${salt}:${counter}`).digest();
    const fullBytes = Math.floor(difficulty / 8);
    const remainingBits = difficulty % 8;
    if (digest.subarray(0, fullBytes).some((byte) => byte !== 0)) continue;
    if (remainingBits > 0 && (digest[fullBytes] >> (8 - remainingBits)) !== 0) continue;
    return counter;
  }
  throw new Error("Could not find a proof counter.");
}

export function createOptions(overrides = {}) {
  return {
    secret: TEST_SECRET,
    challengeStore: new InMemoryChallengeStore(),
    challengeScope: "contact:test-client",
    challengePolicy: { mode: "always" },
    rateLimit: {
      store: new InMemoryRateLimitStore(),
      key: "contact:test-client",
      capacity: 100,
      refillWindowMs: 60_000,
    },
    proofDifficultyBits: 8,
    textFields: ["name", "message"],
    onAccepted: () => {},
    ...overrides,
  };
}
