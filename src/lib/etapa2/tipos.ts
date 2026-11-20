// Tipos de las tablas de la Etapa 2 (escritos a mano), según supabase/004_tablas_competencia.sql
// y supabase/006_equivalencias_comparacion.sql.
// SOLO para código de servidor (scripts con la secret key). La app (navegador) no puede leer
// estas tablas: están cerradas para "anon". Si cambias una tabla, cambia también este archivo.
//
// Las columnas "generadas" las calcula Postgres: aparecen en las filas leídas (Row), pero
// NUNCA se mandan al crear una fila (Insert); si se mandan, Postgres da error.
//
// Los números "numeric" de Postgres llegan desde Supabase como number.

/** Unidades que puede decir una etiqueta. La base convierte kg → g y l → ml. */
export type Unidad = "g" | "kg" | "ml" | "l" | "pza";
/** Unidad base para comparar (columna generada). */
export type UnidadBase = "g" | "ml" | "pza";

export type Confianza = "alta" | "media" | "baja";
export type CalidadEtiqueta = "legible" | "borrosa" | "reflejo" | "lejana" | "cortada";
export type EstadoLectura = "propuesta" | "por_revisar" | "aprobada" | "corregida" | "descartada";
export type PromoTipo =
  | "ninguna"
  | "precio_rebajado"
  | "n_por_precio"
  | "nxm"
  | "n_al_porcentaje"
  | "combo"
  | "mayoreo"
  | "otro";
export type PromoCondicion = "ninguna" | "tarjeta" | "monedero" | "app" | "dia_especifico" | "otro";

export type TipoLote = "lectura_fotos";
export type EstadoLote = "en_proceso" | "recogido" | "cancelado";

/** lotes_proceso: cada envío de fotos a leer en lote. */
export type LoteProceso = {
  id: string; // id que da Anthropic (msgbatch_...)
  tipo: TipoLote;
  modelo: string;
  estado: EstadoLote;
  total: number;
  ok: number;
  con_error: number;
  tokens_entrada: number;
  tokens_salida: number;
  costo_estimado_usd: number | null;
  created_at: string;
  recogido_at: string | null;
};

/** articulos_competencia: un artículo distinto visto en la competencia. */
export type ArticuloCompetencia = {
  id: number;
  marca: string | null;
  articulo: string;
  cantidad: number | null; // de UNA pieza
  unidad: Unidad | null;
  piezas: number;
  unidad_base: UnidadBase | null; // generada
  contenido_base: number | null; // generada: cantidad × piezas (× 1000 si kg o l)
  ean: string | null;
  clave_normalizada: string; // generada, única
  created_at: string;
};

export type NuevoArticuloCompetencia = Pick<ArticuloCompetencia, "articulo"> &
  Partial<Pick<ArticuloCompetencia, "marca" | "cantidad" | "unidad" | "piezas" | "ean">>;

/** lecturas_precio: un producto con precio visto en una foto. */
export type LecturaPrecio = {
  id: string;
  foto_id: string;
  orden_en_foto: number;
  articulo_competencia_id: number | null;
  articulo: string | null;
  marca: string | null;
  cantidad: number | null; // de UNA pieza
  unidad: Unidad | null;
  piezas: number;
  unidad_base: UnidadBase | null; // generada
  contenido_base: number | null; // generada
  ean: string | null;
  codigo_interno: string | null;
  /** Total que dice la etiqueta por la presentación completa (paquete de 6 → precio del paquete). */
  precio_regular: number | null;
  /** Generada: precio_regular ÷ piezas. */
  precio_regular_pieza: number | null;
  promo_tipo: PromoTipo;
  promo_piezas: number | null;
  promo_precio_total: number | null;
  promo_paga_piezas: number | null;
  promo_descuento_pct: number | null;
  promo_condicion: PromoCondicion;
  /** Generada: precio de promoción por pieza individual, según promo_tipo. */
  precio_promo_pieza: number | null;
  vigencia_fin: string | null; // fecha aaaa-mm-dd
  texto_promocion: string | null;
  texto_leido: string | null;
  calidad: CalidadEtiqueta | null;
  confianza_articulo: Confianza;
  confianza_presentacion: Confianza;
  confianza_precio: Confianza;
  motivo_duda: string | null;
  estado: EstadoLectura;
  /** Copia sin tocar de lo que respondió el agente. No se puede cambiar. */
  valores_agente: Record<string, unknown>;
  discrepancia: string | null;
  modelo: string;
  lote_id: string | null;
  revisada_por: string | null;
  revisada_at: string | null;
  created_at: string;
};

type ColumnasQueNoSeMandan =
  | "id"
  | "foto_id"
  | "unidad_base"
  | "contenido_base"
  | "precio_regular_pieza"
  | "precio_promo_pieza"
  | "created_at";

/** Un elemento de la lista p_lecturas de la función guardar_lecturas. */
export type LecturaParaGuardar = Omit<LecturaPrecio, ColumnasQueNoSeMandan>;

// ---------------------------------------------------------------------------
// 006: equivalencias y vista comparacion_precios (E2-4). Solo estructura: nada
// en el código las usa todavía (el método de equivalencias se decide en E2-7).
// ---------------------------------------------------------------------------

export type TipoEquivalencia = "mismo_articulo" | "otra_presentacion" | "sin_equivalente";
export type EstadoEquivalencia = "propuesta" | "aprobada" | "rechazada";

/** equivalencias: artículo de la competencia ↔ artículo nuestro. */
export type Equivalencia = {
  id: number;
  articulo_competencia_id: number;
  /** Clave de catalogo_propio (SIEMPRE texto). Nula solo si tipo = "sin_equivalente". */
  clave_propia: string | null;
  tipo: TipoEquivalencia;
  estado: EstadoEquivalencia;
  created_at: string;
  actualizado_at: string; // lo pone la base al cambiar la fila
};

/** Motivo por el que no hay precio por unidad (null = sí hay). */
export type MotivoSinPrecioUnidad =
  | "sin_contenido_competencia"
  | "sin_contenido_propio"
  | "unidades_distintas";

/** Una fila de la vista comparacion_precios (solo lectura). */
export type ComparacionPrecio = {
  fecha_observacion: string;
  fecha_origen: "captura_foto" | "visita";
  competidor_id: number;
  competidor: string;
  latitud: number | null;
  longitud: number | null;
  visita_id: string;
  foto_id: string;
  ruta: string;
  lectura_id: string;
  articulo_competencia_id: number;
  articulo: string | null;
  marca: string | null;
  ean: string | null;
  cantidad: number | null;
  unidad: Unidad | null;
  piezas: number;
  precio_regular_comp: number;
  promo_tipo: PromoTipo;
  texto_promocion: string | null;
  /** Informativo: NO entra al índice. */
  precio_promo_pieza_comp: number | null;
  estado_lectura: Extract<EstadoLectura, "propuesta" | "aprobada" | "corregida">;
  clave: string;
  descripcion: string;
  cantidad_propia: number | null;
  unidad_propia: Unidad | null;
  contenido_origen_propio: "archivo" | "manual" | "sin_dato";
  precio_regular_propio: number;
  fecha_corte_usada: string;
  corte_posterior: boolean;
  nacs_categoria: string | null;
  equivalencia_id: number;
  tipo_equivalencia: Exclude<TipoEquivalencia, "sin_equivalente">;
  base_indice: "precio_total" | "precio_por_unidad";
  /** Porcentaje. Positivo = nosotros más caros; negativo = más baratos. */
  indice_vs_competencia_pct: number;
  /** Índice entre −3 y +3. */
  en_linea: boolean;
  /** Solo mismo_articulo entra a promedios. */
  entra_a_promedios: boolean;
  unidad_comparacion: "100 g" | "100 ml" | "pieza" | null;
  precio_comp_por_unidad: number | null;
  precio_propio_por_unidad: number | null;
  motivo_sin_precio_unidad: MotivoSinPrecioUnidad | null;
};
