/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * bukipin-dashboard/src/integrations/supabase/types.ts
 *
 * ✅ SHIM DE MIGRACIÓN (SIN SUPABASE)
 * Este archivo existía porque Lovable/Supabase generaba tipos del esquema.
 *
 * Ahora que Bukipin usa backend propio (Node/Express + Mongo) y apiFetch(),
 * conservamos estos exports SOLO para que el frontend compile mientras
 * migramos módulos uno por uno.
 *
 * ⚠️ Importante:
 * - Si en algún lugar usabas Tables<"tabla"> para tipar rows, aquí devolverá "any".
 * - Cuando terminemos la migración, puedes eliminar este archivo y tipar por DTOs del backend.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Base “neutra” que conserva la forma esperada por Tables/TablesInsert/TablesUpdate,
 * pero sin depender de un schema real de Supabase.
 */
export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: any;
        Insert: any;
        Update: any;
        Relationships?: any[];
      }
    >;
    Views: Record<string, any>;
    Functions: Record<string, any>;
    Enums: Record<string, any>;
    CompositeTypes: Record<string, any>;
  };
};

/**
 * Helpers legacy (compatibilidad Lovable/Supabase)
 * - En Supabase devolvían tipos reales por tabla.
 * - En migración devolvemos "any" para no romper el build.
 */
export type Tables<
  _DefaultSchemaTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  _TableName extends _DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[_DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[_DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = any;

export type TablesInsert<
  _DefaultSchemaTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  _TableName extends _DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[_DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = any;

export type TablesUpdate<
  _DefaultSchemaTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  _TableName extends _DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[_DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = any;

export type Enums<
  _DefaultSchemaEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  _EnumName extends _DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[_DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = any;

export type CompositeTypes<
  _PublicCompositeTypeNameOrOptions extends
    | keyof Database["public"]["CompositeTypes"]
    | { schema: keyof Database },
  _CompositeTypeName extends _PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[_PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = any;

/**
 * Conservado por compatibilidad (Lovable lo generaba).
 */
export const Constants = {
  public: {
    Enums: {},
  },
} as const;
