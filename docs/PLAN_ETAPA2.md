# PLAN — Etapa 2: inteligencia de precios de la competencia

> **Para cualquier agente que lea esto:** lee primero `docs/PLAN.md` (Etapa 1: reglas,
> stack y diseño de datos), después **todo** este archivo y al final `docs/PROGRESO.md`.
> Trabaja **solo en la fase que te toca** (la primera de la Etapa 2 sin ✅ en `PROGRESO.md`).
> Las reglas de la sección 3 de `PLAN.md` siguen valiendo, salvo lo que este archivo cambie
> de forma explícita (ver sección 2).
>
> **Datos privados (`datos-privados/`):** nunca se copian datos reales (precios, nombres de
> artículos, códigos, tiendas, plazas) a `docs/`, comentarios de código ni mensajes de
> commit, porque se suben a GitHub. En pantalla, solo encabezados, conteos y como máximo 5
> filas de muestra. Los archivos originales no se modifican ni se mueven, y nunca se hace
> `git add` de esa carpeta.
>
> **🧱 Alcance actual (2026-11-20): solo la BASE.** Por ahora se construyen únicamente las
> fases marcadas **🧱 base** en la sección 11: ajustes de la Etapa 1, estructura de tablas y
> carga del catálogo. **No se implementan agentes ni se hace ninguna llamada a la API de
> Anthropic** hasta las fases **🤖 agentes** (lectura de fotos en adelante). **Ningún
> agente empieza una fase 🤖 sin que el usuario lo pida de forma explícita**, aunque todas
> las fases 🧱 estén terminadas.
>
> **🔒 Regla de la API (sin excepciones): a la API de Anthropic NUNCA se envían precios
> propios** (ni regulares, ni de promoción, ni de mayoreo), ni datos de venta. Solo se
> permite enviar las **descripciones** de nuestros artículos y las **fotos** de anaqueles
> de la competencia (permiso del responsable de los datos, 2026-11-20; sección 2.1).

---

## 0. Objetivo final

**Un sistema de inteligencia de precios de la competencia.** Los agentes leen las fotos de
anaquel, identifican **artículo, presentación y precio**, lo comparan contra **nuestro
catálogo** y permiten analizar las diferencias **por competidor y fecha** (por zona, en una
segunda iteración: sección 5.8).

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
5. Cada lectura se liga a un **artículo de la competencia** (`articulos_competencia`), y
   ese artículo se relaciona con uno de **nuestro catálogo** (`catalogo_propio`) en la
   tabla `equivalencias`. **El método para decidir esa relación aún no está definido**: se
   decide en la fase de agentes (5.7).
6. La vista **`comparacion_precios`** une todo y calcula, con SQL, el precio por 100 g /
   100 ml / pieza de la competencia y el nuestro (**precio regular**), con competidor y
   fecha, y el índice `indice_vs_competencia_pct` (5.9).

Los pasos 2–5 son de las fases **🤖 agentes**; la base (🧱) deja listas las tablas, el
catálogo cargado y la vista, que se llenan después.

### Fuera de alcance de la Etapa 2 (no lo hagas)
- Una pantalla en la app para revisar lecturas o equivalencias. Por ahora se revisa en
  Supabase (Table Editor / SQL Editor). Las tablas ya tienen los campos para agregarla.
- Tableros, alertas y gráficas de tendencia (se dejan **listas las vistas** para hacerlos).
- Un agente autónomo con herramientas. Es **una llamada por foto** (sección 6).
- Cambiar el flujo de la app publicada, salvo el ajuste pequeño de la Fase E2-1.
- Login de usuarios.
- **Tabla `zonas`, comparación por zona y promociones regionales** (segunda iteración,
  5.8).

---

## 2. Decisiones de la Etapa 2 (confirmadas por el usuario el 2026-11-19, NO cambiar)

| # | Decisión | Detalle en |
|---|---|---|
| 1 | La API de Claude vive **en código de servidor** dentro de este proyecto. `ANTHROPIC_API_KEY` y `SUPABASE_SECRET_KEY` se usan **solo en servidor**, **nunca** con `NEXT_PUBLIC_`. El disparador **no es público** (no hay login): script local o ruta protegida con clave secreta. | Secciones 4 y 8 |
| 2 | **Una llamada por foto** con respuesta **JSON validada**. Para muchas fotos, **Message Batches API** (flujo de dos pasos). Se evalúa como **opcional** una segunda lectura independiente para marcar discrepancias. | Secciones 6, 7 y 9.4 |
| 3 | Tablas nuevas, **todas cerradas al usuario anónimo** (ni lectura ni escritura): `catalogo_propio`, `lecturas_precio`, `equivalencias` y una **vista de comparación** normalizada por unidad, calculada **por la base de datos con SQL**. | Sección 5 |
| 4 | Cada foto tiene **estado de procesamiento** (`pendiente`, `en_lote`, `procesada`, `error`), **calidad** (`legible`, `borrosa`, `reflejo`, `lejana`, `sin_precios`) y **motivo**. **No se reprocesan** fotos ya procesadas. | Sección 5.2 |
| 5 | Nuestra lista de precios se carga con un **script de importación**. Los archivos originales **no se suben a GitHub**: viven en `datos-privados/` (ignorada por `.gitignore`). ~~Se pregunta al usuario qué columnas trae~~ **Ya se conocen (2026-11-20):** es un paquete de CSV con artículos y promociones, descrito **solo en su estructura** en la sección 5.10. | Secciones 5.6 y 5.10 |
| 6 | **Fase previa de ajuste de la Etapa 1** (pequeña, con migraciones SQL **nuevas**, sin editar los archivos viejos): conservar `created_at` y la hora de ubicación, **quitar `competidor_elegido_at`**, y guardar en `fotos` la **hora de captura**, leída del archivo **antes** de comprimirlo. | Sección 11, Fase E2-1 |
| 7 | **Tamaño de foto** revisado contra la documentación vigente de visión, con propuesta de tamaño y calidad JPEG para las fotos nuevas y **guía corta** para el equipo de campo. | Sección 3 |
| 8 | **Evaluación** con 20–30 fotos verificadas a mano: Sonnet 5.5 (`claude-sonnet-5-5`) vs Haiku 5.5 (`claude-haiku-5-5`) en acierto de artículo, presentación y precio, **calibración** de la confianza y costo. *(2026-11-20: queda como **última** fase; ver 2.1.)* | Sección 9 |
| 9 | Riesgos documentados: etiquetas ilegibles, varios precios en una etiqueta, regular y promoción juntos, presentaciones que cambian, personas en las fotos, costo por lote, información comercial sensible del catálogo. | Sección 10 |

### 2.1 Decisiones del 2026-11-20 (confirmadas por el usuario, NO cambiar)

| # | Decisión | Detalle en |
|---|---|---|
| 10 | **Alcance:** por ahora solo la **base** (🧱): ajustes de la Etapa 1, estructura de tablas y carga del catálogo. **Sin agentes ni llamadas a la API de Anthropic** hasta las fases de lectura de fotos (🤖). Ninguna fase 🤖 empieza sin que el usuario lo pida. | Sección 11 |
| 11 | **Permiso del responsable de los datos (2026-11-20):** (a) cargar catálogo y promociones en Supabase; (b) enviar a la API de Anthropic las **descripciones** de nuestros artículos, **sin precios**; (c) enviar a la API las **fotos de anaqueles** de la competencia. Se quita el bloqueo de E2-3. **Regla: a la API NUNCA se envían precios propios** (ni datos de venta). | Secciones 10 y 11 |
| 12 | **Índice con el signo de la consultora:** columna `indice_vs_competencia_pct`; **positivo = nosotros más caros**. Documentado en el plan y en la vista (`comment on column`). | Sección 5.9 |
| 13 | **Equivalencias:** el **método** para decidir cuándo un artículo de la competencia equivale a uno nuestro **no está definido**; se decide en la fase de agentes. En la base solo existe la **estructura** (tabla con `tipo` y `estado`), sin lógica de llenado. Sin reglas de códigos de barras. | Sección 5.7 |
| 14 | **Sin tabla `zonas` en esta versión.** La comparación usa el **precio regular**, que no depende de la zona. Promociones regionales: **segunda iteración**. Pregunta abierta: cómo se traduce la latitud/longitud de una visita a una plaza. | Sección 5.8 |
| 15 | **Evaluación al final**, con una muestra de **20–30 fotos reales de la app verificadas a mano**. Aún no hay datos del levantamiento de octubre; si llegan, se agregan después. | Sección 9 |
| 16 | **Calidad del catálogo:** los problemas (mayoreo ≥ regular, descuentos negativos, precios en 0, descripciones repetidas…) se registran en un **reporte dentro de `datos-privados/`** al importar, **sin corregirlos en silencio**. En pantalla y en los docs, solo conteos. | Secciones 5.6.5 y 5.10.4 |

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
- La Fase E2-9 (evaluación, al final) **confirma** con fotos reales que 2200 / 0.85 lee
  mejor que 2000 / 0.8 / 1 MB. Si no hubiera diferencia, se puede regresar a 2000 px para
  ahorrar.
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
├── importar-catalogo.ts        ← 🧱 carga nuestra lista de precios (E2-3)
├── leer-una-foto.ts            ← 🤖 prueba con una foto, sin guardar (E2-5)
├── crear-lote.ts               ← 🤖 paso 1 del lote (E2-6)
├── recoger-lote.ts             ← 🤖 paso 2 del lote (E2-6)
├── (equivalencias)             ← 🤖 nombre y forma según el método que se defina (E2-7)
└── evaluar.ts                  ← 🤖 compara modelos contra fotos verificadas (E2-9)
src/lib/etapa2/                 ← piezas compartidas de servidor: instrucciones (prompt),
                                  esquemas JSON, validación, cálculo de estado
datos-privados/                 ← archivos originales (lista de precios, fotos de prueba
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
| `@anthropic-ai/sdk` | E2-5 (🤖; **no** se instala en la base) | Oficial de Anthropic. Ya trae lotes (crear, consultar, leer resultados línea por línea), reintentos automáticos ante saturación (429/5xx), tipos de TypeScript y errores por tipo. Solo servidor: no pesa en el celular | `fetch` a mano: habría que escribir y mantener todo eso |
| ~~Lector de Excel~~ | — | **Ya no hace falta:** el paquete viene en CSV UTF-8. Ojo: algunas descripciones van **entre comillas porque traen comas**, así que el lector propio debe respetar comillas (nunca `linea.split(',')`). ~30 líneas en `src/lib/etapa2/csv.ts` | — |
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
| `supabase/005_catalogo_propio.sql` | E2-3 | `catalogo_propio`, `catalogo_propio_cortes`, `promociones_propias`, función `importar_corte` y vista `precio_propio_vigente` (5.6) |
| `supabase/006_equivalencias_comparacion.sql` | E2-4 | `equivalencias` (solo estructura, 5.7) y vista `comparacion_precios` (5.9). **Sin** `zonas` |

Todos estos archivos son de fases **🧱 base**. Si la fase de agentes que define el método de
equivalencias (E2-7) necesita columnas nuevas, va en un archivo **nuevo** (`007_...`).

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

**Cómo entra nuestro catálogo a estas reglas** (detalle en 5.6.5): el paquete trae el
contenido **ya convertido** a `g` o `ml` (litros, kilos y onzas ya pasados a ml / g) y en
paquetes trae el contenido **del paquete completo**. Por eso, al importar: `cantidad =
contenido del archivo`, `unidad = g | ml`, `piezas = 1` (el total ya incluye las piezas).
Si el archivo no trae contenido, `cantidad` y `unidad` quedan **vacías** y el artículo se
marca para revisión; **no se adivina**.

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
| `tipo` | `text` no nulo | `lectura_fotos` (y otros tipos si el método de equivalencias de E2-7 usa lotes) |
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
| `ean` | `text` | Código de barras, si alguna lectura lo trajo. Solo se guarda: **cómo (o si) se usa** se decide con el método de equivalencias (5.7) |
| `clave_normalizada` | `text` no nulo, **único** | Generada: minúsculas, sin acentos ni espacios dobles, de `marca + articulo + cantidad + unidad + piezas`. Evita duplicados. *(Antes se llamaba `clave`; se renombra para no confundirla con `catalogo_propio.clave`, que es el código del SCA)* |
| `created_at` | `timestamptz` | |

El proceso, al guardar una lectura, busca el artículo por `clave_normalizada`; si no
existe, lo crea.
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
| `ean` | `text` | Código de barras, si la etiqueta lo trae. Solo se guarda; **cómo se lee y si se usa** se decide en la fase de agentes |
| `codigo_interno` | `text` | **Nuevo.** Código del competidor que no es de barras |
| `precio` | `numeric(10,2)` | Precio **regular** por pieza, con impuestos. En "antes / ahora" es el **antes**. Vacío si la etiqueta no lo dice (**no** se toma de otro cartel) |
| `promo_tipo` | `text` no nulo, default `'ninguna'` | **Nuevo.** Lista cerrada, la misma del formato de la consultora (5.10): `ninguna`, `precio_rebajado`, `n_por_precio`, `nxm`, `n_al_porcentaje`, `combo`, `mayoreo`, `otro` |
| `promo_piezas` | `int` | **Nuevo.** Piezas que pide ("2" en "2 x $30"; "1" en "antes / ahora"). Si hay varios niveles ("1 x $24 ó 2 x $42") se toma el de **menos piezas** |
| `promo_precio_total` | `numeric(10,2)` | **Nuevo.** Precio de la promoción completa ("30" en "2 x $30"; el "ahora" en "antes / ahora") |
| `promo_paga_piezas` | `int` | **Nuevo, solo `nxm`.** "Lleva 3 paga 2" → `promo_piezas 3`, `promo_paga_piezas 2` |
| `promo_descuento_pct` | `numeric(5,2)` | **Nuevo, solo `n_al_porcentaje`.** "2.º al 50 %" → 50 |
| `promo_condicion` | `text` | **Nuevo.** `ninguna`, `tarjeta`, `monedero`, `app`, `dia_especifico`, `otro` |
| `vigencia_fin` | `date` | **Nuevo.** Fin de vigencia del cartel, si se lee. Vencida a la fecha de la foto → la promoción no cuenta (su regular sí) |
| `texto_promocion` | `text` | Tal cual: "2x$30", "Lleva 3 paga 2", "-20 %" |
| `texto_leido` | `text` | Lo que dice la etiqueta, para revisar |

**Promoción: Claude copia números, la base de datos calcula.** Claude **no** divide ni
multiplica: solo copia `promo_piezas`, `promo_precio_total`, etc. El **precio de promoción
por pieza** lo calcula SQL en la vista (`precio_promo_pieza`):
- `precio_rebajado` y `n_por_precio`: `promo_precio_total ÷ promo_piezas` (a centavos).
- `nxm`: `precio × promo_paga_piezas ÷ promo_piezas` (solo si hay `precio` regular).
- `n_al_porcentaje`: `precio × (promo_piezas − promo_descuento_pct/100) ÷ promo_piezas`.
- `combo`, `mayoreo`, `otro`, con `promo_condicion` distinta de `ninguna`, o vencida: **sin
  precio de promoción comparable** (se guarda, pero no entra a la comparación).

*(Antes había una columna `precio_promocion` que llenaba Claude; se quita porque obligaba a
Claude a hacer cuentas, que es justo lo que el plan prohíbe.)*
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
y la Fase E2-9 mide si están **calibrados** (sección 9.3).

**Estados y quién los pone:**

| Estado | Lo pone | Cuándo |
|---|---|---|
| `propuesta` | Nuestro código | Las tres confianzas en `alta` y pasa todas las validaciones |
| `por_revisar` | Nuestro código | Alguna confianza `media`/`baja`, validación "suave" fallida (ej. promoción ≥ regular), varios precios dudosos en la etiqueta, o discrepancia con la segunda lectura |
| `descartada` | Nuestro código o persona | Sin precio legible, precio ≤ 0 o absurdo, o no es un precio de producto |
| `aprobada` | Persona | Revisó y está bien |
| `corregida` | Persona | Cambió algún valor (el original queda en `valores_agente`) |

El estado lo calcula `src/lib/etapa2/validar.ts`, **no Claude**.

### 5.6 Nuestra lista de precios: catálogo, cortes y promociones

> **Actualizado el 2026-11-20** con la estructura real del paquete (sección 5.10). Aquí
> **no** hay datos reales: los ejemplos son inventados.

**Idea general.** Nuestro sistema de punto de venta (SCA) entrega "fotos" de la lista de
precios llamadas **cortes**: cada corte trae su `fecha_corte`. Los cortes **se apilan**:
uno nuevo no borra el anterior. Así la comparación de una foto de marzo usa **nuestro precio
de marzo** (lo que el plan anterior llamaba "historial de precios"; ya no hace falta una
tabla aparte porque el corte **es** el historial).

Se separa lo que **casi no cambia** (nombre, categoría, contenido) de lo que **cambia en
cada corte** (precio, venta), para guardar cada dato una sola vez:

```
catalogo_propio (1 fila por artículo, llave: clave)
   │ 1 ── n
   ├── catalogo_propio_cortes (1 fila por artículo y corte: precios y venta)
   │ 1 ── n
   └── promociones_propias (1 fila por artículo dentro de un grupo de una promoción)
```

#### 5.6.1 Tabla `catalogo_propio` (un artículo nuestro)

| Columna | Tipo | Notas |
|---|---|---|
| `clave` | `text`, **PK** | Clave del artículo en el SCA, en mayúsculas. Casi siempre es el código de barras, pero hay **claves internas** con letras (ej. inventado `Z123`). Es la misma llave que usa la consultora (`clave_x24`), así los datos se pueden juntar. Se guarda **tal cual**: ninguna columna ni regla derivada del código de barras en la base |
| `descripcion` | `text` no nulo | Ej. inventado "REFRESCO COLA 600 ML". Viene en mayúsculas y puede traer acentos y comas |
| `area_id`, `area` | `int`, `text` | Área de nuestro catálogo |
| `depto_id`, `departamento` | `int`, `text` | Departamento. Hay un departamento especial de "productos de baja" |
| `nacs_categoria_id`, `nacs_categoria`, `nacs_subcategoria_id` | `text` | Categoría estándar NACS (de la industria de tiendas de conveniencia) asignada por la consultora. **Estimada**: sirve para agrupar resultados. Vacía en casi todos los artículos de baja |
| `cantidad` | `numeric(10,3)` | Contenido de **todo el empaque**, ya en g o ml. Ej. 600. Vacío si no se sabe |
| `unidad` | `text` | Solo `g` o `ml` desde el archivo; `pieza` solo si una persona lo pone (5.6.5) |
| `piezas` | `int` no nulo, default 1 | Siempre 1 al importar: el archivo ya da el contenido del paquete completo (5.1) |
| `unidad_base`, `contenido_base` | generadas | Como en 5.1 |
| `contenido_origen` | `text` no nulo | `archivo` (estimado del SCA leyendo la descripción), `manual` (lo corrigió una persona), `sin_dato`. **El script nunca sobrescribe un `manual`** |
| `es_servicio` | `boolean` no nulo | Recargas, pagos, boletos… **Nunca** se comparan |
| `tasa_iva`, `tasa_ieps` | `numeric(5,4)` | Ej. 0.16 = 16 %. Del corte más reciente |
| `obsoleto`, `de_baja` | `boolean` no nulo | Del corte más reciente. Los dos excluyen de los promedios |
| `fecha_corte_ultimo` | `date` no nulo | Último corte en el que apareció el artículo |
| `actualizado_at` | `timestamptz` | |

- **Activo** se calcula, no se guarda: `not obsoleto and not de_baja and not es_servicio` y
  con venta en el último corte. Un artículo que deja de venir en los cortes **no se borra**
  (rompería comparaciones viejas); simplemente su `fecha_corte_ultimo` se queda atrás.
- El borrador anterior tenía `id bigint` + `codigo`. Se cambia a **`clave` como llave**
  porque ya es única, la usa la caja y la consultora, y evita una columna de más.

#### 5.6.2 Tabla `catalogo_propio_cortes` (precio y venta de un artículo en un corte)

PK: `(fecha_corte, clave)`; `clave` FK → `catalogo_propio.clave`.

| Columna | Tipo | Notas |
|---|---|---|
| `fecha_corte` | `date` no nulo | |
| `clave` | `text` no nulo | |
| `precio_regular` | `numeric(10,2)` no nulo | Precio de lista de **toda la cadena** (no hay precios por tienda), **con IVA e IEPS**, como en el anaquel |
| `precio_regular_sin_impuestos` | `numeric(12,4)` | Viene calculado en el archivo; el script comprueba que cuadre con las tasas |
| `fecha_ultimo_cambio_precio` | `date` | |
| `precio_mayoreo`, `mayoreo_desde_piezas` | `numeric(10,2)`, `int` | Si el ticket lleva N o más piezas del mismo artículo, todas se cobran a ese precio. **No es promoción** y **no entra** a la comparación (se guarda para consultas) |
| `promos_vigentes_al_corte`, `precio_promo_pieza_min_al_corte` | `int`, `numeric(10,2)` | Resumen que ya trae el archivo. Se guarda **solo para comprobar** que nuestra vista (5.6.4) da lo mismo |
| `piezas_12m` | `numeric(14,2)` | Piezas vendidas en los 12 meses previos al corte |
| `venta_12m_sin_impuestos` | `numeric(14,2)` | Venta 12 meses. **Sirve para ponderar** los promedios (5.9): un artículo que casi no se vende no debe mover el resultado |
| `fecha_ultima_venta` | `date` | |

#### 5.6.3 Tabla `promociones_propias`

Una fila por **artículo dentro de un grupo de una promoción**. Se guarda **igual que viene
del archivo** (sin partirla en "promoción" y "detalle") porque es una copia de solo lectura
del SCA y así el script es simple y los datos se pueden cruzar 1 a 1 con la consultora. Los
datos de la promoción (descripción, fechas…) se repiten en cada artículo; se acepta.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` identity, PK | Llave técnica (la natural tiene un campo que puede venir vacío) |
| `fecha_corte` | `date` no nulo | |
| `origen` | `text` no nulo | `promogrupo` (promoción programada) o `catalogo` (precio rebajado con fechas; el SCA **solo guarda la última** de cada artículo, así que su historia está incompleta) |
| `id_promocion` | `int` | Del SCA. **Puede ser negativo.** Vacío en `catalogo` |
| `categoria_promo_id`, `categoria_promo` | `int`, `text` | Tres categorías fijas del SCA |
| `descripcion_promo` | `text` | Lo que ve el cliente en el cartel. Ej. inventado "REFRESCO X 600 ML 2 x $30" |
| `regiones` | `text` | Plazas a las que aplica, separadas por guion (ej. inventado `PLAZA_A-PLAZA_B`). **Vacío = toda la cadena** |
| `fecha_inicio`, `fecha_fin` | `date` no nulo | Vigencia. Hay promociones **programadas** (empiezan después del corte) |
| `activa`, `vigente_al_corte` | `boolean` | |
| `es_combo` | `boolean` no nulo | `true` = pide artículos de 2 o más grupos (ej. licor + refresco). **Un combo no da precio por pieza comparable**: el SCA reparte el precio a su manera (a veces un artículo a $0) |
| `num_grupos`, `id_grupo` | `int` | Cualquier artículo del mismo grupo cuenta para las piezas requeridas |
| `clave` | `text` no nulo | **Sin FK estricta** a `catalogo_propio`: puede venir una clave que no vendió en 12 meses y no está en el catálogo. El script la reporta |
| `piezas_requeridas` | `int` | "2" en "2 x $30" |
| `precio_promo_pieza` | `numeric(10,2)` | Precio por pieza con impuestos ("15" en "2 x $30"). **Es lo que cobra la caja** |
| `precio_promo_grupo`, `precio_promo_total` | `numeric(10,2)` | Grupo = piezas × pieza; total = suma de grupos ("30" en "2 x $30") |
| `precio_regular_al_inicio`, `precio_normal_registrado` | `numeric(10,2)` | Precio normal al iniciar y el que registró la caja al cobrar |
| `descuento_pct` | `numeric(6,4)` | 0.1667 = 16.67 %. **Puede ser negativo** (ver 5.10.4) |
| `piezas_vendidas_promo`, `importe_vendido_promo` | `numeric(14,2)` | Lo vendido con la promoción |

Índice único para no duplicar al reimportar: `(fecha_corte, origen, coalesce(id_promocion,
0), coalesce(id_grupo, 0), clave)`.

#### 5.6.4 Vista / función `precio_propio_vigente` (nuestro precio regular en una fecha)

Responde: **"¿cuál era el precio regular de este artículo nuestro en esta fecha?"** La usa
`comparacion_precios` (5.9). Recibe `clave` y `fecha`. **No recibe plaza**: el precio
regular es el mismo en toda la cadena (5.6.2), así que no depende de la zona.

- **Regular:** `precio_regular` del **corte más reciente con `fecha_corte ≤ fecha`**. Si la
  foto es anterior al primer corte, el del corte más cercano, marcado `corte_posterior`.
- El mayoreo **no** cuenta.
- **Promociones propias: segunda iteración.** Se cargan y guardan desde ahora
  (`promociones_propias`), pero **no** entran a la comparación de esta versión, porque
  algunas son regionales y aún no se sabe en qué plaza cae cada visita (5.8). Cuando se
  agreguen: el `precio_promo_pieza` más bajo vigente en la fecha, `activa`, no combo, de
  toda la cadena o de la plaza de la visita, del corte más reciente.

#### 5.6.5 Script `npm run catalogo:importar -- datos-privados/<carpeta_del_paquete>`

Corre en tu computadora con la secret key (como los lotes, sección 8). **No escribe nada
hasta que confirmas.**

1. **Revisa el archivo:** UTF-8 (quita el BOM inicial), separador coma, saltos de línea
   CRLF, lector que **respeta comillas**; encabezados **exactos y en el mismo orden** que
   `diccionario.csv` (si cambian, se detiene: significa que el SCA cambió el formato).
2. **Valida cada fila** en dos niveles:
   - **Errores de formato (detienen la importación):** tipos (fechas `aaaa-mm-dd`, punto
     decimal, 0/1), llaves únicas, columnas obligatorias vacías.
   - **Problemas de calidad (no detienen y NO se corrigen en silencio):** se importan
     **tal como vienen** y se registran en el **reporte de calidad** (abajo). Como mínimo:
     mayoreo ≥ precio regular, descuento negativo, precio regular en 0 (o ≤ 0) en
     artículos que no son servicio, descripciones repetidas con claves distintas,
     `sin_impuestos` que no cuadra con las tasas, `promo_grupo ≠ piezas × pieza`,
     `fecha_inicio > fecha_fin`, promo por pieza ≥ regular sin ser combo, claves de
     promoción sin artículo.

   **Reporte de calidad:** `datos-privados/reporte_calidad_<fecha_corte>.csv` (**nunca**
   en `docs/` ni en git). Trae una fila por problema encontrado (tipo de problema, archivo,
   renglón y la llave de la fila, para poder revisarla) y al final el conteo por tipo. En
   **pantalla**, en `docs/`, en `PROGRESO.md` y en los commits se reportan **solo conteos
   por tipo de problema**, sin claves, descripciones ni precios. Las reglas de la base
   (vistas) ya excluyen lo que no debe compararse (precio 0 = no activo, mayoreo no se usa);
   el reporte sirve para que una persona decida si se corrige en el SCA.
3. **Contenido:** copia `contenido_pieza` / `unidad_contenido` a `cantidad` / `unidad` con
   `contenido_origen = archivo`. Si viene vacío: `sin_dato`, y el script lista esos
   artículos en `datos-privados/revision_contenido_<fecha>.csv` (nunca en `docs/`), con una
   pista de por qué (la descripción dice "N PZ", parece paquete, o no trae medida). Una
   persona puede corregirlos en Supabase (`contenido_origen = manual`) y el script **ya no
   los toca**.
4. **Resumen y confirmación:** artículos nuevos, con precio cambiado, sin cambio,
   promociones nuevas, filas con error, artículos sin contenido y **conteo por tipo de
   problema de calidad**. Solo **conteos** en pantalla (sin nombres, claves ni precios), y
   el detalle en los CSV dentro de `datos-privados/`. Pregunta `¿Importar? s/n`.
5. **Escribe todo o nada:** manda las filas a una función de Postgres `importar_corte(...)`
   (solo `service_role`) que en **una sola transacción** hace *upsert* en
   `catalogo_propio`, inserta el corte en `catalogo_propio_cortes` y `promociones_propias`.
   Si algo falla, no queda nada a medias. **Importar el mismo corte dos veces no duplica**
   (las llaves de 5.6.2 y 5.6.3 lo impiden y el corte se reemplaza completo).
6. **Comprueba:** los conteos guardados en la base coinciden con los del archivo, y el
   regular de `precio_propio_vigente` en la fecha de corte es el del archivo; si no cuadra,
   lo avisa (solo conteos).

**Este script no llama a la API de Anthropic** (es una fase 🧱 base).

**`lev_tiendas` y `lev_precios` no se importan** (vienen vacías; ver 5.10.3).

### 5.7 Tabla `equivalencias` (solo estructura, fase 🧱 E2-4)

Relaciona **un artículo de la competencia** con **uno nuestro**. **Actualizado el
2026-11-20:** el **método** para decidir cuándo un artículo de la competencia equivale a uno
nuestro **no está definido todavía**; se decide en la fase de agentes (E2-7). En la base
solo se crea la tabla, **sin ninguna lógica de cómo se llena** (ni scripts, ni funciones,
ni reglas automáticas). Mientras tanto, solo una persona puede escribir en ella desde el
SQL Editor, si quisiera probar la vista.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` identity, PK | |
| `articulo_competencia_id` | `bigint` no nulo, FK → `articulos_competencia.id` | |
| `clave_propia` | `text`, FK → `catalogo_propio.clave` | **Nulo solo** si `tipo = 'sin_equivalente'` (`check`) |
| `tipo` | `text` no nulo, `check` | `mismo_articulo` (el mismo artículo), `otra_presentacion` (mismo producto, otro contenido), `sin_equivalente` (no tenemos uno equivalente) |
| `estado` | `text` no nulo, default `'propuesta'`, `check` | `propuesta`, `aprobada`, `rechazada` |
| `created_at` | `timestamptz` | |
| `actualizado_at` | `timestamptz` | |

- Máximo **una equivalencia `aprobada`** por artículo de la competencia (índice único
  parcial `where estado = 'aprobada'`). Es una regla de integridad, no de método.
- Cerrada a `anon` como todo lo de la Etapa 2 (5.0).
- **Lo que se decide en la fase de agentes (E2-7), no antes:** cómo se proponen (por
  persona, por agente o combinación), qué datos se usan para decidir, si hacen falta más
  tipos, y las columnas de quién/cómo la propuso (ej. motivo, confianza, modelo, quién la
  aprobó). Esas columnas se agregan con un archivo SQL **nuevo**. Las reglas de match de la
  consultora (`LEEME.md` del paquete) son **un insumo** para esa decisión, **no** están
  adoptadas.

### 5.8 Zonas: **no** se crean en esta versión

**Decisión del 2026-11-20:** **no** se crea la tabla `zonas`.

- La comparación usa el **precio regular**, que es el mismo en toda la cadena (5.6.2), así
  que **no depende de la zona**.
- Las **promociones regionales** (`promociones_propias.regiones`) se cargan, pero su uso en
  la comparación queda para una **segunda iteración**.
- El análisis de esta versión es **por competidor y fecha** (y por ubicación cruda:
  `latitud` / `longitud` de la visita están en la vista).

❓ **Pregunta abierta (para la segunda iteración):** las visitas guardan **latitud y
longitud, no plaza**. Hay que definir **cómo se traduce una ubicación a una plaza** (por
ejemplo: lista de plazas con su área, la tienda más cercana nuestra, o que el personal elija
la plaza en la app). Sin esa respuesta no se pueden aplicar las promociones regionales.

### 5.9 Vistas

**`lecturas_analisis`** (E2-2): lectura + foto + visita + competidor. Excluye
`descartada`. Para revisar y para consultas rápidas.

**`comparacion_precios`** (🧱 E2-4; queda vacía hasta que haya lecturas y equivalencias
aprobadas), una fila por lectura con equivalencia aprobada:

| Grupo | Columnas |
|---|---|
| Cuándo | `fecha_observacion` = `capturada_at` de la foto, o `created_at` de la visita si no hay; `fecha_origen` |
| Dónde | `competidor`, `latitud`, `longitud`, `visita_id`, `foto_id`, `ruta` (**sin** zona ni plaza en esta versión, 5.8) |
| Competencia | `articulo`, `marca`, `ean`, `cantidad`, `unidad`, `piezas`, `precio_regular_comp`, `promo_tipo`, `texto_promocion`, `precio_promo_pieza_comp` (calculado, 5.5; informativo, no entra al índice), `estado_lectura` |
| Nuestro | `clave`, `descripcion`, cantidad / unidad, `precio_regular_propio` (de `precio_propio_vigente` en `fecha_observacion`), `fecha_corte_usada`, `venta_12m_sin_impuestos`, `nacs_categoria`, `activo` |
| Equivalencia | `tipo_equivalencia` |
| Calculado por SQL | `indice_vs_competencia_pct` (abajo), `en_linea`, `unidad_comparacion` ("100 g" / "100 ml" / "pieza") y precios regulares normalizados de los dos lados |

**Índice (signo de la consultora, decidido el 2026-11-20):**

```
indice_vs_competencia_pct = (precio_regular_propio ÷ precio_regular_comp − 1) × 100
```

- **Positivo = nosotros más caros.** Negativo = nosotros más baratos. Ej. inventado: nuestro
  $11, competencia $10 → **+10**.
- Entre −3 y +3 → `en_linea = true`.
- Se compara **solo precio regular contra precio regular**. El índice con promociones
  (`indice_minimo`) queda para la segunda iteración (5.6.4, 5.8).
- El signo se documenta **también dentro de la base**: `comment on view
  comparacion_precios` y `comment on column comparacion_precios.indice_vs_competencia_pct is
  'Porcentaje. Positivo = nosotros más caros que la competencia; negativo = más baratos.'`
- *(El borrador anterior tenía `diferencia_pct` con el signo contrario; ya no existe.)*

Reglas:
- Solo equivalencias `aprobada`. Entran a promedios **solo** `mismo_articulo`.
  `otra_presentacion` se compara **por 100 g / 100 ml** en columnas aparte y solo si
  nuestro `contenido_origen` no es `sin_dato`. `sin_equivalente` no aparece.
- Lecturas `propuesta`, `aprobada` y `corregida` (con `estado_lectura` para filtrar);
  **nunca** `por_revisar` ni `descartada`.
- **Fuera:** servicios, obsoletos, de baja, sin venta en el último corte, precio regular
  ≤ 0 en cualquiera de los dos lados.
- **Agregar** (en las consultas de E2-8, no en la vista): por artículo, promedio entre
  tiendas y luego entre competidores; por competidor o categoría NACS, **ponderado por
  `venta_12m_sin_impuestos`**. Un competidor con menos de **10 artículos** comparados se
  reporta pero no se saca conclusión.
- Pensada para que un tablero futuro haga `group by competidor, date_trunc('week',
  fecha_observacion)` sin más cálculos (por zona, en la segunda iteración).

**`exportar_lev_precios`** *(opcional, 🤖 E2-8)*: nuestras lecturas en el **formato de
`lev_precios`** de la consultora (5.10.3), para juntar los dos levantamientos. La
confianza en niveles se traduce a su `fidelidad` 0–100 (ej. `alta` → 95, `media` → 85,
`baja` → 60, y con `baja` el dato va vacío, como su regla).

### 5.10 Estructura del paquete de precios (sin datos reales)

**Dónde:** `datos-privados/x24_precios_<aaaammdd>/` (ignorada por git). Lo prepara la
consultora con datos de nuestro SCA. Trae un `LEEME.md` con reglas que **hay que leer antes
de tocar los datos**.

**Formato de todos los CSV:** UTF-8 **con BOM**, separador coma, saltos de línea CRLF,
punto decimal, fechas `aaaa-mm-dd`, `0`/`1` para sí/no, vacío = no se sabe. Algunos campos
de texto van entre comillas porque traen comas. Las listas de valores permitidos están en
`diccionario.csv`.

#### 5.10.1 Archivos y relaciones

| Archivo | Un renglón es | Llave | Trae datos |
|---|---|---|---|
| `x24_articulos.csv` (28 columnas) | un artículo nuestro con venta en los 12 meses previos al corte | `fecha_corte` + `clave` | Sí (miles de artículos) |
| `x24_promociones.csv` (24 columnas) | un artículo dentro de un grupo de una promoción | `fecha_corte` + `origen` + `id_promocion` + `id_grupo` + `clave` | Sí (del orden de mil renglones) |
| `lev_tiendas.csv` (6 columnas) | una tienda de la competencia | `tienda_id` | **No: solo encabezados** |
| `lev_precios.csv` (25 columnas) | una etiqueta o cartel leído en una foto | `lectura_id` | **No: solo encabezados** |
| `diccionario.csv` | una columna de cualquier tabla: tipo, llave y definición | `tabla` + `columna` | Definiciones |

```
x24_articulos.clave ◄──── x24_promociones.clave      (n promociones por artículo)
x24_articulos.clave ◄──── lev_precios.clave_x24       (match de una etiqueta con nuestro artículo)
lev_tiendas.tienda_id ◄── lev_precios.tienda_id       (n lecturas por tienda)
```

#### 5.10.2 Columnas de `x24_articulos` y `x24_promociones`

Están descritas una por una en 5.6.1, 5.6.2 y 5.6.3 (los nombres de columna del archivo
son los mismos). Ejemplo **inventado** de cómo viene la presentación:

| `descripcion` | `contenido_pieza` | `unidad_contenido` |
|---|---|---|
| `REFRESCO COLA 600 ML` | `600.0` | `ml` |
| `AGUA NATURAL 1.5 LT` | `1500.0` | `ml` |
| `CAFE SOLUBLE 16 OZ` | `473.0` | `ml` *(onzas ya convertidas)* |
| `CHICLE MENTA 10 PZ` | *(vacío)* | *(vacío)* |

#### 5.10.3 `lev_tiendas` y `lev_precios`: plantillas vacías

Son la **estructura** con la que la consultora captura un levantamiento (el suyo se hizo
con fotos de anaquel en tiendas de la competencia). Llegan **vacías**: no sirven como
muestra verificada. Sirven para:
- **Alinear nuestro diseño** con el suyo (ya se hizo en 5.5 y 5.7: promociones y tipos de
  match), para poder juntar los dos levantamientos.
- **Como formato de la respuesta correcta** en la evaluación (9.1).

Columnas de `lev_precios`: `lectura_id` (`<tienda_id>__<aaaammdd>__<nnnn>`), `tienda_id`,
`fecha_visita`, `archivo_foto`, `tipo_lectura` (`etiqueta`, `cartel`, `nota_campo`,
`sin_precio`), `ean`, `codigo_interno`, `descripcion_etiqueta`, `marca`, `contenido` (de
**una** pieza, en g o ml), `unidad` (`g`, `ml`, `pz`), `piezas_paquete`, `precio_regular`,
`promo_tipo`, `promo_piezas`, `promo_precio_total`, `precio_promo_pieza`,
`promo_condicion`, `vigencia_fin`, `fidelidad` (0–100; < 80 → el dato va vacío),
`verificacion` (`confirmado`, `corregido`, `no_confiable`), `motivo_no_confiable`,
`clave_x24`, `tipo_match`, `match_dudoso`. Columnas de `lev_tiendas`: `tienda_id`,
`competidor`, `punto`, `municipio`, `lat`, `lon`.

⚠️ Diferencia a cuidar: en `lev_precios` el `contenido` es **de una pieza** (con
`piezas_paquete` aparte), igual que nuestro 5.1; en `x24_articulos` es **del paquete
completo**.

#### 5.10.4 Problemas de calidad encontrados (2026-11-20, solo tipos y magnitudes)

**Regla (2026-11-20):** ninguno de estos problemas se corrige en silencio. El script de
importación los cuenta y los escribe en el **reporte de calidad** dentro de
`datos-privados/` (5.6.5). Aquí y en cualquier documento del repositorio se describen
**solo con conteos o magnitudes**, nunca con claves, nombres ni precios.

| Problema | Magnitud | Qué hace el plan |
|---|---|---|
| Artículos **sin contenido** (`contenido_pieza` vacío) | ~1 de cada 4; la mayoría dice "N PZ" en la descripción, otros no traen medida | `contenido_origen = sin_dato`; reporte para corrección manual; no entran a la comparación por 100 g / 100 ml |
| **Paquetes** con contenido incompleto | La mayoría de los que parecen paquete no traen contenido | Mismo reporte; revisión manual |
| Claves **no EAN** | ~3 de cada 10 (internas o códigos sin dígito de control válido) | Sin efecto en la base: la clave se guarda tal cual. Se toma en cuenta al definir el método de equivalencias (E2-7) |
| **Descripción repetida** con claves distintas | Unos pocos casos, algunos con precio distinto | **Reporte de calidad**; cada clave sigue siendo un artículo |
| **Precio regular 0** | Un par de artículos, sin venta | **Reporte de calidad**; se importan tal cual; excluidos de la comparación (no activos) |
| **Mayoreo ≥ precio regular** | Algunas decenas | **Reporte de calidad**; se guarda tal cual; no se usa |
| Artículos **de baja** y **obsoletos** | ~1 de cada 4 de baja; cerca de 200 obsoletos (se traslapan) | Excluidos de promedios |
| Categoría **NACS vacía** | Casi todos son de baja | Sin efecto en lo activo |
| Promociones **combo** con precio por pieza **0** | Unos pocos renglones, todos combo | Los combos nunca se comparan |
| **Descuento negativo** (promo más cara que el normal registrado) | ~1 % de renglones | **Reporte de calidad**; se guarda tal cual |
| Promo por pieza ≥ regular al inicio (sin combo) | Más de una decena de renglones | **Reporte de calidad**; se guarda tal cual (las promociones no entran a la comparación de esta versión) |
| Regular al inicio ≠ normal registrado por la caja | ~1 de cada 10 renglones | Se usa el regular del corte (5.6.4) |
| Misma clave con **varias promociones a la vez** (fechas traslapadas) | Decenas de claves | Se guarda tal cual; se resuelve en la segunda iteración (promociones) |
| Claves de promoción **sin artículo** | Un par | **Reporte de calidad** (por eso no hay FK estricta) |
| Origen `catalogo` sin `id_promocion` ni descripción | Pocos renglones | Llave técnica `id` (5.6.3) |

**Sin problemas:** no hay llaves duplicadas, ni filas repetidas, ni espacios sobrantes,
ni precios con más de 2 decimales; `sin_impuestos` cuadra con las tasas, y los totales de
promoción cuadran con sus grupos.

### 5.11 Cuántas tablas hacen falta (resumen)

| # | Tabla | Archivo SQL | Fase |
|---|---|---|---|
| 1 | `lotes_proceso` | 004 | 🧱 E2-2 |
| 2 | `articulos_competencia` | 004 | 🧱 E2-2 |
| 3 | `lecturas_precio` | 004 | 🧱 E2-2 |
| 4 | `catalogo_propio` | 005 | 🧱 E2-3 |
| 5 | `catalogo_propio_cortes` | 005 | 🧱 E2-3 |
| 6 | `promociones_propias` | 005 | 🧱 E2-3 |
| 7 | `equivalencias` (solo estructura) | 006 | 🧱 E2-4 |

**Para nuestro catálogo: 3 tablas** (5.6). **En toda la Etapa 2: 7 tablas**, todas creadas
en fases 🧱 base, más las vistas `lecturas_analisis`, `precio_propio_vigente`,
`comparacion_precios` y `exportar_lev_precios` (opcional, 🤖), y las funciones
`guardar_lecturas` e `importar_corte`. **`zonas` no se crea en esta versión** (5.8). La
tabla `precios_propios_historial` del borrador **ya no hace falta**: los cortes la
reemplazan. Todas cerradas a `anon` (5.0).

---

## 6. La llamada a Claude (una por foto) — 🤖 solo en fases de agentes

> Nada de esta sección se implementa en las fases 🧱 base. **Nunca se envían precios
> propios a la API** (sección 2.1): a la lectura de fotos solo va la foto y las
> instrucciones.

### 6.1 Qué se manda
- **Instrucciones fijas** (system prompt) en español: listar **cada producto con precio
  visible**; **no adivinar** (si no se lee, decirlo y bajar la confianza); separar
  regular y promoción; cantidad y unidad por separado (convertir "1 lt" → `1`, `l`); no
  calcular precios de "2x$30" (solo copiar el texto y sus números: `promo_piezas 2`,
  `promo_precio_total 30`); con varios niveles, el de **menos piezas**; el precio regular
  **solo de la misma etiqueta**; **ignorar personas**; calificar la
  calidad de la foto y de cada etiqueta; cuándo usar `alta`/`media`/`baja`. Si se pide o
  no el código de barras, y cómo, se decide junto con el método de equivalencias (E2-7).
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
      "ean": "7500000000000",
      "codigo_interno": null,
      "precio": 18.5,
      "promo_tipo": "n_por_precio",
      "promo_piezas": 2,
      "promo_precio_total": 33,
      "promo_paga_piezas": null,
      "promo_descuento_pct": null,
      "promo_condicion": "ninguna",
      "vigencia_fin": null,
      "texto_promocion": "2 x $33",
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
- `model`: **provisional**, lo elige el usuario en E2-5 tras la prueba con pocas fotos
  (`claude-sonnet-5-5` o `claude-haiku-5-5`); la evaluación final (E2-9) lo confirma o lo
  cambia.
- `max_tokens`: 16 000 (se ajusta en E2-9).
- `output_config.effort`: provisional en E2-5; se decide en E2-9 (probar `low` y
  `medium`). Pensamiento adaptativo (encendido por defecto en ambos modelos).
- Sin `temperature` / `top_p` (estos modelos los rechazan).
- *Fallbacks* (reintentar con otro modelo si Claude se niega): **no existen en lotes**. Una
  negativa se trata como `error` y se reintenta. En los scripts sin lote (E2-5, E2-9) con
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

Si el método de equivalencias (E2-7) usa la API en lote, puede reusar este mismo flujo de dos pasos.

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

## 9. Evaluación (Fase E2-9, 🤖, la última)

**Decisión del 2026-11-20:** la evaluación queda **al final** de la Etapa 2. Hasta entonces,
modelo, effort y tamaño de foto son **provisionales** (6.3, 3.3).

### 9.1 Muestra
- **20 a 30 fotos reales tomadas con la app** (del bucket de Supabase), **verificadas a
  mano** por una persona del equipo. Que cubran, en lo posible: etiqueta simple, foto con
  muchos precios, regular + promoción, "2x$30", varios precios en una etiqueta (ej. pieza
  y caja), paquete ("6 × 355 ml"), presentación rara (ej. "1.5 l" escrito "1500ml"), foto
  borrosa, con reflejo, lejana y una foto **sin** precios.
- Si se quiere comparar tamaños de foto (9.2), algunas se guardan además en tamaño
  original en `datos-privados/fotos_prueba/`.
- La persona escribe **a mano** la respuesta correcta: por foto, la calidad y por cada
  producto artículo, marca, cantidad, unidad, piezas, precio, promoción. Se propone
  capturarla en el **formato de `lev_precios`** (5.10.3, con `verificacion = confirmado`)
  en `datos-privados/evaluacion/esperado.csv` (no en `docs/`).
- **Levantamiento de octubre de la consultora:** **aún no hay datos** (las plantillas
  `lev_precios` y `lev_tiendas` del paquete vienen vacías). Si llega, se agrega **después**
  como muestra adicional (en `datos-privados/`), sin bloquear esta fase.

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
- **Cómo se decide:** en E2-9 se mide cuántos errores con `alta` atraparía. **Si la
  confianza ya está bien calibrada, no se activa.** Si no, se activa (todas las fotos o
  solo las de artículos clave). Queda como interruptor en el código (`SEGUNDA_LECTURA`).

---

## 10. Riesgos

| Riesgo | Qué puede pasar | Cómo se mitiga |
|---|---|---|
| **Etiquetas ilegibles** (borrosas, reflejo, lejos, cortadas) | Precios **inventados** que parecen reales | "No adivines" en las instrucciones; `calidad` por foto y por etiqueta; confianza baja → `por_revisar`; sin precio → `descartada`; E2-9 mide inventados. Fotos de 2200 px sin tope de 1 MB (3.3) y guía de campo (3.4) |
| **Varios precios en una etiqueta** (pieza / caja, por kg / por pieza, precio socio) | Se guarda el que no es, o se mezclan | Instrucción: una lectura por precio de **producto y presentación**; si una etiqueta tiene dos presentaciones, dos lecturas (con `piezas`); si no es claro cuál es el precio de venta → `confianza_precio` media y `por_revisar` |
| **Regular y promoción juntos** | Se guarda la promoción como regular, o se calcula mal "2x$30" | Columnas separadas `precio`, `promo_tipo`, `promo_piezas`, `promo_precio_total`, `texto_promocion`; Claude solo copia números y SQL calcula el precio por pieza (5.5); promoción ≥ regular → `por_revisar`; promoción vencida o con condición (tarjeta, app) no se compara |
| **Promociones nuestras regionales o combo** | Comparar contra una promoción que no aplica en esa tienda, o contra un precio de combo repartido | En esta versión la comparación usa **solo precio regular** (no depende de la zona). Promociones: segunda iteración, cuando se defina cómo pasar de ubicación a plaza (5.6.4, 5.8) |
| **Presentaciones que cambian** (600 ml → 500 ml, "contenido especial") | Comparar artículos que ya no son iguales; perder la tendencia | La presentación es parte de la `clave_normalizada` del artículo de la competencia → una presentación nueva es un artículo nuevo con su propia equivalencia (`otra_presentacion`); la comparación es **por unidad** (100 ml), así que sigue siendo justa |
| **Personas en las fotos** | Privacidad; el bucket de fotos es **público** para leer (Etapa 1) | Guía: sin personas. Instrucción a Claude: ignorar personas y no describirlas (además Claude no identifica personas). Nunca se guardan descripciones de personas. **Pendiente para el usuario:** valorar más adelante hacer el bucket privado (cambia la app publicada; no es de esta etapa) |
| **Costo por lote** | Un lote grande, o fotos basura (la app es abierta, sin login) | Tope de fotos por lote, estimado y confirmación antes de crear, costo real en `lotes_proceso`, llave propia con **límite de gasto**, no se reprocesan fotos `procesada`, máximo 3 intentos |
| **Información comercial sensible del catálogo** | Que nuestros precios se filtren | `catalogo_propio`, cortes, promociones, equivalencias y las vistas cerradas a `anon`; los archivos originales en `datos-privados/` (ignorada por git, verificado con `git status` y `git check-ignore`); **nunca** se mandan nuestros precios ni ventas a la API (regla de la sección 2.1; solo descripciones de artículos y fotos de la competencia); el script imprime solo conteos; llaves solo en `.env.local`; opción A (sin URL pública). **Nunca** se copian datos reales (precios, artículos, códigos, tiendas, plazas) a `docs/`, comentarios ni commits: solo estructura con ejemplos inventados |
| **Acuerdo de confidencialidad del paquete** ✅ resuelto | El `LEEME.md` del paquete dice que las tablas de artículos y promociones **no se suben a servicios de terceros** | **Permiso del responsable de los datos (2026-11-20):** se permite (a) cargar catálogo y promociones en Supabase, (b) enviar a la API las descripciones de nuestros artículos **sin precios**, (c) enviar a la API las fotos de anaqueles de la competencia. Ya **no** bloquea E2-3. Cualquier uso fuera de esos tres (ej. mandar precios propios a la API) **no** está permitido |
| Negativa del modelo (`refusal`) | Una foto no se procesa | `error` y reintento; tras 3 intentos queda para revisión |
| Lote no recogido a tiempo | Resultados borrados a los 29 días | El paso 2 avisa de lotes `en_proceso` con más de 7 días |
| Hora de captura falsa o faltante | Fecha equivocada en tendencias | `capturada_origen`; la vista usa la hora de la visita si falta; se marca sospechosa si es posterior a la subida o > 7 días antes de la visita |
| Llave secreta filtrada | Acceso total a la base o gasto en Anthropic | Solo `.env.local`, nunca `NEXT_PUBLIC_`; `git status` antes de cada commit |

**Estimado de costo por foto con lotes** (50 % de descuento; foto de 2200 × 1650 ≈ 4 700
tokens + ~1 800 de instrucciones = ~6 500 de entrada, ~3 000 de salida con pensamiento).
**Se reemplaza con lo medido en E2-9:**

| Modelo | Normal (entrada / salida por millón) | Lote | ≈ por foto | ≈ 1 000 fotos |
|---|---|---|---|---|
| `claude-sonnet-5-5` | $2 / $10 | $1 / $5 | ~$0.022 | ~$22 USD |
| `claude-haiku-5-5` | $0.10 / $0.50 | $0.05 / $0.25 | ~$0.0011 | ~$1.10 USD |

La segunda lectura (9.4), si se activa, suma el costo del modelo que la haga.

---

## 11. Fases de la Etapa 2

Cada fase la hace **un agente distinto**, con las reglas de cierre de `PLAN.md` (build,
lint, `PROGRESO.md`, un commit, **sin push**, `git status` sin `.env.local` ni
`datos-privados/`). **Antes de ejecutar cualquier cosa en Supabase, el agente avisa y
explica.**

**Dos tipos de fase (2026-11-20):**

| Tipo | Fases | Qué incluye | ¿Llama a la API de Anthropic? |
|---|---|---|---|
| **🧱 Base** | E2-1, E2-2, E2-3, E2-4 | Ajustes de la Etapa 1, estructura de tablas, carga del catálogo, estructura de equivalencias y vista de comparación | **No.** Ni se instala el SDK ni se crea la llave |
| **🤖 Agentes** | E2-5, E2-6, E2-7, E2-8, E2-9 | Lectura de fotos, lotes, método de equivalencias, corrida completa y evaluación | Sí, desde E2-5 |

⛔ **Ninguna fase 🤖 empieza sin que el usuario lo pida de forma explícita**, aunque la base
esté terminada. Al terminar E2-4, el agente se detiene y reporta.

### Fase E2-0 — Plan ✅
Este archivo. Sin código.

### Fase E2-1 — 🧱 Ajuste de la Etapa 1: fechas y fotos

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

### Fase E2-2 — 🧱 Base de datos de lecturas (solo estructura)
- `supabase/004_etapa2_lecturas.sql`: columnas de estado y calidad en `fotos`,
  `lotes_proceso`, función de normalización (5.1), `articulos_competencia`,
  `lecturas_precio` (con las columnas de promoción de 5.5), `guardar_lecturas`, vista
  `lecturas_analisis`, permisos (5.0). Las tablas quedan **vacías**: las llenan las fases 🤖.
- Tipos de servidor en `src/lib/etapa2/tipos.ts`; solo las columnas nuevas de `fotos` en
  `src/lib/tipos.ts`.
- `.env.example` con los nombres de 4.1. Guiar al usuario para copiar la **secret key de
  Supabase** a `.env.local` (la necesita la importación del catálogo). La llave de
  Anthropic **no** se crea todavía (se hace en E2-5).
- **Sin** `@anthropic-ai/sdk` y **sin** llamadas a la API.

**Cómo comprobar:** la app publicada funciona igual; fotos viejas `pendiente`; con la llave
pública, `select` sobre `lecturas_precio`, `articulos_competencia`, `lotes_proceso` y
`lecturas_analisis` **falla**; probar en el SQL Editor que `contenido_base` de "6 × 355 ml"
da 2130.

### Fase E2-3 — 🧱 Catálogo propio (tablas y carga)
- ✅ **Permiso confirmado** (responsable de los datos, 2026-11-20; sección 2.1): se puede
  cargar catálogo y promociones en Supabase. Ya no hay bloqueo.
- Las columnas ya se conocen (5.10). Leer el `LEEME.md` del paquete completo.
- `supabase/005_catalogo_propio.sql`: `catalogo_propio`, `catalogo_propio_cortes`,
  `promociones_propias`, `importar_corte`, `precio_propio_vigente` (5.6; solo precio
  regular).
- `src/lib/etapa2/csv.ts` (lector que respeta comillas, sin librería) y
  `scripts/etapa2/importar-catalogo.ts` + `npm run catalogo:importar` (5.6.5), con el
  **reporte de calidad** en `datos-privados/` (sin corregir nada en silencio).
- **Sin** llamadas a la API de Anthropic.
- Verificar con `git status` y `git check-ignore` que nada de `datos-privados/` aparece.

**Cómo comprobar:** el resumen del script cuadra con los conteos del archivo; con la llave
pública, `select` sobre las 3 tablas y la vista **falla**; correr la importación dos veces
no duplica; `precio_propio_vigente` en la fecha de corte da el regular del archivo; el
reporte de calidad y el de artículos sin contenido se generan dentro de `datos-privados/`
y sus conteos por tipo coinciden con 5.10.4; `PROGRESO.md` solo lleva conteos.

### Fase E2-4 — 🧱 Equivalencias (estructura) y vista de comparación
- `supabase/006_equivalencias_comparacion.sql`: tabla `equivalencias` **solo estructura**
  (5.7: `tipo` y `estado` con `check`, índice único parcial de `aprobada`, sin lógica de
  llenado) y vista `comparacion_precios` (5.9) con `indice_vs_competencia_pct` y su
  `comment on column` explicando el signo. **Sin** `zonas`.
- **Sin** scripts que propongan equivalencias y **sin** llamadas a la API.

**Cómo comprobar:** con la llave pública, `select` sobre `equivalencias` y
`comparacion_precios` **falla**; los `check` rechazan un `tipo` o `estado` inventado y una
equivalencia sin `clave_propia` que no sea `sin_equivalente`; no se pueden aprobar dos
equivalencias del mismo artículo; con **datos de prueba inventados** (insertados en el SQL
Editor dentro de una transacción que se deshace con `rollback`), un caso nuestro $11 vs
competencia $10 da `indice_vs_competencia_pct = +10`; `col_description(...)` sobre la
columna devuelve el comentario del signo.

**Con E2-4 termina la base.** Las fases siguientes son 🤖 y **no empiezan sin que el
usuario lo pida**.

### Fase E2-5 — 🤖 Leer una foto *(no empezar sin que el usuario lo pida)*
- Guiar al usuario para crear la llave de Anthropic (con límite de gasto) en `.env.local`.
- Pedir permiso para `@anthropic-ai/sdk` (4.3).
- `src/lib/etapa2/`: instrucciones, esquema JSON, validación y cálculo de estado.
- `scripts/etapa2/leer-una-foto.ts <foto_id>`: llama a la API (sin lote), valida e
  **imprime**. No guarda nada. A la API solo va la foto y las instrucciones.
- El usuario elige un modelo y effort **provisionales** (6.3).

**Cómo comprobar:** con 3 fotos reales, lo impreso coincide con lo que se ve.

### Fase E2-6 — 🤖 Lotes y guardado *(no empezar sin que el usuario lo pida)*
- `crear-lote.ts` y `recoger-lote.ts` (sección 7) con el modelo provisional. Primera
  corrida real con **20 fotos**.

**Cómo comprobar:** las 20 fotos pasan a `procesada` (o `error` con motivo) con su calidad;
hay lecturas y artículos de la competencia; el costo queda en `lotes_proceso`; correr
`lote:recoger` otra vez **no duplica**; una foto `procesada` **no** entra a un lote nuevo;
una en `error` sí.

### Fase E2-7 — 🤖 Método de equivalencias *(no empezar sin que el usuario lo pida)*
- **Primero se define con el usuario el método** para decidir cuándo un artículo de la
  competencia equivale a uno nuestro (5.7). Nada de esto está decidido hoy.
- Según el método: columnas nuevas en `equivalencias` (archivo SQL nuevo), script para
  proponerlas y librerías o extensiones que hagan falta (con permiso).
- Si el método manda algo a la API: **solo descripciones** de nuestros artículos, **nunca
  precios propios** ni ventas (sección 2.1).
- El usuario aprueba una muestra de equivalencias en Supabase.

**Cómo comprobar:** se define al elegir el método. Siempre: `comparacion_precios` muestra
filas con precio por 100 g / 100 ml / pieza de los dos lados, competidor y fecha; nuestro
precio usado es el regular del corte vigente en la fecha de la foto; **ningún precio
nuestro aparece en las peticiones a la API** (se revisa el texto que se manda).

### Fase E2-8 — 🤖 Corrida completa y consultas de ejemplo *(no empezar sin que el usuario lo pida)*
- Procesar todas las fotos pendientes (en lotes con tope) y relacionarlas con nuestro
  catálogo según el método de E2-7.
- `supabase/consultas_etapa2.sql`: índice promedio por competidor, artículos donde la
  competencia está más barata, evolución semanal de un artículo, lecturas `por_revisar`,
  fotos con `error` y fotos por calidad (para retroalimentar al equipo).
- Revisar con el usuario una muestra de `por_revisar` para ajustar las instrucciones.

### Fase E2-9 — 🤖 Evaluación (al final) *(no empezar sin que el usuario lo pida)*
- Sección 9 completa, con **20–30 fotos reales de la app verificadas a mano**. **El
  usuario elige** modelo, effort, tamaño de foto y si se activa la segunda lectura
  (confirma o cambia lo provisional). Actualizar el estimado de costo de la sección 10.
- Si para entonces llegó el levantamiento de octubre de la consultora, se agrega como
  muestra adicional.

---

## 12. Fuente y supuestos

| Decisión / supuesto | Origen |
|---|---|
| Objetivo final y las 9 decisiones de la sección 2 | Usuario, 2026-11-19 |
| Opción A (script local) para disparar el proceso | Recomendación del agente, **pendiente de confirmar** |
| Confianza en 3 niveles; estado calculado por nuestro código; `valores_agente` inmutable | Propuesta del agente (5.5) |
| Tabla `articulos_competencia` (equivalencia una vez por artículo, no por lectura) | Propuesta del agente, **pendiente de confirmar** (5.4) |
| Columna `piezas` para paquetes | Propuesta del agente, **pendiente de confirmar** (5.1) |
| ~~Historial de precios propios~~ → reemplazado por los **cortes** del paquete (`catalogo_propio_cortes`) | Agente, 2026-11-20, al conocer el paquete (5.6) |
| ~~Tabla `zonas`~~ → **no se crea en esta versión**; comparación con precio regular; promociones regionales en segunda iteración; pregunta abierta: ubicación → plaza | Usuario, 2026-11-20 (5.8) |
| Alcance: solo fases 🧱 base; ninguna fase 🤖 sin pedido explícito | Usuario, 2026-11-20 (sección 11) |
| Evaluación al final con 20–30 fotos reales de la app verificadas a mano; levantamiento de octubre si llega | Usuario, 2026-11-20 (9.1) |
| Problemas de calidad del catálogo → reporte en `datos-privados/`, sin corregir en silencio; en docs solo conteos | Usuario, 2026-11-20 (5.6.5, 5.10.4) |
| Columnas de `catalogo_propio` y promociones | **Conocidas el 2026-11-20** por el paquete de la consultora; diseño en 5.6, estructura en 5.10 |
| Formato y reglas de la consultora (promoción por pieza, índice, ±3 %, ponderar por venta, mínimo 10 artículos) | `LEEME.md` y `diccionario.csv` del paquete (no se suben); adoptados para poder juntar levantamientos. **Sus reglas de match no están adoptadas** (5.7) |
| Signo del índice (positivo = nosotros más caros), columna `indice_vs_competencia_pct` | **Usuario, 2026-11-20** (5.9) |
| `clave` como llave de `catalogo_propio` (en vez de `id` + `codigo`) | Propuesta del agente, **pendiente de confirmar** (5.6.1) |
| ~~Equivalencias por código aprobadas solas~~ → **quitado**; el método de equivalencias se define en la fase de agentes; en la base solo estructura (`tipo`, `estado`) | Usuario, 2026-11-20 (5.7) |
| Permiso del responsable de los datos: catálogo y promociones en Supabase; descripciones sin precios y fotos de la competencia a la API. **Nunca precios propios a la API** | ✅ **Usuario, 2026-11-20** (secciones 2.1 y 10) |
| Tamaño 2200 px / JPEG 0.85 / sin tope de 1 MB | Propuesta del agente con la documentación de visión (3.3); se confirma en E2-9 |
| Límites de visión (2576 px, 4 784 tokens, 10 MB, 28 × 28 px por token) | Documentación de Anthropic consultada el 2026-11-19 |
| Precios de los modelos y lotes (50 %, 24 h, 29 días) | Documentación de Anthropic al 2026-11; revisar antes de E2-5 (primera fase 🤖) |
| Comportamiento de EXIF en iPhone y Android | Comportamiento conocido; **se comprueba con celulares reales en E2-1** |
| `@anthropic-ai/sdk` (🤖), `exifr` (🧱 E2-1), otras según el método de equivalencias (el lector de Excel ya no hace falta) | **Pendientes de permiso** en su fase |
