import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CuentaPorPagar {
  id: string;
  proveedor_nombre: string | null;
  monto_pendiente: number;
  fecha_vencimiento: string | null;
  created_at: string;
  descripcion: string;
  dias_vencimiento?: number;
}

interface AnalyticsCuentasPorPagar {
  totalPendiente: number;
  totalProveedores: number;
  promedioDeuda: number;
  cuentasPorProveedor: { proveedor: string; monto: number; cantidad: number }[];
  agingAnalysis: { rango: string; monto: number; cantidad: number }[];
  tendenciaMensual: { mes: string; monto: number }[];
  agingAnalysisDetailed: { 
    rango: string; 
    monto: number; 
    cantidad: number;
    min: number | null;
    max: number | null;
  }[];
  historicoCxP: { fecha: string; saldo: number }[];
  cxpPorProveedorApilado: {
    proveedor: string;
    sinVencimiento: number;
    vencido1_15: number;
    vencido16_30: number;
    vencido31_60: number;
    vencido61_90: number;
    vencidoMas90: number;
    total: number;
  }[];
}

export const useAnalyticsCuentasPorPagar = (
  periodo: "mensual" | "anual" = "mensual",
  filtroProveedor?: string
) => {
  return useQuery({
    queryKey: ["analytics-cuentas-por-pagar", periodo, filtroProveedor],
    queryFn: async (): Promise<AnalyticsCuentasPorPagar> => {
      // Obtener CxP de transacciones_egresos
      const { data: cuentasEgresos, error: errorEgresos } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gt("monto_pendiente", 0)
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (errorEgresos) throw errorEgresos;

      // Obtener CxP de inversiones_capex (activos comprados a crédito)
      const { data: cuentasInversiones, error: errorInversiones } = await supabase
        .from("inversiones_capex")
        .select("*")
        .gt("monto_pendiente", 0)
        .in("estado", ["activo", "vendido"])
        .order("created_at", { ascending: false });

      if (errorInversiones) throw errorInversiones;

      // Unificar ambas fuentes en un formato común
      const cuentas = [
        ...(cuentasEgresos || []),
        ...(cuentasInversiones || []).map(inv => ({
          id: inv.id,
          proveedor_nombre: inv.proveedor_nombre,
          monto_pendiente: inv.monto_pendiente || 0,
          fecha_vencimiento: inv.fecha_vencimiento,
          created_at: inv.created_at,
          descripcion: inv.producto_nombre,
          user_id: inv.user_id
        }))
      ];

      const today = new Date();
      
      // Calcular días de vencimiento
      const cuentasConDias: CuentaPorPagar[] = cuentas.map(cuenta => {
        let diasVencimiento = 0;
        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor((today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // Si no hay fecha de vencimiento, calcular desde la fecha de creación
          const fechaCreacion = new Date(cuenta.created_at);
          diasVencimiento = Math.floor((today.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        return {
          ...cuenta,
          dias_vencimiento: diasVencimiento
        };
      });

      // Calcular métricas generales
      const totalPendiente = cuentasConDias.reduce((sum, c) => sum + c.monto_pendiente, 0);
      const proveedoresUnicos = new Set(cuentasConDias.map(c => c.proveedor_nombre || 'Sin nombre')).size;
      const promedioDeuda = totalPendiente / (cuentasConDias.length || 1);

      // Agrupar por proveedor
      const porProveedor = cuentasConDias.reduce((acc, cuenta) => {
        const proveedor = cuenta.proveedor_nombre || 'Sin nombre';
        if (!acc[proveedor]) {
          acc[proveedor] = { monto: 0, cantidad: 0 };
        }
        acc[proveedor].monto += cuenta.monto_pendiente;
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
        const cuentasEnRango = cuentasConDias.filter(c => 
          (c.dias_vencimiento || 0) >= range.min && (c.dias_vencimiento || 0) <= range.max
        );
        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + c.monto_pendiente, 0),
          cantidad: cuentasEnRango.length
        };
      });

      // Tendencia por mes (últimos 6 meses)
      const mesesPasados = 6;
      const tendenciaMensual = [];
      
      for (let i = mesesPasados - 1; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        const year = fecha.getFullYear();
        const month = fecha.getMonth();
        
        const cuentasDelMes = cuentasConDias.filter(cuenta => {
          const fechaCuenta = new Date(cuenta.created_at);
          return fechaCuenta.getFullYear() === year && fechaCuenta.getMonth() === month;
        });

        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        tendenciaMensual.push({
          mes: nombreMes,
          monto: cuentasDelMes.reduce((sum, c) => sum + c.monto_pendiente, 0)
        });
      }

      // Análisis de aging detallado (6 categorías)
      const agingRangesDetailed = [
        { rango: 'Sin vencimiento', min: null, max: 0 },
        { rango: 'Vencido 1-15 días', min: 1, max: 15 },
        { rango: 'Vencido 16-30 días', min: 16, max: 30 },
        { rango: 'Vencido 31-60 días', min: 31, max: 60 },
        { rango: 'Vencido 61-90 días', min: 61, max: 90 },
        { rango: 'Vencido +90 días', min: 91, max: null }
      ];

      const agingAnalysisDetailed = agingRangesDetailed.map(range => {
        const cuentasEnRango = cuentasConDias.filter(c => {
          const dias = c.dias_vencimiento || 0;
          if (range.min === null) return dias <= (range.max || 0);
          if (range.max === null) return dias >= range.min;
          return dias >= range.min && dias <= range.max;
        });
        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + c.monto_pendiente, 0),
          cantidad: cuentasEnRango.length,
          min: range.min,
          max: range.max
        };
      });

      // Histórico de CxP (basado en periodo) - Incluir cuentas 2001 y 2002
      const { data: asientos } = await supabase
        .from("detalle_asientos")
        .select("*, asientos_contables!inner(fecha)")
        .in("cuenta_codigo", ["2001", "2002"])
        .order("asientos_contables(fecha)", { ascending: true });

      const historicoCxP: { fecha: string; saldo: number }[] = [];
      
      if (periodo === "mensual") {
        // Últimos 30 días
        for (let i = 29; i >= 0; i--) {
          const fecha = new Date();
          fecha.setDate(fecha.getDate() - i);
          const fechaStr = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          
          const saldo = (asientos || [])
            .filter(a => new Date(a.asientos_contables.fecha) <= fecha)
            .reduce((sum, a) => sum + (a.haber || 0) - (a.debe || 0), 0);
          
          historicoCxP.push({ fecha: fechaStr, saldo });
        }
      } else {
        // Últimos 12 meses
        for (let i = 11; i >= 0; i--) {
          const fecha = new Date();
          fecha.setMonth(fecha.getMonth() - i);
          const fechaStr = fecha.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
          
          const saldo = (asientos || [])
            .filter(a => {
              const asientoDate = new Date(a.asientos_contables.fecha);
              return asientoDate <= new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
            })
            .reduce((sum, a) => sum + (a.haber || 0) - (a.debe || 0), 0);
          
          historicoCxP.push({ fecha: fechaStr, saldo });
        }
      }

      // CxP por proveedor apilado por antigüedad
      const proveedoresUnique = Array.from(new Set(cuentasConDias.map(c => c.proveedor_nombre || 'Sin nombre')));
      const cxpPorProveedorApilado = proveedoresUnique
        .map(proveedor => {
          const cuentasProveedor = cuentasConDias.filter(c => (c.proveedor_nombre || 'Sin nombre') === proveedor);
          
          const sinVencimiento = cuentasProveedor
            .filter(c => (c.dias_vencimiento || 0) <= 0)
            .reduce((sum, c) => sum + c.monto_pendiente, 0);
          
          const vencido1_15 = cuentasProveedor
            .filter(c => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 1 && dias <= 15;
            })
            .reduce((sum, c) => sum + c.monto_pendiente, 0);
          
          const vencido16_30 = cuentasProveedor
            .filter(c => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 16 && dias <= 30;
            })
            .reduce((sum, c) => sum + c.monto_pendiente, 0);
          
          const vencido31_60 = cuentasProveedor
            .filter(c => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 31 && dias <= 60;
            })
            .reduce((sum, c) => sum + c.monto_pendiente, 0);
          
          const vencido61_90 = cuentasProveedor
            .filter(c => {
              const dias = c.dias_vencimiento || 0;
              return dias >= 61 && dias <= 90;
            })
            .reduce((sum, c) => sum + c.monto_pendiente, 0);
          
          const vencidoMas90 = cuentasProveedor
            .filter(c => (c.dias_vencimiento || 0) >= 91)
            .reduce((sum, c) => sum + c.monto_pendiente, 0);
          
          const total = sinVencimiento + vencido1_15 + vencido16_30 + vencido31_60 + vencido61_90 + vencidoMas90;
          
          return {
            proveedor,
            sinVencimiento,
            vencido1_15,
            vencido16_30,
            vencido31_60,
            vencido61_90,
            vencidoMas90,
            total
          };
        })
        .filter(p => p.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      // Aplicar filtro de proveedor si existe
      let agingAnalysisFiltered = agingAnalysisDetailed;
      if (filtroProveedor && filtroProveedor !== 'todos') {
        const cuentasFiltradas = cuentasConDias.filter(c => 
          (c.proveedor_nombre || 'Sin nombre') === filtroProveedor
        );
        
        agingAnalysisFiltered = agingRangesDetailed.map(range => {
          const cuentasEnRango = cuentasFiltradas.filter(c => {
            const dias = c.dias_vencimiento || 0;
            if (range.min === null) return dias <= (range.max || 0);
            if (range.max === null) return dias >= range.min;
            return dias >= range.min && dias <= range.max;
          });
          return {
            rango: range.rango,
            monto: cuentasEnRango.reduce((sum, c) => sum + c.monto_pendiente, 0),
            cantidad: cuentasEnRango.length,
            min: range.min,
            max: range.max
          };
        });
      }

      return {
        totalPendiente,
        totalProveedores: proveedoresUnicos,
        promedioDeuda,
        cuentasPorProveedor,
        agingAnalysis,
        tendenciaMensual,
        agingAnalysisDetailed: agingAnalysisFiltered,
        historicoCxP,
        cxpPorProveedorApilado
      };
    }
  });
};

export const useCuentasPorPagarDetalle = () => {
  return useQuery({
    queryKey: ["cuentas-por-pagar-detalle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gt("monto_pendiente", 0)
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const today = new Date();
      
      return (data || []).map(cuenta => {
        let diasVencimiento = 0;
        let estado = 'Al día';
        
        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor((today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diasVencimiento > 90) estado = 'Muy vencida';
          else if (diasVencimiento > 30) estado = 'Vencida';
          else if (diasVencimiento > 0) estado = 'Por vencer';
        } else {
          // Si no hay fecha de vencimiento, calcular desde la fecha de creación
          const fechaCreacion = new Date(cuenta.created_at);
          diasVencimiento = Math.floor((today.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
          estado = 'Sin fecha límite';
        }
        
        return {
          ...cuenta,
          diasVencimiento,
          estado
        };
      });
    }
  });
};
