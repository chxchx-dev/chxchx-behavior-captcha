"use client";

import { useState } from "react";
import type { BehaviorTelemetry, RiskDiagnostics } from "../../src/shared/types";
import type { ProofSolveFailureReason } from "../../src/client/solveProofOfWork";
import { BehaviorForm } from "../../src/client/BehaviorForm";
import { submitContact } from "./actions";

const signalNames: Record<string, string> = {
  fast_or_missing_telemetry: "Envío rápido o telemetría ausente",
  no_physical_interaction: "No se registró interacción física",
  text_without_keypresses: "Texto extenso sin pulsaciones de teclado",
};

const proofFailureNames: Record<ProofSolveFailureReason, string> = {
  cancelled: "se detuvo a petición del usuario",
  timeout: "superó el tiempo máximo",
  expired: "caducó antes de completarse",
  unavailable: "no está disponible en este navegador",
  invalid_challenge: "recibió datos no válidos",
};

interface ProofSample {
  outcome: "solved" | "interrupted";
  elapsedMs: number;
}

function getAccessibleFallbackUrl(): string | undefined {
  const value = process.env.NEXT_PUBLIC_BEHAVIOR_CAPTCHA_ACCESSIBLE_FALLBACK_URL?.trim();
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "mailto:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function summarizeProofTimes(samples: ProofSample[]) {
  const sorted = samples
    .filter((sample) => sample.outcome === "solved")
    .map((sample) => sample.elapsedMs)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return undefined;

  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1]!;
  return { count: sorted.length, median, p95 };
}

export function ContactForm() {
  const [telemetry, setTelemetry] = useState<BehaviorTelemetry | null>(null);
  const [diagnostics, setDiagnostics] = useState<RiskDiagnostics | undefined>();
  const [proof, setProof] = useState<
    | { status: "solved"; counter: number; attempts: number; elapsedMs: number }
    | { status: "interrupted"; reason: ProofSolveFailureReason; attempts: number; elapsedMs: number }
    | null
  >(null);
  const [proofSamples, setProofSamples] = useState<ProofSample[]>([]);
  const proofSummary = summarizeProofTimes(proofSamples);
  const accessibleFallbackUrl = getAccessibleFallbackUrl();

  function recordProofSample(sample: ProofSample) {
    setProofSamples((current) => [...current, sample].slice(-200));
  }

  return (
    <>
      <BehaviorForm
        action={submitContact}
        proofTimeoutMs={15_000}
        proofFallback={accessibleFallbackUrl ? (
          <p>
            Si no puedes completar la comprobación, puedes contactar al equipo de soporte por la vía accesible.
            La solicitud no acepta automáticamente el envío protegido.
            {" "}<a href={accessibleFallbackUrl}>Contactar con soporte</a>
          </p>
        ) : (
          <p>
            Esta demo aún no tiene una vía de soporte configurada. Define
            {" "}<code>NEXT_PUBLIC_BEHAVIOR_CAPTCHA_ACCESSIBLE_FALLBACK_URL</code> con una URL HTTPS o un enlace mailto
            cuando exista un canal real. La vía de soporte debe aplicar sus propios límites y revisión; no aceptará
            automáticamente el envío protegido.
          </p>
        )}
        onTelemetry={setTelemetry}
        onDiagnostics={setDiagnostics}
        onProofSolved={(result) => {
          setProof({ status: "solved", ...result });
          recordProofSample({ outcome: "solved", elapsedMs: result.elapsedMs });
        }}
        onProofInterrupted={(stats) => {
          setProof({ status: "interrupted", ...stats });
          recordProofSample({ outcome: "interrupted", elapsedMs: stats.elapsedMs });
        }}
      >
        <label>
          Nombre
          <input name="name" required maxLength={120} />
        </label>
        <label>
          Mensaje
          <textarea name="message" required maxLength={4_000} />
        </label>
      </BehaviorForm>

      <section className="debug-panel">
        <h2>Qué pasó en el último envío</h2>
        {!telemetry ? (
          <p>Envía el formulario para ver las señales observadas y el resultado de cada paso.</p>
        ) : (
          <>
            <h3>1. Señales recogidas en el navegador</h3>
            <dl className="signal-grid">
              <div><dt>Tiempo en página</dt><dd>{(telemetry.elapsedMs / 1_000).toFixed(2)} s</dd></div>
              <div><dt>Movimientos de ratón</dt><dd>{telemetry.mouseMoves}</dd></div>
              <div><dt>Pulsaciones de tecla</dt><dd>{telemetry.keyPresses}</dd></div>
              <div><dt>Eventos táctiles</dt><dd>{telemetry.touchEvents}</dd></div>
            </dl>

            <h3>2. Evaluación del servidor</h3>
            <p><strong>Riesgo heurístico:</strong> {diagnostics?.score ?? "—"}/100</p>
            <p><strong>Señales:</strong> {diagnostics?.signals.length
              ? diagnostics.signals.map((signal) => signalNames[signal] ?? signal).join("; ")
              : "No se detectaron señales heurísticas."}</p>

            <h3>3. Prueba de trabajo local</h3>
            <p>
              {proof?.status === "solved"
                ? `El navegador encontró una solución tras ${proof.attempts.toLocaleString()} intentos (${proof.elapsedMs} ms). El resultado del envío aparece arriba.`
                : proof?.status === "interrupted"
                  ? `La prueba ${proofFailureNames[proof.reason]} tras ${proof.attempts.toLocaleString()} intentos y ${proof.elapsedMs} ms.`
                  : "Se está calculando o aún no se ha solicitado el reto."}
            </p>
            <p className="debug-note">La demo fuerza el reto en cada envío para mostrar este paso. En una integración real, el servidor lo activa según el umbral de riesgo.</p>

            <h3>4. Medición local de coste</h3>
            <p>
              {proofSummary
                ? `${proofSummary.count} soluciones: mediana ${proofSummary.median} ms, p95 ${proofSummary.p95} ms; ${proofSamples.filter((sample) => sample.outcome === "interrupted").length} interrupciones.`
                : "Aún no hay soluciones registradas en esta pestaña."}
            </p>
            <p>Las mediciones viven solo en esta pestaña. Recoge al menos 100 soluciones por dispositivo para tener una referencia inicial del p95.</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setProofSamples([]);
                setProof(null);
              }}
            >
              Limpiar mediciones
            </button>
          </>
        )}
      </section>
    </>
  );
}
