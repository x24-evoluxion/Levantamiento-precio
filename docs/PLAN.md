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

> **Cambio del 2026-11-24 — Autenticación y propiedad de visitas** (fase fuera del plan
> original; reemplaza la decisión "sin login"). Antes del paso 2, la persona **entra con su
> correo y contraseña** (Supabase Auth). Cada quien ve **solo sus visitas** (el paso 7 dice
> "cualquiera" de las suyas). Un **admin** ve todas. Detalle en la sección 4.3 y en
> `docs/PROGRESO.md` ("Autenticación y propiedad de visitas"). **Fase cerrada el 2026-11-24:**
> `008`, `008b` y `009` ejecutadas y probadas; sin sesión ya no se ve nada.
>
> **Cambio del 2026-11-25 — Captura manual de datos con sugerencias** (fase fuera del plan
> original). En el paso 6, debajo de las fotos, hay una sección **opcional** "Datos del
> levantamiento (manual)": la persona escribe una fila por producto (artículo, contenido,
> precio, marca, área, promoción). Marca y área tienen **sugerencias** al escribir. Se guarda
> en la tabla `capturas_manuales` (`supabase/010_capturas_manuales.sql`). Sirve después para
> comparar contra los agentes y como muestra verificada; **ningún agente la lee** en esta
> fase. Detalle en 4.1, 4.3 y en `docs/PROGRESO.md` ("Captura manual de datos").
>
> **Cambio del 2026-11-25 (2) — Captura rápida de productos** (reemplaza el formulario de
> arriba). La persona captura mientras recorre la tienda, así que la sección tiene **solo 4
> campos**: **artículo** (obligatorio, con sugerencias de las descripciones de nuestro
> catálogo; nunca obliga a elegir), **precio regular** (obligatorio), **precio de promoción
> individual** (por pieza, opcional) y **observaciones** (opcional). Enter avanza; "Agregar"
> pasa el producto a una lista compacta y limpia el formulario; "Guardar datos" guarda toda
> la lista en una operación. Contenido, unidad, marca, área y tipo de promoción **ya no se
> piden** (las columnas siguen, opcionales). Migración `supabase/011_captura_rapida.sql`
> (aditiva). Detalle en 4.1, 4.3, 5 y en `docs/PROGRESO.md` ("Captura rápida de productos").

### Fuera de alcance (no lo hagas)
- ~~**Login de usuarios.** La app es abierta: cualquiera con el link puede usarla.~~
  *(Reemplazado el 2026-11-24: ahora hay login con correo y contraseña. Sigue fuera de
  alcance el **registro público**: las cuentas las crea el dueño en el panel de Supabase.)*
- **Etapa 2:** convertir las fotos en una tabla de artículos y precios, y la revisión
  de esa información. Las tablas sí deben permitir agregarla después sin rehacer nada.
- Nombre de la sucursal. Solo importa su ubicación.
- Editar o borrar visitas o fotos desde la app. *(Excepción del 2026-11-23: se pueden **quitar**
  fotos pendientes, como descarte reversible — `fotos.descartada_at`, `supabase/007_descartar_fotos.sql`.
  No se borra nada. Excepción del 2026-11-24, **solo el admin**: corregir la tienda de una visita
  y restaurar fotos quitadas, con funciones SQL — `supabase/008_autenticacion.sql`. Excepción del
  2026-11-25: cada persona puede **quitar** sus filas de captura manual — `capturas_manuales.descartada_at`,
  `supabase/010_capturas_manuales.sql`. Tampoco se borran; corregir = quitar y volver a escribir.)*

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
| Usuarios | ~~**Sin login**~~ → **Login con correo y contraseña** (Supabase Auth, sin registro público; cambio del 2026-11-24). Rol admin en `app_metadata.rol = 'admin'` |
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
| `usuario_id` | `uuid`, FK → `auth.users.id`, `on delete set null`, default `auth.uid()` | **2026-11-24 (`008`).** Quién creó la visita. La pone el servidor; la app no puede mandarla. Nula = visita de antes del login (solo la ve el admin) o cuenta borrada |

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
| `descartada_at` | `timestamptz` | **2026-11-23 (`007`).** Hora (reloj del servidor, la pone un *trigger*) en que alguien **quitó** la foto desde la app. Nula = a la vista. Descarte reversible: no se borra la fila ni el archivo |
| `subida_por` | `uuid`, FK → `auth.users.id`, `on delete set null`, default `auth.uid()` | **2026-11-24 (`008`).** Quién subió la foto. La pone el servidor; la app no puede mandarla |

**`capturas_manuales`** (2026-11-25, `010`; simplificada por `011`): datos del levantamiento
escritos a mano en la pantalla de una visita. Una fila por producto. Mismas listas de valores
y la misma normalización de unidad y contenido que `lecturas_precio` (PLAN_ETAPA2 5.1 y 5.5),
para poder comparar. Todas las reglas (CHECK) están **en la base**, no solo en la app.
**Desde `011` la app solo llena** `articulo`, `articulo_de_lista`, `precio_regular`,
`promo_precio_pieza` y `observaciones`; las demás columnas se quedan para las filas viejas y
para la versión anterior de la app.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid`, PK, default `gen_random_uuid()` | |
| `visita_id` | `uuid`, FK → `visitas.id`, no nulo, `on delete cascade` | |
| `usuario_id` | `uuid`, FK → `auth.users.id`, `on delete set null`, default `auth.uid()` | Quién la escribió. La pone el servidor; la app **no tiene permiso** de mandarla |
| `articulo` | `text` no nulo | No vacío, hasta 200 letras |
| `articulo_de_lista` | `boolean` no nulo, default `false` | **`011`.** `true` solo si el texto guardado es **exactamente** una sugerencia elegida (descripción de un artículo nuestro). Si se edita después, `false` |
| `cantidad` | `numeric` (nulo desde `011`) | Contenido de **una** pieza; > 0, hasta 3 decimales (más decimales: se **rechaza**, no se redondea). Va junto con `unidad`: las dos vacías o las dos con valor |
| `unidad` | `text` (nulo desde `011`) | `g`, `kg`, `ml`, `l`, `pza` |
| `piezas` | `int` (nulo desde `011`), default 1 | 1 a 1000 ("6 × 355 ml" → 6) |
| `unidad_base`, `contenido_base` | generadas | Con las funciones de `004` (vía envoltorios en `privado`, ver 4.3). Vacías si no hay presentación |
| `precio_regular` | `numeric` no nulo | ≥ 0, hasta 2 decimales. La app avisa si es 0 o más de $10,000, pero no lo impide |
| `promo_precio_pieza` | `numeric` | **`011`.** Precio de promoción **por pieza** (opcional). ≥ 0, hasta 2 decimales. "2 x $42" → 21 (y "2x42" en observaciones). La app avisa si no es menor que el regular |
| `marca`, `area` | `text` | Formulario de `010` (la captura rápida no los pide). Nulos o no vacíos, hasta 100 letras |
| `marca_de_lista`, `area_de_lista` | `boolean` no nulo, default `false` | `true` si el valor se eligió de una sugerencia |
| `promo_tipo` | `text` no nulo, default `'ninguna'` | `ninguna`, `precio_rebajado`, `n_por_precio`, `nxm`, `otro` |
| `promo_piezas` | `int` | `precio_rebajado` → 1; `n_por_precio` y `nxm` → ≥ 2; `otro` → opcional |
| `promo_precio_total` | `numeric` | Hasta 2 decimales. Obligatorio en `precio_rebajado` y `n_por_precio`; vacío en `nxm` |
| `promo_paga_piezas` | `int` | **Solo `nxm`** ("lleva 3 paga 2" → 2; menor que `promo_piezas`). Misma columna que `lecturas_precio` |
| `promo_condicion` | `text` no nulo, default `'ninguna'` | `ninguna`, `tarjeta`, `app`, `otro` |
| `observaciones` | `text` | Hasta **500** letras (300 hasta `011`) |
| `created_at` | `timestamptz`, default `now()` | |
| `descartada_at` | `timestamptz` | Hora (del servidor, *trigger*) en que su autor la **quitó**. Nula = vigente |

Sin promoción (`ninguna`) → todas las columnas de promoción **de `010`** vacías y condición
`ninguna`. `promo_precio_pieza` (`011`) es independiente: la captura rápida deja
`promo_tipo = 'ninguna'` y anota ahí el precio por pieza.

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

- Bucket: **`fotos`**, ~~**público para lectura**. Es lo más simple para mostrar las
  imágenes y son fotos de anaqueles, no datos sensibles.~~ **Privado desde la migración
  `009_cerrar_anon.sql` (2026-11-24).** La app muestra las fotos con **URLs firmadas** que
  pide con la sesión de la persona; duran **24 horas** y se renuevan solas antes de caducar
  (`src/lib/urlsFirmadas.ts`). Mientras no caduca, un link copiado abre la foto para
  cualquiera. Las URLs firmadas solo se pueden pedir para fotos de visitas que la persona
  puede ver (reglas de Storage de `authenticated`). Los links públicos viejos ya no abren.
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

### 4.3 Seguridad con login (RLS) — vigente desde el 2026-11-24

RLS ("Row Level Security") son reglas en Supabase que dicen qué filas puede ver o tocar
cada quien. Desde `008`, la app usa el rol **`authenticated`** (persona con sesión). El
rol **`anon`** (la llave pública **sin** sesión) se queda **sin ningún permiso** con
`009`. **Admin** = cuenta con `app_metadata.rol = 'admin'` (solo lo pone el dueño en el
panel; **nunca** se usa `user_metadata`, que cada persona puede editar). Lo revisa la
función `es_admin()`, que lee el JWT.

| Recurso | Personal de campo puede… | Admin además puede… | Nadie puede (desde la app) |
|---|---|---|---|
| `competidores` | leer los activos y los de sus visitas | (lo mismo) | crear, cambiar, borrar |
| `visitas` | leer **las suyas**, crear (queda a su nombre solo) | leer **todas** (también las sin dueño); **corregir la tienda** con `admin_cambiar_competidor` | cambiar columnas directo, crear a nombre de otro, borrar |
| `fotos` | leer y subir fotos de **sus** visitas; **quitar** (`descartada_at`) fotos `pendiente` de sus visitas | leer todas; quitar pendientes de cualquier visita; **restaurar** con `admin_restaurar_foto` | cambiar otra columna, restaurar sin la función, borrar |
| Storage `fotos` | leer y subir en `visitas/<uuid de SU visita>/<uuid>.jpg` | leer todo; subir a cualquier visita | reemplazar, borrar |
| Correos de las cuentas | — | verlos con `admin_correos_usuarios` (quién creó cada visita) | — |
| `capturas_manuales` (`010`) | leer las de **sus** visitas; crear **solo en sus** visitas (queda a su nombre solo); **quitar** (`descartada_at`) **sus** filas | leer **todas**; crear solo en **sus** visitas; quitar solo **sus** filas | mandar `usuario_id`, cambiar otra columna, restaurar, borrar |
| `sugerencias_captura()` (`010`) | ejecutarla: devuelve solo `(tipo, valor)` con nombres de **áreas** del catálogo y **marcas** ya capturadas. **La app ya no la usa desde `011`** | (lo mismo) | ver claves, precios o descripciones del catálogo |
| `articulos_captura()` (`011`) | ejecutarla: devuelve **un solo valor** (arreglo de texto) con las **descripciones** de los artículos propios activos, sin servicios, distintas y ordenadas | (lo mismo) | ver claves, precios o ventas; `anon` no la ejecuta |
| Tablas, vistas y funciones de la Etapa 2 | nada | **nada** (también cerradas para el admin dentro de la app) | — |
| `anon` (sin sesión) | **nada** (desde `009`, ejecutada el 2026-11-24) | | |

Las reglas filtran **filas**; las **columnas** las limitan los permisos (`grant`) por
columna. Por eso el admin **no** tiene `update` general: sus cambios van por funciones
`security definer` que primero revisan `es_admin()`.

**Esquema `privado` y funciones auxiliares (`008b_romper_ciclo_rls.sql`).** Las reglas RLS
**no leen otras tablas directamente** (en `008` eso hacía un ciclo visitas → competidores →
visitas y Postgres cortaba con "infinite recursion" al guardar una visita). En su lugar
llaman a funciones del esquema `privado`, que la API de Supabase no publica (la app no las
puede llamar; solo `authenticated` las ejecuta desde las reglas, `anon` no):

| Función | Qué responde |
|---|---|
| `privado.es_dueno_de_visita(uuid)` | ¿La visita es de quien consulta? |
| `privado.puede_usar_visita(uuid)` | ¿Es suya, o es admin y la visita existe? |
| `privado.competidor_activo(bigint)` | ¿La tienda está activa? |
| `privado.competidor_en_visita_visible(bigint)` | ¿La tienda aparece en alguna visita que quien consulta puede ver? |
| `privado.visita_de_ruta(text)` | El uuid de la visita en una ruta `visitas/<uuid>/…` (no lee tablas) |
| `privado.normalizar_unidad_base(text)`, `privado.normalizar_contenido_base(numeric, text, int)` | **(`010`)** Envoltorios de las funciones de `004` para las columnas generadas de `capturas_manuales`. Postgres pide permiso de ejecutar la función de una columna generada a **quien inserta**, y las de `004` están cerradas (Etapa 2). Son cálculos puros; no leen tablas |

Las cuatro primeras son `security definer` con `search_path` vacío: leen la tabla sin
aplicar sus reglas (por eso no hay ciclo), solo responden sí/no sobre quien consulta (su id y
su rol salen del JWT) y nunca devuelven datos de filas. Una regla nueva que necesite mirar
otra tabla debe usar una función así, no una subconsulta.

*Histórico (antes del login):*

| Recurso | `anon` podía… | `anon` NO podía… |
|---|---|---|
| `competidores` | leer | crear, cambiar, borrar |
| `visitas` | leer, crear | cambiar, borrar |
| `fotos` | leer, crear, **quitar** (solo poner `descartada_at` en fotos `pendiente` no quitadas; 2026-11-23, `007`) | cambiar cualquier otra columna, restaurar, borrar |
| Storage `fotos` | leer, subir archivos nuevos | reemplazar, borrar |

**Consecuencia de diseño (sigue igual):** como nadie puede **cambiar** una visita desde la
app (salvo el admin, solo la tienda), la visita se guarda **de una sola vez** (competidor +
ubicación + timestamps) cuando el usuario toca "Guardar visita". Antes de eso, todo vive en
la pantalla.

⚠️ **No vuelvas a ejecutar `008_autenticacion.sql` después de `008b`:** regresa las reglas
viejas con el ciclo y guardar una visita vuelve a fallar. Si pasa, ejecuta `008b` otra vez.

⚠️ **No vuelvas a ejecutar `001_esquema.sql` ni `007_descartar_fotos.sql`:** vuelven a crear
permisos y reglas de `anon` (abrirían la base sin sesión). Si hiciera falta algo de ellos, va
en un archivo nuevo.

**Captura manual (`010`).** Sus reglas usan `privado.puede_usar_visita` (leer) y
`privado.es_dueno_de_visita` (crear); quitar compara `usuario_id` con el JWT (no lee otras
tablas). `sugerencias_captura()` es `security definer` con `search_path` vacío: lee
`catalogo_propio` como su dueño y devuelve **solo nombres**; `authenticated` sigue **sin
acceso** a `catalogo_propio` y a toda la Etapa 2. **`011`** no cambia las reglas: agrega la
función `articulos_captura()` (igual: `security definer`, `search_path` vacío, lee la vista
`catalogo_propio_actual` y devuelve **solo descripciones**). Devuelve **un** arreglo y no una
fila por artículo, porque la API de Supabase corta cada respuesta en unas 1,000 filas y el
catálogo tiene más de 3,000 artículos. Después de `010`, las comprobaciones finales
viejas de `008b` y `009` marcan `false` en las filas que cuentan funciones o tablas abiertas:
es normal (ver el encabezado de `010`).

Para deshacer `009` en una emergencia existe `supabase/reversa_009.sql` (devuelve `anon` y
el bucket público). **No está ejecutado**; para volver a cerrar se ejecuta `009` otra vez.

### 4.4 Archivos SQL (se ejecutan a mano en el SQL Editor de Supabase)

```
supabase/
├── 001_esquema.sql          ← tablas, RLS, bucket y políticas de Storage (histórico: no volver a ejecutar)
├── 002_... a 006_...        ← migraciones de la Etapa 2 (ver PLAN_ETAPA2 sección 5.0)
├── 007_descartar_fotos.sql  ← quitar fotos (histórico: no volver a ejecutar)
├── 008_autenticacion.sql    ← login: dueño de visitas, reglas de authenticated, funciones del admin
├── 008b_romper_ciclo_rls.sql← esquema privado y funciones auxiliares (no volver a ejecutar 008 después)
├── 009_cerrar_anon.sql      ← quita todo a anon y pone el bucket privado
├── reversa_009.sql          ← SOLO emergencia: deshace 009 (no ejecutado)
├── 010_capturas_manuales.sql← captura manual: tabla, reglas, sugerencias (aditiva)
├── 011_captura_rapida.sql   ← captura rápida: 4 campos, presentación opcional, articulos_captura() (aditiva)
├── pruebas/                 ← pruebas con datos inventados (terminan con rollback)
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
| *(todas)* | **Desde 2026-11-24:** sin sesión, cualquier ruta muestra **"Entrar"** (correo y contraseña; "¿No tienes cuenta? Pide tu acceso al responsable."). Con sesión, arriba se ve el correo y **"Cerrar sesión"** (`src/components/PuertaSesion.tsx`). |
| `/` | Lista de visitas (la más reciente primero): competidor, fecha y hora, número de fotos. Botón grande **"Nueva visita"**. Campo: "Mis visitas". Admin: "Todas las visitas", con quién creó cada una. |
| `/visitas/nueva` | Selector de competidor, botón **"Guardar mi ubicación"**, botón **"Guardar visita"**. Al guardar, lleva a la pantalla de la visita. |
| `/visitas/[id]` | Datos de la visita, **zona para subir fotos** y galería con las fotos ya subidas. Admin: "Creada por", **"Corregir tienda"** y la sección **"Fotos quitadas"** con "Restaurar". **Desde 2026-11-25:** debajo, la sección opcional **"Datos del levantamiento (manual)"** — **captura rápida** (`011`): formulario de 4 campos (Artículo con sugerencias, Precio regular, Precio de promoción individual *opcional*, Observaciones *opcional*); Enter avanza; **"Agregar"** (desactivado mientras falte algo, dice "Falta: …") pasa el producto a una lista compacta de una línea (tocar = corregir, "Quitar" con "Deshacer") y deja el foco en Artículo; **"Guardar datos"** guarda toda la lista en una sola operación; borrador en el celular; aviso al salir sin guardar; y las filas ya guardadas (solo lectura, con "Quitar"). Solo quien creó la visita escribe; el admin ve las de cualquiera. |

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
| **Login con correo y contraseña** (Supabase Auth, sin registro público). Rol admin en `app_metadata.rol = 'admin'` (nunca `user_metadata`). Personal de campo: solo sus visitas y fotos; crea visitas, sube fotos a las suyas y quita fotos pendientes de las suyas. Admin: ve todo; desde la app corrige la tienda, quita cualquier foto pendiente y restaura fotos quitadas; ve el **correo** de quien creó cada visita. Las visitas de antes quedan sin dueño (solo las ve el admin). Bucket **privado** con **URLs firmadas de 24 h** que se renuevan solas. Sesión solo en el navegador (supabase-js, sin librerías nuevas). Migraciones: `008` (aditiva), `008b` (corrige el ciclo de reglas con el esquema `privado`) y `009` (quita a `anon` y pone el bucket privado). Las tres ejecutadas y probadas el 2026-11-24. | Pedido del usuario (2026-11-24), **no viene de la grabación**. Reemplaza "sin login". Las preguntas (qué edita el admin en la app, cómo se muestra quién creó la visita y cuánto duran los links) las respondió el usuario ese día. | Fase "Autenticación y propiedad de visitas" (`PROGRESO.md`) |
| **Captura manual de datos con sugerencias** (`capturas_manuales`, `010`). Sección opcional en la pantalla de la visita; una fila por producto con las mismas listas y normalización que `lecturas_precio`; sugerencias de **área** (nombres del catálogo, por una función SQL que no da claves ni precios) y **marca** (las ya capturadas), filtradas en el navegador (primero las que empiezan, luego las que contienen; sin mayúsculas ni acentos; nunca obliga a elegir). Guardar es todo o nada; borrador en `localStorage`; corregir = quitar y volver a escribir. Solo en visitas propias (el admin ve todas). Agregado por el agente: `promo_paga_piezas` para `nxm` (sin ella "3 x 2" no se puede guardar) y los límites de largo/decimales. | Pedido del usuario (2026-11-25), **no viene de la grabación**. | Fase "Captura manual de datos" (`PROGRESO.md`) |
| **Captura rápida de productos** (`011`). Reemplaza el formulario de `010` por 4 campos: artículo (obligatorio; sugerencias con las **descripciones** de nuestros artículos activos, por la función `articulos_captura()` que devuelve un solo arreglo; filtro en el navegador por palabras en cualquier orden, mínimo 2 letras, máximo 6; nunca obliga a elegir; `articulo_de_lista`), precio regular (obligatorio), precio de promoción **por pieza** (opcional) y observaciones (opcional, hasta 500). Teclado numérico con punto (`inputMode="decimal"`), punto o coma, 2 decimales. Avisos sin bloquear (precio 0, promoción ≥ regular, más de $10,000). Lista compacta, corregir/quitar, guardar todo o nada. Columnas de presentación opcionales en la base (aditiva). Agregado por el agente: CHECK "cantidad y unidad juntas", tope de 7 enteros en los precios, "Deshacer" al quitar de la lista. | Pedido del usuario (2026-11-25), **no viene de la grabación**. | Fase "Captura rápida de productos" (`PROGRESO.md`) |
