"use server";

import { headers } from "next/headers";
import { isIP } from "node:net";
import { handleBehaviorSubmission, openSQLiteCaptchaStore } from "../../src/server";

function serverSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} must be set in production.`);
  return devFallback;
}

const captchaStore = openSQLiteCaptchaStore(
  process.env.BEHAVIOR_CAPTCHA_DB_PATH ?? ".data/behavior-captcha.sqlite",
  { keyHashSecret: serverSecret("RATE_LIMIT_KEY_HASH_SECRET", "local-demo-key-hash-secret-change-before-production") },
);

function canonicalClientIp(value: string | null): string | undefined {
  const ip = value?.trim();
  if (!ip || ip.length > 45) return undefined;

  const version = isIP(ip);
  if (version === 4) return `ip4:${ip.split(".").map((part) => String(Number(part))).join(".")}`;
  if (version === 6) {
    try {
      const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase();
      return `ip6:${canonical}`;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function requiredText(formData: FormData, name: string, maxLength: number): string {
  const values = formData.getAll(name);
  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new Error(`Expected one text value for ${name}.`);
  }

  const value = values[0].trim();
  if (!value || value.length > maxLength) {
    throw new Error(`Invalid value for ${name}.`);
  }
  return value;
}

export async function submitContact(data: FormData) {
  const requestHeaders = await headers();
  // This is safe only when the reverse proxy overwrites x-real-ip and direct app access is blocked.
  const clientIp = canonicalClientIp(requestHeaders.get("x-real-ip"));
  if (!clientIp && process.env.NODE_ENV === "production") {
    return { status: "error", message: "No se pudo procesar el envío." } as const;
  }
  const clientKey = clientIp ?? "local-demo";

  // This demo endpoint is intentionally public. CAPTCHA does not authenticate users or grant
  // permission for private operations; add session and resource authorization to those actions.
  return handleBehaviorSubmission(data, {
    secret: serverSecret("BEHAVIOR_CAPTCHA_SECRET", "local-demo-captcha-secret-change-before-production"),
    challengeStore: captchaStore.challenges,
    // Tie the ticket to this operation and client scope. Use a validated session/account ID when available.
    challengeScope: `contact:${clientKey}`,
    challengePolicy: { mode: "always" },
    rateLimit: { store: captchaStore.rateLimits, key: `contact:${clientKey}`, capacity: 10, refillWindowMs: 60_000 },
    textFields: ["name", "message"],
    proofDifficultyBits: 14,
    exposeDiagnostics: true,
    onAccepted: async (formData) => {
      const name = requiredText(formData, "name", 120);
      const message = requiredText(formData, "message", 4_000);
      // Persist the validated values through the application's own data layer.
    },
  });
}
