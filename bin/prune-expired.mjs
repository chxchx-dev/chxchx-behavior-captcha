#!/usr/bin/env node

import { openSQLiteCaptchaStore } from "../dist/server/sqliteStore.js";

const databasePath = process.env.BEHAVIOR_CAPTCHA_DB_PATH;
const keyHashSecret = process.env.RATE_LIMIT_KEY_HASH_SECRET;

if (!databasePath || databasePath === ":memory:" || !keyHashSecret) {
  console.error("Set BEHAVIOR_CAPTCHA_DB_PATH to a persistent SQLite file and RATE_LIMIT_KEY_HASH_SECRET.");
  process.exitCode = 1;
} else {
  let store;
  try {
    store = openSQLiteCaptchaStore(databasePath, { keyHashSecret });
    const pruned = await store.pruneExpired();
    console.log(JSON.stringify(pruned));
  } catch {
    console.error("Could not clean expired CAPTCHA records; check the database path and server secret configuration.");
    process.exitCode = 1;
  } finally {
    store?.close();
  }
}
