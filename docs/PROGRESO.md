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
| 6 | Ver fotos de una visita | ⬜ |
| 7 | Pulido móvil y despliegue | ⬜ |

Leyenda: ⬜ pendiente · 🟡 en curso / incompleta · ✅ terminada

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
