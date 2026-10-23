# @chxchx/behavior-captcha

Herramienta de mitigación de abuso para formularios propios en React y Next.js. Cada aplicación la instala y la ejecuta en su propio servidor. No depende de un proveedor CAPTCHA ni de una base de datos externa: el estado se guarda en un archivo SQLite local.

## Estado actual

La librería y la demo local ya incluyen límites de frecuencia en SQLite, evaluación de riesgo, reto de prueba de trabajo y controles de accesibilidad para detener el reto y ofrecer una alternativa desde la aplicación anfitriona. El paquete aún no está publicado; la demo no guarda los envíos ni tiene conectada una ruta real de revisión manual.

El siguiente paso es integrar la librería en un formulario de bajo impacto de una aplicación anfitriona y conectar allí una alternativa accesible real, con sus propios límites y validaciones. Antes de ajustar la dificultad, mide al menos 100 soluciones en cada dispositivo modesto que quieras admitir. El avance y los pendientes de cierre están en la [hoja de ruta de v1](ROADMAP.md).

## Qué incluye

- Honeypot y señales de interacción del navegador, tratadas como indicios que un bot puede falsificar.
- Evaluación de riesgo en el servidor.
- Límite de frecuencia con token bucket y claves almacenadas como HMAC, no como IP en texto claro.
- Reto de prueba de trabajo firmado con HMAC, vencimiento, alcance de operación y contenido del formulario.
- Consumo atómico de nonces para impedir reutilizar un reto.
- Adaptadores SQLite persistente y en memoria para límites y retos.

La prueba de trabajo aumenta el costo de automatizar solicitudes; no demuestra que alguien sea humano. No incluye clasificación basada en telemetría global ni detiene ataques que saturen la red antes de llegar a la aplicación.

## Requisitos e instalación

Se requiere Node.js 22.13 o posterior. El almacenamiento usa `node:sqlite`, incluido en Node, por lo que no hay que instalar ni administrar un servicio SQLite aparte. La API `node:sqlite` sigue marcada como experimental en Node 22; revisa la [documentación oficial de Node](https://nodejs.org/api/sqlite.html) antes de actualizar la versión del servidor.

Cuando se publique el paquete:

```bash
npm install @chxchx/behavior-captcha
```

La app anfitriona también debe tener React 18 o posterior. Para Next.js, usa una Server Action o una ruta ejecutada en runtime Node; SQLite no funciona en Edge Runtime.

## Almacenamiento local

Abre una base de datos privada en el servidor. La carpeta se crea automáticamente:

```ts
import { openSQLiteCaptchaStore } from "@chxchx/behavior-captcha/server";

export const captchaStore = openSQLiteCaptchaStore(
  process.env.BEHAVIOR_CAPTCHA_DB_PATH ?? ".data/behavior-captcha.sqlite",
  { keyHashSecret: process.env.RATE_LIMIT_KEY_HASH_SECRET! },
);
```

`keyHashSecret` debe ser un secreto aleatorio exclusivo del servidor de al menos 32 caracteres. Todas las conexiones que usen el mismo archivo deben usar el mismo valor. Puedes generar uno con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; ejecútalo dos veces para crear secretos distintos. Cambiar la clave reinicia en la práctica los contadores existentes.

La base almacena hashes HMAC de claves de rate limit, sus contadores y nonces usados con su vencimiento. No guarda los campos del formulario, IP en texto claro ni telemetría. La demo guarda el archivo en `.data/`, ruta excluida de Git. En producción, usa un directorio persistente y no público, limita sus permisos y define cómo respaldarlo.

El servidor rechaza por defecto más de 32 entradas o 64 KiB de datos, y no acepta archivos. Puedes ajustar `inputLimits` por formulario; los máximos de la librería son 128 entradas y 1 MiB. Configura también el límite del cuerpo en el framework o proxy: la librería valida `FormData` después de que el servidor ya recibió y parseó la solicitud. El ejemplo de Next.js limita el cuerpo de una Server Action a 128 KiB antes del parseo; la librería aplica además su límite de 64 KiB sobre los datos del formulario. `onAccepted` valida los campos y las reglas del negocio antes de guardar.

SQLite encaja cuando cada proyecto corre en un servidor propio con disco persistente y tráfico moderado. No compartas un archivo entre servidores, contenedores efímeros, funciones serverless o volúmenes de red. Cada proyecto debe tener su propio archivo y sus propios secretos. En esos entornos hace falta un almacenamiento compartido con escrituras atómicas.

Elimina filas vencidas desde un proceso confiable y programado:

```ts
await captchaStore.pruneExpired();
```

## Integración con Next.js

El ejemplo completo está en `examples/next-app`. Su `next.config.ts` limita las solicitudes a las Server Actions a 128 KiB antes del parseo. Ajusta el límite según el formulario, manteniéndolo tan bajo como sea práctico y coordinándolo con el límite de `inputLimits`.

En una Server Action, configura el almacén una vez en un módulo exclusivamente servidor y pasa el alcance y la clave de límite calculados en el servidor. El ejemplo valida que `x-real-ip` contenga una IP y la normaliza antes de usarla. Confía en esa cabecera solo si el proxy inverso la sobrescribe y el servidor de la aplicación no es accesible directamente desde Internet; si existe una sesión autenticada, prefiere un identificador de usuario o sesión validado.

```ts
import { headers } from "next/headers";
import { handleBehaviorSubmission } from "@chxchx/behavior-captcha/server";
import { captchaStore } from "./captcha-store";

export async function submitContact(data: FormData) {
  const requestHeaders = await headers();
  // Obtén aquí un identificador validado de sesión/cuenta, o una IP canónica de un proxy confiable.
  const clientKey = await getTrustedClientKey(requestHeaders);
  if (!clientKey) return { status: "error", message: "No se pudo procesar el envío." };

  return handleBehaviorSubmission(data, {
    secret: process.env.BEHAVIOR_CAPTCHA_SECRET!,
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
      // Valida campos, autentica y autoriza el recurso antes de cualquier escritura protegida.
      // El CAPTCHA por sí solo nunca concede permisos.
    },
  });
}
```

`getTrustedClientKey` representa lógica propia de la aplicación: valida la sesión cuando exista o acepta solo una IP normalizada desde un proxy de confianza. No uses una cabecera reenviada por el cliente sin configurar la confianza del proxy. Cada Server Action es un endpoint público; valida su entrada y autentica y autoriza cada operación protegida, incluso si también exige un CAPTCHA. El formulario de contacto de la demo es público intencionalmente.

`challengePolicy: { mode: "always" }` reta todos los envíos iniciales. En modo `adaptive`, se reta si la heurística sospecha o si el rate limit del servidor llega al umbral configurado; el ejemplo reta cuando quedan 2 tokens. La heurística puede falsificarse, así que una solicitud de bajo volumen todavía puede pasar sin reto; usa `always` si cada envío debe resolver una prueba. `rateLimit` controla los envíos iniciales. La verificación del reto usa un bucket independiente con la misma capacidad y ventana por defecto, así que pedir y resolver un reto no consume dos veces el mismo cupo. Puedes ajustarlo con `verificationRateLimit`.

Genera `BEHAVIOR_CAPTCHA_SECRET` y `RATE_LIMIT_KEY_HASH_SECRET` con valores distintos. Nunca uses prefijos `NEXT_PUBLIC_`, no los subas al repositorio y no derives el alcance desde datos enviados por el navegador. Si hay un proxy, configura la app para que solo confíe en cabeceras que ese proxy reemplaza y bloquea el acceso directo al servidor de aplicación.

En el cliente, usa `BehaviorForm` desde `@chxchx/behavior-captcha/client` o conecta `useBehaviorTelemetry` a tu formulario. Importa los estilos desde `@chxchx/behavior-captcha/styles.css`.

La prueba del navegador se puede detener y tiene un máximo predeterminado de 15 segundos (`proofTimeoutMs`, configurable entre 1 y 120 segundos). `BehaviorForm` anuncia el estado con regiones accesibles, muestra un botón para detenerla y acepta `proofFallback`: contenido propio para una ruta accesible de revisión o soporte. Pon un enlace funcional en esa ranura en producción; no conviertas la alternativa en un endpoint que acepte la operación protegida sin sus controles de abuso y autorización. `onProofSolved` y `onProofInterrupted` entregan intentos y tiempo para evaluar la experiencia. Son datos del navegador y no deben influir en decisiones de seguridad.

La demo conserva hasta 200 mediciones en memoria de la pestaña y muestra mediana, percentil 95 y número de interrupciones para las soluciones completadas. Para una referencia inicial del p95, recoge al menos 100 soluciones en cada móvil o equipo modesto objetivo y prueba la configuración de dificultad que realmente desplegarás. Estos resultados no salen del navegador. La demostración limita los envíos por minuto, así que habrá que esperar a que se reponga el cupo entre tandas.

La aplicación anfitriona debe conectar `proofFallback` a un destino real, por ejemplo una ruta de solicitud de revisión manual. Esa ruta la define cada proyecto: valida los datos, usa su rate limit y aplica el mismo control de autorización antes de poner la solicitud en una cola de revisión. La librería no ofrece una aceptación automática sin prueba como alternativa.

## Demo local

Con Node.js 22.13 o posterior:

```bash
cp examples/next-app/.env.example examples/next-app/.env.local
npm install
npm run demo
```

En PowerShell, usa `Copy-Item examples/next-app/.env.example examples/next-app/.env.local` como primer comando.

Los secretos de `.env.example` son solo para desarrollo. Reemplázalos antes de cualquier despliegue. La demo fuerza el reto y expone diagnósticos para que se vea el flujo; no copies `challengePolicy: { mode: "always" }` ni `exposeDiagnostics: true` a una aplicación real salvo que quieras retar todos los envíos.

La acción de la demo valida el formulario, pero no guarda sus datos. Para una prueba piloto en otra aplicación, usa el ejemplo como referencia y conecta `onAccepted` a la capa de datos de esa aplicación después de validar y autorizar la operación. Cada aplicación debe mantener su propio secreto, archivo SQLite y configuración de límites; no se comparte un servidor central entre proyectos.

## Alcance y seguridad

Esta versión está enfocada en formularios públicos de bajo impacto. La telemetría del navegador se puede falsificar; la puntuación es una heurística, no una clasificación precisa de bots. La prueba de trabajo consume CPU y batería y no sustituye límites del servidor, validación de entradas, autenticación, autorización, protección de disponibilidad ni una alternativa accesible para personas que no puedan completar el reto.

Antes de proteger registro, inicio de sesión, pagos o acciones sensibles, diseña controles específicos para esas operaciones. Valida y limita el cuerpo de cada solicitud, aplica límites por endpoint e identidad, usa escrituras idempotentes y observa falsos positivos. Las Server Actions son endpoints públicos: autentica y autoriza cada operación.

## Desarrollo del paquete

```bash
npm run build
```

El build genera JavaScript ESM y declaraciones TypeScript en `dist/`. `npm pack` ejecuta el build antes de preparar el paquete.
