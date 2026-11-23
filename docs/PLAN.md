# PLAN — App de levantamiento de precios (Etapa 1)

> **Para cualquier agente que lea esto:** este archivo es la guía del proyecto.
> Antes de hacer nada, lee **todo** este archivo y después `docs/PROGRESO.md`.
> Trabaja **solo en la fase que te toca** (la primera que no esté marcada como ✅ en `PROGRESO.md`).

---

## 1. Qué estamos construyendo

Una **app web para celular** (se abre desde un link, no se instala) que usa el
personal que visita tiendas de la competencia. Sirve para registrar cada visita
y subir las fotos de los precios a un lugar central, en vez de mandarlas por WhatsApp.

Flujo del usuario:

1. Toma sus fotos con la **cámara normal del celular**. La app **no** abre la cámara,
   para evitar problemas de compatibilidad.
2. Abre el link de la app y toca **"Nueva visita"**.
3. Elige el **competidor** de una lista. La lista sale de la base de datos.
4. Toca **"Guardar mi ubicación"**. El celular da la latitud y longitud solo.
5. Toca **"Guardar visita"**.
6. En la pantalla de la visita, toca la **zona de fotos**. Se abre su galería, elige
   varias fotos y se suben.
7. Puede ver la **lista de visitas**, entrar a cualquiera y **agregar más fotos**.

Cada paso guarda **fecha y hora** de forma automática (timestamps).

### Fuera de alcance (no lo hagas)
- **Login de usuarios.** La app es abierta: cualquiera con el link puede usarla.
- **Etapa 2:** convertir las fotos en una tabla de artículos y precios, y la revisión
  de esa información. Las tablas sí deben permitir agregarla después sin rehacer nada.
- Nombre de la sucursal. Solo importa su ubicación.
- Editar o borrar visitas o fotos desde la app.

---

## 2. Decisiones ya tomadas (NO cambiar)

Estas decisiones las confirmó el usuario. **Ningún agente debe cambiarlas ni
proponer otro lenguaje o framework.**

| Pieza | Decisión |
|---|---|
| Lenguaje | **TypeScript** |
| Framework | **Next.js con App Router** (la versión estable más reciente al iniciar la Fase 1) |
| Estilos | **Tailwind CSS** |
| Base de datos | **Supabase** (tablas Postgres) |
| Archivos (fotos) | **Supabase Storage**, bucket `fotos` |
| Despliegue | **Vercel** |
| Usuarios | **Sin login** |
| Gestor de paquetes | **npm** |

Si necesitas instalar **cualquier otra librería**, primero explícale al usuario para
qué sirve y espera a que diga que sí.

---

## 3. Reglas para todos los agentes

1. **Lee primero** `docs/PLAN.md` y `docs/PROGRESO.md`.
2. **Haz solo tu fase.** Si ves algo de otra fase, anótalo en "Pendientes" de
   `PROGRESO.md` y no lo hagas.
3. **NUNCA leas, muestres, copies ni subas `.env.local`.** Tampoco lo imprimas con
   `cat`, `echo`, logs, etc. Solo puedes referirte a los **nombres** de las variables
   (sección 6).
4. **El usuario es desarrollador junior.** Antes de cada paso, explícale con palabras
   simples qué vas a hacer y por qué. Si usas un término técnico, defínelo en una línea.
5. Si algo no está claro, **pregunta al usuario**. No lo inventes.
6. Si un paso lo tiene que hacer el usuario a mano (por ejemplo, en el panel de
   Supabase o de Vercel), dale instrucciones numeradas, una acción por paso, y dile
   cómo comprobar que quedó bien.
7. Al terminar tu fase:
   - Verifica que funcione (ver "Cómo comprobar" de tu fase).
   - Corre `npm run build` y `npm run lint` (de la Fase 1 en adelante), y que no fallen.
   - Actualiza `docs/PROGRESO.md` con la plantilla que trae ese archivo.
   - Haz **un commit** en git con un mensaje claro, por ejemplo `Fase 3: lista y creación de visitas`.
     **No hagas push** a menos que el usuario te lo pida.
8. Todo lo que el usuario ve en la app va **en español**.
9. Las fechas se guardan en UTC (`timestamptz`) y se **muestran** en hora de México
   (`America/Mexico_City`).

---

## 4. Diseño de datos

### 4.1 Tablas

**`competidores`**: la lista de opciones que el usuario elige.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` identity, PK | |
| `nombre` | `text`, único, no nulo | Ej. "Neto" |
| `activo` | `boolean`, default `true` | Si es `false`, **no aparece** en la app |
| `orden` | `int` | Orden en que aparece en la lista |
| `created_at` | `timestamptz`, default `now()` | |

**`visitas`**: una fila por cada visita a una tienda.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid`, PK, default `gen_random_uuid()` | También es el nombre de la carpeta de fotos |
| `competidor_id` | `bigint`, FK → `competidores.id`, no nulo | |
| `latitud` | `double precision` | |
| `longitud` | `double precision` | |
| `precision_metros` | `double precision` | Qué tan exacta fue la ubicación |
| ~~`competidor_elegido_at`~~ | ~~`timestamptz`~~ | **Se quita en la Etapa 2 (E2-1).** La app ya no la escribe ni la lee; la columna se borra con `supabase/003_quitar_competidor_elegido_at.sql` (lo ejecuta el usuario **después** de desplegar la app nueva) |
| `ubicacion_at` | `timestamptz` | Momento en que guardó la ubicación (reloj del celular) |
| `created_at` | `timestamptz`, default `now()` | Momento en que se guardó la visita (reloj del servidor, es el dato confiable) |

**`fotos`**: una fila por cada foto subida.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid`, PK, default `gen_random_uuid()` | |
| `visita_id` | `uuid`, FK → `visitas.id`, no nulo | **Etapa 2 (E2-2, `004`):** `on delete cascade` (borrar una visita en Table Editor borra sus filas de fotos; los archivos de Storage se borran a mano) |
| `ruta` | `text`, único, no nulo | Ruta dentro del bucket, ej. `visitas/<visita_id>/<uuid>.jpg` |
| `nombre_original` | `text` | Nombre del archivo en el celular |
| `tamano_bytes` | `int` | Tamaño ya comprimido |
| `capturada_at` | `timestamptz` | **Etapa 2 (E2-1, `002_fotos_hora_captura.sql`).** Hora en que se **tomó** la foto (EXIF), leída antes de comprimir. Nula si no se pudo leer |
| `capturada_origen` | `text` no nulo, default `'sin_dato'` | **Etapa 2 (E2-1).** `exif`, `exif_zona_celular` o `sin_dato` |
| `created_at` | `timestamptz`, default `now()` | Hora de **subida** (reloj del servidor) |

> Para la Etapa 2 (más adelante) se agregará una tabla de precios con referencias a
> `visitas` y `fotos`. **No la crees ahora.**
>
> **Etapa 2, Fase E2-2** (`004_tablas_competencia.sql`): `fotos` recibe columnas de estado
> de procesamiento y calidad (solo las escribe el servidor; ver PLAN_ETAPA2 5.2) y se crean
> las tablas de la competencia, todas cerradas a `anon`.
>
> **Cambios de la Etapa 2, Fase E2-1** (ver `docs/PLAN_ETAPA2.md`): se quita
> `visitas.competidor_elegido_at` y se agregan `fotos.capturada_at` y
> `fotos.capturada_origen`, con migraciones nuevas (`002_...` y `003_...`; las tablas de
> arriba ya lo reflejan). ⚠️ Después de ejecutar `003`, **`001_esquema.sql` ya no se puede
> volver a ejecutar tal cual**: su `grant insert (...)` nombra la columna borrada y falla
> (el SQL Editor deshace todo el archivo, así que no deja nada a medias). Los archivos
> viejos no se editan; si algún día hace falta recrear la base, se ejecutan en orden y se
> salta ese `grant` (lo reemplaza el de `002`/`003`).

### 4.2 Storage

- Bucket: **`fotos`**, **público para lectura**. Es lo más simple para mostrar las
  imágenes y son fotos de anaqueles, no datos sensibles.
- Ruta de cada foto: **`visitas/<visita_id>/<uuid-nuevo>.jpg`**. Así todas las fotos
  de una visita quedan en su propia carpeta, y el nombre único evita que una foto
  reemplace a otra.
  - **Carpeta = UUID de la visita** (`visitas.id`).
  - **Archivo = UUID nuevo** generado al subir (`crypto.randomUUID()`), **nunca** el
    nombre original del celular. Ese nombre solo se guarda en `fotos.nombre_original`.
- **Límite de tamaño:** **5 MB por archivo** (`file_size_limit`). Las fotos ya llegan
  comprimidas (Fase 5), así que casi siempre pesarán menos de 1 MB.
- **Solo imágenes:** tipos permitidos (`allowed_mime_types`): `image/jpeg`,
  `image/png`, `image/webp`. Cualquier otro tipo de archivo, Supabase lo rechaza.

### 4.3 Seguridad sin login (RLS)

RLS ("Row Level Security") son reglas en Supabase que dicen qué puede hacer alguien
que no ha iniciado sesión (el rol `anon`).

| Recurso | `anon` puede… | `anon` NO puede… |
|---|---|---|
| `competidores` | leer | crear, cambiar, borrar |
| `visitas` | leer, crear | cambiar, borrar |
| `fotos` | leer, crear | cambiar, borrar |
| Storage `fotos` | leer, subir archivos nuevos | reemplazar, borrar |

**Consecuencia de diseño:** como `anon` no puede **cambiar** una visita, la visita se
guarda **de una sola vez** (competidor + ubicación + timestamps) cuando el usuario
toca "Guardar visita". Antes de eso, todo vive en la pantalla.

### 4.4 Archivos SQL (se ejecutan a mano en el SQL Editor de Supabase)

```
supabase/
├── 001_esquema.sql          ← tablas, RLS, bucket y políticas de Storage
├── 002_..., 003_..., 004_... ← migraciones de la Etapa 2 (ver PLAN_ETAPA2 sección 5.0)
└── seed_competidores.sql    ← SOLO la lista de competidores (el usuario la va a editar)
```

`seed_competidores.sql` debe:
- Ser **fácil de editar**: una línea por competidor, con comentarios en español.
- Poder **ejecutarse varias veces** sin duplicar filas (`insert ... on conflict (nombre) do update`).
- Explicar en un comentario que, para **quitar** un competidor que ya se usó en
  visitas, se pone `activo = false` en lugar de borrarlo. Y que, para **renombrar**
  uno, se usa un `update`, porque si solo cambias el nombre en la lista se crea una
  fila nueva.

Lista **provisional** (el usuario la confirmará después):

| orden | nombre | activo |
|---|---|---|
| 1 | Fasti | true |
| 2 | Oxxo | true |
| 3 | Neto | true |
| 4 | 3B | true |
| 5 | Farmacias Guadalajara | true |
| 6 | Chedraui | true |
| 7 | POR CONFIRMAR | **false** (no aparece en la app hasta que el usuario lo corrija) |

---

## 5. Pantallas (rutas de Next.js)

| Ruta | Qué muestra |
|---|---|
| `/` | Lista de visitas (la más reciente primero): competidor, fecha y hora, número de fotos. Botón grande **"Nueva visita"**. |
| `/visitas/nueva` | Selector de competidor, botón **"Guardar mi ubicación"**, botón **"Guardar visita"**. Al guardar, lleva a la pantalla de la visita. |
| `/visitas/[id]` | Datos de la visita, **zona para subir fotos** y galería con las fotos ya subidas. |

Guía de diseño:
- Pensada para **celular primero**: botones grandes y fáciles de tocar con el pulgar,
  una sola columna y texto legible al sol.
- Mensajes claros de "cargando", "listo" y "error". Que el usuario siempre sepa qué está pasando.

---

## 6. Variables de entorno

Viven en `.env.local` (en tu computadora) y en Vercel (en producción). **No leas su
valor.** Nombres esperados:

| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | La dirección del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La llave pública ("anon" o "publishable"). Es pública a propósito, porque la protección la dan las reglas RLS |

⚠️ El agente de la Fase 1 debe **preguntarle al usuario** si sus variables se llaman
exactamente así. Si se llaman diferente, se usa el nombre que tenga el usuario y se
actualiza esta tabla.

🚫 **Nunca** se usa la llave `service_role` / `secret` en este proyecto.

> **Excepción de la Etapa 2 (2026-11-19):** el proceso que lee precios con Claude usa
> `SUPABASE_SECRET_KEY` y `ANTHROPIC_API_KEY`, **solo en código de servidor** y nunca con
> `NEXT_PUBLIC_`. La app (el navegador) sigue usando solo la llave pública. Ver
> `docs/PLAN_ETAPA2.md`, sección 4.

---

## 7. Fases

Cada fase la hace **un agente distinto**. Al terminar, el agente marca ✅ su fase en
`PROGRESO.md`.

### Fase 0 — Plan ✅
Escribir este `PLAN.md` y `PROGRESO.md`. Sin código.

### Fase 1 — Esqueleto del proyecto
**Objetivo:** proyecto Next.js que corre localmente y puede hablar con Supabase.
- Crear el proyecto con `create-next-app` en la carpeta actual, con TypeScript, App
  Router, Tailwind y ESLint, y la carpeta `src/`.
  La carpeta ya tiene `README.md`, `.gitignore` y `docs/`: **no los borres**. Si
  `create-next-app` se niega por archivos existentes, créalo en una carpeta temporal
  y mueve los archivos, **combinando** los `.gitignore` (deja la regla `.env*`).
- Agregar `!.env.example` al `.gitignore` y crear `.env.example` con **solo los nombres**
  de las variables y los valores vacíos.
- Instalar `@supabase/supabase-js` y crear un cliente en `src/lib/supabase.ts`.
- Página `/` provisional que diga "Levantamiento de precios" y muestre si la conexión
  a Supabase funciona. Para probarlo basta con que el cliente se cree sin error,
  porque las tablas todavía no existen.
- En `PROGRESO.md`, anotar la versión de Node y de Next.js que se usaron.

**Usuario hace:** `npm run dev` y abre `http://localhost:3000`.
**Cómo comprobar:** la página carga y no hay errores en la consola. `npm run build` pasa.

### Fase 2 — Base de datos y Storage
**Objetivo:** tablas, bucket y permisos creados en Supabase.
- Escribir `supabase/001_esquema.sql` y `supabase/seed_competidores.sql` según la sección 4.
- **Nombres con UUID:** `visitas.id` y `fotos.id` son `uuid` con `gen_random_uuid()`.
  Las políticas de Storage solo deben permitir subir archivos con la forma
  `visitas/<uuid>/<uuid>.<ext>`. Se puede validar con una expresión regular sobre `name`.
- **Bucket `fotos` con límites**, creado desde el mismo SQL (`insert into storage.buckets`):
  `public = true`, `file_size_limit = 5242880` (5 MB) y
  `allowed_mime_types = {image/jpeg, image/png, image/webp}`.
- Explicarle al usuario **cada bloque** del SQL antes de que lo ejecute.
- Crear los tipos de TypeScript de las tablas en `src/lib/tipos.ts`. Se escriben a
  mano, no hace falta el CLI de Supabase.

**Usuario hace:** pega y ejecuta los 2 archivos en **Supabase → SQL Editor**, en orden.
**Cómo comprobar:**
- En **Table Editor** se ven las 3 tablas y 7 competidores. "POR CONFIRMAR" tiene `activo = false`.
- En **Storage** existe el bucket `fotos`. En su configuración se ve el límite de 5 MB
  y los tipos de imagen permitidos.
- Desde la app, una consulta a `competidores` devuelve los 6 activos.

### Fase 3 — Lista de visitas y nueva visita (sin ubicación)
**Objetivo:** poder crear visitas eligiendo competidor.
- `/`: lista de visitas y botón "Nueva visita".
- `/visitas/nueva`: selector de competidores **activos** (ordenados por `orden`).
  Al elegir uno, guardar en memoria `competidor_elegido_at`. Botón "Guardar visita"
  que hace el `insert` y lleva a `/visitas/[id]`.
- `/visitas/[id]`: página básica con los datos de la visita (las fotos llegan en la Fase 5).

**Cómo comprobar:** al crear una visita, aparece en la lista y en la tabla `visitas`
de Supabase, con su competidor y sus fechas.

### Fase 4 — Ubicación
**Objetivo:** guardar latitud y longitud sin que el usuario las escriba.
- Botón "Guardar mi ubicación" en `/visitas/nueva`. Usa `navigator.geolocation` (la
  función que ya trae el navegador) con alta precisión. Guarda `latitud`, `longitud`,
  `precision_metros` y `ubicacion_at`.
- La ubicación es **obligatoria** para guardar la visita.
- Si el usuario niega el permiso o falla el GPS, mostrar un mensaje claro de cómo
  activarlo en iPhone y en Android, y un botón para reintentar.
- Mostrar la precisión obtenida (ej. "± 15 m") y un enlace "Ver en el mapa" (Google Maps).

**Nota:** la ubicación solo funciona en `https` o en `localhost`.
**Cómo comprobar:** la visita se guarda con coordenadas que, abiertas en Google Maps,
caen donde estabas.

### Fase 5 — Subir fotos
**Objetivo:** subir varias fotos de la galería a la carpeta de su visita.
- En `/visitas/[id]`, una zona grande "Toca para elegir fotos" con
  `<input type="file" accept="image/*" multiple>`. **No** uses `capture`, porque no
  queremos abrir la cámara.
- **Comprimir** cada foto antes de subirla (lado mayor de ~2000 px, JPEG). *(Etapa 2, E2-1:
  ahora 2200 px y calidad 0.85; 2026-11-23: calidad 0.92, tope de 5 MB y sin librería,
  con `<canvas>`; ver PLAN_ETAPA2 sección 3.3.)* ~~Pídele permiso al usuario para instalar
  la librería `browser-image-compression`.~~ (Se quitó el 2026-11-23.)
- Subir **una por una** a `visitas/<visita_id>/<uuid>.jpg` y, por cada una, hacer el
  `insert` en `fotos`.
- Mostrar el progreso ("Subiendo 3 de 12…"). Si una foto falla, poder reintentar solo esa.
- **Fotos HEIC/HEIF de iPhone** (requisito agregado por el usuario, ver sección 8).
  El bucket solo acepta JPEG, PNG y WebP, así que:
  - Antes de subir, cada foto que **no** sea JPEG, PNG o WebP (por ejemplo HEIC/HEIF)
    se **convierte a JPEG en el navegador** y se reduce de tamaño, igual que las demás.
  - Si una foto no se puede convertir, se muestra un **mensaje claro en español**
    (qué foto falló y qué hacer) y se **siguen subiendo las demás**. No se pierde el
    resto de la selección.
  - Debe funcionar en **iPhone (Safari y Chrome)** y en **Android**.
  - **Orden de preferencia:** primero usar lo que ya trae el navegador (por ejemplo,
    decodificar la imagen en un `<canvas>` y exportarla como JPEG). **Solo si eso no
    basta**, proponerle al usuario una librería de conversión HEIC.
  - 🚫 **No instalar ninguna librería de HEIC sin permiso.** Antes, explicarle al usuario
    qué hace, cuánto pesa y por qué hace falta.

**Cómo comprobar:** en Storage, las fotos están en la carpeta con el id de la visita,
y la tabla `fotos` tiene una fila por foto. Además, se sube **una foto HEIC real tomada
con un iPhone** y queda guardada como JPEG. Si se mezcla con una foto que no se puede
convertir, las demás se suben igual y aparece el mensaje de error.

### Fase 6 — Ver fotos de una visita
**Objetivo:** ver lo subido y agregar más.
- Galería de miniaturas en `/visitas/[id]`. Al tocar una, se ve grande.
- Las fotos nuevas aparecen sin recargar la página.
- En la lista `/`, mostrar el número de fotos de cada visita.

**Cómo comprobar:** al entrar a una visita vieja, se ven sus fotos y se pueden agregar más.

### Fase 7 — Pulido móvil y despliegue en Vercel
**Objetivo:** que la app funcione con un link público en celulares reales.
- Revisar la app con el tamaño de un celular: textos, botones y estados de error.
- Título de la pestaña e ícono.
- Guiar al usuario para: conectar el repo de GitHub en Vercel, cargar las variables
  de la sección 6 en Vercel y desplegar.

**Cómo comprobar:** con el link de Vercel, en **un iPhone y un Android reales**, se
puede hacer el flujo completo: crear visita → ubicación → subir fotos → ver fotos.
Revisar especialmente que las fotos de iPhone (formato HEIC) se suban bien.

---

## 8. Fuente y supuestos

**Fuente:** la reunión grabada en `docs/transcript.txt`. Todo lo demás son decisiones
nuestras (del usuario y los agentes), no vienen de la grabación. Se anotan aquí para
que se sepa de dónde salió cada una.

| Decisión / supuesto | Origen | Dónde aplica |
|---|---|---|
| Las fotos HEIC/HEIF de iPhone se convierten a JPEG en el navegador antes de subirlas. Primero se intenta con lo que trae el navegador (canvas) y solo si no basta se propone una librería, con permiso del usuario. Si una foto no se puede convertir, se avisa y se suben las demás. | Decisión nuestra (2026-11-18), **no viene de la grabación**. Motivo: el bucket solo acepta JPEG, PNG y WebP, y parte del equipo usa iPhone. | Fase 5 |
| La app **no debe aparecer en buscadores** (noindex), porque es de uso interno. Se hace con `robots: { index: false, follow: false }` en `src/app/layout.tsx` y el encabezado `X-Robots-Tag: noindex, nofollow` en todas las respuestas (`next.config.ts`). **No** se usa `Disallow` en `robots.txt`, porque eso impide que el buscador vea el aviso. Las fotos viven en Supabase Storage (otro dominio) y no reciben este encabezado; sus links solo aparecen dentro de la app. | Pedido del usuario (2026-11-18), **no viene de la grabación**. | Fase 7 |
