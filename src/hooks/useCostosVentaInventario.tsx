// bukipin-dashboard/src/hooks/useCostosVentaInventario.tsx
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

type DateRange = { start: string; end: string };

const toISODate = (d: Date) => d.toISOString().split("T")[0];

const safeNum = (v: any, def = 0) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
};

const toYMD = (v: any) => {
  if (!v) return "";
  const s = String(v);
  // si ya viene YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // si viene ISO
  if (s.includes("T") && s.length >= 10) return s.slice(0, 10);
  // intento parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return toISODate(d);
  return "";
};

const getRange = (
  periodFilter?: "diario" | "mensual" | "anual",
  fechaDiaria?: Date,
  fechaMensual?: Date
): DateRange => {
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

  // default: año actual (evitar payload infinito)
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
};

const normalizeDetalle = (d: any): DetalleAsiento => {
  const cuenta_codigo =
    d?.cuenta_codigo ?? d?.cuentaCodigo ?? d?.accountCodigo ?? d?.accountCode ?? d?.code ?? "";

  const cuenta_nombre =
    d?.cuenta_nombre ?? d?.cuentaNombre ?? d?.accountName ?? d?.nombre ?? null;

  const debe =
    safeNum(d?.debe) ||
    safeNum(d?.debit) ||
    (String(d?.side || "").toLowerCase() === "debit" ? safeNum(d?.monto) : 0);

  const haber =
    safeNum(d?.haber) ||
    safeNum(d?.credit) ||
    (String(d?.side || "").toLowerCase() === "credit" ? safeNum(d?.monto) : 0);

  const descripcion = d?.descripcion ?? d?.memo ?? d?.concepto ?? d?.description ?? null;

  return {
    cuenta_codigo: String(cuenta_codigo || ""),
    cuenta_nombre: cuenta_nombre != null ? String(cuenta_nombre) : null,
    debe,
    haber,
    descripcion: descripcion != null ? String(descripcion) : null,
  };
};

const normalizeRow = (r: any): CostoVentaInventario => {
  const id = String(r?.id ?? r?._id ?? "");

  const fecha = toYMD(r?.fecha ?? r?.created_at ?? r?.createdAt ?? r?.date);

  const numero_asiento = String(
    r?.numero_asiento ?? r?.numeroAsiento ?? r?.numero ?? r?.asiento_numero ?? "N/A"
  );

  const monto = safeNum(r?.monto ?? r?.monto_total ?? r?.debe ?? 0);

  const producto_nombre = String(
    r?.producto_nombre ?? r?.productoNombre ?? r?.producto ?? r?.descripcion_producto ?? "Producto inventariado"
  );

  const producto_imagen =
    r?.producto_imagen ?? r?.productoImagen ?? r?.imagen_url ?? r?.imagenUrl ?? null;

  const cantidad =
    r?.cantidad != null ? safeNum(r?.cantidad, 0) : null;

  const costo_unitario =
    r?.costo_unitario != null
      ? safeNum(r?.costo_unitario, 0)
      : (cantidad && cantidad > 0 ? monto / cantidad : null);

  const descripcion =
    String(
      r?.descripcion ??
        r?.concepto ??
        r?.memo ??
        `Costo de venta (Inventario): ${producto_nombre}`
    ) || "";

  const rawDetalles =
    r?.detalles_asiento ?? r?.detalle_asientos ?? r?.detalles ?? r?.lines ?? [];

  const detalles_asiento: DetalleAsiento[] = Array.isArray(rawDetalles)
    ? rawDetalles.map(normalizeDetalle)
    : [];

  return {
    id,
    fecha: fecha || toISODate(new Date()),
    descripcion,
    monto,
    numero_asiento,
    producto_nombre,
    producto_imagen: producto_imagen != null ? String(producto_imagen) : null,
    cantidad,
    costo_unitario,
    detalles_asiento,
  };
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

      // ✅ Fuente de verdad: backend calcula desde JournalEntry (5002)
      // GET /api/egresos/costos-venta-inventario?start=YYYY-MM-DD&end=YYYY-MM-DD
      const json = await apiFetch(
        `/api/egresos/costos-venta-inventario?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { method: "GET" }
      );

      const rows: any[] = (json as any)?.data ?? (json as any)?.items ?? json ?? [];
      if (!Array.isArray(rows) || rows.length === 0) return [];

      const out = rows.map(normalizeRow);

      // Orden por fecha desc (por si backend no)
      out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

      return out;
    },
  });
};
