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
- Protocolo documentado para reunir mediciones locales por dispositivo y navegador; aún faltan los equipos objetivo y los resultados reales.
- Pasos para ejecutar localmente en el [README](../README.md), documentación de integración y límites de seguridad.
- Licencia MIT y metadato `license` del paquete.

## No declarar lista la v1 todavía

- **La matriz de CI aún debe validarse en GitHub cuando el repositorio sea público.** Mientras tanto, los jobs omiten el runner en el repositorio privado y las validaciones se pueden ejecutar con `npm run ci`; pasaron localmente en Node 22.23.4.
- **La demo acepta una URL HTTPS o un enlace mailto configurable para su alternativa, pero la variable está vacía.** No existe aún un canal real. Cada aplicación anfitriona debe implementar y probar su alternativa, con sus propios límites, validaciones y autorización.
- **La demo no guarda envíos.** Para un piloto o producción, conecta `onAccepted` a datos de la aplicación después de validar y autorizar.
- **No se ha medido la prueba en dispositivos objetivo.** Chrome o Brave identifica el navegador, pero falta elegir los equipos físicos modestos. Sigue el [protocolo de medición](performance-validation.md), reúne al menos 100 soluciones por combinación objetivo y analiza p95 e interrupciones antes de elegir dificultad.
- **La operación de SQLite debe prepararse en el hosting real.** Confirma disco persistente y permisos; programa `behavior-captcha-prune`, define backup/restauración y monitorización, y observa concurrencia/cupo agotado.
- **El paquete aún no se ha publicado en npm.** La app Next.js temporal instalada desde el tarball compiló localmente; falta CI y verificar el estado externo, nombre/cuenta y versión antes de una publicación.
- No hay canal privado de reporte de vulnerabilidades definido; consulta [seguridad](security.md).

## Revisión antes de hacer público el repositorio

- La búsqueda local y en los commits revisados no encontró formatos comunes de claves privadas, tokens de GitHub/cloud ni cadenas PostgreSQL con credenciales. Es una búsqueda heurística, no garantiza que no haya secretos; haz una revisión final del historial antes de publicar.
- El historial remoto de `main` y `dev` ya se actualizó con `--force-with-lease`; el contenido del commit base no cambió y los commits actuales usan `chxchx-dev <christgg1997@gmail.com>`. Ese correo quedará visible. Los clones que tengan la historia anterior deberán resincronizar sus ramas antes de seguir trabajando.
- El repositorio todavía es privado. El [PR #1](https://github.com/chxchx-dev/chxchx-behavior-captcha/pull/1) de `dev` hacia `main` se fusionó el 27 de octubre de 2026. Los clones anteriores a la reescritura de historial deben resincronizarse; hacer público el repositorio queda pendiente de la revisión final.
- `pnpm-lock.yaml` aparece sin seguimiento y no contiene un importer para `examples/next-app`; `package-lock.json` sí está en Git y los scripts usan npm. Se dejó intacto; no lo agregues al repositorio sin regenerarlo si se decide adoptar pnpm.
- Comprueba que la política de privacidad de la aplicación explique los datos que procesan la aplicación, el hosting y sus logs; la base SQLite de la librería no es el único posible lugar de retención.

## Pasos sugeridos para cerrar

1. Decidir qué hacer con el `pnpm-lock.yaml` sin seguimiento; el proyecto usa npm y conserva `package-lock.json`.
2. Mientras el repositorio sea privado, validar con `npm run ci`; después de hacerlo público, confirmar que la matriz de GitHub Actions pase en el PR o en `main`.
3. Configurar una ruta de revisión accesible real en la demo o en la aplicación anfitriona.
4. Elegir equipos modestos y recopilar 100 soluciones por combinación de dispositivo y navegador siguiendo el protocolo.
5. Preparar el despliegue de SQLite y los controles de observabilidad/retención del servicio.
6. Confirmar nombre, cuenta, versión, metadatos y artefactos del paquete antes de una publicación npm.
