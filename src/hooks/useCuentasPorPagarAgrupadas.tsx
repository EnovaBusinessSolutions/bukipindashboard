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

export const useCuentasPorPagarAgrupadas = () => {
  return useQuery<TipoCxP[]>({
    queryKey: ["cuentas-por-pagar-agrupadas"],
    queryFn: async () => {
      /**
       * Endpoints esperados:
       * - GET /api/transacciones/egresos?estado=activo&pendiente_gt=0
       * - GET /api/inversiones/capex?pendiente_gt=0
       *
       * Respuesta puede ser:
       *  - array directo
       *  - { ok:true, data:[...] }
       */

      const egresosJson: AnyJson = await apiFetch(
        "/api/transacciones/egresos?estado=activo&pendiente_gt=0",
        { method: "GET" }
      );
      const egresosRaw = (egresosJson?.data ?? egresosJson ?? []) as AnyJson[];

      const inversionesJson: AnyJson = await apiFetch(
        "/api/inversiones/capex?pendiente_gt=0",
        { method: "GET" }
      );
      const inversionesRaw = (inversionesJson?.data ?? inversionesJson ?? []) as AnyJson[];

      // 3. Clasificar egresos por tipo
      const egresosInventario: FacturaCxP[] = [];
      const egresosOperativos: FacturaCxP[] = [];
      const egresosAcreedores: FacturaCxP[] = [];

      egresosRaw.forEach((egreso) => {
        const factura: FacturaCxP = {
          id: egreso.id,
          descripcion: egreso.descripcion,
          monto_total: Number(egreso.monto_total || 0),
          monto_pagado: Number(egreso.monto_pagado || 0),
          monto_pendiente: Number(egreso.monto_pendiente || 0),
          fecha_vencimiento: egreso.fecha_vencimiento ?? null,
          created_at: egreso.created_at,
          tipo_pago: egreso.tipo_pago,
          metodo_pago: egreso.metodo_pago ?? null,
          estado: egreso.estado,
          tipo_transaccion: "egreso",
          proveedor_nombre: egreso.proveedor_nombre ?? null,
          proveedor_email: egreso.proveedor_email ?? null,
          proveedor_telefono: egreso.proveedor_telefono ?? null,
          proveedor_rfc: egreso.proveedor_rfc ?? null,
          tipo_egreso: egreso.tipo_egreso ?? null,
          cuenta_codigo: egreso.cuenta_codigo ?? null,
        };

        // Clasificar por tipo
        if (egreso.tipo_egreso === "compra_inventario" || egreso.tipo_egreso === "costo") {
          egresosInventario.push(factura);
        } else if (egreso.cuenta_codigo === "2003") {
          // Acreedores diversos (cuenta 2003)
          egresosAcreedores.push(factura);
        } else {
          egresosOperativos.push(factura);
        }
      });

      // 4. Convertir inversiones CAPEX a formato de factura
      const inversionesCapex: FacturaCxP[] =
        (inversionesRaw || []).map((inv) => ({
          id: inv.id,
          descripcion: inv.descripcion || inv.producto_nombre,
          monto_total: Number(inv.valor_total || 0),
          monto_pagado: Number(inv.monto_pagado || 0),
          monto_pendiente: Number(inv.monto_pendiente || 0),
          fecha_vencimiento: inv.fecha_vencimiento ?? null,
          created_at: inv.created_at,
          tipo_pago: inv.tipo_pago,
          metodo_pago: inv.metodo_pago ?? null,
          estado: inv.estado,
          tipo_transaccion: "capex",
          proveedor_nombre: inv.proveedor_nombre ?? null,
          proveedor_email: inv.proveedor_email ?? null,
          proveedor_telefono: inv.proveedor_telefono ?? null,
          proveedor_rfc: inv.proveedor_rfc ?? null,
        })) || [];

      // 5. Función para agrupar facturas por proveedor
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
          proveedor.totalPendiente += Number(factura.monto_pendiente || 0);
          proveedor.totalFacturas += 1;
          proveedor.facturas.push(factura);
        });

        return Array.from(proveedoresMap.values()).sort(
          (a, b) => b.totalPendiente - a.totalPendiente
        );
      };

      // Helpers para totales únicos (evitar contar null como proveedor real)
      const countUniqueProviders = (items: FacturaCxP[]) => {
        const s = new Set((items || []).map((f) => f.proveedor_nombre || "Sin proveedor"));
        return s.size;
      };

      // 6. Crear los 4 tipos de CxP
      const tipos: TipoCxP[] = [
        {
          id: "inventario",
          nombre: "Compras de Inventario",
          descripcion: "Compras de mercancía y productos",
          icon: Package,
          color: "hsl(var(--chart-1))",
          totalPendiente: egresosInventario.reduce((sum, f) => sum + f.monto_pendiente, 0),
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
          totalPendiente: inversionesCapex.reduce((sum, f) => sum + f.monto_pendiente, 0),
          totalFacturas: inversionesCapex.length,
          totalProveedores: countUniqueProviders(inversionesCapex),
          proveedores: agruparPorProveedor(inversionesCapex),
        },
        {
          id: "operativos",
          nombre: "Gastos Operativos",
          descripcion: "Gastos operativos del negocio",
          icon: Receipt,
          color: "hsl(var(--chart-3))",
          totalPendiente: egresosOperativos.reduce((sum, f) => sum + f.monto_pendiente, 0),
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
          totalPendiente: egresosAcreedores.reduce((sum, f) => sum + f.monto_pendiente, 0),
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
