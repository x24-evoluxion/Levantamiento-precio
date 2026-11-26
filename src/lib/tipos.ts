// Tipos de TypeScript de las tablas de Supabase (escritos a mano).
// Deben coincidir con supabase/001_esquema.sql y las migraciones que le siguen
// (002_fotos_hora_captura.sql, 003_quitar_competidor_elegido_at.sql, 004_tablas_competencia.sql,
// 007_descartar_fotos.sql, 008_autenticacion.sql, 010_capturas_manuales.sql,
// 011_captura_rapida.sql, 012_editar_borrar.sql, 013_admin_visitas.sql).
// Si cambias una tabla, cambia también este archivo.
//
// Las tablas nuevas de la Etapa 2 (lecturas, artículos de la competencia, lotes) NO
// están aquí: la app no puede verlas. Sus tipos viven en src/lib/etapa2/tipos.ts.
// capturas_manuales (010, simplificada en 011) SÍ está: es la captura rápida que escribe
// la persona en la pantalla de la visita (src/lib/capturas.ts).
//
// Desde 008 se entra con correo y contraseña: la app usa el rol "authenticated".
//   Row    → cómo llega una fila al LEERLA
//   Insert → qué se manda al CREAR una fila (solo las columnas que la app puede llenar).
//            El dueño (visitas.usuario_id, fotos.subida_por) NO está: lo pone el servidor.
//   Update → qué puede CAMBIAR la app (permisos por columna; BORRAR = poner descartada_at,
//            nunca DELETE). fotos: solo descartada_at (campo: pendientes de sus visitas; admin:
//            cualquiera, 012). visitas (012): tienda y descartada_at. capturas_manuales (012):
//            los 4 campos del formulario, articulo_de_lista y descartada_at. Restaurar (null)
//            solo lo deja la base al admin.
//   Functions → funciones de la base que la app puede llamar con supabase.rpc(). Las
//            admin_* revisan en la base que quien llama sea admin (si no, error 42501).
//
// Las fechas (timestamptz) llegan como texto ISO en UTC, ej. "2026-11-18T17:05:00+00:00".

import type { OrigenCaptura } from "./exif";

/** Estado de procesamiento de una foto (Etapa 2, 004). Lo escribe solo el proceso del servidor. */
export type EstadoProcesoFoto = "pendiente" | "en_lote" | "procesada" | "error";
/** Calidad de la foto según la lectura (Etapa 2, 004). */
export type CalidadFoto = "legible" | "borrosa" | "reflejo" | "lejana" | "sin_precios";

type SinCambios = { [_ in never]: never };

export type Database = {
  public: {
    Tables: {
      competidores: {
        Row: {
          id: number;
          nombre: string;
          activo: boolean;
          orden: number;
          created_at: string;
        };
        Insert: SinCambios;
        Update: SinCambios;
        Relationships: [];
      };
      visitas: {
        Row: {
          id: string;
          competidor_id: number;
          latitud: number | null;
          longitud: number | null;
          precision_metros: number | null;
          ubicacion_at: string | null;
          created_at: string;
          /** 008: quién creó la visita. null = visita de antes del login (o cuenta borrada). */
          usuario_id: string | null;
          /**
           * 012: hora (del servidor) en que se BORRÓ (descartó). null = a la vista.
           * El personal de campo nunca recibe visitas borradas (la base las esconde).
           */
          descartada_at: string | null;
          /**
           * 013: último cambio de la visita (tienda, borrar, restaurar, dueño o ubicación).
           * Los pone un trigger (hora del servidor y auth.uid()); null = nunca se cambió, o
           * actualizado_por null = se cambió desde el panel. La app no los puede mandar.
           */
          actualizado_at: string | null;
          actualizado_por: string | null;
          /** 013: última corrección de ubicación (admin). null = la del celular. */
          ubicacion_corregida_at: string | null;
          ubicacion_corregida_por: string | null;
          /**
           * 013: la ubicación que guardó el celular, copiada en la PRIMERA corrección y
           * nunca más cambiada. Vacías si no se ha corregido o si no tenía ubicación.
           */
          ubicacion_original_latitud: number | null;
          ubicacion_original_longitud: number | null;
          ubicacion_original_precision_metros: number | null;
          ubicacion_original_at: string | null;
        };
        Insert: {
          competidor_id: number;
          latitud?: number | null;
          longitud?: number | null;
          precision_metros?: number | null;
          ubicacion_at?: string | null;
        };
        /**
         * 012: cambiar la tienda o borrar (descartada_at). El dueño, solo en SU visita no
         * borrada y sin fotos leídas; el admin, en cualquiera, y restaura (null). La tienda
         * nueva debe estar activa. Nunca usuario_id, ubicación ni created_at (013: el dueño
         * y la ubicación solo los cambia el admin con admin_reasignar_visita y
         * admin_corregir_ubicacion).
         */
        Update: {
          competidor_id?: number;
          descartada_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "visitas_competidor_id_fkey";
            columns: ["competidor_id"];
            isOneToOne: false;
            referencedRelation: "competidores";
            referencedColumns: ["id"];
          },
        ];
      };
      fotos: {
        Row: {
          id: string;
          visita_id: string;
          ruta: string;
          nombre_original: string | null;
          tamano_bytes: number | null;
          /** Hora en que se TOMÓ la foto (EXIF). null si no se pudo leer. */
          capturada_at: string | null;
          capturada_origen: OrigenCaptura;
          created_at: string;
          // Etapa 2 (004): solo lectura para la app; las llena el proceso del servidor.
          estado_proceso: EstadoProcesoFoto;
          calidad: CalidadFoto | null;
          motivo_calidad: string | null;
          lote_id: string | null;
          intentos: number;
          error_proceso: string | null;
          procesada_at: string | null;
          /**
           * 007: hora (del servidor) en que alguien quitó la foto desde la app.
           * null = a la vista. La app solo lee fotos con null.
           */
          descartada_at: string | null;
          /** 008: quién subió la foto. null = foto de antes del login (o cuenta borrada). */
          subida_por: string | null;
        };
        Insert: {
          visita_id: string;
          ruta: string;
          nombre_original?: string | null;
          tamano_bytes?: number | null;
          capturada_at?: string | null;
          capturada_origen?: OrigenCaptura;
        };
        /**
         * Lo único que la app puede cambiar: descartada_at. Campo: quitar fotos 'pendiente'
         * de sus visitas (008). Admin (012): quitar cualquier foto; restaurar con
         * admin_restaurar_foto. La hora la pone el servidor.
         */
        Update: {
          descartada_at: string;
        };
        Relationships: [
          {
            foreignKeyName: "fotos_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
      capturas_manuales: {
        Row: {
          id: string;
          visita_id: string;
          /** Quién la escribió (lo pone el servidor). null = cuenta borrada. */
          usuario_id: string | null;
          articulo: string;
          /** 011: true solo si el artículo es EXACTAMENTE una sugerencia elegida de la lista. */
          articulo_de_lista: boolean;
          /**
           * Presentación (formulario de 010). Desde 011 es opcional: las filas de la
           * captura rápida la tienen vacía (cantidad y unidad null, piezas 1).
           * Contenido de UNA pieza, como dice la etiqueta.
           */
          cantidad: number | null;
          unidad: "g" | "kg" | "ml" | "l" | "pza" | null;
          piezas: number | null;
          /** Calculadas por la base (mismas reglas que lecturas_precio). null sin presentación. */
          unidad_base: "g" | "ml" | "pza" | null;
          contenido_base: number | null;
          /** Precio regular con impuestos (en filas de 010, del paquete completo). */
          precio_regular: number;
          /** 011: precio de promoción POR PIEZA (opcional). "2 x $42" → 21. */
          promo_precio_pieza: number | null;
          /** Formulario de 010 (la captura rápida no los llena). */
          marca: string | null;
          marca_de_lista: boolean;
          area: string | null;
          area_de_lista: boolean;
          promo_tipo: "ninguna" | "precio_rebajado" | "n_por_precio" | "nxm" | "otro";
          promo_piezas: number | null;
          promo_precio_total: number | null;
          promo_paga_piezas: number | null;
          promo_condicion: "ninguna" | "tarjeta" | "app" | "otro";
          /** Hasta 500 letras (011). */
          observaciones: string | null;
          created_at: string;
          /** Hora (del servidor) en que se borró. null = vigente. Solo el admin ve las borradas. */
          descartada_at: string | null;
          /** 012: última edición, borrado o restauración (los pone un trigger). */
          actualizado_at: string | null;
          actualizado_por: string | null;
        };
        /**
         * Lo que manda la captura rápida (011). Sin id, usuario_id, created_at,
         * descartada_at ni las calculadas (no hay permiso). Las columnas del formulario
         * de 010 se pueden mandar, pero la app ya no lo hace.
         */
        Insert: {
          visita_id: string;
          articulo: string;
          articulo_de_lista: boolean;
          precio_regular: number;
          promo_precio_pieza: number | null;
          observaciones: string | null;
          cantidad?: number | null;
          unidad?: "g" | "kg" | "ml" | "l" | "pza" | null;
          piezas?: number | null;
          marca?: string | null;
          marca_de_lista?: boolean;
          area?: string | null;
          area_de_lista?: boolean;
          promo_tipo?: "ninguna" | "precio_rebajado" | "n_por_precio" | "nxm" | "otro";
          promo_piezas?: number | null;
          promo_precio_total?: number | null;
          promo_paga_piezas?: number | null;
          promo_condicion?: "ninguna" | "tarjeta" | "app" | "otro";
        };
        /**
         * 012: editar o borrar (descartada_at). El dueño, solo sus filas no borradas; el
         * admin, cualquiera, y restaura (null). El servidor pone la hora del borrado y
         * actualizado_at / actualizado_por. Nunca usuario_id, visita_id ni created_at.
         */
        Update: {
          articulo?: string;
          articulo_de_lista?: boolean;
          precio_regular?: number;
          promo_precio_pieza?: number | null;
          observaciones?: string | null;
          descartada_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "capturas_manuales_visita_id_fkey";
            columns: ["visita_id"];
            isOneToOne: false;
            referencedRelation: "visitas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: SinCambios;
    Functions: {
      /** true si quien llama es admin (app_metadata.rol = 'admin' en su JWT). */
      es_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      /** Admin: corrige la tienda de una visita (solo a un competidor activo). */
      admin_cambiar_competidor: {
        Args: { p_visita_id: string; p_competidor_id: number };
        Returns: undefined;
      };
      /** 013 Admin: pasa la visita a otra cuenta existente (si no existe: 22023). */
      admin_reasignar_visita: {
        Args: { p_visita_id: string; p_usuario_id: string };
        Returns: undefined;
      };
      /**
       * 013 Admin: corrige la ubicación (en rango; si no: 22023). La original del celular
       * se conserva y queda quién corrigió. Visita inexistente: P0002.
       */
      admin_corregir_ubicacion: {
        Args: { p_visita_id: string; p_latitud: number; p_longitud: number; p_precision_metros?: number | null };
        Returns: undefined;
      };
      /** Admin: vuelve a poner a la vista una foto quitada. */
      admin_restaurar_foto: { Args: { p_foto_id: string }; Returns: undefined };
      /** Admin: id y correo de cada cuenta (para mostrar quién creó cada visita). */
      admin_correos_usuarios: {
        Args: Record<PropertyKey, never>;
        Returns: { usuario_id: string; correo: string }[];
      };
      /**
       * 010: nombres para las sugerencias del formulario anterior. Solo (tipo, valor):
       * áreas del catálogo (sin claves, precios ni descripciones) y marcas ya capturadas.
       * Desde 011 la app ya no la usa (se queda en la base para la versión publicada).
       */
      sugerencias_captura: {
        Args: Record<PropertyKey, never>;
        Returns: { tipo: "area" | "marca"; valor: string }[];
      };
      /**
       * 011: descripciones de los artículos propios activos (sin servicios), distintas y
       * ordenadas, en UN solo valor (un arreglo): así la API no lo corta en 1,000 filas.
       * Solo la descripción: nunca claves, precios ni ventas.
       */
      articulos_captura: { Args: Record<PropertyKey, never>; Returns: string[] };
    };
    Enums: SinCambios;
    CompositeTypes: SinCambios;
  };
};

// Atajos para usar en los componentes.
type Tablas = Database["public"]["Tables"];
export type Competidor = Tablas["competidores"]["Row"];
export type Visita = Tablas["visitas"]["Row"];
export type NuevaVisita = Tablas["visitas"]["Insert"];
export type Foto = Tablas["fotos"]["Row"];
export type NuevaFoto = Tablas["fotos"]["Insert"];
export type CapturaManual = Tablas["capturas_manuales"]["Row"];
export type NuevaCapturaManual = Tablas["capturas_manuales"]["Insert"];

// Nombre del bucket de Storage donde viven las fotos.
export const BUCKET_FOTOS = "fotos";
