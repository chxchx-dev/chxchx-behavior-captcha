"use server";

import { handleBehaviorSubmission, openSQLiteCaptchaStore } from "@chxchx/behavior-captcha/server";

const store = openSQLiteCaptchaStore(":memory:", {
  keyHashSecret: "package-smoke-key-hash-secret-at-least-32-characters",
});

export async function submit(data: FormData) {
  return handleBehaviorSubmission(data, {
    secret: "package-smoke-challenge-secret-at-least-32-characters",
    challengeStore: store.challenges,
    challengeScope: "contact:smoke",
    challengePolicy: { mode: "always" },
    rateLimit: {
      store: store.rateLimits,
      key: "contact:smoke",
      capacity: 10,
      refillWindowMs: 60_000,
    },
    textFields: ["message"],
    onAccepted: async () => {},
  });
}
