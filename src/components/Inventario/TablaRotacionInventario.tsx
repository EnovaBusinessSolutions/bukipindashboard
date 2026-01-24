import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Package, Search, ArrowUpDown, CalendarClock } from "lucide-react";
import { useInventarioConMovimientos } from "@/hooks/useInventarioConMovimientos";

type SortMode = "rotacion_desc" | "rotacion_asc" | "stock_desc" | "stock_asc";
type EstadoFiltro = "todos" | "alta" | "media" | "baja" | "muy_baja" | "sin_movimiento";

const n = (v: any) => {
  const num = Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
};

function safeId(p: any): string {
  const v =
    p?.id ??
    p?._id ??
    p?.productId ??
    p?.product_id ??
    p?.productoId ??
    p?.producto_id ??
    "";
  return String(v || "");
}

function parseAnyDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;

  const s = String(v).trim();
  if (!s) return null;

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split("/");
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD (o ISO)
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTipoMovimiento(m: any): "entrada" | "salida" | "otro" {
  const t = String(m?.tipo ?? m?.type ?? m?.movimiento ?? m?.movementType ?? "").toLowerCase();

  if (t.includes("entrada") || t.includes("compra") || t.includes("in")) return "entrada";
  if (t.includes("salida") || t.includes("venta") || t.includes("out")) return "salida";

  const isEntrada = m?.isEntrada ?? m?.entrada ?? false;
  const isSalida = m?.isSalida ?? m?.salida ?? false;
  if (isEntrada) return "entrada";
  if (isSalida) return "salida";

  return "otro";
}

function getCantidad(m: any) {
  return n(
    m?.cantidad ??
      m?.qty ??
      m?.quantity ??
      m?.unidades ??
      m?.units ??
      m?.cantidad_movimiento ??
      m?.cantidadMovimiento ??
      m?.cantidadVendida ??
      m?.cantidad_vendida
  );
}

function formatDias(dias?: number) {
  if (!dias || !Number.isFinite(dias) || dias <= 0) return "Sin datos";
  const r = Math.round(dias);
  return `${r} día${r === 1 ? "" : "s"}`;
}

function formatShortDate(d?: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function estadoDesdeDias(avgDays?: number, soldQty?: number) {
  const hasSales = (soldQty ?? 0) > 0;
  if (!hasSales || !avgDays || !Number.isFinite(avgDays) || avgDays <= 0) return "sin_movimiento" as const;

  // Umbrales “negocio” (ajústalos si quieres)
  if (avgDays <= 14) return "alta" as const;
  if (avgDays <= 45) return "media" as const;
  if (avgDays <= 90) return "baja" as const;
  return "muy_baja" as const;
}

function getRotacionBadge(estadoRot: string, dias?: number, soldQty?: number) {
  const hasSales = (soldQty ?? 0) > 0;
  const hasData = hasSales && typeof dias === "number" && Number.isFinite(dias) && dias > 0;

  if (!hasData || estadoRot === "sin_movimiento") {
    return <Badge variant="secondary">Sin movimiento</Badge>;
  }

  if (estadoRot === "alta") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
        Alta
      </Badge>
    );
  }
  if (estadoRot === "media") {
    return (
      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20">
        Media
      </Badge>
    );
  }
  if (estadoRot === "baja") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
        Baja
      </Badge>
    );
  }
  if (estadoRot === "muy_baja") {
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20">
        Muy baja
      </Badge>
    );
  }

  return <Badge variant="secondary">Sin movimiento</Badge>;
}

/**
 * FIFO ponderado por unidades:
 * - Entradas crean lotes (fecha, qty)
 * - Salidas consumen lotes desde el más viejo
 * - Edad por unidad = ventaFecha - compraFecha
 * - Promedio = sum(edad * qtyConsumida)/sum(qtyConsumida)
 */
function calcularRotacionFIFO(movsRaw: any[]) {
  const movs = (Array.isArray(movsRaw) ? movsRaw : [])
    .map((m) => {
      const d = parseAnyDate(m?.fecha ?? m?.date ?? m?.createdAt ?? m?.fecha_movimiento ?? m?.movementDate);
      return { ...m, __date: d };
    })
    .filter((m) => m.__date instanceof Date && !Number.isNaN(m.__date.getTime()))
    .sort((a, b) => (a.__date as Date).getTime() - (b.__date as Date).getTime());

  const entradas: Array<{ date: Date; qty: number }> = [];
  let totalSold = 0;
  let totalAgeDays = 0;
  let lastSale: Date | null = null;

  for (const m of movs) {
    const tipo = getTipoMovimiento(m);
    const qty = getCantidad(m);
    const dt: Date = m.__date;

    if (!qty || qty <= 0) continue;

    if (tipo === "entrada") {
      entradas.push({ date: dt, qty });
      continue;
    }

    if (tipo === "salida") {
      lastSale = dt;
      totalSold += qty;

      let remaining = qty;

      // consume FIFO
      while (remaining > 0 && entradas.length > 0) {
        const lot = entradas[0];
        const take = Math.min(lot.qty, remaining);

        const ageMs = dt.getTime() - lot.date.getTime();
        const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24)); // no negativos

        totalAgeDays += ageDays * take;

        lot.qty -= take;
        remaining -= take;

        if (lot.qty <= 0) entradas.shift();
      }

      // Si vendiste sin entradas (inventario negativo), no “inventamos” edad:
      // lo dejamos sin sumar (mantiene promedio más realista).
      continue;
    }
  }

  const avgDays = totalSold > 0 ? totalAgeDays / totalSold : undefined;

  return {
    soldQty: totalSold,
    avgDays,
    lastSale,
  };
}

const TablaRotacionInventario = () => {
  const { data: productos = [], isLoading } = useInventarioConMovimientos();

  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoFiltro>("todos");
  const [sort, setSort] = useState<SortMode>("rotacion_desc");

  const productosDerivados = useMemo(() => {
    const list = (Array.isArray(productos) ? productos : []).map((p: any) => {
      const id = safeId(p);
      const nombre = String(p?.nombre ?? "Producto");
      const stock = n(p?.cantidad_stock);

      const movs =
        p?.movimientos ??
        p?.movimientos_inventario ??
        p?.inventoryMovements ??
        p?.history ??
        [];

      // cálculo real con movimientos
      const fifo = calcularRotacionFIFO(movs);

      // fallback (por si algún producto no trae movimientos)
      const fallbackDias = n(p?.dias_promedio_rotacion);
      const fallbackEstado = String(p?.estado_rotacion ?? "sin_movimiento");

      const diasProm =
        typeof fifo.avgDays === "number" && Number.isFinite(fifo.avgDays) && fifo.avgDays > 0
          ? fifo.avgDays
          : fallbackDias > 0
            ? fallbackDias
            : undefined;

      const soldQty =
        (fifo.soldQty ?? 0) > 0 ? fifo.soldQty : n(p?.cantidad_vendida) > 0 ? n(p?.cantidad_vendida) : 0;

      const estadoCalc =
        (soldQty ?? 0) > 0
          ? estadoDesdeDias(diasProm, soldQty)
          : (fallbackDias > 0 ? estadoDesdeDias(fallbackDias, 1) : "sin_movimiento");

      const lastSale = fifo.lastSale ?? null;

      return {
        raw: p,
        id,
        nombre,
        subcuentaNombre: String(p?.subcuenta_nombre ?? p?.subcuentaNombre ?? "Sin subcuenta"),
        imagen: String(p?.imagen_url ?? p?.imagenUrl ?? ""),
        stock,
        soldQty,
        diasProm,
        estadoRotacion: estadoCalc,
        lastSale,
      };
    });

    return list.filter((x) => x.id);
  }, [productos]);

  const resumen = useMemo(() => {
    const total = productosDerivados.length;
    let alta = 0, media = 0, baja = 0, muyBaja = 0, sin = 0;

    for (const p of productosDerivados) {
      const e = p.estadoRotacion;
      if (e === "alta") alta++;
      else if (e === "media") media++;
      else if (e === "baja") baja++;
      else if (e === "muy_baja") muyBaja++;
      else sin++;
    }

    return { total, alta, media, baja, muyBaja, sin };
  }, [productosDerivados]);

  const productosFiltradosOrdenados = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...productosDerivados];

    if (q) {
      list = list.filter((p) => p.nombre.toLowerCase().includes(q));
    }

    if (estado !== "todos") {
      list = list.filter((p) => p.estadoRotacion === estado);
    }

    const getDias = (p: any) => (typeof p.diasProm === "number" && Number.isFinite(p.diasProm) ? p.diasProm : -1);
    const getStock = (p: any) => (Number.isFinite(p.stock) ? p.stock : 0);

    list.sort((a, b) => {
      if (sort === "rotacion_desc") return getDias(b) - getDias(a); // más días = más lenta
      if (sort === "rotacion_asc") return getDias(a) - getDias(b);  // menos días = más rápida
      if (sort === "stock_desc") return getStock(b) - getStock(a);
      if (sort === "stock_asc") return getStock(a) - getStock(b);
      return 0;
    });

    // productos sin datos al final
    list.sort((a, b) => {
      const da = getDias(a);
      const db = getDias(b);
      const aNo = da <= 0;
      const bNo = db <= 0;
      if (aNo && !bNo) return 1;
      if (!aNo && bNo) return -1;
      return 0;
    });

    return list;
  }, [productosDerivados, search, estado, sort]);

  if (isLoading) {
    return (
      <Card className="border-muted/60">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Cargando datos de rotación...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted/60">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Rotación de inventario</CardTitle>
            </div>
            <CardDescription>
              Tiempo promedio (ponderado por unidades) desde <span className="font-medium">entrada</span> hasta{" "}
              <span className="font-medium">salida/venta</span>, calculado con tus movimientos reales.
            </CardDescription>
          </div>
        </div>

        {/* Controles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="pl-9"
            />
          </div>

          <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado de rotación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
              <SelectItem value="muy_baja">Muy baja</SelectItem>
              <SelectItem value="sin_movimiento">Sin movimiento</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Ordenar" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rotacion_desc">Rotación (lenta → rápida)</SelectItem>
              <SelectItem value="rotacion_asc">Rotación (rápida → lenta)</SelectItem>
              <SelectItem value="stock_desc">Stock (mayor → menor)</SelectItem>
              <SelectItem value="stock_asc">Stock (menor → mayor)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Chips resumen */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Total: {resumen.total}</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            Alta: {resumen.alta}
          </Badge>
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20">
            Media: {resumen.media}
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            Baja: {resumen.baja}
          </Badge>
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20">
            Muy baja: {resumen.muyBaja}
          </Badge>
          <Badge variant="secondary">Sin movimiento: {resumen.sin}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-[440px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[56px]"></TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Días promedio</TableHead>
                  <TableHead className="text-right">Última salida</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {productosFiltradosOrdenados.length > 0 ? (
                  productosFiltradosOrdenados.map((p) => {
                    const stock = n(p.stock);
                    const dias = p.diasProm;
                    const estadoRot = p.estadoRotacion;

                    return (
                      <TableRow key={p.id} className="hover:bg-muted/40">
                        <TableCell>
                          <Avatar className="h-10 w-10 rounded-md">
                            <AvatarImage src={p.imagen || ""} alt={p.nombre} />
                            <AvatarFallback className="rounded-md">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>

                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="leading-tight">{p.nombre}</span>
                            <span className="text-xs text-muted-foreground">{p.subcuentaNombre}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${
                              stock < 0 ? "text-red-600" : stock <= 10 ? "text-amber-600" : ""
                            }`}
                          >
                            {stock.toLocaleString("es-MX")}
                          </span>
                          <span className="text-xs text-muted-foreground">{" "}u</span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-semibold">{formatDias(dias)}</span>
                          {p.soldQty > 0 && (
                            <div className="text-[11px] text-muted-foreground">
                              {p.soldQty.toLocaleString("es-MX")} u vendidas
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-2 text-sm">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">{formatShortDate(p.lastSale)}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          {getRotacionBadge(estadoRot, dias, p.soldQty)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      {productosDerivados.length === 0
                        ? "No hay productos de inventario registrados."
                        : "No hay resultados con los filtros seleccionados."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          💡 Tip: “Sin movimiento” aparece cuando el producto no tiene salidas/ventas registradas (o no hay historial suficiente).
        </div>
      </CardContent>
    </Card>
  );
};

export default TablaRotacionInventario;
