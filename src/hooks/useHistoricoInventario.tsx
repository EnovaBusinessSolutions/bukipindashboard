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
  fecha?: string; // YYYY-MM-DD o ISO
  createdAt?: string; // ISO
  tipo_movimiento?: "compra" | "venta" | "ajuste";
  tipoMovimiento?: "compra" | "venta" | "ajuste";

  cantidad: number | string;

  costo_total?: number | string | null;
  costoTotal?: number | string | null;

  costo_unitario?: number | string | null;
  costoUnitario?: number | string | null;

  producto_id?: string | null;
  productoId?: string | null;

  estado?: string;
};

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;

const unwrap = <T,>(json: ApiEnvelope<T>): T => {
  return (json as any)?.data ?? (json as T);
};

const num = (v: any) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const pickFecha = (m: MovimientoInventario): string | null => {
  const raw = m.fecha ?? m.createdAt ?? null;
  if (!raw) return null;
  return String(raw);
};

const pickTipo = (m: MovimientoInventario): "compra" | "venta" | "ajuste" | null => {
  const t = (m.tipo_movimiento ?? m.tipoMovimiento ?? null) as any;
  if (t === "compra" || t === "venta" || t === "ajuste") return t;
  return null;
};

const pickCostoTotal = (m: MovimientoInventario) => num(m.costo_total ?? m.costoTotal ?? 0);
const pickCostoUnitario = (m: MovimientoInventario) => num(m.costo_unitario ?? m.costoUnitario ?? 0);

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

      // ✅ Soporta ambos nombres para no romper compat
      if (productoId && productoId !== "total") {
        params.set("productoId", productoId);
        params.set("producto_id", productoId);
      }

      const json = await apiFetch(`/api/inventario/movimientos/historico?${params.toString()}`, {
        method: "GET",
      });

      const movimientos = (unwrap<MovimientoInventario[]>(json) || []).filter((m) => {
        // si backend manda estado, respetamos; si no, lo asumimos activo
        const st = (m as any)?.estado ?? "activo";
        return st === "activo";
      });

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

      for (const movimiento of movimientos) {
        const fechaRaw = pickFecha(movimiento);
        const tipo = pickTipo(movimiento);
        if (!fechaRaw || !tipo) continue;

        let fecha: Date;
        try {
          // parseISO aguanta YYYY-MM-DD y ISO, pero mejor envolvemos por seguridad
          fecha = parseISO(fechaRaw);
          if (Number.isNaN(fecha.getTime())) fecha = new Date(fechaRaw);
        } catch {
          fecha = new Date(fechaRaw);
        }
        if (Number.isNaN(fecha.getTime())) continue;

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

        const cantidad = num(movimiento.cantidad);
        const costoTotal = pickCostoTotal(movimiento);
        const costoUnitario = pickCostoUnitario(movimiento);

        if (tipo === "compra") {
          movimientosPorPeriodo[periodoKey].compras += cantidad;
          movimientosPorPeriodo[periodoKey].compras_valor += costoTotal;
        } else if (tipo === "venta") {
          movimientosPorPeriodo[periodoKey].ventas += cantidad;
          movimientosPorPeriodo[periodoKey].ventas_valor += cantidad * costoUnitario;
        } else if (tipo === "ajuste") {
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
      }

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
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
