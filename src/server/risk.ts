import type { BehaviorTelemetry } from "../shared/types";

export interface RiskConfig {
  fastSubmitMs: number;
  challengeThreshold: number;
  blockThreshold: number;
  longTextThreshold: number;
  fastSubmitPoints: number;
  noInteractionPoints: number;
  injectedTextPoints: number;
}

export const DEFAULT_RISK_CONFIG: Readonly<RiskConfig> = {
  fastSubmitMs: 1_500,
  challengeThreshold: 50,
  blockThreshold: 90,
  longTextThreshold: 80,
  fastSubmitPoints: 35,
  noInteractionPoints: 60,
  injectedTextPoints: 45,
};

export interface RiskAssessment {
  score: number;
  signals: string[];
  honeypotTriggered: boolean;
}

function validCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, 1_000_000) : 0;
}

export function parseBehaviorTelemetry(value: FormDataEntryValue | unknown): BehaviorTelemetry | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    if (value.length > 2_000) return null;
    try { parsed = JSON.parse(value) as unknown; } catch { return null; }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== 1) return null;
  return {
    version: 1,
    startedAt: validCount(candidate.startedAt),
    submittedAt: validCount(candidate.submittedAt),
    elapsedMs: validCount(candidate.elapsedMs),
    mouseMoves: validCount(candidate.mouseMoves),
    keyPresses: validCount(candidate.keyPresses),
    touchEvents: validCount(candidate.touchEvents),
  };
}

export function scoreBehavior(input: {
  telemetry: BehaviorTelemetry | null;
  honeypotValue: unknown;
  validTextLength: number;
  config?: Partial<RiskConfig>;
}): RiskAssessment {
  const config = { ...DEFAULT_RISK_CONFIG, ...input.config };
  const trap = typeof input.honeypotValue === "string" ? input.honeypotValue : "";
  if (trap.length > 0) return { score: 100, signals: ["honeypot"], honeypotTriggered: true };

  const telemetry = input.telemetry;
  const signals: string[] = [];
  let score = 0;
  if (!telemetry || telemetry.elapsedMs < config.fastSubmitMs) {
    score += config.fastSubmitPoints;
    signals.push("fast_or_missing_telemetry");
  }
  const interactions = telemetry
    ? telemetry.mouseMoves + telemetry.keyPresses + telemetry.touchEvents
    : 0;
  if (interactions === 0) {
    score += config.noInteractionPoints;
    signals.push("no_physical_interaction");
  }
  if (input.validTextLength >= config.longTextThreshold && (!telemetry || telemetry.keyPresses === 0)) {
    score += config.injectedTextPoints;
    signals.push("text_without_keypresses");
  }
  return { score: Math.max(0, Math.min(100, score)), signals, honeypotTriggered: false };
}
