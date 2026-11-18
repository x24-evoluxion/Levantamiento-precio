# PROGRESO

> Bitácora del proyecto. Cada agente, **al terminar su fase**, agrega una sección
> nueva **al final** usando la plantilla de abajo y actualiza la tabla de estado.
> El siguiente agente empieza en la primera fase que no tenga ✅.

## Estado

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Plan | ✅ |
| 1 | Esqueleto del proyecto | ✅ |
| 2 | Base de datos y Storage | ⬜ |
| 3 | Lista de visitas y nueva visita | ⬜ |
| 4 | Ubicación | ⬜ |
| 5 | Subir fotos | ⬜ |
| 6 | Ver fotos de una visita | ⬜ |
| 7 | Pulido móvil y despliegue | ⬜ |

Leyenda: ⬜ pendiente · 🟡 en curso / incompleta · ✅ terminada

## Pendientes y dudas abiertas

- [ ] **Lista de competidores definitiva.** La actual es provisional. Falta uno
      ("POR CONFIRMAR"). Se corrige editando `supabase/seed_competidores.sql`
      (se crea en la Fase 2).
- [ ] **Markdown de referencia del jefe.** No está disponible todavía. Si llega,
      ponerlo en `docs/` y revisar si cambia algo del plan.
- [x] Confirmar los **nombres** de las variables de `.env.local` (Fase 1). Confirmado:
      `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. (Primero se
      confirmó `..._ANON_KEY` por error; se corrigió después de la Fase 1 y el PLAN ya está actualizado).

---

## Plantilla (copia esto al final para tu fase)

```markdown
## Fase N — <nombre> (<fecha AAAA-MM-DD>)

**Qué se hizo:**
- ...

**Archivos creados o cambiados:**
- `ruta/archivo` — para qué sirve

**Pasos que hizo el usuario a mano:**
- ...

**Cómo probarlo:**
1. ...

**Decisiones tomadas (y por qué):**
- ...

**Problemas encontrados / pendientes para la siguiente fase:**
- ...

**Commit:** `<hash corto>` — <mensaje>
```

---

## Fase 0 — Plan (2026-11-18)

**Qué se hizo:**
- Se leyó `docs/transcript.txt` (la reunión donde se describe la app).
- Se escribió `docs/PLAN.md` con el alcance, las decisiones, el diseño de datos, las
  pantallas y las 8 fases.
- Se creó este archivo.

**Archivos creados o cambiados:**
- `docs/PLAN.md` — guía del proyecto para todos los agentes
- `docs/PROGRESO.md` — esta bitácora

**Pasos que hizo el usuario a mano:**
- Confirmó el stack: TypeScript + Next.js (App Router) + Tailwind CSS.
- Aprobó agregar la tabla `fotos`.
- Dio la lista provisional de competidores.

**Cómo probarlo:**
- No aplica (no hay código).

**Decisiones tomadas (y por qué):**
- **La visita se guarda de una sola vez** (competidor + ubicación). Así las reglas de
  Supabase solo tienen que permitir *crear* visitas, no *modificarlas*, y nadie puede
  alterar visitas de otros.
- **Bucket `fotos` público para lectura.** Es lo más simple para mostrar imágenes, y
  son fotos de anaqueles, no datos sensibles.
- **Competidores en un archivo SQL separado** que se puede ejecutar varias veces, para
  que el usuario los corrija fácilmente. "POR CONFIRMAR" queda con `activo = false`
  para que no aparezca en la app.
- **Solo la llave pública (anon) de Supabase.** La protección la dan las reglas RLS.

**Problemas encontrados / pendientes para la siguiente fase:**
- Ver "Pendientes y dudas abiertas" arriba.

**Agregado después de la revisión del usuario:** en la Fase 2, nombres de carpetas
y archivos con UUID, y bucket con límite de 5 MB que acepta solo imágenes (ver PLAN 4.2 y Fase 2).

**Commit:** `Fase 0: plan del proyecto y bitácora de progreso` (ver `git log`).

---

## Fase 1 — Esqueleto del proyecto (2026-11-18)

**Qué se hizo:**
- Se creó el proyecto con `create-next-app@16.4.6` (TypeScript, App Router, Tailwind,
  ESLint, carpeta `src/`, alias `@/*`). Se generó en una carpeta temporal y se movió
  aquí, porque la carpeta ya tenía archivos. No se tocaron `README.md` ni `docs/`.
- Se combinaron los `.gitignore` (el de Next.js + la regla `.env*`) y se agregó `!.env.example`.
- Se creó `.env.example` con solo los nombres de las variables.
- Se instaló `@supabase/supabase-js` y se creó el cliente.
- Página `/` provisional con el título y un recuadro que dice si la conexión con Supabase funciona.
- Layout en español (`lang="es"`) y título de pestaña "Levantamiento de precios".
- Se borraron los SVG de ejemplo de `public/` (no se usaban).

**Versiones usadas:**
- Node **v26.5.1**, npm 11.17.0
- Next.js **16.4.6**, React 19.3.0, Tailwind CSS 4.3.3, @supabase/supabase-js 2.119.1

**Archivos creados o cambiados:**
- `package.json`, `package-lock.json` — dependencias y scripts (`dev`, `build`, `lint`)
- `next.config.ts` — config de Next (trae `cacheComponents` y `partialPrefetching` activados)
- `tsconfig.json`, `eslint.config.mjs`, `next-env.d.ts` (ignorado por git) — config de TypeScript y ESLint
- `AGENTS.md` — aviso que genera Next.js para agentes de IA: leer la doc en `node_modules/next/dist/docs/`
- `.gitignore` — combinado; ignora `.env*` excepto `.env.example`
- `.env.example` — plantilla con los nombres de las variables (sin valores)
- `src/lib/supabase.ts` — cliente de Supabase (solo llave anon; error claro si faltan variables)
- `src/app/layout.tsx` — layout raíz en español
- `src/app/page.tsx` — página `/` provisional
- `src/app/EstadoConexion.tsx` — componente provisional que prueba la conexión desde el navegador
- `src/app/globals.css`, `src/app/favicon.ico` — los que trae la plantilla

**Pasos que hizo el usuario a mano:**
- Confirmó que sus variables se llaman `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  **Corrección:** al principio dijo `NEXT_PUBLIC_SUPABASE_ANON_KEY` por error; se cambió en
  `src/lib/supabase.ts`, `.env.example`, `PLAN.md` y aquí, en un commit aparte.

**Cómo probarlo:**
1. `npm run dev`
2. Abrir `http://localhost:3000`.
3. Debe verse "Levantamiento de precios" y un recuadro verde "✅ Conexión con Supabase:
   funciona — Las tablas todavía no existen (se crean en la Fase 2)". Si es rojo, el
   mensaje dice qué falló (variables faltantes o llave inválida).

**Decisiones tomadas (y por qué):**
- **Se dejaron `cacheComponents` y `partialPrefetching` activados**, porque son los
  valores recomendados de Next 16.4. Consecuencia para las siguientes fases: los datos
  que se leen en cada visita van en componentes de cliente (`"use client"`) o dentro de
  `<Suspense>`. Leer `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
- **Las variables se leen literalmente** (`process.env.NEXT_PUBLIC_...`) porque Next las
  reemplaza al construir; con `process.env[nombre]` llegarían vacías al navegador.
- **La prueba de conexión hace una consulta real** a `competidores`. Como la tabla aún no
  existe, el error "tabla no existe" (`PGRST205`) se toma como éxito: prueba que Supabase
  respondió y que la llave es válida.
- El cliente usa `persistSession: false` porque no hay login.

**Problemas encontrados / pendientes para la siguiente fase:**
- `create-next-app` muestra un aviso de que `eslint@9` ya no tiene soporte. No afecta; no se cambió.
- `EstadoConexion.tsx` es provisional: se puede borrar en la Fase 3 cuando `/` muestre la lista de visitas.
- Fase 2: los tipos de TypeScript irán en `src/lib/tipos.ts` y se pueden pasar al
  cliente (`createClient<Database>`) si se desea.

**Commit:** ver `git log` — `Fase 1: esqueleto del proyecto Next.js con cliente de Supabase`

