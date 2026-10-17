"use client";

import { useState } from "react";
import type { BehaviorTelemetry, RiskDiagnostics } from "../../src/shared/types";
import { BehaviorForm } from "../../src/client/BehaviorForm";
import { submitContact } from "./actions";

const signalNames: Record<string, string> = {
  fast_or_missing_telemetry: "Envío rápido o telemetría ausente",
  no_physical_interaction: "No se registró interacción física",
  text_without_keypresses: "Texto extenso sin pulsaciones de teclado",
};

export function ContactForm() {
  const [telemetry, setTelemetry] = useState<BehaviorTelemetry | null>(null);
  const [diagnostics, setDiagnostics] = useState<RiskDiagnostics | undefined>();
  const [proof, setProof] = useState<{ counter: number; attempts: number; elapsedMs: number } | null>(null);

  return (
    <>
      <BehaviorForm
        action={submitContact}
        onTelemetry={setTelemetry}
        onDiagnostics={setDiagnostics}
        onProofSolved={setProof}
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

      <section className="debug-panel" aria-live="polite">
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
              {proof
                ? `El navegador encontró un contador tras ${proof.attempts.toLocaleString()} intentos (${proof.elapsedMs} ms). El servidor verificó la solución y aceptó el reto.`
                : "Se está calculando o aún no se ha solicitado el reto."}
            </p>
            <p className="debug-note">La demo fuerza el reto en cada envío para mostrar este paso. En una integración real, el servidor lo activa según el umbral de riesgo.</p>
          </>
        )}
      </section>
    </>
  );
}
