import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface VentaProductoMensual {
  producto: string;
  mes: string;
  mesNumero: number;
  volumen: number;
  monto: number;
  tarifaPromedio: number;
}

interface VentasPorMes {
  mes: string;
  mesNumero: number;
  [producto: string]: number | string; // volumen/monto por cada producto (keys dinámicas)
}

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

const safeNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const useVentasProductos = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["ventas-productos"],
    enabled,
    queryFn: async () => {
      // Año actual en rango ISO (igual que tu lógica original)
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

      // Endpoint sugerido:
      // GET /api/movimientos-inventario?tipo_movimiento=venta&from=ISO&to=ISO&include_producto=true
      const json = await apiFetch(
        `/api/movimientos-inventario?tipo_movimiento=venta&from=${encodeURIComponent(
          startOfYear.toISOString()
        )}&to=${encodeURIComponent(endOfYear.toISOString())}&include_producto=true`,
        { method: "GET" }
      );

      const movimientos = unwrap<any[]>(json) || [];

      // Agrupar por producto y mes
      const ventasPorProductoYMes = new Map<string, VentaProductoMensual>();
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

      movimientos.forEach((mov: any) => {
        const createdAt = mov?.created_at || mov?.fecha || mov?.createdAt;
        if (!createdAt) return;

        const fecha = new Date(createdAt);
        if (Number.isNaN(fecha.getTime())) return;

        const mesNumero = fecha.getMonth();
        const mesKey = meses[mesNumero];

        // Soportar 2 shapes:
        // A) { producto: { nombre, precio_venta } }
        // B) { producto_nombre, producto_precio_venta }
        const productoNombre =
          mov?.producto?.nombre ||
          mov?.productos?.nombre || // compat si backend devolviera "productos"
          mov?.producto_nombre ||
          "Sin nombre";

        const precioVenta =
          safeNumber(mov?.producto?.precio_venta) ||
          safeNumber(mov?.productos?.precio_venta) ||
          safeNumber(mov?.producto_precio_venta) ||
          0;

        // En Supabase “cantidad” venía negativa en ventas, aquí lo normalizamos
        const volumen = Math.abs(safeNumber(mov?.cantidad));
        const monto = volumen * precioVenta;

        const key = `${productoNombre}-${mesKey}`;

        if (ventasPorProductoYMes.has(key)) {
          const existing = ventasPorProductoYMes.get(key)!;
          existing.volumen += volumen;
          existing.monto += monto;
          existing.tarifaPromedio = existing.volumen > 0 ? existing.monto / existing.volumen : 0;
        } else {
          ventasPorProductoYMes.set(key, {
            producto: productoNombre,
            mes: mesKey,
            mesNumero,
            volumen,
            monto,
            tarifaPromedio: precioVenta,
          });
        }
      });

      // Convertir a array y ordenar por producto y mes
      const ventasArray = Array.from(ventasPorProductoYMes.values()).sort((a, b) => {
        if (a.producto !== b.producto) return a.producto.localeCompare(b.producto);
        return a.mesNumero - b.mesNumero;
      });

      // Estructura para gráficas: agrupar por mes
      const ventasPorMesMap = new Map<string, VentasPorMes>();

      ventasArray.forEach((venta) => {
        if (!ventasPorMesMap.has(venta.mes)) {
          ventasPorMesMap.set(venta.mes, {
            mes: venta.mes,
            mesNumero: venta.mesNumero,
          });
        }
        const mesData = ventasPorMesMap.get(venta.mes)!;

        // Mantengo exactamente el naming del original
        mesData[`${venta.producto}_volumen`] = venta.volumen;
        mesData[`${venta.producto}_monto`] = venta.monto;
      });

      const ventasPorMes = Array.from(ventasPorMesMap.values()).sort(
        (a, b) => Number(a.mesNumero) - Number(b.mesNumero)
      );

      return {
        ventasDetalladas: ventasArray,
        ventasPorMes,
        productos: Array.from(new Set(ventasArray.map((v) => v.producto))),
      };
    },
  });
};
