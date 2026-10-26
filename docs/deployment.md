# Integración y despliegue

## Requisitos

- Node.js 22.13 o posterior. El paquete utiliza `node:sqlite`; esa API está marcada como experimental en Node 22.
- React 18 o posterior en la aplicación anfitriona.
- Runtime Node para el código de servidor. No uses el adaptador SQLite en Edge Runtime.
- Un volumen local persistente para SQLite si se despliega en un solo servidor.

El paquete todavía no está publicado en npm. Mientras tanto, esta guía documenta la API prevista para una aplicación que instale el paquete. La demo ejecutable está en `examples/next-app`.

## Configurar secretos y almacenamiento

Genera dos valores aleatorios distintos, exclusivos del servidor y de al menos 32 caracteres. No los pongas en variables `NEXT_PUBLIC_*`, en el cliente ni en el repositorio.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Configura:

- `BEHAVIOR_CAPTCHA_SECRET`: firma los retos.
- `RATE_LIMIT_KEY_HASH_SECRET`: crea hashes HMAC de las claves de rate limit que se guardan en SQLite.
- `BEHAVIOR_CAPTCHA_DB_PATH`: ruta privada y persistente del archivo SQLite.
- `NEXT_PUBLIC_BEHAVIOR_CAPTCHA_ACCESSIBLE_FALLBACK_URL` (solo en la demo): URL HTTPS o `mailto:` de un canal de soporte real. Déjala vacía mientras no exista un canal; nunca uses ese enlace para aceptar automáticamente la acción protegida.

Usa valores distintos para cada secreto y cada aplicación. Todas las instancias que compartan una base deben tener la misma clave HMAC. Si esa clave cambia, los buckets existentes dejan de corresponder a las claves anteriores.

Abre el almacenamiento una vez en un módulo solo del servidor:

```ts
import { openSQLiteCaptchaStore } from "@chxchx/behavior-captcha/server";

export const captchaStore = openSQLiteCaptchaStore(
  process.env.BEHAVIOR_CAPTCHA_DB_PATH ?? ".data/behavior-captcha.sqlite",
  { keyHashSecret: process.env.RATE_LIMIT_KEY_HASH_SECRET! },
);
```

La librería crea el directorio de la base. Asegúrate de que la ruta no se sirva como archivo público, limita los permisos del archivo y define backups y retención según las necesidades de tu servicio.

## Integración con Next.js

Limita el cuerpo de la solicitud en el framework o proxy **antes** de parsearlo. La librería aplica después sus propios límites a `FormData`, pero no puede deshacer la memoria que el framework ya asignó.

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "128kb" },
  },
};

export default nextConfig;
```

Configura una Server Action con identidad calculada en el servidor. Si usas una IP, confía solo en una cabecera que un proxy controlado sobrescriba y bloquea el acceso directo al proceso de Next.js. Si la operación tiene usuario autenticado, prefiere un ID de sesión o cuenta validado.

```ts
"use server";

import { headers } from "next/headers";
import { handleBehaviorSubmission } from "@chxchx/behavior-captcha/server";
import { captchaStore } from "./captcha-store";

export async function submitContact(data: FormData) {
  const requestHeaders = await headers();
  const clientKey = await getTrustedClientKey(requestHeaders); // Implementación propia y confiable
  if (!clientKey) return { status: "error", message: "No se pudo procesar el envío." } as const;

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
      // Valida campos y reglas de negocio; autentica y autoriza antes de guardar.
      const name = String(formData.get("name") ?? "").trim();
      const message = String(formData.get("message") ?? "").trim();
      await saveContactMessage({ name, message }); // Reemplazar por la capa de datos de la app
    },
  });
}
```

`getTrustedClientKey` y `saveContactMessage` son funciones de la aplicación anfitriona, no vienen en el paquete. Valida el tipo, cantidad y longitud de cada campo antes de usarlo. `onAccepted` solo se ejecuta después de la política configurada y, cuando se requiere, de verificar el reto.

La configuración `adaptive` pide un reto si la heurística sospecha o si el rate limit del servidor se acerca al umbral. La señal del navegador se puede falsificar; configura `always` si quieres exigir el reto en todos los envíos iniciales. El rate limit sigue siendo necesario en ambos modos. Los intentos de verificación usan un bucket separado; se puede ajustar con `verificationRateLimit`.

En el cliente, importa `BehaviorForm` desde `@chxchx/behavior-captcha/client` o conecta `useBehaviorTelemetry` a tu propio formulario. Importa `@chxchx/behavior-captcha/styles.css` para los estilos incluidos.

## Límites de entradas

Por defecto se aceptan hasta 32 entradas y 64 KiB de datos; se rechazan archivos. Los máximos configurables del paquete son 128 entradas y 1 MiB. Mantén el límite del framework/proxy bajo y coherente con `inputLimits`.

La demo limita el cuerpo de Server Actions a 128 KiB antes del parseo y la librería limita el `FormData` a 64 KiB. La acción de demo valida nombre y mensaje, pero no los guarda.

## Persistencia y limpieza

El almacenamiento SQLite está pensado para una aplicación en un solo servidor con disco persistente y tráfico moderado. No compartas un archivo SQLite entre procesos/servidores, volúmenes de red, contenedores efímeros o funciones serverless. Para esas topologías implementa un `RateLimitStore` y un `ChallengeStore` compartidos con operaciones atómicas.

La base conserva buckets de rate limit y nonces consumidos hasta que expiren. Ejecuta periódicamente, desde un proceso confiable, la limpieza:

```ts
await captchaStore.pruneExpired();
```

Planifica backups, restauración, monitorización de disco y los registros del proxy/framework. La librería no controla las cabeceras o direcciones que otros componentes puedan escribir en sus logs.
