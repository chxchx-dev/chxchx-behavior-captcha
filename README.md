# @chxchx/behavior-captcha

Primera versión de una librería propia de mitigación de spam para React y Next.js App Router. No usa servicios CAPTCHA, APIs de análisis ni servicios criptográficos externos. La demo usa `crypto` de Node.js y Web Crypto del navegador; Next.js y React son dependencias de la aplicación.

## Qué hace

- Recoge contadores de `mousemove`, `keydown` y `touchstart`, con muestreo limitado del ratón.
- Añade un honeypot invisible al formulario y bloquea el envío si está rellenado.
- Calcula una puntuación sencilla con duración de página, interacción y texto introducido. Esas señales vienen del navegador y se pueden falsificar; solo son indicios.
- Aplica un límite de frecuencia con algoritmo token bucket.
- Si el riesgo supera el umbral, el servidor firma un reto con HMAC y el navegador busca una prueba de trabajo SHA-256. El servidor valida la solución, la expiración y el uso único del nonce.
- Ejecuta la evaluación y la verificación de la prueba en el servidor, dentro de un Server Action.

## Cómo leer el resultado de la demo

Después de enviar, el panel muestra las métricas que el navegador adjuntó y las señales que calculó el servidor. La puntuación inicial usa estas reglas: menos de 1.5 segundos suma 35; cero eventos de ratón, teclado y toque suma 60; texto de 80 o más caracteres sin pulsaciones suma 45. Las señales se suman hasta un máximo de 100. El honeypot bloquea de inmediato; riesgo de 90 o más se bloquea; más de 50 y menos de 90 solicita trabajo adicional. Hasta 50 normalmente se acepta.

La demo baja el umbral a `-1` para que veas siempre el paso de trabajo adicional, incluso cuando la puntuación sea baja. El panel explica esta diferencia. La respuesta del panel es diagnóstica y solo se habilita en esta demo; desactiva `exposeDiagnostics` en una aplicación real.

La prueba de trabajo busca un contador cuyo hash SHA-256 tenga 14 bits iniciales en cero. El servidor no acepta el contador por sí solo: verifica el ticket HMAC, su vencimiento, el hash y que el nonce no se haya usado antes.

La prueba de trabajo no demuestra que una persona esté usando la página. Aumenta el costo de automatizar muchos envíos. No es equivalente a la detección de bots de un proveedor con datos de tráfico a gran escala, y puede consumir batería o CPU. La dificultad de la demo es baja y debe medirse y ajustarse para el público y los dispositivos reales.

## Ejecutar la demo

Desde la raíz del repositorio:

```bash
cp examples/next-app/.env.example examples/next-app/.env.local
npm install
npm run demo
```

Abre la dirección local que muestre Next.js. Para que el mecanismo sea fácil de observar, la demo aplica la prueba de trabajo en cada envío, incluso si la puntuación de riesgo es baja. El navegador la resuelve automáticamente; verás “Comprobación local de seguridad en curso…” y, debajo del formulario, el detalle de señales, riesgo, dificultad e intentos. En producción se usaría el umbral normal (50 por defecto), no la configuración forzada de la demo. El formulario de ejemplo no persiste los datos.

## Uso en una app Next.js

El formulario y el Server Action de ejemplo están en `examples/next-app/ContactForm.tsx` y `examples/next-app/actions.ts`. Una integración de producción debe:

1. Crear un secreto aleatorio exclusivo del servidor de al menos 32 caracteres.
2. Reemplazar los almacenes en memoria por almacenamiento propio compartido, con operaciones atómicas para límites y nonces de un solo uso.
3. Derivar la clave de rate limit de una IP obtenida desde un proxy de confianza, y/o de una sesión o cuenta. No confíes en `X-Forwarded-For` salvo que tu proxy elimine los valores enviados por el cliente y lo establezca de forma segura.
4. Validar los campos del negocio antes de guardarlos y limitar los envíos también por identidad y endpoint.
5. Medir el tiempo de cómputo en dispositivos de gama baja antes de subir la dificultad.

`InMemoryChallengeStore` y `InMemoryRateLimitStore` son para desarrollo o un solo proceso. Se reinician al desplegar y no comparten estado entre instancias; no ofrecen protección completa contra replay o abuso distribuido en un despliegue serverless.

## Estructura

- `src/client`: hook, formulario, empaquetado de telemetría y solución de prueba de trabajo.
- `src/server`: puntuación, token bucket, firma y verificación de pruebas.
- `src/shared`: campos y tipos compartidos.
- `examples/next-app`: demo ejecutable con App Router y Server Action.

No es una defensa completa contra ataques dirigidos. Para producción, añade almacenamiento compartido propio, límites por identidad/negocio, monitoreo de decisiones y un mecanismo accesible de recuperación para usuarios legítimos.

## Estado de seguridad y plan antes de desplegar

Este proyecto está en etapa de demo local. El flujo se puede probar, pero todavía no debe usarse como control de seguridad de producción ni para proteger inicios de sesión, pagos o acciones sensibles. CAPTCHA, honeypot y prueba de trabajo elevan el costo de algunos bots; no garantizan que el visitante sea humano ni reemplazan autenticación, autorización o controles de disponibilidad.

### Lo que ya incluye

- Señales conductuales básicas en el navegador, honeypot y evaluación heurística en el servidor.
- Reto de prueba de trabajo firmado con HMAC, vencimiento y verificación del nonce de un solo uso.
- Token bucket y almacenes en memoria para que el flujo sea fácil de ejecutar localmente.
- Demo App Router con diagnóstico visible y reto forzado para que se pueda observar el proceso.

### Pendientes, en orden recomendado

1. **Quitar la confianza en señales manipulables.** La telemetría y el texto llegan desde el navegador y se pueden falsificar. En el estado actual, un cliente puede inventar interacciones y tiempo para bajar la puntuación y evitar el reto cuando se usan los umbrales normales. Mantener esas métricas como señales auxiliares; exigir límites y retos según controles del servidor y la sensibilidad del endpoint.
2. **Implementar estado compartido y atómico.** Reemplazar `InMemoryRateLimitStore` y `InMemoryChallengeStore` por adaptadores para almacenamiento propio compartido. El límite debe ser atómico entre instancias y el consumo del nonce debe ser una operación única que rechace repeticiones. Sin esto, reinicios y despliegues con varias instancias debilitan los límites y la protección contra replay.
3. **Diseñar rate limits por endpoint y entidad.** Combinar IP validada, sesión y, cuando exista, cuenta; usar límites distintos por acción. Para autenticación, considerar demoras progresivas, MFA/passkeys y respuestas que no revelen si existe una cuenta. Evitar bloqueos permanentes que un atacante pueda provocar contra la víctima.
4. **Establecer una cadena de proxy confiable.** Solo derivar IP de encabezados que el proxy propio sobrescribe. Evitar acceso directo a la aplicación que permita falsificar `x-real-ip` o `x-forwarded-for`; documentar la configuración de proxy y las redes de confianza.
5. **Validar y limitar toda entrada en el servidor.** Aplicar esquemas, longitudes máximas, límites de cuerpo/archivos y cuotas de negocio antes de persistir o ejecutar trabajo costoso. La integración de producción debe autorizar cada acción y usar escrituras seguras e idempotentes.
6. **Proteger secretos y operaciones.** Usar secreto aleatorio fuerte solo en el servidor, fuera del repositorio y sin prefijo `NEXT_PUBLIC_`; preparar rotación, logs sin datos innecesarios, métricas de falsos positivos y un camino accesible para usuarios legítimos.
7. **Medir el reto y la disponibilidad.** Ajustar la dificultad con pruebas en móviles y dispositivos de gama baja. La prueba de trabajo consume CPU/batería y no detiene ataques volumétricos que saturen red o infraestructura antes de llegar a la app; hace falta capacidad de mitigación en la infraestructura propia.

Next.js trata las Server Actions como endpoints públicos: cada acción debe autenticar y autorizar sus operaciones. Su comprobación de origen ayuda contra CSRF, pero no sustituye esos controles. Consulta la [guía de seguridad de datos de Next.js](https://nextjs.org/docs/15/app/guides/data-security) y la [configuración de Server Actions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions). Para límites de autenticación y disponibilidad, consulta las guías OWASP de [autenticación](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [gestión de bots](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html) y [denegación de servicio](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html).

### Punto para retomar

- Demo actual: proyecto Next.js local, Server Action y prueba de trabajo automática; el callback de ejemplo no persiste datos.
- No hay aún adaptadores de almacenamiento compartido ni configuración de despliegue. Los almacenes en memoria y el uso de `x-real-ip` en la demo son solo para desarrollo.
- Siguiente entrega técnica recomendada: definir la interfaz de almacenamiento y agregar un adaptador con operaciones atómicas para rate limiting y nonces; después añadir pruebas de concurrencia/replay y ajustar `handleBehaviorSubmission` para que la decisión no dependa únicamente de telemetría del cliente.
- Antes de publicar, elegir y documentar el servidor/proxy propio, sus límites de recursos, secretos, dominios de origen confiables, monitoreo y procedimiento de rollback. No desplegar la configuración de demo con `challengeThreshold: -1` ni `exposeDiagnostics: true`.
