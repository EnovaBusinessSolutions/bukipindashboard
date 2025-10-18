import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SaldosBalance {
  // Activos Circulantes
  caja: number;
  bancos: number;
  cuentasPorCobrar: number;
  inventario: number;
  
  // Activos Fijos
  activosFijos: number;
  
  // Pasivos Circulantes
  proveedores: number;
  
  // Pasivos Largo Plazo
  financiamientos: number;
  
  // Capital Contable
  capitalSocial: number;
  utilidadesRetenidas: number;
  
  // Resultados
  ingresos: number;
  costos: number;
  gastos: number;
  utilidad: number;
}

export const useBalanceGeneral = () => {
  return useQuery({
    queryKey: ["balance-general-completo"],
    queryFn: async (): Promise<SaldosBalance> => {
      // 1. CAJA (1001) - Pagos en efectivo
      const { data: ingresosEfectivo } = await supabase
        .from('transacciones_ingresos')
        .select('monto_pagado')
        .eq('metodo_pago', 'efectivo');

      const { data: egresosEfectivo } = await supabase
        .from('transacciones_egresos')
        .select('monto_pagado')
        .eq('metodo_pago', 'efectivo');

      const caja = (ingresosEfectivo?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0) -
                   (egresosEfectivo?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0);

      // 2. BANCOS (1002) - Pagos por transferencia/tarjeta
      const { data: ingresosBanco } = await supabase
        .from('transacciones_ingresos')
        .select('monto_pagado')
        .in('metodo_pago', ['transferencia', 'tarjeta']);

      const { data: egresosBanco } = await supabase
        .from('transacciones_egresos')
        .select('monto_pagado')
        .in('metodo_pago', ['transferencia', 'tarjeta', 'tarjeta-transferencia']);

      // Obtener aportaciones de capital (aumentan efectivo/bancos)
      const { data: aportaciones } = await supabase
        .from('transacciones_capital')
        .select('monto')
        .eq('tipo_movimiento', 'aportacion');

      const totalAportaciones = aportaciones?.reduce((sum, t) => sum + (Number(t.monto) || 0), 0) || 0;

      // Obtener dividendos pagados (disminuyen efectivo/bancos)
      const { data: dividendos } = await supabase
        .from('transacciones_capital')
        .select('monto')
        .eq('tipo_movimiento', 'dividendo');

      const totalDividendos = dividendos?.reduce((sum, t) => sum + (Number(t.monto) || 0), 0) || 0;

      const bancos = (ingresosBanco?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0) -
                     (egresosBanco?.reduce((sum, t) => sum + (t.monto_pagado || 0), 0) || 0) +
                     totalAportaciones - totalDividendos;

      // 3. CUENTAS POR COBRAR (1003) - Monto pendiente de ingresos
      const { data: cuentasCobrar } = await supabase
        .from('transacciones_ingresos')
        .select('monto_pendiente')
        .gt('monto_pendiente', 0);

      const cuentasPorCobrar = cuentasCobrar?.reduce((sum, t) => sum + (t.monto_pendiente || 0), 0) || 0;

      // 4. INVENTARIO (1005) - Valor total del inventario
      const { data: inventarioData } = await supabase
        .from('productos')
        .select('valor_total_inventario');

      const inventario = inventarioData?.reduce((sum, p) => sum + (p.valor_total_inventario || 0), 0) || 0;

      // 5. PROVEEDORES/CUENTAS POR PAGAR (2001) - Monto pendiente de egresos
      const { data: cuentasPagar } = await supabase
        .from('transacciones_egresos')
        .select('monto_pendiente')
        .gt('monto_pendiente', 0);

      const proveedores = cuentasPagar?.reduce((sum, t) => sum + (t.monto_pendiente || 0), 0) || 0;

      // 5B. ACTIVOS FIJOS - Inversiones CAPEX
      const { data: inversionesData } = await supabase
        .from('inversiones_capex')
        .select('valor_total, valor_depreciacion_anual, fecha_adquisicion');

      let activosFijos = 0;
      if (inversionesData) {
        activosFijos = inversionesData.reduce((sum, inv) => {
          const valorTotal = inv.valor_total || 0;
          const depreciacionAnual = inv.valor_depreciacion_anual || 0;
          const fechaAdquisicion = new Date(inv.fecha_adquisicion);
          const hoy = new Date();
          const añosTranscurridos = (hoy.getTime() - fechaAdquisicion.getTime()) / (1000 * 60 * 60 * 24 * 365);
          const depreciacionAcumulada = depreciacionAnual * añosTranscurridos;
          const valorNeto = valorTotal - depreciacionAcumulada;
          return sum + Math.max(0, valorNeto);
        }, 0);
      }

      // 5C. FINANCIAMIENTOS - Pasivos Largo Plazo
      const { data: financiamientosData } = await supabase
        .from('financiamientos')
        .select('saldo_actual')
        .eq('estado', 'activo');

      const financiamientos = financiamientosData?.reduce((sum, f) => sum + (f.saldo_actual || 0), 0) || 0;

      // 6. INGRESOS (4xxx) - Total de ingresos
      const { data: ingresosData } = await supabase
        .from('transacciones_ingresos')
        .select('monto_neto');

      const ingresos = ingresosData?.reduce((sum, t) => sum + (t.monto_neto || 0), 0) || 0;

      // 7. COSTOS (5001-5099) - Total de costos
      const { data: costosData } = await supabase
        .from('transacciones_egresos')
        .select('monto_total')
        .eq('tipo_egreso', 'costo');

      const costos = costosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

      // 8. GASTOS (5100-5999) - Total de gastos
      const { data: gastosData } = await supabase
        .from('transacciones_egresos')
        .select('monto_total')
        .eq('tipo_egreso', 'gasto');

      const gastos = gastosData?.reduce((sum, t) => sum + (t.monto_total || 0), 0) || 0;

      // 9. UTILIDAD DEL EJERCICIO
      const utilidad = ingresos - (costos + gastos);

      // 10. CAPITAL SOCIAL - Suma de todas las aportaciones
      const capitalSocial = totalAportaciones;

      // 11. UTILIDADES RETENIDAS - Utilidad menos dividendos distribuidos
      const utilidadesRetenidas = utilidad - totalDividendos;

      return {
        caja,
        bancos,
        cuentasPorCobrar,
        inventario,
        activosFijos,
        proveedores,
        financiamientos,
        capitalSocial,
        utilidadesRetenidas,
        ingresos,
        costos,
        gastos,
        utilidad
      };
    }
  });
};
