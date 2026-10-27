# Estado de preparación para producción y publicación

Estado al 27 de octubre de 2026. `npm run ci` pasó localmente con Node 22.23.4: typecheck, pruebas (9 casos), build de la demo y smoke test del tarball.

## Ya está en el repositorio

- Código cliente y servidor para telemetría heurística, política `always`/`adaptive`, rate limiting, retos de prueba de trabajo firmados y almacenamiento SQLite/in-memory.
- Límites de tamaño de entrada en la librería y de cuerpo en la demo de Next.js.
- Demo local con mediciones que permanecen en la pestaña y ejemplo de cancelación del reto.
- Comando `behavior-captcha-prune` para quitar buckets y nonces vencidos en una ejecución programada.
- Pruebas automatizadas para replay, cambios del formulario, políticas de reto, límites de entrada, rate limits y persistencia/concurrencia de SQLite.
- CI configurada para tipos, pruebas, build de la demo y smoke test del tarball en Node 22.13 y 24. Mientras el repo siga privado, los jobs se saltan antes de asignar runner para no consumir minutos; `npm run ci` ejecuta localmente las mismas comprobaciones. Al hacerlo público, los runners estándar de GitHub podrán ejecutar la matriz sin coste.
- Smoke test local exitoso: construye el paquete, lo instala en una app Next.js temporal y revisa exports, tipos, CSS, docs y licencia.
- Protocolo documentado y lote automatizado inicial de 100 soluciones en Chrome y Brave para el Dell Latitude 5400; los resultados son preliminares y falta confirmar estabilidad y experiencia interactiva.
- Pasos para ejecutar localmente en el [README](../README.md), documentación de integración y límites de seguridad.
- Licencia MIT y metadato `license` del paquete.

## No declarar lista la v1 todavía

- **La matriz de CI aún debe validarse en GitHub cuando el repositorio sea público.** Mientras tanto, los jobs omiten el runner en el repositorio privado y las validaciones se pueden ejecutar con `npm run ci`; pasaron localmente en Node 22.23.4.
- **La purga del historial alojado por GitHub sigue pendiente.** `main` y `dev` usan la historia reescrita y el clon local ya no conserva los objetos antiguos. Se eliminaron los dos runs antiguos de Actions, pero el commit histórico todavía responde por SHA en GitHub. Se envió una solicitud de privacidad el 27 de octubre de 2026; no hay número de caso ni respuesta todavía. Mantén el repositorio privado hasta que se resuelva y se verifique que la referencia antigua ya no está disponible.
- **La demo acepta una URL HTTPS o un enlace mailto configurable para su alternativa, pero la variable está vacía.** No existe aún un canal real. Cada aplicación anfitriona debe implementar y probar su alternativa, con sus propios límites, validaciones y autorización.
- **La demo no guarda envíos.** Para un piloto o producción, conecta `onAccepted` a datos de la aplicación después de validar y autorizar.
- **Falta validar estabilidad y experiencia real antes de ajustar la dificultad.** El lote inicial midió el solver compilado en Chrome y Brave, no la demo interactiva. Después de esa sesión se reportó presión de memoria y reinicio; no se midió RAM ni se puede atribuir la causa. Sigue el [protocolo de medición](performance-validation.md) con un piloto pequeño y monitorización, y registra p95 e interrupciones en la demo.
- **La operación de SQLite debe prepararse en el hosting real.** Confirma disco persistente y permisos; programa `behavior-captcha-prune`, define backup/restauración y monitorización, y observa concurrencia/cupo agotado.
- **El paquete aún no se ha publicado en npm.** La app Next.js temporal instalada desde el tarball compiló localmente; falta CI y verificar el estado externo, nombre/cuenta y versión antes de una publicación.
- No hay canal privado de reporte de vulnerabilidades definido; consulta [seguridad](security.md).

## Revisión antes de hacer público el repositorio

- La búsqueda local y en las ramas activas no encontró formatos comunes de claves privadas, tokens de GitHub/cloud ni cadenas PostgreSQL con credenciales. Es una búsqueda heurística, no garantiza que no haya secretos; haz una revisión final antes de publicar.
- El historial de `main` y `dev` se actualizó con `--force-with-lease`; los commits activos usan `chxchx-dev <christgg1997@gmail.com>`. Los clones anteriores a la reescritura deben resincronizarse o volver a clonarse para no reintroducir la historia vieja.
- El repositorio sigue privado. El [PR #1](https://github.com/chxchx-dev/chxchx-behavior-captcha/pull/1) de `dev` hacia `main` se fusionó el 27 de octubre de 2026. Aunque las ramas y el clon local están limpios, GitHub aún devuelve una referencia histórica por SHA. Los dos runs antiguos de Actions se eliminaron y hay una solicitud de privacidad pendiente; no publiques el repositorio hasta confirmar la purga.
- `pnpm-lock.yaml` aparece sin seguimiento y no contiene un importer para `examples/next-app`; `package-lock.json` sí está en Git y los scripts usan npm. Se dejó intacto; no lo agregues al repositorio sin regenerarlo si se decide adoptar pnpm.
- Comprueba que la política de privacidad de la aplicación explique los datos que procesan la aplicación, el hosting y sus logs; la base SQLite de la librería no es el único posible lugar de retención.

## Pasos sugeridos para cerrar

1. Resolver la solicitud de privacidad y verificar que el commit histórico ya no sea accesible por SHA; mantener el repositorio privado hasta entonces.
2. Decidir qué hacer con el `pnpm-lock.yaml` sin seguimiento; el proyecto usa npm y conserva `package-lock.json`.
3. Validar `npm run ci` localmente si cambia código y, una vez despejada la purga y hecho público el repositorio, confirmar la matriz de GitHub Actions.
4. Configurar una ruta de revisión accesible real en la aplicación anfitriona.
5. Confirmar el rendimiento en bloques pequeños con monitorización de memoria y validar p95 e interrupciones en la demo antes de ajustar dificultad.
6. Preparar el despliegue de SQLite y los controles de observabilidad/retención del servicio.
7. Confirmar nombre, cuenta, versión, metadatos y artefactos del paquete antes de una publicación npm.
