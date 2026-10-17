"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CHALLENGE_TOKEN_FIELD, HONEYPOT_FIELD, POW_COUNTER_FIELD } from "../shared/types";
import type { ActionResult, BehaviorTelemetry, RiskDiagnostics } from "../shared/types";
import { useBehaviorTelemetry } from "./useBehaviorTelemetry";
import { withBehaviorFormData } from "./packTelemetry";
import { solveProofOfWork } from "./solveProofOfWork";

export interface BehaviorFormProps {
  action: (data: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  onAccepted?: () => void;
  onTelemetry?: (telemetry: BehaviorTelemetry) => void;
  onDiagnostics?: (diagnostics: RiskDiagnostics | undefined) => void;
  onProofSolved?: (result: { counter: number; attempts: number; elapsedMs: number }) => void;
}

/** Form wrapper that attaches telemetry and solves a server-requested proof of work. */
export function BehaviorForm({ action, children, className, onAccepted, onTelemetry, onDiagnostics, onProofSolved }: BehaviorFormProps) {
  const { snapshot } = useBehaviorTelemetry();
  const [message, setMessage] = useState("");
  const [succeeded, setSucceeded] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setSucceeded(false);
    try {
      const telemetry = snapshot();
      onTelemetry?.(telemetry);
      const data = withBehaviorFormData(new FormData(event.currentTarget), telemetry);
      let result = await action(data);
      if (result.status === "challenge") {
        onDiagnostics?.(result.diagnostics);
        setMessage("Comprobación local de seguridad en curso…");
        const proofStartedAt = performance.now();
        const counter = await solveProofOfWork(result.challenge);
        onProofSolved?.({ counter, attempts: counter + 1, elapsedMs: Math.round(performance.now() - proofStartedAt) });
        data.set(CHALLENGE_TOKEN_FIELD, result.challenge.token);
        data.set(POW_COUNTER_FIELD, String(counter));
        result = await action(data);
      }
      if (result.status === "challenge") {
        setMessage("No se pudo completar la comprobación. Inténtalo de nuevo.");
      } else if (result.status === "accepted") {
        setSucceeded(true);
        setMessage("Solicitud verificada. Esta demo no guarda los datos.");
        onAccepted?.();
      } else if (result.status === "blocked") {
        setMessage("No se pudo validar el envío. Revisa los datos e inténtalo de nuevo.");
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("No se pudo enviar el formulario. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <div className="behavior-captcha-trap" aria-hidden="true">
        <label htmlFor="behavior-company-website">No rellenes este campo</label>
        <input id="behavior-company-website" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {children}
      {message && <p role={succeeded ? "status" : "alert"}>{message}</p>}
      <button type="submit" disabled={pending}>{pending ? "Verificando…" : "Enviar"}</button>
    </form>
  );
}
