// src/components/Egresos/CatalogoProductos.tsx
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Filter, Package2, Edit, Trash2, Eye, Plus, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import FriendlySubcuentaSelector from "@/components/ui/friendly-subcuenta-selector";
import { useCuentas } from "@/hooks/useCuentas";

import {
  useProductosEgresos,
  useCreateProductoEgreso,
  useUpdateProductoEgreso,
  useDeleteProductoEgreso,
  CreateProductoEgresoData,
  UpdateProductoEgresoData,
} from "@/hooks/useProductosEgresos";

/**
 * Helpers defensivos (para evitar crashes por undefined / strings)
 */
const toNum = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const moneyMX = (v: any) => {
  const n = toNum(v, 0);
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const safeStr = (v: any) => {
  if (v === null || v === undefined) return "";
  return String(v);
};

const toStrId = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s;
};

const toStrIdOrNull = (v: any) => {
  const s = toStrId(v);
  return s ? s : null;
};

const stripSubcuentaPrefix = (label: string) => {
  const s = safeStr(label).trim();
  if (!s) return "";
  return s.replace(/^Subcuenta:\s*/i, "").trim();
};

const looksLikeMongoId = (s: string) => /^[a-f0-9]{24}$/i.test((s || "").trim());

/**
 * Extrae subcuenta de forma robusta:
 * - subcuenta_id / subcuentaId (string u ObjectId)
 * - subcuenta (objeto) con id/_id/codigo/nombre
 * - evita caer en "[object Object]"
 */
const extractSubcuentaInfo = (p: any) => {
  const raw =
    p?.subcuenta_id ??
    p?.subcuentaId ??
    p?.subcuentaID ??
    p?.subcuenta_id_str ??
    p?.subcuenta ??
    null;

  let id = "";
  let codigo = "";
  let nombre = "";

  if (raw && typeof raw === "object") {
    id = toStrId(raw?._id ?? raw?.id ?? "");
    codigo = safeStr(raw?.codigo ?? raw?.code ?? "").trim();
    nombre = safeStr(raw?.nombre ?? raw?.name ?? "").trim();
  } else {
    id = toStrId(raw);
  }

  // También puede venir “plano” en el producto
  const codigoPlano = safeStr(
    p?.subcuenta_codigo ?? p?.subcuentaCodigo ?? p?.subcuenta_code ?? p?.subcuentaCode ?? ""
  ).trim();

  const nombrePlano = safeStr(
    p?.subcuenta_nombre ?? p?.subcuentaNombre ?? p?.subcuenta_name ?? p?.subcuentaName ?? ""
  ).trim();

  if (!codigo) codigo = codigoPlano;
  if (!nombre) nombre = nombrePlano;

  const cleanId = toStrIdOrNull(id);
  const cleanCodigo = safeStr(codigo).trim();
  const cleanNombre = safeStr(nombre).trim();

  const label =
    cleanCodigo && cleanNombre
      ? `${cleanCodigo} - ${cleanNombre}`
      : cleanNombre
      ? cleanNombre
      : cleanCodigo
      ? cleanCodigo
      : cleanId
      ? cleanId // 👈 IMPORTANT: NO prefijamos "Subcuenta:" aquí para evitar duplicados en UI
      : "";

  return {
    id: cleanId,
    codigo: cleanCodigo || "",
    nombre: cleanNombre || "",
    label: stripSubcuentaPrefix(label || ""),
  };
};

/**
 * Normaliza un producto venga como venga (backend nuevo / legacy / wrapper / payload plano)
 * ✅ La UI siempre consume:
 * - id
 * - unidad
 * - cuenta_contable
 * - proveedor_principal
 * - imagen_url
 * - precio_promedio / variacion_precio / total_transacciones / ultima_compra
 * - subcuenta_id (string real) + subcuenta_label (humano cuando exista)
 */
const normalizeProducto = (p: any) => {
  if (!p) return null;

  const unidad =
    p.unidad ?? p.unidad_medida ?? p.unidadMedida ?? p.unidad_de_medida ?? p.unidadDeMedida ?? "";

  const cuenta_contable =
    p.cuenta_contable ?? p.cuentaContable ?? p.cuenta_codigo ?? p.cuentaCodigo ?? "";

  const proveedor_principal = p.proveedor_principal ?? p.proveedorPrincipal ?? p.proveedor ?? "";
  const imagen_url = p.imagen_url ?? p.imagenUrl ?? p.imageUrl ?? p.imagen ?? "";

  const precio_promedio = p.precio_promedio ?? p.precioPromedio ?? 0;
  const variacion_precio = p.variacion_precio ?? p.variacionPrecio ?? 0;
  const total_transacciones = p.total_transacciones ?? p.transacciones ?? 0;
  const ultima_compra = p.ultima_compra ?? p.ultimaCompra ?? null;
  const es_recurrente = p.es_recurrente ?? p.esRecurrente ?? false;

  const id = toStrId(p.id ?? p._id ?? "");

  const sub = extractSubcuentaInfo(p);

  const normalized = {
    ...p,
    id,
    unidad: String(unidad || ""),
    cuenta_contable: String(cuenta_contable || ""),
    proveedor_principal: String(proveedor_principal || ""),
    imagen_url: String(imagen_url || ""),
    precio_promedio: toNum(precio_promedio, 0),
    variacion_precio: toNum(variacion_precio, 0),
    total_transacciones: toNum(total_transacciones, 0),
    ultima_compra: ultima_compra ? String(ultima_compra) : null,
    es_recurrente: !!es_recurrente,

    // subcuenta canonical
    subcuenta_id: sub.id,
    subcuenta_codigo: sub.codigo,
    subcuenta_nombre: sub.nombre,
    subcuenta_label: stripSubcuentaPrefix(sub.label),
  };

  return normalized;
};

const CatalogoProductos = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showOrphanCosts, setShowOrphanCosts] = useState(false);

  const navigate = useNavigate();

  // Hooks (E2E)
  const { data: productosEgresosRaw, isLoading } = useProductosEgresos() as any;
  const createProducto = useCreateProductoEgreso();
  const updateProducto = useUpdateProductoEgreso();
  const deleteProducto = useDeleteProductoEgreso();

  // 🔥 Para resolver nombre/código de subcuenta aunque el endpoint de productos solo mande el ID
  const { data: cuentasRaw } = useCuentas() as any;

  /**
   * ✅ Mapa subcuentaId -> { codigo, nombre, label }
   *
   * IMPORTANTE (tu caso real):
   * En tu BD, la “subcuenta” NO viene dentro de `cuenta.subcuentas[]`,
   * sino como documentos en `accounts` con `parentCode` (ej. 5001-02 con parentCode=5001).
   *
   * Entonces:
   * 1) Soportamos nested subcuentas (legacy)
   * 2) Soportamos subcuentas como accounts (parentCode presente)
   */
  const subcuentaById = useMemo(() => {
    const map = new Map<string, { codigo: string; nombre: string; label: string }>();

    const cuentas = Array.isArray(cuentasRaw) ? cuentasRaw : Array.isArray(cuentasRaw?.data) ? cuentasRaw.data : [];

    // (A) Caso moderno/real: subcuentas como documentos "Account" (tienen parentCode)
    for (const a of cuentas) {
      const id = String(a?._id ?? a?.id ?? "").trim();
      if (!id) continue;

      const parentCode = String(a?.parentCode ?? a?.parent_code ?? a?.parentCodigo ?? "").trim();
      // si tiene parentCode, es subcuenta (según tu modelo actual)
      if (parentCode) {
        const codigo = String(a?.code ?? a?.codigo ?? a?.accountCode ?? "").trim();
        const nombre = String(a?.name ?? a?.nombre ?? "").trim();
        const label = stripSubcuentaPrefix(codigo && nombre ? `${codigo} - ${nombre}` : nombre || codigo || "");
        if (label) map.set(id, { codigo, nombre, label });
      }
    }

    // (B) Caso legacy: cuenta.subcuentas[]
    for (const c of cuentas) {
      const subs = c?.subcuentas || c?.subcuentas_contables || c?.subaccounts || [];
      if (!Array.isArray(subs)) continue;

      for (const s of subs) {
        const id = String(s?._id ?? s?.id ?? "").trim();
        if (!id) continue;

        const codigo = String(s?.codigo ?? s?.code ?? "").trim();
        const nombre = String(s?.nombre ?? s?.name ?? "").trim();

        const label = stripSubcuentaPrefix(codigo && nombre ? `${codigo} - ${nombre}` : nombre || codigo || "");
        if (label && !map.has(id)) map.set(id, { codigo, nombre, label });
      }
    }

    return map;
  }, [cuentasRaw]);

  // Normaliza SIEMPRE para que el UI no dependa del shape del backend
  // y además "enriquece" subcuenta_label desde el mapa (para no mostrar IDs)
  const productosEgresos = useMemo(() => {
    const arr = Array.isArray(productosEgresosRaw)
      ? productosEgresosRaw
      : Array.isArray(productosEgresosRaw?.data)
      ? productosEgresosRaw.data
      : [];

    const normalized = (arr || []).map(normalizeProducto).filter(Boolean) as any[];

    return normalized.map((p) => {
      const subId = p?.subcuenta_id ? String(p.subcuenta_id).trim() : "";
      if (!subId) return p;

      // label actual (si backend lo manda)
      const currentLabel = stripSubcuentaPrefix(String(p?.subcuenta_label || "").trim());

      // Detectar fallback que termina siendo el id (o vacío)
      const isIdFallback = !currentLabel || looksLikeMongoId(currentLabel);

      if (isIdFallback) {
        const fromMap = subcuentaById.get(subId);
        if (fromMap?.label) {
          return {
            ...p,
            subcuenta_codigo: p.subcuenta_codigo || fromMap.codigo,
            subcuenta_nombre: p.subcuenta_nombre || fromMap.nombre,
            subcuenta_label: fromMap.label,
          };
        }
      }

      return { ...p, subcuenta_label: currentLabel || p.subcuenta_label };
    });
  }, [productosEgresosRaw, subcuentaById]);

  const [newProduct, setNewProduct] = useState({
    nombre: "",
    descripcion: "",
    tipo: "", // "gasto" o "costo"
    unidad: "",
    proveedorPrincipal: "",
    esRecurrente: false,
    subcuentaId: "",
    cuentaContable: "",
    imagen: null as File | null,
  });

  /**
   * ✅ Whitelist de cuentas contables permitidas por tipo
   * - Para "gasto": SOLO 5101–5108 (incluye 5103)
   * - Para "costo": cuentas 5001–5004 (pero en UI forzamos 5001)
   */
  const getCuentasAfectadas = (tipo: string) => {
    if (tipo === "costo") {
      return [
        { codigo: "5001", nombre: "Costo de Ventas", subgrupo: "Costo de Ventas" },
        { codigo: "5002", nombre: "Costo de Ventas Inventario", subgrupo: "Costo de Ventas" },
        { codigo: "5003", nombre: "Devoluciones sobre Compras", subgrupo: "Costo de Ventas" },
        { codigo: "5004", nombre: "Descuentos sobre Compras", subgrupo: "Costo de Ventas" },
      ];
    }

    if (tipo === "gasto") {
      return [
        { codigo: "5101", nombre: "Gastos de Venta", subgrupo: "Gastos de Operación" },
        { codigo: "5102", nombre: "Sueldos y Salarios Ventas", subgrupo: "Gastos de Operación" },
        { codigo: "5103", nombre: "Comisiones sobre Ventas", subgrupo: "Gastos de Operación" },
        { codigo: "5104", nombre: "Publicidad", subgrupo: "Gastos de Operación" },
        { codigo: "5105", nombre: "Gastos de Administración", subgrupo: "Gastos de Operación" },
        { codigo: "5106", nombre: "Sueldos y Salarios Administración", subgrupo: "Gastos de Operación" },
        { codigo: "5107", nombre: "Renta de Oficinas", subgrupo: "Gastos de Operación" },
        { codigo: "5108", nombre: "Servicios Públicos", subgrupo: "Gastos de Operación" },
      ];
    }

    return [];
  };

  const allowedCuentaByTipo = (tipo: "gasto" | "costo") => {
    return new Set(getCuentasAfectadas(tipo).map((x) => x.codigo));
  };

  const gastos = productosEgresos.filter((p: any) => p?.tipo === "gasto");
  const costos = productosEgresos.filter((p: any) => p?.tipo === "costo");

  const filteredGastos = gastos.filter((producto: any) => {
    const st = searchTerm.toLowerCase();
    const n = (producto?.nombre || "").toLowerCase();
    const prov = (
      producto?.proveedor_principal ||
      producto?.proveedorPrincipal ||
      producto?.proveedor ||
      ""
    ).toLowerCase();
    return n.includes(st) || prov.includes(st);
  });

  const filteredCostos = costos.filter((producto: any) => {
    const st = searchTerm.toLowerCase();
    const n = (producto?.nombre || "").toLowerCase();
    const prov = (
      producto?.proveedor_principal ||
      producto?.proveedorPrincipal ||
      producto?.proveedor ||
      ""
    ).toLowerCase();
    return n.includes(st) || prov.includes(st);
  });

  /**
   * ✅ COSTOS: se agrupan POR subcuenta_id (NO por label)
   * - Cada subcuenta es un bloque independiente
   * - Si agregas un costo a esa subcuenta, cae en ese bloque y se acomoda “a un lado”
   */
  const costosAgrupados = useMemo(() => {
    const withSub = filteredCostos.filter((p: any) => !!toStrIdOrNull(p?.subcuenta_id));
    const orphan = filteredCostos.filter((p: any) => !toStrIdOrNull(p?.subcuenta_id));

    const groups = new Map<string, { subcuentaId: string; label: string; items: any[] }>();

    for (const p of withSub) {
      const subId = toStrId(p?.subcuenta_id);

      // ✅ resolver label humano: producto -> mapa -> fallback a ID
      const rawLabel = stripSubcuentaPrefix(safeStr(p?.subcuenta_label).trim());
      const fromMap = subcuentaById.get(subId)?.label || "";

      const label =
        (rawLabel && !looksLikeMongoId(rawLabel) ? rawLabel : "") ||
        (fromMap && !looksLikeMongoId(fromMap) ? fromMap : "") ||
        subId; // último recurso: id (pero ya sin "Subcuenta:" duplicado)

      if (!groups.has(subId)) {
        groups.set(subId, { subcuentaId: subId, label, items: [] });
      }
      groups.get(subId)!.items.push(p);
    }

    const groupedList = Array.from(groups.values())
      .sort((a, b) => a.label.localeCompare(b.label, "es"))
      .map((g) => ({
        ...g,
        items: (g.items || []).slice().sort((x, y) => safeStr(x?.nombre).localeCompare(safeStr(y?.nombre), "es")),
      }));

    return {
      groupedList,
      withSubCount: withSub.length,
      orphanCount: orphan.length,
      orphanItems: orphan,
    };
  }, [filteredCostos, subcuentaById]);

  const getVariationColor = (variacion: number) => {
    const v = toNum(variacion, 0);
    if (v > 20) return "text-destructive";
    if (v > 10) return "text-yellow-600";
    return "text-green-600";
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProduct.nombre || !newProduct.tipo || !newProduct.unidad) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa al menos el nombre, tipo y unidad",
        variant: "destructive",
      });
      return;
    }

    if (newProduct.tipo === "gasto" && !newProduct.cuentaContable) {
      toast({
        title: "⚠️ Cuenta contable requerida",
        description: "Selecciona la cuenta contable que se verá afectada por este gasto",
        variant: "destructive",
      });
      return;
    }

    if (newProduct.tipo === "costo" && !newProduct.subcuentaId) {
      toast({
        title: "⚠️ Subcuenta requerida",
        description: "Es obligatorio seleccionar una subcuenta para registrar un costo",
        variant: "destructive",
      });
      return;
    }

    // ✅ Hard guard: gastos solo en cuentas permitidas
    if (newProduct.tipo === "gasto") {
      const allowed = allowedCuentaByTipo("gasto");
      if (!allowed.has(newProduct.cuentaContable)) {
        toast({
          title: "⚠️ Cuenta no permitida",
          description: "Para gastos solo se permiten cuentas 5101–5108 (incluye 5103).",
          variant: "destructive",
        });
        return;
      }
      if (newProduct.subcuentaId) setNewProduct((p) => ({ ...p, subcuentaId: "" }));
    }

    const subId = newProduct.tipo === "costo" ? toStrId(newProduct.subcuentaId) : "";
    const subIdOrNull = newProduct.tipo === "costo" ? subId : null;

    const createData: (CreateProductoEgresoData & Record<string, any>) = {
      nombre: newProduct.nombre,
      descripcion: newProduct.descripcion,
      tipo: newProduct.tipo as "gasto" | "costo",

      unidad: newProduct.unidad,
      proveedor_principal: newProduct.proveedorPrincipal,
      es_recurrente: newProduct.esRecurrente,
      subcuenta_id: subIdOrNull,
      cuenta_contable: newProduct.cuentaContable,
      imagen: newProduct.imagen || undefined,

      // legacy compat
      unidad_medida: newProduct.unidad,
      proveedorPrincipal: newProduct.proveedorPrincipal,
      cuentaCodigo: newProduct.cuentaContable,
      subcuentaId: subIdOrNull,
      esRecurrente: newProduct.esRecurrente,
    };

    createProducto.mutate(createData, {
      onSuccess: () => {
        setNewProduct({
          nombre: "",
          descripcion: "",
          tipo: "",
          unidad: "",
          proveedorPrincipal: "",
          esRecurrente: false,
          subcuentaId: "",
          cuentaContable: "",
          imagen: null,
        });
        setIsDialogOpen(false);
      },
      onError: (err: any) => {
        toast({
          title: "❌ Error",
          description: err?.message || "No se pudo crear el producto",
          variant: "destructive",
        });
      },
    });
  };

  const handleEditProduct = (producto: any) => {
    const p = normalizeProducto(producto);
    if (!p) return;

    setEditingProduct({
      id: p.id,
      nombre: p.nombre || "",
      descripcion: p.descripcion || "",
      tipo: p.tipo || "",
      unidad: p.unidad || "",
      proveedorPrincipal: p.proveedor_principal || "",
      esRecurrente: !!p.es_recurrente,

      // ✅ id real para que FriendlySubcuentaSelector lo refleje al abrir
      subcuentaId: p.subcuenta_id ? String(p.subcuenta_id) : "",

      cuentaContable: p.cuenta_contable || "",
      imagen: null,
    });

    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct?.nombre || !editingProduct?.tipo || !editingProduct?.unidad) {
      toast({
        title: "⚠️ Campos requeridos",
        description: "Completa al menos el nombre, tipo y unidad",
        variant: "destructive",
      });
      return;
    }

    if (editingProduct.tipo === "costo" && !editingProduct.subcuentaId) {
      toast({
        title: "⚠️ Subcuenta requerida",
        description: "Es obligatorio seleccionar una subcuenta para registrar un costo",
        variant: "destructive",
      });
      return;
    }

    if (editingProduct.tipo === "gasto" && !editingProduct.cuentaContable) {
      toast({
        title: "⚠️ Cuenta contable requerida",
        description: "Selecciona la cuenta contable para este gasto",
        variant: "destructive",
      });
      return;
    }

    if (editingProduct.tipo === "gasto") {
      const allowed = allowedCuentaByTipo("gasto");
      if (!allowed.has(editingProduct.cuentaContable)) {
        toast({
          title: "⚠️ Cuenta no permitida",
          description: "Para gastos solo se permiten cuentas 5101–5108 (incluye 5103).",
          variant: "destructive",
        });
        return;
      }
      if (editingProduct.subcuentaId) setEditingProduct((p: any) => ({ ...p, subcuentaId: "" }));
    }

    const subId = editingProduct.tipo === "costo" ? toStrId(editingProduct.subcuentaId) : "";
    const subIdOrNull = editingProduct.tipo === "costo" ? subId : null;

    const updateData: (UpdateProductoEgresoData & Record<string, any>) = {
      id: editingProduct.id,
      nombre: editingProduct.nombre,
      descripcion: editingProduct.descripcion,
      tipo: editingProduct.tipo,

      unidad: editingProduct.unidad,
      proveedor_principal: editingProduct.proveedorPrincipal,
      es_recurrente: editingProduct.esRecurrente,
      subcuenta_id: subIdOrNull,
      cuenta_contable: editingProduct.cuentaContable,
      imagen: editingProduct.imagen || undefined,

      // legacy compat
      unidad_medida: editingProduct.unidad,
      proveedorPrincipal: editingProduct.proveedorPrincipal,
      cuentaCodigo: editingProduct.cuentaContable,
      subcuentaId: subIdOrNull,
      esRecurrente: editingProduct.esRecurrente,
    };

    updateProducto.mutate(updateData, {
      onSuccess: () => {
        setEditingProduct(null);
        setIsEditDialogOpen(false);
      },
      onError: (err: any) => {
        toast({
          title: "❌ Error",
          description: err?.message || "No se pudo actualizar el producto",
          variant: "destructive",
        });
      },
    });
  };

  const renderProductCard = (producto: any) => {
    const precioProm = toNum(producto?.precio_promedio, 0);
    const varPrecio = toNum(producto?.variacion_precio, 0);
    const txs = toNum(producto?.total_transacciones, 0);

    const unidad =
      producto?.unidad || producto?.unidad_medida || producto?.unidadMedida || producto?.unidadDeMedida || "-";

    const proveedor =
      producto?.proveedor_principal || producto?.proveedorPrincipal || producto?.proveedor || "No especificado";

    const imagenUrl = producto?.imagen_url || producto?.imagenUrl || producto?.imageUrl || "";

    const cuentaContable = producto?.cuenta_contable || producto?.cuentaContable || producto?.cuentaCodigo || "";
    const isCosto = producto?.tipo === "costo";

    const subId = producto?.subcuenta_id ? String(producto.subcuenta_id).trim() : "";
    const rawLabel = stripSubcuentaPrefix(safeStr(producto?.subcuenta_label).trim());
    const fromMap = subId ? stripSubcuentaPrefix(subcuentaById.get(subId)?.label || "") : "";

    const subcuentaLabel =
      (rawLabel && !looksLikeMongoId(rawLabel) ? rawLabel : "") ||
      (fromMap && !looksLikeMongoId(fromMap) ? fromMap : "") ||
      "";

    return (
      <Card key={producto.id} className="hover:shadow-md transition-shadow border-border/60">
        <CardHeader className="pb-3">
          <div className="flex gap-3 items-start">
            {imagenUrl ? (
              <img src={imagenUrl} alt={producto.nombre} className="w-16 h-16 object-cover rounded-md border" />
            ) : (
              <div className="w-16 h-16 bg-muted rounded-md border flex items-center justify-center">
                <Package2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{producto.nombre}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {producto.descripcion || "Sin descripción"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm gap-3">
            <span className="text-muted-foreground">Proveedor principal:</span>
            <span className="font-medium truncate">{proveedor}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Unidad:</span>
            <span className="font-medium">{unidad}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cuenta contable:</span>
            <span className="font-medium">{cuentaContable ? `${cuentaContable}` : "No asignada"}</span>
          </div>

          {isCosto && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subcuenta:</span>
              <span className={`font-medium ${subcuentaLabel ? "text-green-600" : "text-destructive"}`}>
                {subcuentaLabel || "No asignada"}
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Precio promedio:</span>
            <span className="font-semibold">
              ${moneyMX(precioProm)}/{unidad}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Variación de precio:</span>
            <span className={`font-medium ${getVariationColor(varPrecio)}`}>±{moneyMX(varPrecio)}%</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Transacciones:</span>
            <span>{txs}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Última compra:</span>
            <span>{producto.ultima_compra ? new Date(producto.ultima_compra).toLocaleDateString() : "-"}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (txs > 0) {
                  navigate(`/egresos/analytics/${producto.id}`);
                } else {
                  toast({
                    title: "📊 Sin datos suficientes",
                    description: `No hay transacciones registradas para "${producto.nombre}" aún.`,
                    variant: "default",
                  });
                }
              }}
            >
              <Eye className="h-3 w-3 mr-1" />
              Analíticas
            </Button>

            <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditProduct(producto)}>
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => deleteProducto.mutate(producto.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const EmptyState = ({ text }: { text: string }) => (
    <Card>
      <CardContent className="text-center py-8">
        <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );

  const LoadingGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gastos o costos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" size="icon" type="button">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Gasto/Costo
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Gasto/Costo</DialogTitle>
              <DialogDescription>Agrega un nuevo item al catálogo de gastos o costos</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={newProduct.nombre}
                    onChange={(e) => setNewProduct({ ...newProduct, nombre: e.target.value })}
                    placeholder="Nombre del producto/servicio"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={newProduct.tipo}
                    onValueChange={(value) => {
                      const updatedProduct = { ...newProduct, tipo: value, subcuentaId: "" };

                      if (value === "costo") updatedProduct.cuentaContable = "5001";
                      else updatedProduct.cuentaContable = "";

                      setNewProduct(updatedProduct);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasto">Gasto</SelectItem>
                      <SelectItem value="costo">Costo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newProduct.tipo === "gasto" && (
                <div className="space-y-2">
                  <Label htmlFor="cuenta-contable">Cuenta Contable a Afectar *</Label>
                  <Select
                    value={newProduct.cuentaContable}
                    onValueChange={(value) => setNewProduct({ ...newProduct, cuentaContable: value, subcuentaId: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta contable" />
                    </SelectTrigger>
                    <SelectContent>
                      {getCuentasAfectadas("gasto").map((cuenta) => (
                        <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                          {cuenta.codigo} - {cuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Para gastos solo se permiten cuentas 5101–5108 (incluye 5103).
                  </p>
                </div>
              )}

              {newProduct.tipo === "costo" && (
                <div className="space-y-2">
                  <Label>Cuenta Contable Asignada</Label>
                  <div className="p-3 bg-muted rounded-md border">
                    <p className="text-sm font-medium">5001 - Costo de Ventas</p>
                    <p className="text-xs text-muted-foreground">✓ Cuenta asignada automáticamente para costos</p>
                  </div>
                </div>
              )}

              {newProduct.tipo === "costo" && (
                <FriendlySubcuentaSelector
                  value={newProduct.subcuentaId}
                  onValueChange={(subcuentaId, cuentaCodigo) =>
                    setNewProduct({ ...newProduct, subcuentaId: toStrId(subcuentaId), cuentaContable: cuentaCodigo })
                  }
                  accountType="costo"
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={newProduct.descripcion}
                  onChange={(e) => setNewProduct({ ...newProduct, descripcion: e.target.value })}
                  placeholder="Descripción del producto/servicio"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imagen">Imagen (Opcional)</Label>
                <Input
                  id="imagen"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewProduct({ ...newProduct, imagen: file });
                  }}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidad">Unidad de Medida *</Label>
                <Select value={newProduct.unidad} onValueChange={(value) => setNewProduct({ ...newProduct, unidad: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                    <SelectItem value="litros">Litros (L)</SelectItem>
                    <SelectItem value="metros">Metros (m)</SelectItem>
                    <SelectItem value="piezas">Piezas (pz)</SelectItem>
                    <SelectItem value="horas">Horas (hrs)</SelectItem>
                    <SelectItem value="servicios">Servicios</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proveedor">Proveedor Principal</Label>
                <Input
                  id="proveedor"
                  value={newProduct.proveedorPrincipal}
                  onChange={(e) => setNewProduct({ ...newProduct, proveedorPrincipal: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createProducto.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  {createProducto.isPending ? "Agregando..." : "Agregar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tip / recomendación */}
      <Card className="bg-muted/30 border-border/60">
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground">
            Recomendación: en <span className="font-medium text-foreground">costos</span> es obligatorio asignar una{" "}
            <span className="font-medium text-foreground">subcuenta</span> para mantener un control contable más claro y un catálogo más ordenado.
          </div>
        </CardContent>
      </Card>

      {/* Gastos */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Catálogo de Gastos</h2>
          <Badge variant="secondary">{filteredGastos.length}</Badge>
        </div>

        {isLoading ? (
          <LoadingGrid />
        ) : filteredGastos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGastos.map(renderProductCard)}
          </div>
        ) : (
          <EmptyState
            text={searchTerm ? "No se encontraron gastos que coincidan con la búsqueda" : "Aún no has agregado gastos al catálogo"}
          />
        )}
      </div>

      {/* Costos (idéntico concepto al catálogo de ingresos: un bloque por subcuenta) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Catálogo de Costos</h2>
          <Badge variant="secondary">{filteredCostos.length}</Badge>

          {!isLoading && filteredCostos.length > 0 && (
            <div className="ml-auto flex gap-2">
              <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">
                Con subcuenta: {costosAgrupados.withSubCount}
              </Badge>
            </div>
          )}
        </div>

        {isLoading ? (
          <LoadingGrid />
        ) : filteredCostos.length === 0 ? (
          <EmptyState
            text={searchTerm ? "No se encontraron costos que coincidan con la búsqueda" : "Aún no has agregado costos al catálogo"}
          />
        ) : (
          <div className="space-y-4">
            {/* pendientes legacy */}
            {costosAgrupados.orphanCount > 0 && (
              <Card className="border-border/60 bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <div className="font-medium">Hay {costosAgrupados.orphanCount} costo(s) sin subcuenta asignada</div>
                        <div className="text-sm text-muted-foreground">
                          Por política, los costos deben tener subcuenta. Edita estos registros para asignarla.
                        </div>
                      </div>
                    </div>

                    <Button variant="outline" onClick={() => setShowOrphanCosts((v) => !v)} className="w-full md:w-auto">
                      {showOrphanCosts ? "Ocultar pendientes" : "Ver pendientes"}
                    </Button>
                  </div>

                  {showOrphanCosts && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {costosAgrupados.orphanItems.map(renderProductCard)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ✅ un bloque por subcuenta real */}
            {costosAgrupados.groupedList.map((g) => {
              const cleanLabel = stripSubcuentaPrefix(g.label);
              return (
                <Card key={g.subcuentaId} className="bg-muted/30 border-border/60">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">Subcuenta: {cleanLabel || g.subcuentaId}</div>
                        <CardDescription>{g.items.length} costo(s)</CardDescription>
                      </div>
                      <Badge variant="secondary">{g.items.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {g.items.map(renderProductCard)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Diálogo de Edición */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Gasto/Costo</DialogTitle>
            <DialogDescription>Modifica la información del producto o servicio</DialogDescription>
          </DialogHeader>

          {editingProduct && (
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nombre">Nombre *</Label>
                  <Input
                    id="edit-nombre"
                    value={editingProduct.nombre}
                    onChange={(e) => setEditingProduct({ ...editingProduct, nombre: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-tipo">Tipo *</Label>
                  <Select
                    value={editingProduct.tipo}
                    onValueChange={(value) => {
                      const next = { ...editingProduct, tipo: value };

                      if (value === "costo") next.cuentaContable = next.cuentaContable || "5001";
                      if (value === "gasto") next.cuentaContable = "";

                      // solo resetear subcuenta si cambia a gasto (para no perder la selección al reabrir)
                      if (value === "gasto") next.subcuentaId = "";

                      setEditingProduct(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasto">Gasto</SelectItem>
                      <SelectItem value="costo">Costo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {editingProduct.tipo === "gasto" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-cuenta-contable">Cuenta Contable a Afectar *</Label>
                  <Select
                    value={editingProduct.cuentaContable}
                    onValueChange={(value) => setEditingProduct({ ...editingProduct, cuentaContable: value, subcuentaId: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta contable" />
                    </SelectTrigger>
                    <SelectContent>
                      {getCuentasAfectadas("gasto").map((cuenta) => (
                        <SelectItem key={cuenta.codigo} value={cuenta.codigo}>
                          {cuenta.codigo} - {cuenta.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editingProduct.tipo === "costo" && (
                <div className="space-y-2">
                  <Label>Cuenta Contable Asignada</Label>
                  <div className="p-3 bg-muted rounded-md border">
                    <p className="text-sm font-medium">5001 - Costo de Ventas</p>
                    <p className="text-xs text-muted-foreground">✓ Cuenta asignada automáticamente para costos</p>
                  </div>
                </div>
              )}

              {editingProduct.tipo === "costo" && (
                <FriendlySubcuentaSelector
                  value={toStrId(editingProduct.subcuentaId)}
                  onValueChange={(subcuentaId, cuentaCodigo) =>
                    setEditingProduct({
                      ...editingProduct,
                      subcuentaId: toStrId(subcuentaId),
                      cuentaContable: cuentaCodigo,
                    })
                  }
                  accountType="costo"
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-descripcion">Descripción</Label>
                <Textarea
                  id="edit-descripcion"
                  value={editingProduct.descripcion}
                  onChange={(e) => setEditingProduct({ ...editingProduct, descripcion: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-unidad">Unidad de Medida *</Label>
                <Select value={editingProduct.unidad} onValueChange={(value) => setEditingProduct({ ...editingProduct, unidad: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                    <SelectItem value="litros">Litros (L)</SelectItem>
                    <SelectItem value="metros">Metros (m)</SelectItem>
                    <SelectItem value="piezas">Piezas (pz)</SelectItem>
                    <SelectItem value="horas">Horas (hrs)</SelectItem>
                    <SelectItem value="servicios">Servicios</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-proveedor">Proveedor Principal</Label>
                <Input
                  id="edit-proveedor"
                  value={editingProduct.proveedorPrincipal}
                  onChange={(e) => setEditingProduct({ ...editingProduct, proveedorPrincipal: e.target.value })}
                  placeholder="Nombre del proveedor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-imagen">Imagen (Opcional)</Label>
                <Input
                  id="edit-imagen"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEditingProduct({ ...editingProduct, imagen: file });
                  }}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">Si eliges una imagen nueva, se reemplazará la anterior.</p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateProducto.isPending}>
                  <Edit className="h-4 w-4 mr-2" />
                  {updateProducto.isPending ? "Actualizando..." : "Actualizar"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CatalogoProductos;
