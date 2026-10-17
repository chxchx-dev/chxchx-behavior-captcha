"use server";

import { headers } from "next/headers";
import { handleBehaviorSubmission, InMemoryChallengeStore, InMemoryRateLimitStore } from "../../src/server";

// Development only. Use a shared database/KV store with an atomic unique insert in production.
const challengeStore = new InMemoryChallengeStore();
const rateLimitStore = new InMemoryRateLimitStore();

export async function submitContact(data: FormData) {
  const requestHeaders = await headers();
  // In production, trust this header only when your reverse proxy overwrites it.
  const clientKey = requestHeaders.get("x-real-ip") ?? "local-demo";
  return handleBehaviorSubmission(data, {
    secret: process.env.BEHAVIOR_CAPTCHA_SECRET ?? "",
    challengeStore,
    rateLimit: { store: rateLimitStore, key: `contact:${clientKey}`, capacity: 10, refillWindowMs: 60_000 },
    textFields: ["name", "message"],
    // The demo forces the proof on every submission so the flow is easy to observe.
    challengeThreshold: -1,
    proofDifficultyBits: 14,
    exposeDiagnostics: true,
    onAccepted: async (formData) => {
      const name = String(formData.get("name") ?? "").trim().slice(0, 120);
      const message = String(formData.get("message") ?? "").trim().slice(0, 4_000);
      if (!name || !message) throw new Error("Required fields are missing.");
      // Persist the validated values through the application's own data layer.
    },
  });
}
