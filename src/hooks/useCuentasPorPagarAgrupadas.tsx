import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Package, Building2, Receipt, Users } from "lucide-react";

export interface FacturaCxP {
  id: string;
  descripcion: string;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_vencimiento: string | null;
  created_at: string;
  tipo_pago: string;
  metodo_pago: string | null;
  estado: string;
  tipo_transaccion: "egreso" | "capex";

  // Info del proveedor
  proveedor_nombre: string | null;
  proveedor_email: string | null;
  proveedor_telefono: string | null;
  proveedor_rfc: string | null;

  // Campos extra opcionales para clasificar
  tipo_egreso?: string | null;
  subtipo_egreso?: string | null;
  cuenta_codigo?: string | null;
}

export interface ProveedorAgrupado {
  nombre: string;
  email: string | null;
  telefono: string | null;
  rfc: string | null;
  totalPendiente: number;
  totalFacturas: number;
  facturas: FacturaCxP[];
}

export interface TipoCxP {
  id: "inventario" | "capex" | "operativos" | "acreedores";
  nombre: string;
  descripcion: string;
  icon: any;
  color: string;
  totalPendiente: number;
  totalFacturas: number;
  totalProveedores: number;
  proveedores: ProveedorAgrupado[];
}

type AnyJson = any;

function toNum(v: any, def = 0) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : def;
}

function safeStr(v: any, def = "") {
  if (v === undefined || v === null) return def;
  return String(v);
}

function pickId(x: any) {
  return safeStr(x?.id || x?._id || "");
}

function pickCreatedAt(x: any) {
  return safeStr(x?.created_at || x?.createdAt || x?.fecha || x?.date || new Date().toISOString());
}

function pickFechaVencimiento(x: any) {
  const v =
    x?.fecha_vencimiento ??
    x?.fechaVencimiento ??
    x?.fechaLimite ??
    x?.fecha_limite ??
    x?.dueDate ??
    null;

  const s = safeStr(v, "").trim();
  return s ? s : null;
}

function pickMetodoPago(x: any) {
  const v = x?.metodo_pago ?? x?.metodoPago ?? x?.metodo ?? null;
  const s = safeStr(v, "").trim();
  return s ? s : null;
}

function normalizeTipoPago(x: any) {
  const s = safeStr(x?.tipo_pago ?? x?.tipoPago ?? "").toLowerCase().trim();
  if (!s) return "";
  if (["contado", "total", "pago_total"].includes(s)) return "contado";
  if (["credito", "crédito"].includes(s)) return "credito";
  if (["parcial", "parciales"].includes(s)) return "parcial";
  return s;
}

function normalizeEstado(x: any) {
  const s = safeStr(x?.estado ?? x?.status ?? "activo").toLowerCase().trim();
  return s || "activo";
}

function pickTipoEgreso(x: any) {
  return safeStr(x?.tipo_egreso ?? x?.tipoEgreso ?? x?.tipo ?? "").toLowerCase().trim() || null;
}

function pickSubtipoEgreso(x: any) {
  return (
    safeStr(x?.subtipo_egreso ?? x?.subtipoEgreso ?? x?.subtipo ?? "").toLowerCase().trim() || null
  );
}

function pickCuentaCodigo(x: any) {
  return safeStr(x?.cuenta_codigo ?? x?.cuentaCodigo ?? "").trim() || null;
}

// ✅ Fetch tolerante: si endpoint falla, devolvemos []
async function safeGetArray(url: string): Promise<any[]> {
  try {
    const json: AnyJson = await apiFetch(url, { method: "GET" });
    const raw = (json?.data ?? json ?? []) as AnyJson[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// ✅ Regla correcta Acreedores:
// En tu backend “Otros gastos” se identifica por subtipo_egreso = "otros_gastos"
// NO por cuenta 2003 en ExpenseTransaction (esa vive en JournalEntry)
function isAcreedoresDiversos(egreso: any) {
  const subtipo = pickSubtipoEgreso(egreso);
  const tipo = pickTipoEgreso(egreso);

  // señales fuertes
  if (subtipo === "otros_gastos") return true;
  if (tipo === "otro") return true;

  // señales suaves (por si el FE manda algo raro)
  if (safeStr(subtipo).includes("otros")) return true;

  return false;
}

function isCompraInventario(egreso: any) {
  const tipo = pickTipoEgreso(egreso);
  const subtipo = pickSubtipoEgreso(egreso);
  const cuenta = pickCuentaCodigo(egreso);

  // heurísticas existentes
  if (tipo === "compra_inventario") return true;
  if (tipo === "costo") return true;

  // por si viene subtipo específico
  if (safeStr(subtipo).includes("invent")) return true;

  // si tu sistema usa alguna cuenta específica para compras inventario (ajusta si aplica)
  if (cuenta === "5002") return true;

  return false;
}

export const useCuentasPorPagarAgrupadas = () => {
  return useQuery<TipoCxP[]>({
    queryKey: ["cuentas-por-pagar-agrupadas"],
    queryFn: async () => {
      /**
       * Endpoints que usa HOY la UI:
       * - Egresos pendientes: /api/transacciones/egresos?estado=activo&pendiente_gt=0
       * - CAPEX pendientes: /api/inversiones/capex?pendiente_gt=0
       *
       * ⚠️ Nota: si alguno no existe, devolvemos [] para que el panel NO reviente.
       */

      const egresosRaw = await safeGetArray("/api/transacciones/egresos?estado=activo&pendiente_gt=0");
      const inversionesRaw = await safeGetArray("/api/inversiones/capex?pendiente_gt=0");

      // Clasificar egresos por tipo
      const egresosInventario: FacturaCxP[] = [];
      const egresosOperativos: FacturaCxP[] = [];
      const egresosAcreedores: FacturaCxP[] = [];

      egresosRaw.forEach((egreso) => {
        const tipoPago = normalizeTipoPago(egreso);
        const montoTotal = toNum(egreso?.monto_total ?? egreso?.montoTotal ?? egreso?.total, 0);
        const montoPagado = toNum(egreso?.monto_pagado ?? egreso?.montoPagado, 0);
        const montoPendiente = toNum(egreso?.monto_pendiente ?? egreso?.montoPendiente, 0);

        const factura: FacturaCxP = {
          id: pickId(egreso),
          descripcion: safeStr(egreso?.descripcion ?? egreso?.concepto ?? egreso?.concept ?? ""),
          monto_total: montoTotal,
          monto_pagado: montoPagado,
          monto_pendiente: montoPendiente,
          fecha_vencimiento: pickFechaVencimiento(egreso),
          created_at: pickCreatedAt(egreso),
          tipo_pago: tipoPago,
          metodo_pago: pickMetodoPago(egreso),
          estado: normalizeEstado(egreso),
          tipo_transaccion: "egreso",

          proveedor_nombre: egreso?.proveedor_nombre ?? egreso?.proveedorNombre ?? null,
          proveedor_email: egreso?.proveedor_email ?? egreso?.proveedorEmail ?? null,
          proveedor_telefono: egreso?.proveedor_telefono ?? egreso?.proveedorTelefono ?? null,
          proveedor_rfc: egreso?.proveedor_rfc ?? egreso?.proveedorRfc ?? null,

          tipo_egreso: pickTipoEgreso(egreso),
          subtipo_egreso: pickSubtipoEgreso(egreso),
          cuenta_codigo: pickCuentaCodigo(egreso),
        };

        // ✅ Solo nos interesan pendientes (por si el endpoint manda más)
        // Crédito/parcial con saldo > 0
        const isPendiente = (factura.monto_pendiente ?? 0) > 0 && ["credito", "parcial"].includes(factura.tipo_pago);
        if (!isPendiente) return;

        // Clasificación por reglas del cliente
        if (isAcreedoresDiversos(egreso)) {
          egresosAcreedores.push(factura);
        } else if (isCompraInventario(egreso)) {
          egresosInventario.push(factura);
        } else {
          egresosOperativos.push(factura);
        }
      });

      // Convertir inversiones CAPEX a formato de factura
      const inversionesCapex: FacturaCxP[] = (inversionesRaw || []).map((inv) => {
        const tipoPago = normalizeTipoPago(inv);
        return {
          id: pickId(inv),
          descripcion: safeStr(inv?.descripcion || inv?.producto_nombre || "CAPEX"),
          monto_total: toNum(inv?.valor_total ?? inv?.monto_total ?? inv?.total, 0),
          monto_pagado: toNum(inv?.monto_pagado ?? inv?.montoPagado, 0),
          monto_pendiente: toNum(inv?.monto_pendiente ?? inv?.montoPendiente, 0),
          fecha_vencimiento: pickFechaVencimiento(inv),
          created_at: pickCreatedAt(inv),
          tipo_pago: tipoPago,
          metodo_pago: pickMetodoPago(inv),
          estado: normalizeEstado(inv),
          tipo_transaccion: "capex",

          proveedor_nombre: inv?.proveedor_nombre ?? inv?.proveedorNombre ?? null,
          proveedor_email: inv?.proveedor_email ?? inv?.proveedorEmail ?? null,
          proveedor_telefono: inv?.proveedor_telefono ?? inv?.proveedorTelefono ?? null,
          proveedor_rfc: inv?.proveedor_rfc ?? inv?.proveedorRfc ?? null,
        };
      });

      // Agrupar facturas por proveedor
      const agruparPorProveedor = (facturas: FacturaCxP[]): ProveedorAgrupado[] => {
        const proveedoresMap = new Map<string, ProveedorAgrupado>();

        facturas.forEach((factura) => {
          const nombreProveedor = factura.proveedor_nombre || "Sin proveedor";

          if (!proveedoresMap.has(nombreProveedor)) {
            proveedoresMap.set(nombreProveedor, {
              nombre: nombreProveedor,
              email: factura.proveedor_email,
              telefono: factura.proveedor_telefono,
              rfc: factura.proveedor_rfc,
              totalPendiente: 0,
              totalFacturas: 0,
              facturas: [],
            });
          }

          const proveedor = proveedoresMap.get(nombreProveedor)!;
          proveedor.totalPendiente += toNum(factura.monto_pendiente, 0);
          proveedor.totalFacturas += 1;
          proveedor.facturas.push(factura);
        });

        return Array.from(proveedoresMap.values()).sort((a, b) => b.totalPendiente - a.totalPendiente);
      };

      const countUniqueProviders = (items: FacturaCxP[]) => {
        const s = new Set((items || []).map((f) => f.proveedor_nombre || "Sin proveedor"));
        return s.size;
      };

      // Crear los 4 tipos de CxP (SIEMPRE presentes)
      const tipos: TipoCxP[] = [
        {
          id: "inventario",
          nombre: "Compras de Inventario",
          descripcion: "Compras de mercancía y productos",
          icon: Package,
          color: "hsl(var(--chart-1))",
          totalPendiente: egresosInventario.reduce((sum, f) => sum + toNum(f.monto_pendiente, 0), 0),
          totalFacturas: egresosInventario.length,
          totalProveedores: countUniqueProviders(egresosInventario),
          proveedores: agruparPorProveedor(egresosInventario),
        },
        {
          id: "capex",
          nombre: "Inversiones CAPEX",
          descripcion: "Inversiones en activos fijos",
          icon: Building2,
          color: "hsl(var(--chart-2))",
          totalPendiente: inversionesCapex.reduce((sum, f) => sum + toNum(f.monto_pendiente, 0), 0),
          totalFacturas: inversionesCapex.filter((f) => toNum(f.monto_pendiente, 0) > 0).length,
          totalProveedores: countUniqueProviders(inversionesCapex.filter((f) => toNum(f.monto_pendiente, 0) > 0)),
          proveedores: agruparPorProveedor(inversionesCapex.filter((f) => toNum(f.monto_pendiente, 0) > 0)),
        },
        {
          id: "operativos",
          nombre: "Egresos Operativos",
          descripcion: "Egresos operativos del negocio",
          icon: Receipt,
          color: "hsl(var(--chart-3))",
          totalPendiente: egresosOperativos.reduce((sum, f) => sum + toNum(f.monto_pendiente, 0), 0),
          totalFacturas: egresosOperativos.length,
          totalProveedores: countUniqueProviders(egresosOperativos),
          proveedores: agruparPorProveedor(egresosOperativos),
        },
        {
          id: "acreedores",
          nombre: "Acreedores Diversos",
          descripcion: "Otras cuentas por pagar",
          icon: Users,
          color: "hsl(var(--chart-4))",
          totalPendiente: egresosAcreedores.reduce((sum, f) => sum + toNum(f.monto_pendiente, 0), 0),
          totalFacturas: egresosAcreedores.length,
          totalProveedores: countUniqueProviders(egresosAcreedores),
          proveedores: agruparPorProveedor(egresosAcreedores),
        },
      ];

      return tipos;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};