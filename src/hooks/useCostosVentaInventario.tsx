import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface DetalleAsiento {
  cuenta_codigo: string;
  cuenta_nombre: string | null;
  debe: number;
  haber: number;
  descripcion: string | null;
}

interface CostoVentaInventario {
  id: string;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  monto: number;
  numero_asiento: string;
  producto_nombre: string;
  producto_imagen: string | null;
  cantidad: number | null;
  costo_unitario: number | null;
  detalles_asiento: DetalleAsiento[];
}

type AsientoRow = {
  id: string;
  numero_asiento: string;
  descripcion: string | null;
  fecha: string; // YYYY-MM-DD
  created_at?: string;
  detalle_asientos?: Array<{
    id?: string;
    cuenta_codigo: string;
    debe: number | null;
    haber: number | null;
    descripcion: string | null;
  }>;
};

type CuentaRow = { codigo: string; nombre: string };

type MovimientoInventarioRow = {
  id: string;
  cantidad: number | null;
  producto_id: string | null;
  costo_total: number | null;
  fecha: string; // YYYY-MM-DD
  descripcion: string | null;
};

type ProductoRow = {
  id: string;
  nombre: string;
  imagen_url: string | null;
};

type EgresoRow = {
  descripcion: string;
  producto_egreso_id: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  monto_total: number | null;
  created_at: string; // ISO
};

type ProductoEgresoRow = {
  id: string;
  nombre: string;
  imagen_url: string | null;
};

// Helper: redondear a 2 decimales
const redondear = (num: number) => Math.round(num * 100) / 100;

const toISODate = (d: Date) => d.toISOString().split("T")[0];

const getRange = (
  periodFilter?: "diario" | "mensual" | "anual",
  fechaDiaria?: Date,
  fechaMensual?: Date
) => {
  if (periodFilter === "diario" && fechaDiaria) {
    const day = toISODate(fechaDiaria);
    return { start: day, end: day };
  }

  if (periodFilter === "mensual" && fechaMensual) {
    const y = fechaMensual.getFullYear();
    const m = fechaMensual.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    return { start: toISODate(first), end: toISODate(last) };
  }

  if (periodFilter === "anual") {
    const y = new Date().getFullYear();
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }

  // default: sin filtro -> año actual (para no reventar payload infinito)
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
};

export const useCostosVentaInventario = (
  periodFilter?: "diario" | "mensual" | "anual",
  fechaDiaria?: Date,
  fechaMensual?: Date
) => {
  return useQuery({
    queryKey: ["costos-venta-inventario", periodFilter, fechaDiaria, fechaMensual],
    queryFn: async (): Promise<CostoVentaInventario[]> => {
      const { start, end } = getRange(periodFilter, fechaDiaria, fechaMensual);

      // 1) Asientos (con detalle_asientos) en rango
      // Endpoint esperado:
      // GET /api/asientos?start=YYYY-MM-DD&end=YYYY-MM-DD&include_detalles=1
      const asientosJson = await apiFetch(
        `/api/asientos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&include_detalles=1`,
        { method: "GET" }
      );
      const asientos: AsientoRow[] = (asientosJson as any)?.data ?? asientosJson ?? [];

      if (!asientos || asientos.length === 0) return [];

      // 2) Cuentas (mapa codigo->nombre)
      // Endpoint esperado:
      // GET /api/cuentas
      const cuentasJson = await apiFetch(`/api/cuentas`, { method: "GET" });
      const cuentas: CuentaRow[] = (cuentasJson as any)?.data ?? cuentasJson ?? [];
      const cuentasMap = new Map((cuentas || []).map((c) => [c.codigo, c.nombre]));

      // 3) Movimientos inventario venta en rango (para matchear por fecha + monto + descripción)
      // Endpoint esperado:
      // GET /api/inventario/movimientos?tipo_movimiento=venta&estado=activo&start=YYYY-MM-DD&end=YYYY-MM-DD
      const movJson = await apiFetch(
        `/api/inventario/movimientos?tipo_movimiento=venta&estado=activo&start=${encodeURIComponent(
          start
        )}&end=${encodeURIComponent(end)}`,
        { method: "GET" }
      );
      const movimientos: MovimientoInventarioRow[] = (movJson as any)?.data ?? movJson ?? [];

      // 4) Egresos en rango (para fallback productos_egresos)
      // Endpoint esperado:
      // GET /api/egresos?start=ISO&end=ISO&estado=activo&fields=descripcion,producto_egreso_id,cantidad,precio_unitario,monto_total,created_at
      const startISO = new Date(`${start}T00:00:00.000Z`).toISOString();
      const endISO = new Date(`${end}T23:59:59.999Z`).toISOString();

      const egresosJson = await apiFetch(
        `/api/egresos?estado=activo&start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(
          endISO
        )}&fields=descripcion,producto_egreso_id,cantidad,precio_unitario,monto_total,created_at`,
        { method: "GET" }
      );
      const egresos: EgresoRow[] = (egresosJson as any)?.data ?? egresosJson ?? [];

      // Filtrar asientos que tengan 5002 (Costo de Venta Inventario) con debe > 0
      const candidatos = (asientos || []).filter((as) =>
        (as.detalle_asientos || []).some(
          (d) => d.cuenta_codigo === "5002" && Number(d.debe ?? 0) > 0
        )
      );

      if (candidatos.length === 0) return [];

      // Matcheo previo: armamos mapa de movimientos por fecha para acelerar búsquedas
      const movimientosPorFecha = new Map<string, MovimientoInventarioRow[]>();
      (movimientos || []).forEach((m) => {
        const f = m.fecha;
        if (!movimientosPorFecha.has(f)) movimientosPorFecha.set(f, []);
        movimientosPorFecha.get(f)!.push(m);
      });

      // También agrupamos egresos por descripción para fallback
      const egresosPorDescripcion = new Map<string, EgresoRow[]>();
      (egresos || []).forEach((e) => {
        const desc = (e.descripcion || "").trim();
        if (!desc) return;
        if (!egresosPorDescripcion.has(desc)) egresosPorDescripcion.set(desc, []);
        egresosPorDescripcion.get(desc)!.push(e);
      });

      // Vamos construyendo costosVenta y recolectando IDs de productos para batch fetch
      const costosIntermedios: Array<{
        asiento: AsientoRow;
        detalleCosto: NonNullable<AsientoRow["detalle_asientos"]>[number];
        producto_id_inventario?: string | null;
        producto_egreso_id?: string | null;
        productoNombreInferido: string;
        cantidad: number | null;
        costoUnitario: number | null;
        productoImagen: string | null;
      }> = [];

      for (const asiento of candidatos) {
        const detalleCosto = (asiento.detalle_asientos || []).find(
          (d) => d.cuenta_codigo === "5002" && Number(d.debe ?? 0) > 0
        );
        if (!detalleCosto) continue;

        const montoCosto = Number(detalleCosto.debe ?? 0) || 0;
        const montoBuscado = redondear(montoCosto);

        // Inferir nombre desde descripción del asiento
        let productoNombre = "Producto Inventariado";
        const descripcionAsiento = (asiento.descripcion || "").trim();

        if (descripcionAsiento.includes("Venta:")) {
          productoNombre = descripcionAsiento.split("Venta:")[1]?.trim() || productoNombre;
        } else if (descripcionAsiento.includes("Egreso:")) {
          productoNombre = descripcionAsiento.split("Egreso:")[1]?.trim() || productoNombre;
        }

        // Buscar movimiento inventario del mismo día con mismo costo_total (redondeado)
        const movsDia = movimientosPorFecha.get(asiento.fecha) || [];
        const movMatch =
          movsDia.find((m) => {
            const costo = redondear(Number(m.costo_total ?? 0));
            if (costo !== montoBuscado) return false;
            const d = (m.descripcion || "").toLowerCase();
            const pn = productoNombre.toLowerCase();
            // si hay descripción, intentamos matchear por nombre; si no, solo por monto
            return !d ? true : d.includes(pn);
          }) || null;

        let cantidad: number | null = null;
        let costoUnitario: number | null = null;
        let productoImagen: string | null = null;
        let productoIdInventario: string | null = null;

        if (movMatch) {
          productoIdInventario = movMatch.producto_id || null;
          if (movMatch.cantidad != null) {
            cantidad = Math.abs(Number(movMatch.cantidad));
            if (cantidad > 0) costoUnitario = montoCosto / cantidad;
          }
        }

        // Fallback: buscar en egresos por descripción y monto_total similar
        let productoEgresoId: string | null = null;
        if (!productoIdInventario) {
          const descripcionBusqueda = descripcionAsiento
            .replace("Egreso: ", "")
            .replace("Venta: ", "")
            .trim();

          const egList = egresosPorDescripcion.get(descripcionBusqueda) || [];
          const egMatch =
            egList.find((eg) => redondear(Number(eg.monto_total ?? 0)) === montoBuscado) || null;

          if (egMatch?.producto_egreso_id) {
            productoEgresoId = egMatch.producto_egreso_id;

            if (egMatch.cantidad != null) {
              cantidad = Math.abs(Number(egMatch.cantidad));
              if (cantidad > 0) costoUnitario = montoCosto / cantidad;
            }
          }
        }

        costosIntermedios.push({
          asiento,
          detalleCosto,
          producto_id_inventario: productoIdInventario,
          producto_egreso_id: productoEgresoId,
          productoNombreInferido: productoNombre,
          cantidad,
          costoUnitario,
          productoImagen
        });
      }

      // Batch fetch productos (inventario)
      const idsProductos = Array.from(
        new Set(costosIntermedios.map((c) => c.producto_id_inventario).filter(Boolean))
      ) as string[];

      let productosMap = new Map<string, ProductoRow>();
      if (idsProductos.length > 0) {
        // Endpoint esperado:
        // GET /api/productos?ids=...
        const prodJson = await apiFetch(`/api/productos?ids=${encodeURIComponent(idsProductos.join(","))}`, {
          method: "GET"
        });
        const productos: ProductoRow[] = (prodJson as any)?.data ?? prodJson ?? [];
        productosMap = new Map((productos || []).map((p) => [p.id, p]));
      }

      // Batch fetch productos_egresos (fallback)
      const idsProdEgreso = Array.from(
        new Set(costosIntermedios.map((c) => c.producto_egreso_id).filter(Boolean))
      ) as string[];

      let productosEgresosMap = new Map<string, ProductoEgresoRow>();
      if (idsProdEgreso.length > 0) {
        // Endpoint esperado:
        // GET /api/productos-egresos?ids=...
        const peJson = await apiFetch(
          `/api/productos-egresos?ids=${encodeURIComponent(idsProdEgreso.join(","))}`,
          { method: "GET" }
        );
        const productosEgresos: ProductoEgresoRow[] = (peJson as any)?.data ?? peJson ?? [];
        productosEgresosMap = new Map((productosEgresos || []).map((p) => [p.id, p]));
      }

      // Armar respuesta final
      const costosVenta: CostoVentaInventario[] = costosIntermedios.map((item) => {
        const { asiento, detalleCosto } = item;

        let productoNombre = item.productoNombreInferido;
        let productoImagen: string | null = null;

        if (item.producto_id_inventario) {
          const prod = productosMap.get(item.producto_id_inventario);
          if (prod) {
            productoNombre = prod.nombre || productoNombre;
            productoImagen = prod.imagen_url ?? null;
          }
        }

        if (!productoImagen && item.producto_egreso_id) {
          const pe = productosEgresosMap.get(item.producto_egreso_id);
          if (pe) {
            productoNombre = pe.nombre || productoNombre;
            productoImagen = pe.imagen_url ?? null;
          }
        }

        const detallesAsiento: DetalleAsiento[] =
          (asiento.detalle_asientos || []).map((d) => ({
            cuenta_codigo: d.cuenta_codigo,
            cuenta_nombre: cuentasMap.get(d.cuenta_codigo) || null,
            debe: Number(d.debe ?? 0) || 0,
            haber: Number(d.haber ?? 0) || 0,
            descripcion: d.descripcion
          })) || [];

        return {
          id: asiento.id,
          fecha: asiento.fecha,
          descripcion: detalleCosto.descripcion || asiento.descripcion || "",
          monto: Number(detalleCosto.debe ?? 0) || 0,
          numero_asiento: asiento.numero_asiento,
          producto_nombre: productoNombre,
          producto_imagen: productoImagen,
          cantidad: item.cantidad,
          costo_unitario: item.costoUnitario,
          detalles_asiento: detallesAsiento
        };
      });

      // Orden por fecha desc (por si el backend no)
      costosVenta.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

      return costosVenta;
    }
  });
};
