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

export const useAnalyticsCuentasPorPagarConsolidadas = (periodo: "diario" | "mensual" | "anual" = "mensual") => {
  return useQuery({
    queryKey: ["analytics-cuentas-por-pagar-consolidadas", periodo],
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
        ...(egresos || []).map(e => ({ ...e, tipo: 'egreso' as const, updated_at: e.updated_at })),
        ...(inversiones || []).map(i => ({ 
          ...i, 
          tipo: 'capex' as const,
          monto_total: i.valor_total,
          proveedor_nombre: i.proveedor_nombre,
          updated_at: i.updated_at
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

      // Análisis de aging básico
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

      // Análisis de aging detallado (6 categorías)
      const agingRangesDetailed = [
        { rango: 'Sin vencimiento', min: null, max: null },
        { rango: 'Vencido 1-15 días', min: 1, max: 15 },
        { rango: 'Vencido 16-30 días', min: 16, max: 30 },
        { rango: 'Vencido 31-60 días', min: 31, max: 60 },
        { rango: 'Vencido 61-90 días', min: 61, max: 90 },
        { rango: 'Vencido +90 días', min: 91, max: Infinity }
      ];

      const agingAnalysisDetailed = agingRangesDetailed.map(range => {
        const cuentasEnRango = todasCuentas.filter(c => {
          // Caso especial: sin vencimiento
          if (range.min === null && range.max === null) {
            if (!c.fecha_vencimiento) return true;
            const fechaVenc = new Date(c.fecha_vencimiento);
            const dias = Math.floor((today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
            return dias < 0; // Aún no vence
          }
          
          if (!c.fecha_vencimiento) return false;
          
          const fechaVenc = new Date(c.fecha_vencimiento);
          const dias = Math.floor((today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
          return dias >= range.min! && dias <= range.max!;
        });
        
        return {
          rango: range.rango,
          monto: cuentasEnRango.reduce((sum, c) => sum + (c.monto_pendiente || 0), 0),
          cantidad: cuentasEnRango.length,
          min: range.min,
          max: range.max
        };
      });

      // Histórico de CxP (basado en asientos contables - cuenta 2101)
      const historicoCxP = [];
      const saldoActual = totalPendiente;
      
      const { data: detallesAsientos } = await supabase
        .from("detalle_asientos")
        .select(`
          debe,
          haber,
          cuenta_codigo,
          asientos_contables!inner(
            fecha,
            user_id
          )
        `)
        .eq("asientos_contables.user_id", (egresos && egresos.length > 0) ? egresos[0].user_id : "")
        .eq("cuenta_codigo", "2101")
        .order("asientos_contables(fecha)", { ascending: true });
      
      if (periodo === "diario") {
        const hoy = new Date();
        historicoCxP.push({
          fecha: hoy.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
          saldo: saldoActual
        });
      } else if (periodo === "mensual") {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const diaActual = hoy.getDate();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        
        let saldoInicioMes = 0;
        if (detallesAsientos) {
          for (const detalle of detallesAsientos) {
            const fechaAsiento = new Date((detalle as any).asientos_contables.fecha);
            if (fechaAsiento < primerDiaMes) {
              // Cuentas por pagar aumentan en HABER y disminuyen en DEBE
              saldoInicioMes += Number(detalle.haber || 0) - Number(detalle.debe || 0);
            }
          }
        }
        
        for (let dia = 1; dia <= diaActual; dia++) {
          const fechaDia = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
          fechaDia.setHours(23, 59, 59, 999);
          
          let saldoDia = saldoInicioMes;
          
          if (detallesAsientos) {
            for (const detalle of detallesAsientos) {
              const fechaAsiento = new Date((detalle as any).asientos_contables.fecha);
              if (fechaAsiento >= primerDiaMes && fechaAsiento <= fechaDia) {
                saldoDia += Number(detalle.haber || 0) - Number(detalle.debe || 0);
              }
            }
          }
          
          historicoCxP.push({
            fecha: fechaDia.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
            saldo: Math.max(0, saldoDia)
          });
        }
      } else if (periodo === "anual") {
        const hoy = new Date();
        const anioActual = hoy.getFullYear();
        const mesActual = hoy.getMonth();
        const inicioAno = new Date(anioActual, 0, 1);
        
        let saldoInicioAno = 0;
        if (detallesAsientos) {
          for (const detalle of detallesAsientos) {
            const fechaAsiento = new Date((detalle as any).asientos_contables.fecha);
            if (fechaAsiento < inicioAno) {
              saldoInicioAno += Number(detalle.haber || 0) - Number(detalle.debe || 0);
            }
          }
        }
        
        for (let mes = 0; mes <= mesActual; mes++) {
          const ultimoDiaMes = new Date(anioActual, mes + 1, 0);
          ultimoDiaMes.setHours(23, 59, 59, 999);
          
          let saldoMes = saldoInicioAno;
          
          if (detallesAsientos) {
            for (const detalle of detallesAsientos) {
              const fechaAsiento = new Date((detalle as any).asientos_contables.fecha);
              if (fechaAsiento >= inicioAno && fechaAsiento <= ultimoDiaMes) {
                saldoMes += Number(detalle.haber || 0) - Number(detalle.debe || 0);
              }
            }
          }
          
          historicoCxP.push({
            fecha: ultimoDiaMes.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
            saldo: Math.max(0, saldoMes)
          });
        }
      }

      // CxP por proveedor apilado por antigüedad
      const proveedoresMap = todasCuentas.reduce((acc, cuenta) => {
        const proveedor = cuenta.proveedor_nombre || 'Sin nombre';
        if (!acc[proveedor]) {
          acc[proveedor] = {
            sinVencimiento: 0,
            vencido1_15: 0,
            vencido16_30: 0,
            vencido31_60: 0,
            vencido61_90: 0,
            vencidoMas90: 0,
            total: 0
          };
        }
        
        const monto = cuenta.monto_pendiente || 0;
        
        // Calcular días de vencimiento
        let diasVencimiento = null;
        if (cuenta.fecha_vencimiento) {
          const fechaVenc = new Date(cuenta.fecha_vencimiento);
          diasVencimiento = Math.floor((today.getTime() - fechaVenc.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        if (diasVencimiento === null || diasVencimiento < 0) {
          acc[proveedor].sinVencimiento += monto;
        } else {
          if (diasVencimiento >= 1 && diasVencimiento <= 15) acc[proveedor].vencido1_15 += monto;
          else if (diasVencimiento >= 16 && diasVencimiento <= 30) acc[proveedor].vencido16_30 += monto;
          else if (diasVencimiento >= 31 && diasVencimiento <= 60) acc[proveedor].vencido31_60 += monto;
          else if (diasVencimiento >= 61 && diasVencimiento <= 90) acc[proveedor].vencido61_90 += monto;
          else acc[proveedor].vencidoMas90 += monto;
        }
        
        acc[proveedor].total += monto;
        return acc;
      }, {} as Record<string, any>);

      const cxpPorProveedorApilado = Object.entries(proveedoresMap)
        .map(([proveedor, data]) => ({ proveedor, ...data }))
        .sort((a, b) => b.total - a.total);

      // Vencimientos por proveedor (para selector)
      const proveedoresLista = Array.from(
        new Set(todasCuentas.map(c => c.proveedor_nombre).filter(Boolean))
      ).sort();

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
        agingAnalysisDetailed,
        historicoCxP,
        cxpPorProveedorApilado,
        proveedoresLista,
        todasCuentas,
        tendenciaMensual
      };
    }
  });
};
