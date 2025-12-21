/**
 * Utilidades compartidas para clasificación de asientos en el Flujo de Efectivo
 *
 * Este archivo contiene la ÚNICA FUENTE DE VERDAD para clasificar asientos contables
 * en las tres categorías del flujo de efectivo: Operativo, Inversión y Financiamiento
 */

import { apiFetch } from "@/lib/api";

export type CategoriaFlujo = "Operativo" | "Inversion" | "Financiamiento" | "Sin Clasificar";

export interface DetalleAsiento {
  cuenta_codigo: string;
  debe: number;
  haber: number;
  descripcion?: string;
}

export interface ResultadoClasificacion {
  categoria: CategoriaFlujo;
  subcategoria: string;
  impactoEfectivo: number;
  impactoBancos: number;
  impactoTotal: number;
}

type SaldoInicialResponse = {
  efectivo: number;
  bancos: number;
  total: number;
};

/**
 * Formatea fecha como YYYY-MM-DD usando hora local (evita desfases por timezone con toISOString()).
 */
function formatYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      (json && (json.error || json.message)) ||
      `Error HTTP ${res.status}`;
    throw new Error(msg);
  }

  return (json?.data ?? json) as T;
}


/**
 * Clasifica un asiento contable en una de las tres categorías del flujo de efectivo
 * según las contrapartidas de efectivo/bancos
 *
 * REGLAS DE CLASIFICACIÓN (basadas en el plan de cuentas):
 *
 * OPERATIVO:
 * - Ingresos: 4XXX
 * - Costos: 1005, 1006, 5001
 * - Gastos: 51XX, 6XXX
 * - Cuentas por cobrar/pagar: 1003, 1004, 2001-2006
 * - Impuestos: 1007, 1008
 *
 * INVERSIÓN:
 * - Activos fijos: 12XX (1201-1299)
 * - Activos diferidos: 13XX
 *
 * FINANCIAMIENTO:
 * - Préstamos: 20XX, 21XX
 * - Capital: 3001, 3002, 3003
 */
export const clasificarAsiento = (detalles: DetalleAsiento[]): ResultadoClasificacion => {
  // Calcular impacto en efectivo y bancos
  let impactoEfectivo = 0;
  let impactoBancos = 0;

  detalles.forEach((d) => {
    if (d.cuenta_codigo === "1001") {
      impactoEfectivo += (d.debe || 0) - (d.haber || 0);
    } else if (d.cuenta_codigo === "1002") {
      impactoBancos += (d.debe || 0) - (d.haber || 0);
    }
  });

  const impactoTotal = impactoEfectivo + impactoBancos;

  // Clasificar según contrapartidas
  let categoria: CategoriaFlujo = "Sin Clasificar";
  let subcategoria = "";

  for (const d of detalles) {
    const codigo = d.cuenta_codigo;
    if (!codigo) continue;
    if (codigo === "1001" || codigo === "1002") continue;

    // ============= OPERATIVO =============
    // Ingresos por ventas (4XXX)
    if (codigo.startsWith("4")) {
      categoria = "Operativo";
      subcategoria = impactoTotal > 0 ? "Cobro por Ventas/Ingresos" : "Devolución de Ventas";
      break;
    }
    // Cuentas por cobrar (1003, 1004)
    else if (codigo === "1003" || codigo === "1004") {
      categoria = "Operativo";
      subcategoria = impactoTotal > 0 ? "Cobro de Clientes" : "Registro de CxC";
      break;
    }
    // Inventario (1005, 1006)
    else if (codigo === "1005" || codigo === "1006") {
      categoria = "Operativo";
      subcategoria = impactoTotal < 0 ? "Pago por Compra de Inventario" : "Venta de Inventario";
      break;
    }
    // Costo de ventas (5001)
    else if (codigo === "5001") {
      categoria = "Operativo";
      subcategoria = "Costo de Ventas";
      break;
    }
    // Gastos operativos (51XX, 6XXX)
    else if (codigo.startsWith("51") || codigo.startsWith("6")) {
      categoria = "Operativo";
      subcategoria = impactoTotal < 0 ? "Pago de Gastos Operativos" : "Reembolso de Gastos";
      break;
    }
    // Proveedores y pasivos circulantes (2001-2006)
    else if (["2001", "2002", "2003", "2004", "2005", "2006"].includes(codigo)) {
      categoria = "Operativo";
      subcategoria = impactoTotal < 0 ? "Pago a Proveedores/Gastos" : "Registro de CxP";
      break;
    }
    // IVA y gastos anticipados (1007, 1008)
    else if (codigo === "1007" || codigo === "1008") {
      categoria = "Operativo";
      subcategoria = impactoTotal < 0 ? "Pago de IVA/Anticipos" : "Recuperación de Anticipos";
      break;
    }

    // ============= INVERSIÓN =============
    // Activos fijos (12XX)
    else if (codigo.startsWith("12") && Number.parseInt(codigo, 10) >= 1201) {
      categoria = "Inversion";
      subcategoria = impactoTotal < 0 ? "Adquisición de Activos Fijos" : "Venta de Activos Fijos";
      break;
    }
    // Activos diferidos (13XX)
    else if (codigo.startsWith("13")) {
      categoria = "Inversion";
      subcategoria = impactoTotal < 0 ? "Gastos Diferidos" : "Recuperación de Diferidos";
      break;
    }

    // ============= FINANCIAMIENTO =============
    // Préstamos y financiamientos (20XX, 21XX)
    else if (codigo.startsWith("20") || codigo.startsWith("21")) {
      categoria = "Financiamiento";
      subcategoria = impactoTotal > 0 ? "Disposición de Préstamo" : "Amortización de Préstamo";
      break;
    }
    // Capital (3001, 3002, 3003)
    else if (["3001", "3002", "3003"].includes(codigo)) {
      categoria = "Financiamiento";
      subcategoria = impactoTotal > 0 ? "Aportación de Capital" : "Retiro de Capital";
      break;
    }
  }

  return {
    categoria,
    subcategoria,
    impactoEfectivo,
    impactoBancos,
    impactoTotal,
  };
};

/**
 * Agrupa clasificaciones por categoría
 */
export const agruparPorCategoria = (clasificaciones: ResultadoClasificacion[]) => {
  const operativo = { efectivo: 0, bancos: 0, total: 0, detalles: [] as ResultadoClasificacion[] };
  const inversion = { efectivo: 0, bancos: 0, total: 0, detalles: [] as ResultadoClasificacion[] };
  const financiamiento = { efectivo: 0, bancos: 0, total: 0, detalles: [] as ResultadoClasificacion[] };

  clasificaciones.forEach((c) => {
    if (c.categoria === "Operativo") {
      operativo.efectivo += c.impactoEfectivo;
      operativo.bancos += c.impactoBancos;
      operativo.total += c.impactoTotal;
      operativo.detalles.push(c);
    } else if (c.categoria === "Inversion") {
      inversion.efectivo += c.impactoEfectivo;
      inversion.bancos += c.impactoBancos;
      inversion.total += c.impactoTotal;
      inversion.detalles.push(c);
    } else if (c.categoria === "Financiamiento") {
      financiamiento.efectivo += c.impactoEfectivo;
      financiamiento.bancos += c.impactoBancos;
      financiamiento.total += c.impactoTotal;
      financiamiento.detalles.push(c);
    }
  });

  return { operativo, inversion, financiamiento };
};

/**
 * Calcula el saldo inicial de efectivo/bancos antes de una fecha
 *

 * - Llama al backend con cookies (credentials: include) vía apiFetch()
 *
 * Endpoint requerido:
 * GET /api/asientos/saldo-inicial?before=YYYY-MM-DD&accounts=1001,1002
 *
 * Respuesta esperada:
 * { ok:true, data:{ efectivo:number, bancos:number, total:number } }
 * (o payload plano con esos campos)
 */
export const calcularSaldoInicial = async (
  fechaInicio: Date,
  cuentas: string[] = ["1001", "1002"]
): Promise<SaldoInicialResponse> => {
  const before = formatYYYYMMDD(fechaInicio);
  const accounts = encodeURIComponent(cuentas.join(","));

  const data = await apiJson<SaldoInicialResponse>(
    `/api/asientos/saldo-inicial?before=${before}&accounts=${accounts}`
  );

  return {
    efectivo: Number(data.efectivo || 0),
    bancos: Number(data.bancos || 0),
    total: Number(data.total || 0),
  };
};
