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
| — | Ajustes de la app: pantalla limpia, fotos 0.92 / 5 MB, tema claro | 🟡 falta prueba del usuario |
| — | Quitar fotos (descarte reversible) — fuera del plan original | ✅ (cerrada el 2026-11-23, ver su sección) |
| — | Autenticación y propiedad de visitas — fuera del plan original (reemplaza "sin login") | ✅ (cerrada el 2026-11-24: `008`, `008b` y `009` ejecutadas, pruebas ok; ver su sección) |
| — | Mensajes de error claros (red / sesión / Supabase) — fuera del plan original | 🟡 falta prueba del usuario y despliegue |
| — | Entrar con usuario (`<usuario>@x24.com.mx`) — fuera del plan original | 🟡 falta prueba del usuario y despliegue |
| — | Captura manual de datos con sugerencias (`010`) — fuera del plan original | 🟡 la prueba vieja dio `42P01`; correr la nueva `010b` (ver "Corrección de la prueba de 010"). La pantalla la reemplaza la captura rápida (`011`) |
| — | Captura rápida de productos (`011`) — fuera del plan original | 🟡 falta ejecutar; el orden completo está en "Editar y borrar lo capturado" |
| — | Editar y borrar lo capturado (`012`, `012b` por revisar) — fuera del plan original | 🟡 falta: `010` (si aún no) → `010b` → `011` → prueba `011` → `012` → prueba `012` → (`012b` si se aprueba) → push → prueba en el celular |
| — | Lista de visitas por día con conteos (solo app) — fuera del plan original | 🟡 falta publicar y probar en el celular |

### Etapa 2 — Leer precios de las fotos (plan: `docs/PLAN_ETAPA2.md`)

| Fase | Tipo | Nombre | Estado |
|---|---|---|---|
| E2-0 | — | Plan (actualizado el 2026-11-20) | ✅ |
| E2-1 | 🧱 base | Ajuste de la Etapa 1: fechas y fotos | ✅ |
| E2-2 | 🧱 base | Base de datos de lecturas (solo estructura) | ✅ |
| E2-3 | 🧱 base | Catálogo propio (tablas y carga) | ✅ |
| E2-4 | 🧱 base | Equivalencias (estructura) y vista de comparación | ✅ |
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
- [ ] **(Opcional) Ubicación obligatoria también en la base de datos.** Hoy solo la app la
      exige; `latitud`/`longitud` aceptan nulos porque hay visitas de la Fase 3 sin ubicación.
      Si se quiere, más adelante se puede agregar un `check` (por ejemplo, solo para visitas
      nuevas). No se hizo porque no lo pide el plan.
- [ ] **(Etapa 2, segunda iteración) Ubicación → plaza.** Las visitas guardan latitud y
      longitud, no plaza. Hay que definir cómo se traduce una ubicación a una plaza para
      poder aplicar nuestras promociones regionales (PLAN_ETAPA2 5.8).
- [ ] **(Etapa 2, fase de agentes) Método de equivalencias.** No está definido; se decide en
      E2-7 (PLAN_ETAPA2 5.7).
- [ ] **(Etapa 2, E2-9) Verificar el nivel de resolución de visión** de Sonnet 5.5 y Haiku 5.5.
      Se supuso alta resolución (2576 px / 4 784 tokens) porque la documentación dice "Claude
      4.7 y posteriores" sin nombrarlos. Se comprueba en la evaluación (PLAN_ETAPA2 3.2 y 9.2).
      Revisado otra vez el 2026-11-23: la documentación sigue igual (no los nombra).
- [ ] **(Etapa 2, E2-3) `.env.example` y secret key de Supabase:** agregar los nombres de
      PLAN_ETAPA2 4.1 y guiar al usuario para copiar la secret key a `.env.local`. Se pasó
      de E2-2 a E2-3 porque el usuario pidió no tocar llaves en E2-2.
- [ ] **(Etapa 2, E2-4) Confirmar con el responsable de los datos el umbral de `en_linea`**
      (hoy ±3 %: índice entre −3 y +3, PLAN_ETAPA2 5.9). Si cambia, se ajusta la vista
      `comparacion_precios` en una migración nueva.
- [ ] **(Autenticación, opcional) Registro de correcciones del admin.** Hoy
      `admin_cambiar_competidor` cambia la tienda sin dejar rastro de quién ni cuándo. Si hace
      falta auditar, se agregan columnas en un SQL nuevo.
- [ ] **(Punto de retención, pendiente) Limpieza de fotos descartadas.** Los archivos de las
      fotos quitadas **siguen en Storage**. Se borrarán en la limpieza del punto de retención
      (no hecha). Esos archivos **solo se borran con la API de Storage, nunca con SQL**.
- [ ] **(Etapa 2) Levantamiento de octubre de la consultora.** Aún no hay datos. Si llega,
      se agrega a la evaluación (E2-9) como muestra adicional.
- [ ] **(Captura manual / rápida / editar y borrar, 2026-11-25) Pasos del usuario:** seguir el
      **orden de despliegue** de "Editar y borrar lo capturado" (incluye `010`, `011` y `012`).
- [ ] **(Editar y borrar) Decidir si se ejecuta `012b`** (Etapa 2 ignora visitas borradas). No afecta
      a la app; conviene antes de cualquier fase 🤖.
- [ ] **(Editar y borrar, opcional) `admin_cambiar_competidor`** (008) ya no lo usa la app (el admin
      cambia la tienda con un update directo, `012`). Se puede dejar o quitar en una migración futura.
- [ ] **(Etapa 2, fases 🤖) Uso de `capturas_manuales`** para validación y evaluación: propuesta en
      PLAN_ETAPA2 9.5, **no decidida**. Regla ya fija: los agentes **no** ven estas filas al leer.

### Avisos permanentes (no son pendientes)

- ⚠️ **No volver a ejecutar `008_autenticacion.sql` después de `008b`:** regresa las reglas
  viejas con el ciclo ("infinite recursion" al guardar una visita). Si pasa, ejecutar `008b` otra vez.
- ⚠️ **No volver a ejecutar `001_esquema.sql` ni `007_descartar_fotos.sql` (después de `009`):**
  vuelven a crear permisos y reglas de `anon` (abrirían la base sin sesión). La comprobación final
  de `007` ya no sale toda `ok` después de `008`; es normal.
- **Deshacer `009` solo en emergencia:** `supabase/reversa_009.sql` devuelve a `anon` sus permisos
  y reglas y pone el bucket público. Para volver a cerrar: ejecutar `009` otra vez y su prueba.
  Ver la sección "Archivo de reversa de 009".
- **Convención de usuarios:** las cuentas del personal se crean en el panel de Supabase con el
  correo `<usuario>@x24.com.mx` (usuario de 3 a 30 caracteres: `a-z`, `0-9`, `.`, `_`, `-`, en
  minúsculas). En la app se entra solo con `<usuario>`. El dominio vive en
  `src/lib/usuarios.ts` (`DOMINIO_INTERNO`). Ver la sección "Entrar con usuario".
- **Comprobaciones y pruebas viejas después de `012`:** salen `false` (es normal, `012` lo cambia a
  propósito): en la comprobación de `008`, "authenticated: NO manda el dueño, solo cambia
  descartada_at…"; en la de `010`, filas 4 y 6; en la de `011`, filas 7 y 8. La prueba **`010b`**
  ya no arranca (su freno cuenta 3 reglas y ahora hay 4) y en la prueba **`011`** fallan los casos
  22 y 43; en la prueba **`008`**, el caso 9 ("C1 NO modifica su visita"). **No correr `010b` ni la
  prueba `011` después de `012`**; la prueba vigente es `pruebas/012_prueba_editar_borrar.sql`.
- **Borrar = descartar (desde `012`):** visitas, fotos y productos nunca se borran desde la app; se
  marcan con `descartada_at`. Para "recuperar" algo, el admin usa "Restaurar" en la app.
- **Comprobaciones viejas después de `011`:** la comprobación final de `010` marca `false` en la
  fila "14. Funciones de public…", porque `011` abre a propósito `articulos_captura()` a
  `authenticated`. La fila 13 de la comprobación de `011` revisa que el resto siga cerrado.
  La prueba **`010b`** describe el formulario anterior: se corre **antes** de `011`; después de
  `011` la prueba vigente es **`pruebas/011_prueba_captura_rapida.sql`** (ver "Captura rápida").
- **Comprobaciones viejas después de `010`:** al volver a correr la comprobación final de `009`,
  salen `false` "Etapa 2: ninguna tabla o vista abierta…" y "Etapa 2: ninguna función abierta…";
  en la de `008b`, "Las 5 funciones…" y "Las reglas usan las funciones…". Es **normal**: `010`
  abre a propósito `capturas_manuales`, `sugerencias_captura()` y dos funciones de `privado`. La
  comprobación final de `010` (filas 13 y 14) revisa que el resto de la Etapa 2 siga cerrado.
- ⚠️ **No borrar cuentas que ya tienen visitas.** `visitas.usuario_id` y `fotos.subida_por` usan
  `on delete set null`: al borrar la cuenta, sus visitas quedan **sin dueño** (solo las ve el
  admin y ya no se sabe quién las hizo). Para quitarle el acceso a alguien, bloquear la cuenta en
  lugar de borrarla. Ojo: **cambiar la contraseña no cierra** las sesiones ya abiertas en su
  celular (la sesión se renueva sola).

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

## Etapa 2 — Fase E2-1: Ajuste de la Etapa 1: fechas y fotos (2026-11-20) — ✅ confirmada 2026-11-20

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

**Cierre (2026-11-20), confirmado por el usuario:**
- Se ejecutaron `002_fotos_hora_captura.sql` y, después de desplegar y probar,
  `003_quitar_competidor_elegido_at.sql`.
- Guardar visitas y subir fotos funciona en **iPhone y Android** con la app publicada.
- Fase E2-1 cambiada a ✅.
- **Queda pendiente para la evaluación (E2-9):** verificar que Sonnet 5.5 y Haiku 5.5 usan el
  nivel de **alta resolución** de visión. El tamaño de 2200 px se calculó con ese supuesto;
  si resultara el nivel estándar, se revisa el tamaño (PLAN_ETAPA2 3.2, 3.3 y 9.2).

**Siguiente fase:** E2-2 (🧱 base). Antes: confirmar `articulos_competencia` y `piezas`.
**No se empieza sin que el usuario lo pida.**

---

## Etapa 2 — Fase E2-2: Tablas de la competencia (2026-11-20) — ✅ confirmada 2026-11-20

**Respuestas del usuario antes de diseñar (2026-11-20):**
1. **Sí a `articulos_competencia`** como tabla aparte (la equivalencia se aprueba una vez por artículo).
2. **Sí a la columna `piezas`** ("6 × 355 ml" → cantidad 355, ml, piezas 6).
3. **Precio = total de la etiqueta.** La base calcula el precio por pieza (columnas generadas).
4. **Unidades `g`, `kg`, `ml`, `l`, `pza`.** Se guarda como dice la etiqueta; la base convierte.

**Qué se hizo:**
- `supabase/004_tablas_competencia.sql` (archivo **nuevo**; los anteriores no se tocaron; se
  puede ejecutar varias veces):
  - Funciones de cálculo `normalizar_unidad_base`, `normalizar_contenido_base`,
    `normalizar_texto` y `clave_articulo_competencia` (las reusa E2-3).
  - Tablas `lotes_proceso`, `articulos_competencia` y `lecturas_precio`, **vacías**.
  - `fotos`: `estado_proceso` (las existentes quedan `pendiente`), `calidad`, `motivo_calidad`,
    `lote_id`, `intentos`, `error_proceso`, `procesada_at`.
  - `precio_regular_pieza` y `precio_promo_pieza` son **columnas generadas**: nadie las escribe.
  - Todos los valores acotados con `check` en la base (unidades, confianzas, estados, calidad,
    tipos y condiciones de promoción, estado de la foto y del lote).
  - `valores_agente` protegido con un *trigger*: no se puede cambiar.
  - Función `guardar_lecturas` (todo o nada; no duplica si la foto ya está `procesada`).
    Hoy nadie la llama.
  - Vista `lecturas_analisis` con `security_invoker = true`.
  - Permisos: RLS activado **sin políticas**; `revoke all` a `public`, `anon` y `authenticated`
    en tablas, vista, secuencia y funciones; solo `service_role` tiene permisos.
  - Bloque final de comprobación: permisos de anon, RLS, políticas, cascada y cálculos de ejemplo.
- `src/lib/tipos.ts`: columnas nuevas de `fotos` (solo lectura). La app no las usa: **sin cambio de comportamiento**.
- `src/lib/etapa2/tipos.ts` (**nuevo**): tipos de servidor de las tablas nuevas. Nadie los importa todavía.
- `docs/PLAN.md` (4.1, 4.4) y `docs/PLAN_ETAPA2.md` (5.0, 5.1, 5.4, 5.5, 11, 12) con las decisiones.

**Comportamiento al borrar (para datos de prueba en el Table Editor):**

| Si borras… | Pasa… | Por qué |
|---|---|---|
| Una visita | Se borran sus fotos (filas) y las lecturas de esas fotos (`cascade`) | Antes daba error; las fotos y lecturas no tienen sentido sin su visita |
| Una foto | Se borran sus lecturas (`cascade`) | Una lectura sin foto no se puede revisar |
| Un artículo de la competencia | Sus lecturas se quedan, con `articulo_competencia_id` vacío (`set null`) | La lectura sigue siendo válida; se puede volver a ligar |
| Un lote | Fotos y lecturas se quedan, con `lote_id` vacío (`set null`) | El lote es solo un registro del envío |
| Un competidor con visitas | **Error** (sin cambio respecto a la Etapa 1) | Para quitarlo se pone `activo = false` |

⚠️ Los **archivos** en Storage no se borran solos: se borran a mano en
Storage → `fotos` → `visitas/<id de la visita>/`. Un artículo de la competencia puede quedar sin
lecturas después de borrar fotos de prueba; no rompe nada (consulta para limpiarlos en "Cómo probarlo").

**Pasos que tiene que hacer el usuario:**
1. Supabase → SQL Editor: pegar **todo** `supabase/004_tablas_competencia.sql` y ejecutar (Run).
2. La última consulta muestra una tabla de comprobaciones: **todas** con `ok = true`.
3. Probar la app publicada: crear una visita y subir una foto (debe funcionar igual).
4. Avisar al agente para marcar E2-2 como ✅.

**Cómo probarlo:**
1. `npm run lint` y `npm run build`: pasan (verificado). No hay Postgres local: el SQL se valida al ejecutarlo en Supabase.
2. Table Editor → `fotos`: las fotos existentes tienen `estado_proceso = pendiente`.
3. (Opcional) Limpiar artículos sin lecturas: `delete from articulos_competencia a where not exists (select 1 from lecturas_precio l where l.articulo_competencia_id = a.id);`

**Decisiones tomadas (y por qué):**
- **Archivo `004_tablas_competencia.sql`** (nombre sugerido por el usuario) en vez de `004_etapa2_lecturas.sql`.
- **`precio_promo_pieza` como columna generada** en la tabla (antes iba en la vista), para que la
  base lo calcule siempre; lo que depende de la fecha de la foto (vigencia) queda en la vista
  como `promo_comparable`.
- **`precio` → `precio_regular`** para que quede claro que es el total de la etiqueta.
- **`estado` con default `por_revisar`:** si algo se guarda sin estado, queda para revisar.
- **`.env.example` y secret key pasan a E2-3** (el usuario pidió no tocar llaves).

**Problemas encontrados / pendientes:**
- Falta ejecutar `004` en Supabase.
- `anon` puede **leer** las columnas nuevas de `fotos` (la app lee la tabla completa). No son
  sensibles (estado, calidad, id de lote); no puede escribirlas.

**Commit:** ver `git log` — `Etapa 2, Fase E2-2: tablas de la competencia (004)`

**Cierre (2026-11-20), confirmado por el usuario:**
- Se ejecutó `004_tablas_competencia.sql`; todas las filas de la comprobación dieron `ok = true`.
- El usuario verificó por su cuenta RLS y permisos de `anon` en las tablas nuevas.
- La app publicada funciona igual: crear visita, subir foto y ver fotos antiguas.
- Fase E2-2 cambiada a ✅.

**Siguiente fase:** E2-3 (🧱 base). **No se empieza sin que el usuario lo pida.**

---

## Etapa 2 — Fase E2-3: Catálogo propio (2026-11-20) — ✅ confirmada 2026-11-20

**Respuestas del usuario antes de diseñar (2026-11-20):**
1. **Columnas:** se cargan solo las necesarias. **Ningún dato de venta** en Supabase (ni
   `venta_12m_sin_impuestos`; la ponderación queda pendiente de confirmar el permiso). Fuera:
   mayoreo, impuestos, `piezas_12m`, resúmenes de promoción, `precio_normal_registrado`,
   `descuento_pct`, `piezas_vendidas_promo`, `importe_vendido_promo`, `fecha_ultima_venta` y
   `clave_es_ean`. (PLAN_ETAPA2 decisiones 20 y 21.)
2. **Activo** = en el corte más reciente, no obsoleto, no de baja, no servicio, precio > 0 (decisión 22).
3. Corte viejo no pisa datos del artículo; reimportar reemplaza el corte; artículos nunca se
   borran; contenido `manual` intacto; solo `--confirmar` escribe (decisión 23).
4. Todo o nada **dentro de una función de la base**; solo la llave secreta puede ejecutarla.
5. `SUPABASE_SECRET_KEY` ya existe en `.env.local` (el agente no la lee); solo el nombre en `.env.example`.
6. Lector de CSV propio, sin librerías, con pruebas de datos **inventados**.
7. Clave vacía o con espacios → se detiene.

**Qué se hizo:**
- `supabase/005_catalogo_propio.sql` (nuevo; se puede ejecutar varias veces):
  `catalogo_propio`, `catalogo_propio_cortes`, `promociones_propias`, función
  `precio_propio_vigente(clave, fecha)`, vista `catalogo_propio_actual` (con `activo`), función
  `importar_corte(fecha, articulos, promociones, simular)` y permisos (RLS sin políticas,
  `revoke` a `anon`/`authenticated`, solo `service_role`). Bloque final de comprobación.
- `src/lib/etapa2/csv.ts`: lector de CSV sin librería (BOM, CRLF, comas y saltos de línea
  dentro de comillas, comillas escapadas). Todo sale como texto.
- `src/lib/etapa2/catalogo.ts`: validación del paquete (formato → detiene; calidad → reporte).
- `scripts/etapa2/importar-catalogo.ts` + `npm run catalogo:importar`.
- Pruebas `npm run test:etapa2` (14, solo datos inventados): lector de CSV y validación.
- `tsconfig.json`: `allowImportingTsExtensions` (Node corre TypeScript y exige `.ts` en los imports).
- `.env.example`: nombre `SUPABASE_SECRET_KEY` sin valor.
- `docs/PLAN_ETAPA2.md`: decisiones 20–23, 4.1, 5.6.1–5.6.5, 5.9 y 5.10.4.

**Cómo se garantiza "todo o nada":** el script manda **todo el corte en una sola llamada** a
`importar_corte`; una función llamada por la API corre en una sola transacción y cualquier
error la deshace completa. Al final de la función se comprueban conteos y
`precio_propio_vigente` por artículo; si algo no cuadra, lanza error → se deshace todo. El
corte actual pesa ~1.8 MB; el script se detiene si pasa de 5 MB (qué hacer en ese caso:
PLAN_ETAPA2 5.6.5, tablas de preparación + una función que aplica todo).

**Revisión del archivo (`--sin-conexion`, solo conteos):**

| Concepto | Conteo |
|---|---|
| Artículos en el archivo / listos para cargar | 3116 / 3116 |
| Renglones de promoción / listos para cargar | 1344 / 1344 |
| Errores de formato | 0 |
| Artículos sin contenido (`sin_dato`) | 802 |
| `mayoreo_mayor_o_igual_al_regular` | 70 |
| `decimales_de_mas` | 65 |
| `promo_pieza_mayor_o_igual_al_regular` | 17 |
| `descuento_negativo` | 12 |
| `descripcion_repetida` (renglones) | 8 |
| `precio_regular_cero_o_negativo` | 2 |
| `promocion_sin_articulo` | 2 |
| `sin_impuestos_no_cuadra`, `promo_grupo_no_cuadra`, `fecha_inicio_posterior_a_fin` | 0 |

Coinciden con las magnitudes de PLAN_ETAPA2 5.10.4. Nuevo: **decimales de más** (antes se
creía que no había precios con más de 2 decimales). Detalle por fila solo en
`datos-privados/reporte_calidad_<fecha>.csv` y `datos-privados/revision_contenido_<fecha>.csv`.

**Decisiones tomadas (y por qué):**
- **Precios de promoción, `precio_regular_al_inicio` y contenido como `numeric` sin límite:**
  con `numeric(10,2)` la base redondearía en silencio. Se guardan exactos y se reportan.
  `precio_regular` (el que se compara) sigue en `numeric(10,2)`: si trae más decimales, se
  detiene (en el script y en la función).
- **`importar_corte` con `p_simular` (default `true`):** la simulación usa el mismo código que
  la importación, así los conteos de insertar/actualizar/borrar son los reales.
- **Índice único con `nulls not distinct`** en vez de `coalesce(..., 0)`: sin inventar un 0.
- **`precio_propio_vigente` como función** (recibe clave y fecha).
- **Comprobación de anon:** solo cuenta como cerrado el error "permiso denegado" (42501); si
  anon recibe cualquier otra respuesta, el script se detiene.
- **Mensajes de error sin datos:** nunca se imprimen `details`/`hint` de Postgres.

**Pasos que tiene que hacer el usuario:**
1. Supabase → SQL Editor: pegar **todo** `supabase/005_catalogo_propio.sql` y ejecutar (Run).
   La última consulta debe dar **todas** las filas con `ok = true`.
2. Simulación: `npm run catalogo:importar -- datos-privados/x24_precios_20261119`.
   Revisar: project ref correcto, comprobación de anon con ✔, conteos.
3. Importación real: lo mismo con `--confirmar`.
4. Correrla otra vez con `--confirmar`: debe decir "borrar 3116 / insertar 3116" en cortes
   (reemplaza, no duplica) y los conteos finales iguales.
5. Avisar al agente para marcar E2-3 como ✅.

**Cómo probarlo:**
1. `npm run test:etapa2`, `npm run lint` y `npm run build`: pasan (verificado).
2. `node scripts/etapa2/importar-catalogo.ts datos-privados/<carpeta> --sin-conexion`: verificado (tabla de arriba).
3. No hay Postgres local: el SQL se valida al ejecutarlo en Supabase.

**Problemas encontrados / pendientes:**
- Falta ejecutar `005` y la importación (las hace el usuario).
- Ponderación por venta: pendiente del permiso (decisión 20).
- Node muestra un aviso `MODULE_TYPELESS_PACKAGE_JSON` al correr los scripts (no afecta). No
  se agregó `"type": "module"` a `package.json` para no arriesgar la app.

**Commit:** ver `git log` — `Etapa 2, Fase E2-3: catálogo propio (005) e importador en simulación`

**Cierre (2026-11-20), confirmado por el usuario:**
- El usuario aprobó guardar exactos los valores con decimales de más. Tipos: `cantidad`,
  `precio_promo_pieza`, `precio_promo_grupo`, `precio_promo_total` y
  `precio_regular_al_inicio` son **`numeric`** (decimal exacto, sin límite), **no** `float` /
  `real` / `double precision` (que redondean en binario); `precio_regular` es `numeric(10,2)`.
  El script manda esos valores como texto, así que llegan exactos a la base.
- Se ejecutó `005_catalogo_propio.sql`: todas las comprobaciones de seguridad con `ok = true`.
- Importación real hecha: conteos iguales al archivo (3116 artículos, 3116 precios del corte,
  1344 promociones). La segunda importación **no duplicó**.
- La app publicada funciona igual.
- Fase E2-3 cambiada a ✅.

**Siguiente fase:** E2-4 (🧱 base). **No se empieza sin que el usuario lo pida.**

---

## Etapa 2 — Fase E2-4: Equivalencias y vista de comparación (2026-11-20) — ✅ confirmada 2026-11-20

**Respuestas del usuario antes de diseñar (2026-11-20; decisión 24 de PLAN_ETAPA2):**
1. Filas que no se pueden comparar (precio regular en 0 o vacío, de cualquier lado): **no aparecen**.
2. Artículos nuestros no activos (servicio, obsoleto, de baja, fuera del último corte): **se excluyen**.
3. `otra_presentacion`: **un solo índice**, calculado por 100 g / 100 ml / pieza
   (`mismo_articulo`: precio total contra precio total). La columna `base_indice` dice cuál.
4. Al borrar un artículo nuestro o de la competencia con equivalencias: **no se deja borrar**
   (`on delete restrict`).
5. `otra_presentacion` sin contenido o con unidades distintas: **no aparece**.
   (`mismo_articulo` sin contenido sí aparece: índice calculado, precio por unidad vacío y
   `motivo_sin_precio_unidad`.)

**Qué se hizo:**
- `supabase/006_equivalencias_comparacion.sql` (nuevo; se puede ejecutar varias veces):
  - Tabla `equivalencias` (solo estructura): `tipo` y `estado` con `check`; `clave_propia`
    texto, vacía **solo** en `sin_equivalente` (`check`); índice único parcial "una aprobada
    por artículo"; `on delete restrict` en las dos llaves; *trigger* de `actualizado_at`.
    **Sin** lógica de llenado.
  - Vista `comparacion_precios` (`security_invoker`): una fila por lectura
    (`propuesta`/`aprobada`/`corregida`) con equivalencia aprobada; nuestro precio con
    `precio_propio_vigente` en la fecha de la foto (hora de México);
    `indice_vs_competencia_pct` con `comment on column` (positivo = nosotros más caros),
    `en_linea`, `entra_a_promedios`, precios por unidad y `motivo_sin_precio_unidad`.
    Divisiones protegidas con filtro + `nullif`.
  - Permisos: RLS sin políticas en `equivalencias`; `revoke` a `anon`/`authenticated` en la
    tabla, la vista, la secuencia y la función del *trigger*; solo `service_role`.
  - Comprobación final (solo lee), incluida la de que `anon` no puede leer nada de lo que
    hay debajo de la vista.
- `supabase/pruebas/006_prueba_comparacion.sql`: prueba con **datos inventados** (20
  comprobaciones: caso normal +10, precio propio en 0, sin contenido, no aprobada, otra
  presentación +10, sin equivalente, `por_revisar`, de baja, competencia en 0, unidades
  distintas, `check` de tipo/estado/clave, dos aprobadas, borrado bloqueado, comentario del
  signo). Termina con `rollback`; si algo falla, se detiene con error y tampoco guarda nada.
- `src/lib/etapa2/tipos.ts`: tipos `Equivalencia` y `ComparacionPrecio` (solo servidor; la
  app no cambia).
- `docs/PLAN_ETAPA2.md`: decisión 24, 5.7 y 5.9.

**Por qué `security_invoker` y además `revoke`:** con `security_invoker = true` la vista lee
las tablas con los permisos de **quien consulta**, no del dueño; así no puede "abrir"
`lecturas_precio`, `catalogo_propio`, etc. El `revoke` cierra la vista misma. Son dos
candados: si uno se quitara por error, el otro sigue.

**Pasos que tiene que hacer el usuario:**
1. Supabase → SQL Editor: pegar **todo** `supabase/006_equivalencias_comparacion.sql` y
   ejecutar. La última consulta debe dar **todas** las filas con `ok = true`.
2. Pegar **todo** `supabase/pruebas/006_prueba_comparacion.sql` y ejecutar. Debe mostrar la
   tabla con `ok = true` en todas las filas (o "Success. No rows returned" si el editor solo
   muestra el último comando); si algo falla, sale un error "PRUEBA FALLÓ: …" con el caso.
3. Avisar al agente para marcar E2-4 como ✅.

**Cómo probarlo:** `npm run lint`, `npm run build` y `npm run test:etapa2` pasan
(verificado). No hay Postgres local: el SQL se valida al ejecutarlo en Supabase.

**Commit:** ver `git log` — `Etapa 2, Fase E2-4: equivalencias y vista de comparación (006)`

**Cierre (2026-11-20), confirmado por el usuario:**
- Se ejecutó `006_equivalencias_comparacion.sql`: todas las filas de la comprobación con
  `ok = true`.
- Se ejecutó la prueba `pruebas/006_prueba_comparacion.sql` (datos inventados): todas las
  filas con `ok = true`.
- Los conteos del catálogo siguen iguales.
- `anon` no tiene permisos sobre `equivalencias` ni sobre `comparacion_precios`.
- La app publicada funciona igual.
- Fase E2-4 cambiada a ✅.

**Pendiente:** confirmar con el responsable de los datos el umbral de ±3 % de `en_linea`
(ver "Pendientes y dudas abiertas").

**Siguiente:** con E2-4 termina la base. Las fases 🤖 **no empiezan sin que el usuario lo pida**.

---

## Ajustes de la app: pantalla limpia, menos compresión y tema claro (2026-11-23) — 🟡 falta prueba del usuario

Pedido del usuario: solo estos tres cambios. **No** se tocaron tablas, **no** se ejecutó nada
en Supabase, **no** se empezaron fases 🤖 ni se llamó a la API de Anthropic.

**1. Pantalla limpia al navegar**
- **Causa:** `next.config.ts` tiene `cacheComponents: true`. Con eso, Next.js 16 **no
  desmonta** la pantalla de la que sales: la esconde con `<Activity>` de React y guarda su
  estado (hasta 3 pantallas). Al volver, aparece tal como se dejó: el formulario con la
  tienda y la ubicación de la visita anterior (y el botón en "Guardando…"), y la lista con
  los datos de antes mientras llega la consulta nueva. (Doc:
  `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`.) Además, en el
  detalle, si la misma pantalla recibía otra visita, `FotosVisita` juntaba las fotos nuevas
  con las que ya tenía en pantalla.
- **Solución:** `src/components/ReiniciarAlSalir.tsx` (nuevo). Cuando Next esconde la
  pantalla, cambia la `key` de lo que tiene adentro y React lo crea de nuevo, vacío. Se usa
  en la lista (`src/app/page.tsx`) y en el formulario (`src/app/visitas/nueva/page.tsx`):
  al volver, la lista vuelve a leer Supabase (dice "Cargando visitas…") y "Nueva visita"
  empieza sin tienda ni ubicación. Una respuesta que llegue tarde (por ejemplo, el GPS) cae
  en la copia vieja y se ignora.
- En el detalle (`src/app/visitas/[id]/page.tsx`): `key={id}`, así cada visita tiene su
  propia pantalla y nunca muestra fotos ni subidas de otra. El detalle **no** se reinicia al
  salir, para no perder de vista una subida en curso (los datos se vuelven a leer al regresar).
- No se usó `bfcacheId` porque la doc de Next lo deja como último recurso.

**2. Menos compresión (solo fotos nuevas)**
- `src/lib/fotos.ts`: calidad JPEG **0.92** (antes 0.85), lado mayor **2200 px** (igual), tope
  **5 MB** (el del bucket; antes 4 MB). Si pasa de 5 MB, baja la calidad por pasos (0.88,
  0.84 … 0.60) hasta que quepa; nunca reduce la resolución. Todas las fotos pasan por `<canvas>`.
- Se quitó la dependencia `browser-image-compression` (`package.json`, `package-lock.json`):
  al pasar del tope, también achicaba la foto un 5 % por vuelta.
- Documentación de visión revisada el 2026-11-23: alta resolución = 2 576 px y 4 784 tokens
  para "Claude 4.7 y posteriores"; 2200 × 1650 = 4 661 tokens, así que **2200 px sigue siendo
  el tamaño útil**. Sonnet 5.5 y Haiku 5.5 **no se nombran**; por esa regla estarían en alta
  resolución, pero sigue pendiente comprobarlo en E2-9. Detalle en PLAN_ETAPA2 3.3.

**3. Tema claro**
- `src/app/globals.css` (paleta central), `src/lib/colores.ts` y `src/app/layout.tsx`: fondo
  blanco, texto negro, tarjetas gris muy claro con borde gris, botones principales rojo de marca
  con texto blanco, enlaces rojo oscuro subrayados, `color-scheme: light`, barra del navegador
  blanca. El botón gris ahora lleva borde para que se vea sobre el blanco.
- **Errores:** caja rosada con borde y texto **vino** (`#9f1239` / `#881337`), ícono de alerta y
  "Error:" para lectores de pantalla. Distinto del rojo de marca en tono y en forma (caja
  clara con borde vs. botón rojo lleno con letras blancas).
- **Contraste revisado** con un script (fórmula WCAG) en todas las combinaciones que usa la
  app, incluidos los estados tocado, desactivado, error, éxito, aviso y el visor de fotos:
  todo texto ≥ 4.5:1 (el más bajo: blanco sobre rojo de marca, 4.83:1) y bordes ≥ 3:1 (el
  más bajo: borde gris sobre tarjeta, 3.17:1).
- El ícono de la app no cambia (signo blanco sobre rojo).

**Cómo probarlo:**
1. `npm run lint` y `npm run build`: pasan (verificado).
2. **No probado en navegador** (no se corrió la app para no consultar Supabase). Pasos para el
   usuario después de desplegar:
   - Crear una visita, subir fotos, tocar "← Volver a la lista": la visita nueva aparece con
     su número de fotos.
   - Tocar "+ Nueva visita": sin tienda elegida, sin ubicación y el botón dice "Guardar visita".
   - Subir una foto grande: se sube; en Supabase Storage pesa menos de 5 MB.
   - Revisar todas las pantallas con el celular en modo oscuro y en modo claro: siempre fondo
     blanco y letras negras; un error (por ejemplo, negar la ubicación) se ve en caja vino.

**Commit:** ver `git log` — `Ajustes de la app: pantalla limpia, fotos 0.92 / 5 MB y tema claro`

---

## Quitar fotos (descarte reversible) (2026-11-23) — 🟡 falta que el usuario ejecute `007`, la prueba y despliegue

Fase nueva, **fuera del plan original**, pedida por el usuario. **No** se ejecutó nada en
Supabase, **no** se empezaron fases 🤖 ni se llamó a la API de Anthropic.

**Decisión del usuario:** cualquiera con el link puede quitar fotos de una visita, sin clave y
sin ventana de tiempo. Pero es un **descarte reversible** (*soft delete*: la fila se marca, no
se borra), no un borrado físico.

**Qué se hizo:**
- `supabase/007_descartar_fotos.sql` (nuevo; se puede ejecutar varias veces):
  - Columna `fotos.descartada_at timestamptz` (vacía = a la vista).
  - *Trigger* `fotos_poner_hora_descarte`: si alguien pone `descartada_at`, se guarda
    **siempre** `now()` del servidor, no la hora que mande el celular. Ponerla en null
    (restaurar) solo lo puede hacer el equipo desde el SQL Editor.
  - Permisos: se quita a `anon` y `authenticated` todo UPDATE, DELETE y TRUNCATE de `fotos`, y
    se da a `anon` UPDATE **solo de la columna** `descartada_at`.
  - Regla RLS `anon descarta fotos pendientes`: solo filas `estado_proceso = 'pendiente'` y
    `descartada_at is null`; la fila debe quedar con `descartada_at` **no nulo** (no puede
    restaurar ni cambiar la hora de una ya quitada).
  - Vistas `lecturas_analisis` (004) y `comparacion_precios` (006) recreadas **iguales**, con
    una sola línea nueva cada una: `and f.descartada_at is null`.
  - Revisado sin cambios: `guardar_lecturas` (no elige fotos; anon solo quita fotos pendientes,
    que no tienen lecturas; si el equipo quitara a mano una procesada, sus lecturas se quedan
    pero las vistas no las muestran, y regresan si se restaura). `catalogo_propio_actual` y
    `precio_propio_vigente` no usan fotos. El proceso que **elige** fotos para un lote aún no
    existe (E2-6): se anotó en PLAN_ETAPA2 sección 7 que debe excluir las descartadas y tomar
    las fotos con un solo `update … returning` para que no haya carrera.
  - Comprobación final (solo lee): 19 filas `ok`.
- `supabase/pruebas/007_prueba_descartar_fotos.sql`: prueba con datos inventados, como `anon`
  (`set local role anon`). 15 casos: (a) descarta una pendiente con hora del servidor aunque
  mande una falsa; (b) no descarta `en_lote`, `procesada` ni `error`; (c) no restaura, no
  cambia la hora de una ya quitada, no pone null; (d) no modifica `estado_proceso` ni `ruta`;
  (e) no borra; (f) las dos vistas ignoran la descartada; (g) no crea una foto ya descartada;
  (h) el equipo sí restaura y la foto regresa a las vistas. Cada caso atrapa su error, así que
  **siempre** muestra la tabla con una fila `0. RESUMEN` y **siempre** termina con `rollback`.
- App:
  - `src/app/visitas/[id]/GaleriaFotos.tsx`: botón **"Quitar"** debajo de cada foto
    (*reemplazado en el ajuste siguiente: botón ✕ arriba a la derecha, sin "Deshacer"*).
  - `src/app/visitas/[id]/ConfirmarQuitar.tsx` (nuevo): ventana "¿Quitar esta foto?".
  - `src/app/visitas/[id]/FotosVisita.tsx`: al confirmar, la foto se esconde y abajo sale
    **"Foto quitada. Deshacer"** por 5 segundos. Al terminar ese tiempo se guarda el descarte;
    si toca "Deshacer", no se guarda nada. Si la foto ya no está pendiente, se explica en
    español por qué no se puede (antes de confirmar, o al guardar si cambió mientras tanto) y la
    foto vuelve. Si sale de la pantalla antes de los 5 s, el descarte se guarda en ese momento;
    si cierra o recarga la pestaña, el navegador pregunta antes (y si se va, no se quita).
    Solo se leen fotos con `descartada_at` vacío.
  - `src/app/ListaVisitas.tsx`: el número de fotos no cuenta las quitadas
    (`fotos(count)` + filtro `fotos.descartada_at is null`).
  - `src/lib/tipos.ts`: `descartada_at` en `Foto` y `Update` de fotos solo con esa columna.
- Docs: `PLAN.md` (4.1, 4.3 y fuera de alcance) y `PLAN_ETAPA2.md` (5.0, 5.2 y sección 7).

**⚠️ ORDEN DE DESPLIEGUE (no cambiar):**
1. **Primero** el usuario ejecuta `supabase/007_descartar_fotos.sql` en el SQL Editor. Agregar
   una columna es inocuo para la app publicada (la vieja no la usa).
2. Ejecuta `supabase/pruebas/007_prueba_descartar_fotos.sql` y revisa que todo salga `ok`.
3. **Después** hace push de la app. Si se publica la app nueva sin `007`, la lista y la
   pantalla de la visita fallan con "column … descartada_at does not exist".

**Archivos de Storage:** quitar una foto **no** borra su archivo: sigue en Storage
(`visitas/<visita>/<foto>.jpg`) hasta la limpieza del **punto de retención** (pendiente, no
implementada). No se hizo borrado físico ni limpieza programada. Los archivos de Storage **solo
se borran con la API de Storage, nunca con SQL** (borrar filas de `storage.objects` con SQL deja
el archivo huérfano en el almacenamiento).

**Cómo restaurar una foto (equipo, SQL Editor):**
`update public.fotos set descartada_at = null where id = '<id de la foto>';`

**Cómo probarlo:**
1. `npm run lint` y `npm run build`: pasan (verificado).
2. **No probado en navegador** (no se corrió la app para no consultar Supabase sin la columna).
   Después de `007` y del despliegue: entrar a una visita, tocar "Quitar" → "Sí, quitar" → la
   foto desaparece y sale "Foto quitada. Deshacer"; tocar "Deshacer" → regresa y en Supabase
   `descartada_at` sigue vacía; repetir sin deshacer → a los 5 s queda la hora en
   `descartada_at` y el número de fotos de la visita en la lista baja en 1.

**Decisiones tomadas (y por qué):**
- Permiso por **columna** + regla RLS + *trigger*: tres candados distintos (qué columnas, qué
  filas, qué valor). Si uno se quitara por error, los otros siguen.
- El "Quitar" se muestra en todas las fotos; si una ya no está pendiente se explica por qué,
  en vez de esconder el botón sin decir nada.
- Una foto que la base no deja quitar no da error en Supabase (solo no cambia ninguna fila); la
  app revisa cuántas filas cambiaron y, si fue ninguna, consulta el estado para dar el mensaje.

**Commit:** ver `git log` — `Quitar fotos: descarte reversible (007), botón con deshacer y prueba`

### Ajuste: botón ✕ en la esquina y guardado inmediato (2026-11-23)

**Qué cambió (solo la app; la migración `007` y su prueba no cambian):** se volvió a pedir la
fase "Quitar fotos de una visita" con estas diferencias respecto a lo anterior, y se ajustó la app:
- **Botón:** ya no es "Quitar" debajo de la foto. Es un círculo negro semitransparente con
  borde blanco y una **✕**, en la **esquina superior derecha** de cada miniatura, de 44 × 44 px,
  con `aria-label="Quitar foto"`. Se ve sobre fotos claras y oscuras.
- **Confirmación:** "¿Quitar esta foto?" con los botones **"Cancelar"** y **"Quitar"** (antes
  "Sí, quitar"). Es el `<dialog>` propio de la app, con el estilo del tema. Cancelar o Escape:
  no pasa nada.
- **Guardado inmediato, sin "Deshacer":** al tocar "Quitar" se guarda el descarte en ese
  momento. Mientras se guarda, la foto sigue a la vista con su botón desactivado (muestra "…"),
  así que tocarlo varias veces no hace nada. Al guardarse, la foto desaparece y baja el
  número de fotos de la visita. Si falla, o la foto ya no está pendiente, **la foto sigue a la
  vista** y sale un mensaje en español. Se quitaron el aviso "Foto quitada. Deshacer", la
  espera de 5 s y la pregunta del navegador al cerrar la pestaña.
- **Lista de visitas:** sin cambios de código. Con `cacheComponents`, Next.js esconde la
  lista con `<Activity>` en vez de desmontarla, y al volver a ella se repite su efecto, que vuelve
  a leer el conteo (que ya no cuenta las fotos quitadas). Si se va de la visita con la ventana de
  confirmación abierta, al volver aparece cerrada (`useLayoutEffect`, como dice
  `preserving-ui-state.md`).
- Archivos: `GaleriaFotos.tsx`, `ConfirmarQuitar.tsx`, `FotosVisita.tsx`. `src/lib/tipos.ts` ya
  tenía `descartada_at` (lectura en `Foto`; `Update` solo con esa columna): sin cambios.

**⚠️ ORDEN DE DESPLIEGUE (el mismo; no cambiar):**
1. **Primero** el usuario ejecuta `supabase/007_descartar_fotos.sql` en el SQL Editor (agregar
   una columna es inocuo para la app vieja) y revisa que la comprobación final salga toda `ok`.
   ✅ **Hecho (2026-11-23):** el usuario ejecutó `007` y la comprobación final salió toda `ok`.
2. Ejecuta `supabase/pruebas/007_prueba_descartar_fotos.sql` (termina con `rollback`).
   ✅ **Hecho (2026-11-23):** el usuario corrió la prueba y todos los casos salieron `ok`.
3. **Después** hace push de la app.
   ✅ **Hecho (2026-11-23):** la app (`c7ed32e`) ya estaba en `origin/main`. El usuario la probó
   en el celular y todo funciona: ✕ → "Cancelar" deja la foto; ✕ → "Quitar" la quita y baja el
   conteo en la visita y en la lista. **Fase "Quitar fotos de una visita" cerrada.**

**Storage (sin cambios):** los archivos de las fotos descartadas **siguen en Storage** hasta la
limpieza del punto de retención, que no está implementada. No hay borrado físico ni limpieza
programada. Los archivos de Storage **solo se borran con la API de Storage, nunca con SQL**.

**Cómo probarlo (después de 007 y del push):** abrir una visita → tocar la ✕ de una foto →
"Cancelar" → la foto sigue. Tocar la ✕ → "Quitar" → el botón se desactiva un momento, la foto
desaparece y baja "N fotos guardadas"; en Supabase la fila tiene `descartada_at` con la hora del
servidor. Volver a la lista → la visita muestra una foto menos. Sin internet → "No se pudo
quitar la foto…" y la foto sigue. `npm run lint` y `npm run build` pasan; **no probado en el
navegador** (sin `007` ejecutada, la app nueva no puede leer fotos).

**Commit:** ver `git log` — `Quitar fotos: botón ✕ en la esquina y guardado inmediato`


---

## Autenticación y propiedad de visitas (2026-11-24) — ✅ cerrada 2026-11-24 (ver "Cierre de la fase de autenticación")

Fase nueva, **fuera del plan original**, pedida por el usuario. **Reemplaza la decisión "sin
login".** **No** se ejecutó nada en Supabase, **no** se leyó `.env.local`, **no** se usa la
secret key en la app, **no** se empezaron fases 🤖 ni se llamó a la API de Anthropic.

**Decisiones del usuario (2026-11-24):**
1. Login con **correo y contraseña** (Supabase Auth). Sin registro público (ya estaba
   desactivado). Las cuentas las crea el dueño en el panel.
2. **Admin** = `app_metadata.rol = 'admin'`. **Nunca** `user_metadata` (cada quien lo edita).
3. **Personal de campo:** ve SOLO sus visitas y las fotos de esas visitas; crea visitas; sube
   fotos a SUS visitas; quita (descarta) fotos pendientes de SUS visitas; no modifica visitas
   ni otra columna; no borra.
4. **Admin:** ve todas las visitas y fotos (también las sin dueño). Preguntas respondidas:
   - (a) Desde la app: **corregir la tienda**, **quitar cualquier foto pendiente** y
     **restaurar fotos quitadas**. Lo demás se queda en el panel de Supabase.
   - (b) Quién creó cada visita: se muestra el **correo** de la cuenta.
   - (c) URLs firmadas: duran **24 horas**.
5. Etapa 2 sigue cerrada para `anon` **y** `authenticated` (también el admin en la app).
6. Las visitas de antes quedan con `usuario_id` nulo: solo las ve el admin.
7. Bucket **privado** (en `009`); la app muestra las fotos con URLs firmadas.

**Qué se hizo:**
- `supabase/008_autenticacion.sql` (**migración A, aditiva**; la app actual sigue funcionando):
  - `visitas.usuario_id` y `fotos.subida_por` (`uuid` → `auth.users`, `on delete set null`,
    default `auth.uid()`, con índice). Se agregan **sin** default y luego se pone el default,
    para que las filas viejas queden en null. Sin `grant insert` de esas columnas: nadie puede
    mandar el dueño.
  - `es_admin()`: lee `app_metadata.rol` del JWT. `authenticated` la puede usar; `anon` no.
  - Permisos por columna para `authenticated` (los mismos de `anon` + `update (descartada_at)`).
  - Reglas RLS de `authenticated`: competidores (activos + los de sus visitas, para que una
    visita vieja de una tienda desactivada siga mostrando el nombre), visitas (leer las suyas
    o todas si es admin; crear solo a su nombre con tienda activa), fotos (leer y crear en sus
    visitas o en cualquiera si es admin; quitar solo `pendiente` no quitadas, sin restaurar).
  - Storage: `authenticated` lee archivos de sus visitas (admin: todos) y sube solo a
    `visitas/<uuid de SU visita>/<uuid>.<ext>` (admin: a cualquier visita). Sin UPDATE/DELETE.
  - Funciones `security definer` que revisan `es_admin()` primero (si no, error 42501):
    `admin_cambiar_competidor`, `admin_restaurar_foto`, `admin_correos_usuarios`.
  - Comprobación final (solo lee): 20 filas `ok`.
- `supabase/009_cerrar_anon.sql` (**migración B, restrictiva**): freno si falta A; quita a
  `anon` todo permiso y las 6 reglas de las 3 tablas y las 2 de Storage; bucket privado;
  comprobación final de `anon` y `authenticated` (12 filas `ok`).
- `supabase/pruebas/008_prueba_autenticacion.sql`: 41 casos con usuarios inventados creados
  **dentro de la transacción** en `auth.users` (correos `@ejemplo.invalid`), simulando cada
  persona con `set local role authenticated` + `request.jwt.claims`. Cubre: un usuario no ve
  visitas de otro; el admin ve todas; `user_metadata.rol` no da admin; no se crea una visita a
  nombre de otro; descarta solo sus fotos pendientes; no restaura ni modifica otras columnas;
  no borra; funciones del admin (y que el personal no las puede usar); correos; tiendas;
  Storage; Etapa 2 cerrada para el admin; `anon` sin `es_admin`; y (solo antes de `009`) que
  `anon` sigue funcionando. Termina con `rollback`.
- `supabase/pruebas/009_prueba_sin_anon.sql`: 12 casos: `anon` no lee, no crea, no quita, no ve
  ni sube archivos; bucket privado; una cuenta con sesión sigue funcionando. Termina con `rollback`.
- App (sin librerías nuevas; solo `@supabase/supabase-js`, que ya estaba):
  - `src/lib/supabase.ts`: `persistSession: true`, `autoRefreshToken: true`,
    `detectSessionInUrl: false`.
  - `src/components/PuertaSesion.tsx` (nuevo, en `src/app/layout.tsx`): ninguna ruta se
    muestra sin sesión. Arriba: correo, "Administrador" si aplica y **"Cerrar sesión"**
    (`signOut({ scope: "local" })`, funciona sin internet, y recarga la app). **Sesión
    caducada:** al recibir `SIGNED_OUT` sin haber tocado "Cerrar sesión", muestra "Entrar" con
    "Tu sesión terminó" y **esconde** (no borra) la pantalla de antes; si vuelve a entrar la
    misma persona, sigue donde estaba; si entra otra cuenta, recarga la página.
  - `src/components/PantallaEntrar.tsx` (nuevo): correo, contraseña con "Mostrar/Ocultar",
    mensajes de error en español (credenciales, sin conexión, cuenta desactivada, demasiados
    intentos). Sin registro: "¿No tienes cuenta? Pide tu acceso al responsable."
  - `src/lib/sesion.ts` (nuevo): `useSesion()` → `{ usuario: { id, correo, esAdmin }, cerrarSesion }`.
  - `src/lib/urlsFirmadas.ts` (nuevo): `useUrlsFirmadas(rutas)` pide links de 24 h con
    `createSignedUrls` y los renueva cuando les queda menos de 1 h (temporizador, al volver a
    la pestaña y si una imagen no carga). Funciona con el bucket público y con el privado.
    Se quitó `urlFoto` (`getPublicUrl`) de `src/lib/fotos.ts`.
  - `src/lib/correos.ts` (nuevo): correos de las cuentas (solo admin) y texto "creada por".
  - Lista (`ListaVisitas.tsx`, `page.tsx`): "Mis visitas" / "Todas las visitas"; el admin ve
    "👤 correo" (o "Tú", o "Sin usuario (visita de antes del login)").
  - Visita (`DetalleVisita.tsx`, `CorregirTienda.tsx` nuevo, `FotosVisita.tsx`,
    `FotosQuitadas.tsx` nuevo, `GaleriaFotos.tsx`, `ConfirmarQuitar.tsx`): el admin ve
    "Creada por", "Corregir tienda (admin)" y "Fotos quitadas (N)" con "Restaurar". Las fotos
    usan URLs firmadas. Una visita ajena dice "no existe o no es tuya".
  - `src/lib/tipos.ts`: `usuario_id`, `subida_por` y las 4 funciones.
  - `noindex` sin cambios (verificado en el HTML del build).
- Docs: `PLAN.md` (decisiones, 4.1, 4.2, 4.3, 5 y 8), `PLAN_ETAPA2.md` (tabla 5.0) y
  `RESUMEN_PROYECTO.md`.

**⚠️ ORDEN DE DESPLIEGUE (no cambiar):**
0. **Cuentas** (panel de Supabase → **Authentication → Users → Add user → Create new user**):
   escribe correo y contraseña y marca **Auto Confirm User** (si no, al entrar sale "Tu cuenta
   todavía no está confirmada"). Una por persona de campo y una para el dueño.
   Para hacer **admin** la cuenta del dueño, en **SQL Editor** (cambia el correo):
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol": "admin"}' where email = 'correo-del-dueño';`
   Comprueba: `select email, raw_app_meta_data ->> 'rol' from auth.users;` → solo el dueño dice `admin`.
1. **Yo (usuario) ejecuto A:** `supabase/008_autenticacion.sql` → todas las filas `ok = true`.
   Luego `supabase/pruebas/008_prueba_autenticacion.sql` → fila `0. RESUMEN` con `ok = true`
   (41 casos). La app publicada (sin login) sigue funcionando igual.
2. **Push** de la app y esperar **Ready** en Vercel (Deployments).
3. **Probar** con una cuenta de campo y con la de admin (ver "Cómo probarlo").
4. **Yo ejecuto B:** `supabase/009_cerrar_anon.sql` → todas las filas `ok = true`. Luego
   `supabase/pruebas/009_prueba_sin_anon.sql` → `0. RESUMEN` con `ok = true`. (Opcional:
   volver a correr la prueba `008`: deben salir 39 casos, sin los dos de "antes de 009".)
   **Después de B, el link sin sesión deja de funcionar** y los links públicos viejos de
   fotos dejan de abrir.

**Cómo probarlo (paso 3):**
1. Abrir el link en el celular → sale **"Entrar"**. Contraseña mala → "Correo o contraseña
   incorrectos…".
2. Entrar con la cuenta de **campo** → "Mis visitas" vacía (las de antes no tienen dueño).
   Crear una visita, subir 2 fotos (se ven), quitar una con la ✕ → desaparece.
3. Cerrar la pestaña y volver a abrir el link → **sigue la sesión** (no pide entrar).
4. "Cerrar sesión" → "Entrar". Entrar con la cuenta de **admin** → "Todas las visitas": las
   de antes ("Sin usuario…") y la nueva con el correo de la cuenta de campo.
5. Como admin, en la visita nueva: "Corregir tienda (admin)" → elegir otra → "Guardar" → cambia
   el título. "Fotos quitadas (1) — admin" → "Restaurar" → la foto vuelve a la galería.
6. Con la cuenta de campo, abrir el link de una visita vieja (copiado de la sesión del admin)
   → "Esta visita no existe o no es tuya".
7. En Supabase → Table Editor → `visitas`: la visita nueva tiene `usuario_id` = id de la
   cuenta de campo; `fotos.subida_por` igual.

**Decisiones tomadas por el agente (y por qué):**
- **Sin `@supabase/ssr`:** toda la app ya lee los datos desde el navegador, así que basta la
  sesión de supabase-js en `localStorage`. La "puerta" es solo de pantalla; la seguridad la dan
  las reglas de la base (después de `009`, sin sesión no se lee nada aunque alguien se salte
  la pantalla). Con cacheComponents, el servidor solo prerenderiza "Revisando tu sesión…".
- **`fotos.subida_por`** además de `visitas.usuario_id`: el admin puede subir fotos a la visita
  de otra persona (decisión 4, "puede modificarlas"); así se sabe quién subió cada una.
- **El admin también sube fotos** a cualquier visita (incluidas las sin dueño), y quitar fotos
  usa la misma regla de la base (no una función), porque solo cambia `descartada_at`.
- **Competidores:** la petición decía "leer activos"; se agregaron los inactivos que aparecen en
  visitas que la persona puede ver, para que esas visitas no digan "Competidor desconocido".
- **Restaurar** y **corregir tienda** van por funciones `security definer` (no por `update`
  general), como pidió el usuario. Corregir tienda solo acepta tiendas **activas**.
- **Sesión caducada:** la librería renueva el pase sola (incluido al volver a la pestaña); si ya
  no puede, la app pide entrar sin perder lo que había en pantalla (por ejemplo, subidas con
  error que se pueden reintentar).

**Riesgos y límites conocidos:**
- Un link de foto copiado abre la foto **hasta 24 h** para cualquiera (decisión (c)).
- El rol admin viaja en el JWT: si el dueño lo pone o lo quita, se nota cuando esa persona
  vuelve a entrar (o como máximo en 1 hora).
- La sesión se guarda en el navegador: en un **celular compartido** hay que tocar
  "Cerrar sesión" al terminar.
- Borrar una cuenta en el panel deja sus visitas **sin dueño** (solo las ve el admin).
- **No probado en el navegador** (para no consultar Supabase antes de `008`). `npm run lint` y
  `npm run build` pasan. Las pruebas SQL **no se ejecutaron** (las ejecuta el usuario). Si en la
  prueba `008` el paso de `auth.users` falla con "permission denied", Supabase ya no permite crear
  usuarios así: avisar y se cambia el método. Si los casos de Storage (33–37) dicen "otro error",
  avisar: es el entorno de Storage, no las reglas.

**Commit:** ver `git log` — `Autenticación y propiedad de visitas: login, dueño, admin, URLs firmadas (008/009)`

---

## Corrección: ciclo de reglas al guardar una visita (008b) (2026-11-24) — ✅ ejecutada y probada 2026-11-24

**El problema:** el usuario ya ejecutó `008` (A). Al guardar una visita en la app con la cuenta de
admin salió `infinite recursion detected in policy for relation "visitas"`. Pasa con **cualquier**
cuenta (campo o admin) y solo al **crear** una visita. **No** se ejecutó nada en Supabase, **no**
se editó `008`, **no** se ejecutó `009`.

**Diagnóstico (el ciclo exacto):**
- `visitas` INSERT → regla "authenticated crea sus visitas" → `exists (select … from competidores …)`
- → `competidores` SELECT → regla "authenticated lee competidores" → `exists (select … from visitas …)`
- → `visitas` SELECT → regla "authenticated lee sus visitas" (tiene subconsultas `(select auth.uid())`)
  → Postgres ve que ya estaba aplicando reglas de `visitas` y corta con "infinite recursion".
- Las reglas de `fotos` y de Storage leen `visitas`, pero la regla de `visitas` no regresa a ellas:
  no hacen ciclo. Se cambiaron igual (pedido del usuario: ninguna regla lee otra tabla con RLS).
- `anon` no tiene el problema: su regla de competidores es `using (true)` (no lee visitas).
- Reproducido en local con PGlite (Postgres en WASM, en el scratchpad, fuera del repo) cargando
  `001`–`008` reales: la prueba `008` sale `RESUMEN ok = false` con los casos 6, 7 y 8 en
  "infinite recursion".

**Qué se hizo:**
- `supabase/008b_romper_ciclo_rls.sql` (nuevo, repetible, en una transacción, con freno si falta 008):
  - Esquema `privado` (la API de Supabase no lo publica): `usage` solo para `authenticated`.
  - Funciones `security definer`, `stable`, `search_path = ''`, sin `execute` para `anon` ni
    `public`: `es_dueno_de_visita(uuid)`, `puede_usar_visita(uuid)` (mía, o admin y existe),
    `competidor_activo(bigint)`, `competidor_en_visita_visible(bigint)`. Más
    `visita_de_ruta(text)` (no definer, no lee tablas: saca el uuid de `visitas/<uuid>/…`).
  - `alter policy` (sin borrar reglas) de las 5 reglas de tablas que leían otra tabla y las 2 de
    Storage. "authenticated lee sus visitas" no cambia.
  - Comprobación final: 9 filas `ok`.
- `supabase/pruebas/008_prueba_autenticacion.sql`: casos 42–56 con el **flujo real de la app**
  (C1 de campo y el admin crean su visita con sus reglas, `insert … returning`, la abren con su
  tienda, aparece en la lista, suben archivo a Storage, registran fotos, las ven, quitan una; C2
  y C1 no pueden hacer nada de eso en la visita ajena; el admin sí, por diseño), caso 57
  (ningún caso dio "infinite recursion") y mínimo de 55 casos en el RESUMEN.
- App: **sin cambios**. Se revisó el flujo (ver abajo).

**Flujo de la app revisado:**
1. `FormularioNuevaVisita.tsx`: `from("visitas").insert({competidor_id, latitud, longitud,
   precision_metros, ubicacion_at}).select("id").single()` → INSERT con RETURNING (aquí salía el error).
2. `DetalleVisita.tsx`: `select("*, competidores(nombre)")`; `ListaVisitas.tsx`:
   `select("id, created_at, usuario_id, competidores(nombre), fotos(count)")`.
3. `SubirFotos.tsx`: `storage.upload(visitas/<visita>/<uuid>.jpg, upsert: false)` y luego
   `from("fotos").insert({...}).select().single()`.
4. `urlsFirmadas.ts`: `createSignedUrls` (lee `storage.objects`).
5. `FotosVisita.tsx`: `update({descartada_at}).eq("id", …).select("id")`.

**Resultados en local (PGlite, NO es Supabase):** `008b` dos veces seguidas → OK, 9/9 `ok`.
Prueba `008`: sin `008b` 16 casos fallan; con `008b` 57/57. Después de `009`: prueba `009` 12/12
y prueba `008` 55/55. Límites: en local el dueño de las funciones es superusuario y Storage es una
tabla mínima (sin la API ni sus triggers). `npm run lint` y `npm run build` pasan.

**Por qué la prueba `008` no avisó:** la prueba **sí** marca el error (casos 6–8 y RESUMEN false
en la reproducción local), pero no se corrió antes de que llegara a la app y el agente anterior no
tenía cómo correrla. Además era fácil pasarlo por alto: el resto de los casos (fotos, Storage) usa
visitas creadas por el SQL Editor, que se salta las reglas, así que 38 de 41 casos pasaban; no había
un caso que hiciera el recorrido completo de la app con visitas creadas con las reglas.

**Decisiones tomadas (y por qué):**
- Funciones en `privado` y no en `public`: así no se pueden llamar como `/rpc/…` desde la app y no
  cambian las comprobaciones de `008`/`009` ("ninguna función de public abierta salvo es_admin y admin_*").
- `alter policy` en vez de `drop` + `create`: nunca hay un momento sin regla y se puede repetir.
- Cambio pequeño: en Storage, el admin ahora ve archivos de visitas que **existen** (antes, todo el
  bucket). La app solo pide archivos de fotos registradas, que siempre tienen visita.

**Pasos del usuario, EN ESTE ORDEN:**
1. SQL Editor → `supabase/008b_romper_ciclo_rls.sql` → todas las filas `ok = true`.
2. SQL Editor → `supabase/pruebas/008_prueba_autenticacion.sql` → `0. RESUMEN` con `ok = true`
   (57 casos antes de `009`).
3. En la app (no hace falta push: la app no cambió), guardar una visita con el admin y con una
   cuenta de campo, subir y quitar una foto.
4. Seguir con `009` y su prueba como dice la sección anterior.

**Commit:** ver `git log` — `008b: romper el ciclo de reglas RLS al crear visitas`

---

## Mensajes de error claros: red, sesión caducada o error de Supabase (2026-11-24) — 🟡 falta prueba del usuario y despliegue

**El problema:** al guardar una visita, subir una foto o quitar una foto, cualquier falla decía
"Revisa tu conexión a internet", aunque el error fuera de permisos de la base de datos (por ejemplo
el `infinite recursion` de `008`). Eso manda a la persona a revisar su señal cuando el problema
es otro.

**Qué se hizo (solo la app; la base de datos NO se tocó, no hay SQL nuevo):**
- `src/lib/errores.ts` (nuevo): `clasificarFalla(error, status?)` decide entre tres tipos y
  `mensajeDeFalla()` da el texto:
  - **red** (Supabase no respondió: sin internet, señal débil, tiempo agotado) →
    "No hay conexión a internet o tardó demasiado en responder. Revisa tu señal e inténtalo otra vez."
  - **sesión caducada** (JWT caducado o inválido) → "Tu sesión caducó. Inicia sesión otra vez y
    vuelve a intentarlo." + botón **"Iniciar sesión otra vez"**.
  - **error de Supabase** (respondió con error) → "No se pudo guardar. Avisa al responsable e
    indica este código: `<código>`". Sin texto técnico.
- Cómo se reconoce (revisado en el código de `@supabase` 2.119 en `node_modules`):
  - Tablas/funciones: si fetch falla, postgrest-js devuelve `status 0`, `code ""` y un mensaje
    `TypeError: Failed to fetch` / `AbortError: …` (tiempo agotado). También cuenta
    `navigator.onLine === false`.
  - Storage: `StorageUnknownError` (no hubo respuesta) = red; `StorageApiError` = Supabase.
  - Sesión: códigos `PGRST301` / `PGRST302` / `PGRST303`, `InvalidJWT` de Storage, o mensajes
    "JWT expired" / `"exp" claim`.
- **Códigos que puede ver el responsable:**
  - Código de Postgres/PostgREST tal cual: `42501` (regla de permisos), `42P17` (recursión en
    reglas), `23503`, `PGRST116`…
  - `S<status>-<código>` para Storage, por ejemplo `S403-Unauthorized`.
  - `HTTP-<status>` si Supabase respondió sin código (por ejemplo `HTTP-502`).
  - `SIN-CAMBIO`: al quitar una foto, Supabase respondió bien pero no cambió nada y la foto sigue
    pendiente (casi siempre una regla de permisos de UPDATE que no deja; no da error, da 0 filas).
  - `APP`: error de la propia app (no de Supabase). `SIN-CODIGO` / `DESCONOCIDO`: no se pudo saber.
- "Iniciar sesión otra vez": nueva función `entrarOtraVez()` en la sesión (`PuertaSesion`). Cierra
  la sesión solo en este celular **sin recargar**: aparece "Entrar" y la pantalla de antes queda
  escondida; si entra la misma persona, vuelve tal cual (por ejemplo, las fotos con error se
  pueden reintentar).
- Se conservan los mensajes que la persona sí puede arreglar: foto de más de 5 MB y formato no
  aceptado (subir foto); "Solo el administrador…" (restaurar foto, corregir tienda).

**Archivos creados o cambiados:**
- `src/lib/errores.ts` — clasificación y mensajes (nuevo).
- `src/lib/errores.test.ts` — 10 pruebas con las clases de error reales de storage-js y la forma
  exacta de postgrest-js (nuevo). Correr: `npm run test:errores` (nuevo script en `package.json`).
- `src/components/BotonEntrarOtraVez.tsx` — botón "Iniciar sesión otra vez" (nuevo).
- `src/lib/sesion.ts`, `src/components/PuertaSesion.tsx` — `entrarOtraVez()`.
- `src/app/visitas/nueva/FormularioNuevaVisita.tsx` — guardar visita.
- `src/lib/fotos.ts` (`mensajeErrorSubida`), `src/app/visitas/[id]/SubirFotos.tsx` — subir foto.
- `src/app/visitas/[id]/FotosVisita.tsx` — quitar y restaurar foto.
- `src/app/visitas/[id]/CorregirTienda.tsx` — corregir tienda (admin), mismo criterio.

**Resultados:** `npm run lint` ✅, `npm run build` ✅, `npm run test:errores` 10/10 ✅.
No se probó en el celular ni contra Supabase real.

**Cómo probarlo (después de desplegar):**
1. **Red:** con el celular en modo avión, tocar "Guardar visita", subir una foto y quitar una foto
   → los tres dicen "No hay conexión a internet o tardó demasiado…".
2. **Supabase:** mientras `008b` no esté ejecutada, guardar una visita → "No se pudo guardar. Avisa
   al responsable e indica este código: 42P17" (ya no dice "Revisa tu conexión").
3. **Sesión:** difícil de forzar a mano (la librería renueva la sesión sola). Si se quiere probar:
   en la computadora, DevTools → Application → Local Storage, cambiar el `access_token` guardado
   por otro texto y tocar "Guardar visita" → "Tu sesión caducó…" con el botón; al tocarlo aparece
   "Entrar" y, al entrar, la pantalla vuelve como estaba.

**Decisiones tomadas (y por qué):**
- Un solo módulo para los tres tipos de falla, así todas las pantallas dicen lo mismo.
- Sesión caducada no cierra la sesión sola: primero se muestra el aviso y la persona toca el
  botón, para que entienda qué pasó.
- Se dejaron igual los mensajes al **cargar** datos (lista de competidores, lista de fotos,
  imágenes) y al entrar/cerrar sesión: no los pidió esta tarea. Pendiente opcional: usar
  `src/lib/errores.ts` también ahí.

**Commit:** ver `git log` — `Mensajes de error: distinguir red, sesión caducada y error de Supabase`

---

## Archivo de reversa de 009 (2026-11-24) — ✅ listo, NO ejecutado (solo para emergencia)

**Qué se pidió:** antes de que el usuario ejecute `009`, tener un archivo para deshacerla si algo
sale mal. `supabase/reversa_009.sql` **no existía**; se creó. **No se ejecutó en Supabase.**
`009_cerrar_anon.sql` no se tocó (su comentario todavía dice "se haría con un archivo nuevo": ese
archivo es este).

**Qué hace `supabase/reversa_009.sql`** (una transacción; se puede repetir):
- BLOQUE 0. Freno: si no está `008` (columna `usuario_id`, regla "authenticated lee sus visitas")
  o no existe el bucket `fotos`, se detiene sin cambiar nada.
- BLOQUE 1. Permisos de `anon`, iguales a los de antes de `009`: leer las 3 tablas; crear visitas
  con 5 columnas (las de `001` menos `competidor_elegido_at`, borrada en `003`); crear fotos con 6
  columnas (`001` + `002`); cambiar solo `descartada_at` (`007`). Nunca `usuario_id`,
  `subida_por`, `DELETE` ni `TRUNCATE`.
- BLOQUE 2. Las 6 reglas RLS de `anon` (copiadas de `001` y `007`).
- BLOQUE 3. Las 2 reglas de Storage de `anon` (leer y subir, de `001`).
- BLOQUE 4. Bucket `fotos` público otra vez (mismos límites).
- BLOQUE 5. Comprobación (solo lee): 12 filas, todas `ok = true`.
- No toca `authenticated`, el admin, las funciones, `privado` (`008b`) ni la Etapa 2.

**Resultados en local (PGlite, NO es Supabase; mismo arnés que `008b`):**
- Foto del estado de `anon` (permisos de tabla y columna, reglas, bucket y reglas de
  `authenticated`) después de `001`–`008b` vs. después de `009` + reversa dos veces:
  **0 diferencias** (67 filas iguales).
- Reversa: 12/12 `ok` (dos veces seguidas). Prueba `008` después de la reversa: todo `ok`
  (incluye los casos "antes de 009", en los que `anon` usa la app).
- Volver a cerrar: `009` otra vez → 12/12; prueba `009` y prueba `008` → todo `ok`.
- Freno: sin `008`, se detiene con su mensaje.
- Límites: Storage en local es una tabla mínima (sin la API, sin URLs públicas ni firmadas).

**Qué pasa con las URLs firmadas si se usa:**
- **Siguen funcionando.** La app con login las pide con la sesión (`createSignedUrls`, 24 h) y eso
  depende de las reglas de Storage de `authenticated`, que la reversa no toca. Una URL firmada
  sirve igual con el bucket público o privado. Las ya entregadas valen hasta que caducan. No hay
  que cambiar ni volver a publicar la app.
- **Pero ya no protegen nada:** con el bucket público, cada foto también abre con su link
  público permanente (`/storage/v1/object/public/fotos/...`), sin sesión y sin caducar, y `anon`
  puede leer y listar fotos con la llave pública. Los links públicos viejos vuelven a funcionar.

**Cuándo sirve (y cuándo no):**
- Sirve si hay que **regresar en Vercel a la app vieja (sin login)**, o si la app con login
  resulta hacer alguna consulta sin sesión.
- **No arregla** un problema de la app con login causado por las reglas de `authenticated`
  (`009` no las toca y la reversa tampoco). La app nueva siempre pide entrar, haya o no reversa.
- Mientras esté deshecha: las visitas creadas sin sesión quedan con `usuario_id` vacío; en la app
  con login solo el admin las ve.

**Archivos creados o cambiados:**
- `supabase/reversa_009.sql` — nuevo.
- `docs/PROGRESO.md` — pendiente y esta sección.

**Pasos del usuario:** ninguno ahora. Seguir con `009` como dice la sección de Autenticación. Si
algo sale mal: SQL Editor → `supabase/reversa_009.sql` → 12 filas `ok = true`.

**Commit:** ver `git log` — `Agregar reversa_009.sql para deshacer 009 en emergencia (no ejecutado)`

---

## Cierre de la fase de autenticación (2026-11-24) — ✅

**Qué confirmó el usuario:** se ejecutaron en Supabase `008`, `008b` y `009`; la comprobación de
`009` salió con todas las filas `ok`; `anon` ya no tiene acceso, el bucket `fotos` es privado y
las pruebas pasaron. `reversa_009.sql` **no** se ejecutó.

**Qué se hizo (solo documentación, sin código ni SQL nuevo):**
- Tabla de estado: la fase queda ✅. Las secciones de `008` y `008b` se marcan como cerradas.
- "Pendientes": se quitaron los puntos ya resueltos (todos los `[x]`, los pasos de `008`/`009` y
  el error de `008b`). Los avisos que siguen valiendo (no volver a ejecutar `008` después de
  `008b`; no volver a ejecutar `001`/`007`; reversa solo en emergencia) pasaron a
  "Avisos permanentes".
- `docs/RESUMEN_PROYECTO.md` y `docs/PLAN.md`: "sin login" queda reemplazado; describen el login,
  los roles (admin y campo) y qué ve cada uno, el bucket privado con URLs firmadas, el esquema
  `privado` con sus funciones auxiliares y el aviso sobre `008`/`008b`.

**Sigue abierto (no es de esta fase):** "Mensajes de error claros" falta probarlo en el celular
(este push lo publica); el registro de correcciones del admin sigue como opcional.

**Commit:** ver `git log` — `Cerrar fase de autenticación: PROGRESO, RESUMEN y PLAN al día`

---

## Entrar con usuario (2026-11-24) — 🟡 falta prueba del usuario y despliegue

**Qué se pidió:** que el personal entre con un **usuario** corto en vez de un correo. Solo cambio
de app: **no** se tocaron tablas, reglas ni migraciones, **no** se ejecutó nada en Supabase,
**no** se instaló nada. Dominio interno confirmado por el usuario: **`x24.com.mx`**.

**Qué se hizo:**
- **Convención:** cuenta en Supabase = `<usuario>@x24.com.mx`. La pantalla "Entrar" tiene un solo
  campo **"Usuario o correo"** y la contraseña.
  - Con `@` → se usa como correo tal cual (así siguen entrando el admin y las cuentas de antes).
  - Sin `@` → se quitan los espacios, se pasa a minúsculas y se exige `[a-z0-9._-]` de 3 a 30
    caracteres. Si no cumple, se muestra un mensaje en español **sin llamar a Supabase**. Si
    cumple, se entra con `<usuario>@x24.com.mx`.
  - Si falla el acceso: **"Usuario o contraseña incorrectos."** (no dice cuál de los dos). Los
    avisos de red, demasiados intentos y cuenta desactivada siguen igual.
- **Gestor de contraseñas:** `<form>` real con botón de envío; campo usuario con
  `name="username"`, `autoComplete="username"`, `autoCapitalize="none"`, `autoCorrect="off"`,
  `spellCheck={false}`; contraseña con `name="password"` y `autoComplete="current-password"`.
- **Último usuario:** se guarda en `localStorage` (`levantamiento:ultimo-usuario`) al tocar
  "Entrar" y se precarga en el campo. **Nunca** la contraseña. Lectura y escritura con
  `try/catch` (modo privado o almacenamiento bloqueado → simplemente no se precarga).
- **Qué se muestra:** en el encabezado y en "Creada por" (lista y detalle del admin) se ve el
  **usuario** (lo de antes de la `@`) si el correo termina en `@x24.com.mx`; si no, el correo
  completo.

**Sesión (revisado, sin cambios):**
- `src/lib/supabase.ts` ya tenía `persistSession: true` y `autoRefreshToken: true`.
- Duración con la configuración por defecto de Supabase (el proyecto no tiene
  `supabase/config.toml`; los valores reales están en el panel → Authentication → Sessions, que el
  agente **no** revisó): el pase (JWT) dura **1 hora** y se renueva solo; el *refresh token* no
  caduca y "Time-box" / "Inactivity timeout" vienen apagados. O sea, **la sesión dura
  indefinidamente** mientras no se cierre.
- Lo único en la app que cierra la sesión: **"Cerrar sesión"** y el botón **"Iniciar sesión otra
  vez"**, que solo aparece cuando la sesión **ya** caducó (lo toca la persona). Fuera de la app
  la pueden terminar: desactivar o borrar la cuenta, o cerrar sesión en otra pestaña del mismo
  navegador.
- Riesgo conocido: **Safari en iPhone** borra el `localStorage` de un sitio que no se abre en
  **7 días** (si la app no está agregada a la pantalla de inicio). Quien no use la app en una
  semana tendrá que volver a entrar; con el gestor de contraseñas es un toque.

**Archivos creados o cambiados:**
- `src/lib/usuarios.ts` — nuevo: `DOMINIO_INTERNO`, `correoParaEntrar()` y `nombreVisible()`.
- `src/components/PantallaEntrar.tsx` — campo "Usuario o correo", validación, mensaje genérico,
  atributos para el gestor de contraseñas, último usuario.
- `src/components/PuertaSesion.tsx` — encabezado con `nombreVisible()`.
- `src/lib/correos.ts` — "Creada por" con `nombreVisible()`.
- `docs/PROGRESO.md`, `docs/RESUMEN_PROYECTO.md` — convención de usuarios y aviso de no borrar
  cuentas con visitas.

**Pasos del usuario:**
1. En Supabase → Authentication → Users → **Add user**: correo `juan.perez@x24.com.mx` (ejemplo),
   contraseña, y marcar que quede confirmado (*Auto Confirm User*).
2. En el celular, abrir la app → escribir `juan.perez` y la contraseña → **Entrar**. El celular
   debe ofrecer guardar la contraseña.
3. Comprobar: arriba dice `juan.perez`; en la cuenta de admin, "Creada por" de sus visitas dice
   `juan.perez`.

**Cómo probarlo:**
1. Escribir `ju` → "El usuario no es válido…" (no se llama a Supabase).
2. Contraseña equivocada → "Usuario o contraseña incorrectos."
3. Entrar con el correo completo del admin → sigue funcionando.
4. Cerrar sesión → el campo ya trae el último usuario escrito.
5. Cerrar la pestaña y volver a abrir el link → sigue la sesión.

**Decisiones tomadas (y por qué):**
- Lo que se recuerda es el usuario **ya normalizado** (o el correo si llevaba `@`), igual que lo
  que se manda a Supabase.
- El correo con `@` solo se recorta de espacios al inicio y al final; no se pasa a minúsculas
  (Supabase ya compara correos sin importar mayúsculas).
- Se dejaron los mensajes de "cuenta desactivada" y "sin confirmar": Supabase solo los da con la
  contraseña correcta, así que no revelan nada a quien adivina.

**Pendiente:** confirmar en el panel de Supabase cómo **bloquear** una cuenta sin borrarla (y que
eso cierre sus sesiones), para el caso de alguien que deja de trabajar.

**Commit:** ver `git log` — `Entrar con usuario: <usuario>@x24.com.mx, gestor de contraseñas y último usuario`

---

## Captura manual de datos con sugerencias (2026-11-25) — 🟡 falta ejecutar `010`, desplegar y probar

Fase nueva, **fuera del plan original**, pedida por el usuario. **No** se ejecutó nada en
Supabase, **no** se leyó `.env.local`, **no** se usa la secret key en la app, **no** se instaló
ninguna librería, **no** se empezaron fases 🤖 ni se llamó a la API de Anthropic. **Ningún agente
consume estas filas.**

**Qué se hizo:**
- `supabase/010_capturas_manuales.sql` (**aditiva**, repetible, en una transacción, con freno si
  faltan `004`, `005`, `008` u `008b`):
  - BLOQUE 1: `privado.normalizar_unidad_base` y `privado.normalizar_contenido_base`, envoltorios
    `security definer` de las funciones de `004`. Hacen falta porque Postgres pide permiso de
    ejecutar la función de una columna generada a **quien inserta** (comprobado en local: sin el
    envoltorio, `authenticated` recibe "permission denied for function").
  - BLOQUE 2: tabla `capturas_manuales` (PLAN 4.1) con 17 CHECK: listas de unidad, tipo y
    condición de promoción; `cantidad > 0` con hasta 3 decimales; `precio_regular ≥ 0` con hasta
    2 decimales (más decimales se **rechazan**, no se redondean); piezas 1–1000; textos no vacíos y
    con largo máximo; reglas de promoción por tipo; sin promoción → sin datos de promoción.
  - BLOQUE 3: *trigger* que pone la hora del servidor en `descartada_at` (como fotos en `007`).
  - BLOQUE 4: se quita todo a `anon`/`authenticated` y se da: `select`; `insert` solo de las
    columnas de la app (sin `id`, `usuario_id`, `created_at`, `descartada_at` ni generadas);
    `update (descartada_at)`. Sin `delete`.
  - BLOQUE 5: 3 reglas para `authenticated`: leer con `privado.puede_usar_visita` (mías; admin
    todas); crear con `usuario_id = auth.uid()` y `privado.es_dueno_de_visita` (solo en mis
    visitas, también el admin); quitar solo mis filas vigentes, sin restaurar. **Ninguna
    subconsulta** a otras tablas.
  - BLOQUE 6: `public.sugerencias_captura()` → `table (tipo text, valor text)`, `security
    definer`, `search_path = ''`, ejecutable solo por `authenticated` (y `service_role`). Áreas:
    nombres distintos de `catalogo_propio.area`. Marcas: las de `capturas_manuales` vigentes.
    Junta las que solo cambian en mayúsculas/acentos (deja la forma más usada). Sin sesión no
    devuelve nada.
  - BLOQUE 7: comprobación (solo lee): 15 filas `ok`.
- `supabase/pruebas/010_prueba_capturas_manuales.sql`: 45 casos con usuarios y datos inventados
  (`@ejemplo.invalid`), flujo real de la app (insert de varias filas `… returning`, select,
  quitar `… returning id`, `select * from sugerencias_captura()`), termina con `rollback`. Cubre:
  C1 crea y ve solo en sus visitas; C2 no ve ni crea en las ajenas; nadie crea en visitas sin
  dueño; el admin ve todas pero crea solo en las suyas; no se puede mandar `usuario_id` ni
  `descartada_at`; no se cambia precio, visita ni autor; no se borra; quitar solo lo propio, con
  hora del servidor y sin restaurar; 12 CHECK con valores inválidos; promociones válidas;
  "Guardar" todo o nada; `anon` no lee, no crea ni ejecuta la función; la función devuelve solo
  `tipo`/`valor`, el área sí y la clave/descripción no; marcas sin duplicar; nadie lee
  `catalogo_propio`; ningún "infinite recursion".
- App (sin librerías nuevas):
  - `src/lib/capturas.ts` (nuevo): listas de valores, lectura de números con coma o punto,
    validación en español, avisos (precio 0; precio rebajado no menor que el regular), conversión
    a la fila de Supabase, filtro de sugerencias, borrador en `localStorage` y aviso al salir.
  - `src/lib/capturas.test.ts` (nuevo, `npm run test:capturas`): 12 pruebas.
  - `src/components/CampoSugerencias.tsx` (nuevo): combobox accesible (ARIA 1.2: `combobox`,
    `listbox`, `aria-activedescendant`, flechas/Enter/Escape, aviso de cuántas sugerencias). Hasta
    5: primero las que empiezan y luego las que contienen, sin mayúsculas ni acentos ("BE" →
    "BEBIDAS"). Tocar una llena el campo; escribir respeta exactamente lo escrito. Letra de 18 px,
    opciones de 48 px y, si la lista no cabe sobre el teclado, el campo sube (`visualViewport`).
  - `src/app/visitas/[id]/CapturaManual.tsx` (nuevo): sección opcional (cerrada salvo que haya
    borrador). Al abrirla carga una vez las sugerencias y las filas guardadas. Tarjetas con
    "+ Agregar producto", "Duplicar fila", "Quitar"; "Tiene promoción" muestra sus campos; teclado
    numérico (`inputMode`); "Guardar datos" = **un** insert con todas las filas (todo o nada);
    errores con `src/lib/errores.ts` (red / sesión con botón / Supabase con código; `SIN-FILAS` si
    Supabase respondió sin las filas, `SIN-CAMBIO` si quitar no cambió nada). Filas guardadas en
    solo lectura con "Quitar" (pregunta "¿Quitar este producto?") solo para su autor.
  - `src/app/visitas/[id]/EnlaceVolver.tsx` (nuevo): "← Volver a la lista" pregunta si hay
    productos sin guardar. Al cerrar o recargar la pestaña avisa el navegador (`beforeunload`).
  - `src/app/visitas/[id]/DetalleVisita.tsx` y `page.tsx`: la sección va debajo de las fotos.
  - `src/lib/tipos.ts`: tabla `capturas_manuales` y función `sugerencias_captura`.
  - `package.json`: script `test:capturas`.
  - `noindex` y tema: sin cambios (mismos colores de `globals.css`).
- Docs: `PLAN.md` (1, fuera de alcance, 4.1, 4.3, 4.4, 5 y 8), `PLAN_ETAPA2.md` (5.0, 6.1 y 9.5:
  propuesta de uso para validación y evaluación; los agentes no deben ver estas filas),
  `RESUMEN_PROYECTO.md`.

**⚠️ ORDEN DE DESPLIEGUE (no cambiar):**
1. **Yo (usuario) ejecuto la migración (aditiva):** SQL Editor → `supabase/010_capturas_manuales.sql`
   → las 15 filas con `ok = true`. Luego ~~`010_prueba_capturas_manuales.sql`~~
   **`supabase/pruebas/010b_prueba_capturas_manuales.sql`** → fila `0. RESUMEN` con `ok = true`
   (46 casos). *(Cambio del 2026-11-25: ver "Corrección de la prueba de 010".)* La app publicada sigue igual (no usa nada nuevo).
2. **Push** de la app y esperar **Ready** en Vercel (Deployments).
3. **Pruebo con dos cuentas de campo y con el admin** (ver "Cómo probarlo").

**Cómo probarlo (paso 3):**
1. Campo 1: abrir una visita suya → "Datos del levantamiento (manual)" → se abre la sección.
   "+ Agregar producto" → escribir "Refresco", contenido `600`, unidad ml, precio `18,50`.
   En **Área** escribir `be` → aparecen sugerencias (si el catálogo tiene un área con "BE");
   tocar una → se llena. Escribir otra cosa que no esté → se queda tal cual.
2. Agregar otro producto con precio `0` → aviso amarillo, pero deja guardar. "Duplicar fila" →
   aparece una copia debajo. Dejar el artículo vacío en una → "Guardar datos" → no guarda nada y
   lleva el foco al campo en rojo. Llenarlo → "Guardar datos" → "Se guardaron N productos".
3. Antes de guardar, recargar la página → el navegador avisa; al volver, lo escrito sigue ahí
   (borrador). Con productos sin guardar, tocar "← Volver a la lista" → pregunta.
4. "Quitar" en una fila guardada → "¿Quitar este producto?" → "Sí, quitar" → desaparece.
5. En el celular: los campos no hacen zoom al tocarlos (iPhone) y la lista de sugerencias no
   queda tapada por el teclado. Teclado numérico en contenido, piezas y precios.
6. Campo 2: abrir el link de la visita de Campo 1 → "no existe o no es tuya". En una visita
   suya, no ve los datos de Campo 1. Al escribir una marca que guardó Campo 1, sí aparece como
   sugerencia (las marcas son compartidas, solo el nombre).
7. Admin: abrir la visita de Campo 1 → ve los productos guardados (sin "Quitar") y "Solo quien
   creó la visita puede escribir datos en ella". En una visita del admin sí puede escribir.
8. Modo avión → "Guardar datos" → "No hay conexión…" y lo escrito sigue ahí.

**Decisiones tomadas por el agente (y por qué):**
- **El admin escribe solo en sus visitas** y quita solo sus filas: la petición decía "cada persona
  crea solo en SUS visitas; el admin ve todas" y "descartar solo sus propias filas".
- **`promo_paga_piezas`** (no estaba en la lista de campos): sin ella "lleva 3 paga 2" no se puede
  guardar. Es la misma columna de `lecturas_precio`, así se compara igual.
- **Reglas de promoción en la base:** `precio_rebajado` → `promo_piezas = 1` y precio obligatorio;
  `n_por_precio` → al menos 2 piezas y precio total; `nxm` → lleva ≥ 2, paga < lleva, sin precio
  total; `otro` → todo opcional. Igual que las fórmulas de `lecturas_precio` (PLAN_ETAPA2 5.5).
- **Decimales:** columnas `numeric` con CHECK de `scale()` en lugar de `numeric(10,2)`, porque
  `numeric(10,2)` **redondea** en silencio y el usuario pidió que la base rechace valores
  inválidos. El rango es el mismo.
- **Marcas compartidas:** las sugerencias de marca salen de las capturas de **todas** las personas
  (solo el nombre; sin quién, dónde ni precio), para que la lista sea útil desde el principio.
- **`de_lista`:** `true` solo si se **tocó** una sugerencia; si después se edita el texto, vuelve a
  `false`. Si lo escrito solo difiere en mayúsculas/acentos de una opción (por ejemplo "lacteos"),
  se sugiere la forma de la lista, pero no se cambia sola.
- **Filas vacías** (recién agregadas, sin nada escrito) no se guardan ni cuentan para el aviso.
- **Sección cerrada por defecto** ("opcional"): se abre sola si hay borrador.

**Riesgos y límites conocidos:**
- Si la red se corta **después** de que Supabase guardó pero antes de recibir la respuesta, la app
  muestra el error de red y conserva el borrador: al reintentar se duplicarían las filas. Se ven
  en "Guardados" (al recargar) y se pueden quitar. No se resolvió con ids del cliente porque la
  app no tiene permiso de mandar `id`.
- Las sugerencias se cargan una vez al abrir la sección: una marca que otra persona guarde
  después aparece hasta volver a abrir la pantalla.
- **No probado en el navegador ni contra Supabase real** (para no consultar Supabase antes de
  `010`). Probado en local con PGlite (Postgres en WASM en el scratchpad, **no es Supabase**,
  mismo arnés que `008b`): `001`→`009` reales, `010` dos veces seguidas → 15/15 `ok`; prueba `010`
  → 45/45; las pruebas `008` (55/55) y `009` (12/12) siguen pasando. `npm run lint` ✅,
  `npm run build` ✅, `npm run test:capturas` 12/12 ✅, `test:errores` 10/10 ✅, `test:etapa2`
  14/14 ✅.

**Commit:** ver `git log` — `Captura manual de datos con sugerencias (010): tabla, reglas, app y docs`

---

## Corrección de la prueba de 010: error 42P01 (2026-11-25) — 🟡 falta que el usuario corra el diagnóstico y `010b`

**Qué pasó:** el usuario ejecutó `010` y, al correr `supabase/pruebas/010_prueba_capturas_manuales.sql`
en el SQL Editor, salió `ERROR: 42P01: relation "public.capturas_manuales" does not exist` en la
consulta del caso 2 (`line 62`). **No** se ejecutó nada en Supabase, **no** se editó la migración.

**Causa raíz (comprobada en local):**
- **No es un cambio de rol ni de `search_path`.** Con un nombre completo (`public.…`), Postgres
  responde `42501 permission denied for schema/table` si falta un permiso, y el `search_path` no
  influye. Se probó cada caso en local: solo una tabla **que no está en el catálogo** da `42P01`.
  La prueba tampoco inserta ni renombra filas o tablas con otro nombre.
- O sea: en la base y transacción donde corrió la prueba, **`public.capturas_manuales` no existía**.
  Reproducido en local corriendo la prueba en una base con `001`→`009` **sin** `010`: sale
  **exactamente** el mismo error, en la misma `line 62`.
- **Por qué señalaba el caso 2 y no la causa:** el caso 1 (el primero que usa la tabla) fallaba con
  ese mismo `42P01`, pero su `exception when others` lo guardaba y seguía. El caso 2 era la
  **única** consulta sin protección: ahí salía el error y se cortaba toda la prueba (por eso no se
  veía la tabla de resultados).
- Razones posibles de que la tabla no esté donde corrió la prueba (no se pueden saber desde el
  repo; lo confirma la consulta de diagnóstico): `010` se ejecutó en **otro proyecto** (otra
  pestaña u organización); la ejecución de `010` falló a la mitad y su transacción se deshizo (el
  SQL Editor solo muestra el último resultado o error); o se usó "Run selected" con solo una
  parte seleccionada.

**Por qué la prueba local no lo detectó:**
- En local, `010` se carga **en la misma base y justo antes** de la prueba, siempre completa: el
  escenario "la prueba corre donde `010` no está" nunca se dio. La prueba no revisaba al inicio que
  `010` existiera (las migraciones sí tienen freno; la prueba no).
- El manejo de errores (cada caso atrapa todo) ocultaba la causa y solo una consulta sin protección
  la dejaba salir, en un lugar engañoso. En local todos los casos pasaban, así que eso no se notaba.
- Límites del arnés local (PGlite): un solo usuario superusuario y una sola base, sin el SQL Editor
  ni los roles de Supabase.

**Qué se hizo:**
- `supabase/pruebas/010b_prueba_capturas_manuales.sql` (nueva; **reemplaza** a la `010`, que se
  deja sin cambios como historial):
  - **Paso 0 (freno):** antes de crear datos, revisa que existan la tabla, sus 3 reglas, la función
    de sugerencias y los 2 envoltorios de `privado`. Si falta algo, se detiene con: qué falta, en
    qué base, con qué rol actual y con qué usuario de conexión, y qué hacer.
  - **Caso 2 protegido** (y el bloque externo del caso 35): ya no queda ninguna consulta sin
    protección; un error aparece como fila del resultado.
  - **Caso 46 (nuevo):** después de `reset role` se vuelve al mismo rol con el que se abrió el SQL
    Editor (descarta la hipótesis de rol en Supabase real).
  - RESUMEN: mínimo 46 casos.
- Resultados en local (PGlite, **no es Supabase**): sin `010` → se detiene con el mensaje del paso 0;
  con `010` → 46/46; pruebas `008` (55/55) y `009` (12/12) siguen pasando.
- Docs: este apartado, el estado, los pendientes, el orden de despliegue de la fase anterior y la
  tabla 5.0 de `PLAN_ETAPA2.md`.

**Pasos del usuario, EN ESTE ORDEN:**
1. En el **mismo proyecto y pestaña** donde corrió la prueba, SQL Editor → esta consulta (solo lee):
   ```sql
   select current_database() as base, current_user as rol, session_user as conexion,
          to_regclass('public.capturas_manuales') as tabla,
          to_regprocedure('public.sugerencias_captura()') as funcion,
          (select count(*) from pg_policies
           where schemaname = 'public' and tablename = 'capturas_manuales') as reglas;
   ```
   Esperado: `tabla = capturas_manuales`, `funcion = sugerencias_captura()`, `reglas = 3`.
   - Si `tabla` sale vacío: `010` no está en este proyecto. Ejecuta `supabase/010_capturas_manuales.sql`
     **completo** (sin seleccionar texto) y revisa que las 15 filas salgan `ok = true`.
2. SQL Editor → `supabase/pruebas/010b_prueba_capturas_manuales.sql` (completo) → fila
   `0. RESUMEN` con `ok = true` (46 casos). Si se detiene en el paso 0, el mensaje dice qué falta.
   Si alguna fila sale `false`, mándame la tabla de resultados.
3. Seguir con el push y la prueba en la app (sección "Captura manual de datos").

**Commit:** ver `git log` — `Prueba 010b: freno si falta 010 y sin consultas sin protección (42P01)`

---

## Captura rápida de productos (2026-11-25) — 🟡 falta ejecutar `011`, desplegar y probar

Fase nueva, **fuera del plan original**, pedida por el usuario. **No** se ejecutó nada en
Supabase, **no** se leyó `.env.local`, **no** se usa la secret key en la app, **no** se instaló
ninguna librería, **no** se abrió `datos-privados/`, **no** se empezaron fases 🤖 ni se llamó a
la API de Anthropic. **Ningún agente consume estas filas** (sirven como muestra verificada).

**Qué se hizo:**
- `supabase/011_captura_rapida.sql` (**nuevo, aditivo**, repetible, en una transacción; `010` no
  se editó):
  - BLOQUE 0: freno. Si no existe `public.capturas_manuales` (falta `010`), la vista
    `catalogo_propio_actual` (`005`) o las funciones de `privado` (`008b`), se detiene **sin
    cambiar nada** y dice qué falta.
  - BLOQUE 1: `cantidad`, `unidad` y `piezas` dejan de ser obligatorias (`piezas` conserva su
    default 1). Sus CHECK de `010` siguen: un valor mandado debe ser válido; vacío pasa.
  - BLOQUE 2: columnas nuevas `articulo_de_lista boolean not null default false` y
    `promo_precio_pieza numeric` (nula). **No** se reutilizó `promo_precio_total`: es el total del
    grupo y en `010` está atada a `promo_tipo` (con `'ninguna'` debe ir vacía).
  - BLOQUE 3: CHECK en la base. Ya estaban (de `010`) y no se tocan: artículo no vacío y ≤ 200;
    `precio_regular ≥ 0` con 2 decimales. Nuevos: `promo_precio_pieza` nula o ≥ 0 con 2 decimales;
    observaciones ≤ **500** (se quita la regla de 300); y "cantidad y unidad juntas".
  - BLOQUE 4: `grant insert (articulo_de_lista, promo_precio_pieza)` a `authenticated`; `revoke
    all` a `anon`. **Las reglas RLS no cambian.**
  - BLOQUE 5: `public.articulos_captura() returns text[]`, `security definer`, `search_path = ''`,
    lee la vista `catalogo_propio_actual` (`activo` y `not es_servicio`) y devuelve **un solo
    valor**: las descripciones distintas y ordenadas. Solo `authenticated` la ejecuta (se quita a
    `public`, `anon` y `service_role`). No es una regla RLS ni consulta tablas con RLS.
  - BLOQUE 6: comprobación (solo lee, sin descripciones): 13 filas `ok`. La fila 9 muestra cuántos
    artículos devuelve la función y que coinciden con el catálogo activo.
- `supabase/pruebas/011_prueba_captura_rapida.sql` (nueva): freno si falta `011` + 44 casos con
  usuarios y datos inventados (1,200 artículos "PRUEBA011 ART …" más uno repetido, uno de
  servicio, uno obsoleto y uno sin precio). **Solo muestra conteos**, nunca descripciones reales.
  Cubre: solo artículo + precio entra; cantidad/unidad nulas se aceptan; la app vieja sigue
  guardando; artículo vacío/espacios/201 letras, precio negativo o con 3 decimales, precio vacío,
  promoción negativa o con 3 decimales, observaciones de 501 y presentación a medias se rechazan;
  promoción vacía o 0 se acepta; todo o nada; no se falsea `usuario_id`; no se cambian columnas
  (solo quitar); aislamiento C1/C2/admin igual que `010`; `anon` no lee, no crea ni ejecuta la
  función; la función devuelve **1 valor `text[]`** con **más de 1,000** elementos sin truncar,
  igual al catálogo activo, sin repetidos, ordenado, sin servicios/obsoletos/sin precio, sin
  claves, precios ni áreas; nadie lee `catalogo_propio`; reglas sin cambios; sin "infinite
  recursion". Termina con `rollback`.
- App (sin librerías nuevas):
  - `src/app/visitas/[id]/CapturaManual.tsx` (reescrito): formulario de **4 campos**. Artículo con
    sugerencias (combobox existente); al elegir una, el foco pasa a Precio regular. Precios con
    `inputMode="decimal"` (no `type="number"`), punto o coma, 2 decimales, limpieza al escribir y
    al pegar, "$" a la izquierda. Promoción con "(opcional)" en la etiqueta, "Opcional" dentro de la
    caja (gris `#5c5c5c`, 6.6:1) y la ayuda "Si es 2x$42, anota 21 y escribe 2x42 en
    observaciones". Enter avanza (`enterKeyHint`); en Observaciones, agrega. Botón grande
    **"Agregar"** desactivado mientras falte algo, con "Falta: precio regular" debajo. Al agregar:
    lista compacta de una línea (artículo · $ precio · promo), formulario limpio y foco en
    Artículo (el foco se mueve en el mismo toque, así el teclado no se cierra). Tocar un producto lo
    sube al formulario ("Guardar corrección" / "Cancelar corrección"); "Quitar" con "Deshacer".
    **"Guardar datos (N productos)"** = un insert (todo o nada). Avisos sin bloquear: precio 0,
    promoción ≥ regular, precios de más de $10,000. Filas guardadas en solo lectura, compactas,
    con "Quitar" (las filas viejas de `010` muestran además contenido, marca, área y promoción).
    Se quitaron de la pantalla área, marca, cantidad, unidad, piezas, tipo de promoción y
    "Duplicar fila".
  - Sugerencias: `supabase.rpc("articulos_captura")` **una vez** al abrir la sección; la lista vive
    solo en memoria (no en `localStorage`). Si falla, aviso + "Volver a cargar sugerencias" y la
    captura sigue con texto libre.
  - `src/lib/capturas.ts` (reescrito): `limpiarPrecio`, `limpiarPrecioPegado`, `leerPrecio`,
    `faltantes`/`textoFalta`, `avisosProducto`, `productoParaGuardar` (solo las 6 columnas del
    formulario), filtro de sugerencias (mín. 2 letras, máx. 6, todas las palabras en cualquier
    orden, primero las que empiezan, sin mayúsculas ni acentos; normaliza el catálogo una sola
    vez), borrador **v2** (formulario + lista) y textos de filas guardadas. Los borradores del
    formato anterior (clave `v1`) se ignoran sin errores.
  - `src/components/CampoSugerencias.tsx`: hasta 6 sugerencias; `alEnter` (Enter sin sugerencia
    marcada pasa al siguiente campo), `aria-required`, ref por objeto (`campoRef`).
  - `src/lib/capturas.test.ts` (reescrito): 17 pruebas.
  - `src/lib/tipos.ts`: columnas nuevas, presentación nula, `Insert` de la captura rápida y la
    función `articulos_captura`.
  - `noindex`, tema (fondo blanco, letras negras, rojo en botones principales) y `cacheComponents`:
    sin cambios (mismas clases de `globals.css`; la sección sigue cerrando la pregunta de
    "Quitar" al esconderse y re-pidiendo la lista si se escondió a medio cargar).
- Docs: `PLAN.md` (1, 4.1, 4.3, 4.4, 5 y 8), `PLAN_ETAPA2.md` (5.0, siguiente número libre `012`,
  9.5: opcional, los agentes no ven estas filas, pista de equivalencia), `RESUMEN_PROYECTO.md` y
  este archivo.

**⚠️ ORDEN DE DESPLIEGUE (no cambiar):**
1. **`010`** (solo si aún no se ha ejecutado en ESTE proyecto; la consulta de diagnóstico de
   "Corrección de la prueba de 010" lo dice) → 15 filas `ok = true`.
2. **Prueba `010b`** (`supabase/pruebas/010b_prueba_capturas_manuales.sql`) → `0. RESUMEN` con
   `ok = true` (46 casos).
3. **`011`** (`supabase/011_captura_rapida.sql`) → 13 filas `ok = true`. La fila 9 debe decir
   cuántos artículos hay (más de 3,000 si el catálogo ya está cargado). La app publicada sigue
   funcionando (es aditiva).
4. **Prueba nueva** (`supabase/pruebas/011_prueba_captura_rapida.sql`) → `0. RESUMEN` con
   `ok = true` (44 casos).
5. **Push** de la app y esperar **Ready** en Vercel (Deployments).
6. Probar en el celular (abajo).

**Qué casos de `010b` dejan de aplicar después de `011`** (por eso se corre ANTES):
- Probado en local: **`010b` sigue pasando 46/46 después de `011`** (ningún caso se rompe: `011`
  solo afloja o agrega). Pero describe el formulario anterior:
  - **2** (normalización 1.5 kg × 2) y **22–24, 27** (unidad, cantidad y piezas inválidas): siguen
    siendo reglas de la base, pero la app ya no manda presentación. Las filas nuevas no tienen
    `unidad_base` ni `contenido_base`.
  - **29–34** (tipos y condiciones de promoción): la app ya no usa `promo_tipo`; la promoción va
    en `promo_precio_pieza`, que `010b` no prueba.
  - **38–42** (`sugerencias_captura`: áreas y marcas): la app ya no la llama; la de artículos es
    `articulos_captura()`, que `010b` no prueba.
  - **1, 4, 7, 8, 10–11, 34, 35**: insertan siempre con `cantidad` y `unidad`; no prueban que
    ahora se puedan omitir.
  - Lo que `010b` **no** sabe y la prueba `011` sí revisa: presentación opcional, observaciones
    hasta 500 (no 300), `articulo_de_lista`, `promo_precio_pieza` y la función de artículos.
- Además, la **comprobación final de `010`** (si se vuelve a ejecutar `010` después de `011`)
  marca `false` en la fila 14 (ver "Avisos permanentes"). Volver a ejecutar `010` **no** deshace
  `011` (no vuelve a poner los `not null` ni la regla de 300).

**Cómo probarlo (paso 6, en el celular):**
1. Campo 1: abrir una visita suya → "Datos del levantamiento (manual)". En **Artículo** escribir
   `coca` → salen hasta 6 artículos de nuestro catálogo con "coca"; escribir `coca zero` → se
   reduce. Tocar uno → se llena y el cursor pasa a **Precio regular** sin cerrar el teclado.
2. En Precio regular sale el **teclado numérico con punto**. Escribir `18,50` → se acepta; intentar
   letras o un tercer decimal → no aparecen. Copiar y pegar `$1,234.50` → queda `1234.50`.
3. Debajo de "Agregar" dice "Falta: …" mientras falte algo; con artículo y precio se activa.
   Enter → pasa a Promoción (dice "Opcional" en gris) → Enter → Observaciones → Enter → se agrega.
4. El producto aparece en "Por guardar" en una línea; el formulario queda vacío con el cursor en
   Artículo. Escribir un artículo que **no** esté en la lista → se respeta tal cual.
5. Precio regular `0` o promoción mayor que el regular o `20000` → aviso amarillo, pero deja
   agregar. Tocar un producto de la lista → sube al formulario → cambiar el precio → "Guardar
   corrección". "Quitar" → "Deshacer" lo regresa.
6. Recargar la página antes de guardar → el navegador avisa; al volver, la lista y el formulario
   siguen ahí. "← Volver a la lista" también pregunta.
7. "Guardar datos (N productos)" → "Se guardaron N productos" y aparecen en "Guardados".
   "Quitar" en uno guardado → "¿Quitar este producto?" → "Sí, quitar".
8. Modo avión **antes** de abrir la sección → aviso "No se cargaron las sugerencias…" y se puede
   capturar igual a mano; "Guardar datos" sin red → error claro y la lista sigue ahí.
9. Campo 2 no ve los datos de Campo 1. Admin: ve los guardados de cualquier visita y escribe solo
   en las suyas.
10. En Supabase → Table Editor → `capturas_manuales`: las filas nuevas tienen `cantidad` y `unidad`
    vacías, `articulo_de_lista = true` solo en las elegidas de la lista sin editar, y
    `promo_precio_pieza` cuando se anotó.

**Decisiones tomadas por el agente (y por qué):**
- **Columna nueva `promo_precio_pieza`** en lugar de `promo_precio_total` (ver BLOQUE 2).
- **CHECK "cantidad y unidad juntas"** (no se pidió): con la presentación opcional, evita filas con
  "600" sin unidad. Todas las filas de `010` lo cumplen.
- **`piezas` también deja de ser obligatoria** ("etc." de la petición), con su default 1.
- **Tope de 7 enteros en los precios** (hasta 9,999,999.99): así la promoción nunca puede chocar
  con el límite de la base y **nunca** bloquea agregar.
- **Al pegar**, el último separador es el decimal ("$1,234.50" → 1234.50); al escribir, cuenta el
  primero (un punto de más se ignora).
- **`articulos_captura()` sin `service_role`** ("ejecutable ÚNICAMENTE por authenticated"); el
  proceso de la Etapa 2 no la necesita. Sin revisar `auth.uid()` dentro: el permiso ya la limita y
  así la comprobación (SQL Editor) puede contar sus elementos.
- **Corregir un producto lo sube al formulario** (sale de la lista mientras se corrige; "Cancelar
  corrección" lo regresa igual). "Quitar" de la lista sin confirmación, con "Deshacer".
- **"Guardar datos" guarda solo la lista**; si el formulario tiene algo sin agregar, se queda ahí y
  el mensaje lo dice.
- **El formulario se ve ANTES de los guardados** (lo primero en la tienda es capturar).
- **Borradores `v1` no se borran** del celular: solo se ignoran (lo pedido).

**Riesgos y límites conocidos:**
- La lista de artículos pesa ~100–150 KB (más de 3,000 descripciones) y se pide una vez al abrir
  la sección. Con mala señal puede tardar; mientras tanto se escribe a mano.
- Si la red se corta **después** de que Supabase guardó pero antes de recibir la respuesta, la
  lista se conserva y al reintentar se duplicarían filas (igual que en `010`). Se ven en
  "Guardados" al recargar y se pueden quitar.
- Si alguien sigue usando la app **vieja** después de que se guarden filas nuevas, sus tarjetas
  de esas filas muestran un contenido vacío/raro (no se rompe). Se resuelve con el push (paso 5).
- **No probado en el navegador ni contra Supabase real** (no se debía consultar Supabase). Probado
  en local con PGlite (Postgres en WASM, el mismo arnés de `008b`/`010` reutilizado del
  scratchpad, **no es Supabase**): `001`→`009` reales; sin `010`, `011` se detiene con su freno;
  `010` → `010b` 46/46 → `011` dos veces seguidas (13/13 `ok`) → prueba `011` **44/44** → `010b`
  otra vez 46/46; pruebas `008` (55/55) y `009` (12/12) siguen pasando. `npm run lint` ✅,
  `npm run build` ✅, `npm run test:capturas` 17/17 ✅, `test:errores` 10/10 ✅, `test:etapa2`
  14/14 ✅.

**Commit:** ver `git log` — `Captura rápida de productos (011): 4 campos, sugerencias de artículo y docs`

---

## Editar y borrar lo capturado (2026-11-25) — 🟡 falta ejecutar `012`, desplegar y probar

Ampliación de la fase de captura, **fuera del plan original**, pedida por el usuario. La `011`
**no se ha ejecutado** pero ya estaba probada: por pedido del usuario **no se editó**; todo va en
una migración **nueva** `012` que se ejecuta **después**. **No** se ejecutó nada en Supabase,
**no** se leyó `.env.local` ni `datos-privados/`, **no** se instaló nada, **no** se empezaron
fases 🤖 ni se llamó a la API de Anthropic.

**Reglas de negocio:** borrar = descartar (`descartada_at`), nunca `DELETE`. Campo: edita y borra
solo lo que creó; no edita ni restaura lo borrado. Admin: edita, borra y restaura todo. Lo
borrado no le aparece al personal de campo (ni fotos ni productos de una visita borrada). La
decisión "el personal de campo no modifica visitas" queda **reemplazada solo para cambiar la
tienda** (y borrar = descartar), y solo si ningún agente leyó sus fotos.

**Qué se hizo:**
- `supabase/012_editar_borrar.sql` (**aditiva**, repetible, una transacción, freno si falta
  `010`/`011`/`008b`):
  - BLOQUE 1: `visitas.descartada_at`; `capturas_manuales.actualizado_at` y `actualizado_por`.
  - BLOQUE 2: `privado.es_dueno_de_visita` ya no cuenta visitas borradas (así sus fotos, archivos
    y productos desaparecen para el dueño y no puede agregar nada); `competidor_en_visita_visible`
    igual; **nueva** `privado.visita_sin_fotos_leidas(uuid)` (security definer, `search_path`
    vacío; lee fotos sin RLS).
  - BLOQUE 3: triggers. Productos (reemplaza el de `010`): `descartada_at` = hora del servidor y
    no se puede cambiar después; al borrar no se cambia el contenido en la misma operación;
    `actualizado_at/_por` = `now()`/`auth.uid()`. Visitas (nuevo): lo mismo para `descartada_at`;
    al borrar no se cambia la tienda; si la **app** (rol `authenticated`) cambia la tienda, debe
    estar activa (`privado.competidor_activo`).
  - BLOQUE 4: permisos por columna. `visitas`: `update (competidor_id, descartada_at)`.
    `capturas_manuales`: `update (articulo, articulo_de_lista, precio_regular,
    promo_precio_pieza, observaciones, descartada_at)`. Sin `DELETE`; `anon` sin nada.
  - BLOQUE 5: reglas. Lectura de visitas y productos: el personal de campo no ve lo borrado (ver
    "Decisiones"). UPDATE del dueño (suya, no borrada; en visitas, sin fotos leídas) y del admin
    (cualquiera, también restaurar) en visitas y productos; admin quita/restaura cualquier foto.
    La regla "authenticated descarta sus capturas" de `010` se reemplaza por "authenticated edita
    o borra sus capturas". Ninguna regla consulta otra tabla directo.
  - BLOQUE 6: comprobación (solo lee): 13 filas `ok`.
- `supabase/pruebas/012_prueba_editar_borrar.sql`: freno + **47 casos** con datos inventados,
  roles simulados con JWT, termina con `rollback`. Cubre todo lo pedido (dueño edita lo suyo; otro
  no edita ni borra lo ajeno → 0 filas; admin edita, borra y restaura; dueño no restaura ni edita
  lo borrado; no se cambia `usuario_id`, `visita_id` ni `created_at`; no se falsea
  `descartada_at` ni `actualizado_por`; visita con fotos leídas → 0 filas; tienda inactiva →
  rechazada; sin `DELETE`; `anon` nada; sin "infinite recursion"), más: lo borrado desaparece en
  la siguiente petición (lista, conteo, fotos y productos), no se escribe en una visita borrada,
  el admin cambia la tienda con fotos leídas, quita y restaura fotos leídas.
- `supabase/012b_etapa2_sin_visitas_borradas.sql` (**aparte, para revisar; no es obligatorio
  para la app**): `lecturas_analisis` y `comparacion_precios` con **una línea nueva** cada una
  (`and v.descartada_at is null`) y `guardar_lecturas` que rechaza fotos quitadas o de visitas
  borradas. Se revisó todo lo que usa fotos en la Etapa 2 (lista en su encabezado). El proceso que
  arma lotes aún no existe: la regla quedó en PLAN_ETAPA2 sección 7.
- App (sin librerías nuevas):
  - `src/app/visitas/[id]/AccionesVisita.tsx` (nuevo; reemplaza a `CorregirTienda.tsx`, borrado):
    "Cambiar tienda" y "Borrar visita" (diálogo "¿Borrar esta visita?") para el dueño y el admin;
    si hay fotos leídas, el dueño ve: "Esta visita ya no se puede cambiar ni borrar porque ya se
    leyeron los precios de sus fotos…". Visita borrada (solo admin): "Borrada …" y "Restaurar
    visita". Un update directo; 0 filas → se revisa por qué y se explica.
  - `src/components/DialogoConfirmar.tsx` (nuevo): diálogo como el de las fotos (Cancelar / botón
    rojo, 48 px).
  - `CapturaManual.tsx`: productos guardados con **"Editar"** (sube al mismo formulario de 4
    campos; "Guardar cambios" = un solo update; lo que había en el formulario se aparta y regresa
    al terminar) y **"Borrar"** ("¿Borrar este producto?", Cancelar / Borrar). Admin: ve también
    los borrados ("Borrado", tachado) con "Restaurar", y "👤 quién lo creó" (con
    `admin_correos_usuarios`, que ya existía; no se abre `auth.users`). 0 filas → aviso y se
    recarga la lista. En una visita borrada no se agregan productos.
  - `FotosVisita.tsx` / `ConfirmarQuitar.tsx`: el admin quita **cualquier** foto (aviso extra si
    ya se leyó); en una visita borrada no se ofrece subir fotos.
  - `ListaVisitas.tsx`: el admin ve las visitas borradas marcadas "Borrada · toca para
    restaurar". Al personal de campo la base no se las manda (ni cuentan).
  - `DetalleVisita.tsx`: usa `AccionesVisita` y pasa "visita borrada" a fotos y captura.
  - `src/lib/tipos.ts`: `visitas.descartada_at` y su `Update`; `capturas_manuales.actualizado_*`
    y su `Update`; comentarios.
  - Errores con el criterio actual (`src/lib/errores.ts`: red, sesión con botón, Supabase con
    código) y el caso de 0 filas.
- Docs: `PLAN.md` (1, fuera de alcance, 4.1, 4.3, 4.4, 5, 8), `PLAN_ETAPA2.md` (5.0, número libre
  `013`, sección 7 lotes, 9.5), `RESUMEN_PROYECTO.md` y este archivo.

**⚠️ ORDEN DE DESPLIEGUE (no cambiar). Migraciones → pruebas → push → Ready:**
1. `010` (solo si aún no se ejecutó en ESTE proyecto) → 15 filas `ok`.
2. Prueba `010b` → `0. RESUMEN` `ok` (46 casos). **Debe ir antes de `012`.**
3. `011` → 13 filas `ok`.
4. Prueba `011` → `0. RESUMEN` `ok` (44 casos). **Debe ir antes de `012`.**
5. `012` (`supabase/012_editar_borrar.sql`) → 13 filas `ok`. La app publicada sigue funcionando.
6. Prueba `012` (`supabase/pruebas/012_prueba_editar_borrar.sql`) → `0. RESUMEN` `ok` (47 casos).
7. *(Opcional, después de revisarlo)* `012b` → 4 filas `ok`. No cambia nada de la app.
8. **Push** de la app y esperar **Ready** en Vercel.
9. Probar en el celular (abajo).

**Qué pruebas viejas dejan de aplicar después de `012`** (comprobado en local):
- **`010b`: no se debe correr después de `012`.** Su freno espera exactamente 3 reglas en
  `capturas_manuales` (ahora hay 4) y se detiene diciendo, por error, que falta `010`. Además, sus
  casos 14 ("C1 NO cambia el precio de su fila") y 18 ("El admin NO quita filas de C1") esperan lo
  contrario de lo que ahora se permite (por eso fallarían aunque se saltara el freno).
- **Prueba `011`: no se debe correr después de `012`.** Fallan el caso 22 ("C1 NO cambia
  articulo_de_lista ni la promoción") —ahora sí puede— y el 43 ("Reglas RLS sin cambios (las 3 de
  010)"). Los otros 42 siguen pasando.
- **Prueba `008`:** falla solo el caso 9 ("C1 NO modifica su visita"): ahora sí puede cambiar la
  tienda. Todos los demás pasan.
- **Prueba `009`** (12/12) y **`006`** siguen pasando. (La prueba `007` ya fallaba desde `009`,
  porque prueba a `anon`; `012` no cambia eso.)

**Cómo probarlo (paso 9):**
1. Campo 1, visita suya **sin** fotos leídas: "Cambiar tienda" → elegir otra → "Guardar" → cambia
   el título. "Borrar visita" → "¿Borrar esta visita?" → "Cancelar" (no pasa nada) → otra vez →
   "Borrar" → regresa a la lista y la visita ya no aparece.
2. Producto guardado → "Editar" → se llena el formulario → cambiar el precio → "Guardar cambios" →
   "Se guardaron los cambios" y la línea dice "editado …". "Borrar" → "¿Borrar este producto?" →
   "Borrar" → desaparece.
3. Admin: en la lista, la visita borrada sale "Borrada · toca para restaurar" → abrirla →
   "Restaurar visita" → Campo 1 la vuelve a ver con sus fotos y productos. En los productos, el
   borrado sale tachado con "Restaurar". Ve "👤" de quién creó cada producto.
4. Admin: en una visita de Campo 1, "Editar" y "Borrar" un producto suyo; ✕ en una foto ya leída
   → la quita (se restaura en "Fotos quitadas").
5. Visita con una foto ya leída por un agente (solo se puede simular desde el panel cambiando
   `estado_proceso`): Campo 1 ve el mensaje "ya no se puede cambiar ni borrar".
6. Campo 2 no ve nada de Campo 1. Modo avión al guardar una edición → mensaje de red, el formulario
   sigue lleno.

**Decisiones tomadas por el agente (y por qué):**
- **Regla de lectura con `descartada_at = now()`:** Postgres exige que la fila **nueva** de un
  `update … returning` (lo que hace supabase-js con `.select()`) pase la regla de lectura. Si la
  regla escondiera todo lo borrado, "Borrar" fallaría con *new row violates row-level security
  policy* (**comprobado en local** quitando esa parte). Con `now()` (hora de inicio de cada
  transacción, igual a la que pone el trigger) la fila solo se ve dentro de la operación que la
  borra; en cualquier petición siguiente ya no.
- **Tienda activa revisada en un trigger y solo para la app (rol `authenticated`):** así el admin
  puede restaurar una visita aunque su tienda ya esté desactivada, y desde el SQL Editor o el
  panel se pueden corregir datos a mano como antes (la prueba `008` lo hace).
- **El admin cambia la tienda con un update directo** (misma regla para todos); la función
  `admin_cambiar_competidor` se queda en la base (anotado en pendientes).
- **"Fotos leídas" cuenta también las fotos quitadas** (si un agente ya leyó una foto y luego se
  quitó, la visita ya entró a la Etapa 2).
- **Borrar una visita no toca sus fotos ni productos:** solo se esconden; al restaurarla vuelven
  todos. Reversible.
- **Al editar un producto guardado, lo que había en el formulario se aparta** y regresa al
  terminar (no se pierde una captura a medias). No se puede editar mientras se corrige un producto
  de la lista.
- **El dueño no edita productos de su visita si la visita está borrada** (no la ve).

**Riesgos y límites conocidos:**
- Carrera mínima: si un agente marca una foto `en_lote` en el mismo instante en que el dueño borra
  la visita, podrían pasar las dos cosas. El proceso de lotes (aún no existe) debe filtrar visitas
  borradas en su mismo `update` (PLAN_ETAPA2 sección 7) y `guardar_lecturas` las rechaza (`012b`).
- La app publicada (sin `012` en la app) no muestra "Editar" ni marca lo borrado para el admin
  hasta el push; nada se rompe.
- **No probado en el navegador ni contra Supabase real.** Probado en local con PGlite (Postgres en
  WASM, **no es Supabase**): sin `011`, `012` se detiene con su freno; `012` dos veces seguidas
  (13/13 `ok`); prueba `012` **47/47**; `012b` dos veces (4/4) y comprobación de comportamiento
  (lecturas de una visita borrada desaparecen; `guardar_lecturas` rechaza); pruebas viejas como se
  describe arriba. `npm run lint` ✅, `npm run build` ✅, `test:capturas` 17/17, `test:errores`
  10/10, `test:etapa2` 14/14.

**Commit:** ver `git log` — `Editar y borrar lo capturado (012): descartar, restaurar, app y docs`

---

## Lista de visitas por día con conteos de fotos y artículos (2026-11-25) — 🟡 falta publicar y probar en el celular

Cambio **solo de la app**, fuera del plan original, pedido por el usuario. **No** se cambiaron
tablas, reglas ni migraciones, **no** se ejecutó nada en Supabase, **no** se leyó `.env.local`
ni `datos-privados/`, **no** se usó la secret key y **no** se instaló nada.

**Qué se hizo:**
- La pantalla principal agrupa las visitas por **día de ingreso** (`visitas.created_at`) en hora
  de México (`America/Mexico_City`, con `Intl.DateTimeFormat`; una visita de las 8 pm no cae en el
  día siguiente). Títulos: "Hoy", "Ayer" y luego "lunes 23 de noviembre" (con " de 2025" si no es
  del año actual). Días y visitas de la más reciente a la más antigua; cada visita con su hora.
- Encabezado de cada día (se queda arriba al bajar): "3 visitas · 24 fotos · 41 artículos", con
  singular y plural. Si el admin tiene visitas borradas ese día, se agrega "· 1 borrada".
- Cada visita: tienda, hora, "📷 N fotos" y "📝 N artículos". Sin fotos o sin artículos → aviso
  amarillo discreto "Sin fotos" / "Sin artículos". Admin: "👤 quién la creó" (con
  `admin_correos_usuarios`, que ya existía; no se abre `auth.users`). Toda la tarjeta abre la visita.
- Conteos en la **misma consulta** con PostgREST: `fotos(count)` y `capturas_manuales(count)`
  filtrando `fotos.descartada_at is null` y `capturas_manuales.descartada_at is null`. Ese filtro
  va sobre el recurso **anidado** (sin `!inner`), así que **no quita visitas**: las que no tienen
  fotos o artículos salen con 0 (se revisó la URL que arma supabase-js). Visitas borradas: el
  personal de campo no las recibe (regla de la base, `012`); el admin las ve atenuadas, con línea
  tachada y "Borrada … · toca para restaurar", y **no suman** a los totales del día.
- **Carga por tramos de 14 días** (la API corta cada respuesta en 1,000 filas): cada tramo va de
  medianoche a medianoche (hora de México), así **un día nunca queda partido**. Los tramos son
  intervalos pegados `[desde, antesDe)`: no se repite ni se salta nada. Dentro de un tramo se piden
  páginas de **500** filas (menos que el corte, para no confundir un corte del servidor con "ya no
  hay más") avanzando "después de la última fila" (`created_at`, `id`), no por número de fila.
  **"Ver días anteriores"** trae el siguiente tramo; si hay semanas sin visitas, salta directo al día
  de la visita más antigua que sí existe. Si ya no hay más, el botón desaparece y dice "No hay más
  visitas".
- **Datos al día:** la lista se lee en el navegador al abrir la pantalla y, al volver de una visita,
  se lee de nuevo (ya lo hacía `ReiniciarAlSalir`, necesario por `cacheComponents`). Los conteos
  reflejan fotos subidas y artículos agregados o borrados sin recargar el navegador.
- **Robustez:** si falla el conteo de artículos con un error de Supabase (por ejemplo, la tabla de
  `010` aún no existe en esa base → `PGRST200`), la lista se vuelve a pedir **solo con fotos** y
  sale un aviso discreto con el código; los tramos siguientes ya no piden artículos. Fallas de red
  o de sesión no se confunden con eso: se muestran con el criterio actual (mensaje de red; sesión
  caducada con "Iniciar sesión otra vez"; Supabase con código) y "Reintentar". Si falla "Ver días
  anteriores", lo ya cargado se queda y el botón dice "Reintentar: ver días anteriores".
- Diseño: tema actual, encabezados de día en negritas con línea negra, tarjetas compactas, botones
  de 48 px y tarjetas de más de 44 px, texto de 16 px o más.

**Archivos creados o cambiados:**
- `src/lib/listaVisitas.ts` (nuevo) — lógica pura: día en México, títulos, horas, plurales,
  agrupar y totales, carga por tramos y páginas, respaldo sin artículos.
- `src/lib/listaVisitas.test.ts` (nuevo) — 25 pruebas con datos inventados (`npm run test:lista`).
- `src/app/ListaVisitas.tsx` — la pantalla nueva (las consultas a Supabase y el diseño).
- `package.json` — script `test:lista` (sin librerías nuevas).
- `docs/PLAN.md` (sección 5, fila `/`), `docs/RESUMEN_PROYECTO.md` y este archivo.
- `src/lib/tipos.ts` **no** cambió: las relaciones `fotos → visitas` y `capturas_manuales → visitas`
  ya estaban; los conteos se leen con su propio tipo (`FilaCruda`).

**Pasos que hizo el usuario a mano:**
- Ninguno todavía. Falta publicar (push) y probar en el celular.

**Cómo probarlo:**
1. `npm run test:lista` → 25/25. (Cubre: 23:30 y 00:30 en México, "Hoy"/"Ayer", totales,
   singular/plural, borrados que no suman, visitas con 0, tramos sin repetir ni saltar ni partir
   días, más de 1,000 visitas en un día, una visita nueva a mitad de la carga, semanas vacías,
   falla del conteo de artículos y fallas de red/sesión.)
2. En el celular (campo): la lista sale por días con sus totales. Abrir una visita, subir una foto
   y agregar un artículo → "← Volver a la lista" → los números ya cambiaron, sin recargar.
3. Borrar un artículo → volver → baja el número. Una visita nueva sin nada sale con "Sin fotos" y
   "Sin artículos".
4. Admin: ve "Todas las visitas", "👤" en cada una, y las borradas atenuadas que no suman al día.
5. Si hay visitas de hace más de 14 días: "Ver días anteriores" las trae; al final, "No hay más visitas".

**Decisiones tomadas (y por qué):**
- **No hizo falta cambiar la base** (ni una vista para los conteos): el conteo anidado de PostgREST
  ya respeta las reglas de acceso de cada tabla (campo ve solo lo suyo; admin todo) y filtra lo
  descartado. La app ya usaba `fotos(count)` así.
- **Tramos que saltan semanas vacías:** para que "Ver días anteriores" nunca muestre un tramo vacío.
  Cuesta una consulta pequeña extra por tramo (la visita más reciente antes del tramo, 1 fila).
- **La primera carga no tiene tope de arriba:** si el reloj del celular va atrasado, una visita
  recién guardada no se pierde.
- **Al volver a la lista se regresa al primer tramo** (14 días): es lo que asegura que los conteos
  estén al día. Si se habían abierto días anteriores, hay que volver a tocar el botón.
- "Borrada" (no "Borrado") en las visitas, igual que en la fase de editar y borrar.

**Problemas encontrados / pendientes:**
- **No probado en el navegador ni contra Supabase real** (no se ejecutó nada en Supabase). La
  lógica está probada con datos inventados y la URL de la consulta se revisó sin conectarse.
- `npm run lint` ✅, `npm run build` ✅, `test:lista` 25/25, `test:errores` 10/10,
  `test:capturas` 17/17, `test:etapa2` 14/14.

**Commit:** ver `git log` — `Lista de visitas por día con conteos de fotos y artículos (solo app)`
