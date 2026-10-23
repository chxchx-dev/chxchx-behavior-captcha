"use client";

import { useCallback, useEffect, useRef } from "react";
import type { BehaviorTelemetry } from "../shared/types.js";

export interface BehaviorTelemetryOptions {
  mouseThrottleMs?: number;
}

/** Collects low-volume interaction counts. Values are heuristic and client-controlled. */
export function useBehaviorTelemetry(options: BehaviorTelemetryOptions = {}) {
  const counters = useRef({
    startedAt: 0,
    mouseMoves: 0,
    keyPresses: 0,
    touchEvents: 0,
    lastMouseAt: 0,
  });
  const throttleMs = options.mouseThrottleMs ?? 100;

  useEffect(() => {
    const state = counters.current;
    state.startedAt = Date.now();
    state.mouseMoves = 0;
    state.keyPresses = 0;
    state.touchEvents = 0;
    state.lastMouseAt = 0;

    const onMouseMove = () => {
      const now = performance.now();
      if (now - state.lastMouseAt >= throttleMs) {
        state.mouseMoves += 1;
        state.lastMouseAt = now;
      }
    };
    const onKeyDown = () => { state.keyPresses += 1; };
    const onTouchStart = () => { state.touchEvents += 1; };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("keydown", onKeyDown, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, [throttleMs]);

  const snapshot = useCallback((): BehaviorTelemetry => {
    const state = counters.current;
    const submittedAt = Date.now();
    const startedAt = state.startedAt || submittedAt;
    return {
      version: 1,
      startedAt,
      submittedAt,
      elapsedMs: Math.max(0, submittedAt - startedAt),
      mouseMoves: state.mouseMoves,
      keyPresses: state.keyPresses,
      touchEvents: state.touchEvents,
    };
  }, []);

  return { snapshot };
}
