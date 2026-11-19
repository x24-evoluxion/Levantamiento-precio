# PLAN — Etapa 2: leer precios de las fotos con Claude

> **Para cualquier agente que lea esto:** lee primero `docs/PLAN.md` (Etapa 1: reglas,
> stack y diseño de datos), después **todo** este archivo y al final `docs/PROGRESO.md`.
> Trabaja **solo en la fase que te toca** (la primera de la Etapa 2 sin ✅ en `PROGRESO.md`).
> Las reglas de la sección 3 de `PLAN.md` siguen valiendo, salvo lo que este archivo cambie
> de forma explícita (ver sección 2).

---

## 1. Qué estamos construyendo

Hoy la app guarda visitas y fotos de anaqueles. La Etapa 2 **convierte cada foto en filas
de una tabla**: producto, presentación, precio regular, precio de promoción, etc. Así se
pueden analizar los precios de la competencia sin teclearlos a mano.

Flujo (todo del lado del servidor; el personal de tienda **no ve ningún cambio** en la app):

1. El personal sube fotos como siempre. Cada foto nueva queda con estado **`pendiente`**.
2. Alguien del equipo corre el proceso (ver sección 8). El proceso junta las fotos
   pendientes y le manda **un lote** a Claude (Message Batches API).
3. Claude lee **cada foto por separado** y responde con un JSON de precios.
4. El proceso valida el JSON e **inserta todas las lecturas** en la tabla
   `lecturas_precios`, cada una con su **estado, confianza y motivo de duda**.
5. El análisis se hace sobre la vista `lecturas_analisis` (lectura + foto + visita +
   competidor + ubicación), que por defecto **no** muestra lo descartado.

### Fuera de alcance de la Etapa 2 (no lo hagas)
- Una pantalla en la app para revisar o corregir lecturas. Por ahora la revisión se hace
  en Supabase (Table Editor / SQL Editor). Las tablas permiten agregarla después.
- Un agente autónomo con herramientas. Es **una llamada por foto** (sección 7).
- Cambiar el flujo de la app publicada (crear visita, ubicación, subir y ver fotos).
- Login de usuarios.

---

## 2. Decisiones de la Etapa 2 (confirmadas por el usuario el 2026-11-19, NO cambiar)

| # | Decisión | Detalle en |
|---|---|---|
| 1 | La llamada a Claude vive **dentro de este proyecto, en código de servidor**. La llave de Anthropic y la `SUPABASE_SECRET_KEY` se usan **solo en servidor**, **nunca** con prefijo `NEXT_PUBLIC_`. | Sección 4 |
| 2 | El proceso inserta **directamente** en `lecturas_precios` usando la secret key. La tabla queda **cerrada al usuario anónimo** (ni lectura ni escritura). | Sección 5.3 |
| 3 | **Se inserta todo.** Cada fila lleva `estado`, `confianza` y `motivo_duda`. Hay una **vista** para análisis que une lectura + foto + visita + competidor + ubicación y que por defecto **excluye lo descartado**. | Secciones 5.2 y 5.4 |
| 4 | **Cada foto tiene su propio estado de procesamiento**: `pendiente`, `en_lote`, `procesada`, `error`. Así no se reprocesan fotos y se pueden reintentar las que fallaron. | Sección 5.1 |
| 5 | **Una llamada a la API por foto**, con respuesta **JSON validada**. No es un agente autónomo. Para muchas fotos se usa la **Message Batches API** (50 % de descuento). | Secciones 6 y 7 |
| 6 | El disparador del proceso **no es público**: es un script local o una ruta protegida con clave secreta. | Sección 8 |
| 7 | Hay una **fase de evaluación**: Sonnet 5.5 vs Haiku 5.5 contra 20–30 fotos verificadas a mano, y revisión de si el tamaño de las fotos de la Fase 5 alcanza para leer las etiquetas. | Sección 9 |
| 8 | Se documentan los riesgos: muchos precios por foto, etiquetas ilegibles, precio regular y de promoción juntos, y costo por lote. | Sección 10 |

**Cambio respecto a la Etapa 1:** `PLAN.md` sección 6 decía "nunca se usa la llave
`service_role` / `secret`". Eso **sigue valiendo para la app** (el navegador). La única
excepción es el proceso de la Etapa 2, que corre en servidor (sección 4).

**Librerías:** siguen las reglas de `PLAN.md`. Nada se instala sin permiso. Ver sección 4.3
sobre el SDK de Anthropic.

---

## 3. Glosario rápido

- **API de Claude (Messages API):** dirección de internet a la que se le manda la foto y
  unas instrucciones, y responde con texto (aquí, JSON).
- **Message Batches API ("lote"):** la misma API, pero se mandan muchas peticiones juntas.
  Se procesan en segundo plano (casi siempre en menos de 1 hora, máximo 24 h) y cuestan
  **la mitad**.
- **Secret key de Supabase:** llave que **se salta las reglas RLS**. Puede leer y escribir
  todo. Por eso nunca debe llegar al navegador.
- **Código de servidor:** código que corre en tu computadora o en Vercel, nunca en el
  celular del usuario. Lo que lleva `NEXT_PUBLIC_` sí llega al navegador, así que **las
  llaves secretas jamás llevan ese prefijo**.
- **Salidas estructuradas (`output_config.format`):** opción de la API que obliga a Claude a
  responder con un JSON que sigue un esquema que nosotros definimos.

---

## 4. Variables de entorno y librerías

### 4.1 Variables nuevas (solo servidor)

**No leas el valor de ninguna.** Solo se nombran.

| Variable | Qué es | `.env.local` | Vercel |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Llave de la API de Claude. Créala en la consola de Anthropic **solo para este proyecto** y ponle un **límite de gasto mensual** | ✅ | Solo con la opción B (sección 8) |
| `SUPABASE_SECRET_KEY` | Llave secreta de Supabase (Project Settings → API Keys → *Secret keys*, la que empieza con `sb_secret_`) | ✅ | Solo con la opción B |
| `PROCESO_SECRET` | Clave larga al azar que protege la ruta del proceso | ❌ | Solo con la opción B |

- Se sigue usando `NEXT_PUBLIC_SUPABASE_URL` (ya existe) para saber a qué proyecto conectarse.
- **Con la opción recomendada (A, script local), no se agrega nada en Vercel.** Las llaves
  se quedan solo en tu computadora y la app publicada no cambia.
- Si algún día se usa la opción B: en Vercel → Settings → Environment Variables, se agregan
  **sin** `NEXT_PUBLIC_`, y solo para el entorno *Production* (o el que se use).
- `.env.example` se actualiza con **solo los nombres** (valores vacíos) y un comentario que
  diga "solo servidor, nunca NEXT_PUBLIC_".
- ⚠️ El agente de la Fase 1 le pregunta al usuario si sus variables se llaman exactamente
  así, igual que en la Etapa 1.

### 4.2 Dónde vive el código

```
scripts/etapa2/          ← código que corre SOLO en servidor (tu computadora)
├── crear-lote.ts        ← paso 1 del lote
├── recoger-lote.ts      ← paso 2 del lote
├── leer-una-foto.ts     ← prueba con una sola foto (Fases 2 y 3)
└── evaluar.ts           ← compara modelos contra las fotos verificadas (Fase 3)
src/lib/etapa2/          ← piezas compartidas: instrucciones (prompt), esquema JSON,
                           validación y cálculo del estado
```

- Nada de `scripts/` ni `src/lib/etapa2/` se importa desde componentes de la app
  (`"use client"` ni páginas). Así nunca termina en el navegador.
- Los scripts se corren con Node, que ya entiende TypeScript (la versión del proyecto es
  la 26) y carga las variables con `node --env-file=.env.local scripts/etapa2/....ts`.
  No hace falta instalar `tsx` ni `dotenv`. Se agregan como comandos en `package.json`
  (ej. `npm run lote:crear`, `npm run lote:recoger`).

### 4.3 SDK de Anthropic (`@anthropic-ai/sdk`): se propone, falta el permiso

**Qué es:** la librería oficial de Anthropic para llamar a la API desde TypeScript.

**Por qué se propone en lugar de usar `fetch` a mano:**
- Ya trae los **lotes**: crear, consultar el estado y leer los resultados. Los resultados
  llegan en un archivo de muchas líneas (JSONL) y el SDK lo lee línea por línea.
- **Reintenta solo** cuando la API está saturada (errores 429 y 5xx).
- Trae los **tipos de TypeScript** de peticiones y respuestas, así que los errores de
  nombre se ven al compilar y no en producción.
- Tiene clases de error por tipo (límite de uso, petición inválida, etc.).
- Con `fetch` habría que escribir y mantener todo eso a mano.

**Solo se usa en servidor** (scripts). No aumenta lo que descarga el celular.
➡️ El agente de la Fase 2 debe pedirle permiso al usuario antes de instalarla.

**Validación del JSON:** se propone **sin** librería nueva (sin `zod`). Las salidas
estructuradas ya garantizan la forma del JSON. Las reglas de negocio (precio > 0, la
promoción menor que el regular, etc.) se revisan con funciones propias en
`src/lib/etapa2/validar.ts`.

---

## 5. Diseño de datos

Todo va en un archivo nuevo `supabase/002_etapa2.sql`. Se ejecuta a mano en el SQL Editor,
se puede ejecutar varias veces y **no cambia ni borra nada de la Etapa 1**.

### 5.1 Columnas nuevas en `fotos` (estado de procesamiento)

| Columna | Tipo | Notas |
|---|---|---|
| `estado_proceso` | `text` no nulo, default `'pendiente'` | `check` en `pendiente`, `en_lote`, `procesada`, `error` |
| `lote_id` | `text`, FK → `lotes_proceso.id` | Último lote en el que se mandó |
| `intentos` | `int` no nulo, default `0` | Cuántas veces se ha mandado |
| `error_proceso` | `text` | Último error, en palabras simples |
| `procesada_at` | `timestamptz` | Cuándo se guardaron sus lecturas |

- Las fotos que ya existen quedan en `pendiente` por el `default`, y las nuevas también.
- **No rompe la app:** `anon` solo puede llenar 4 columnas al crear una foto (permiso por
  columna de la Etapa 1) y no tiene permiso de `update`. Por eso no puede tocar el estado.
  La app hace `select("*")` en `fotos`: solo recibirá columnas de más, que ignora.
- Índice en `estado_proceso` para encontrar rápido las pendientes.

**Ciclo de vida de una foto:**

```
pendiente ──crear lote──▶ en_lote ──recoger, OK──▶ procesada
    ▲                        │
    │                        └──recoger, falló──▶ error
    └───── siguiente "crear lote" la vuelve a tomar si intentos < 3 ─────┘
```

Si una foto llega a 3 intentos con error, se queda en `error` y sale en el reporte para
revisarla a mano.

### 5.2 Tabla `lotes_proceso` (aquí se guarda el identificador del lote)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `text`, PK | El id que devuelve Anthropic (`msgbatch_...`) |
| `modelo` | `text` no nulo | Ej. `claude-haiku-5-5` |
| `estado` | `text` no nulo | `en_proceso`, `recogido`, `cancelado` |
| `total_fotos` | `int` | |
| `fotos_ok` / `fotos_error` | `int` | Se llenan al recoger |
| `tokens_entrada` / `tokens_salida` | `bigint` | Suma real de `usage`, para conocer el costo |
| `costo_estimado_usd` | `numeric(10,4)` | Calculado con los precios de lote |
| `created_at` | `timestamptz`, default `now()` | |
| `recogido_at` | `timestamptz` | |

### 5.3 Tabla `lecturas_precios`

Una fila por **cada precio** leído en una foto (una foto puede tener 0, 1 o muchas filas).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid`, PK, default `gen_random_uuid()` | |
| `foto_id` | `uuid` no nulo, FK → `fotos.id` | La visita y el competidor salen de la foto |
| `orden_en_foto` | `int` no nulo | 1, 2, 3… en el orden en que Claude los listó. `unique (foto_id, orden_en_foto)` |
| `producto` | `text` | Ej. "Coca-Cola" |
| `marca` | `text` | |
| `presentacion` | `text` | Ej. "600 ml", "1 kg" |
| `precio_regular` | `numeric(10,2)` | En pesos |
| `precio_promocion` | `numeric(10,2)` | Precio unitario de promoción, si es claro |
| `texto_promocion` | `text` | Tal cual: "2x$30", "Lleva 3 paga 2", "-20 %" |
| `texto_leido` | `text` | Lo que dice la etiqueta, para revisar |
| `estado` | `text` no nulo | `aceptada`, `dudosa`, `descartada` (ver abajo) |
| `confianza` | `text` no nulo | `alta`, `media`, `baja` |
| `motivo_duda` | `text` | Por qué no es `alta` o por qué se descartó |
| `modelo` | `text` no nulo | Qué modelo la leyó |
| `lote_id` | `text`, FK → `lotes_proceso.id` | Nulo si vino de una prueba sin lote |
| `created_at` | `timestamptz`, default `now()` | |

**Confianza como texto (`alta`/`media`/`baja`) y no como número 0–1:** los números que da un
modelo de lenguaje no están calibrados (un "0.87" no significa 87 %). Tres niveles con
reglas claras son más fáciles de usar y de revisar.

**El `estado` lo calcula nuestro código, no Claude** (`src/lib/etapa2/validar.ts`):

| Situación | `estado` |
|---|---|
| Confianza `alta` y pasa todas las validaciones | `aceptada` |
| Confianza `media` o `baja`, o falla una validación "suave" (ej. promoción ≥ regular) | `dudosa` (con `motivo_duda`) |
| Sin ningún precio legible, precio fuera de rango (≤ 0 o absurdo) o la lectura no es un precio | `descartada` (con `motivo_duda`) |

**Permisos:** RLS activado **sin ninguna política**, y
`revoke all on lecturas_precios, lotes_proceso from anon, authenticated`. Solo la secret key
(rol `service_role`, que se salta RLS) y tú desde el SQL Editor pueden leer y escribir.

### 5.4 Vista `lecturas_analisis`

Une `lecturas_precios` → `fotos` → `visitas` → `competidores`, con estas columnas:

- De la lectura: todas las de la sección 5.3.
- De la foto: `foto_id`, `ruta` (para abrir la foto, que está en el bucket público).
- De la visita: `visita_id`, `visita_created_at` (fecha confiable), `latitud`, `longitud`,
  `precision_metros`.
- Del competidor: `competidor` (nombre).

Reglas:
- `where estado <> 'descartada'` → **por defecto no se ve lo descartado.** Para verlo, se
  consulta la tabla directamente (`select * from lecturas_precios where estado = 'descartada'`).
- `with (security_invoker = true)` y `revoke all ... from anon, authenticated`: Supabase
  publica las vistas en su API, así que sin esto `anon` podría leerla.

### 5.5 Guardar las lecturas de una foto de forma segura: función `guardar_lecturas`

Supabase desde JavaScript no tiene "transacciones" (hacer varias cosas como una sola). Para
no dejar una foto a medias, se crea una función de Postgres que, **todo o nada**:
1. Revisa que la foto no esté ya `procesada` (si lo está, no hace nada → no hay duplicados).
2. Borra lecturas viejas de esa foto (si hubo un intento a medias).
3. Inserta las lecturas nuevas.
4. Pone la foto en `procesada`, con `procesada_at`.

Solo la puede ejecutar `service_role` (`revoke execute ... from public, anon, authenticated`).

---

## 6. La llamada a Claude (una por foto)

### 6.1 Qué se manda
- **Instrucciones fijas** (system prompt) en español: qué es una etiqueta de precio, que
  liste **todos** los precios visibles, que **no adivine** (si no se lee, que lo diga), cómo
  separar precio regular y promoción, y qué poner en `confianza` y `motivo_duda`.
- **La foto**, por su URL pública de Supabase (el bucket ya es público para lectura). Así no
  hay que descargarla ni convertirla. Si en la evaluación la URL diera problemas, se manda en
  base64.
- **`output_config.format`** con el esquema JSON (6.2).
- Sin herramientas, sin conversación: **una pregunta, una respuesta**.
- Las instrucciones son iguales para todas las fotos y se marcan para *prompt caching*, para
  pagar menos por ellas cuando se repiten.

### 6.2 Forma del JSON que responde Claude

```json
{
  "precios_visibles_aprox": 12,
  "lecturas": [
    {
      "producto": "Coca-Cola",
      "marca": "Coca-Cola",
      "presentacion": "600 ml",
      "precio_regular": 18.5,
      "precio_promocion": null,
      "texto_promocion": null,
      "texto_leido": "COCA COLA 600ML $18.50",
      "confianza": "alta",
      "motivo_duda": null
    }
  ],
  "notas_foto": "Foto un poco borrosa a la derecha"
}
```

- `precios_visibles_aprox` sirve para detectar si Claude **se saltó** precios: si cuenta 30
  y solo lista 12, la foto se marca para revisar.
- Nuestro código revisa también que `stop_reason` sea `end_turn`. Si es `max_tokens` (la
  respuesta se cortó) o `refusal` (Claude se negó), la foto pasa a `error`.

### 6.3 Parámetros
- `model`: el que gane en la Fase 3 (`claude-sonnet-5-5` o `claude-haiku-5-5`).
- `max_tokens`: 16 000 (alcanza para fotos con muchos precios; se ajusta en la Fase 3).
- `output_config.effort`: se decide en la Fase 3 (probar `low` y `medium`). Pensamiento
  adaptativo, que viene encendido por defecto en ambos modelos.
- No se usan `temperature` / `top_p` (estos modelos los rechazan).
- *Fallbacks* (reintentar con otro modelo si Claude se niega): **no existen en lotes**. Una
  negativa (`refusal`) se trata como `error` y se reintenta en el siguiente lote.

---

## 7. Lotes: flujo de dos pasos

**Por qué dos pasos:** un lote no responde al momento. Primero se **entrega** y después,
cuando Anthropic termina (casi siempre en menos de 1 h, máximo 24 h), se **recogen** los
resultados. Los resultados se pueden descargar durante **29 días**.

### Paso 1 — `npm run lote:crear`
1. Busca fotos con `estado_proceso = 'pendiente'`, o `'error'` con `intentos < 3`.
   Toma como máximo `N` (ej. 200, configurable) para controlar el costo.
2. **Muestra un estimado de costo** (fotos × costo por foto de la Fase 3) y pide
   confirmación (`¿Continuar? s/n`).
3. Arma una petición por foto. El **`custom_id` es el `id` de la foto** (UUID). Así, al
   recoger, cada resultado se sabe de qué foto es (los resultados llegan **en cualquier
   orden**).
4. Llama a `messages.batches.create` → Anthropic devuelve el **id del lote**
   (`msgbatch_...`).
5. **Guarda el id del lote** en `lotes_proceso` (estado `en_proceso`) y marca las fotos:
   `estado_proceso = 'en_lote'`, `lote_id = <id>`, `intentos = intentos + 1`.
6. Si el paso 5 fallara, el script imprime el id del lote para no perderlo. El paso 2
   también acepta un id a mano (`npm run lote:recoger -- msgbatch_...`).

### Paso 2 — `npm run lote:recoger`
1. Busca en `lotes_proceso` los lotes `en_proceso`.
2. Para cada uno pregunta su estado (`messages.batches.retrieve`). Si **todavía no
   termina** (`processing_status` distinto de `ended`), dice "aún no está listo, vuelve
   más tarde" y no hace nada más.
3. Si ya terminó, lee los resultados (`messages.batches.results`), uno por foto:
   - `succeeded` + `end_turn` + JSON válido → calcula `estado` de cada lectura y llama a
     `guardar_lecturas` → foto `procesada`.
   - `succeeded` pero cortada (`max_tokens`), negada (`refusal`) o JSON inválido → foto
     `error` con el motivo.
   - `errored`, `expired`, `canceled` → foto `error` con el motivo.
4. Suma `usage` (tokens) de todos los resultados, calcula el costo real y marca el lote
   `recogido`.
5. Imprime un resumen: fotos OK, con error, lecturas aceptadas / dudosas / descartadas y
   costo.

Correr el paso 2 dos veces no duplica nada: `guardar_lecturas` ignora las fotos que ya
están `procesada`.

---

## 8. Quién dispara el proceso (no puede ser público)

| | **A. Script local** (recomendada) | **B. Ruta protegida en Vercel** |
|---|---|---|
| Cómo | Tú corres `npm run lote:crear` y luego `npm run lote:recoger` en tu computadora | Ruta `src/app/api/proceso/route.ts`. Solo responde si la petición trae `Authorization: Bearer <PROCESO_SECRET>`. La puede llamar Vercel Cron con su `CRON_SECRET` |
| Llaves en Vercel | **Ninguna** | `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, `PROCESO_SECRET` |
| Superficie de ataque | Cero: no existe ninguna URL nueva | Una URL pública; si la clave se filtra, alguien puede gastar tu saldo |
| Riesgo para la app publicada | Ninguno: no se despliega nada nuevo | Bajo, pero es código nuevo en producción |
| Límite de tiempo | Ninguno | Las funciones de Vercel tienen tiempo máximo; hay que partir el trabajo |
| Automático | No: alguien lo corre (ej. una vez al día o por semana) | Sí, con Cron |

**Recomendación: A.** Los lotes ya son "en segundo plano", así que correr dos comandos al
día no es una carga. Las llaves nunca salen de tu computadora, no se toca la app publicada y
es lo más fácil de entender y de arreglar. Si más adelante se quiere automatizar, se agrega B
reusando el mismo código de `src/lib/etapa2/` (el agente que lo haga lee primero la guía de
*route handlers* en `node_modules/next/dist/docs/`).

---

## 9. Fase de evaluación: modelo y tamaño de foto

### 9.1 Tamaño al que se reducen las fotos hoy (Etapa 1, Fase 5)

Según `src/lib/fotos.ts`:
- **Lado mayor: 2000 px como máximo** (`LADO_MAXIMO_PX = 2000`), en JPEG con calidad 0.8
  (`CALIDAD_JPEG`).
- Con la librería (`browser-image-compression`) hay además **`maxSizeMB: 1`**. Si la foto
  pesa más de 1 MB, la librería **baja la calidad del JPEG** hasta llegar a ~1 MB. Esto puede
  volver borrosas las letras pequeñas, más que el tamaño en píxeles.
- Las HEIC convertidas con `<canvas>` quedan en 2000 px y calidad 0.8, **sin** el tope de 1 MB.
- **No se guarda el original:** solo existe la versión reducida.

Referencia de la API: los modelos actuales aceptan hasta **2576 px** de lado mayor (si una
foto es más grande, la API la reduce sola). Una foto de 2000 × 1500 px cuesta alrededor de
**4 000 tokens** de entrada. ⚠️ Confirmar en la documentación de *Vision* el límite exacto
de `claude-haiku-5-5` antes de la Fase 3.

### 9.2 Muestra de evaluación
- **25 fotos** (20–30) ya subidas, escogidas a mano para cubrir: etiqueta simple, foto con
  muchos precios, regular + promoción, "2x$30" o similar, foto borrosa o con reflejo, foto
  HEIC convertida, y una foto **sin** precios.
- Por cada foto, el usuario escribe **a mano** los precios correctos en
  `docs/evaluacion/esperado.json` (producto, presentación, precio regular, promoción).
- Además, **5 fotos tomadas de nuevo con el celular y guardadas en su tamaño original**
  (sin pasar por la app), en una carpeta local que **no** se sube a git.

### 9.3 Qué se compara (`npm run evaluar`)
Se usa la API normal (una foto a la vez, sin lote), porque son pocas fotos y se quiere el
resultado rápido.

1. **Modelos:** `claude-sonnet-5-5` vs `claude-haiku-5-5`, con effort `low` y `medium`.
2. **Tamaño:** con las 5 fotos originales, comparar la lectura del original (hasta 2576 px)
   contra la misma foto reducida como lo hace la app (2000 px y tope de 1 MB).

**Métricas** (por modelo y configuración):
- **Precios correctos:** lecturas cuyo precio coincide con el esperado (al centavo).
- **Precios faltantes:** esperados que no aparecieron.
- **Precios inventados:** lecturas que no existen en la foto. Es **el error más grave**.
- **Dudas útiles:** de las lecturas incorrectas, cuántas quedaron como `dudosa` o
  `descartada` (o sea, el sistema avisó).
- **Costo por foto** (de `usage`) y tiempo.

**Criterio para decidir:** el modelo más barato cuyo resultado sea aceptable para el usuario
(se propone: ≥ 95 % de precios correctos entre los `aceptada` y 0 inventados como
`aceptada`). Si los originales se leen claramente mejor que las fotos reducidas, se
**propone** (no se hace en esta etapa) subir `LADO_MAXIMO_PX` a 2576 y quitar o subir el tope
de 1 MB en la Fase 5. Eso cambia la app publicada y necesita aprobación aparte.

---

## 10. Riesgos

| Riesgo | Qué puede pasar | Cómo se mitiga |
|---|---|---|
| **Fotos con muchos precios** | Claude se salta algunos, une el precio de un producto con el nombre de otro, o la respuesta se corta | `precios_visibles_aprox` vs lecturas listadas → si faltan muchas, la foto se marca para revisar. `max_tokens` amplio; si `stop_reason = max_tokens`, la foto va a `error`. Recomendación al personal: fotos más cercanas, de un tramo del anaquel a la vez |
| **Etiquetas ilegibles** (borrosas, reflejo, lejos, cortadas) | Precios **inventados** que parecen reales | Instrucción explícita "no adivines". `confianza` baja → `dudosa`; sin precio legible → `descartada`. La Fase 3 mide los inventados. Revisar el tope de 1 MB (9.1) |
| **Precio regular y de promoción juntos** | Se guarda el de promoción como regular, o se mezclan "2x$30" y precio unitario | Columnas separadas: `precio_regular`, `precio_promocion` y `texto_promocion` (texto tal cual). Validación: si promoción ≥ regular → `dudosa`. Claude **no** calcula precios unitarios de promociones como "2x$30"; solo copia el texto |
| **Costo por lote** | Un lote grande o fotos basura (la app es abierta, sin login) gastan saldo | Tope de fotos por lote, costo estimado y confirmación antes de crear, costo real guardado en `lotes_proceso`, llave propia con **límite de gasto** en la consola de Anthropic. Ver estimado abajo |
| Negativa del modelo (`refusal`) | Una foto no se procesa | Pasa a `error` y se reintenta; tras 3 intentos queda para revisión |
| Lote que no se recoge a tiempo | Los resultados se borran a los 29 días | El paso 2 avisa de lotes `en_proceso` con más de 7 días |
| Llave secreta filtrada | Acceso total a la base de datos o gasto en Anthropic | Solo en `.env.local` (ignorado por git) y nunca `NEXT_PUBLIC_`. Antes de cada commit, `git status` para confirmar que `.env.local` no está |

**Estimado de costo por foto con lotes** (precios de lote = 50 % de los normales; supuesto:
~5 000 tokens de entrada y ~3 000 de salida, contando el pensamiento). **Se reemplaza con lo
medido en la Fase 3:**

| Modelo | Precio normal (entrada / salida por millón) | Lote | ≈ por foto | ≈ 1 000 fotos |
|---|---|---|---|---|
| `claude-sonnet-5-5` | $2 / $10 | $1 / $5 | ~$0.02 | ~$20 USD |
| `claude-haiku-5-5` | $0.10 / $0.50 | $0.05 / $0.25 | ~$0.001 | ~$1 USD |

---

## 11. Fases de la Etapa 2

Cada fase la hace **un agente distinto**, con las mismas reglas de cierre de `PLAN.md`
(build, lint, `PROGRESO.md`, un commit, sin push).

### Fase 0 — Plan ✅
Este archivo. Sin código.

### Fase 1 — Base de datos de la Etapa 2
- Escribir `supabase/002_etapa2.sql` según la sección 5 (columnas en `fotos`,
  `lotes_proceso`, `lecturas_precios`, `guardar_lecturas`, `lecturas_analisis`, permisos).
  Explicar cada bloque antes de que el usuario lo ejecute.
- Agregar los tipos nuevos a `src/lib/tipos.ts` (solo las columnas nuevas de `fotos`; las
  tablas cerradas van en un archivo de tipos aparte, de servidor).
- Actualizar `.env.example` con los nombres de la sección 4.1.
- Guiar al usuario para crear la llave de Anthropic (con límite de gasto) y copiar la secret
  key de Supabase a `.env.local`.

**Cómo comprobar:** la app publicada sigue funcionando igual (crear visita, subir y ver
fotos). En Table Editor, las fotos viejas tienen `estado_proceso = pendiente`. Con la
llave pública (`anon`), `select` sobre `lecturas_precios` y `lecturas_analisis` **falla**.

### Fase 2 — Leer una foto
- Pedir permiso para instalar `@anthropic-ai/sdk` (sección 4.3).
- `src/lib/etapa2/`: instrucciones, esquema JSON, validación y cálculo de `estado`.
- `scripts/etapa2/leer-una-foto.ts <foto_id>`: llama a la API (normal, sin lote), valida e
  **imprime** el resultado. No guarda nada.

**Cómo comprobar:** con 3 fotos reales, el resultado impreso coincide con lo que se ve.

### Fase 3 — Evaluación
- Sección 9 completa. Resultado en `docs/evaluacion/RESULTADOS.md`: tabla por modelo y
  effort, costo por foto real y recomendación. **El usuario elige el modelo.**
- Actualizar el estimado de costo de la sección 10 con lo medido.

### Fase 4 — Lotes y guardado
- `crear-lote.ts` y `recoger-lote.ts` según la sección 7, con el modelo elegido.
- Primera corrida real con **20 fotos**.

**Cómo comprobar:** las 20 fotos pasan a `procesada` (o `error` con motivo), hay lecturas
en `lecturas_precios`, `lecturas_analisis` las muestra sin las descartadas, el costo queda en
`lotes_proceso` y correr `lote:recoger` otra vez no duplica nada. Una foto en `error` se
vuelve a tomar en el siguiente `lote:crear`.

### Fase 5 — Corrida completa y consultas de ejemplo
- Procesar todas las fotos pendientes (en lotes con tope).
- Dejar en `supabase/consultas_etapa2.sql` consultas de ejemplo: precio promedio por
  producto y competidor, lecturas dudosas por revisar, fotos con `error`.
- Revisar con el usuario una muestra de `dudosa` para ajustar instrucciones si hace falta.

---

## 12. Fuente y supuestos

| Decisión / supuesto | Origen |
|---|---|
| Las 8 decisiones de la sección 2 | Usuario, 2026-11-19 |
| Confianza en 3 niveles en vez de número; `estado` calculado por nuestro código | Propuesta del agente de la Fase 0 (motivo en 5.3) |
| Estado de procesamiento como columnas de `fotos` (no tabla aparte) | Propuesta del agente: es lo más simple y no rompe la app (5.1) |
| Función `guardar_lecturas` para guardar "todo o nada" | Propuesta del agente (5.5) |
| Opción A (script local) para disparar el proceso | Recomendación del agente, **pendiente de confirmar** por el usuario |
| `@anthropic-ai/sdk` | Propuesta, **pendiente de permiso** (Fase 2) |
| Precios y límites de la API (lotes 50 %, 24 h, 29 días, 2576 px) | Documentación de Anthropic consultada el 2026-11-19; revisar antes de la Fase 3 |
