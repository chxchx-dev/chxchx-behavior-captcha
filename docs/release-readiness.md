# Estado de preparación para producción y publicación

Estado al 26 de octubre de 2026. Typecheck, pruebas (8 casos), build de la demo y smoke test del tarball pasaron localmente con Node 22.23.4.

## Ya está en el repositorio

- Código cliente y servidor para telemetría heurística, política `always`/`adaptive`, rate limiting, retos de prueba de trabajo firmados y almacenamiento SQLite/in-memory.
- Límites de tamaño de entrada en la librería y de cuerpo en la demo de Next.js.
- Demo local con mediciones que permanecen en la pestaña y ejemplo de cancelación del reto.
- Pruebas automatizadas para replay, cambios del formulario, políticas de reto, límites de entrada, rate limits y persistencia/concurrencia de SQLite.
- CI configurada para tipos, pruebas, build de la demo y smoke test del tarball en Node 22.13 y 24; falta que GitHub la ejecute en un push o PR.
- Smoke test local exitoso: construye el paquete, lo instala en una app Next.js temporal y revisa exports, tipos, CSS, docs y licencia.
- Pasos para ejecutar localmente en el [README](../README.md), documentación de integración y límites de seguridad.
- Licencia MIT y metadato `license` del paquete.

## No declarar lista la v1 todavía

- **CI aún no se ha ejecutado en GitHub.** Las pruebas, el typecheck, el build de la demo y el smoke test pasaron localmente en Node 22.23.4; Next.js mostró solo avisos de caché de webpack durante el build. Falta el resultado de la matriz en Actions.
- **La demo acepta una URL HTTPS o un enlace mailto configurable para su alternativa, pero la variable está vacía.** No existe aún un canal real. Cada aplicación anfitriona debe implementar y probar su alternativa, con sus propios límites, validaciones y autorización.
- **La demo no guarda envíos.** Para un piloto o producción, conecta `onAccepted` a datos de la aplicación después de validar y autorizar.
- **No se ha medido la prueba en dispositivos objetivo.** Chrome o Brave identifica el navegador, pero falta elegir los equipos físicos modestos. Reúne al menos 100 soluciones por dispositivo y analiza p95 e interrupciones antes de elegir dificultad.
- **La operación de SQLite debe prepararse en el hosting real.** Confirma disco persistente, permisos, backup/restauración, limpieza periódica, monitorización y comportamiento ante concurrencia/cupo agotado.
- **El paquete aún no se ha publicado en npm.** La app Next.js temporal instalada desde el tarball compiló localmente; falta CI y verificar el estado externo, nombre/cuenta y versión antes de una publicación.
- No hay canal privado de reporte de vulnerabilidades definido; consulta [seguridad](security.md).

## Revisión antes de hacer público el repositorio

- La búsqueda local y en los commits revisados no encontró formatos comunes de claves privadas, tokens de GitHub/cloud ni cadenas PostgreSQL con credenciales. Es una búsqueda heurística, no garantiza que no haya secretos; haz una revisión final del historial antes de publicar.
- El historial local de `main` se reescribió con `chxchx-dev <christgg1997@gmail.com>` como identidad de los commits. Ese correo quedará visible. `origin/main` aún apunta a la historia anterior; no publiques el repositorio hasta actualizar el remoto con el historial reescrito. Esto requiere un push forzado coordinado y afecta a clones existentes.
- `pnpm-lock.yaml` aparece sin seguimiento y no contiene un importer para `examples/next-app`; `package-lock.json` sí está en Git y los scripts usan npm. Se dejó intacto; no lo agregues al repositorio sin regenerarlo si se decide adoptar pnpm.
- Comprueba que la política de privacidad de la aplicación explique los datos que procesan la aplicación, el hosting y sus logs; la base SQLite de la librería no es el único posible lugar de retención.

## Pasos sugeridos para cerrar

1. Resolver la decisión sobre `pnpm-lock.yaml` y actualizar el remoto solo con una reescritura coordinada.
2. Confirmar que CI pasa en GitHub.
3. Configurar un canal accesible real y recopilar 100 mediciones por dispositivo físico objetivo en Chrome o Brave.
4. Preparar el despliegue de SQLite y los controles de observabilidad/retención del servicio.
5. Confirmar nombre, cuenta, versión, metadatos y artefactos del paquete antes de una publicación npm.
