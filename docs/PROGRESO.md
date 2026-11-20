# PROGRESO

> Bitácora del proyecto. Cada agente, **al terminar su fase**, agrega una sección
> nueva **al final** usando la plantilla de abajo y actualiza la tabla de estado.
> El siguiente agente empieza en la primera fase que no tenga ✅.

## Estado

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Plan | ✅ |
| 1 | Esqueleto del proyecto | ✅ |
| 2 | Base de datos y Storage | ✅ |
| 3 | Lista de visitas y nueva visita | ✅ |
| 4 | Ubicación | ✅ |
| 5 | Subir fotos | ✅ |
| 6 | Ver fotos de una visita | ✅ |
| 7 | Pulido móvil y despliegue | ✅ |
| — | Ajuste visual (tema oscuro) | ✅ |

### Etapa 2 — Leer precios de las fotos (plan: `docs/PLAN_ETAPA2.md`)

| Fase | Tipo | Nombre | Estado |
|---|---|---|---|
| E2-0 | — | Plan (actualizado el 2026-11-20) | ✅ |
| E2-1 | 🧱 base | Ajuste de la Etapa 1: fechas y fotos | 🟡 código listo; faltan pasos del usuario (ver su sección) |
| E2-2 | 🧱 base | Base de datos de lecturas (solo estructura) | ⬜ |
| E2-3 | 🧱 base | Catálogo propio (tablas y carga) | ⬜ |
| E2-4 | 🧱 base | Equivalencias (estructura) y vista de comparación | ⬜ |
| E2-5 | 🤖 agentes | Leer una foto | ⬜ |
| E2-6 | 🤖 agentes | Lotes y guardado | ⬜ |
| E2-7 | 🤖 agentes | Método de equivalencias | ⬜ |
| E2-8 | 🤖 agentes | Corrida completa y consultas | ⬜ |
| E2-9 | 🤖 agentes | Evaluación (al final) | ⬜ |

Leyenda: ⬜ pendiente · 🟡 en curso / incompleta · ✅ terminada

> **Alcance actual: solo fases 🧱 base.** Las fases 🤖 agentes (y cualquier llamada a la
> API de Anthropic) **no empiezan sin que el usuario lo pida**. Al terminar E2-4, el agente
> se detiene y reporta. Ver `docs/PLAN_ETAPA2.md`, secciones 2.1 y 11.

### Permisos de datos

| Fecha | Quién autorizó | Qué se permite |
|---|---|---|
| 2026-11-20 | Responsable de los datos | (a) Cargar catálogo y promociones en Supabase. (b) Enviar a la API de Anthropic las **descripciones** de nuestros artículos, **sin precios**. (c) Enviar a la API las **fotos de anaqueles** de la competencia. **Regla: a la API NUNCA se envían precios propios** (ni datos de venta). |

## Pendientes y dudas abiertas

- [ ] **Lista de competidores definitiva.** La actual es provisional. Falta uno
      ("POR CONFIRMAR"). Se corrige editando `supabase/seed_competidores.sql` y
      volviéndolo a ejecutar en el SQL Editor (para renombrar, ver el comentario del archivo).
- [ ] **Markdown de referencia del jefe.** No está disponible todavía. Si llega,
      ponerlo en `docs/` y revisar si cambia algo del plan.
- [x] Confirmar los **nombres** de las variables de `.env.local` (Fase 1). Confirmado:
      `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. (Primero se
      confirmó `..._ANON_KEY` por error; se corrigió después de la Fase 1 y el PLAN ya está actualizado).
- [ ] **(Opcional) Ubicación obligatoria también en la base de datos.** Hoy solo la app la
      exige; `latitud`/`longitud` aceptan nulos porque hay visitas de la Fase 3 sin ubicación.
      Si se quiere, más adelante se puede agregar un `check` (por ejemplo, solo para visitas
      nuevas). No se hizo porque no lo pide el plan.
- [ ] **(Etapa 2, segunda iteración) Ubicación → plaza.** Las visitas guardan latitud y
      longitud, no plaza. Hay que definir cómo se traduce una ubicación a una plaza para
      poder aplicar nuestras promociones regionales (PLAN_ETAPA2 5.8).
- [ ] **(Etapa 2, fase de agentes) Método de equivalencias.** No está definido; se decide en
      E2-7 (PLAN_ETAPA2 5.7).
- [ ] **(Etapa 2, E2-1) Pasos del usuario para cerrar la fase:** ejecutar `002`, desplegar,
      probar en iPhone y Android, y **después** ejecutar `003` (ver la sección de E2-1).
- [ ] **(Etapa 2) Confirmar `articulos_competencia` y `piezas`** (PLAN_ETAPA2 sección 12).
      Se necesitan antes de E2-2.
- [ ] **(Etapa 2) Levantamiento de octubre de la consultora.** Aún no hay datos. Si llega,
      se agrega a la evaluación (E2-9) como muestra adicional.

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

---

## Fase 2 — Base de datos y Storage (2026-11-18)

**Qué se hizo:**
- SQL con las 3 tablas (`competidores`, `visitas`, `fotos`), permisos, RLS, el bucket
  `fotos` y sus reglas de Storage. Se puede ejecutar varias veces sin duplicar nada.
- SQL de competidores editable, con `on conflict (nombre) do update`.
- Tipos de TypeScript escritos a mano y conectados al cliente (`createClient<Database>`).
- El recuadro provisional de `/` ahora lista los competidores activos.

**Archivos creados o cambiados:**
- `supabase/001_esquema.sql` — tablas, índices, GRANTs, RLS, bucket y políticas de Storage
- `supabase/seed_competidores.sql` — lista de competidores (7, "POR CONFIRMAR" inactivo)
- `src/lib/tipos.ts` — tipos `Database`, `Competidor`, `Visita`, `NuevaVisita`, `Foto`,
  `NuevaFoto` y la constante `BUCKET_FOTOS`
- `src/lib/supabase.ts` — el cliente ahora usa los tipos
- `src/app/EstadoConexion.tsx` — muestra cuántos competidores activos hay y sus nombres

**Pasos que hizo el usuario a mano:**
- Ejecutó `001_esquema.sql` y luego `seed_competidores.sql` en Supabase → SQL Editor.
- Revisó en Table Editor las 3 tablas y los 7 competidores ("POR CONFIRMAR" con `activo = false`).
- Revisó en Storage el bucket `fotos`: público, límite de 5 MB y los 3 tipos de imagen.
- Abrió `http://localhost:3000` y vio "Competidores activos: 6".

**Cómo probarlo:**
1. `npm run dev` y abrir `http://localhost:3000`.
2. Debe salir el recuadro verde con "Competidores activos: 6" y sus nombres.

**Decisiones tomadas (y por qué):**
- **Permisos por columna al crear:** `anon` solo puede llenar ciertas columnas de
  `visitas` y `fotos`. No puede mandar `id` ni `created_at`, así que esa fecha siempre
  la pone el servidor (es el dato confiable).
- **Solo se crean visitas con un competidor activo** (regla RLS del insert).
- **`fotos.ruta` debe estar dentro de la carpeta de su visita** (constraint
  `fotos_ruta_en_su_visita`).
- **Storage:** solo se puede subir con la ruta `visitas/<uuid>/<uuid>.(jpg|jpeg|png|webp)`
  y solo si esa visita existe. No hay políticas de update ni delete, así que nadie
  puede reemplazar ni borrar fotos. Para la Fase 5: subir con `upsert: false` (el valor
  por defecto), porque `upsert` necesita permiso de update.
- **`anon` puede leer todos los competidores**, también los inactivos, para que las
  visitas viejas muestren su nombre. La app debe filtrar `activo = true` en el selector.
- **`latitud`/`longitud` aceptan nulos en la base de datos**, porque la Fase 3 crea visitas
  sin ubicación. La Fase 4 hace la ubicación obligatoria desde la app.

**Problemas encontrados / pendientes para la siguiente fase:**
- Fase 3: `EstadoConexion.tsx` sigue siendo provisional y se puede reemplazar por la
  lista de visitas. Para el insert, usar el tipo `NuevaVisita` y `.select("id").single()`
  para obtener el id y navegar a `/visitas/[id]`.

**Commit:** ver `git log` — `Fase 2: esquema de base de datos, Storage y tipos`

---

## Fase 3 — Lista de visitas y nueva visita (2026-11-18)

**Qué se hizo:**
- `/`: botón grande "Nueva visita" y lista de visitas (la más reciente primero) con
  competidor y fecha en hora de México. Cada visita abre su pantalla.
- `/visitas/nueva`: un botón grande por cada competidor **activo**, ordenados por `orden`.
  Al tocar uno se guarda en memoria `competidor_elegido_at`. "Guardar visita" hace el
  `insert` y lleva a `/visitas/[id]`. Mensajes de cargando, guardando y error con reintento.
- `/visitas/[id]`: competidor, fecha en que se guardó y fecha en que se eligió el
  competidor. Mensaje claro si la visita no existe.
- Se borró `EstadoConexion.tsx` (era provisional).

**Archivos creados o cambiados:**
- `src/app/page.tsx` — inicio con botón y lista
- `src/app/ListaVisitas.tsx` — lista de visitas (componente de cliente)
- `src/app/visitas/nueva/page.tsx` — pantalla de nueva visita
- `src/app/visitas/nueva/FormularioNuevaVisita.tsx` — selector de competidor y guardado
- `src/app/visitas/[id]/page.tsx` — pantalla de una visita (lee el `id` dentro de `<Suspense>`)
- `src/app/visitas/[id]/DetalleVisita.tsx` — lee y muestra la visita
- `src/lib/fechas.ts` — `formatearFecha()`: UTC → hora de México (`America/Mexico_City`)
- `src/app/EstadoConexion.tsx` — borrado

**Pasos que hizo el usuario a mano:**
- Probó el flujo con datos reales: creó una visita, la vio en la lista y en la tabla
  `visitas` de Supabase. Salió bien.

**Cómo probarlo:**
1. `npm run dev` y abrir `http://localhost:3000`.
2. Si no hay visitas, sale "Todavía no hay visitas".
3. Tocar "Nueva visita", elegir un competidor (se pone azul con ✓) y tocar "Guardar visita".
4. Debe abrir la pantalla de la visita con el competidor y las fechas.
5. "← Volver a la lista": la visita aparece arriba de todo.
6. En Supabase → Table Editor → `visitas` está la fila con `competidor_id`,
   `competidor_elegido_at` y `created_at` llenos (`latitud`/`longitud` vacías hasta la Fase 4).

**Decisiones tomadas (y por qué):**
- **Los datos se leen en componentes de cliente** (`useEffect`), como se decidió en la
  Fase 1, para que siempre salgan datos frescos sin pelear con el caché de `cacheComponents`.
- **`/visitas/[id]` lee `params` dentro de `<Suspense>`**, porque con `cacheComponents` el
  `id` solo se conoce al abrir la página (doc: `03-file-conventions/dynamic-routes.md`,
  "With Cache Components"). Sin eso, el build falla.
- **Competidores como botones grandes**, no como `<select>`: son pocos y se tocan mejor
  con el pulgar.
- **Si el id de la dirección no tiene forma de UUID**, se muestra "Esta visita no existe"
  sin consultar, porque Postgres daría un error técnico.
- **El número de fotos en la lista NO se agregó**: es de la Fase 6. Con la relación ya
  definida en los tipos, se puede pedir con `.select("..., fotos(count)")`.

**Problemas encontrados / pendientes para la siguiente fase:**
- Fase 4: la ubicación va en `FormularioNuevaVisita.tsx`. Agregar `latitud`, `longitud`,
  `precision_metros` y `ubicacion_at` al objeto `nueva`, y desactivar "Guardar visita"
  hasta tener ubicación. `DetalleVisita.tsx` puede mostrar la ubicación y el enlace al mapa.
- Fase 5: la zona de fotos reemplaza el texto "Aquí se podrán subir las fotos
  (próximamente)" en `DetalleVisita.tsx`.

**Commit:** ver `git log` — `Fase 3: lista y creación de visitas`

---

## Fase 4 — Ubicación (2026-11-18)

**Qué se hizo:**
- En `/visitas/nueva`, paso 2 "¿Dónde estás?" con el botón **"Guardar mi ubicación"**. Usa
  `navigator.geolocation.getCurrentPosition` con alta precisión (`enableHighAccuracy`),
  espera máxima de 20 s y sin reutilizar ubicaciones viejas (`maximumAge: 0`).
- Guarda `latitud`, `longitud`, `precision_metros` y `ubicacion_at` en el mismo `insert` de la visita.
- **"Guardar visita" queda desactivado** hasta tener competidor **y** ubicación. Un texto
  abajo dice qué falta.
- Al obtenerla, muestra "✅ Ubicación guardada (± 15 m)" y el enlace **"Ver en el mapa"**
  (Google Maps). Si la precisión es peor que 100 m, avisa que es poco exacta.
- Si falla, mensaje según el motivo (sin permiso, GPS no disponible, tardó mucho, no es
  https, navegador sin soporte), con pasos para activarla en **iPhone** y **Android**, y
  botón **"Volver a intentar"**.
- En `/visitas/[id]` se ve la precisión, la hora en que se guardó la ubicación y "Ver en el
  mapa". Las visitas viejas sin ubicación dicen "Sin ubicación".

**Archivos creados o cambiados:**
- `src/lib/ubicacion.ts` — `pedirUbicacion()`, `enlaceMapa()`, `formatearPrecision()` y el tipo `Ubicacion`
- `src/app/visitas/nueva/BotonUbicacion.tsx` — botón, estados y mensajes de ayuda
- `src/app/visitas/nueva/FormularioNuevaVisita.tsx` — usa el botón y manda la ubicación en el `insert`
- `src/app/visitas/nueva/page.tsx` — solo el comentario
- `src/app/visitas/[id]/DetalleVisita.tsx` — muestra la ubicación y el enlace al mapa

**Pasos que hizo el usuario a mano:**
- Probó el flujo: guardó una visita con ubicación, revisó el pin en Google Maps y la fila
  en `visitas` de Supabase. Salió bien.

**Cómo probarlo:**
1. `npm run dev` y abrir `http://localhost:3000` → "Nueva visita".
2. Elegir un competidor. "Guardar visita" sigue gris y dice "Primero guarda tu ubicación".
3. Tocar "📍 Guardar mi ubicación" y aceptar el permiso del navegador.
4. Sale "✅ Ubicación guardada (± N m)". "Ver en el mapa" abre Google Maps donde estás.
5. "Guardar visita" → la pantalla de la visita muestra la ubicación y "Ver en el mapa".
6. En Supabase → `visitas`: la fila nueva tiene `latitud`, `longitud`, `precision_metros`
   y `ubicacion_at` llenos.
7. Para probar el error: bloquear la ubicación del sitio en el navegador y volver a tocar
   el botón. Debe salir el mensaje con los pasos para iPhone y Android.
8. **En el celular:** la ubicación solo funciona en `https` o `localhost`. Si abres la app
   desde el celular con la IP de tu computadora (`http://192.168...`), saldrá el mensaje
   "No se puede pedir la ubicación en esta dirección". Eso es normal. La prueba real en
   celular es con el link de Vercel (Fase 7).

**Decisiones tomadas (y por qué):**
- **`ubicacion_at` es la hora del celular en que llegó la ubicación** (`new Date()`), no
  `pos.timestamp`, porque en algunos celulares ese valor viene desfasado.
- **No se cambió la base de datos.** Las columnas y los permisos ya existían desde la Fase 2.
  La ubicación es obligatoria desde la app (ver "Pendientes" si se quiere también en la BD).
- **Si se vuelve a pedir la ubicación y falla, se conserva la anterior** y se sigue
  mostrando, para no perder una ubicación buena por un reintento.
- **Enlace de mapa con la URL oficial de Google Maps** (`/maps/search/?api=1&query=lat,lon`).
  Abre la app de Maps si está instalada y, si no, la web.
- Aviso de "poco exacta" a partir de **100 m**. Es un valor elegido por el agente; se puede
  cambiar en `PRECISION_DUDOSA_METROS` (`src/lib/ubicacion.ts`).

**Problemas encontrados / pendientes para la siguiente fase:**
- Fase 5: la zona de fotos reemplaza el texto "Aquí se podrán subir las fotos
  (próximamente)" en `DetalleVisita.tsx`.

**Commit:** ver `git log` — `Fase 4: ubicación obligatoria al crear una visita`

---

## Fase 5 — Subir fotos (2026-11-18)

**Qué se hizo:**
- En `/visitas/[id]`, sección "Fotos" con una zona grande **"Toca para elegir fotos"**
  (`<input type="file" accept="image/*" multiple>`, **sin** `capture`: abre la galería, no la cámara).
- Cada foto se prepara antes de subirla (lado mayor de 2000 px, JPEG calidad 0.8):
  - JPEG, PNG y WebP → `browser-image-compression` (instalada con permiso del usuario).
  - HEIC/HEIF u otro formato → se convierte a JPEG con `<canvas>` (lo que trae el navegador).
    Si el navegador no la puede abrir, sale un mensaje en español con qué hacer (Android e
    iPhone) y **se siguen subiendo las demás**.
- Se suben **una por una** a `visitas/<visita_id>/<uuid>.jpg` y, por cada una, se hace el
  `insert` en `fotos` (`visita_id`, `ruta`, `nombre_original`, `tamano_bytes` ya comprimido).
- Progreso "⏳ Subiendo 3 de 12…", estado de cada foto (Reduciendo / Subiendo / Guardando /
  ✅ Subida / ❌ Error) y resumen al final. Cada foto con error de red o servidor tiene su
  botón **"Reintentar esta foto"**.
- Si se intenta cerrar o recargar la página mientras sube, el navegador pregunta antes.

**Archivos creados o cambiados:**
- `package.json`, `package-lock.json` — nueva dependencia `browser-image-compression` 2.0.2
- `src/lib/fotos.ts` — `prepararFoto()` (comprimir / convertir), `rutaFoto()`, `nuevoUuid()`,
  `mensajeErrorSubida()` y la clase `ErrorFoto`
- `src/app/visitas/[id]/SubirFotos.tsx` — zona de fotos, cola de subida, progreso y reintentos
- `src/app/visitas/[id]/DetalleVisita.tsx` — usa `SubirFotos` en lugar del texto "próximamente"

**Pasos que hizo el usuario a mano:**
- Aprobó instalar `browser-image-compression`.
- Probó la subida de fotos (incluida una HEIC de iPhone) y revisó Storage y la tabla `fotos`. Salió bien.

**Cómo probarlo:**
1. `npm run dev` y abrir una visita (desde la lista de `http://localhost:3000`).
2. Tocar "Toca para elegir fotos" y elegir varias. Debe salir "Subiendo N de M…" y luego
   "✅ Listo: M fotos subidas".
3. En Supabase → Storage → `fotos` → `visitas` → carpeta con el id de la visita: están los
   archivos, con nombres UUID y casi siempre de menos de 1 MB.
4. En Table Editor → `fotos`: una fila por foto, con su `ruta`, nombre original y tamaño.
5. **HEIC de iPhone:** subir una foto HEIC real (por ejemplo, pasada a la computadora por
   AirDrop, o desde el iPhone mismo) y revisar que en Storage queda como `.jpg`.
6. **Foto que no se puede convertir:** elegirla junto con otras (por ejemplo, una HEIC en
   Chrome de Windows/Android). Esa sale con ❌ y el mensaje de qué hacer; las demás se suben.
7. **Reintento:** quitar el internet (modo avión o DevTools → Network → Offline), elegir una
   foto: sale ❌ con "No hay conexión…". Volver a conectar y tocar "Reintentar esta foto".
8. **Desde el celular:** subir fotos sí funciona abriendo la app con la IP de la computadora
   (`http://192.168...:3000`), porque no necesita https. Ojo: crear la visita sí necesita
   ubicación, así que crea la visita en la computadora y ábrela en el celular.

**Decisiones tomadas (y por qué):**
- **`useWebWorker: false` en la librería.** Con `true`, la librería descarga su propio código
  desde `cdn.jsdelivr.net`; así todo sale de nuestra app. Comprimir en la pantalla principal
  tarda unos cientos de milisegundos por foto, aceptable porque se suben una por una.
- **Si la librería falla, se intenta con canvas** antes de marcar la foto con error.
- **La extensión sigue al tipo real del archivo** (`.jpg`, `.png` o `.webp`). Casi siempre es
  `.jpg`, pero la librería devuelve el archivo original si comprimirlo lo hace más pesado; la
  regla de Storage acepta los tres.
- **Fondo blanco al convertir con canvas**, porque JPEG no tiene transparencia (si no, queda negro).
- **El reintento sigue donde se quedó:** si el archivo ya se subió y solo falló el `insert`,
  no se vuelve a subir (con `upsert: false` daría "ya existe"). Si Storage responde "ya existe"
  o la tabla responde ruta repetida (`23505`), se toma como éxito de un intento anterior.
- **Errores de conversión no tienen botón de reintentar**, porque volver a intentar no cambia
  nada; el mensaje dice qué hacer.
- **`nuevoUuid()` con respaldo:** `crypto.randomUUID()` solo existe en https o `localhost`; en
  `http://192.168...` se arma el UUID con `crypto.getRandomValues()`.
- **No se agregó la galería ni el conteo de fotos**: son de la Fase 6.

**Problemas encontrados / pendientes para la siguiente fase:**
- Fase 6: para que las fotos nuevas aparezcan en la galería sin recargar, `SubirFotos` puede
  recibir una función (ej. `alSubir`) y llamarla después del `insert` en `subirUna()`. La URL
  pública de cada foto sale de `supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta)`.
- iPhone suele convertir HEIC a JPEG por sí mismo al elegir fotos con `accept="image/*"`; la
  conversión con canvas cubre los casos en que no lo hace (y Safari sí sabe abrir HEIC). En
  Chrome de Android/Windows, HEIC normalmente **no** se puede abrir: sale el mensaje de error.
  Si eso resulta común en la prueba real, se puede proponer una librería HEIC (con permiso).

**Commit:** ver `git log` — `Fase 5: subir fotos comprimidas a la carpeta de la visita`

---

## Fase 6 — Ver fotos de una visita (2026-11-18)

**Qué se hizo:**
- En `/visitas/[id]`, debajo de la zona de subir fotos, una **galería de miniaturas** (3 por
  fila, la más reciente primero) con el título "N fotos guardadas". Si no hay, dice
  "Esta visita todavía no tiene fotos". Mensajes de cargando y error con "Reintentar".
- Al tocar una miniatura se abre **grande en pantalla completa** (fondo negro), con
  "Foto 3 de 12", la fecha en que se subió y botones grandes **✕ Cerrar**, **← Anterior** y
  **Siguiente →**. En computadora también sirven Escape y las flechas del teclado.
- **Las fotos nuevas aparecen sin recargar:** cada vez que `SubirFotos` guarda una foto, la
  pasa a la galería y se ve de inmediato.
- En la lista `/`, cada visita muestra **"📷 N fotos"** (o "Sin fotos").

**Archivos creados o cambiados:**
- `src/app/visitas/[id]/FotosVisita.tsx` — **nuevo**. Sección "Fotos": lee las fotos de la
  visita y junta la subida con la galería
- `src/app/visitas/[id]/GaleriaFotos.tsx` — **nuevo**. Miniaturas y foto en grande (`<dialog>`)
- `src/app/visitas/[id]/SubirFotos.tsx` — nueva prop `alSubir`; el `insert` ahora devuelve la
  fila (`.select().single()`); el título "Fotos" pasó a `FotosVisita`
- `src/app/visitas/[id]/DetalleVisita.tsx` — usa `FotosVisita` en lugar de `SubirFotos`
- `src/app/ListaVisitas.tsx` — pide `fotos(count)` y muestra el número de fotos
- `src/lib/fotos.ts` — nueva función `urlFoto(ruta)` (URL pública de una foto)

**Pasos que hizo el usuario a mano:**
- Probó la galería, la foto en grande, la subida sin recargar y el conteo en la lista
  (ver "Cómo probarlo"). Salió bien.

**Cómo probarlo:**
1. `npm run dev` y abrir `http://localhost:3000`.
2. En la lista, cada visita dice "📷 N fotos" o "Sin fotos". El número debe coincidir con las
   filas de esa visita en Supabase → Table Editor → `fotos`.
3. Entrar a una visita **vieja** que ya tenga fotos (de la Fase 5): se ven las miniaturas.
4. Tocar una: se abre grande. Probar "Siguiente →", "← Anterior" y "✕ Cerrar".
5. En esa misma visita, tocar "Toca para elegir fotos" y elegir 2 o 3: cada una aparece en
   la galería en cuanto termina, **sin recargar**, y el título sube de número.
6. "← Volver a la lista": el número de fotos de esa visita ya está actualizado.
7. Abrir una visita sin fotos: dice "Esta visita todavía no tiene fotos".

**Decisiones tomadas (y por qué):**
- **`<img>` normal en lugar de `<Image>` de Next.js.** Las fotos ya están reducidas (~2000 px,
  casi siempre < 1 MB). `<Image>` obligaría a configurar el dominio de Supabase y usaría la
  optimización de imágenes de Vercel, que tiene un límite en el plan gratis. Se desactivó el
  aviso de ESLint `no-img-element` solo en `GaleriaFotos.tsx`, con un comentario.
- **Miniaturas con la misma foto, con `loading="lazy"`** (solo se descargan al verse en
  pantalla). Supabase puede generar miniaturas más ligeras ("Image Transformations"), pero
  es una función de pago; no hace falta por ahora. Si las visitas llegan a tener muchísimas
  fotos y la galería carga lento en datos móviles, se puede revisar.
- **Foto en grande con `<dialog>`**, que ya trae el navegador (sin librerías nuevas).
- **La foto abierta se recuerda por su id, no por su posición**, para que no cambie si llega
  una foto nueva mientras la estás viendo.
- **La fila nueva viene del mismo `insert`** (`.select().single()`), así no hay que volver a
  leer toda la lista por cada foto. Si el `insert` dice "ya existe" (un intento anterior la
  guardó), no trae la fila y entonces sí se vuelve a leer la lista.
- **El conteo usa `fotos(count)`** en la misma consulta de la lista: una sola consulta, sin
  cambiar la base de datos.

**Problemas encontrados / pendientes para la siguiente fase:**
- Fase 7: revisar en celulares reales que la foto en grande ocupe bien la pantalla
  (se usa `h-dvh`, el alto real visible, para que la barra del navegador no tape los botones).

**Commit:** ver `git log` — `Fase 6: galería de fotos y conteo en la lista`

---

## Fase 7 — Pulido móvil y despliegue (2026-11-18) — ✅ confirmada 2026-11-19

**App publicada:** https://levantamiento-precio.vercel.app/

**Qué se hizo:**
- **Siempre modo claro.** Antes, si el celular estaba en modo oscuro, el fondo se ponía negro
  pero las tarjetas seguían claras: títulos y textos grises casi no se leían. Ahora la app es
  clara siempre (`color-scheme: light`), que además se lee mejor al sol.
- **Fuente:** el texto ahora usa Geist (antes se descargaba pero Arial la tapaba). Se quitó
  Geist Mono, que no se usaba.
- **Ícono propio** (un "$" blanco sobre el azul de la app) para la pestaña y para "Agregar a
  pantalla de inicio" en iPhone. Se generan con `next/og`, que ya trae Next.js (sin librerías
  nuevas). Se borró el `favicon.ico` de la plantilla (el triángulo de Next.js).
- **Color de la barra del navegador** en el celular: el azul de la app (`themeColor`).
- **Noindex (pedido del usuario):** `<meta name="robots" content="noindex, nofollow">` en todas
  las páginas y el encabezado `X-Robots-Tag: noindex, nofollow` en todas las respuestas.
- Se revisaron las pantallas: botones grandes, una columna, mensajes de cargando / listo / error
  en todos los pasos. No hizo falta cambiar nada más.

**Archivos creados o cambiados:**
- `src/app/layout.tsx` — `robots` (noindex), `viewport.themeColor`, nombre corto para iPhone, solo fuente Geist
- `src/app/globals.css` — siempre modo claro y fuente Geist
- `next.config.ts` — encabezado `X-Robots-Tag` en todas las rutas
- `src/lib/icono.tsx` — **nuevo**. Dibujo del ícono
- `src/app/icon.tsx`, `src/app/apple-icon.tsx` — **nuevos**. Ícono de pestaña (64 px) y de iPhone (180 px)
- `src/app/favicon.ico` — borrado
- `docs/PLAN.md` — sección 8: decisión del noindex

**Pasos que hizo el usuario a mano:**
- Desplegó la app en Vercel: https://levantamiento-precio.vercel.app/
- Probó la app en un iPhone y un Android reales (2026-11-19): salió bien.

**Cómo probarlo:**
1. `npm run build` y `npx next start`; abrir `http://localhost:3000`.
2. La pestaña muestra el ícono azul con "$".
3. Ver el código de la página (clic derecho → "Ver código fuente") y buscar
   `noindex`: sale `<meta name="robots" content="noindex, nofollow"/>`.
4. En la terminal: `curl -I http://localhost:3000` → sale `X-Robots-Tag: noindex, nofollow`.
5. Poner el celular (o la computadora) en modo oscuro: la app se sigue viendo clara.
6. **Con el link de Vercel**, en un iPhone y un Android reales: crear visita → ubicación →
   subir fotos (incluida una HEIC en el iPhone) → ver fotos en grande.

**Decisiones tomadas (y por qué):**
- **Modo claro fijo** en lugar de diseñar un modo oscuro completo: menos código, y en la
  calle se lee mejor un fondo claro.
- **Noindex con meta + encabezado, sin `Disallow` en robots.txt:** si `robots.txt` bloquea, el
  buscador no entra, no ve el "noindex" y podría listar el link si alguien lo publica.
- **Las fotos no llevan el encabezado** porque las sirve Supabase (otro dominio). Sus links
  son UUID imposibles de adivinar y solo aparecen dentro de la app, que no se indexa.
- **Noindex no es seguridad:** cualquiera con el link puede usar la app (así lo pide el plan,
  sin login). Solo evita que salga en Google.

**Problemas encontrados / pendientes:**
- ~~Desplegar en Vercel y hacer la prueba en celulares reales.~~ Hecho el 2026-11-19: la
  prueba en iPhone y Android salió bien. Fase 7 cambiada a ✅.

**Commit:** ver `git log` — `Fase 7: pulido móvil, ícono y noindex`

---

## Ajuste visual — Tema oscuro negro, gris y rojo (2026-11-19) — ✅ aprobado por el usuario 2026-11-19

**Qué se hizo (solo visual, sin cambiar la lógica):**
- **La app ahora es siempre oscura**, aunque el celular esté en modo claro. Reemplaza el
  "siempre modo claro" de la Fase 7. Fondo negro, tarjetas gris oscuro, letras blancas y
  detalles en rojo.
- **Todos los colores están en un solo lugar:** el bloque `@theme` de `src/app/globals.css`.
  Cada `--color-xxx` crea clases de Tailwind (`bg-xxx`, `text-xxx`, `border-xxx`). Ahí mismo
  están las piezas que se repiten: cajas de mensaje (`caja-info`, `caja-error`, `caja-exito`,
  `caja-aviso`), botones (`boton-primario`, `boton-contorno`, `boton-gris`) y `enlace`.
- **Botones rojos** con texto blanco: "Nueva visita", "Guardar visita", "Guardar mi ubicación"
  y el competidor elegido. "Actualizar ubicación" lleva contorno rojo. "Reintentar", "Cerrar",
  "Anterior/Siguiente" son grises. Desactivados: gris oscuro con texto gris.
- **Errores distintos del rojo de marca:** recuadro con fondo rojizo muy oscuro, borde rojo
  claro, texto rosado claro e ícono de aviso (triángulo). Se quitaron los ❌. Éxito = borde
  verde; aviso = borde amarillo; "cargando" = caja gris.
- **Barra del navegador** en el celular: negra (`#0a0a0a`), y `color-scheme: dark`.
- **Ícono:** "$" blanco sobre el rojo de marca (antes azul).
- Se revisaron todas las pantallas y estados: lista (cargando, vacía, error, tarjetas), nueva
  visita (competidores, ubicación con éxito/aviso/errores, guardar), detalle (datos, no existe,
  error), zona de fotos (libre/ocupada, progreso, resumen, cada foto, reintentar) y galería.

**Paleta (ajustes respecto a la propuesta del usuario):**
- Se usó tal cual: fondo `#0A0A0A`, tarjetas `#1A1A1A`, bordes `#3F3F3F`, texto `#FFFFFF`,
  texto secundario `#A3A3A3`, rojo `#DC2626` y `#B91C1C` al presionar.
- **Enlaces ("Ver en el mapa", "← Volver a la lista") en `#F87171`** (rojo más claro): el
  `#DC2626` como texto sobre negro da contraste 4.1:1 y sobre tarjeta 3.6:1, menos del mínimo
  4.5:1. Con `#F87171` queda en 6.3–7.2:1.
- Colores agregados: tarjeta presionada `#262626`, botón gris `#3F3F3F` / `#525252`,
  desactivado `#262626`, y los de error / éxito / aviso.
- Contraste revisado de cada combinación de texto: todas ≥ 4.8:1 (blanco sobre rojo = 4.8:1).

**Archivos creados o cambiados:**
- `src/app/globals.css` — colores (`@theme`), `color-scheme: dark` y clases compartidas
- `src/lib/colores.ts` — **nuevo**. Copia de fondo y rojo para la barra y el ícono (no son CSS)
- `src/components/TituloError.tsx` — **nuevo**. Ícono de aviso + título de los errores
- `src/app/layout.tsx` — `themeColor` negro y `colorScheme: "dark"`
- `src/lib/icono.tsx` — ícono rojo
- `src/app/page.tsx`, `src/app/ListaVisitas.tsx`, `src/app/visitas/nueva/*.tsx`,
  `src/app/visitas/[id]/*.tsx` — solo clases de color y el ícono de error

**Cómo probarlo:**
1. `npm run dev` y abrir `http://localhost:3000`: fondo negro, tarjetas grises, botón rojo.
2. Poner el celular o la computadora en modo claro: la app sigue oscura.
3. Recorrer: nueva visita → elegir competidor (se pone rojo con ✓) → ubicación → guardar →
   subir fotos → ver foto en grande.
4. Errores: bloquear la ubicación o quitar el internet al subir una foto: recuadro con borde
   rojo claro y triángulo de aviso.
5. La pestaña muestra el ícono rojo con "$". En el celular, la barra del navegador es negra.

**Decisiones tomadas (y por qué):**
- **Tokens en `@theme` de Tailwind** en lugar de variables sueltas: así se usan como clases
  normales (`bg-tarjeta`) y quedan como variables CSS (`var(--color-tarjeta)`).
- **"Reintentar" en gris, no en rojo**, para que dentro de un recuadro de error no parezca
  otro error y el rojo quede para las acciones principales.
- **Ícono de error como SVG propio** (sin librerías nuevas) en lugar de emoji, para que tome
  el color del texto del error.
- La galería en grande usa el fondo de la app (`#0A0A0A`), casi negro puro.

**Commit:** ver `git log` — `Ajuste visual: tema oscuro negro, gris y rojo`

**Cambio pedido después (2026-11-19): fondo gris grafito en lugar de negro.**
- Fondo `#2A2A2A` (también la barra del navegador). Para que las tarjetas sigan viéndose
  más claras que el fondo, subieron también: tarjetas `#363636`, tarjeta presionada `#424242`,
  bordes `#5A5A5A`, botón gris `#4A4A4A` / `#5C5C5C` y desactivado `#333333`.
- Texto secundario `#B8B8B8` (antes `#A3A3A3`): sobre las tarjetas nuevas daba 4.8:1; ahora 6.1:1.
- Enlaces `#FCA5A5` (antes `#F87171`): sobre las tarjetas nuevas daba 4.4:1, menos del mínimo
  4.5:1; ahora 6.4:1. El borde de los errores pasó a `#F87171` para no ser igual a los enlaces.
- Fondos de error, éxito y aviso un poco más claros, para que combinen con el gris.
- Solo cambiaron `src/app/globals.css`, `src/lib/colores.ts` y un comentario de `layout.tsx`.
- **Commit:** `Ajuste visual: fondo gris grafito`

---

## Etapa 2 — Fase 0: Plan (2026-11-19)

**Qué se hizo:**
- `docs/PLAN_ETAPA2.md` no existía; con permiso del usuario se escribió desde cero con sus
  8 decisiones: API de Claude solo en servidor, inserción directa con la secret key, tabla
  cerrada a `anon`, estado/confianza/motivo por lectura, vista de análisis sin descartadas,
  estado de procesamiento por foto, una llamada por foto con JSON validado y lotes, disparador
  no público, fase de evaluación y riesgos.
- Nota en `PLAN.md` sección 6: excepción de la secret key solo para el servidor.

**Archivos creados o cambiados:**
- `docs/PLAN_ETAPA2.md` — plan de la Etapa 2 (nuevo)
- `docs/PLAN.md` — nota de la excepción en la sección 6
- `docs/PROGRESO.md` — tabla de estado de la Etapa 2 y esta sección

**Pasos que hizo el usuario a mano:**
- Ninguno todavía.

**Cómo probarlo:**
- No aplica (no hay código).

**Decisiones tomadas (y por qué):**
- Ver `PLAN_ETAPA2.md` secciones 2 y 12.

**Pendientes antes de la Fase E2-1:**
- [ ] Confirmar la opción A (script local) para disparar el proceso (PLAN_ETAPA2 sección 8).
- [ ] Permiso para instalar `@anthropic-ai/sdk` (se pide en la Fase E2-2).
- [ ] Confirmar los nombres `ANTHROPIC_API_KEY` y `SUPABASE_SECRET_KEY`.

**Commit:** ver `git log` — `Etapa 2, Fase 0: plan`

---

## Etapa 2 — Fase 0 (actualización): Plan ampliado (2026-11-19)

**Qué se hizo:**
- `docs/PLAN_ETAPA2.md` reescrito con el **objetivo final** (inteligencia de precios de la
  competencia: leer, comparar contra nuestro catálogo y analizar por competidor, zona y
  fecha) y las 9 decisiones nuevas del usuario.
- Tablas nuevas planeadas: `catalogo_propio`, `lecturas_precio` (con confianza por artículo,
  presentación y precio, y estados `propuesta` / `por_revisar` / `aprobada` / `corregida` /
  `descartada`), `equivalencias`, vista `comparacion_precios` normalizada por 100 g /
  100 ml / pieza con SQL. Propuestas del agente: `articulos_competencia`, columna `piezas`,
  historial de precios propios y `zonas`.
- Calidad y motivo por foto; no se reprocesan las fotos `procesada`.
- Revisión de la documentación vigente de visión: Sonnet 5.5 y Haiku 5.5 aprovechan hasta
  2576 px y 4 784 tokens por imagen; propuesta 2200 px, JPEG 0.85, sin tope de 1 MB. Guía de
  campo para fotografiar etiquetas.
- Nueva Fase E2-1 (ajuste de la Etapa 1): hora de captura (EXIF) en `fotos`, quitar
  `competidor_elegido_at`, con orden seguro para no romper la app publicada.
- Fases renumeradas (E2-1 a E2-8). Nota en `PLAN.md` sección 4.1.
- `.gitignore`: carpeta `/datos_privados/` para la lista de precios original.

**Archivos creados o cambiados:**
- `docs/PLAN_ETAPA2.md`, `docs/PLAN.md`, `docs/PROGRESO.md`, `.gitignore`

**Pasos que hizo el usuario a mano:**
- Ninguno.

**Cómo probarlo:**
- No aplica (no hay código). `git check-ignore datos_privados/x.csv` confirma que la carpeta
  está ignorada.

**Pendientes antes de la Fase E2-1:**
- [ ] Confirmar la opción A (script local) para disparar el proceso (sección 8).
- [ ] Decir qué columnas trae la lista de precios propia (Excel o CSV) — necesario antes de E2-3.
- [ ] Confirmar `articulos_competencia`, `piezas`, historial de precios y `zonas` (sección 12).
- [ ] Aprobar el cambio de tamaño de foto (2200 px / 0.85 / sin tope de 1 MB) y quitar
      `competidor_elegido_at` (cambian la app publicada).
- [ ] Confirmar los nombres `ANTHROPIC_API_KEY` y `SUPABASE_SECRET_KEY` (E2-2).

**Commit:** ver `git log` — `Etapa 2, Fase 0: plan ampliado (objetivo, catálogo, equivalencias)`

---

## Etapa 2 — Fase 0 (actualización 2): diseño con la lista de precios real (2026-11-20)

**Qué se hizo:**
- Se revisó el paquete de precios en `datos-privados/` (ignorado por git): `LEEME.md`,
  `diccionario.csv` y la estructura de cada CSV. **No se copió ningún dato real a los docs.**
- `docs/PLAN_ETAPA2.md`: nueva sección 5.6 (catálogo en 3 tablas: `catalogo_propio`,
  `catalogo_propio_cortes`, `promociones_propias`; vista `precio_propio_vigente`; script de
  importación todo-o-nada), 5.10 (estructura del paquete y problemas de calidad, sin datos)
  y 5.11 (resumen de tablas). `lecturas_precio` y `equivalencias` alineadas con el formato
  de la consultora (promoción por pieza calculada por SQL, `ean`, tipos de match, índices).
- Carpeta renombrada en el plan: `datos-privados/` (guion medio, la real).

**Archivos creados o cambiados:**
- `docs/PLAN_ETAPA2.md`, `docs/PROGRESO.md`

**Pasos que hizo el usuario a mano:**
- Colocó el paquete en `datos-privados/x24_precios_20261119/`.

**Cómo probarlo:**
- No aplica (no hay código). `git check-ignore -v datos-privados/x24_precios_20261119/LEEME.md`
  confirma que la carpeta está ignorada.

**Pendientes antes de la Fase E2-3:**
- [ ] ⛔ Confirmar que el acuerdo de confidencialidad del paquete permite subirlo a Supabase y
      mandar descripciones (sin precios) a Claude (PLAN_ETAPA2 sección 10).
- [ ] Confirmar: `clave` como llave, signo del índice, equivalencias por código aprobadas
      solas, tabla `zonas` con `plaza` (PLAN_ETAPA2 sección 12).
- [ ] Preguntar a la consultora si comparte su levantamiento anterior verificado (9.1).

**Commit:** ver `git log` — `Etapa 2, Fase 0: diseño del catálogo con la lista de precios real`

---

## Etapa 2 — Fase 0 (actualización 3): alcance base, permiso y decisiones (2026-11-20)

**Qué se hizo:**
- **Alcance:** las fases se separan en **🧱 base** (E2-1 a E2-4: ajustes de la Etapa 1,
  estructura de tablas, carga del catálogo, estructura de equivalencias y vista de
  comparación) y **🤖 agentes** (E2-5 a E2-9). Por ahora solo se construye la base, sin
  agentes ni llamadas a la API de Anthropic. Ninguna fase 🤖 empieza sin pedido explícito.
- **Permiso** del responsable de los datos registrado arriba (tabla "Permisos de datos").
  Se quitó el bloqueo ⛔ de E2-3. Regla explícita en el plan: **a la API nunca se envían
  precios propios**.
- **Índice:** columna `indice_vs_competencia_pct`, signo de la consultora (positivo =
  nosotros más caros), documentado en el plan y como `comment on column` en la vista.
- **Equivalencias:** se quitaron todas las reglas y pasos de códigos de barras (incluida la
  aprobación automática por código) y el procedimiento de propuesta. En la base solo queda
  la tabla con `tipo` (`mismo_articulo`, `otra_presentacion`, `sin_equivalente`) y `estado`
  (`propuesta`, `aprobada`, `rechazada`). El método se decide en E2-7.
- **Zonas:** no se crea la tabla. La comparación usa el precio regular (no depende de la
  zona); promociones regionales en una segunda iteración. Conteo: **7 tablas**.
- **Evaluación:** pasa al final (E2-9), con 20–30 fotos reales de la app verificadas a mano.
- **Calidad del catálogo:** reporte en `datos-privados/` al importar, sin correcciones
  silenciosas; en docs solo conteos.
- Fases renumeradas: la estructura de equivalencias y la vista pasan a E2-4 (base);
  leer una foto E2-5, lotes E2-6, método de equivalencias E2-7, corrida completa E2-8,
  evaluación E2-9.

**Archivos creados o cambiados:**
- `docs/PLAN_ETAPA2.md`, `docs/PROGRESO.md`

**Pasos que hizo el usuario a mano:**
- Obtuvo el permiso del responsable de los datos (2026-11-20).

**Cómo probarlo:**
- No aplica (no hay código ni cambios en Supabase). `git check-ignore` confirma que
  `datos-privados/` y `.env.local` siguen ignorados.

**Pendientes antes de la Fase E2-1:**
- [ ] Confirmar la opción A (script local) para disparar el proceso (PLAN_ETAPA2 sección 8).
- [ ] Aprobar el cambio de tamaño de foto (2200 px / 0.85 / sin tope de 1 MB) y quitar
      `competidor_elegido_at` (cambian la app publicada).
- [ ] Confirmar `clave` como llave de `catalogo_propio`, `articulos_competencia` y `piezas`
      (PLAN_ETAPA2 sección 12).

**Siguiente fase:** E2-1 (🧱 base).

**Commit:** ver `git log` — `Etapa 2, Fase 0: alcance base, permiso de datos y decisiones`

---

## Etapa 2 — Fase E2-1: Ajuste de la Etapa 1: fechas y fotos (2026-11-20) — 🟡 código listo

**Respuestas del usuario a los pendientes (2026-11-20):**
1. **Sí a la opción A (script local)** para disparar el proceso.
2. **Sí a quitar `competidor_elegido_at` y al nuevo tamaño de foto**, con condiciones: verificar
   el tamaño contra la documentación vigente de visión y justificarlo; solo para fotos nuevas;
   orden (a) código → (b) lint y build → (c) el usuario despliega y prueba → (d) **solo
   después** el usuario ejecuta la migración que borra la columna; migración en archivo nuevo.
3. **Sí a `clave` como llave** del catálogo, guardada **siempre como TEXTO**. Anotado en
   PLAN_ETAPA2 (decisión 18 y 5.6.1).

**Qué se hizo:**
- **`competidor_elegido_at` fuera de la app:** el formulario ya no la manda, la pantalla de la
  visita ya no la muestra y se quitó de `tipos.ts`. No hizo falta cambiar permisos: la app
  simplemente deja de mandarla; el permiso de `anon` sobre esa columna desaparece solo cuando
  se borre la columna (`003`).
- **Hora de captura:** lector propio de EXIF (`src/lib/exif.ts`, sin librerías). Lee
  `DateTimeOriginal` y `OffsetTimeOriginal` del archivo **antes** de comprimirlo. JPEG: lee
  el bloque EXIF del inicio; otros formatos (HEIC): busca la firma EXIF en el archivo. Si no
  encuentra nada → `sin_dato`. Nunca detiene la subida. **No hizo falta `exifr`** (por ahora).
- La foto en grande muestra **"Tomada …"** (si hay hora) además de "Subida …".
- **Tamaño de foto nuevo** (solo afecta a las que se suban desde ahora): 2200 px, JPEG 0.85,
  `maxSizeMB: 4` (antes 2000 px, 0.8, 1 MB). La ruta de HEIC con `<canvas>` usa las mismas
  constantes.
- **Migraciones nuevas** (no se tocaron los archivos viejos): `002` agrega las columnas;
  `003` borra `competidor_elegido_at`, con un **freno** que no borra nada si la visita más
  reciente todavía trae esa columna (señal de que la app publicada sigue siendo la vieja).

**Verificación del tamaño (documentación de visión, consultada el 2026-11-20):** alta
resolución = lado mayor ≤ 2576 px **y** ≤ 4 784 tokens (`⌈ancho/28⌉ × ⌈alto/28⌉`); si pasa
cualquiera, la API reduce otra vez. En 4:3 el límite real es **2212 px** (79 × 60 = 4 740
tokens; 2240 × 1680 ya da 4 800). **2200 × 1650 = 4 661 tokens** → se aprovecha completo sin
segunda reducción. Detalle en PLAN_ETAPA2 3.2 y 3.3.

**Archivos creados o cambiados:**
- `supabase/002_fotos_hora_captura.sql` — **nuevo**. `fotos.capturada_at`, `fotos.capturada_origen` (con `check`) y permiso de `insert` para `anon`
- `supabase/003_quitar_competidor_elegido_at.sql` — **nuevo**. Borra la columna (con freno). **No ejecutar todavía**
- `src/lib/exif.ts` — **nuevo**. `leerHoraCaptura(archivo)`
- `src/lib/tipos.ts` — sin `competidor_elegido_at`; `fotos` con `capturada_at` y `capturada_origen`
- `src/lib/fotos.ts` — 2200 px / 0.85 / 4 MB, con la justificación en un comentario
- `src/app/visitas/nueva/FormularioNuevaVisita.tsx` — ya no manda `competidor_elegido_at`
- `src/app/visitas/[id]/DetalleVisita.tsx` — ya no muestra "Competidor elegido"
- `src/app/visitas/[id]/SubirFotos.tsx` — lee la hora antes de comprimir y la manda en el `insert`
- `src/app/visitas/[id]/GaleriaFotos.tsx` — "Tomada …" en la foto grande
- `docs/PLAN.md` (4.1, 4.4, Fase 5), `docs/PLAN_ETAPA2.md` (2.1, 3.2, 3.3, 5.6.1, 8, 11, 12)

**Pasos que tiene que hacer el usuario (en este orden):**
1. Supabase → SQL Editor: ejecutar **`002_fotos_hora_captura.sql`**. La última consulta debe
   mostrar 2 filas con `anon_puede_insertar = true`. (Es seguro con la app vieja.)
2. Revisar el commit y hacer **push**. Esperar a que Vercel publique.
3. Con el link de Vercel: **guardar una visita nueva** (debe abrir su pantalla, ya sin
   "Competidor elegido"); subir fotos desde un **iPhone** y un **Android**; abrir una en
   grande y ver "Tomada …". Subir también una **captura de pantalla** (no debe decir "Tomada").
4. En Table Editor → `fotos`: las nuevas tienen `capturada_at` y `capturada_origen = exif` (o
   `exif_zona_celular`); la captura, `sin_dato`. En Storage, las nuevas miden 2200 px de lado mayor.
5. **Solo entonces**, (opcional) exportar la copia que trae comentada `003` y ejecutar
   **`003_quitar_competidor_elegido_at.sql`**. La última consulta debe devolver 0 filas.
6. Avisar al agente para marcar E2-1 como ✅.

**Cómo probarlo (local):**
1. `npm run lint` y `npm run build`: pasan (verificado).
2. El lector de EXIF se probó con archivos sintéticos: JPEG con zona (`exif`), sin zona
   (`exif_zona_celular`), big y little-endian, sin EXIF y fecha en ceros (`sin_dato`), firma
   EXIF dentro de un archivo tipo HEIC (`exif`) y basura (`sin_dato`). Todos correctos.
3. Local con `npm run dev` **después del paso 1**: si `002` no se ha ejecutado, subir fotos
   falla porque la columna no existe.

**Decisiones tomadas (y por qué):**
- **`002` va antes del push y `003` después:** `002` solo agrega (la app vieja no se entera);
  la app nueva necesita `002` para subir fotos; `003` borra algo que la app vieja aún manda.
- **Freno en `003`:** evita borrar la columna si por error se ejecuta antes de desplegar.
- **`check` en `002`:** `sin_dato` ⇔ sin hora, para que los dos campos no se contradigan.
- **Sin `File.lastModified`** como respaldo: no es la hora de la foto (PLAN_ETAPA2, E2-1).
- **Fechas absurdas** (año < 2000, "0000:00:00") se guardan como `sin_dato`. Las fechas raras
  pero posibles (ej. posteriores a la subida) se guardan y las marcará la vista (riesgos, 10).
- **HEIC con búsqueda de firma** en lugar de un lector completo: es pequeño y, en la práctica,
  iPhone entrega JPEG al elegir de la galería. Si en la prueba real las HEIC quedan
  `sin_dato`, se propone `exifr` con permiso.

**Problemas encontrados / pendientes:**
- ⚠️ Después de ejecutar `003`, `001_esquema.sql` **ya no se puede volver a ejecutar tal cual**
  (su `grant` nombra la columna borrada y el SQL Editor deshace todo el archivo). Anotado en
  PLAN.md 4.1.
- Falta la prueba real en iPhone y Android (paso 3) para confirmar el comportamiento de EXIF.
- Antes de E2-2: confirmar `articulos_competencia` y `piezas`.

**Commit:** ver `git log` — `Etapa 2, Fase E2-1: hora de captura, tamaño de foto y sin competidor_elegido_at`

