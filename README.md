# @chxchx/behavior-captcha

Mitigación autoalojada de abuso para formularios en React y Next.js. Combina límites de frecuencia del lado del servidor, señales de interacción no confiables y una prueba de trabajo opcional. No usa un proveedor CAPTCHA ni un servicio de base de datos externo.

> **Estado:** versión inicial en desarrollo (`0.1.0`). El repositorio incluye una demo local; la demo no guarda envíos y no está lista para recibir datos reales. Consulta [el estado de preparación para publicación](https://github.com/chxchx-dev/chxchx-behavior-captcha/blob/main/docs/release-readiness.md) antes de usarla en producción.

## Ejecutar la demo local

Requisitos: Node.js 22.13 o posterior y npm. El almacenamiento usa `node:sqlite`; en Node 22 esa API todavía es experimental.

Desde la raíz del repositorio, copia la configuración de ejemplo y arranca Next.js:

```powershell
Copy-Item examples/next-app/.env.example examples/next-app/.env.local
npm install
npm run demo
```

Abre <http://127.0.0.1:3000>. En macOS o Linux, el primer comando puede ser `cp examples/next-app/.env.example examples/next-app/.env.local`.

Los secretos de `.env.example` son marcadores para desarrollo. La demo fuerza una prueba de trabajo y muestra diagnósticos para explicar el flujo. No uses esos secretos ni copies esa configuración a producción. El formulario es público intencionalmente y no persiste los datos enviados.

## Comandos del proyecto

```bash
npm run demo       # Ejecuta la demo local
npm run typecheck  # Comprueba los tipos del paquete y el ejemplo
npm run build      # Genera el paquete en dist/
npm run build --workspace examples/next-app # Compila la demo Next.js para producción
npm test           # Construye y ejecuta las pruebas de seguridad e integración
npm run pack:smoke # Empaqueta e instala en un consumidor temporal
```

## Paquete

El paquete aún no está publicado en npm. Para desarrollar desde este repositorio, ejecuta `npm install` en la raíz. Una vez publicado, la instalación para una aplicación anfitriona será:

```bash
npm install @chxchx/behavior-captcha
```

La app anfitriona debe usar React 18 o posterior y ejecutar la parte de servidor en Node.js, no en Edge Runtime. Para integrar el paquete y configurar SQLite, consulta la [guía de integración y despliegue](https://github.com/chxchx-dev/chxchx-behavior-captcha/blob/main/docs/deployment.md). La [guía de seguridad y privacidad](https://github.com/chxchx-dev/chxchx-behavior-captcha/blob/main/docs/security.md) describe los datos, las limitaciones y los controles que siguen siendo responsabilidad de cada aplicación.

## Documentación

- [Índice de documentación](https://github.com/chxchx-dev/chxchx-behavior-captcha/blob/main/docs/README.md)
- [Estado y pendientes antes de producción/publicación](https://github.com/chxchx-dev/chxchx-behavior-captcha/blob/main/docs/release-readiness.md)
- [Hoja de ruta de v1](https://github.com/chxchx-dev/chxchx-behavior-captcha/blob/main/ROADMAP.md)
- [Licencia MIT](https://github.com/chxchx-dev/chxchx-behavior-captcha/blob/main/LICENSE)
