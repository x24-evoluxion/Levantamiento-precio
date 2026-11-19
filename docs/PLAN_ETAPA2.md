# PLAN — Etapa 2: inteligencia de precios de la competencia

> **Para cualquier agente que lea esto:** lee primero `docs/PLAN.md` (Etapa 1: reglas,
> stack y diseño de datos), después **todo** este archivo y al final `docs/PROGRESO.md`.
> Trabaja **solo en la fase que te toca** (la primera de la Etapa 2 sin ✅ en `PROGRESO.md`).
> Las reglas de la sección 3 de `PLAN.md` siguen valiendo, salvo lo que este archivo cambie
> de forma explícita (ver sección 2).

---

## 0. Objetivo final

**Un sistema de inteligencia de precios de la competencia.** Los agentes leen las fotos de
anaquel, identifican **artículo, presentación y precio**, lo comparan contra **nuestro
catálogo** y permiten analizar las diferencias **por competidor, zona y fecha**.

Las decisiones de diseño de este plan deben **facilitar mejoras futuras**: tableros,
alertas (ej. "el competidor X bajó 10 % el aceite") y tendencias. Por eso:

- Cada dato se guarda **una sola vez y separado** (cantidad y unidad aparte, precio regular
  y de promoción aparte, artículo de la competencia separado de sus lecturas).
- Los cálculos que se repiten (precio por 100 g / 100 ml / pieza, diferencia contra nuestro
  precio) los hace **la base de datos con SQL**, no el agente. Así un tablero futuro solo
  consulta una vista.
- Cada lectura guarda **lo que dijo el agente sin tocar** (`valores_agente`), aunque una
  persona la corrija después. Eso permite medir qué tan bien lee el agente con el tiempo.
- Todo tiene **fecha** (de captura de la foto y de la visita), para poder ver tendencias.

---

## 1. Qué estamos construyendo

Hoy la app guarda visitas y fotos de anaqueles. La Etapa 2 **convierte cada foto en filas
de una tabla** y las **compara contra nuestros precios**.

Flujo (todo del lado del servidor; el personal de tienda casi no ve cambios en la app, solo
la hora de captura y fotos un poco más nítidas — Fase E2-1):

1. El personal sube fotos como siempre. La app guarda también la **hora en que se tomó**
   cada foto. Cada foto nueva queda con estado **`pendiente`**.
2. Alguien del equipo corre el proceso en su computadora (sección 8). El proceso junta las
   fotos pendientes y le manda **un lote** a Claude (Message Batches API).
3. Claude lee **cada foto por separado** y responde con un JSON: calidad de la foto y una
   lista de productos con artículo, marca, cantidad, unidad, precio, promoción y su
   **confianza** en cada parte.
4. El proceso valida el JSON e inserta las lecturas en **`lecturas_precio`**, cada una con
   su **estado** (`propuesta` o `por_revisar` o `descartada`).
5. Cada lectura se liga a un **artículo de la competencia** (`articulos_competencia`). Para
   los artículos nuevos, un segundo paso le pide a Claude **proponer la equivalencia** con
   un artículo de **nuestro catálogo** (`catalogo_propio`). Una persona la aprueba.
6. La vista **`comparacion_precios`** une todo y calcula, con SQL, el precio por 100 g /
   100 ml / pieza de la competencia y el nuestro, con competidor, zona y fecha.

### Fuera de alcance de la Etapa 2 (no lo hagas)
- Una pantalla en la app para revisar lecturas o equivalencias. Por ahora se revisa en
  Supabase (Table Editor / SQL Editor). Las tablas ya tienen los campos para agregarla.
- Tableros, alertas y gráficas de tendencia (se dejan **listas las vistas** para hacerlos).
- Un agente autónomo con herramientas. Es **una llamada por foto** (sección 6).
- Cambiar el flujo de la app publicada, salvo el ajuste pequeño de la Fase E2-1.
- Login de usuarios.

---

## 2. Decisiones de la Etapa 2 (confirmadas por el usuario el 2026-11-19, NO cambiar)

| # | Decisión | Detalle en |
|---|---|---|
| 1 | La API de Claude vive **en código de servidor** dentro de este proyecto. `ANTHROPIC_API_KEY` y `SUPABASE_SECRET_KEY` se usan **solo en servidor**, **nunca** con `NEXT_PUBLIC_`. El disparador **no es público** (no hay login): script local o ruta protegida con clave secreta. | Secciones 4 y 8 |
| 2 | **Una llamada por foto** con respuesta **JSON validada**. Para muchas fotos, **Message Batches API** (flujo de dos pasos). Se evalúa como **opcional** una segunda lectura independiente para marcar discrepancias. | Secciones 6, 7 y 9.4 |
| 3 | Tablas nuevas, **todas cerradas al usuario anónimo** (ni lectura ni escritura): `catalogo_propio`, `lecturas_precio`, `equivalencias` y una **vista de comparación** normalizada por unidad, calculada **por la base de datos con SQL**. | Sección 5 |
| 4 | Cada foto tiene **estado de procesamiento** (`pendiente`, `en_lote`, `procesada`, `error`), **calidad** (`legible`, `borrosa`, `reflejo`, `lejana`, `sin_precios`) y **motivo**. **No se reprocesan** fotos ya procesadas. | Sección 5.2 |
| 5 | Nuestra lista de precios se carga con un **script de importación**. El archivo original **no se sube a GitHub**: vive en `datos_privados/` (ignorada por `.gitignore`). **Se pregunta al usuario qué columnas trae antes de diseñar la tabla.** | Sección 5.6 |
| 6 | **Fase previa de ajuste de la Etapa 1** (pequeña, con migraciones SQL **nuevas**, sin editar los archivos viejos): conservar `created_at` y la hora de ubicación, **quitar `competidor_elegido_at`**, y guardar en `fotos` la **hora de captura**, leída del archivo **antes** de comprimirlo. | Sección 11, Fase E2-1 |
| 7 | **Tamaño de foto** revisado contra la documentación vigente de visión, con propuesta de tamaño y calidad JPEG para las fotos nuevas y **guía corta** para el equipo de campo. | Sección 3 |
| 8 | **Evaluación** con 20–30 fotos verificadas a mano: Sonnet 5.5 (`claude-sonnet-5-5`) vs Haiku 5.5 (`claude-haiku-5-5`) en acierto de artículo, presentación y precio, **calibración** de la confianza y costo. | Sección 9 |
| 9 | Riesgos documentados: etiquetas ilegibles, varios precios en una etiqueta, regular y promoción juntos, presentaciones que cambian, personas en las fotos, costo por lote, información comercial sensible del catálogo. | Sección 10 |

**Cambio respecto a la Etapa 1:** `PLAN.md` sección 6 decía "nunca se usa la llave
`service_role` / `secret`". Eso **sigue valiendo para la app** (el navegador). La única
excepción es el proceso de la Etapa 2, que corre en servidor (sección 4).

**Librerías:** siguen las reglas de `PLAN.md`. **Nada se instala sin pedir permiso y
explicar por qué.** Ver sección 4.3.

### Glosario rápido
- **Messages API:** dirección de internet a la que se le manda la foto y unas
  instrucciones, y responde con texto (aquí, JSON).
- **Message Batches API ("lote"):** la misma API, pero se mandan muchas peticiones juntas,
  se procesan en segundo plano y cuestan **la mitad**.
- **Secret key de Supabase:** llave que **se salta las reglas RLS**. Puede leer y escribir
  todo. Por eso nunca debe llegar al navegador.
- **Código de servidor:** corre en tu computadora (o en Vercel), nunca en el celular. Lo que
  lleva `NEXT_PUBLIC_` sí llega al navegador: **las llaves secretas jamás lo llevan.**
- **Salidas estructuradas (`output_config.format`):** opción de la API que obliga a Claude a
  responder con un JSON que sigue un esquema que nosotros definimos.
- **Vista:** una "tabla virtual" definida con SQL; se calcula al consultarla.

---

## 3. Fotos para los agentes (tamaño, calidad y guía de campo)

### 3.1 Cómo se reducen hoy (Etapa 1, `src/lib/fotos.ts`)
- **Lado mayor: 2000 px** (`LADO_MAXIMO_PX`), JPEG calidad **0.8** (`CALIDAD_JPEG`).
- Con la librería `browser-image-compression` hay además **`maxSizeMB: 1`**: si la foto
  pasa de 1 MB, la librería **baja la calidad del JPEG** hasta llegar a ~1 MB. En fotos de
  anaquel (mucho detalle) esto es lo que más puede borrar las letras pequeñas.
- Las HEIC convertidas con `<canvas>` quedan en 2000 px y 0.8, **sin** el tope de 1 MB.
- **No se guarda el original.** Y al comprimir se **pierden los datos EXIF** (incluida la
  hora de captura): por eso la hora se lee **antes** (Fase E2-1).

### 3.2 Qué dice la documentación vigente de visión (consultada el 2026-11-19)
Fuente: `platform.claude.com/docs/en/build-with-claude/vision`.

| Dato | Valor |
|---|---|
| Nivel de resolución de `claude-sonnet-5-5` y `claude-haiku-5-5` | **Alta resolución** ("Claude 4.7 y posteriores") |
| Lado mayor máximo útil | **2576 px** |
| Tope de "tokens visuales" por imagen | **4 784** (cada token = un cuadro de 28 × 28 px) |
| Costo en tokens | `⌈ancho/28⌉ × ⌈alto/28⌉` |
| Si la foto pasa cualquiera de los dos topes | La API **la reduce sola** (otra pasada de reducción) |
| Tamaño máximo por imagen | 10 MB; máximo 8000 × 8000 px |
| Formatos | JPEG, PNG, GIF, WebP |
| Aviso de la documentación | La compresión JPEG fuerte, sobre todo **varias pasadas**, vuelve el texto difícil de leer |

**Consecuencia importante:** el límite real no es solo el lado mayor, es el **área**
(~3.75 megapíxeles). Una foto 4:3 de celular a 2576 × 1932 px daría 6 348 tokens, así que
la API la volvería a reducir a ~2230 × 1673. **Para fotos 4:3, más de ~2200 px de lado
mayor no aporta nada** y solo agrega una segunda reducción.

| Tamaño | Tokens | ¿La API la vuelve a reducir? |
|---|---|---|
| 2000 × 1500 (hoy) | 3 888 | No |
| **2200 × 1650 (propuesta)** | **4 661** | **No** |
| 2200 × 1238 (foto 16:9) | 3 555 | No |
| 2576 × 1932 | 6 348 → recorta a 4 784 | **Sí** |

### 3.3 Propuesta para las fotos nuevas (se aplica en la Fase E2-1, con aprobación)
- **Lado mayor: 2200 px** (antes 2000). Es lo máximo que la API aprovecha en fotos 4:3 sin
  volver a reducirlas. Cuesta ~20 % más tokens por foto (4 661 vs 3 888).
- **Calidad JPEG: 0.85** (antes 0.8).
- **Quitar el tope de 1 MB** y poner `maxSizeMB: 4` (el bucket acepta hasta 5 MB). Una foto
  de 2200 × 1650 a 0.85 suele pesar 0.8–1.8 MB, así que la librería ya **no bajará la
  calidad** salvo en casos extremos.
- Igual para la ruta de HEIC con `<canvas>` (usa las mismas constantes).
- La Fase E2-5 (evaluación) **confirma** con fotos reales que 2200 / 0.85 lee mejor que
  2000 / 0.8 / 1 MB. Si no hubiera diferencia, se puede regresar a 2000 px para ahorrar.
- ⚠️ Cambia la app publicada: el agente de E2-1 lo muestra antes de desplegar.

### 3.4 Guía corta para el equipo de campo (para compartir por WhatsApp)

> **Cómo fotografiar etiquetas de precio**
> 1. **Una etiqueta o un tramo corto por foto.** Mejor 5 fotos cercanas que 1 de todo el
>    pasillo. Que en la foto quepan **máximo 6–8 etiquetas**.
> 2. **De frente**, a la altura de la etiqueta, no en diagonal.
> 3. **Que se lea a simple vista en tu pantalla.** Si tú no lo lees al hacer zoom, la
>    computadora tampoco.
> 4. **Sin reflejo:** muévete un paso a un lado si la luz brilla en el plástico. Sin flash.
> 5. **Enfoca:** toca la etiqueta en la pantalla antes de tomar la foto. Mano firme.
> 6. **Que salga el producto y su etiqueta juntos** (para saber de qué es el precio).
> 7. **Si hay promoción** ("2x$30", "-20 %"), que salga el letrero completo.
> 8. **Sin personas** en la foto. Si alguien pasa, espera o toma otra.
> 9. **Toma las fotos dentro de la tienda y súbelas el mismo día.**

---

## 4. Variables de entorno, código y librerías

### 4.1 Variables nuevas (solo servidor)

**No leas el valor de ninguna.** Solo se nombran.

| Variable | Qué es | `.env.local` | Vercel |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Llave de la API de Claude. Créala en la consola de Anthropic **solo para este proyecto** con **límite de gasto mensual** | ✅ | Solo con la opción B (sección 8) |
| `SUPABASE_SECRET_KEY` | Llave secreta de Supabase (Project Settings → API Keys → *Secret keys*, empieza con `sb_secret_`) | ✅ | Solo con la opción B |
| `PROCESO_SECRET` | Clave larga al azar que protege la ruta del proceso | ❌ | Solo con la opción B |

- Se sigue usando `NEXT_PUBLIC_SUPABASE_URL` (ya existe).
- **Con la opción recomendada (A, script local) no se agrega nada en Vercel.**
- `.env.example` se actualiza con **solo los nombres** (valores vacíos) y el comentario
  "solo servidor, nunca NEXT_PUBLIC_".
- ⚠️ El agente de E2-2 le pregunta al usuario si sus variables se llaman exactamente así.

### 4.2 Dónde vive el código

```
scripts/etapa2/                 ← SOLO servidor (tu computadora)
├── importar-catalogo.ts        ← carga nuestra lista de precios (E2-3)
├── leer-una-foto.ts            ← prueba con una foto, sin guardar (E2-4)
├── evaluar.ts                  ← compara modelos contra fotos verificadas (E2-5)
├── crear-lote.ts               ← paso 1 del lote (E2-6)
├── recoger-lote.ts             ← paso 2 del lote (E2-6)
└── proponer-equivalencias.ts   ← equivalencias propuestas por el agente (E2-7)
src/lib/etapa2/                 ← piezas compartidas de servidor: instrucciones (prompt),
                                  esquemas JSON, validación, cálculo de estado
datos_privados/                 ← archivos originales (lista de precios, fotos de prueba
                                  en tamaño original). IGNORADA por git
```

- Nada de `scripts/` ni `src/lib/etapa2/` se importa desde la app (`"use client"` ni
  páginas). Así nunca termina en el navegador.
- Los scripts se corren con Node (ya entiende TypeScript) y cargan variables con
  `node --env-file=.env.local scripts/etapa2/....ts`. No hace falta `tsx` ni `dotenv`.
  Se agregan como comandos en `package.json` (ej. `npm run lote:crear`).

### 4.3 Librerías que se pedirán (ninguna se instala sin permiso)

| Librería | Fase | Por qué | Alternativa sin librería |
|---|---|---|---|
| `@anthropic-ai/sdk` | E2-4 | Oficial de Anthropic. Ya trae lotes (crear, consultar, leer resultados línea por línea), reintentos automáticos ante saturación (429/5xx), tipos de TypeScript y errores por tipo. Solo servidor: no pesa en el celular | `fetch` a mano: habría que escribir y mantener todo eso |
| Lector del archivo de precios (ej. `xlsx` / SheetJS) | E2-3 | **Solo si** la lista viene en Excel. Si viene en CSV, se lee sin librería | Pedir la lista en CSV (Excel → Guardar como CSV UTF-8) |
| `exifr` | E2-1 | **Solo si** el lector propio de EXIF (sección 11, E2-1) no alcanza (ej. fotos HEIC en Android) | Lector propio de ~80 líneas para JPEG |

**Validación del JSON sin `zod`:** las salidas estructuradas garantizan la forma; las reglas
de negocio (precio > 0, promoción menor que regular, unidad válida) se revisan con funciones
propias en `src/lib/etapa2/validar.ts`.

---

## 5. Diseño de datos

### 5.0 Archivos SQL (nuevos; los de la Etapa 1 **no se editan**)

| Archivo | Fase | Qué hace |
|---|---|---|
| `supabase/002_fotos_hora_captura.sql` | E2-1 | Columnas de hora de captura en `fotos` + permiso de `anon` para llenarlas |
| `supabase/003_quitar_competidor_elegido_at.sql` | E2-1 | Quita la columna, **después** de desplegar la app nueva |
| `supabase/004_etapa2_lecturas.sql` | E2-2 | Estado y calidad en `fotos`, `lotes_proceso`, `articulos_competencia`, `lecturas_precio`, `guardar_lecturas` |
| `supabase/005_catalogo_propio.sql` | E2-3 | `catalogo_propio` (diseño final cuando se conozcan las columnas) |
| `supabase/006_equivalencias_comparacion.sql` | E2-7 | `equivalencias`, `zonas` (opcional) y vista `comparacion_precios` |

Todos se ejecutan **a mano** en el SQL Editor, se pueden ejecutar varias veces, y el agente
**avisa y explica cada bloque antes** de que el usuario los ejecute.

**Regla de permisos para todo lo nuevo de la Etapa 2:** RLS activado **sin ninguna
política** y `revoke all ... from anon, authenticated` en cada tabla, vista y función. Las
vistas llevan `with (security_invoker = true)` (Supabase publica las vistas en su API; sin
esto `anon` podría leerlas). Solo la secret key (rol `service_role`) y el SQL Editor pueden
leer y escribir.

### 5.1 Unidades y normalización (lo calcula la base de datos)

- `unidad` solo puede ser: `g`, `kg`, `ml`, `l`, `pieza`.
- `piezas` (entero, default 1) para paquetes: "6 × 355 ml" → `cantidad = 355`, `unidad =
  ml`, `piezas = 6`. *(Agregado por el agente: sin esto no se pueden comparar paquetes.)*
- Columnas **generadas** por Postgres (nadie las escribe, ni el agente):
  - `unidad_base`: `g` (si `g`/`kg`), `ml` (si `ml`/`l`), `pieza`.
  - `contenido_base = cantidad × piezas × (1000 si kg o l, si no 1)`.
- El precio normalizado se calcula **en la vista**:
  `precio_normalizado = precio / contenido_base × (100 si g o ml, 1 si pieza)`
  → **precio por 100 g, por 100 ml o por pieza.**
- Solo se comparan precios con la **misma `unidad_base`**.

Las mismas reglas aplican a `lecturas_precio` y a `catalogo_propio`, con la misma función
SQL, para que los dos lados se normalicen igual.

### 5.2 Columnas nuevas en `fotos`

| Columna | Tipo | Notas | Fase |
|---|---|---|---|
| `capturada_at` | `timestamptz` | Hora en que se **tomó** la foto (EXIF). Nulo si no se pudo leer | E2-1 |
| `capturada_origen` | `text` no nulo, default `'sin_dato'` | `exif`, `exif_zona_celular` (EXIF sin zona horaria; se usó la del celular), `sin_dato` | E2-1 |
| `estado_proceso` | `text` no nulo, default `'pendiente'` | `pendiente`, `en_lote`, `procesada`, `error` | E2-2 |
| `calidad` | `text` | `legible`, `borrosa`, `reflejo`, `lejana`, `sin_precios`. La llena el agente | E2-2 |
| `motivo_calidad` | `text` | En palabras simples, ej. "reflejo sobre las etiquetas de la derecha" | E2-2 |
| `lote_id` | `text`, FK → `lotes_proceso.id` | Último lote en el que se mandó | E2-2 |
| `intentos` | `int` no nulo, default 0 | | E2-2 |
| `error_proceso` | `text` | Último error, en palabras simples | E2-2 |
| `procesada_at` | `timestamptz` | | E2-2 |

- `anon` recibe permiso de `insert` **solo** en `capturada_at` y `capturada_origen` (además
  de las 4 que ya tiene). **No** puede tocar estado ni calidad (no tiene `update`).
- La app hace `select("*")` en `fotos`: recibirá columnas de más, que ignora. No se rompe.
- Las fotos viejas quedan `pendiente` y `sin_dato` (no se puede recuperar su hora: el EXIF
  ya se perdió al comprimirlas).
- Índice en `estado_proceso`.

**Ciclo de vida de una foto (no se reprocesan las `procesada`):**

```
pendiente ──crear lote──▶ en_lote ──recoger, OK──▶ procesada   (fin: nunca se vuelve a mandar)
    ▲                        │
    │                        └──recoger, falló──▶ error
    └───── siguiente "crear lote" la retoma si intentos < 3 ─────┘
```

Una foto `sin_precios` o `borrosa` **sí** queda `procesada` (se leyó bien, solo que no tenía
nada útil); su calidad y motivo sirven para retroalimentar al equipo de campo.

### 5.3 Tabla `lotes_proceso`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `text`, PK | El id que devuelve Anthropic (`msgbatch_...`) |
| `tipo` | `text` no nulo | `lectura_fotos` o `equivalencias` |
| `modelo` | `text` no nulo | |
| `estado` | `text` no nulo | `en_proceso`, `recogido`, `cancelado` |
| `total` / `ok` / `con_error` | `int` | |
| `tokens_entrada` / `tokens_salida` | `bigint` | Suma real de `usage` |
| `costo_estimado_usd` | `numeric(10,4)` | Con precios de lote |
| `created_at` / `recogido_at` | `timestamptz` | |

### 5.4 Tabla `articulos_competencia` *(propuesta del agente)*

**Por qué existe:** si las equivalencias se ligaran a cada lectura, habría que aprobar
"Coca-Cola 600 ml de Neto = nuestra Coca-Cola 600 ml" **cada vez** que aparezca en una foto.
Con esta tabla se aprueba **una vez por artículo** y todas sus lecturas (pasadas y futuras)
heredan la equivalencia. También es la base para ver la **tendencia** de un artículo.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` identity, PK | |
| `marca` | `text` | |
| `articulo` | `text` no nulo | Nombre limpio, ej. "Refresco Coca-Cola" |
| `cantidad`, `unidad`, `piezas` | como en 5.1 | + `unidad_base` y `contenido_base` generadas |
| `clave` | `text` no nulo, **único** | Generada: minúsculas, sin acentos ni espacios dobles, de `marca + articulo + cantidad + unidad + piezas`. Evita duplicados |
| `created_at` | `timestamptz` | |

El proceso, al guardar una lectura, busca el artículo por `clave`; si no existe, lo crea.
Una persona puede **fusionar** duplicados cambiando el `articulo_competencia_id` de las
lecturas (se documentará la consulta).

### 5.5 Tabla `lecturas_precio`

Una fila por **cada producto visto** en una foto (una foto puede tener 0, 1 o muchas).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid`, PK | |
| `foto_id` | `uuid` no nulo, FK → `fotos.id` | Visita, competidor, ubicación y fecha salen de la foto |
| `orden_en_foto` | `int` no nulo | `unique (foto_id, orden_en_foto)` |
| `articulo_competencia_id` | `bigint`, FK | Lo llena el proceso (5.4) |
| `articulo` | `text` | Ej. "Refresco Coca-Cola" |
| `marca` | `text` | |
| `cantidad` | `numeric(10,3)` | Ej. 600 |
| `unidad` | `text` | `g`, `kg`, `ml`, `l`, `pieza` |
| `piezas` | `int` no nulo, default 1 | 5.1 |
| `unidad_base`, `contenido_base` | generadas | 5.1 |
| `precio` | `numeric(10,2)` | Precio regular, en pesos |
| `precio_promocion` | `numeric(10,2)` | Precio **por unidad** de promoción, solo si la etiqueta lo dice claro |
| `texto_promocion` | `text` | Tal cual: "2x$30", "Lleva 3 paga 2", "-20 %" |
| `texto_leido` | `text` | Lo que dice la etiqueta, para revisar |
| `calidad` | `text` | De **esta etiqueta**: `legible`, `borrosa`, `reflejo`, `lejana`, `cortada` |
| `confianza_articulo` | `text` no nulo | `alta`, `media`, `baja` |
| `confianza_presentacion` | `text` no nulo | `alta`, `media`, `baja` |
| `confianza_precio` | `text` no nulo | `alta`, `media`, `baja` |
| `motivo_duda` | `text` | Por qué algo no es `alta`, o por qué se descartó |
| `estado` | `text` no nulo | `propuesta`, `por_revisar`, `aprobada`, `corregida`, `descartada` |
| `valores_agente` | `jsonb` no nulo | Copia **sin tocar** de lo que respondió el agente. Nunca se edita |
| `discrepancia` | `text` | Solo si se activa la segunda lectura (9.4): qué campo no coincidió |
| `modelo` | `text` no nulo | |
| `lote_id` | `text`, FK | Nulo si vino de una prueba sin lote |
| `revisada_por` | `text` | Nombre de quien aprobó / corrigió / descartó |
| `revisada_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |

**Confianza en niveles y no en números:** los números de un modelo de lenguaje no están
calibrados (un "0.87" no significa 87 %). Tres niveles con reglas claras se revisan mejor,
y la Fase E2-5 mide si están **calibrados** (sección 9.3).

**Estados y quién los pone:**

| Estado | Lo pone | Cuándo |
|---|---|---|
| `propuesta` | Nuestro código | Las tres confianzas en `alta` y pasa todas las validaciones |
| `por_revisar` | Nuestro código | Alguna confianza `media`/`baja`, validación "suave" fallida (ej. promoción ≥ regular), varios precios dudosos en la etiqueta, o discrepancia con la segunda lectura |
| `descartada` | Nuestro código o persona | Sin precio legible, precio ≤ 0 o absurdo, o no es un precio de producto |
| `aprobada` | Persona | Revisó y está bien |
| `corregida` | Persona | Cambió algún valor (el original queda en `valores_agente`) |

El estado lo calcula `src/lib/etapa2/validar.ts`, **no Claude**.

### 5.6 Tabla `catalogo_propio` (diseño final pendiente de las columnas del archivo)

⚠️ **Antes de escribir `005_catalogo_propio.sql` se le pregunta al usuario qué columnas
trae su lista de precios** (y si viene en Excel o CSV, con o sin código, una o varias
listas). Borrador mínimo que pidió el usuario:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` identity, PK | |
| `codigo` | `text`, único si existe | SKU o código de barras, si el archivo lo trae |
| `articulo` | `text` no nulo | |
| `marca` | `text` | Si viene |
| `cantidad`, `unidad`, `piezas` | como en 5.1 | **separados**. Si el archivo trae "600ML" junto, el script lo separa y lo que no entienda lo reporta en vez de adivinar |
| `precio` | `numeric(10,2)` no nulo | |
| `activo` | `boolean`, default `true` | Artículos que ya no vendemos no se borran (rompería comparaciones viejas) |
| `actualizado_at` | `timestamptz` | |

**Propuesta para tendencias (a confirmar):** tabla `precios_propios_historial`
(`articulo_propio_id`, `precio`, `vigente_desde`). El script de importación agrega una fila
**solo cuando el precio cambia**. Así la comparación de una foto de marzo usa **nuestro
precio de marzo**, no el de hoy.

**Script `npm run catalogo:importar -- datos_privados/<archivo>`:**
1. Lee el archivo, separa cantidad y unidad, valida.
2. Muestra un resumen (nuevos, con precio cambiado, sin cambio, con error) y pide
   confirmación.
3. Inserta / actualiza por `codigo` (o por `articulo + presentación` si no hay código).
4. Imprime las filas que no pudo entender, para corregirlas en el archivo.

`datos_privados/` está en `.gitignore`. Antes de cada commit: `git status` para confirmar
que **no** aparece ningún archivo de esa carpeta ni `.env.local`.

### 5.7 Tabla `equivalencias`

Artículo de la competencia ↔ artículo propio.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` identity, PK | |
| `articulo_competencia_id` | `bigint` no nulo, FK | |
| `articulo_propio_id` | `bigint`, FK → `catalogo_propio.id` | Nulo solo si `sin_equivalente` |
| `tipo` | `text` no nulo | `mismo_articulo`, `otra_presentacion`, `sin_equivalente` |
| `estado` | `text` no nulo | `propuesta`, `aprobada`, `rechazada` |
| `propuesta_por` | `text` no nulo | `agente` o `persona` |
| `confianza` | `text` | `alta`/`media`/`baja` (si la propuso el agente) |
| `motivo` | `text` | Por qué el agente la propone |
| `modelo` | `text` | Si la propuso el agente |
| `aprobada_por`, `aprobada_at` | | |
| `created_at` | `timestamptz` | |

- Máximo **una equivalencia `aprobada`** por artículo de la competencia (índice único
  parcial `where estado = 'aprobada'`).
- `otra_presentacion` sí se compara (por eso se normaliza por unidad): "Coca-Cola 500 ml"
  vs nuestra "Coca-Cola 600 ml" → se comparan precios por 100 ml.

**Cómo propone el agente (E2-7, `npm run equivalencias:proponer`):**
1. Busca artículos de la competencia **sin** equivalencia.
2. Para cada uno, SQL saca los **10 candidatos** más parecidos de `catalogo_propio` (por
   marca y nombre, con la misma `unidad_base`). Se propone usar la extensión `pg_trgm` de
   Postgres (viene en Supabase, se activa con SQL; no es librería de npm) para medir el
   parecido del texto. Se pedirá permiso.
3. Manda a Claude el artículo y los 10 candidatos — **solo nombre, marca y presentación,
   nunca nuestros precios** (sección 10). Claude elige uno o "sin equivalente", con tipo,
   confianza y motivo (JSON validado; en lote si son muchos).
4. Se guarda como `propuesta` / `agente`. Una persona la aprueba o rechaza en Supabase.
   Una persona también puede crearla directo (`persona`, `aprobada`).

### 5.8 Tabla `zonas` *(propuesta, a confirmar)*

Hoy solo hay latitud y longitud por visita. Para analizar "por zona":

| Columna | Tipo |
|---|---|
| `id`, `nombre` (ej. "Centro", "Norte") | |
| `latitud`, `longitud`, `radio_metros` | Centro y radio de la zona |

La vista asigna a cada visita la **zona más cercana dentro de su radio** con una fórmula de
distancia en SQL (sin PostGIS ni librerías). Sin zona → `"Sin zona"`. Alternativa más
simple: el usuario da la lista de zonas o sucursales y se decide al llegar a E2-7.

### 5.9 Vistas

**`lecturas_analisis`** (E2-2): lectura + foto + visita + competidor. Excluye
`descartada`. Para revisar y para consultas rápidas.

**`comparacion_precios`** (E2-7), una fila por lectura con equivalencia aprobada:

| Grupo | Columnas |
|---|---|
| Cuándo | `fecha_observacion` = `capturada_at` de la foto, o `created_at` de la visita si no hay; `fecha_origen` |
| Dónde | `competidor`, `zona`, `latitud`, `longitud`, `visita_id`, `foto_id`, `ruta` |
| Competencia | `articulo`, `marca`, `cantidad`, `unidad`, `piezas`, `precio`, `precio_promocion`, `texto_promocion`, `estado_lectura` |
| Nuestro | `articulo_propio`, `codigo`, cantidad / unidad / piezas, `precio_propio` (el vigente en `fecha_observacion` si hay historial) |
| Calculado por SQL | `unidad_comparacion` ("100 g" / "100 ml" / "pieza"), `precio_normalizado_competencia`, `precio_promocion_normalizado`, `precio_normalizado_propio`, `diferencia` y `diferencia_pct` (positivo = la competencia está más cara) |

Reglas:
- Solo equivalencias `aprobada` y tipo `mismo_articulo` u `otra_presentacion`.
- Lecturas `propuesta`, `aprobada` y `corregida` (con la columna `estado_lectura` para
  filtrar); **nunca** `por_revisar` ni `descartada`.
- Solo si las dos `unidad_base` coinciden.
- Pensada para que un tablero futuro haga `group by competidor, zona, date_trunc('week',
  fecha_observacion)` sin más cálculos.

---

## 6. La llamada a Claude (una por foto)

### 6.1 Qué se manda
- **Instrucciones fijas** (system prompt) en español: listar **cada producto con precio
  visible**; **no adivinar** (si no se lee, decirlo y bajar la confianza); separar
  regular y promoción; cantidad y unidad por separado (convertir "1 lt" → `1`, `l`); no
  calcular precios de "2x$30" (solo copiar el texto); **ignorar personas**; calificar la
  calidad de la foto y de cada etiqueta; cuándo usar `alta`/`media`/`baja`.
- **La foto** por su URL pública de Supabase (el bucket ya es público para lectura). Si en
  la evaluación la URL diera problemas, se manda en base64.
- **`output_config.format`** con el esquema JSON (6.2). Sin herramientas, sin conversación.
- Las instrucciones se marcan para *prompt caching*.

### 6.2 Forma del JSON

```json
{
  "calidad_foto": "legible",
  "motivo_calidad": null,
  "precios_visibles_aprox": 6,
  "lecturas": [
    {
      "articulo": "Refresco Coca-Cola",
      "marca": "Coca-Cola",
      "cantidad": 600,
      "unidad": "ml",
      "piezas": 1,
      "precio": 18.5,
      "precio_promocion": null,
      "texto_promocion": null,
      "texto_leido": "COCA COLA 600ML $18.50",
      "calidad": "legible",
      "confianza_articulo": "alta",
      "confianza_presentacion": "alta",
      "confianza_precio": "alta",
      "motivo_duda": null
    }
  ]
}
```

- `calidad_foto`, `unidad`, `calidad` y las confianzas son **listas cerradas** (`enum`) en
  el esquema: Claude no puede inventar otros valores.
- `precios_visibles_aprox` detecta si Claude **se saltó** precios: si cuenta 30 y lista 12,
  la foto se marca para revisar.
- Se revisa `stop_reason`: si es `max_tokens` (respuesta cortada) o `refusal`, la foto pasa
  a `error`.

### 6.3 Parámetros
- `model`: el que gane en E2-5 (`claude-sonnet-5-5` o `claude-haiku-5-5`).
- `max_tokens`: 16 000 (se ajusta en E2-5).
- `output_config.effort`: se decide en E2-5 (probar `low` y `medium`). Pensamiento
  adaptativo (encendido por defecto en ambos modelos).
- Sin `temperature` / `top_p` (estos modelos los rechazan).
- *Fallbacks* (reintentar con otro modelo si Claude se niega): **no existen en lotes**. Una
  negativa se trata como `error` y se reintenta. En los scripts sin lote (E2-4, E2-5) con
  Sonnet 5.5 se puede activar `fallbacks: "default"` (beta) para no perder la prueba.

---

## 7. Lotes: flujo de dos pasos

**Por qué dos pasos:** un lote **no responde al momento**. Primero se **entrega** a
Anthropic y se recibe un número de lote; Anthropic lo procesa en segundo plano (casi siempre
en menos de 1 h, máximo 24 h) y después **se recogen** los resultados (disponibles 29 días).
A cambio cuesta **50 % menos**. Por eso son dos comandos separados.

### Paso 1 — `npm run lote:crear` ("entregar")
1. Busca fotos `pendiente`, o `error` con `intentos < 3`. **Nunca** `procesada` ni
   `en_lote`. Máximo `N` por lote (ej. 200, configurable).
2. **Muestra un estimado de costo** y pide confirmación (`¿Continuar? s/n`).
3. Arma una petición por foto. El **`custom_id` es el `id` de la foto** (los resultados
   llegan **en cualquier orden**; así se sabe de qué foto es cada uno).
4. `messages.batches.create` → Anthropic devuelve el id (`msgbatch_...`).
5. Guarda el id en `lotes_proceso` (`en_proceso`) y marca las fotos `en_lote`,
   `intentos + 1`.
6. Si el paso 5 fallara, imprime el id para no perderlo (el paso 2 acepta un id a mano).

### Paso 2 — `npm run lote:recoger` ("recoger")
1. Busca lotes `en_proceso` y pregunta su estado (`messages.batches.retrieve`). Si **no ha
   terminado**: "aún no está listo, vuelve más tarde" y no hace nada.
2. Si terminó, lee los resultados (`messages.batches.results`), uno por foto:
   - `succeeded` + `end_turn` + JSON válido → calcula estados, liga o crea artículos de la
     competencia y llama a `guardar_lecturas` → foto `procesada` con su calidad.
   - Cortada, negada o JSON inválido → foto `error` con motivo.
   - `errored`, `expired`, `canceled` → foto `error` con motivo.
3. Suma `usage`, calcula el costo real y marca el lote `recogido`.
4. Resumen: fotos OK / error, calidad de fotos (cuántas borrosas, con reflejo…), lecturas
   `propuesta` / `por_revisar` / `descartada`, artículos nuevos y costo.

**`guardar_lecturas`** (función de Postgres, todo o nada, solo `service_role`): revisa que
la foto no esté `procesada` (si lo está, no hace nada → **no hay duplicados**), borra
lecturas de un intento a medias, inserta las nuevas y marca la foto `procesada`. Correr el
paso 2 dos veces no duplica nada.

El mismo flujo de dos pasos se reusa para las equivalencias (`tipo = 'equivalencias'`).

---

## 8. Quién dispara el proceso (no puede ser público)

| | **A. Script local** (recomendada) | **B. Ruta protegida en Vercel** |
|---|---|---|
| Cómo | Tú corres `npm run lote:crear` y luego `npm run lote:recoger` en tu computadora | Ruta `src/app/api/proceso/route.ts` que solo responde si trae `Authorization: Bearer <PROCESO_SECRET>`. La puede llamar Vercel Cron |
| Llaves en Vercel | **Ninguna** | `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `PROCESO_SECRET` |
| Superficie de ataque | **Cero**: no existe ninguna dirección nueva en internet | Una URL pública: si la clave se filtra, alguien puede gastar tu saldo o leer el catálogo |
| Riesgo para la app publicada | Ninguno | Bajo, pero es código nuevo en producción |
| Límite de tiempo | Ninguno | Las funciones de Vercel tienen tiempo máximo |
| Automático | No: alguien lo corre (ej. una vez al día) | Sí, con Cron |

**Recomendación: A (script local).** Explicación sencilla: como no hay login, cualquier
dirección de internet que dispare el proceso es una puerta que alguien podría encontrar; la
única protección sería una clave, y si se filtra cuesta dinero y expone el catálogo. Con el
script local **esa puerta no existe**: las llaves nunca salen de tu computadora y la app
publicada no cambia. Los lotes ya trabajan "en segundo plano", así que correr dos comandos
al día no es carga. Si después se quiere automatizar, se agrega B reusando
`src/lib/etapa2/` (el agente que lo haga lee primero la guía de *route handlers* en
`node_modules/next/dist/docs/`).

---

## 9. Evaluación (Fase E2-5)

### 9.1 Muestra
- **25 fotos** (20–30) que cubran: etiqueta simple, foto con muchos precios, regular +
  promoción, "2x$30", varios precios en una etiqueta (ej. pieza y caja), paquete
  ("6 × 355 ml"), presentación rara (ej. "1.5 l" escrito "1500ml"), foto borrosa, con
  reflejo, lejana, HEIC convertida y una foto **sin** precios.
- Al menos **5 fotos nuevas** tomadas ya con la configuración de la Fase E2-1 (2200 px /
  0.85), y **5 en tamaño original** guardadas en `datos_privados/fotos_prueba/` para comparar
  tamaños.
- El usuario escribe **a mano** la respuesta correcta en `docs/evaluacion/esperado.json`:
  por foto, la calidad y por cada producto artículo, marca, cantidad, unidad, piezas,
  precio, promoción.

### 9.2 Qué se compara (`npm run evaluar`, API normal sin lote)
- `claude-sonnet-5-5` vs `claude-haiku-5-5`, con effort `low` y `medium` (4
  configuraciones).
- Tamaño: original vs 2200 px / 0.85 vs 2000 px / 0.8 / 1 MB (con el mejor modelo).

### 9.3 Métricas (por configuración)

| Métrica | Cómo se mide |
|---|---|
| **Acierto de artículo** | El artículo y la marca corresponden al esperado (se compara normalizado; los casos dudosos los marca el usuario a mano) |
| **Acierto de presentación** | `cantidad`, `unidad` y `piezas` iguales tras normalizar (1 l = 1000 ml) |
| **Acierto de precio** | Precio igual **al centavo**; promoción aparte |
| **Faltantes** | Productos esperados que no aparecieron |
| **Inventados** | Lecturas que no existen en la foto. **El error más grave** |
| **Calibración de la confianza** | Para cada campo y nivel: % de acierto. Meta: `alta` ≥ 95 %, `media` claramente menor, `baja` la menor. Si `alta` falla seguido, la confianza no sirve y hay que revisar las instrucciones |
| **Utilidad del estado** | De las lecturas incorrectas, % que quedó `por_revisar` o `descartada` (el sistema avisó) |
| **Calidad de foto** | % de fotos con la calidad correcta |
| **Costo y tiempo** | Tokens reales (`usage`) → USD por foto, y por 1 000 fotos con precio de lote |

**Criterio propuesto:** el modelo más barato con ≥ 95 % de precios correctos entre las
lecturas `propuesta`, **0 inventados** como `propuesta` y `alta` bien calibrada. **El
usuario elige.** Resultado en `docs/evaluacion/RESULTADOS.md`.

### 9.4 Segunda lectura independiente (opcional, se decide con datos)
- **Qué es:** leer la misma foto **dos veces por separado** (otro modelo, o el mismo modelo
  otra vez) y comparar campo por campo. Si no coinciden artículo, presentación o precio, la
  lectura pasa a `por_revisar` con `discrepancia` explicada.
- **Ventaja:** atrapa errores que el modelo da con confianza `alta` (justo los que la
  confianza no ve).
- **Costo:** casi duplica el costo por foto (con Haiku sigue siendo centavos por cientos de
  fotos) y complica emparejar productos entre las dos lecturas (se emparejan por artículo +
  presentación + precio parecidos).
- **Cómo se decide:** en E2-5 se mide cuántos errores con `alta` atraparía. **Si la
  confianza ya está bien calibrada, no se activa.** Si no, se activa (todas las fotos o
  solo las de artículos clave). Queda como interruptor en el código (`SEGUNDA_LECTURA`).

---

## 10. Riesgos

| Riesgo | Qué puede pasar | Cómo se mitiga |
|---|---|---|
| **Etiquetas ilegibles** (borrosas, reflejo, lejos, cortadas) | Precios **inventados** que parecen reales | "No adivines" en las instrucciones; `calidad` por foto y por etiqueta; confianza baja → `por_revisar`; sin precio → `descartada`; E2-5 mide inventados. Fotos de 2200 px sin tope de 1 MB (3.3) y guía de campo (3.4) |
| **Varios precios en una etiqueta** (pieza / caja, por kg / por pieza, precio socio) | Se guarda el que no es, o se mezclan | Instrucción: una lectura por precio de **producto y presentación**; si una etiqueta tiene dos presentaciones, dos lecturas (con `piezas`); si no es claro cuál es el precio de venta → `confianza_precio` media y `por_revisar` |
| **Regular y promoción juntos** | Se guarda la promoción como regular, o se calcula mal "2x$30" | Columnas separadas `precio`, `precio_promocion`, `texto_promocion`; Claude no calcula promociones (solo copia el texto); promoción ≥ regular → `por_revisar` |
| **Presentaciones que cambian** (600 ml → 500 ml, "contenido especial") | Comparar artículos que ya no son iguales; perder la tendencia | La presentación es parte de la `clave` del artículo de la competencia → una presentación nueva es un artículo nuevo con su propia equivalencia (`otra_presentacion`); la comparación es **por unidad** (100 ml), así que sigue siendo justa |
| **Personas en las fotos** | Privacidad; el bucket de fotos es **público** para leer (Etapa 1) | Guía: sin personas. Instrucción a Claude: ignorar personas y no describirlas (además Claude no identifica personas). Nunca se guardan descripciones de personas. **Pendiente para el usuario:** valorar más adelante hacer el bucket privado (cambia la app publicada; no es de esta etapa) |
| **Costo por lote** | Un lote grande, o fotos basura (la app es abierta, sin login) | Tope de fotos por lote, estimado y confirmación antes de crear, costo real en `lotes_proceso`, llave propia con **límite de gasto**, no se reprocesan fotos `procesada`, máximo 3 intentos |
| **Información comercial sensible del catálogo** | Que nuestros precios se filtren | `catalogo_propio`, historial, equivalencias y la vista cerradas a `anon`; el archivo original en `datos_privados/` (ignorada por git, verificado con `git status`); **nunca** se mandan nuestros precios a Claude (solo nombres y presentaciones para equivalencias); llaves solo en `.env.local`; opción A (sin URL pública) |
| Negativa del modelo (`refusal`) | Una foto no se procesa | `error` y reintento; tras 3 intentos queda para revisión |
| Lote no recogido a tiempo | Resultados borrados a los 29 días | El paso 2 avisa de lotes `en_proceso` con más de 7 días |
| Hora de captura falsa o faltante | Fecha equivocada en tendencias | `capturada_origen`; la vista usa la hora de la visita si falta; se marca sospechosa si es posterior a la subida o > 7 días antes de la visita |
| Llave secreta filtrada | Acceso total a la base o gasto en Anthropic | Solo `.env.local`, nunca `NEXT_PUBLIC_`; `git status` antes de cada commit |

**Estimado de costo por foto con lotes** (50 % de descuento; foto de 2200 × 1650 ≈ 4 700
tokens + ~1 800 de instrucciones = ~6 500 de entrada, ~3 000 de salida con pensamiento).
**Se reemplaza con lo medido en E2-5:**

| Modelo | Normal (entrada / salida por millón) | Lote | ≈ por foto | ≈ 1 000 fotos |
|---|---|---|---|---|
| `claude-sonnet-5-5` | $2 / $10 | $1 / $5 | ~$0.022 | ~$22 USD |
| `claude-haiku-5-5` | $0.10 / $0.50 | $0.05 / $0.25 | ~$0.0011 | ~$1.10 USD |

La segunda lectura (9.4), si se activa, suma el costo del modelo que la haga.

---

## 11. Fases de la Etapa 2

Cada fase la hace **un agente distinto**, con las reglas de cierre de `PLAN.md` (build,
lint, `PROGRESO.md`, un commit, **sin push**, `git status` sin `.env.local` ni
`datos_privados/`). **Antes de ejecutar cualquier cosa en Supabase, el agente avisa y
explica.**

### Fase E2-0 — Plan ✅
Este archivo. Sin código.

### Fase E2-1 — Ajuste de la Etapa 1: fechas y fotos

**Campos de fecha y hora que hay hoy:**

| Tabla | Columna | Reloj | Propuesta |
|---|---|---|---|
| `visitas` | `created_at` | Servidor (confiable) | **Conservar** |
| `visitas` | `ubicacion_at` | Celular, al tocar "guardar ubicación" | **Conservar** |
| `visitas` | `competidor_elegido_at` | Celular, al elegir competidor | **Quitar** (no aporta al análisis) |
| `fotos` | `created_at` | Servidor, hora de **subida** | Conservar |
| `competidores` | `created_at` | Servidor | Conservar |
| `fotos` | — | — | **Agregar `capturada_at` y `capturada_origen`** (5.2) |

**¿El navegador entrega la hora de captura de forma confiable?** **No al 100 %.**
- `File.lastModified` **no sirve**: en iPhone suele ser la hora en que se eligió la foto, y
  en Android puede ser la hora en que se copió o descargó el archivo. No se usa.
- Lo confiable es el dato **EXIF `DateTimeOriginal`** dentro del archivo, que se lee con
  JavaScript **antes de comprimir** (al comprimir se pierde).
- **iPhone (Safari):** al elegir de la galería, iOS suele entregar un JPEG (convierte la
  HEIC) y **conserva la fecha** EXIF; quita la ubicación GPS (no nos importa: ya tenemos la
  de la visita). Las fotos recientes traen además la zona horaria (`OffsetTimeOriginal`).
- **Android (Chrome):** el selector de fotos conserva la fecha EXIF de las fotos de la
  cámara; también quita el GPS. Los celulares nuevos guardan la zona horaria; algunos
  viejos no.
- **Casos sin fecha:** capturas de pantalla, fotos reenviadas por WhatsApp (WhatsApp borra
  el EXIF), fotos editadas en algunas apps. Ahí queda `sin_dato`.
- Esto es el comportamiento conocido; **se comprueba en esta fase con fotos reales de un
  iPhone y un Android** antes de dar la fase por buena.

**Qué se hace (en este orden, para no romper la app publicada):**
1. `supabase/002_fotos_hora_captura.sql`: agrega `capturada_at`, `capturada_origen` (con
   `check`) y da a `anon` permiso de `insert` en esas dos columnas. La app vieja sigue
   funcionando (no las manda). **El usuario lo ejecuta primero.**
2. Código:
   - `src/lib/exif.ts` (nuevo): lector propio y pequeño de EXIF para JPEG (busca
     `DateTimeOriginal` y `OffsetTimeOriginal`; si no hay zona, usa la del celular y marca
     `exif_zona_celular`). Si el archivo es HEIC y el lector no alcanza, queda `sin_dato` y
     se propone `exifr` con permiso (4.3).
   - `SubirFotos.tsx`: lee la hora **antes** de `prepararFoto` y la manda al crear la foto.
   - `fotos.ts`: 2200 px, calidad 0.85, `maxSizeMB: 4` (3.3).
   - Quitar `competidor_elegido_at` de `FormularioNuevaVisita.tsx`, `DetalleVisita.tsx` y
     `tipos.ts`; agregar los campos nuevos de `fotos` en `tipos.ts`.
   - `GaleriaFotos.tsx`: mostrar "Tomada …" si hay `capturada_at` (además de "Subida …").
3. Build, lint, prueba local y **despliegue** (el usuario confirma que la app publicada
   funciona: crear visita, subir fotos de iPhone y Android, ver la hora de captura).
4. `supabase/003_quitar_competidor_elegido_at.sql`: `alter table visitas drop column if
   exists competidor_elegido_at`. ⚠️ **Se ejecuta solo después del paso 3**: si se ejecuta
   antes, la app publicada (que aún manda esa columna) dejaría de crear visitas. Borra esos
   datos para siempre: el agente ofrece exportarlos antes y pide confirmación.
5. Actualizar `PLAN.md` (sección 4.1, tablas) para reflejar los cambios.

**Cómo comprobar:** visitas nuevas se crean bien; las fotos nuevas tienen `capturada_at` y
`capturada_origen = exif` (iPhone y Android); una captura de pantalla queda `sin_dato`; las
fotos nuevas miden 2200 px de lado mayor; `competidor_elegido_at` ya no existe.

### Fase E2-2 — Base de datos de lecturas
- `supabase/004_etapa2_lecturas.sql`: columnas de estado y calidad en `fotos`,
  `lotes_proceso`, función de normalización (5.1), `articulos_competencia`,
  `lecturas_precio`, `guardar_lecturas`, vista `lecturas_analisis`, permisos (5.0).
- Tipos de servidor en `src/lib/etapa2/tipos.ts`; solo las columnas nuevas de `fotos` en
  `src/lib/tipos.ts`.
- `.env.example` con los nombres de 4.1. Guiar al usuario para crear la llave de Anthropic
  (con límite de gasto) y copiar la secret key de Supabase a `.env.local`.

**Cómo comprobar:** la app publicada funciona igual; fotos viejas `pendiente`; con la llave
pública, `select` sobre `lecturas_precio`, `articulos_competencia`, `lotes_proceso` y
`lecturas_analisis` **falla**; probar en el SQL Editor que `contenido_base` de "6 × 355 ml"
da 2130.

### Fase E2-3 — Catálogo propio
- **Preguntar al usuario las columnas del archivo** (y formato) antes de nada.
- `supabase/005_catalogo_propio.sql` (y el historial si se aprueba, 5.6).
- `scripts/etapa2/importar-catalogo.ts` + `npm run catalogo:importar`. Pedir permiso si
  hace falta una librería para Excel.
- Verificar con `git status` que el archivo en `datos_privados/` **no** aparece.

**Cómo comprobar:** el resumen del script cuadra con el archivo; con la llave pública,
`select` sobre `catalogo_propio` **falla**; correr la importación dos veces no duplica.

### Fase E2-4 — Leer una foto
- Pedir permiso para `@anthropic-ai/sdk` (4.3).
- `src/lib/etapa2/`: instrucciones, esquema JSON, validación y cálculo de estado.
- `scripts/etapa2/leer-una-foto.ts <foto_id>`: llama a la API (sin lote), valida e
  **imprime**. No guarda nada.

**Cómo comprobar:** con 3 fotos reales, lo impreso coincide con lo que se ve.

### Fase E2-5 — Evaluación
- Sección 9 completa. **El usuario elige** modelo, effort, tamaño de foto y si se activa la
  segunda lectura. Actualizar el estimado de costo de la sección 10.

### Fase E2-6 — Lotes y guardado
- `crear-lote.ts` y `recoger-lote.ts` (sección 7) con el modelo elegido. Primera corrida
  real con **20 fotos**.

**Cómo comprobar:** las 20 fotos pasan a `procesada` (o `error` con motivo) con su calidad;
hay lecturas y artículos de la competencia; el costo queda en `lotes_proceso`; correr
`lote:recoger` otra vez **no duplica**; una foto `procesada` **no** entra a un lote nuevo;
una en `error` sí.

### Fase E2-7 — Equivalencias y comparación
- Decidir con el usuario lo de `zonas` (5.8).
- `supabase/006_equivalencias_comparacion.sql`: `equivalencias`, `zonas` (si se aprueba),
  vista `comparacion_precios`. Pedir permiso para `pg_trgm`.
- `scripts/etapa2/proponer-equivalencias.ts`.
- El usuario aprueba una muestra de equivalencias en Supabase.

**Cómo comprobar:** la vista muestra precio por 100 g / 100 ml / pieza de los dos lados con
competidor, zona y fecha; una equivalencia `otra_presentacion` se compara bien; con la llave
pública la vista **falla**; ningún precio nuestro aparece en las peticiones a Claude (se
revisa el texto que se manda).

### Fase E2-8 — Corrida completa y consultas de ejemplo
- Procesar todas las fotos pendientes (en lotes con tope) y proponer sus equivalencias.
- `supabase/consultas_etapa2.sql`: diferencia promedio por competidor y zona, artículos
  donde la competencia está más barata, evolución semanal de un artículo, lecturas
  `por_revisar`, fotos con `error` y fotos por calidad (para retroalimentar al equipo).
- Revisar con el usuario una muestra de `por_revisar` para ajustar las instrucciones.

---

## 12. Fuente y supuestos

| Decisión / supuesto | Origen |
|---|---|
| Objetivo final y las 9 decisiones de la sección 2 | Usuario, 2026-11-19 |
| Opción A (script local) para disparar el proceso | Recomendación del agente, **pendiente de confirmar** |
| Confianza en 3 niveles; estado calculado por nuestro código; `valores_agente` inmutable | Propuesta del agente (5.5) |
| Tabla `articulos_competencia` (equivalencia una vez por artículo, no por lectura) | Propuesta del agente, **pendiente de confirmar** (5.4) |
| Columna `piezas` para paquetes | Propuesta del agente, **pendiente de confirmar** (5.1) |
| Historial de precios propios y tabla `zonas` | Propuesta del agente, **pendiente de confirmar** (5.6, 5.8) |
| Columnas de `catalogo_propio` | **Pendiente: el usuario dice qué trae su archivo** (5.6) |
| Tamaño 2200 px / JPEG 0.85 / sin tope de 1 MB | Propuesta del agente con la documentación de visión (3.3); se confirma en E2-5 |
| Límites de visión (2576 px, 4 784 tokens, 10 MB, 28 × 28 px por token) | Documentación de Anthropic consultada el 2026-11-19 |
| Precios de los modelos y lotes (50 %, 24 h, 29 días) | Documentación de Anthropic al 2026-11; revisar antes de E2-5 |
| Comportamiento de EXIF en iPhone y Android | Comportamiento conocido; **se comprueba con celulares reales en E2-1** |
| `@anthropic-ai/sdk`, lector de Excel, `exifr`, `pg_trgm` | **Pendientes de permiso** en su fase |
