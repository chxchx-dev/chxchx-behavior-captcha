import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ChallengeStore } from "../shared/types.js";
import type { RateLimitStore } from "./rateLimit.js";

type SQLiteValue = string | number | bigint | null;

export interface SQLiteRunResult {
  changes: number | bigint;
}

/** Minimal synchronous SQLite interface; compatible with node:sqlite and similar drivers. */
export interface SQLiteStatement {
  run(...parameters: SQLiteValue[]): SQLiteRunResult;
  get(...parameters: SQLiteValue[]): unknown;
}

/** Keep the database connection private to a server process. */
export interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
}

export interface SQLiteCaptchaStoreOptions {
  /** Independent random server-only key used to pseudonymize rate-limit keys before storage. */
  keyHashSecret: string;
}

export interface OpenSQLiteCaptchaStoreOptions extends SQLiteCaptchaStoreOptions {
  /** SQLite lock wait in milliseconds. Defaults to 5000. */
  busyTimeoutMs?: number;
}

function validateStoreOptions(options: SQLiteCaptchaStoreOptions): void {
  if (!options || typeof options.keyHashSecret !== "string" || options.keyHashSecret.length < 32) {
    throw new Error("Rate-limit key hash secret must contain at least 32 characters.");
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS behavior_captcha_rate_limits (
    key_hash TEXT PRIMARY KEY NOT NULL,
    tokens REAL NOT NULL CHECK (tokens >= 0),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    refill_window_ms REAL NOT NULL CHECK (refill_window_ms > 0),
    updated_at_ms INTEGER NOT NULL,
    last_allowed INTEGER NOT NULL CHECK (last_allowed IN (0, 1))
  );
  CREATE INDEX IF NOT EXISTS behavior_captcha_rate_limits_expiry
    ON behavior_captcha_rate_limits (updated_at_ms + refill_window_ms);
  CREATE TABLE IF NOT EXISTS behavior_captcha_consumed_challenges (
    nonce TEXT PRIMARY KEY NOT NULL CHECK (length(nonce) BETWEEN 1 AND 128),
    expires_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS behavior_captcha_challenges_expiry
    ON behavior_captcha_consumed_challenges (expires_at_ms);
`;

const availableTokens = `MIN(
  excluded.capacity,
  behavior_captcha_rate_limits.tokens
    + MAX(0, excluded.updated_at_ms - behavior_captcha_rate_limits.updated_at_ms)
      * excluded.capacity / excluded.refill_window_ms
)`;

/** Atomic SQLite token bucket with HMAC-pseudonymized limiter keys. */
export class SQLiteRateLimitStore implements RateLimitStore {
  private readonly consumeStatement: SQLiteStatement;

  constructor(private readonly database: SQLiteDatabase, private readonly options: SQLiteCaptchaStoreOptions) {
    validateStoreOptions(options);
    this.consumeStatement = database.prepare(`
      INSERT INTO behavior_captcha_rate_limits
        (key_hash, tokens, capacity, refill_window_ms, updated_at_ms, last_allowed)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT (key_hash) DO UPDATE SET
        tokens = CASE WHEN ${availableTokens} >= 1 THEN ${availableTokens} - 1 ELSE ${availableTokens} END,
        capacity = excluded.capacity,
        refill_window_ms = excluded.refill_window_ms,
        updated_at_ms = MAX(behavior_captcha_rate_limits.updated_at_ms, excluded.updated_at_ms),
        last_allowed = CASE WHEN ${availableTokens} >= 1 THEN 1 ELSE 0 END
      RETURNING tokens, last_allowed
    `);
  }

  private hashKey(key: string): string {
    if (!key || key.length > 4_096) throw new Error("Rate-limit key is invalid.");
    return createHmac("sha256", this.options.keyHashSecret)
      .update(`rate-limit\0${key}`)
      .digest("base64url");
  }

  async consume(key: string, capacity: number, refillWindowMs: number, now = Date.now()) {
    if (!Number.isSafeInteger(capacity) || capacity < 1 || !Number.isFinite(refillWindowMs) || refillWindowMs <= 0) {
      throw new Error("Invalid rate limit configuration.");
    }
    if (!Number.isSafeInteger(now)) throw new Error("Rate-limit timestamp is invalid.");

    const keyHash = this.hashKey(key);
    const row = this.consumeStatement.get(keyHash, capacity - 1, capacity, refillWindowMs, now) as
      | { tokens?: unknown; last_allowed?: unknown }
      | undefined;
    if (!row || typeof row.tokens !== "number") throw new Error("Rate-limit update returned no row.");

    const denied = Number(row.last_allowed) !== 1;
    return {
      allowed: !denied,
      remaining: denied ? 0 : Math.floor(row.tokens),
      retryAfterMs: denied ? Math.ceil((1 - row.tokens) * refillWindowMs / capacity) : 0,
    };
  }
}

/** Atomically consumes a one-use challenge nonce. */
export class SQLiteChallengeStore implements ChallengeStore {
  private readonly consumeStatement: SQLiteStatement;

  constructor(private readonly database: SQLiteDatabase) {
    this.consumeStatement = database.prepare(`
      INSERT INTO behavior_captcha_consumed_challenges (nonce, expires_at_ms)
      VALUES (?, ?)
      ON CONFLICT (nonce) DO UPDATE
        SET expires_at_ms = excluded.expires_at_ms
        WHERE behavior_captcha_consumed_challenges.expires_at_ms <= ?
    `);
  }

  async consume(nonce: string, expiresAt: number): Promise<boolean> {
    if (!nonce || nonce.length > 128 || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
    return Number(this.consumeStatement.run(nonce, expiresAt, Date.now()).changes) === 1;
  }
}

/** Shared local store for one self-hosted Node.js application. */
export class SQLiteCaptchaStore {
  readonly rateLimits: SQLiteRateLimitStore;
  readonly challenges: SQLiteChallengeStore;

  constructor(private readonly database: SQLiteDatabase, options: SQLiteCaptchaStoreOptions) {
    validateStoreOptions(options);
    database.exec(SCHEMA);
    this.rateLimits = new SQLiteRateLimitStore(database, options);
    this.challenges = new SQLiteChallengeStore(database);
  }

  /** Remove limiter buckets that have fully refilled and expired challenge nonces. */
  async pruneExpired(now = Date.now()): Promise<{ rateLimitBuckets: number; challenges: number }> {
    if (!Number.isSafeInteger(now)) throw new Error("Cleanup timestamp is invalid.");
    const rateLimits = this.database.prepare(`
      DELETE FROM behavior_captcha_rate_limits
      WHERE updated_at_ms + refill_window_ms <= ?
    `).run(now).changes;
    const challenges = this.database.prepare(`
      DELETE FROM behavior_captcha_consumed_challenges
      WHERE expires_at_ms <= ?
    `).run(now).changes;
    return { rateLimitBuckets: Number(rateLimits), challenges: Number(challenges) };
  }
}

/** Open a file-backed SQLite store using Node's built-in SQLite module. */
export function openSQLiteCaptchaStore(path: string, options: OpenSQLiteCaptchaStoreOptions): SQLiteCaptchaStore {
  if (!path || path.length > 4_096) throw new Error("SQLite database path is invalid.");
  validateStoreOptions(options);
  const busyTimeoutMs = options.busyTimeoutMs ?? 5_000;
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
    throw new Error("SQLite busy timeout must be an integer between 0 and 60000 milliseconds.");
  }

  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const database = new DatabaseSync(path);
  try {
    database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;`);
    return new SQLiteCaptchaStore(database, options);
  } catch (error) {
    database.close();
    throw error;
  }
}
