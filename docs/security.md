# Seguridad y privacidad

## Modelo de protección

El paquete busca aumentar el costo del spam automatizado en formularios propios. Combina rate limits del servidor, un honeypot, señales heurísticas de interacción y una prueba de trabajo SHA-256 cuyo reto va firmado por el servidor, vence y se consume una sola vez.

Estas señales no prueban que una persona sea humana. La telemetría llega desde el navegador y se puede falsificar; el honeypot también se puede detectar. Un bot con suficiente capacidad puede resolver la prueba de trabajo. El mecanismo no detiene ataques que saturan la red o el servidor antes de que la aplicación procese el formulario.

## Datos tratados

- El cliente cuenta tiempo transcurrido, movimientos de ratón, pulsaciones de teclado y eventos táctiles. No conserva una grabación de esos eventos; el formulario envía los contadores como telemetría no confiable.
- La aplicación anfitriona elige la clave de rate limit, normalmente una identidad de sesión/cuenta validada o una IP normalizada por un proxy confiable. SQLite guarda un HMAC de esa clave y los contadores, no la clave original.
- SQLite guarda nonces de retos consumidos hasta su vencimiento. La base no guarda campos del formulario ni telemetría.
- El token del reto contiene una vinculación firmada al alcance y al hash de los datos originales para impedir que se reutilice con otro cliente, endpoint o formulario.

La aplicación, el proxy, el proveedor de hosting y el sistema de logs pueden procesar o registrar datos adicionales. Define una política de privacidad y retención para toda la aplicación; la librería no controla esos componentes.

## Requisitos para cada aplicación anfitriona

1. Mantén `BEHAVIOR_CAPTCHA_SECRET` y `RATE_LIMIT_KEY_HASH_SECRET` en el servidor, con valores aleatorios separados, y rota/reemplaza cualquier valor que se exponga.
2. Deriva `challengeScope` y la clave de rate limit en el servidor. No uses campos del formulario ni cabeceras reenviadas directamente por el cliente como identidad confiable.
3. Limita el cuerpo en el framework/proxy antes del parseo; luego valida campos, tamaño, autorización y reglas de negocio.
4. Aplica rate limits por endpoint e identidad y agrega controles de disponibilidad apropiados para el servicio.
5. Autentica y autoriza cada operación protegida. Resolver el CAPTCHA no concede permisos.
6. Enlaza `proofFallback` a una alternativa accesible real, con validación y controles de abuso equivalentes. Detener la prueba no envía ni acepta automáticamente el formulario.
7. Ajusta la dificultad tras medir dispositivos modestos reales. La prueba consume CPU, energía y batería, y puede excluir a personas que no puedan ejecutarla.
8. Protege el archivo SQLite y limpia filas vencidas. No uses este adaptador con almacenamiento efímero, multiinstancia o compartido por red.

## Reporte de vulnerabilidades

No hay un canal de reporte de seguridad publicado en este repositorio. Antes de anunciar un uso de producción, define un contacto y un proceso privado para reportar vulnerabilidades. Evita incluir secretos o datos personales en issues públicos.
