// bukipin-dashboard/src/components/Egresos/ResumenEgresos.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  User,
  Image as ImageIcon,
  Package,
  AlertCircle,
  X,
  Calendar as CalendarIcon,
  Search,
  Filter,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTransaccionesEgresos } from "@/hooks/useTransaccionesEgresos";
import { useCostosVentaInventario } from "@/hooks/useCostosVentaInventario";
import { useProductosEgresos } from "@/hooks/useProductosEgresos";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";

// ✅ Date range picker (shadcn)
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { es } from "date-fns/locale";
import { endOfDay, format, startOfDay } from "date-fns";

type AsientoDetalle = {
  cuenta_codigo: string;
  cuenta_nombre?: string;
  descripcion?: string;
  debe: number;
  haber: number;
};

type Asiento = {
  id?: string;
  numero_asiento: string;
  fecha?: string;
  descripcion?: string;
  detalles?: AsientoDetalle[];
};

type DateRangeValue = { from?: Date; to?: Date };

const PAGE_SIZE = 25;

const safeNum = (v: any) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const pickISODate = (t: any) => {
  const v = t?.fecha ?? t?.created_at ?? t?.createdAt ?? null;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ✅ Normalizadores E2E
const normalizeAsientoDetalle = (d: any): AsientoDetalle => {
  const cuenta_codigo =
    d?.cuenta_codigo ?? d?.cuentaCodigo ?? d?.accountCodigo ?? d?.accountCode ?? d?.code ?? "";

  const cuenta_nombre = d?.cuenta_nombre ?? d?.cuentaNombre ?? d?.accountName ?? undefined;

  const debe =
    safeNum(d?.debe) ||
    safeNum(d?.debit) ||
    (String(d?.side || "").toLowerCase() === "debit" ? safeNum(d?.monto) : 0);

  const haber =
    safeNum(d?.haber) ||
    safeNum(d?.credit) ||
    (String(d?.side || "").toLowerCase() === "credit" ? safeNum(d?.monto) : 0);

  const descripcion = d?.descripcion ?? d?.memo ?? d?.concepto ?? d?.description ?? "";

  return {
    cuenta_codigo: String(cuenta_codigo || ""),
    cuenta_nombre,
    descripcion: String(descripcion || ""),
    debe,
    haber,
  };
};

const normalizeAsiento = (json: any): Asiento | null => {
  if (!json) return null;

  let raw: any = json?.data ?? json?.asiento ?? json?.item ?? json;
  if (raw?.asiento) raw = raw.asiento;
  if (!raw) return null;

  const numero_asiento = raw?.numero_asiento ?? raw?.numeroAsiento ?? raw?.numero ?? raw?.id ?? "N/A";
  const fecha =
    raw?.fecha ?? raw?.asiento_fecha ?? raw?.date ?? raw?.created_at ?? raw?.createdAt ?? undefined;

  const descripcion = raw?.descripcion ?? raw?.concepto ?? raw?.memo ?? "";
  const rawDetalles = raw?.detalles ?? raw?.detalle_asientos ?? raw?.detalle_asiento ?? raw?.lines ?? [];
  const detalles = Array.isArray(rawDetalles) ? rawDetalles.map(normalizeAsientoDetalle) : [];

  return {
    id: raw?.id ?? raw?._id,
    numero_asiento: String(numero_asiento || "N/A"),
    fecha: fecha ? String(fecha) : undefined,
    descripcion: String(descripcion || ""),
    detalles,
  };
};

const normalizeEgresoTx = (t: any) => {
  const id = t?.id ?? t?._id ?? t?.transaccion_id ?? t?.transaccionId ?? t?.expenseId ?? null;

  const tipo_egreso = t?.tipo_egreso ?? t?.tipoEgreso ?? t?.tipo ?? t?.expenseType ?? null;

  const cuenta_codigo =
    t?.cuenta_codigo ??
    t?.cuentaCodigo ??
    t?.cuenta ??
    t?.cuentaCode ??
    t?.cuentaPrincipalCodigo ??
    t?.accountCodigo ??
    t?.accountCode ??
    "";

  const descripcion =
    t?.descripcion ??
    t?.concepto ??
    t?.memo ??
    t?.producto_nombre ??
    t?.productoNombre ??
    t?.name ??
    "";

  const proveedor_nombre = t?.proveedor_nombre ?? t?.proveedorNombre ?? t?.proveedor ?? null;
  const proveedor_telefono = t?.proveedor_telefono ?? t?.proveedorTelefono ?? null;
  const proveedor_email = t?.proveedor_email ?? t?.proveedorEmail ?? null;
  const proveedor_rfc = t?.proveedor_rfc ?? t?.proveedorRfc ?? null;

  const created_at = t?.created_at ?? t?.createdAt ?? null;
  const fecha = t?.fecha ?? null;

  const cantidad = t?.cantidad ?? null;

  const costo_unitario =
    t?.costo_unitario ??
    t?.precio_unitario ??
    t?.precioUnitario ??
    t?.unit_cost ??
    t?.unitCost ??
    null;

  const monto_total = t?.monto_total ?? t?.montoTotal ?? t?.monto ?? t?.total ?? 0;

  const monto_pagado = t?.monto_pagado ?? t?.montoPagado ?? 0;
  const monto_pendiente = t?.monto_pendiente ?? t?.montoPendiente ?? 0;

  const tipo_pago = t?.tipo_pago ?? t?.tipoPago ?? null;
  const metodo_pago = t?.metodo_pago ?? t?.metodoPago ?? null;

  const estado = t?.estado ?? "activo";

  const numero_asiento =
    t?.numero_asiento ?? t?.numeroAsiento ?? t?.asiento_numero ?? t?.asientoNumero ?? null;

  const detalles_asiento = t?.detalles_asiento ?? t?.detalle_asientos ?? t?.detalles ?? t?.lines ?? [];

  const imagen_comprobante = t?.imagen_comprobante ?? t?.imagenComprobante ?? null;
  const imagen_url = t?.imagen_url ?? t?.imagenUrl ?? imagen_comprobante ?? null;

  const asiento_id = t?.asiento_id ?? t?.asientoId ?? t?.asientoID ?? null;

  return {
    ...t,
    id,
    _id: t?._id ?? t?.id,
    tipo_egreso,
    cuenta_codigo,
    descripcion,
    proveedor_nombre,
    proveedor_telefono,
    proveedor_email,
    proveedor_rfc,
    created_at,
    fecha,
    cantidad,
    costo_unitario,
    monto_total,
    monto_pagado,
    monto_pendiente,
    tipo_pago,
    metodo_pago,
    estado,
    numero_asiento,
    detalles_asiento,
    imagen_comprobante,
    imagen_url,
    asiento_id,
  };
};

function DateRangePickerInline({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}) {
  const label = useMemo(() => {
    if (value?.from && value?.to) {
      return `${format(value.from, "dd/MM/yyyy", { locale: es })} – ${format(value.to, "dd/MM/yyyy", {
        locale: es,
      })}`;
    }
    if (value?.from && !value?.to) {
      return `${format(value.from, "dd/MM/yyyy", { locale: es })} – …`;
    }
    return "Selecciona un rango";
  }, [value?.from, value?.to]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10 rounded-lg bg-background",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={value as any}
          onSelect={(r: any) => onChange({ from: r?.from, to: r?.to })}
          initialFocus
        />
        <div className="flex items-center justify-between gap-2 p-3 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Tip: selecciona inicio y fin. (Si eliges solo un día, se toma como “inicio”.)
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({})}
            className="h-8 px-2"
            title="Limpiar rango"
          >
            Limpiar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ResumenEgresos = () => {
  const {
    data: transaccionesRaw = [],
    isLoading: loading,
    isError,
    error,
  }: any = useTransaccionesEgresos(200);

  const { data: costosVentaInventario, isLoading: loadingCostosVenta }: any = useCostosVentaInventario();
  const { data: productosEgresos = [] }: any = useProductosEgresos();
  const { toast } = useToast();

  const transacciones = useMemo(() => {
    return (transaccionesRaw || []).map(normalizeEgresoTx);
  }, [transaccionesRaw]);

  const mapaImagenesProductos = useMemo(() => {
    const mapa = new Map<string, string>();
    (productosEgresos || []).forEach((p: any) => {
      if (p.imagen_url) mapa.set(String(p.nombre || "").toLowerCase().trim(), p.imagen_url);
    });
    return mapa;
  }, [productosEgresos]);

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingAsientos, setLoadingAsientos] = useState(false);
  const [currentAsientos, setCurrentAsientos] = useState<Asiento | null>(null);
  const [uploadingComprobante, setUploadingComprobante] = useState(false);

  // ✅ Filtros
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoriaContable, setFilterCategoriaContable] = useState<string>("todos");
  const [filterProveedor, setFilterProveedor] = useState<string>("todos");
  const [filterPago, setFilterPago] = useState<string>("todos");
  const [filterEstadoPago, setFilterEstadoPago] = useState<string>("todos");

  // ✅ Paginación
  const [page, setPage] = useState(1);

  const proveedoresUnicos = useMemo(() => {
    const proveedores = new Set<string>();
    transacciones.forEach((t: any) => {
      if (t.proveedor_nombre) proveedores.add(t.proveedor_nombre);
    });
    return Array.from(proveedores).sort();
  }, [transacciones]);

  const transaccionesFiltradas = useMemo(() => {
    return (transacciones || []).filter((t: any) => {
      if (t.tipo_egreso !== "costo" && t.tipo_egreso !== "gasto" && t.tipo_egreso !== "otro") return false;

      const iso = pickISODate(t);
      const fecha = iso ? new Date(iso) : null;

      // Buscar
      if (
        searchTerm &&
        !String(t.descripcion || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
        !String(t.proveedor_nombre || "").toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Proveedor
      if (filterProveedor !== "todos" && String(t.proveedor_nombre || "") !== String(filterProveedor)) return false;

      // Tipo de pago
      if (filterPago !== "todos" && String(t.tipo_pago || "") !== String(filterPago)) return false;

      // Estado de pago (saldo)
      if (filterEstadoPago === "pagado" && safeNum(t.monto_pendiente) > 0) return false;
      if (filterEstadoPago === "pendiente" && safeNum(t.monto_pendiente) === 0) return false;

      // ✅ Rango fechas (unificado)
      const hasRange = Boolean(dateRange?.from || dateRange?.to);
      if (hasRange && !fecha) return false;

      if (fecha) {
        if (dateRange?.from && fecha < startOfDay(dateRange.from)) return false;
        if (dateRange?.to && fecha > endOfDay(dateRange.to)) return false;
      }

      return true;
    });
  }, [transacciones, searchTerm, filterProveedor, filterPago, filterEstadoPago, dateRange]);

  const transaccionesCostosVenta = useMemo(() => {
    return transaccionesFiltradas.filter(
      (t: any) => t.cuenta_codigo === "5001" || t.cuenta_codigo === "5003" || t.cuenta_codigo === "5004"
    );
  }, [transaccionesFiltradas]);

  const transaccionesGastos = useMemo(() => {
    return transaccionesFiltradas.filter(
      (t: any) =>
        t.cuenta_codigo &&
        String(t.cuenta_codigo).startsWith("51") &&
        t.cuenta_codigo !== "5109" &&
        t.cuenta_codigo !== "5110"
    );
  }, [transaccionesFiltradas]);

  const transaccionesOtrosGastos = useMemo(() => {
    return transaccionesFiltradas.filter((t: any) => t.cuenta_codigo === "5204");
  }, [transaccionesFiltradas]);

  const transaccionesEgresosUnificadas = useMemo(() => {
    const costosConDetalle =
      costosVentaInventario?.map((c: any) => ({
        id: c?.id ?? c?._id,
        created_at: c.fecha,
        fecha: c.fecha,
        tipo_egreso: "costo",
        descripcion: c.producto_nombre,
        cuenta_codigo:
          c.detalles_asiento?.find((d: any) => String(d.cuenta_codigo).startsWith("50"))?.cuenta_codigo || "5002",
        monto_total: safeNum(c.monto),
        proveedor_nombre: null,
        imagen_url: c.producto_imagen,
        cantidad: safeNum(c.cantidad),
        costo_unitario: safeNum(c.costo_unitario),
        numero_asiento: c.numero_asiento,
        detalles_asiento: c.detalles_asiento || [],
        tipo_pago: null,
        metodo_pago: null,
        monto_pagado: safeNum(c.monto),
        monto_pendiente: 0,
        estado: "activo",
        imagen_comprobante: null,
      })) || [];

    const costosVentaDirectos = transaccionesCostosVenta.map((cv: any) => {
      const norm = normalizeEgresoTx(cv);
      return {
        id: norm.id,
        created_at: norm.created_at,
        fecha: norm.fecha,
        tipo_egreso: norm.tipo_egreso,
        descripcion: norm.descripcion,
        cuenta_codigo: norm.cuenta_codigo,
        monto_total: safeNum(norm.monto_total),
        proveedor_nombre: norm.proveedor_nombre,
        imagen_url:
          mapaImagenesProductos.get(String(norm.descripcion || "").toLowerCase().trim()) ||
          norm.imagen_comprobante ||
          null,
        cantidad: safeNum(norm.cantidad),
        costo_unitario: safeNum(norm.costo_unitario),
        numero_asiento: norm.numero_asiento || null,
        detalles_asiento: [],
        tipo_pago: norm.tipo_pago,
        metodo_pago: norm.metodo_pago,
        monto_pagado: safeNum(norm.monto_pagado),
        monto_pendiente: safeNum(norm.monto_pendiente),
        estado: norm.estado || "activo",
        imagen_comprobante: norm.imagen_comprobante || null,
      };
    });

    const gastosConDetalle = transaccionesGastos.map((g: any) => {
      const norm = normalizeEgresoTx(g);
      return {
        id: norm.id,
        created_at: norm.created_at,
        fecha: norm.fecha,
        tipo_egreso: norm.tipo_egreso,
        descripcion: norm.descripcion,
        cuenta_codigo: norm.cuenta_codigo,
        monto_total: safeNum(norm.monto_total),
        proveedor_nombre: norm.proveedor_nombre,
        imagen_url:
          mapaImagenesProductos.get(String(norm.descripcion || "").toLowerCase().trim()) ||
          norm.imagen_comprobante ||
          null,
        cantidad: safeNum(norm.cantidad),
        costo_unitario: safeNum(norm.costo_unitario),
        numero_asiento: norm.numero_asiento || null,
        detalles_asiento: [],
        tipo_pago: norm.tipo_pago,
        metodo_pago: norm.metodo_pago,
        monto_pagado: safeNum(norm.monto_pagado),
        monto_pendiente: safeNum(norm.monto_pendiente),
        estado: norm.estado || "activo",
        imagen_comprobante: norm.imagen_comprobante || null,
      };
    });

    const otrosGastosConDetalle = transaccionesOtrosGastos.map((og: any) => {
      const norm = normalizeEgresoTx(og);
      return {
        id: norm.id,
        created_at: norm.created_at,
        fecha: norm.fecha,
        tipo_egreso: norm.tipo_egreso,
        descripcion: norm.descripcion,
        cuenta_codigo: norm.cuenta_codigo,
        monto_total: safeNum(norm.monto_total),
        proveedor_nombre: norm.proveedor_nombre,
        imagen_url:
          mapaImagenesProductos.get(String(norm.descripcion || "").toLowerCase().trim()) ||
          norm.imagen_comprobante ||
          null,
        cantidad: safeNum(norm.cantidad),
        costo_unitario: safeNum(norm.costo_unitario),
        numero_asiento: norm.numero_asiento || null,
        detalles_asiento: [],
        tipo_pago: norm.tipo_pago,
        metodo_pago: norm.metodo_pago,
        monto_pagado: safeNum(norm.monto_pagado),
        monto_pendiente: safeNum(norm.monto_pendiente),
        estado: norm.estado || "activo",
        imagen_comprobante: norm.imagen_comprobante || null,
      };
    });

    return [...costosConDetalle, ...costosVentaDirectos, ...gastosConDetalle, ...otrosGastosConDetalle].sort((a, b) => {
      const da = pickISODate(a);
      const db = pickISODate(b);
      return new Date(db || 0).getTime() - new Date(da || 0).getTime();
    });
  }, [costosVentaInventario, transaccionesCostosVenta, transaccionesGastos, transaccionesOtrosGastos, mapaImagenesProductos]);

  const transaccionesFiltradasPorCategoria = useMemo(() => {
    if (filterCategoriaContable === "todos") return transaccionesEgresosUnificadas;
    if (filterCategoriaContable === "costos")
      return transaccionesEgresosUnificadas.filter((t: any) => String(t.cuenta_codigo || "").startsWith("50"));
    if (filterCategoriaContable === "gastos")
      return transaccionesEgresosUnificadas.filter((t: any) => String(t.cuenta_codigo || "").startsWith("51"));
    if (filterCategoriaContable === "otros_gastos")
      return transaccionesEgresosUnificadas.filter((t: any) => String(t.cuenta_codigo || "") === "5204");
    return transaccionesEgresosUnificadas;
  }, [transaccionesEgresosUnificadas, filterCategoriaContable]);

  const resumenFiltrado = useMemo(() => {
    const totalCostos = transaccionesEgresosUnificadas
      .filter((t: any) => String(t.cuenta_codigo || "").startsWith("50"))
      .reduce((sum: number, t: any) => sum + safeNum(t.monto_total), 0);

    const totalGastos = transaccionesEgresosUnificadas
      .filter((t: any) => String(t.cuenta_codigo || "").startsWith("51"))
      .reduce((sum: number, t: any) => sum + safeNum(t.monto_total), 0);

    const totalOtrosGastos = transaccionesEgresosUnificadas
      .filter((t: any) => String(t.cuenta_codigo || "") === "5204")
      .reduce((sum: number, t: any) => sum + safeNum(t.monto_total), 0);

    const montoTotal = transaccionesEgresosUnificadas.reduce((sum: number, t: any) => sum + safeNum(t.monto_total), 0);
    const montoPagado = transaccionesEgresosUnificadas.reduce((sum: number, t: any) => sum + safeNum(t.monto_pagado), 0);
    const montoPendiente = transaccionesEgresosUnificadas.reduce((sum: number, t: any) => sum + safeNum(t.monto_pendiente), 0);

    return {
      totalTransacciones: transaccionesEgresosUnificadas.length,
      montoTotal,
      montoPagado,
      montoPendiente,
      totalCostos,
      totalGastos,
      totalOtrosGastos,
      totalGlobalEgresos: totalCostos + totalGastos + totalOtrosGastos,
    };
  }, [transaccionesEgresosUnificadas]);

  const formatMonto = (value: number) =>
    Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTipoEgresoDisplay = (transaccion: any) => {
    const codigo = String(transaccion.cuenta_codigo || "");

    if (codigo === "5001" || codigo === "5003" || codigo === "5004") {
      return { label: "Costos de Venta", className: "bg-red-100 text-red-700 border-red-300" };
    }
    if (codigo === "5002") {
      return { label: "Costo Venta (Inventario)", className: "bg-purple-100 text-purple-700 border-purple-300" };
    }
    if (codigo === "5204") {
      return { label: "Otros Gastos", className: "bg-slate-100 text-slate-700 border-slate-300" };
    }
    if (codigo.startsWith("51")) {
      return { label: "Gastos Operativos", className: "bg-orange-100 text-orange-700 border-orange-300" };
    }
    return { label: "Sin categoría", className: "bg-gray-50 text-gray-600 border-gray-200" };
  };

  const getPagoBadge = (t: any) => {
    const pendiente = safeNum(t?.monto_pendiente);
    const total = safeNum(t?.monto_total);
    const pagado = safeNum(t?.monto_pagado);

    if (total <= 0) return <Badge variant="outline">—</Badge>;
    if (pendiente <= 0) return <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">Pagado</Badge>;
    if (pagado > 0)
      return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Parcial</Badge>;
    return <Badge className="bg-rose-100 text-rose-700 border border-rose-200">Pendiente</Badge>;
  };

  const loadAsientosContables = async (transaccion: any) => {
    setLoadingAsientos(true);
    setCurrentAsientos(null);

    const tryFetchAsiento = async (url: string) => {
      try {
        const j = await apiFetch(url, { method: "GET" });
        return normalizeAsiento(j);
      } catch (e: any) {
        if (e?.status === 404) return null;
        throw e;
      }
    };

    try {
      if (Array.isArray(transaccion?.detalles_asiento) && transaccion.detalles_asiento.length) {
        const detalles = transaccion.detalles_asiento.map(normalizeAsientoDetalle);

        setCurrentAsientos({
          numero_asiento: transaccion.numero_asiento || transaccion.numeroAsiento || "N/A",
          fecha: pickISODate(transaccion) || undefined,
          descripcion: transaccion.descripcion,
          detalles,
        });
        return;
      }

      const id = String(transaccion?.id || "").trim();
      const numeroAsiento = String(transaccion?.numero_asiento || transaccion?.numeroAsiento || "").trim();
      const asientoId = transaccion?.asiento_id ?? transaccion?.asientoId ?? transaccion?.asientoID ?? null;

      let asiento: Asiento | null = null;

      if (asientoId) {
        asiento = await tryFetchAsiento(`/api/asientos/${encodeURIComponent(String(asientoId))}`);
      }

      if (!asiento && id) {
        asiento = await tryFetchAsiento(`/api/asientos/by-transaccion?source=egreso&id=${encodeURIComponent(id)}`);
      }

      if (!asiento && numeroAsiento) {
        asiento = await tryFetchAsiento(`/api/asientos/by-numero?numero_asiento=${encodeURIComponent(numeroAsiento)}`);
      }

      setCurrentAsientos(asiento);
    } catch (err: any) {
      console.error("Error en loadAsientosContables:", err);
      toast({
        title: "Error",
        description:
          err?.status === 401
            ? "Tu sesión expiró. Inicia sesión nuevamente."
            : err?.status === 404
            ? "No se encontró asiento para esta transacción"
            : "Error inesperado al cargar registros contables",
        variant: "destructive",
      });
      setCurrentAsientos(null);
    } finally {
      setLoadingAsientos(false);
    }
  };

  const handleUploadComprobante = async (file: File) => {
    if (!selectedTransaction) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 5MB.", variant: "destructive" });
      return;
    }

    setUploadingComprobante(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("transaccionId", selectedTransaction.id);

      const resp = await fetch("/api/uploads/comprobante-egreso", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw Object.assign(new Error(text || "Upload failed"), { status: resp.status });
      }

      const uploadJson = await resp.json();
      const publicUrl = uploadJson?.data?.publicUrl ?? uploadJson?.publicUrl;
      if (!publicUrl) throw new Error("El backend no devolvió publicUrl");

      await apiFetch(`/api/egresos/${encodeURIComponent(selectedTransaction.id)}/comprobante`, {
        method: "PATCH",
        body: JSON.stringify({ imagen_comprobante: publicUrl }),
      });

      toast({ title: "Comprobante cargado", description: "El comprobante se ha cargado exitosamente" });

      setSelectedTransaction((prev: any) => ({
        ...prev,
        imagen_comprobante: publicUrl,
        imagen_url: prev?.imagen_url || publicUrl,
      }));
    } catch (err: any) {
      console.error("Error uploading comprobante:", err);
      toast({
        title: "Error",
        description: err?.status === 401 ? "Tu sesión expiró. Inicia sesión nuevamente." : "Error al cargar el comprobante",
        variant: "destructive",
      });
    } finally {
      setUploadingComprobante(false);
    }
  };

  // Cancelación
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [transaccionACancelar, setTransaccionACancelar] = useState<any>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  const handleCancelarTransaccion = async () => {
    if (!transaccionACancelar || !motivoCancelacion.trim()) {
      toast({ title: "Error", description: "Por favor proporciona un motivo de cancelación", variant: "destructive" });
      return;
    }

    setIsCanceling(true);
    try {
      await apiFetch(`/api/egresos/${encodeURIComponent(transaccionACancelar.id)}/cancel`, {
        method: "POST",
        body: JSON.stringify({ motivoCancelacion }),
      });

      toast({ title: "Transacción cancelada", description: "La transacción ha sido cancelada exitosamente" });

      setIsCancelDialogOpen(false);
      setMotivoCancelacion("");
      setTransaccionACancelar(null);
      window.location.reload();
    } catch (err: any) {
      console.error("Error cancelando transacción:", err);
      toast({
        title: "Error",
        description: err?.status === 404 ? "No se encontró la transacción" : "No se pudo cancelar la transacción",
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const limpiarFiltros = () => {
    setDateRange({});
    setSearchTerm("");
    setFilterCategoriaContable("todos");
    setFilterProveedor("todos");
    setFilterPago("todos");
    setFilterEstadoPago("todos");
  };

  // Reset de página cuando cambian filtros
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterCategoriaContable, filterProveedor, filterPago, filterEstadoPago, dateRange?.from, dateRange?.to]);

  // Paginación
  const totalRows = transaccionesFiltradasPorCategoria.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalRows);
  const pagedRows = transaccionesFiltradasPorCategoria.slice(startIndex, endIndex);

  const rangeText = totalRows === 0 ? "Mostrando 0 de 0" : `Mostrando ${startIndex + 1}–${endIndex} de ${totalRows}`;

  const loadingAll = Boolean(loading || loadingCostosVenta);

  if (loadingAll) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Egresos</CardTitle>
          <CardDescription>Cargando transacciones...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Egresos</CardTitle>
          <CardDescription>No se pudieron cargar las transacciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error al consultar el backend.</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {String(error?.message || error || "Revisa endpoints /api/egresos/transacciones y /api/asientos.")}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-muted/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardTitle className="text-xl">Resumen de Egresos</CardTitle>
              <CardDescription>Historial completo de transacciones de egresos</CardDescription>
            </div>

            {/* KPI mini cards (más pro y más claro) */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="rounded-xl border bg-muted/20 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Resultados</div>
                <div className="text-sm font-semibold">{totalRows}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 px-3 py-2">
                <div className="text-[11px] text-muted-foreground">Pagado</div>
                <div className="text-sm font-semibold text-emerald-700">${formatMonto(resumenFiltrado.montoPagado)}</div>
              </div>
              <div className="rounded-xl border bg-muted/20 px-3 py-2 col-span-2 md:col-span-1">
                <div className="text-[11px] text-muted-foreground">Total</div>
                <div className="text-sm font-semibold">${formatMonto(resumenFiltrado.totalGlobalEgresos)}</div>
                {resumenFiltrado.montoPendiente > 0 && (
                  <div className="text-[11px] text-amber-700">Pendiente: ${formatMonto(resumenFiltrado.montoPendiente)}</div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros */}
          <div className="mb-5 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="font-semibold">Filtros</div>
              <div className="text-xs text-muted-foreground">Refina la tabla por fecha, proveedor y estado de pago</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2 lg:col-span-2">
                <Label>Rango de fechas</Label>
                <DateRangePickerInline value={dateRange} onChange={setDateRange} />
              </div>

              <div className="space-y-2">
                <Label>Categoría contable</Label>
                <Select value={filterCategoriaContable} onValueChange={setFilterCategoriaContable}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="costos">Costos de Venta (5001-5004)</SelectItem>
                    <SelectItem value="gastos">Gastos Operativos (5101-5108)</SelectItem>
                    <SelectItem value="otros_gastos">Otros Gastos (5204)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={filterProveedor} onValueChange={setFilterProveedor}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {proveedoresUnicos.map((prov: string) => (
                      <SelectItem key={prov} value={prov}>
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de pago</Label>
                <Select value={filterPago} onValueChange={setFilterPago}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="contado">Contado</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="parcial">Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end mt-4">
              <div className="space-y-2 lg:col-span-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    className="pl-9 h-10 rounded-lg bg-background"
                    placeholder="Buscar por descripción o proveedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estado de pago</Label>
                <Select value={filterEstadoPago} onValueChange={setFilterEstadoPago}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="pendiente">Con saldo pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={limpiarFiltros} className="w-full h-10 rounded-lg">
                  Limpiar filtros
                </Button>
              </div>

              <div className="lg:col-span-1 md:col-span-2 flex md:justify-end">
                <div className="text-right w-full md:w-auto">
                  <div className="text-xs text-muted-foreground">Tip: clic en</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> para ver “Información general” y “Registro contable”
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {totalRows === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
              <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">No hay egresos registrados</p>
              <p className="text-sm mt-2">
                Los costos (5001-5004), gastos (5101-5108) y otros (5204) aparecerán aquí
              </p>
            </div>
          ) : (
            <>
              {/* Tabla pro: sticky header + scroll interno */}
              <div className="rounded-xl border bg-background overflow-hidden">
                <div className="max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-16">Imagen</TableHead>
                        <TableHead className="whitespace-nowrap">Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="whitespace-nowrap">Cuenta</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">Cantidad</TableHead>
                        <TableHead className="text-right whitespace-nowrap hidden lg:table-cell">Costo Unit.</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                        <TableHead className="whitespace-nowrap">Pago</TableHead>
                        <TableHead className="whitespace-nowrap">Estado</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {pagedRows.map((transaccion: any, idx: number) => {
                        const iso = pickISODate(transaccion);
                        const rowKey = String(transaccion?.id ?? transaccion?._id ?? `${transaccion?.numero_asiento ?? "row"}-${iso ?? ""}`);

                        const tipoInfo = getTipoEgresoDisplay(transaccion);
                        const cuentaCodigo = String(transaccion.cuenta_codigo || "");
                        const isCosto = cuentaCodigo.startsWith("50");
                        const isGastoOp = cuentaCodigo.startsWith("51");
                        const isOtros = cuentaCodigo === "5204";

                        return (
                          <TableRow key={rowKey} className={cn("hover:bg-muted/20", idx % 2 === 1 && "bg-muted/5")}>
                            <TableCell>
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center border">
                                {transaccion.imagen_url ? (
                                  <img
                                    src={transaccion.imagen_url}
                                    alt={transaccion.descripcion}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = "/placeholder.svg";
                                    }}
                                  />
                                ) : (
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {iso
                                ? new Date(iso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
                                : "—"}
                            </TableCell>

                            <TableCell>
                              <div className="font-semibold leading-tight">{transaccion.descripcion}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {isCosto ? "Costo de Venta" : isGastoOp ? "Gasto Operativo" : isOtros ? "Otro gasto" : "Egreso"}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs font-medium rounded-full px-3 py-1", tipoInfo.className)}>
                                {tipoInfo.label}
                              </Badge>
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={isCosto ? "destructive" : isGastoOp ? "default" : "secondary"}
                                className="font-mono text-xs rounded-full px-3 py-1"
                              >
                                {cuentaCodigo || "N/A"}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {transaccion.proveedor_nombre ? (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{transaccion.proveedor_nombre}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground opacity-50" />
                                  <span className="text-xs text-muted-foreground italic">Sin proveedor</span>
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="text-right hidden lg:table-cell">
                              {transaccion.cantidad ? (
                                <span className="font-medium">{safeNum(transaccion.cantidad)}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right hidden lg:table-cell">
                              {transaccion.costo_unitario ? (
                                <span className="font-medium">${formatMonto(safeNum(transaccion.costo_unitario))}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className={cn("font-semibold", isCosto ? "text-purple-700" : isOtros ? "text-slate-700" : "text-orange-700")}>
                                ${formatMonto(safeNum(transaccion.monto_total))}
                              </div>

                              {safeNum(transaccion.monto_pendiente) > 0 && (
                                <div className="text-xs text-amber-700 mt-0.5">
                                  Pendiente: ${formatMonto(safeNum(transaccion.monto_pendiente))}
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">{getPagoBadge(transaccion)}</TableCell>

                            <TableCell className="whitespace-nowrap">
                              {transaccion.estado === "cancelado" ? (
                                <Badge variant="destructive" className="rounded-full">Cancelada</Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full">Activa</Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog
                                  onOpenChange={(open) => {
                                    if (open) {
                                      setSelectedTransaction(transaccion);
                                      loadAsientosContables(transaccion);
                                    } else {
                                      setCurrentAsientos(null);
                                    }
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Ver detalles" className="h-9 w-9 rounded-lg">
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>

                                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Detalles de la Transacción</DialogTitle>
                                      <DialogDescription>Información completa y asientos contables</DialogDescription>
                                    </DialogHeader>

                                    {selectedTransaction && (
                                      <Tabs defaultValue="general" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                          <TabsTrigger value="general">Información General</TabsTrigger>
                                          <TabsTrigger value="registros">Registro contable</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="general" className="space-y-4">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="rounded-xl border p-4 bg-muted/10">
                                              <h4 className="font-semibold text-sm mb-2">Información</h4>
                                              <div className="space-y-1 text-sm">
                                                <p><span className="font-medium">Descripción:</span> {selectedTransaction.descripcion}</p>
                                                <p><span className="font-medium">Tipo:</span> {selectedTransaction.tipo_egreso}</p>
                                                <p><span className="font-medium">Método de Pago:</span> {selectedTransaction.metodo_pago || "N/A"}</p>
                                                <p><span className="font-medium">Tipo de Pago:</span> {selectedTransaction.tipo_pago || "N/A"}</p>
                                                <p>
                                                  <span className="font-medium">Fecha:</span>{" "}
                                                  {pickISODate(selectedTransaction)
                                                    ? new Date(pickISODate(selectedTransaction)!).toLocaleDateString("es-MX")
                                                    : "—"}
                                                </p>
                                              </div>
                                            </div>

                                            <div className="rounded-xl border p-4 bg-muted/10">
                                              <h4 className="font-semibold text-sm mb-2">Montos</h4>
                                              <div className="space-y-1 text-sm">
                                                <p><span className="font-medium">Total:</span> ${formatMonto(safeNum(selectedTransaction.monto_total))}</p>
                                                <p><span className="font-medium">Pagado:</span> ${formatMonto(safeNum(selectedTransaction.monto_pagado))}</p>
                                                <p><span className="font-medium">Pendiente:</span> ${formatMonto(safeNum(selectedTransaction.monto_pendiente))}</p>
                                              </div>
                                            </div>
                                          </div>

                                          {selectedTransaction.proveedor_nombre && (
                                            <div className="rounded-xl border p-4">
                                              <h4 className="font-semibold text-sm mb-2">Proveedor</h4>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                <p><span className="font-medium">Nombre:</span> {selectedTransaction.proveedor_nombre}</p>
                                                {selectedTransaction.proveedor_telefono && <p><span className="font-medium">Teléfono:</span> {selectedTransaction.proveedor_telefono}</p>}
                                                {selectedTransaction.proveedor_email && <p><span className="font-medium">Email:</span> {selectedTransaction.proveedor_email}</p>}
                                                {selectedTransaction.proveedor_rfc && <p><span className="font-medium">RFC:</span> {selectedTransaction.proveedor_rfc}</p>}
                                              </div>
                                            </div>
                                          )}

                                          {selectedTransaction.comentarios && (
                                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200/60">
                                              <p className="font-medium text-blue-700 dark:text-blue-300 text-sm mb-1">💬 Comentarios</p>
                                              <p className="text-blue-600 dark:text-blue-400 text-sm">{selectedTransaction.comentarios}</p>
                                            </div>
                                          )}
                                        </TabsContent>

                                        <TabsContent value="registros" className="space-y-4">
                                          {loadingAsientos ? (
                                            <div className="text-center py-8">
                                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                              <p className="mt-2 text-sm text-muted-foreground">Cargando asientos contables...</p>
                                            </div>
                                          ) : currentAsientos?.detalles?.length ? (
                                            <div className="rounded-xl border overflow-hidden">
                                              <div className="p-4 border-b bg-muted/20">
                                                <div className="font-semibold">Asiento #{currentAsientos.numero_asiento}</div>
                                                <div className="text-xs text-muted-foreground">
                                                  {currentAsientos.fecha ? new Date(currentAsientos.fecha).toLocaleDateString("es-MX") : ""}
                                                </div>
                                              </div>

                                              <div className="overflow-auto">
                                                <table className="w-full text-sm">
                                                  <thead className="bg-muted/30">
                                                    <tr>
                                                      <th className="p-3 text-left">Cuenta</th>
                                                      <th className="p-3 text-left">Descripción</th>
                                                      <th className="p-3 text-right">Debe</th>
                                                      <th className="p-3 text-right">Haber</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {currentAsientos.detalles.map((detalle, idx2) => (
                                                      <tr key={idx2} className="border-b last:border-0">
                                                        <td className="p-3">
                                                          <div className="font-mono font-semibold">{detalle.cuenta_codigo}</div>
                                                          <div className="text-xs text-muted-foreground">{detalle.cuenta_nombre}</div>
                                                        </td>
                                                        <td className="p-3">{detalle.descripcion}</td>
                                                        <td className="p-3 text-right">
                                                          {safeNum(detalle.debe) > 0 ? (
                                                            <span className="text-rose-700 font-semibold">${formatMonto(safeNum(detalle.debe))}</span>
                                                          ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                          )}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                          {safeNum(detalle.haber) > 0 ? (
                                                            <span className="text-emerald-700 font-semibold">${formatMonto(safeNum(detalle.haber))}</span>
                                                          ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                          )}
                                                        </td>
                                                      </tr>
                                                    ))}

                                                    <tr className="border-t bg-muted/20 font-bold">
                                                      <td colSpan={2} className="p-3">TOTALES</td>
                                                      <td className="p-3 text-right text-rose-700">
                                                        ${formatMonto(currentAsientos.detalles.reduce((sum, d) => sum + safeNum(d.debe), 0))}
                                                      </td>
                                                      <td className="p-3 text-right text-emerald-700">
                                                        ${formatMonto(currentAsientos.detalles.reduce((sum, d) => sum + safeNum(d.haber), 0))}
                                                      </td>
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="p-8 bg-muted/20 rounded-xl border text-center">
                                              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                              <p className="text-sm text-muted-foreground">
                                                No se encontraron registros contables para esta transacción
                                              </p>
                                            </div>
                                          )}
                                        </TabsContent>
                                      </Tabs>
                                    )}

                                    <div className="border-t pt-4 mt-6">
                                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" />
                                        Comprobante
                                      </h4>

                                      {selectedTransaction?.imagen_comprobante ? (
                                        <div className="space-y-2">
                                          <div className="rounded-xl overflow-hidden border bg-muted/10">
                                            <img
                                              src={selectedTransaction.imagen_comprobante}
                                              alt="Comprobante"
                                              className="w-full h-auto max-h-96 object-contain"
                                            />
                                          </div>
                                          <a
                                            href={selectedTransaction.imagen_comprobante}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary hover:underline inline-block"
                                          >
                                            Ver imagen completa en nueva pestaña
                                          </a>
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          <div className="p-4 bg-muted/20 rounded-xl border text-center text-sm text-muted-foreground">
                                            No hay comprobante cargado para esta transacción
                                          </div>

                                          <div className="flex flex-col items-center gap-2">
                                            <label htmlFor="comprobante-upload" className="cursor-pointer">
                                              <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium inline-flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4" />
                                                {uploadingComprobante ? "Cargando..." : "Cargar comprobante"}
                                              </div>
                                            </label>
                                            <input
                                              id="comprobante-upload"
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              disabled={uploadingComprobante}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleUploadComprobante(file);
                                              }}
                                            />
                                            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP (Máx. 5MB)</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 rounded-lg border-red-300 text-red-600 hover:bg-red-50"
                                  disabled={transaccion.estado === "cancelado" || isCanceling}
                                  onClick={() => {
                                    setTransaccionACancelar(transaccion);
                                    setIsCancelDialogOpen(true);
                                  }}
                                  title={transaccion.estado === "cancelado" ? "Transacción ya cancelada" : "Cancelar transacción"}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Footer paginación */}
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm text-muted-foreground">{rangeText}</div>

                <div className="flex items-center gap-3 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                    Anterior
                  </Button>
                  <div className="text-sm text-muted-foreground">Página {safePage} de {totalPages}</div>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                    Siguiente
                  </Button>
                </div>
              </div>

              {/* Totales por categoría (cards pro) */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border bg-muted/10 p-4">
                  <div className="text-xs text-muted-foreground">Costos de Venta (5001–5004)</div>
                  <div className="text-2xl font-bold text-purple-700 mt-1">${formatMonto(resumenFiltrado.totalCostos)}</div>
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <div className="text-xs text-muted-foreground">Gastos Operativos (5101–5108)</div>
                  <div className="text-2xl font-bold text-orange-700 mt-1">${formatMonto(resumenFiltrado.totalGastos)}</div>
                </div>

                <div className="rounded-xl border bg-muted/10 p-4">
                  <div className="text-xs text-muted-foreground">Total de Egresos</div>
                  <div className="text-2xl font-bold mt-1">${formatMonto(resumenFiltrado.totalGlobalEgresos)}</div>
                  {resumenFiltrado.montoPendiente > 0 && (
                    <div className="text-sm text-amber-700 mt-1">Pendiente: ${formatMonto(resumenFiltrado.montoPendiente)}</div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de cancelación */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Transacción</DialogTitle>
            <DialogDescription>Esta acción creará un asiento de reversión y marcará la transacción como cancelada.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Motivo de Cancelación *</Label>
              <Textarea
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Describe el motivo de la cancelación..."
                rows={4}
              />
            </div>

            {transaccionACancelar && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium mb-2">Transacción a cancelar:</p>
                <p><span className="font-medium">Descripción:</span> {transaccionACancelar.descripcion}</p>
                <p><span className="font-medium">Monto:</span> ${formatMonto(safeNum(transaccionACancelar.monto_total))}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCancelDialogOpen(false);
                setMotivoCancelacion("");
                setTransaccionACancelar(null);
              }}
              disabled={isCanceling}
            >
              Cerrar
            </Button>
            <Button variant="destructive" onClick={handleCancelarTransaccion} disabled={isCanceling || !motivoCancelacion.trim()}>
              {isCanceling ? "Cancelando..." : "Confirmar Cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog legacy (mantenido por compat) */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Egreso</DialogTitle>
            <DialogDescription>Información completa de la transacción</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Este modal ya no se usa (los detalles están en el botón de documento). Puedes eliminarlo más adelante sin afectar funcionalidad.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResumenEgresos;
