import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  format,
  startOfMonth,
  parseISO,
  startOfYear,
  eachDayOfInterval,
  endOfMonth,
  eachMonthOfInterval,
  endOfYear,
} from "date-fns";
import { es } from "date-fns/locale";

export type DatoHistoricoMes = {
  mes: string;
  stock: number;
  compras: number;
  ventas: number;
  stock_valor: number;
  compras_valor: number;
  ventas_valor: number;
};

type Periodo = "mensual" | "anual";

type MovimientoInventario = {
  fecha: string; // YYYY-MM-DD
  tipo_movimiento: "compra" | "venta" | "ajuste";
  cantidad: number | string;
  costo_total: number | string | null;
  costo_unitario: number | string | null;
  producto_id?: string | null;
  estado?: string;
};

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;

const unwrap = <T,>(json: ApiEnvelope<T>): T => {
  return (json as any)?.data ?? (json as T);
};

export const useHistoricoInventario = (productoId: string | null, periodo: Periodo = "anual") => {
  return useQuery({
    queryKey: ["historico-inventario", productoId, periodo],
    queryFn: async (): Promise<DatoHistoricoMes[]> => {
      // Determinar fecha de inicio según período
      const fechaInicio = periodo === "mensual" ? startOfMonth(new Date()) : startOfYear(new Date());

      // NOTA: si productoId === "total" o null -> no filtramos
      const params = new URLSearchParams();
      params.set("periodo", periodo);
      params.set("from", format(fechaInicio, "yyyy-MM-dd"));
      if (productoId && productoId !== "total") params.set("productoId", productoId);

      const json = await apiFetch(`/api/inventario/movimientos/historico?${params.toString()}`, {
        method: "GET",
      });

      const movimientos = unwrap<MovimientoInventario[]>(json) || [];

      // Generar todos los períodos según el tipo seleccionado
      let todosPeriodos: DatoHistoricoMes[];

      if (periodo === "mensual") {
        const diasDelMes = eachDayOfInterval({
          start: startOfMonth(new Date()),
          end: endOfMonth(new Date()),
        });

        todosPeriodos = diasDelMes.map((dia) => ({
          mes: format(dia, "dd MMM", { locale: es }),
          stock: 0,
          compras: 0,
          ventas: 0,
          stock_valor: 0,
          compras_valor: 0,
          ventas_valor: 0,
        }));
      } else {
        const mesesDelAno = eachMonthOfInterval({
          start: startOfYear(new Date()),
          end: endOfYear(new Date()),
        });

        todosPeriodos = mesesDelAno.map((mes) => ({
          mes: format(mes, "MMM yyyy", { locale: es }),
          stock: 0,
          compras: 0,
          ventas: 0,
          stock_valor: 0,
          compras_valor: 0,
          ventas_valor: 0,
        }));
      }

      // Agrupar movimientos por período
      const movimientosPorPeriodo: Record<string, DatoHistoricoMes> = {};

      movimientos.forEach((movimiento) => {
        const fecha = parseISO(movimiento.fecha);

        const periodoKey =
          periodo === "mensual"
            ? format(fecha, "dd MMM", { locale: es })
            : format(startOfMonth(fecha), "MMM yyyy", { locale: es });

        if (!movimientosPorPeriodo[periodoKey]) {
          movimientosPorPeriodo[periodoKey] = {
            mes: periodoKey,
            stock: 0,
            compras: 0,
            ventas: 0,
            stock_valor: 0,
            compras_valor: 0,
            ventas_valor: 0,
          };
        }

        const cantidad = Number(movimiento.cantidad) || 0;
        const costoTotal = Number(movimiento.costo_total) || 0;
        const costoUnitario = Number(movimiento.costo_unitario) || 0;

        if (movimiento.tipo_movimiento === "compra") {
          movimientosPorPeriodo[periodoKey].compras += cantidad;
          movimientosPorPeriodo[periodoKey].compras_valor += costoTotal;
        } else if (movimiento.tipo_movimiento === "venta") {
          movimientosPorPeriodo[periodoKey].ventas += cantidad;
          movimientosPorPeriodo[periodoKey].ventas_valor += cantidad * costoUnitario;
        } else if (movimiento.tipo_movimiento === "ajuste") {
          // Ajuste positivo = entra stock (lo tratamos como compra)
          if (cantidad > 0) {
            movimientosPorPeriodo[periodoKey].compras += cantidad;
            movimientosPorPeriodo[periodoKey].compras_valor += costoTotal;
          } else {
            // Ajuste negativo = sale stock (lo tratamos como venta)
            const abs = Math.abs(cantidad);
            movimientosPorPeriodo[periodoKey].ventas += abs;
            movimientosPorPeriodo[periodoKey].ventas_valor += abs * costoUnitario;
          }
        }
      });

      // Combinar todos los períodos con los movimientos
      const datosHistoricos = todosPeriodos.map((p) => movimientosPorPeriodo[p.mes] || p);

      // Calcular stock acumulado
      let stockAcumulado = 0;
      let stockValorAcumulado = 0;

      datosHistoricos.forEach((dato) => {
        stockAcumulado += dato.compras - dato.ventas;
        stockValorAcumulado += dato.compras_valor - dato.ventas_valor;
        dato.stock = stockAcumulado;
        dato.stock_valor = stockValorAcumulado;
      });

      return datosHistoricos;
    },
    enabled: true, // Siempre habilitado para soportar "total"
  });
};
