// Tipos de TypeScript de las tablas de Supabase (escritos a mano).
// Deben coincidir con supabase/001_esquema.sql y las migraciones que le siguen
// (002_fotos_hora_captura.sql, 003_quitar_competidor_elegido_at.sql, 004_tablas_competencia.sql,
// 007_descartar_fotos.sql, 008_autenticacion.sql, 010_capturas_manuales.sql).
// Si cambias una tabla, cambia también este archivo.
//
// Las tablas nuevas de la Etapa 2 (lecturas, artículos de la competencia, lotes) NO
// están aquí: la app no puede verlas. Sus tipos viven en src/lib/etapa2/tipos.ts.
// capturas_manuales (010) SÍ está: es la captura manual que escribe la persona en la
// pantalla de la visita (src/lib/capturas.ts).
//
// Desde 008 se entra con correo y contraseña: la app usa el rol "authenticated".
//   Row    → cómo llega una fila al LEERLA
//   Insert → qué se manda al CREAR una fila (solo las columnas que la app puede llenar).
//            El dueño (visitas.usuario_id, fotos.subida_por) NO está: lo pone el servidor.
//   Update → qué puede CAMBIAR la app. Vacío a propósito, salvo en fotos: solo
//            descartada_at (quitar una foto pendiente de una visita propia; el admin, de
//            cualquiera). Nadie la puede restaurar así: el admin usa admin_restaurar_foto.
//            En capturas_manuales también solo descartada_at, y solo en filas propias.
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
        };
        Insert: {
          competidor_id: number;
          latitud?: number | null;
          longitud?: number | null;
          precision_metros?: number | null;
          ubicacion_at?: string | null;
        };
        Update: SinCambios;
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
         * Lo único que "anon" puede cambiar (007): quitar una foto 'pendiente' que no
         * esté quitada. El valor que se manda no importa: el servidor pone su hora.
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
          /** Contenido de UNA pieza, como dice la etiqueta. */
          cantidad: number;
          unidad: "g" | "kg" | "ml" | "l" | "pza";
          piezas: number;
          /** Calculadas por la base (mismas reglas que lecturas_precio). */
          unidad_base: "g" | "ml" | "pza";
          contenido_base: number;
          /** Precio regular del paquete completo, con impuestos. */
          precio_regular: number;
          marca: string | null;
          marca_de_lista: boolean;
          area: string | null;
          area_de_lista: boolean;
          promo_tipo: "ninguna" | "precio_rebajado" | "n_por_precio" | "nxm" | "otro";
          promo_piezas: number | null;
          promo_precio_total: number | null;
          promo_paga_piezas: number | null;
          promo_condicion: "ninguna" | "tarjeta" | "app" | "otro";
          observaciones: string | null;
          created_at: string;
          /** Hora (del servidor) en que su autor la quitó. null = vigente. */
          descartada_at: string | null;
        };
        /** Sin id, usuario_id, created_at, descartada_at ni las calculadas (no hay permiso). */
        Insert: {
          visita_id: string;
          articulo: string;
          cantidad: number;
          unidad: "g" | "kg" | "ml" | "l" | "pza";
          piezas: number;
          precio_regular: number;
          marca: string | null;
          marca_de_lista: boolean;
          area: string | null;
          area_de_lista: boolean;
          promo_tipo: "ninguna" | "precio_rebajado" | "n_por_precio" | "nxm" | "otro";
          promo_piezas: number | null;
          promo_precio_total: number | null;
          promo_paga_piezas: number | null;
          promo_condicion: "ninguna" | "tarjeta" | "app" | "otro";
          observaciones: string | null;
        };
        /** Solo quitar una fila propia. El servidor pone su hora. */
        Update: {
          descartada_at: string;
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
      /** Admin: vuelve a poner a la vista una foto quitada. */
      admin_restaurar_foto: { Args: { p_foto_id: string }; Returns: undefined };
      /** Admin: id y correo de cada cuenta (para mostrar quién creó cada visita). */
      admin_correos_usuarios: {
        Args: Record<PropertyKey, never>;
        Returns: { usuario_id: string; correo: string }[];
      };
      /**
       * 010: nombres para las sugerencias de la captura manual. Solo (tipo, valor):
       * áreas del catálogo (sin claves, precios ni descripciones) y marcas ya capturadas.
       */
      sugerencias_captura: {
        Args: Record<PropertyKey, never>;
        Returns: { tipo: "area" | "marca"; valor: string }[];
      };
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
