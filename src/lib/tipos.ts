// Tipos de TypeScript de las tablas de Supabase (escritos a mano).
// Deben coincidir con supabase/001_esquema.sql y las migraciones que le siguen
// (002_fotos_hora_captura.sql, 003_quitar_competidor_elegido_at.sql, 004_tablas_competencia.sql).
// Si cambias una tabla, cambia también este archivo.
//
// Las tablas nuevas de la Etapa 2 (lecturas, artículos de la competencia, lotes) NO
// están aquí: la app no puede verlas. Sus tipos viven en src/lib/etapa2/tipos.ts.
//
//   Row    → cómo llega una fila al LEERLA
//   Insert → qué se manda al CREAR una fila (solo las columnas que "anon" puede llenar)
//   Update → vacío a propósito: "anon" no puede cambiar nada
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
        };
        Insert: {
          visita_id: string;
          ruta: string;
          nombre_original?: string | null;
          tamano_bytes?: number | null;
          capturada_at?: string | null;
          capturada_origen?: OrigenCaptura;
        };
        Update: SinCambios;
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
    };
    Views: SinCambios;
    Functions: SinCambios;
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

// Nombre del bucket de Storage donde viven las fotos.
export const BUCKET_FOTOS = "fotos";
