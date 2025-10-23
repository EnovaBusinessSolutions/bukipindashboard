import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CuentaPorCobrar {
  id: string;
  cliente_nombre: string | null;
  monto_pendiente: number;
  monto_neto: number;
  monto_pagado: number;
  fecha_vencimiento: string | null;
  created_at: string;
  descripcion: string;
  dias_vencimiento?: number | null;
}

interface AnalyticsCuentasPorCobrar {
  totalPendiente: number;
  totalClientes: number;
  promedioDeuda: number;
  cuentasPorCliente: { cliente: string; monto: number; cantidad: number }[];
  agingAnalysis: { rango: string; monto: number; cantidad: number }[];
  tendenciaMensual: { mes: string; monto: number }[];
  agingAnalysisDetailed: { 
    rango: string; 
    monto: number; 
    cantidad: number;
    min: number;
    max: number;
  }[];
  historicoCxC: { fecha: string; saldo: number }[];
  cxcPorClienteApilado: {
    cliente: string;
    sinVencimiento: number;
    vencido1_15: number;
    vencido16_30: number;
    vencido31_60: number;
    vencido61_90: number;
    vencidoMas90: number;
    total: number;
  }[];
}

export const useAnalyticsCuentasPorCobrar = (periodo: "diario" | "mensual" | "anual" = "mensual") => {
  return useQuery({
    queryKey: ["analytics-cuentas-por-cobrar", periodo],
    queryFn: async (): Promise<AnalyticsCuentasPorCobrar> => {
      const { data: cuentas, error } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gt("monto_pendiente", 0)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const today = new Date();
      
      // Calcular días de vencimiento
      const cuentasConDias: CuentaPorCobrar[] = (cuentas || []).map(cuenta => {
        let diasVencimiento = null;
        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor((today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
        }
        // Si no hay fecha de vencimiento, dejamos diasVencimiento como null
        
        return {
          ...cuenta,
          dias_vencimiento: diasVencimiento
        };
      });

      // Calcular métricas generales
      const totalPendiente = cuentasConDias.reduce((sum, c) => sum + c.monto_pendiente, 0);
      const clientesUnicos = new Set(cuentasConDias.map(c => c.cliente_nombre || 'Sin nombre')).size;
      const promedioDeuda = totalPendiente / (cuentasConDias.length || 1);

      // Agrupar por cliente
      const porCliente = cuentasConDias.reduce((acc, cuenta) => {
        const cliente = cuenta.cliente_nombre || 'Sin nombre';
        if (!acc[cliente]) {
          acc[cliente] = { monto: 0, cantidad: 0 };
        }
        acc[cliente].monto += cuenta.monto_pendiente;
        acc[cliente].cantidad += 1;
        return acc;
      }, {} as Record<string, { monto: number; cantidad: number }>);

      const cuentasPorCliente = Object.entries(porCliente)
        .map(([cliente, data]) => ({ cliente, ...data }))
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
          c.dias_vencimiento !== null && c.dias_vencimiento >= range.min && c.dias_vencimiento <= range.max
        );
        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + c.monto_pendiente, 0),
          cantidad: cuentasEnRango.length
        };
      });

      // Análisis de aging detallado con 6 categorías
      const agingRangesDetailed = [
        { rango: 'Sin vencimiento', min: null, max: null },
        { rango: 'Vencido 1-15 días', min: 1, max: 15 },
        { rango: 'Vencido 16-30 días', min: 16, max: 30 },
        { rango: 'Vencido 31-60 días', min: 31, max: 60 },
        { rango: 'Vencido 61-90 días', min: 61, max: 90 },
        { rango: 'Vencido +90 días', min: 91, max: Infinity }
      ];

      const agingAnalysisDetailed = agingRangesDetailed.map(range => {
        const cuentasEnRango = cuentasConDias.filter(c => {
          // Caso especial: sin vencimiento (incluye cuentas sin fecha y las que aún no vencen)
          if (range.min === null && range.max === null) {
            return c.dias_vencimiento === null || (c.dias_vencimiento !== null && c.dias_vencimiento < 0);
          }
          // Si la cuenta no tiene días de vencimiento, no entra en rangos con fecha
          if (c.dias_vencimiento === null) return false;
          
          const dias = c.dias_vencimiento;
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

      // Histórico de CxC (saldo al cierre)
      const historicoCxC = [];
      
      if (periodo === "diario") {
        // Mostrar solo el día de hoy
        const hoy = new Date();
        const saldo = cuentasConDias.reduce((sum, c) => sum + c.monto_pendiente, 0);
        historicoCxC.push({
          fecha: hoy.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
          saldo
        });
      } else if (periodo === "mensual") {
        // Mostrar todos los días del mes actual
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Normalizar a inicio del día para comparaciones
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
        const diaActual = new Date().getDate();
        
        for (let dia = 1; dia <= Math.min(diasDelMes, diaActual); dia++) {
          const fechaDia = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
          fechaDia.setHours(23, 59, 59, 999);
          
          const esHoy = dia === diaActual;
          
          let saldo = 0;
          
          if (esHoy) {
            // Para hoy, usar el saldo actual (monto_pendiente)
            saldo = cuentasConDias
              .filter(c => new Date(c.created_at) <= fechaDia)
              .reduce((sum, c) => sum + c.monto_pendiente, 0);
          } else {
            // Para días pasados, calcular usando monto_neto de transacciones creadas hasta ese día
            // y restar los pagos estimados proporcionalmente
            const transaccionesHastaEseDia = cuentasConDias.filter(c => {
              const fechaCreacion = new Date(c.created_at);
              fechaCreacion.setHours(0, 0, 0, 0);
              return fechaCreacion <= fechaDia;
            });
            
            // Sumar monto_neto de todas las transacciones hasta ese día
            const totalNeto = transaccionesHastaEseDia.reduce((sum, c) => sum + c.monto_neto, 0);
            
            // Calcular pagos realizados antes de ese día (aproximación)
            // Asumimos distribución uniforme de pagos desde creación hasta hoy
            const pagosEstimados = transaccionesHastaEseDia.reduce((sum, c) => {
              const fechaCreacion = new Date(c.created_at);
              fechaCreacion.setHours(0, 0, 0, 0);
              
              // Si la transacción fue creada ese día o después, no hubo pagos aún
              if (fechaCreacion >= fechaDia) {
                return sum;
              }
              
              // Calcular días desde creación hasta ese día
              const diasDesdeCreacion = Math.floor((fechaDia.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
              const diasDesdeCreacionHastaHoy = Math.floor((hoy.getTime() - fechaCreacion.getTime()) / (1000 * 60 * 60 * 24));
              
              // Estimar pagos proporcionalmente
              if (diasDesdeCreacionHastaHoy > 0) {
                const proporcion = diasDesdeCreacion / diasDesdeCreacionHastaHoy;
                return sum + (c.monto_pagado * proporcion);
              }
              
              return sum;
            }, 0);
            
            saldo = totalNeto - pagosEstimados;
          }
          
          historicoCxC.push({
            fecha: fechaDia.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
            saldo: Math.max(0, saldo) // No permitir saldos negativos
          });
        }
      } else if (periodo === "anual") {
        // Mostrar enero a diciembre del año actual (solo hasta el mes actual)
        const hoy = new Date();
        const anioActual = hoy.getFullYear();
        const mesActual = hoy.getMonth(); // 0-11
        
        for (let mes = 0; mes <= mesActual; mes++) {
          // Último día del mes
          const ultimoDiaMes = new Date(anioActual, mes + 1, 0);
          ultimoDiaMes.setHours(23, 59, 59, 999);
          
          const esMesActual = mes === mesActual;
          
          let saldo = 0;
          
          if (esMesActual) {
            // Para el mes actual, usar el saldo actual
            saldo = cuentasConDias
              .filter(c => new Date(c.created_at) <= ultimoDiaMes)
              .reduce((sum, c) => sum + c.monto_pendiente, 0);
          } else {
            // Para meses pasados, calcular saldo histórico estimado
            const transaccionesHastaEseMes = cuentasConDias.filter(c => 
              new Date(c.created_at) <= ultimoDiaMes
            );
            
            const totalNeto = transaccionesHastaEseMes.reduce((sum, c) => sum + c.monto_neto, 0);
            
            // Estimar pagos hasta ese mes
            const pagosEstimados = transaccionesHastaEseMes.reduce((sum, c) => {
              const fechaCreacion = new Date(c.created_at);
              
              if (fechaCreacion >= ultimoDiaMes) {
                return sum;
              }
              
              const mesesDesdeCreacion = (ultimoDiaMes.getFullYear() - fechaCreacion.getFullYear()) * 12 + 
                                         (ultimoDiaMes.getMonth() - fechaCreacion.getMonth());
              const mesesDesdeCreacionHastaHoy = (hoy.getFullYear() - fechaCreacion.getFullYear()) * 12 + 
                                                  (hoy.getMonth() - fechaCreacion.getMonth());
              
              if (mesesDesdeCreacionHastaHoy > 0) {
                const proporcion = mesesDesdeCreacion / mesesDesdeCreacionHastaHoy;
                return sum + (c.monto_pagado * proporcion);
              }
              
              return sum;
            }, 0);
            
            saldo = totalNeto - pagosEstimados;
          }
          
          historicoCxC.push({
            fecha: ultimoDiaMes.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
            saldo: Math.max(0, saldo)
          });
        }
      }

      // CxC por cliente apilado con categorías de antigüedad
      const clientesMap = cuentasConDias.reduce((acc, cuenta) => {
        const cliente = cuenta.cliente_nombre || 'Sin nombre';
        if (!acc[cliente]) {
          acc[cliente] = {
            sinVencimiento: 0,
            vencido1_15: 0,
            vencido16_30: 0,
            vencido31_60: 0,
            vencido61_90: 0,
            vencidoMas90: 0,
            total: 0
          };
        }
        
        const monto = cuenta.monto_pendiente;
        
        // Si no tiene fecha de vencimiento o si aún no ha vencido
        if (cuenta.dias_vencimiento === null || cuenta.dias_vencimiento < 0) {
          acc[cliente].sinVencimiento += monto;
        } else {
          const dias = cuenta.dias_vencimiento;
          if (dias >= 1 && dias <= 15) acc[cliente].vencido1_15 += monto;
          else if (dias >= 16 && dias <= 30) acc[cliente].vencido16_30 += monto;
          else if (dias >= 31 && dias <= 60) acc[cliente].vencido31_60 += monto;
          else if (dias >= 61 && dias <= 90) acc[cliente].vencido61_90 += monto;
          else acc[cliente].vencidoMas90 += monto;
        }
        
        acc[cliente].total += monto;
        return acc;
      }, {} as Record<string, any>);

      const cxcPorClienteApilado = Object.entries(clientesMap)
        .map(([cliente, data]) => ({ cliente, ...data }))
        .sort((a, b) => b.total - a.total);

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
        totalClientes: clientesUnicos,
        promedioDeuda,
        cuentasPorCliente,
        agingAnalysis,
        tendenciaMensual,
        agingAnalysisDetailed,
        historicoCxC,
        cxcPorClienteApilado
      };
    }
  });
};

export const useCuentasPorCobrarDetalle = () => {
  return useQuery({
    queryKey: ["cuentas-por-cobrar-detalle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_ingresos")
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
          else if (diasVencimiento >= 1) estado = 'Vencida';
          else if (diasVencimiento < 0) estado = 'Por vencer';
        } else {
          // Si no hay fecha de vencimiento
          diasVencimiento = 0;
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