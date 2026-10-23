import { BEHAVIOR_FIELD } from "../shared/types.js";
import type { BehaviorTelemetry } from "../shared/types.js";

/** Adds a JSON-encoded telemetry field to a copy of FormData. */
export function withBehaviorFormData(formData: FormData, telemetry: BehaviorTelemetry): FormData {
  const packed = new FormData();
  formData.forEach((value, key) => packed.append(key, value));
  packed.set(BEHAVIOR_FIELD, JSON.stringify(telemetry));
  return packed;
}

/** Adds telemetry to a JSON payload without mutating the caller's object. */
export function withBehaviorPayload<T extends Record<string, unknown>>(
  payload: T,
  telemetry: BehaviorTelemetry,
): T & { [BEHAVIOR_FIELD]: BehaviorTelemetry } {
  return { ...payload, [BEHAVIOR_FIELD]: telemetry } as T & { [BEHAVIOR_FIELD]: BehaviorTelemetry };
}
