import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createProofOfWork, verifyProofOfWork, InMemoryChallengeStore } from "../dist/server/proofOfWork.js";
import { TEST_SECRET, findProofCounter } from "./helpers.mjs";

const scope = "contact:session-123";
const requestHash = createHash("sha256").update("form content").digest("base64url");

function issueChallenge(overrides = {}) {
  return createProofOfWork({
    secret: TEST_SECRET,
    scope,
    requestHash,
    difficultyBits: 8,
    ...overrides,
  });
}

test("proof is bound to the scope and original request and its nonce is single-use", async () => {
  const challenge = issueChallenge();
  const counter = findProofCounter(challenge);
  const store = new InMemoryChallengeStore();
  const input = { token: challenge.token, counter: String(counter), secret: TEST_SECRET, scope, requestHash, store };

  assert.equal(await verifyProofOfWork(input), true);
  assert.equal(await verifyProofOfWork(input), false, "a consumed proof must not be replayed");
  assert.equal(await verifyProofOfWork({ ...input, scope: "contact:another-session" }), false);
  assert.equal(await verifyProofOfWork({
    ...input,
    requestHash: createHash("sha256").update("changed content").digest("base64url"),
  }), false);
});

test("proof rejects a changed signature, counter, or expired challenge", async () => {
  const challenge = issueChallenge();
  const counter = findProofCounter(challenge);
  const store = new InMemoryChallengeStore();
  const valid = { token: challenge.token, counter: String(counter), secret: TEST_SECRET, scope, requestHash, store };
  const replacement = challenge.token.endsWith("A") ? "B" : "A";

  assert.equal(await verifyProofOfWork({ ...valid, token: `${challenge.token.slice(0, -1)}${replacement}` }), false);
  assert.equal(await verifyProofOfWork({ ...valid, counter: "not-a-number" }), false);

  const expired = issueChallenge({ now: () => Date.now() - 2_000, ttlMs: 1_000 });
  assert.equal(await verifyProofOfWork({
    ...valid,
    token: expired.token,
    counter: String(findProofCounter(expired)),
  }), false);
});
