import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { SQLiteCaptchaStore } from "../dist/server/sqliteStore.js";

const secret = "prune-cli-test-hash-secret-at-least-32-characters";
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const commandPath = join(repositoryRoot, "bin/prune-expired.mjs");

test("prune CLI removes expired records and requires its server configuration", async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "behavior-captcha-prune-test-"));
  const databasePath = join(tempDirectory, "store.sqlite");
  const store = new SQLiteCaptchaStore(new DatabaseSync(databasePath), { keyHashSecret: secret });
  try {
    await store.rateLimits.consume("expired-client", 1, 1_000, Date.now() - 60_000);
  } finally {
    store.close();
  }

  try {
    const result = spawnSync(process.execPath, [commandPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        BEHAVIOR_CAPTCHA_DB_PATH: databasePath,
        RATE_LIMIT_KEY_HASH_SECRET: secret,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { rateLimitBuckets: 1, challenges: 0 });

    const missingEnvironment = { ...process.env };
    delete missingEnvironment.BEHAVIOR_CAPTCHA_DB_PATH;
    delete missingEnvironment.RATE_LIMIT_KEY_HASH_SECRET;
    const missingConfig = spawnSync(process.execPath, [commandPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: missingEnvironment,
    });
    assert.equal(missingConfig.status, 1);
    assert.match(missingConfig.stderr, /BEHAVIOR_CAPTCHA_DB_PATH/);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});
