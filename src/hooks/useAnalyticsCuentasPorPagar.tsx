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
}

export const useAnalyticsCuentasPorPagar = () => {
  return useQuery({
    queryKey: ["analytics-cuentas-por-pagar"],
    queryFn: async (): Promise<AnalyticsCuentasPorPagar> => {
      const { data: cuentas, error } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .gt("monto_pendiente", 0)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const today = new Date();
      
      // Calcular días de vencimiento
      const cuentasConDias: CuentaPorPagar[] = (cuentas || []).map(cuenta => {
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

      return {
        totalPendiente,
        totalProveedores: proveedoresUnicos,
        promedioDeuda,
        cuentasPorProveedor,
        agingAnalysis,
        tendenciaMensual
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
