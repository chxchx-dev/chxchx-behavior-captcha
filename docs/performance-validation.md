# Validación de coste de la prueba

Usa esta guía antes de cambiar la dificultad o el tiempo máximo del reto. La demo muestra estadísticas locales, pero no conserva los resultados al cerrar o recargar la pestaña.

## Equipo objetivo medido (resultados preliminares)

Perfil detectado el 27 de octubre de 2026:

- Dell Latitude 5400.
- Windows 10 Pro 22H2, compilación 19045.
- Intel Core i5-8365U @ 1.60 GHz.
- Chrome 156.0.8078.49 y Brave 155.1.97.56 instalados; vuelve a anotar la versión usada al medir, porque puede cambiar.
- Node.js 22.23.4 está instalado con NVM, pero la consola detecta 20.19.5. Ejecuta `nvm use 22.23.4` antes de arrancar la demo, que requiere 22.13 o posterior.
- RAM y modo de energía durante el lote: pendientes de confirmar.

## Lote automatizado del solver (27 de octubre de 2026)

Se ejecutaron 100 soluciones independientes en cada navegador instalado, usando el módulo compilado `dist/client/solveProofOfWork.js`, dificultad de 14 bits y perfiles temporales aislados en modo headless. Para que Chrome y Brave funcionaran en este entorno, el proceso temporal se lanzó con GPU y sandbox desactivados. El tiempo se tomó con `performance.now()` alrededor de cada llamada al solver y se redondeó al milisegundo; la configuración puede diferir del uso normal del navegador.

| Navegador | Versión | Soluciones | Mediana (ms) | p95 (ms) | Mín. (ms) | Máx. (ms) | Errores o timeouts |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Chrome | 156.0.8078.49 | 100 | 515 | 1.959 | 5 | 3.450 | 0 |
| Brave | 155.1.97.56 | 100 | 524 | 1.699 | 0 | 2.686 | 0 |

El mínimo de 0 ms de Brave corresponde a una muestra redondeada al milisegundo; no significa que el solver tenga coste real cero. El lote mide el cálculo del solver en el motor del navegador. No envió el formulario de la demo ni midió la interacción de una persona, límites de envíos, interrupciones, consumo de energía o comportamiento con la pestaña en segundo plano. La RAM y el modo de energía tampoco se registraron. La sesión reportó presión de memoria y un reinicio de la PC; sin telemetría no se puede atribuir la causa al benchmark. Trata las cifras como preliminares y no ajustes la dificultad con ellas todavía.

## Límites de carga antes de repetir

No repitas ahora los 100 retos completos. Para una futura comprobación en este equipo:

1. Usa el navegador normal con sandbox habilitado y empieza con solo 5 soluciones en un navegador.
2. Observa en el Administrador de tareas la memoria disponible y el uso de CPU. Detente si la memoria disponible baja de 2 GB, el uso de memoria supera el 85 % de forma sostenida o el equipo empieza a responder lento.
3. Solo si el piloto termina estable, continúa en bloques de hasta 10 soluciones, un navegador a la vez, con pausas de 30 segundos entre bloques.
4. No ejecutes lotes en paralelo. Si aparece presión de recursos, cierra únicamente la ventana o el perfil temporal del benchmark y no continúes la sesión.

El lote registrado arriba se ejecutó en modo headless con GPU y sandbox desactivados para sortear restricciones de este entorno; esa configuración no representa una sesión normal y refuerza que los resultados requieran confirmación antes de cambiar la dificultad.

## Preparar una sesión

Registra lo siguiente para cada combinación de dispositivo y navegador:

- Fecha y modelo del dispositivo.
- Sistema operativo y versión.
- Procesador y memoria RAM, si están disponibles.
- Chrome o Brave y su versión exacta.
- Modo de energía y si el equipo está conectado a corriente.
- Cambios relevantes durante la prueba, como carga alta del sistema o pestaña en segundo plano.

No cambies el código, la configuración de dificultad ni el dispositivo durante un lote. Prueba Chrome y Brave en lotes separados si ambos se van a soportar.

## Ejecutar y registrar resultados

1. Arranca la demo siguiendo el [README](../README.md) y mantén una sola pestaña en primer plano.
2. Usa datos ficticios; el formulario de demo no guarda los envíos.
3. Completa retos hasta tener al menos 100 soluciones. La sección **Medición local de coste** muestra el número de soluciones, la mediana, el p95 y el número de interrupciones.
4. La demo limita los envíos a 10 por minuto. Deja que se reponga el límite entre envíos; si aparece un aviso de límite, espera antes de continuar. Anota las interrupciones y el motivo que muestra el último resultado.
5. Como la página conserva como máximo 200 muestras en memoria, copia las cifras antes de cerrar o recargar la pestaña.
6. Repite el lote desde cero para cada dispositivo y navegador; pulsa **Limpiar mediciones** antes de empezar el siguiente.

Plantilla para consolidar resultados:

| Fecha | Dispositivo | Sistema operativo | Navegador/versión | Energía | Soluciones | Mediana (ms) | p95 (ms) | Interrupciones | Motivos/notas |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
|  |  |  |  |  |  |  |  |  |  |

No ajustes la dificultad solo a partir del promedio: revisa p95 e interrupciones por separado y decide primero qué coste máximo es aceptable para las personas usuarias del proyecto.
