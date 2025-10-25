export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      accionistas: {
        Row: {
          activo: boolean
          created_at: string
          email: string | null
          id: string
          nombre: string
          porcentaje_participacion: number | null
          rfc: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre: string
          porcentaje_participacion?: number | null
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string
          porcentaje_participacion?: number | null
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asientos_contables: {
        Row: {
          created_at: string
          descripcion: string
          fecha: string
          id: string
          numero_asiento: string
          transaccion_ingreso_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          fecha?: string
          id?: string
          numero_asiento: string
          transaccion_ingreso_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          fecha?: string
          id?: string
          numero_asiento?: string
          transaccion_ingreso_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asientos_contables_transaccion_ingreso_id_fkey"
            columns: ["transaccion_ingreso_id"]
            isOneToOne: false
            referencedRelation: "transacciones_ingresos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          ciudad: string | null
          codigo_postal: string | null
          created_at: string
          direccion: string | null
          email: string | null
          estado: string | null
          id: string
          nombre: string
          rfc: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nombre: string
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nombre?: string
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cuentas: {
        Row: {
          codigo: string
          created_at: string
          estado_financiero: string
          grupo: string
          id: string
          nombre: string
          subgrupo: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          estado_financiero: string
          grupo: string
          id?: string
          nombre: string
          subgrupo: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          estado_financiero?: string
          grupo?: string
          id?: string
          nombre?: string
          subgrupo?: string
          updated_at?: string
        }
        Relationships: []
      }
      detalle_asientos: {
        Row: {
          asiento_id: string
          created_at: string
          cuenta_codigo: string
          debe: number | null
          descripcion: string | null
          haber: number | null
          id: string
          subcuenta_id: string | null
        }
        Insert: {
          asiento_id: string
          created_at?: string
          cuenta_codigo: string
          debe?: number | null
          descripcion?: string | null
          haber?: number | null
          id?: string
          subcuenta_id?: string | null
        }
        Update: {
          asiento_id?: string
          created_at?: string
          cuenta_codigo?: string
          debe?: number | null
          descripcion?: string | null
          haber?: number | null
          id?: string
          subcuenta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "detalle_asientos_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos_contables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_asientos_cuenta_codigo_fkey"
            columns: ["cuenta_codigo"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "detalle_asientos_subcuenta_id_fkey"
            columns: ["subcuenta_id"]
            isOneToOne: false
            referencedRelation: "subcuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamientos: {
        Row: {
          condiciones: string | null
          created_at: string
          cuenta_codigo: string | null
          descripcion: string | null
          estado: string
          fecha_inicio: string
          fecha_vencimiento: string
          id: string
          institucion_financiera: string
          monto_total: number
          nombre: string
          numero_cuenta: string | null
          plazo_meses: number
          saldo_actual: number
          saldo_inicial: number
          subcuenta_id: string | null
          tasa_interes: number
          tipo_credito: string
          updated_at: string
          user_id: string
        }
        Insert: {
          condiciones?: string | null
          created_at?: string
          cuenta_codigo?: string | null
          descripcion?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_vencimiento: string
          id?: string
          institucion_financiera: string
          monto_total: number
          nombre: string
          numero_cuenta?: string | null
          plazo_meses: number
          saldo_actual: number
          saldo_inicial: number
          subcuenta_id?: string | null
          tasa_interes: number
          tipo_credito: string
          updated_at?: string
          user_id: string
        }
        Update: {
          condiciones?: string | null
          created_at?: string
          cuenta_codigo?: string | null
          descripcion?: string | null
          estado?: string
          fecha_inicio?: string
          fecha_vencimiento?: string
          id?: string
          institucion_financiera?: string
          monto_total?: number
          nombre?: string
          numero_cuenta?: string | null
          plazo_meses?: number
          saldo_actual?: number
          saldo_inicial?: number
          subcuenta_id?: string | null
          tasa_interes?: number
          tipo_credito?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inversiones_capex: {
        Row: {
          anos_depreciacion: number
          categoria_activo: string
          comentarios: string | null
          created_at: string
          cuenta_codigo: string | null
          descripcion: string | null
          estado: string
          fecha_adquisicion: string
          fecha_baja: string | null
          fecha_inicio_depreciacion: string | null
          fecha_vencimiento: string | null
          id: string
          imagen_url: string | null
          metodo_pago: string | null
          monto_pagado: number
          monto_pendiente: number | null
          motivo_baja: string | null
          producto_nombre: string
          proveedor_email: string | null
          proveedor_nombre: string | null
          proveedor_rfc: string | null
          proveedor_telefono: string | null
          subcuenta_id: string | null
          tipo_pago: string
          updated_at: string
          user_id: string
          valor_depreciacion_anual: number | null
          valor_depreciacion_mensual: number | null
          valor_total: number
          valor_venta: number | null
        }
        Insert: {
          anos_depreciacion: number
          categoria_activo: string
          comentarios?: string | null
          created_at?: string
          cuenta_codigo?: string | null
          descripcion?: string | null
          estado?: string
          fecha_adquisicion?: string
          fecha_baja?: string | null
          fecha_inicio_depreciacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          imagen_url?: string | null
          metodo_pago?: string | null
          monto_pagado?: number
          monto_pendiente?: number | null
          motivo_baja?: string | null
          producto_nombre: string
          proveedor_email?: string | null
          proveedor_nombre?: string | null
          proveedor_rfc?: string | null
          proveedor_telefono?: string | null
          subcuenta_id?: string | null
          tipo_pago: string
          updated_at?: string
          user_id: string
          valor_depreciacion_anual?: number | null
          valor_depreciacion_mensual?: number | null
          valor_total: number
          valor_venta?: number | null
        }
        Update: {
          anos_depreciacion?: number
          categoria_activo?: string
          comentarios?: string | null
          created_at?: string
          cuenta_codigo?: string | null
          descripcion?: string | null
          estado?: string
          fecha_adquisicion?: string
          fecha_baja?: string | null
          fecha_inicio_depreciacion?: string | null
          fecha_vencimiento?: string | null
          id?: string
          imagen_url?: string | null
          metodo_pago?: string | null
          monto_pagado?: number
          monto_pendiente?: number | null
          motivo_baja?: string | null
          producto_nombre?: string
          proveedor_email?: string | null
          proveedor_nombre?: string | null
          proveedor_rfc?: string | null
          proveedor_telefono?: string | null
          subcuenta_id?: string | null
          tipo_pago?: string
          updated_at?: string
          user_id?: string
          valor_depreciacion_anual?: number | null
          valor_depreciacion_mensual?: number | null
          valor_total?: number
          valor_venta?: number | null
        }
        Relationships: []
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          costo_total: number
          costo_unitario: number
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          producto_id: string
          tipo_movimiento: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cantidad: number
          costo_total: number
          costo_unitario: number
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          producto_id: string
          tipo_movimiento: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cantidad?: number
          costo_total?: number
          costo_unitario?: number
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          producto_id?: string
          tipo_movimiento?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean | null
          cantidad_comprada: number | null
          cantidad_stock: number | null
          costo_unitario: number | null
          created_at: string | null
          cuenta_codigo: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          precio: number
          precio_venta: number | null
          subcuenta_id: string | null
          updated_at: string | null
          user_id: string | null
          valor_total_inventario: number | null
        }
        Insert: {
          activo?: boolean | null
          cantidad_comprada?: number | null
          cantidad_stock?: number | null
          costo_unitario?: number | null
          created_at?: string | null
          cuenta_codigo?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio: number
          precio_venta?: number | null
          subcuenta_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_total_inventario?: number | null
        }
        Update: {
          activo?: boolean | null
          cantidad_comprada?: number | null
          cantidad_stock?: number | null
          costo_unitario?: number | null
          created_at?: string | null
          cuenta_codigo?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio?: number
          precio_venta?: number | null
          subcuenta_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          valor_total_inventario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_subcuenta_id_fkey"
            columns: ["subcuenta_id"]
            isOneToOne: false
            referencedRelation: "subcuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_egresos: {
        Row: {
          activo: boolean | null
          created_at: string
          cuenta_contable: string
          descripcion: string | null
          es_recurrente: boolean | null
          id: string
          imagen_url: string | null
          nombre: string
          precio_promedio: number | null
          proveedor_principal: string | null
          subcuenta_id: string | null
          tipo: string
          total_transacciones: number | null
          ultima_compra: string | null
          unidad: string
          updated_at: string
          user_id: string | null
          variacion_precio: number | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          cuenta_contable: string
          descripcion?: string | null
          es_recurrente?: boolean | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio_promedio?: number | null
          proveedor_principal?: string | null
          subcuenta_id?: string | null
          tipo: string
          total_transacciones?: number | null
          ultima_compra?: string | null
          unidad: string
          updated_at?: string
          user_id?: string | null
          variacion_precio?: number | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          cuenta_contable?: string
          descripcion?: string | null
          es_recurrente?: boolean | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio_promedio?: number | null
          proveedor_principal?: string | null
          subcuenta_id?: string | null
          tipo?: string
          total_transacciones?: number | null
          ultima_compra?: string | null
          unidad?: string
          updated_at?: string
          user_id?: string | null
          variacion_precio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_productos_egresos_subcuenta"
            columns: ["subcuenta_id"]
            isOneToOne: false
            referencedRelation: "subcuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          ciudad: string | null
          codigo_postal: string | null
          created_at: string
          direccion: string | null
          email: string | null
          estado: string | null
          id: string
          nombre: string
          rfc: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nombre: string
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          ciudad?: string | null
          codigo_postal?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          nombre?: string
          rfc?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recomendaciones_depreciacion: {
        Row: {
          anos_maximos: number
          anos_minimos: number
          anos_recomendados: number
          categoria_activo: string
          created_at: string
          descripcion: string | null
          id: string
        }
        Insert: {
          anos_maximos: number
          anos_minimos: number
          anos_recomendados: number
          categoria_activo: string
          created_at?: string
          descripcion?: string | null
          id?: string
        }
        Update: {
          anos_maximos?: number
          anos_minimos?: number
          anos_recomendados?: number
          categoria_activo?: string
          created_at?: string
          descripcion?: string | null
          id?: string
        }
        Relationships: []
      }
      subcuentas: {
        Row: {
          created_at: string
          cuenta_madre_codigo: string
          id: string
          nombre: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          cuenta_madre_codigo: string
          id?: string
          nombre: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          cuenta_madre_codigo?: string
          id?: string
          nombre?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcuentas_cuenta_madre_codigo_fkey"
            columns: ["cuenta_madre_codigo"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      transacciones_capital: {
        Row: {
          accionista_id: string | null
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          monto: number
          socio: string
          tipo_movimiento: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accionista_id?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto: number
          socio: string
          tipo_movimiento: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accionista_id?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto?: number
          socio?: string
          tipo_movimiento?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transacciones_capital_accionista_id_fkey"
            columns: ["accionista_id"]
            isOneToOne: false
            referencedRelation: "accionistas"
            referencedColumns: ["id"]
          },
        ]
      }
      transacciones_egresos: {
        Row: {
          cantidad: number | null
          comentarios: string | null
          concepto: string | null
          created_at: string
          cuenta_codigo: string | null
          descripcion: string
          fecha_vencimiento: string | null
          id: string
          imagen_comprobante: string | null
          metodo_pago: string | null
          monto_pagado: number
          monto_pendiente: number | null
          monto_total: number
          precio_unitario: number | null
          producto_egreso_id: string | null
          proveedor_email: string | null
          proveedor_id: string | null
          proveedor_nombre: string | null
          proveedor_rfc: string | null
          proveedor_telefono: string | null
          subcuenta_id: string | null
          subtipo_egreso: string | null
          tipo_egreso: string
          tipo_pago: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cantidad?: number | null
          comentarios?: string | null
          concepto?: string | null
          created_at?: string
          cuenta_codigo?: string | null
          descripcion: string
          fecha_vencimiento?: string | null
          id?: string
          imagen_comprobante?: string | null
          metodo_pago?: string | null
          monto_pagado?: number
          monto_pendiente?: number | null
          monto_total: number
          precio_unitario?: number | null
          producto_egreso_id?: string | null
          proveedor_email?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          proveedor_rfc?: string | null
          proveedor_telefono?: string | null
          subcuenta_id?: string | null
          subtipo_egreso?: string | null
          tipo_egreso: string
          tipo_pago: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cantidad?: number | null
          comentarios?: string | null
          concepto?: string | null
          created_at?: string
          cuenta_codigo?: string | null
          descripcion?: string
          fecha_vencimiento?: string | null
          id?: string
          imagen_comprobante?: string | null
          metodo_pago?: string | null
          monto_pagado?: number
          monto_pendiente?: number | null
          monto_total?: number
          precio_unitario?: number | null
          producto_egreso_id?: string | null
          proveedor_email?: string | null
          proveedor_id?: string | null
          proveedor_nombre?: string | null
          proveedor_rfc?: string | null
          proveedor_telefono?: string | null
          subcuenta_id?: string | null
          subtipo_egreso?: string | null
          tipo_egreso?: string
          tipo_pago?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transacciones_egresos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      transacciones_financiamientos: {
        Row: {
          capital_pagado: number | null
          created_at: string
          descripcion: string | null
          fecha: string
          financiamiento_id: string
          id: string
          interes_pagado: number | null
          metodo_pago: string | null
          monto: number
          numero_referencia: string | null
          saldo_restante: number
          tipo_transaccion: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capital_pagado?: number | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          financiamiento_id: string
          id?: string
          interes_pagado?: number | null
          metodo_pago?: string | null
          monto: number
          numero_referencia?: string | null
          saldo_restante: number
          tipo_transaccion: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capital_pagado?: number | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          financiamiento_id?: string
          id?: string
          interes_pagado?: number | null
          metodo_pago?: string | null
          monto?: number
          numero_referencia?: string | null
          saldo_restante?: number
          tipo_transaccion?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transacciones_financiamientos_financiamiento_id_fkey"
            columns: ["financiamiento_id"]
            isOneToOne: false
            referencedRelation: "financiamientos"
            referencedColumns: ["id"]
          },
        ]
      }
      transacciones_impuestos: {
        Row: {
          ano: number
          created_at: string
          diferencia: number
          id: string
          isr_calculado: number
          isr_real: number
          mes: number
          observaciones: string | null
          tasa_isr: number
          updated_at: string
          user_id: string
          utilidad_antes_impuestos: number
        }
        Insert: {
          ano: number
          created_at?: string
          diferencia?: number
          id?: string
          isr_calculado?: number
          isr_real?: number
          mes: number
          observaciones?: string | null
          tasa_isr?: number
          updated_at?: string
          user_id: string
          utilidad_antes_impuestos?: number
        }
        Update: {
          ano?: number
          created_at?: string
          diferencia?: number
          id?: string
          isr_calculado?: number
          isr_real?: number
          mes?: number
          observaciones?: string | null
          tasa_isr?: number
          updated_at?: string
          user_id?: string
          utilidad_antes_impuestos?: number
        }
        Relationships: []
      }
      transacciones_ingresos: {
        Row: {
          cliente_email: string | null
          cliente_nombre: string | null
          cliente_rfc: string | null
          cliente_telefono: string | null
          comentarios: string | null
          created_at: string
          cuenta_principal_codigo: string
          descripcion: string
          fecha_vencimiento: string | null
          id: string
          metodo_pago: string
          monto_descuento: number | null
          monto_neto: number
          monto_pagado: number
          monto_pendiente: number | null
          monto_total: number
          subcuenta_id: string | null
          tipo_ingreso: string
          tipo_pago: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_email?: string | null
          cliente_nombre?: string | null
          cliente_rfc?: string | null
          cliente_telefono?: string | null
          comentarios?: string | null
          created_at?: string
          cuenta_principal_codigo: string
          descripcion: string
          fecha_vencimiento?: string | null
          id?: string
          metodo_pago: string
          monto_descuento?: number | null
          monto_neto: number
          monto_pagado: number
          monto_pendiente?: number | null
          monto_total: number
          subcuenta_id?: string | null
          tipo_ingreso: string
          tipo_pago: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_email?: string | null
          cliente_nombre?: string | null
          cliente_rfc?: string | null
          cliente_telefono?: string | null
          comentarios?: string | null
          created_at?: string
          cuenta_principal_codigo?: string
          descripcion?: string
          fecha_vencimiento?: string | null
          id?: string
          metodo_pago?: string
          monto_descuento?: number | null
          monto_neto?: number
          monto_pagado?: number
          monto_pendiente?: number | null
          monto_total?: number
          subcuenta_id?: string | null
          tipo_ingreso?: string
          tipo_pago?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_asiento_number: { Args: { p_user_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
