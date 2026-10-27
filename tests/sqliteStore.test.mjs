import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLiteCaptchaStore } from "../dist/server/sqliteStore.js";

const options = { keyHashSecret: "sqlite-test-hash-secret-at-least-32-characters" };

test("SQLite rate limits persist, pseudonymize keys, and clean up expired rows", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "behavior-captcha-test-"));
  const databasePath = join(tempDirectory, "store.sqlite");
  let database;
  try {
    database = new DatabaseSync(databasePath);
    const store = new SQLiteCaptchaStore(database, options);
    const now = Date.now();
    assert.deepEqual(await store.rateLimits.consume("ip4:192.0.2.20", 1, 1_000, now), {
      allowed: true,
      remaining: 0,
      retryAfterMs: 0,
    });
    assert.equal((await store.rateLimits.consume("ip4:192.0.2.20", 1, 1_000, now)).allowed, false);
    const concurrentResults = await Promise.all(Array.from({ length: 20 }, () =>
      store.rateLimits.consume("client:concurrent", 4, 60_000, now)));
    assert.equal(concurrentResults.filter((result) => result.allowed).length, 4);
    const storedKeys = database.prepare("SELECT key_hash FROM behavior_captcha_rate_limits").all();
    assert.equal(storedKeys.some(({ key_hash }) => key_hash.includes("192.0.2.20")), false);
    database.close();

    database = new DatabaseSync(databasePath);
    const reopened = new SQLiteCaptchaStore(database, options);
    assert.equal((await reopened.rateLimits.consume("ip4:192.0.2.20", 1, 1_000, now)).allowed, false);

    const expiry = Date.now() + 60_000;
    const attempts = await Promise.all(Array.from({ length: 12 }, () =>
      reopened.challenges.consume("single-use-nonce", expiry)));
    assert.equal(attempts.filter(Boolean).length, 1);

    assert.deepEqual(await reopened.pruneExpired(Date.now() + 120_000), {
      rateLimitBuckets: 2,
      challenges: 1,
    });
  } finally {
    database?.close();
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
