export interface RateLimitStore {
  consume(key: string, capacity: number, refillWindowMs: number, now?: number): Promise<{
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
  }>;
}

interface BucketState {
  tokens: number;
  updatedAt: number;
}

/** Per-process token bucket for local development or a single server instance. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, BucketState>();

  async consume(key: string, capacity: number, refillWindowMs: number, now = Date.now()) {
    if (!Number.isInteger(capacity) || capacity < 1 || !Number.isFinite(refillWindowMs) || refillWindowMs <= 0) {
      throw new Error("Invalid rate limit configuration.");
    }
    const existing = this.buckets.get(key);
    const refillPerMs = capacity / refillWindowMs;
    const elapsed = existing ? Math.max(0, now - existing.updatedAt) : refillWindowMs;
    const tokens = Math.min(capacity, (existing?.tokens ?? capacity) + elapsed * refillPerMs);
    if (tokens < 1) {
      const retryAfterMs = Math.ceil((1 - tokens) / refillPerMs);
      this.buckets.set(key, { tokens, updatedAt: now });
      return { allowed: false, remaining: 0, retryAfterMs };
    }
    const remainingTokens = tokens - 1;
    this.buckets.set(key, { tokens: remainingTokens, updatedAt: now });
    return { allowed: true, remaining: Math.floor(remainingTokens), retryAfterMs: 0 };
  }
}
