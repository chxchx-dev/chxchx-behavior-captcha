<div align="center">
  <h1>@chxchx/behavior-captcha</h1>
  <p><strong>Más fricción para el spam automatizado. Control en tu propio servidor.</strong></p>
  <p>Protección autoalojada para formularios de React y Next.js App Router.</p>
  <p>
    <img src="https://img.shields.io/badge/estado-en%20desarrollo-orange?style=for-the-badge" alt="Estado: en desarrollo" />
    <img src="https://img.shields.io/badge/Node.js-%3E%3D22.13-339933?style=for-the-badge&amp;logo=node.js&amp;logoColor=white" alt="Node.js 22.13 o posterior" />
    <img src="https://img.shields.io/badge/React-%3E%3D18-149eca?style=for-the-badge&amp;logo=react&amp;logoColor=white" alt="React 18 o posterior" />
    <img src="https://img.shields.io/badge/m%C3%B3dulos-ESM-6e56cf?style=for-the-badge" alt="Módulos ESM" />
    <img src="https://img.shields.io/badge/licencia-MIT-blue?style=for-the-badge" alt="Licencia MIT" />
  </p>
  <p>
    <a href="#instalación">Instalar</a> ·
    <a href="#inicio-rápido">Inicio rápido</a> ·
    <a href="#api-pública">API</a> ·
    <a href="#seguridad-y-límites">Seguridad</a> ·
    <a href="#documentación">Documentación</a>
  </p>
</div>

> [!IMPORTANT]
> **Versión inicial en desarrollo (`0.1.0`). El paquete todavía no está publicado en npm.** La instalación desde npm estará disponible cuando se publique. Por ahora, puedes probar el paquete desde un tarball local. La demo es educativa: no guarda envíos y no debe recibir datos reales. Consulta el [estado de preparación](docs/release-readiness.md) antes de usarlo en producción.

<details>
<summary><strong>Contenido</strong></summary>

- [Visión general](#visión-general)
- [Cómo funciona](#cómo-funciona)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Demo local](#demo-local)
- [Inicio rápido](#inicio-rápido)
- [Configuración de retos](#configuración-de-retos)
- [API pública](#api-pública)
- [Seguridad y límites](#seguridad-y-límites)
- [Desarrollo](#desarrollo)
- [Documentación](#documentación)

</details>

## Visión general

Behavior CAPTCHA combina controles del servidor con señales auxiliares del navegador. La aplicación anfitriona conserva el control de sus datos, sus reglas de negocio y su infraestructura.

| Incluye | Sigue siendo responsabilidad de tu aplicación |
| --- | --- |
| Honeypot y contadores de interacción del navegador. | Autenticación, autorización y validación de los campos. |
| Rate limits del servidor y políticas de reto `always` o `adaptive`. | Limitar el cuerpo de la solicitud antes de que el framework lo parsee. |
| Retos de prueba de trabajo firmados, con vencimiento y consumo único. | Persistir los envíos y definir la política de privacidad y retención. |
| Adaptadores de almacenamiento en memoria y SQLite local. | Configurar una alternativa accesible real y controles contra abuso para esa ruta. |
| Un formulario React que admite cancelación y un espacio para el fallback. | Operar SQLite, programar su limpieza y monitorizar el hosting. |

**No es una prueba de humanidad.** La telemetría puede falsificarse, el honeypot puede detectarse y un bot con suficiente capacidad puede resolver la prueba de trabajo. El mecanismo aumenta el costo de automatizar formularios; no detiene ataques que saturen la red o el servidor antes de que la aplicación los procese.

## Cómo funciona

| Etapa | Componente | Acción |
| --- | --- | --- |
| 1 | Navegador | El formulario recoge contadores de interacción y los envía junto con los campos. No guarda una grabación de las acciones. |
| 2 | Servidor | La aplicación aplica su límite de frecuencia y evalúa las señales recibidas como datos no confiables. |
| 3 | Política de reto | `always` solicita una prueba en cada envío inicial. `adaptive` la solicita si hay señales de riesgo o el rate limit del servidor se acerca al umbral configurado. |
| 4 | Navegador | Si el servidor solicita el reto, el cliente calcula la prueba. Por defecto, puede detenerla y el cálculo tiene un límite de 15 segundos. |
| 5 | Aplicación | El servidor valida firma, vencimiento, alcance, datos originales y uso único del reto. Luego llama a `onAccepted`. |
| 6 | Aplicación | Tu código valida reglas de negocio, permisos y datos; después decide si persiste el envío. |

## Requisitos

| Requisito | Versión o condición |
| --- | --- |
| Node.js | `22.13` o posterior para el servidor. El almacenamiento usa `node:sqlite`, experimental en Node 22. |
| React y React DOM | `18` o posterior como dependencias peer de la aplicación. |
| Sistema de módulos | El paquete publica módulos ESM; se importa con `import`. |
| Runtime de servidor | Node.js. El adaptador SQLite no es compatible con Edge Runtime. |
| Almacenamiento SQLite | Una instancia con disco persistente. No compartas el archivo entre servidores ni lo uses en almacenamiento efímero o de red. |

## Instalación

### Cuando se publique en npm

En la aplicación React o Next.js anfitriona:

```bash
npm install @chxchx/behavior-captcha
```

> [!NOTE]
> El paquete aún no está en el registro. Hasta su publicación, este comando puede responder que no encuentra el paquete.

### Probar ahora con un tarball local

Desde una consola, clona el repositorio e instala sus dependencias. `npm pack` construye el paquete y crea un archivo `.tgz` en la carpeta actual:

```bash
git clone https://github.com/chxchx-dev/chxchx-behavior-captcha.git
cd chxchx-behavior-captcha
npm ci
npm pack
```

Instala el tarball en tu aplicación anfitriona. Ajusta la ruta relativa a la ubicación de ambas carpetas:

```bash
npm install ../chxchx-behavior-captcha/chxchx-behavior-captcha-0.1.0.tgz
```

Esto instala un artefacto local; no publica el paquete. Para validar desde el repositorio que el tarball se instala en un consumidor limpio, ejecuta `npm run pack:smoke`.

## Demo local

La demo de Next.js está en [`examples/next-app`](examples/next-app). Ejecuta estos pasos desde la raíz del repositorio.

Primero, instala las dependencias:

```bash
npm ci
```

Luego, en PowerShell, copia la configuración de ejemplo y arranca la demo:

```powershell
Copy-Item examples/next-app/.env.example examples/next-app/.env.local
npm run demo
```

En macOS o Linux, usa `cp examples/next-app/.env.example examples/next-app/.env.local` en lugar de `Copy-Item`.

Abre <http://127.0.0.1:3000>. La demo fuerza el reto para mostrar el flujo, expone diagnósticos locales y conserva las mediciones solo en la pestaña actual. El formulario no persiste nombre ni mensaje. Los valores de `.env.example` son marcadores de desarrollo: no los uses en producción.

## Inicio rápido

Los ejemplos siguientes muestran la estructura de una integración. Las funciones `getTrustedClientKey` y `saveContactMessage` son de la aplicación anfitriona y debes implementarlas. Para el cuerpo máximo de las Server Actions, configuración completa, proxy confiable y despliegue, sigue la [guía de integración](docs/deployment.md).

### 1. Guarda los secretos en el servidor

Genera dos secretos aleatorios **distintos** y de al menos 32 caracteres; ejecuta el comando dos veces:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Configura estas variables en el entorno local o en el panel del hosting:

| Variable | Uso |
| --- | --- |
| `BEHAVIOR_CAPTCHA_SECRET` | Firma los retos. |
| `RATE_LIMIT_KEY_HASH_SECRET` | Seudonimiza las claves de rate limit guardadas en SQLite. |
| `BEHAVIOR_CAPTCHA_DB_PATH` | Ruta privada y persistente del archivo SQLite. |

No guardes los secretos en Git, en el cliente ni en variables `NEXT_PUBLIC_*`. No reutilices el mismo secreto para ambas variables.

### 2. Abre SQLite en un módulo solo del servidor

```ts
// src/lib/captcha-store.ts
import { openSQLiteCaptchaStore } from "@chxchx/behavior-captcha/server";

const keyHashSecret = process.env.RATE_LIMIT_KEY_HASH_SECRET;
if (!keyHashSecret || keyHashSecret.length < 32) {
  throw new Error("RATE_LIMIT_KEY_HASH_SECRET debe tener al menos 32 caracteres.");
}

export const captchaStore = openSQLiteCaptchaStore(
  process.env.BEHAVIOR_CAPTCHA_DB_PATH ?? ".data/behavior-captcha.sqlite",
  { keyHashSecret },
);
```

Mantén este módulo fuera del árbol cliente. El adaptador crea la carpeta de la base si hace falta.

### 3. Valida el envío en una Server Action

```ts
// src/app/contact/actions.ts
"use server";

import { handleBehaviorSubmission } from "@chxchx/behavior-captcha/server";
import { captchaStore } from "@/lib/captcha-store";

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} no está configurado correctamente.`);
  return value;
}

export async function submitContact(data: FormData) {
  const clientKey = await getTrustedClientKey(); // Sesión validada o IP validada detrás de un proxy confiable.
  if (!clientKey) return { status: "error", message: "No se pudo procesar el envío." } as const;

  return handleBehaviorSubmission(data, {
    secret: requiredSecret("BEHAVIOR_CAPTCHA_SECRET"),
    challengeStore: captchaStore.challenges,
    challengeScope: `contact:${clientKey}`,
    challengePolicy: { mode: "adaptive", remainingTokensThreshold: 2 },
    rateLimit: {
      store: captchaStore.rateLimits,
      key: `contact:${clientKey}`,
      capacity: 10,
      refillWindowMs: 60_000,
    },
    textFields: ["name", "message"],
    onAccepted: async (formData) => {
      const name = String(formData.get("name") ?? "").trim();
      const message = String(formData.get("message") ?? "").trim();
      if (!name || name.length > 120 || !message || message.length > 4_000) {
        throw new Error("El formulario no es válido.");
      }

      // Comprueba autorización y persiste usando la capa de datos de tu aplicación.
      await saveContactMessage({ name, message });
    },
  });
}
```

`challengeScope` y la clave del limitador deben derivarse en el servidor. No los construyas con campos del formulario ni con cabeceras que el cliente pueda falsificar. `onAccepted` no reemplaza las validaciones, autorización y reglas de negocio de la aplicación.

### 4. Conecta el formulario y una alternativa accesible

```tsx
"use client";

import { BehaviorForm } from "@chxchx/behavior-captcha/client";
import { submitContact } from "./actions";

export function ContactForm() {
  return (
    <BehaviorForm
      action={submitContact}
      proofTimeoutMs={15_000}
      proofFallback={<a href="/contacto-accesible">Usar la vía accesible de contacto</a>}
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
  );
}
```

Implementa `/contacto-accesible` como un flujo real con sus propios límites y revisión. Detener o no poder resolver el reto nunca debe aceptar automáticamente el envío. Para usar los estilos incluidos, impórtalos en el layout de la aplicación:

```ts
import "@chxchx/behavior-captcha/styles.css";
```

## Configuración de retos

| Modo | Cuándo solicita la prueba | Cuándo elegirlo |
| --- | --- | --- |
| `always` | En cada envío inicial. | Cuando quieres exigir la prueba siempre y medir su efecto en tu caso de uso. |
| `adaptive` | Cuando las señales elevan el riesgo o el rate limit del servidor llega al umbral definido. | Cuando quieres solicitarla de forma selectiva, manteniendo el rate limit como control independiente. |

La heurística del cliente solo puede añadir una señal de sospecha; no puede reducir la política elegida por el servidor. El formulario incluido limita cada reto a 15 segundos por defecto y permite que la persona lo detenga.

## API pública

| Importación o comando | Exportaciones principales | Entorno |
| --- | --- | --- |
| `@chxchx/behavior-captcha/client` | `BehaviorForm`, `useBehaviorTelemetry`, `withBehaviorFormData`, `withBehaviorPayload`, `solveProofOfWork`. | Cliente React |
| `@chxchx/behavior-captcha/server` | `handleBehaviorSubmission`, `openSQLiteCaptchaStore`, stores en memoria, verificación de retos, rate limit y evaluación de riesgo. | Solo servidor Node.js |
| `@chxchx/behavior-captcha/shared` | Tipos y constantes de campos compartidos entre cliente y servidor. | Compartido |
| `@chxchx/behavior-captcha/styles.css` | Estilos de `BehaviorForm`. | CSS global de la aplicación |
| `behavior-captcha-prune` | Elimina buckets de rate limit y nonces SQLite vencidos. | Tarea programada |

## Seguridad y límites

> [!CAUTION]
> Resolver el reto no autentica a nadie ni concede permisos. Protege cada Server Action y ruta con la autorización propia de la aplicación.

<details>
<summary><strong>Controles que debe añadir la aplicación anfitriona</strong></summary>

- Aplica un límite al cuerpo de la solicitud en el framework o proxy antes de parsearlo. La librería valida `FormData` después del parseo; no puede deshacer memoria ya asignada.
- Valida el tipo, longitud, cantidad y autorización de los datos antes de persistirlos.
- Aplica límites de red y de aplicación por endpoint e identidad. El rate limit de la librería no protege la red ni evita saturación antes de que corra el servidor.
- Usa solo una identidad de sesión o cuenta validada, o una IP obtenida de un proxy que controlas y que bloquea accesos directos al proceso.
- Configura una alternativa accesible real. Debe tener validación y controles contra abuso propios; no aceptes automáticamente una operación porque alguien detuvo la prueba.
- Define privacidad y retención para datos y logs procesados por la aplicación, el proxy y el proveedor de hosting.
- Protege el archivo SQLite, configura backups y monitoriza espacio y limpieza.

</details>

<details>
<summary><strong>Almacenamiento y topología</strong></summary>

| Adaptador | Uso | Persistencia |
| --- | --- | --- |
| En memoria | Pruebas o desarrollo local. | Se pierde al reiniciar el proceso; no es compartido entre procesos. |
| SQLite | Una instancia Node con disco persistente. | Sobrevive reinicios mientras el archivo se conserve. |
| Propio | Multiinstancia, serverless o almacenamiento compartido. | Implementa `RateLimitStore` y `ChallengeStore` con operaciones atómicas. |

Programa `behavior-captcha-prune` desde un scheduler confiable; no lo ejecutes por cada envío. Consulta la guía de [despliegue y limpieza](docs/deployment.md) para configurar la tarea, backups y monitorización.

</details>

Más información sobre datos tratados y amenazas: [Seguridad y privacidad](docs/security.md). Para medir CPU, mediana, p95 e interrupciones, sigue [Validación de coste](docs/performance-validation.md).

## Desarrollo

Los comandos se ejecutan desde la raíz del repositorio. Node.js debe ser `22.13` o posterior.

| Comando | Resultado |
| --- | --- |
| `npm ci` | Instala las dependencias fijadas en `package-lock.json`. |
| `npm run demo` | Ejecuta la demo Next.js en `http://127.0.0.1:3000`. |
| `npm run typecheck` | Comprueba los tipos de la librería y el ejemplo. |
| `npm test` | Construye el paquete y ejecuta las pruebas automatizadas. |
| `npm run build` | Construye los archivos de distribución en `dist/`. |
| `npm run build --workspace examples/next-app` | Compila la demo para producción. |
| `npm run pack:smoke` | Empaqueta e instala el tarball en un consumidor temporal. |
| `npm run ci` | Ejecuta las validaciones configuradas para CI. |

## Documentación

| Guía | Contenido |
| --- | --- |
| [Integración y despliegue](docs/deployment.md) | Server Actions, secretos, límites de entrada, SQLite y limpieza programada. |
| [Seguridad y privacidad](docs/security.md) | Modelo de protección, datos procesados y responsabilidades del hosting. |
| [Validación de coste](docs/performance-validation.md) | Protocolo para medir dispositivos, navegadores, p95 e interrupciones. |
| [Estado de preparación](docs/release-readiness.md) | Pendientes antes de publicar el paquete o usarlo en producción. |
| [Hoja de ruta de v1](ROADMAP.md) | Alcance acordado y tareas de cierre. |
| [Licencia MIT](LICENSE) | Condiciones de uso y distribución. |
