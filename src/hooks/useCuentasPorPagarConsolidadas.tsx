import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CuentaPorPagarConsolidada {
  id: string;
  tipo_transaccion: 'inventario' | 'egreso' | 'capex';
  proveedor_nombre: string | null;
  proveedor_telefono: string | null;
  proveedor_email: string | null;
  proveedor_rfc: string | null;
  descripcion: string;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_vencimiento: string | null;
  tipo_pago: string;
  metodo_pago: string | null;
  created_at: string;
  // Campos específicos por tipo
  producto_nombre?: string;
  categoria_activo?: string;
  subcuenta_id?: string | null;
  cuenta_codigo?: string | null;
}

export const useCuentasPorPagarConsolidadas = () => {
  return useQuery({
    queryKey: ["cuentas-por-pagar-consolidadas"],
    queryFn: async (): Promise<CuentaPorPagarConsolidada[]> => {
      const cuentasConsolidadas: CuentaPorPagarConsolidada[] = [];

      // 1. Obtener egresos con saldo pendiente
      const { data: egresos, error: egresosError } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gt("monto_pendiente", 0);

      if (egresosError) throw egresosError;

      if (egresos) {
        egresos.forEach(egreso => {
          cuentasConsolidadas.push({
            id: egreso.id,
            tipo_transaccion: 'egreso',
            proveedor_nombre: egreso.proveedor_nombre,
            proveedor_telefono: egreso.proveedor_telefono,
            proveedor_email: egreso.proveedor_email,
            proveedor_rfc: egreso.proveedor_rfc,
            descripcion: egreso.descripcion || `Egreso: ${egreso.tipo_egreso}`,
            monto_total: egreso.monto_total,
            monto_pagado: egreso.monto_pagado,
            monto_pendiente: egreso.monto_pendiente,
            fecha_vencimiento: egreso.fecha_vencimiento,
            tipo_pago: egreso.tipo_pago,
            metodo_pago: egreso.metodo_pago,
            created_at: egreso.created_at,
            subcuenta_id: egreso.subcuenta_id,
            cuenta_codigo: egreso.cuenta_codigo
          });
        });
      }

      // 2. Obtener inversiones CAPEX con saldo pendiente
      const { data: inversiones, error: inversionesError } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gt("monto_pendiente", 0);

      if (inversionesError) throw inversionesError;

      if (inversiones) {
        inversiones.forEach(inversion => {
          cuentasConsolidadas.push({
            id: inversion.id,
            tipo_transaccion: 'capex',
            proveedor_nombre: inversion.proveedor_nombre,
            proveedor_telefono: inversion.proveedor_telefono,
            proveedor_email: inversion.proveedor_email,
            proveedor_rfc: inversion.proveedor_rfc,
            descripcion: inversion.descripcion || `CAPEX: ${inversion.producto_nombre}`,
            monto_total: inversion.valor_total,
            monto_pagado: inversion.monto_pagado,
            monto_pendiente: inversion.monto_pendiente || 0,
            fecha_vencimiento: inversion.fecha_vencimiento,
            tipo_pago: inversion.tipo_pago,
            metodo_pago: inversion.metodo_pago,
            created_at: inversion.created_at,
            producto_nombre: inversion.producto_nombre,
            categoria_activo: inversion.categoria_activo,
            subcuenta_id: inversion.subcuenta_id,
            cuenta_codigo: inversion.cuenta_codigo
          });
        });
      }

      // 3. Obtener movimientos de inventario con saldo pendiente
      // Necesitamos buscar movimientos de tipo "compra" que tengan productos asociados con deuda pendiente
      const { data: movimientos, error: movimientosError } = await supabase
        .from("movimientos_inventario")
        .select(`
          *,
          productos (
            id,
            nombre,
            descripcion
          )
        `)
        .eq("tipo_movimiento", "compra");

      if (movimientosError) throw movimientosError;

      // Para el inventario, como no tenemos campos directos de monto_pendiente,
      // vamos a verificar si hay productos que se compraron pero quedaron a crédito
      // Esto requeriría que los movimientos de inventario también tengan información de pago
      // Por ahora, vamos a asumir que si queremos trackear inventario a crédito,
      // esto debería registrarse como un egreso tipo "inventario"

      // Ordenar por fecha de vencimiento
      cuentasConsolidadas.sort((a, b) => {
        if (!a.fecha_vencimiento && !b.fecha_vencimiento) return 0;
        if (!a.fecha_vencimiento) return 1;
        if (!b.fecha_vencimiento) return -1;
        return new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime();
      });

      return cuentasConsolidadas;
    }
  });
};

export const useAnalyticsCuentasPorPagarConsolidadas = () => {
  return useQuery({
    queryKey: ["analytics-cuentas-por-pagar-consolidadas"],
    queryFn: async () => {
      const { data: egresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gt("monto_pendiente", 0);

      const { data: inversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gt("monto_pendiente", 0);

      const todasCuentas = [
        ...(egresos || []).map(e => ({ ...e, tipo: 'egreso' as const })),
        ...(inversiones || []).map(i => ({ 
          ...i, 
          tipo: 'capex' as const,
          monto_total: i.valor_total,
          proveedor_nombre: i.proveedor_nombre
        }))
      ];

      const today = new Date();

      // Total pendiente
      const totalPendiente = todasCuentas.reduce((sum, c) => 
        sum + (c.monto_pendiente || 0), 0
      );

      // Proveedores únicos
      const proveedoresUnicos = new Set(
        todasCuentas.map(c => c.proveedor_nombre || 'Sin nombre')
      ).size;

      // Promedio de deuda
      const promedioDeuda = totalPendiente / (todasCuentas.length || 1);

      // Distribución por tipo de transacción
      const porTipo = todasCuentas.reduce((acc, cuenta) => {
        const tipo = cuenta.tipo;
        if (!acc[tipo]) {
          acc[tipo] = { monto: 0, cantidad: 0 };
        }
        acc[tipo].monto += cuenta.monto_pendiente || 0;
        acc[tipo].cantidad += 1;
        return acc;
      }, {} as Record<string, { monto: number; cantidad: number }>);

      const distribucionPorTipo = Object.entries(porTipo).map(([tipo, data]) => ({
        tipo: tipo === 'egreso' ? 'Egresos' : tipo === 'capex' ? 'Inversiones CAPEX' : 'Inventario',
        ...data
      }));

      // Agrupar por proveedor
      const porProveedor = todasCuentas.reduce((acc, cuenta) => {
        const proveedor = cuenta.proveedor_nombre || 'Sin nombre';
        if (!acc[proveedor]) {
          acc[proveedor] = { monto: 0, cantidad: 0 };
        }
        acc[proveedor].monto += cuenta.monto_pendiente || 0;
        acc[proveedor].cantidad += 1;
        return acc;
      }, {} as Record<string, { monto: number; cantidad: number }>);

      const cuentasPorProveedor = Object.entries(porProveedor)
        .map(([proveedor, data]) => ({ proveedor, ...data }))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 10);

      // Análisis de aging (días de vencimiento)
      const agingRanges = [
        { rango: '0-30 días', min: 0, max: 30 },
        { rango: '31-60 días', min: 31, max: 60 },
        { rango: '61-90 días', min: 61, max: 90 },
        { rango: '90+ días', min: 91, max: Infinity }
      ];

      const agingAnalysis = agingRanges.map(range => {
        const cuentasEnRango = todasCuentas.filter(c => {
          let diasVencimiento = 0;
          if (c.fecha_vencimiento) {
            const fechaVenc = new Date(c.fecha_vencimiento);
            diasVencimiento = Math.floor((today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            const fechaCreacion = new Date(c.created_at);
            diasVencimiento = Math.floor((today.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
          }
          return diasVencimiento >= range.min && diasVencimiento <= range.max;
        });
        
        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
          cantidad: cuentasEnRango.length
        };
      });

      // Tendencia mensual (últimos 6 meses)
      const mesesPasados = 6;
      const tendenciaMensual = [];
      
      for (let i = mesesPasados - 1; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        const year = fecha.getFullYear();
        const month = fecha.getMonth();
        
        const cuentasDelMes = todasCuentas.filter(cuenta => {
          const fechaCuenta = new Date(cuenta.created_at);
          return fechaCuenta.getFullYear() === year && fechaCuenta.getMonth() === month;
        });

        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        tendenciaMensual.push({
          mes: nombreMes,
          monto: cuentasDelMes.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0)
        });
      }

      return {
        totalPendiente,
        totalProveedores: proveedoresUnicos,
        promedioDeuda,
        distribucionPorTipo,
        cuentasPorProveedor,
        agingAnalysis,
        tendenciaMensual
      };
    }
  });
};
