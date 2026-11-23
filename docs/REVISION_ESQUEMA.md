# Revisión del esquema (Etapa 2) — 2026-11-23

> **Solo análisis.** No se cambió ningún archivo SQL, no se ejecutó nada en Supabase y no se
> escribió ninguna migración. **Sin datos reales:** los ejemplos son inventados y los
> tamaños son órdenes de magnitud.
>
> Fuentes: `supabase/001` a `006`, `supabase/seed_competidores.sql`,
> `supabase/pruebas/006_prueba_comparacion.sql`, `docs/PLAN.md`, `docs/PLAN_ETAPA2.md` y
> `docs/PROGRESO.md`.

## Estado actual de las tablas (decide qué tan caro es cambiar)

| Objeto | ¿Tiene datos? | De dónde salen los datos |
|---|---|---|
| `competidores`, `visitas`, `fotos` | **Sí** (Etapa 1, uso real) | La app. No se pueden volver a generar |
| Columnas de proceso de `fotos` (`estado_proceso`, `calidad`, `motivo_calidad`, `lote_id`, `intentos`, `error_proceso`, `procesada_at`) | Las filas existen, pero **todas** están en `pendiente` / vacías | Nadie las ha escrito aún |
| `catalogo_propio`, `catalogo_propio_cortes`, `promociones_propias` | **Sí** (un corte importado) | El paquete en `datos-privados/`: **se pueden reimportar** |
| `lotes_proceso`, `articulos_competencia`, `lecturas_precio`, `equivalencias` | **No** (vacías) | Fases 🤖 que no han empezado |
| Vistas `catalogo_propio_actual`, `lecturas_analisis`, `comparacion_precios` y funciones | No guardan datos | Se recalculan en cada consulta |

**Regla general:** cambiar una **vista o función** siempre es barato (no guarda datos).
Cambiar una **tabla vacía** es barato **hoy**. Lo caro llega cuando existan lecturas
(cuestan llamadas a la API para volver a sacarlas) y equivalencias aprobadas (cuestan horas
de revisión de una persona).

---

## 1. `catalogo_propio` vs `catalogo_propio_actual`

**Qué hace cada una**

| | `catalogo_propio` (tabla) | `catalogo_propio_actual` (vista) |
|---|---|---|
| Una fila es | Un artículo nuestro (llave `clave`, texto) | Lo mismo, una fila por artículo |
| Guarda | Lo que **casi no cambia**: descripción, área, departamento, categoría NACS, contenido (`cantidad`, `unidad`, `piezas` y las generadas `unidad_base`, `contenido_base`), `contenido_origen`, `es_servicio`, `obsoleto`, `de_baja`, `fecha_corte_ultimo` | Nada: lee `catalogo_propio` y le agrega el **precio de su último corte** (`precio_regular`, `fecha_ultimo_cambio_precio`) y calcula **`activo`** |
| `activo` | No existe (decisión 22: se calcula, no se guarda) | Aparece en el corte más reciente **y** no obsoleto, no de baja, no servicio y precio > 0 |
| Quién la usa | `importar_corte` (escribe), `equivalencias` (llave foránea) | `comparacion_precios` (filtra `p.activo` y toma descripción, contenido y categoría) |

**¿Hace falta la vista?** No es indispensable: lo que hace se podría escribir dentro de
`comparacion_precios`. Pero es la **única definición de "activo"**; si un tablero o una
consulta futura necesita "artículos activos", la reutiliza en vez de copiar la regla.

| | Ventajas | Desventajas |
|---|---|---|
| **Mantener la vista** (hoy) | Una sola definición de "activo". No guarda datos (cero costo). Cómoda para consultas a mano | Una pieza más que entender. Su `precio_regular` es el **de hoy**, distinto del que usa `comparacion_precios` (el de la fecha de la foto): se pueden confundir |
| **Quitarla** y poner la regla dentro de `comparacion_precios` | Menos objetos | La regla de "activo" quedaría copiada en cada consulta que la necesite |
| **Guardar `activo` como columna** | Consulta más simple | Hay que recalcularla en cada importación; contradice la decisión 22 |

**Punto de diseño a revisar (no es un error de código):** `comparacion_precios` filtra con
el `activo` **de hoy**, también para fotos viejas. Si un artículo se da de baja el próximo
mes, **todas sus comparaciones pasadas desaparecen** de la vista y las tendencias
históricas cambian hacia atrás. Si se quiere estabilidad histórica, `obsoleto` / `de_baja`
tendrían que guardarse **por corte** (en `catalogo_propio_cortes`) y la vista usar los del
corte de la fecha de la foto. Eso cambia una tabla **con datos** (ver punto 7).

**Conexión automática de inventarios en el futuro**

| Qué **cambiaría** | Qué **no** cambiaría |
|---|---|
| Quién llena las tablas: un proceso automático (por ejemplo diario) en vez del script con `--confirmar` sobre un paquete CSV | `catalogo_propio` como "ficha" del artículo con `clave` texto como llave |
| La frecuencia de cortes (de "cuando llega un paquete" a diaria): más filas en `catalogo_propio_cortes` (punto 2) | `equivalencias` → `catalogo_propio.clave` |
| Las **existencias** (inventario por tienda) **no** van en `catalogo_propio`: serían una tabla nueva, por ejemplo `existencias(fecha, tienda, clave, cantidad)`, y una tabla de **tiendas nuestras**, que hoy no existe | La interfaz `precio_propio_vigente(clave, fecha)`: quien la llama no se entera de dónde vino el precio |
| La definición de "activo" quizá incluya "con existencia > 0", y se cambia solo en la vista | `comparacion_precios` (sigue llamando a la vista y a la función) |
| `importar_corte` sirve si la conexión entrega **la lista completa**. Si entrega **solo cambios**, la regla "aparece en el corte más reciente" marcaría como inactivo todo lo que no cambió: habría que cambiar la regla o el importador | Las reglas de seguridad: todo cerrado a `anon`, y escribe solo `service_role` |
| **Permiso de datos:** existencias por tienda no están cubiertas por el permiso del 2026-11-20; hay que pedirlo como se hizo con la venta (decisión 20) | |

**Recomendación:** **mantener la tabla y la vista como están.** La vista no cuesta nada y
centraliza "activo". Para la conexión automática, diseñar las existencias como **tabla
aparte**. Antes de que haya tableros de tendencia, **decidir** si las comparaciones viejas
deben desaparecer cuando un artículo deja de estar activo (hoy sí desaparecen).

---

## 2. `catalogo_propio_cortes`

**Qué es:** una fila por **artículo y corte** con el precio regular de ese corte. Los
cortes se apilan. Es el historial de nuestros precios: `precio_propio_vigente(clave,
fecha)` busca el corte más reciente con fecha ≤ fecha de la foto.

**Cuándo es imprescindible tener historial (de cualquier forma)**
- Comparar fotos de una fecha contra **nuestro precio de esa fecha**: sin historial, una foto
  de marzo se compararía contra el precio de hoy.
- Tendencias del índice en el tiempo (el objetivo del tablero).
- Revisar "qué decía el corte X" y la comprobación de `importar_corte` (el precio vigente en
  la fecha del corte = precio del archivo).

**Lo que no es imprescindible es guardar la foto completa de cada corte.** Alternativas:

| Opción | Ventajas | Desventajas |
|---|---|---|
| **A. Foto completa por corte** (hoy) | Muy simple. Reimportar un corte = borrar esa fecha e insertar (no duplica). Un corte viejo importado tarde no rompe nada. Sirve tal cual para comparar dos cortes | Repite el mismo precio en cada corte. Con miles de artículos: cortes semanales ≈ cientos de miles de filas por año; diarios ≈ un millón por año. Para Postgres es poco, pero crece sin parar |
| **B. Solo cuando cambia el precio** (`clave, precio_regular, vigente_desde, vigente_hasta`) | Muchas menos filas. Muestra directamente cuándo cambió cada precio. Encaja con una conexión automática que entregue **cambios** | Importar un corte **viejo** tarde obliga a partir intervalos. Reimportar no es "borrar e insertar". Se pierde "en qué cortes apareció el artículo", así que "activo" necesita otra fuente (hoy usa `fecha_corte_ultimo`, que sí seguiría). Más lógica, y más fácil de equivocar |
| **C. Solo el precio actual** (en `catalogo_propio`) | Lo más simple | **Rompe** la comparación por fecha y las tendencias. Descartada |
| **D. Foto completa ahora y compactar después** (pasar de A a B con una consulta) | Se queda la simplicidad de A. B se puede sacar **de los datos que ya hay**, sin reimportar | Hay que hacerlo algún día si el volumen crece |

**Recomendación:** **mantener A** mientras los cortes sean manuales y poco frecuentes. Si
llega la conexión automática diaria, pasar a **B** (o particionar A por fecha). La interfaz
`precio_propio_vigente(clave, fecha)` se puede mantener igual en los dos casos. Si se quiere
estabilidad histórica de "activo" (punto 1), aprovechar el mismo cambio para guardar
`obsoleto` / `de_baja` por corte.

---

## 3. Calidad: `fotos` frente a `lecturas_precio`

| Columna | Tabla | Qué describe | Valores |
|---|---|---|---|
| `calidad` | `fotos` | La **foto completa** | `legible`, `borrosa`, `reflejo`, `lejana`, `sin_precios` |
| `motivo_calidad` | `fotos` | Por qué la foto tiene esa calidad (texto) | Libre |
| `error_proceso` | **`fotos`** (no existe en `lecturas_precio`) | El último **error técnico** al procesar la foto (por ejemplo, falló la llamada) | Libre |
| `calidad` | `lecturas_precio` | **Una etiqueta** dentro de la foto | `legible`, `borrosa`, `reflejo`, `lejana`, `cortada` |
| `motivo_duda` | `lecturas_precio` | Por qué alguna confianza no es `alta`, o por qué se descartó | Libre |

**¿Hay duplicación?** De datos, **no**: cada columna describe algo distinto (foto vs
etiqueta; calidad de imagen vs duda de lectura vs error técnico). Una foto `legible` puede
tener una etiqueta `cortada` en la orilla. Lo que sí se repite:
1. **La lista de valores** (4 de 5 iguales) está escrita en **dos `check` distintos**. Si
   algún día se agrega un valor en uno y no en el otro, se desalinean.
2. **El nombre** `calidad` significa cosas distintas en cada tabla. `lecturas_analisis` ya
   los renombra a `calidad_foto` / `calidad_etiqueta`, pero en las tablas se llaman igual.
3. `fotos` mezcla datos **de la app** (ruta, hora de captura) con **estado del proceso**.
   `error_proceso` solo guarda el **último** error: se pierde el historial de intentos.

| Opción | Ventajas | Desventajas |
|---|---|---|
| **Dejar como está** | Cero trabajo | Riesgo de desalinear las listas; nombres ambiguos |
| **Renombrar** a `calidad_foto` / `motivo_calidad_foto` y `calidad_etiqueta` | Se entiende sin leer el plan | Hay que ajustar `guardar_lecturas`, `lecturas_analisis` y la prueba |
| **Una sola columna de calidad** (por ejemplo, copiar la calidad de la foto a cada lectura) | Una consulta menos | **Mala idea:** pierde la diferencia foto/etiqueta y repite el dato en cada lectura |
| **Mover el estado de proceso** a una tabla aparte (`fotos_proceso`, o un registro de intentos) | `fotos` queda solo para la app. Queda historial de errores e intentos | Una tabla y un *join* más. `guardar_lecturas` cambia |
| **Una lista de calidades compartida** (tabla de catálogo o `domain` de Postgres) | La lista se define una vez | Más formalidad de la que el proyecto necesita hoy |

**Recomendación:** **no unificar** las columnas; son niveles distintos. **Sí renombrar**
ahora (es barato: las columnas están vacías) a `calidad_foto` / `motivo_calidad_foto` en
`fotos` y `calidad_etiqueta` en `lecturas_precio`, y dejar escrito en un comentario que los
4 valores comunes deben coincidir. Mover el proceso a otra tabla solo si se quiere el
historial de intentos; si no, no vale la pena.

---

## 4. Normalización: `lecturas_precio` vs `articulos_competencia`

**Columnas repetidas** (están en las dos tablas):

| Columna | ¿Se justifica la repetición? |
|---|---|
| `marca`, `articulo` | **Sí, con matiz.** En la lectura es **lo que se leyó en esa foto**; en el artículo es **la identidad única**. Hoy el artículo se crea a partir de la lectura, así que al principio son iguales; se separan cuando una persona **fusiona** duplicados (cambia el `articulo_competencia_id`) o **corrige** una lectura |
| `cantidad`, `unidad`, `piezas` (+ `unidad_base`, `contenido_base` generadas) | **Es la repetición más delicada.** `comparacion_precios` usa el contenido **de la lectura**, pero la equivalencia se aprueba **por artículo**. Dos lecturas del mismo artículo con contenidos distintos (una mal leída) darían índices distintos en `otra_presentacion` |
| `ean` | Sí: en la lectura es "lo que traía esta etiqueta"; en el artículo, el código conocido |
| `codigo_interno` | **No está repetido** (solo en la lectura). Si sirve para identificar al artículo, quizá debería estar también en el artículo |
| `modelo` (en `lecturas_precio` y en `lotes_proceso`) | Sí: una lectura puede venir de una prueba **sin lote** |
| `lote_id` (en `fotos` y en `lecturas_precio`) | Sí: en `fotos` es el **último** lote enviado; en la lectura, el lote que la produjo |
| Precios y promoción | **No se repiten**: solo viven en la lectura (correcto: cambian con cada observación) |

Las columnas **generadas** (`precio_regular_pieza`, `precio_promo_pieza`, `unidad_base`,
`contenido_base`, `clave_normalizada`) no son repetición: nadie las escribe y no se pueden
desalinear.

| Opción | Ventajas | Desventajas |
|---|---|---|
| **A. Dejar como está** | Cada lectura conserva lo leído (sirve para revisar y para la evaluación E2-9) | Lectura y artículo se pueden desalinear sin que nadie se entere; el índice usa el contenido de la lectura |
| **B. Normalizar del todo:** la lectura solo guarda `articulo_competencia_id` + lo crudo (`texto_leido`, `valores_agente`) | Una sola verdad por artículo | Una lectura sin artículo (la llave puede quedar vacía) se queda sin descripción. Corregir "solo esta lectura" obliga a cambiarla de artículo. Revisar es más incómodo |
| **C. Mantener las columnas en la lectura, pero el análisis usa las del artículo** (`comparacion_precios` toma marca, artículo y contenido de `articulos_competencia`) | Lo leído se conserva y el índice es coherente para todas las lecturas de un artículo | Hay que cambiar la vista (barato). Una lectura con contenido distinto al de su artículo debería marcarse para revisión (regla en `validar.ts` o en `guardar_lecturas`) |

**Recomendación:** **C.** Hacerlo **antes de E2-6** (tablas vacías). Además, decidir si
`articulo_competencia_id` debe ser obligatorio para lecturas que no estén `descartada`.

---

## 5. Columnas de `comparacion_precios`

Hay 41 columnas. Para cada una: si se puede quitar y si la necesita un tablero.

| Grupo | Columna | ¿Quitar? | ¿La necesita un tablero? |
|---|---|---|---|
| Cuándo | `fecha_observacion` | No | **Sí** (eje de tiempo) |
| | `fecha_origen` | Opcional | Filtro de calidad (foto con hora real o no) |
| Dónde | `competidor_id`, `competidor` | No | **Sí** |
| | `latitud`, `longitud` | **Sí**: ya viven en `visitas` (por `visita_id`) | No directamente (ver nota) |
| | `visita_id` | No | **Sí**: para contar tiendas y promediar "entre tiendas" |
| | `foto_id` | No | Para entrar al detalle |
| | `ruta` | Opcional (sale de `fotos` por `foto_id`) | Solo para el enlace "ver foto" |
| Competencia | `lectura_id` | No | Para entrar al detalle |
| | `articulo_competencia_id` | No | **Sí**: tendencia por artículo |
| | `articulo`, `marca` | No | **Sí** (etiquetas) |
| | `ean` | Opcional | No |
| | `cantidad`, `unidad`, `piezas` | Opcional | Solo para mostrar la presentación |
| | `precio_regular_comp` | No | **Sí** |
| | `promo_tipo`, `texto_promocion`, `precio_promo_pieza_comp` | Opcional: no entran al índice y ya están en `lecturas_analisis` | No en esta versión |
| | `estado_lectura` | No | **Sí** (filtro) |
| Nuestro | `clave`, `descripcion` | No | **Sí** |
| | `cantidad_propia`, `unidad_propia`, `contenido_origen_propio` | Opcional | Para explicar `otra_presentacion` |
| | `precio_regular_propio` | No | **Sí** |
| | `fecha_corte_usada`, `corte_posterior` | No | Filtro de calidad (`corte_posterior` = se usó un precio de después de la foto) |
| | `nacs_categoria` | No | **Sí** (agrupar por categoría) |
| Equivalencia | `equivalencia_id`, `tipo_equivalencia` | No | `tipo_equivalencia` sí |
| Calculado | `base_indice` | Opcional: es 1 a 1 con `tipo_equivalencia` | No |
| | `indice_vs_competencia_pct` | No | **Sí** (la métrica) |
| | `en_linea` | Se podría calcular, pero conviene dejarla: guarda el umbral ±3 % (aún por confirmar) en **un solo lugar** | **Sí** |
| | `entra_a_promedios` | Es 1 a 1 con `tipo_equivalencia`, pero deja la regla escrita | **Sí** (filtro de promedios) |
| | `unidad_comparacion`, `precio_comp_por_unidad`, `precio_propio_por_unidad`, `motivo_sin_precio_unidad` | Opcional | Útiles para mostrar `otra_presentacion` |

**Nota sobre `latitud` / `longitud`:** quitarlas de la vista está bien (se obtienen con
`visita_id`). Pero falta algo para el tablero: **no existe "tienda de la competencia"**.
Hoy la única forma de saber que dos visitas fueron a la misma sucursal es por su ubicación.
Para "promedio entre tiendas" (PLAN_ETAPA2 5.9) y para zonas (5.8) hará falta un
`tienda_id` o una regla de agrupación. Eso es un tema aparte, no de esta vista.

| Opción | Ventajas | Desventajas |
|---|---|---|
| **Dejar las 41** | Todo a la mano para revisar a mano | Más ancha de lo que un tablero necesita; repite datos que ya están en otras tablas |
| **Vista angosta** (solo las marcadas "Sí" + ids) | Clara para el tablero; menos tentación de usar columnas informativas como si fueran métricas | El detalle se consulta con *joins* (por los ids) |
| **Dos vistas**: `comparacion_precios` angosta para el tablero + una de detalle | Lo mejor de las dos | Un objeto más |

**Recomendación:** quitar `latitud`, `longitud`, `ruta`, `ean` y las tres de promoción; dejar
el resto. Las columnas 1 a 1 (`base_indice`, `entra_a_promedios`) se pueden quedar porque
documentan reglas. Es barato en cualquier momento (es una vista), con un detalle técnico:
`create or replace view` **no permite quitar columnas**; hay que hacer `drop view` y crearla
de nuevo (hoy nada depende de ella).

---

## 6. `lecturas_precio` vs `lecturas_analisis` (y `comparacion_precios`)

| | `lecturas_precio` | `lecturas_analisis` | `comparacion_precios` |
|---|---|---|---|
| Tipo | **Tabla** (guarda datos) | Vista | Vista |
| Filas | Todas las lecturas | Todas **menos** `descartada` (incluye `por_revisar` y lecturas **sin equivalencia**) | Solo lecturas `propuesta`/`aprobada`/`corregida` **con equivalencia aprobada**, artículo nuestro activo y precios > 0 |
| Agrega | — | Foto, visita, competidor, fecha de observación, precio por unidad (`precio_regular_normalizado`), `promo_comparable`, confianza y revisión | Nuestro precio en la fecha de la foto, índice, `en_linea`, precio por unidad de los dos lados |
| Sirve para | Guardar | **Revisar** lecturas, medir al agente (E2-9), analizar la competencia **por sí sola** (por ejemplo "el competidor X bajó el aceite", aunque no tengamos equivalente) y promociones | Comparar **contra nosotros** (el tablero) |

**¿Es redundante `lecturas_analisis`?** **No.** Cubre lecturas que `comparacion_precios`
deja fuera a propósito (sin equivalencia, `sin_equivalente`, `por_revisar`, artículos
nuestros inactivos). Sí hay **lógica repetida** entre las dos vistas:
- Las dos unen las mismas 4 tablas y calculan `fecha_observacion` / `fecha_origen` igual.
- Las dos calculan el precio por unidad, con fórmulas distintas en forma **y con etiquetas
  distintas**: `lecturas_analisis` dice `'pza'` y `comparacion_precios` dice `'pieza'`. Un
  tablero que junte las dos verá dos valores para lo mismo.

| Opción | Ventajas | Desventajas |
|---|---|---|
| **Dejar las dos como están** | Cero trabajo | Lógica repetida; etiquetas `pza`/`pieza` distintas |
| **Quitar `lecturas_analisis`** | Un objeto menos | Se pierde la revisión de lecturas y el análisis de la competencia sin equivalente. **No recomendable** |
| **Construir `comparacion_precios` encima de `lecturas_analisis`** (o las dos sobre una vista base común) | Fecha y precio por unidad definidos **una vez** | Hay que rehacer la vista. Postgres la sigue resolviendo bien (expande las vistas), pero hay que revisar el plan de consulta cuando haya datos |

**Recomendación:** mantener las dos y hacer que `comparacion_precios` lea de
`lecturas_analisis` (o de una vista base común). Unificar la etiqueta (`pieza` o `pza`, una
sola). Barato: son vistas.

---

## 7. Qué cambiar y cuándo: barato ahora vs caro después

### Baratos ahora (tablas vacías o vistas)

Se hacen con un SQL nuevo (`007_...`), sin migrar datos. **Lo ideal es antes de E2-5/E2-6**,
porque desde ahí empiezan a existir lecturas.

| # | Cambio | Punto | Por qué es barato |
|---|---|---|---|
| B1 | `comparacion_precios` toma marca, artículo y contenido de `articulos_competencia` (opción C) | 4 | Es una vista |
| B2 | Regla de coherencia lectura ↔ artículo (contenido distinto → `por_revisar`) y decidir si `articulo_competencia_id` es obligatorio salvo en `descartada` | 4 | `lecturas_precio` y `articulos_competencia` están vacías |
| B3 | Renombrar `lecturas_precio.calidad` → `calidad_etiqueta` | 3 | Tabla vacía |
| B4 | Renombrar `fotos.calidad` / `motivo_calidad` → `calidad_foto` / `motivo_calidad_foto` | 3 | Las filas existen, pero esas columnas están **todas vacías**. La app no las usa (no tiene permiso) |
| B5 | (Opcional) mover el estado de proceso de `fotos` a una tabla aparte o a un registro de intentos | 3 | Mismo motivo que B4. Ajustar `guardar_lecturas` |
| B6 | (Opcional) `codigo_interno` también en `articulos_competencia` | 4 | Tabla vacía |
| B7 | `comparacion_precios` más angosta (sin `latitud`, `longitud`, `ruta`, `ean` ni promoción) | 5 | Vista (con `drop view` + crear) |
| B8 | `comparacion_precios` sobre `lecturas_analisis` o una vista base; unificar `pza`/`pieza` | 6 | Vistas |
| B9 | Comentario o lista común para los valores de calidad | 3 | Solo `check` / comentarios |

### Caros después (tablas con datos: piden migración y, a veces, reimportación)

| # | Cambio | Punto | Por qué es caro | Cuándo conviene |
|---|---|---|---|---|
| C1 | Guardar `obsoleto` / `de_baja` **por corte** para que "activo" no cambie las comparaciones pasadas | 1, 2 | `catalogo_propio_cortes` tiene datos; los cortes ya cargados **no traen** ese dato por corte → hay que **reimportar** los paquetes (están en `datos-privados/`) | **Antes del primer tablero de tendencias.** Mientras haya un solo corte, el costo es una reimportación |
| C2 | Pasar `catalogo_propio_cortes` a "solo cuando cambia el precio" | 2 | Tabla con datos + reescribir `importar_corte` y `precio_propio_vigente` (los intervalos se pueden sacar **de los datos actuales**, sin reimportar) | Solo si llega la conexión automática diaria o el volumen crece |
| C3 | Conexión automática de inventarios: tablas nuevas de existencias y de tiendas nuestras; importador nuevo | 1 | Tablas nuevas (baratas), pero cambia el proceso de carga y la definición de "activo" | Cuando exista la conexión **y el permiso de datos** |
| C4 | Cualquier cambio de B1–B6 **después** de E2-6 | 3, 4 | Con lecturas guardadas: migrar filas, y si hay que volver a leer fotos, **cuesta llamadas a la API**. `valores_agente` no se puede editar (un *trigger* lo impide) | Evitarlo: hacer B1–B6 antes |
| C5 | Cambios a `equivalencias` cuando ya haya aprobadas | — | Cada aprobación es **trabajo de una persona**; no se reconstruye sola | Fijar la estructura antes de E2-7 |
| C6 | `tienda_id` de la competencia (para "promedio entre tiendas" y zonas) | 5 | `visitas` tiene datos reales: habría que asignar tienda a las visitas viejas por su ubicación | Antes de que el tablero promedie entre tiendas |

### Recomendación general

1. Antes de E2-5: decidir y aplicar **B1–B4 y B8** en un solo SQL nuevo (más B5 y B6 si se
   quieren). Todo barato hoy.
2. Antes del primer tablero de tendencias: decidir **C1** (si las comparaciones viejas deben
   desaparecer cuando un artículo se da de baja) y **C6** (cómo se identifica una tienda de
   la competencia).
3. **C2** y **C3** solo cuando llegue la conexión automática; el diseño actual no lo impide.

Ninguno de estos cambios se ha hecho: este documento solo propone. Cada uno necesita la
aprobación del usuario y, si toca tablas, el mismo procedimiento de siempre (SQL nuevo,
comprobación con `ok = true`, primero en simulación cuando aplique).
