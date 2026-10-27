import test from "node:test";
import assert from "node:assert/strict";
import { handleBehaviorSubmission } from "../dist/server/handleSubmission.js";
import { HONEYPOT_FIELD } from "../dist/shared/types.js";
import { addProof, createForm, createOptions, findProofCounter } from "./helpers.mjs";

test("always policy returns a challenge and accepts the same form after solving it", async () => {
  let accepted = 0;
  const options = createOptions({ onAccepted: () => { accepted += 1; } });
  const form = createForm();
  const first = await handleBehaviorSubmission(form, options);

  assert.equal(first.status, "challenge");
  assert.equal(accepted, 0);

  const solved = addProof(form, first.challenge, findProofCounter(first.challenge));
  const result = await handleBehaviorSubmission(solved, options);
  assert.deepEqual(result, { status: "accepted" });
  assert.equal(accepted, 1);
});

test("a challenge cannot be reused with changed form data and a rejected change does not consume its nonce", async () => {
  const options = createOptions();
  const form = createForm();
  const first = await handleBehaviorSubmission(form, options);
  assert.equal(first.status, "challenge");

  const counter = findProofCounter(first.challenge);
  const changed = createForm({ message: "modified after challenge" });
  const rejected = await handleBehaviorSubmission(addProof(changed, first.challenge, counter), options);
  assert.deepEqual(rejected, { status: "blocked", reason: "invalid_challenge" });

  const accepted = await handleBehaviorSubmission(addProof(form, first.challenge, counter), options);
  assert.deepEqual(accepted, { status: "accepted" });
});

test("initial submissions and proof verification use separate rate-limit buckets", async () => {
  const options = createOptions({
    rateLimit: {
      store: new (await import("../dist/server/rateLimit.js")).InMemoryRateLimitStore(),
      key: "one-initial-request",
      capacity: 1,
      refillWindowMs: 60_000,
    },
  });
  const form = createForm();
  const first = await handleBehaviorSubmission(form, options);
  assert.equal(first.status, "challenge");

  const verification = await handleBehaviorSubmission(
    addProof(form, first.challenge, findProofCounter(first.challenge)),
    options,
  );
  assert.deepEqual(verification, { status: "accepted" });

  const nextInitial = await handleBehaviorSubmission(createForm(), options);
  assert.deepEqual(nextInitial, { status: "blocked", reason: "risk" });
});

test("adaptive policy accepts low-risk telemetry and challenges suspicious input", async () => {
  let accepted = 0;
  const options = createOptions({
    challengePolicy: { mode: "adaptive", remainingTokensThreshold: 2 },
    onAccepted: () => { accepted += 1; },
  });
  const now = Date.now();
  const lowRisk = createForm({ telemetry: {
    version: 1,
    startedAt: now - 5_000,
    submittedAt: now,
    elapsedMs: 5_000,
    mouseMoves: 3,
    keyPresses: 12,
    touchEvents: 0,
  } });

  assert.deepEqual(await handleBehaviorSubmission(lowRisk, options), { status: "accepted" });
  assert.equal(accepted, 1);

  const suspicious = await handleBehaviorSubmission(createForm(), options);
  assert.equal(suspicious.status, "challenge");
  assert.equal(accepted, 1);
});

test("honeypot, oversized input, and invalid adaptive configuration are rejected", async () => {
  const withTrap = createForm();
  withTrap.set(HONEYPOT_FIELD, "filled by a bot");
  assert.deepEqual(
    await handleBehaviorSubmission(withTrap, createOptions()),
    { status: "blocked", reason: "honeypot" },
  );

  assert.deepEqual(
    await handleBehaviorSubmission(createForm(), createOptions({ inputLimits: { maxEntries: 1 } })),
    { status: "blocked", reason: "invalid_input" },
  );
  assert.deepEqual(
    await handleBehaviorSubmission(createForm(), createOptions({ inputLimits: { maxTotalBytes: 4 } })),
    { status: "blocked", reason: "invalid_input" },
  );

  assert.equal((await handleBehaviorSubmission(createForm(), createOptions({
    challengePolicy: { mode: "adaptive", remainingTokensThreshold: 0 },
    rateLimit: undefined,
  }))).status, "error");
});
