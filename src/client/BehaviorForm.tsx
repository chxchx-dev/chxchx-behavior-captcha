"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CHALLENGE_TOKEN_FIELD, HONEYPOT_FIELD, POW_COUNTER_FIELD } from "../shared/types.js";
import type { ActionResult, BehaviorTelemetry, RiskDiagnostics } from "../shared/types.js";
import { useBehaviorTelemetry } from "./useBehaviorTelemetry.js";
import { withBehaviorFormData } from "./packTelemetry.js";
import { ProofSolveError, solveProofOfWork } from "./solveProofOfWork.js";
import type { ProofSolveStats } from "./solveProofOfWork.js";

export interface BehaviorFormProps {
  action: (data: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  /** Host-provided accessible route such as manual review or an accessible support channel. */
  proofFallback?: ReactNode;
  /** Maximum browser time spent solving one proof; defaults to 15 seconds. */
  proofTimeoutMs?: number;
  onAccepted?: () => void;
  onTelemetry?: (telemetry: BehaviorTelemetry) => void;
  onDiagnostics?: (diagnostics: RiskDiagnostics | undefined) => void;
  onProofSolved?: (result: { counter: number; attempts: number; elapsedMs: number }) => void;
  onProofInterrupted?: (stats: ProofSolveStats) => void;
}

/** Form wrapper that attaches telemetry and solves a server-requested proof of work. */
export function BehaviorForm({
  action,
  children,
  className,
  proofFallback,
  proofTimeoutMs = 15_000,
  onAccepted,
  onTelemetry,
  onDiagnostics,
  onProofSolved,
  onProofInterrupted,
}: BehaviorFormProps) {
  const { snapshot } = useBehaviorTelemetry();
  const proofController = useRef<AbortController | null>(null);
  const fallbackDetails = useRef<HTMLDetailsElement | null>(null);
  const [message, setMessage] = useState("");
  const [messageRole, setMessageRole] = useState<"status" | "alert">("status");
  const [succeeded, setSucceeded] = useState(false);
  const [pending, setPending] = useState(false);
  const [proofActive, setProofActive] = useState(false);

  useEffect(() => () => proofController.current?.abort(), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessageRole("status");
    setMessage("Enviando el formulario…");
    setSucceeded(false);
    try {
      const telemetry = snapshot();
      onTelemetry?.(telemetry);
      const data = withBehaviorFormData(new FormData(event.currentTarget), telemetry);
      let result = await action(data);
      if (result.status === "challenge") {
        onDiagnostics?.(result.diagnostics);
        setMessage("Comprobación de seguridad en curso. Puedes detenerla si tarda demasiado.");
        const proofStartedAt = performance.now();
        const controller = new AbortController();
        proofController.current = controller;
        setProofActive(true);
        let counter: number;
        try {
          counter = await solveProofOfWork(result.challenge, {
            signal: controller.signal,
            maxDurationMs: proofTimeoutMs,
          });
        } catch (error) {
          const stats = error instanceof ProofSolveError
            ? error.stats
            : { reason: "unavailable" as const, attempts: 0, elapsedMs: Math.round(performance.now() - proofStartedAt) };
          try {
            onProofInterrupted?.(stats);
          } catch {
            // Optional measurement callbacks must not prevent the accessible fallback.
          }
          setMessageRole("alert");
          setMessage(stats.reason === "cancelled"
            ? "Comprobación detenida. Puedes volver a intentarlo o usar la alternativa disponible."
            : "No se pudo completar la comprobación. Puedes volver a intentarlo o usar la alternativa disponible.");
          if (fallbackDetails.current) fallbackDetails.current.open = true;
          return;
        } finally {
          proofController.current = null;
          setProofActive(false);
        }
        onProofSolved?.({ counter, attempts: counter + 1, elapsedMs: Math.round(performance.now() - proofStartedAt) });
        data.set(CHALLENGE_TOKEN_FIELD, result.challenge.token);
        data.set(POW_COUNTER_FIELD, String(counter));
        result = await action(data);
      }
      if (result.status === "challenge") {
        setMessageRole("alert");
        setMessage("No se pudo completar la comprobación. Inténtalo de nuevo.");
      } else if (result.status === "accepted") {
        setSucceeded(true);
        setMessageRole("status");
        setMessage("Solicitud verificada. Esta demo no guarda los datos.");
        onAccepted?.();
      } else if (result.status === "blocked") {
        setMessageRole("alert");
        setMessage("No se pudo validar el envío. Revisa los datos e inténtalo de nuevo.");
      } else {
        setMessageRole("alert");
        setMessage(result.message);
      }
    } catch {
      setMessageRole("alert");
      setMessage("No se pudo enviar el formulario. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={className} onSubmit={handleSubmit} aria-busy={pending}>
      <div className="behavior-captcha-trap" aria-hidden="true">
        <label htmlFor="behavior-company-website">No rellenes este campo</label>
        <input id="behavior-company-website" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {children}
      {message && <p role={messageRole} aria-live={messageRole === "status" ? "polite" : "assertive"} aria-atomic="true">{message}</p>}
      <button type="submit" disabled={pending}>{pending ? "Verificando…" : "Enviar"}</button>
      {proofActive && <button type="button" onClick={() => proofController.current?.abort()}>Detener comprobación</button>}
      {proofFallback && (
        <details className="behavior-captcha-fallback" ref={fallbackDetails}>
          <summary>¿No puedes completar la comprobación?</summary>
          {proofFallback}
        </details>
      )}
    </form>
  );
}
