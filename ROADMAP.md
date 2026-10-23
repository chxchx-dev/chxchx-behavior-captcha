# Cierre de v1

## Alcance acordado

Herramienta autoalojada para reducir abuso y spam en formularios públicos. La telemetría del navegador y la prueba de trabajo son señales auxiliares: no prometemos detección infalible ni prueba de humanidad. Sin reputación de tráfico externo, la meta realista es combinar límites del servidor, reto selectivo y controles de negocio de cada aplicación.

## Pasos

- [x] Separar el límite de envíos iniciales del límite de verificaciones del reto.
- [x] Exigir una política `always` o `adaptive`, usar el rate limit del servidor como señal independiente y no bloquear solo por la heurística del navegador.
- [x] Cerrar la guía de integración: identidad de cliente confiable, límites de cuerpo antes del parseo, validación y autorización en cada acción.
- [x] Permitir detener la prueba, limitarla a 15 segundos por defecto, anunciar sus estados y ofrecer una ranura para la alternativa accesible del proyecto anfitrión.
- [x] Instrumentar en la demo la mediana, el percentil 95 y las interrupciones, con resultados locales por pestaña.
- [ ] Conectar una ruta de revisión accesible propia y recopilar al menos 100 soluciones por dispositivo modesto objetivo antes de ajustar la dificultad.
- [ ] Añadir pruebas de seguridad e integración: replay, concurrencia, cambios de formulario, expiración, persistencia y límites.
- [ ] Cerrar operación y publicación: limpieza programada, política de datos, CI, empaquetado e instalación desde el paquete.

## Criterio de cierre

La v1 se considera lista cuando los controles críticos tienen cobertura automatizada, el paquete se instala en una app anfitriona desde sus artefactos publicados, el reto no bloquea envíos legítimos por un error de cupo y la documentación deja claros los límites de detección y despliegue.
