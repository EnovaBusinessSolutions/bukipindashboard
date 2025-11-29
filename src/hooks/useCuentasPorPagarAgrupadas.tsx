import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  tipo_transaccion: 'egreso' | 'capex';
  // Info del proveedor
  proveedor_nombre: string | null;
  proveedor_email: string | null;
  proveedor_telefono: string | null;
  proveedor_rfc: string | null;
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
  id: 'inventario' | 'capex' | 'operativos' | 'acreedores';
  nombre: string;
  descripcion: string;
  icon: any;
  color: string;
  totalPendiente: number;
  totalFacturas: number;
  totalProveedores: number;
  proveedores: ProveedorAgrupado[];
}

export const useCuentasPorPagarAgrupadas = () => {
  return useQuery({
    queryKey: ['cuentas-por-pagar-agrupadas'],
    queryFn: async () => {
      // 1. Obtener transacciones de egresos con monto pendiente
      const { data: egresos, error: egresosError } = await supabase
        .from('transacciones_egresos')
        .select('*')
        .eq('estado', 'activo')
        .gt('monto_pendiente', 0);

      if (egresosError) throw egresosError;

      // 2. Obtener inversiones CAPEX con monto pendiente (incluye activos vendidos/dados de baja con deuda)
      const { data: inversiones, error: inversionesError } = await supabase
        .from('inversiones_capex')
        .select('*')
        .gt('monto_pendiente', 0);

      if (inversionesError) throw inversionesError;

      // 3. Clasificar egresos por tipo
      const egresosInventario: FacturaCxP[] = [];
      const egresosOperativos: FacturaCxP[] = [];
      const egresosAcreedores: FacturaCxP[] = [];

      egresos?.forEach(egreso => {
        const factura: FacturaCxP = {
          id: egreso.id,
          descripcion: egreso.descripcion,
          monto_total: egreso.monto_total,
          monto_pagado: egreso.monto_pagado,
          monto_pendiente: egreso.monto_pendiente || 0,
          fecha_vencimiento: egreso.fecha_vencimiento,
          created_at: egreso.created_at,
          tipo_pago: egreso.tipo_pago,
          metodo_pago: egreso.metodo_pago,
          estado: egreso.estado,
          tipo_transaccion: 'egreso',
          proveedor_nombre: egreso.proveedor_nombre,
          proveedor_email: egreso.proveedor_email,
          proveedor_telefono: egreso.proveedor_telefono,
          proveedor_rfc: egreso.proveedor_rfc
        };

        // Clasificar por tipo
        if (egreso.tipo_egreso === 'compra_inventario' || egreso.tipo_egreso === 'costo') {
          egresosInventario.push(factura);
        } else if (egreso.cuenta_codigo === '2003') {
          // Acreedores diversos (cuenta 2003)
          egresosAcreedores.push(factura);
        } else {
          egresosOperativos.push(factura);
        }
      });

      // 4. Convertir inversiones CAPEX a formato de factura
      const inversionesCapex: FacturaCxP[] = inversiones?.map(inv => ({
        id: inv.id,
        descripcion: inv.descripcion || inv.producto_nombre,
        monto_total: inv.valor_total,
        monto_pagado: inv.monto_pagado,
        monto_pendiente: inv.monto_pendiente || 0,
        fecha_vencimiento: inv.fecha_vencimiento,
        created_at: inv.created_at,
        tipo_pago: inv.tipo_pago,
        metodo_pago: inv.metodo_pago,
        estado: inv.estado,
        tipo_transaccion: 'capex',
        proveedor_nombre: inv.proveedor_nombre,
        proveedor_email: inv.proveedor_email,
        proveedor_telefono: inv.proveedor_telefono,
        proveedor_rfc: inv.proveedor_rfc
      })) || [];

      // 5. Función para agrupar facturas por proveedor
      const agruparPorProveedor = (facturas: FacturaCxP[]): ProveedorAgrupado[] => {
        const proveedoresMap = new Map<string, ProveedorAgrupado>();

        facturas.forEach(factura => {
          const nombreProveedor = factura.proveedor_nombre || 'Sin proveedor';
          
          if (!proveedoresMap.has(nombreProveedor)) {
            proveedoresMap.set(nombreProveedor, {
              nombre: nombreProveedor,
              email: factura.proveedor_email,
              telefono: factura.proveedor_telefono,
              rfc: factura.proveedor_rfc,
              totalPendiente: 0,
              totalFacturas: 0,
              facturas: []
            });
          }

          const proveedor = proveedoresMap.get(nombreProveedor)!;
          proveedor.totalPendiente += factura.monto_pendiente;
          proveedor.totalFacturas += 1;
          proveedor.facturas.push(factura);
        });

        // Ordenar por monto pendiente (mayor a menor)
        return Array.from(proveedoresMap.values()).sort(
          (a, b) => b.totalPendiente - a.totalPendiente
        );
      };

      // 6. Crear los 4 tipos de CxP
      const tipos: TipoCxP[] = [
        {
          id: 'inventario',
          nombre: 'Compras de Inventario',
          descripcion: 'Compras de mercancía y productos',
          icon: Package,
          color: 'hsl(var(--chart-1))',
          totalPendiente: egresosInventario.reduce((sum, f) => sum + f.monto_pendiente, 0),
          totalFacturas: egresosInventario.length,
          totalProveedores: new Set(egresosInventario.map(f => f.proveedor_nombre)).size,
          proveedores: agruparPorProveedor(egresosInventario)
        },
        {
          id: 'capex',
          nombre: 'Inversiones CAPEX',
          descripcion: 'Inversiones en activos fijos',
          icon: Building2,
          color: 'hsl(var(--chart-2))',
          totalPendiente: inversionesCapex.reduce((sum, f) => sum + f.monto_pendiente, 0),
          totalFacturas: inversionesCapex.length,
          totalProveedores: new Set(inversionesCapex.map(f => f.proveedor_nombre)).size,
          proveedores: agruparPorProveedor(inversionesCapex)
        },
        {
          id: 'operativos',
          nombre: 'Gastos Operativos',
          descripcion: 'Gastos operativos del negocio',
          icon: Receipt,
          color: 'hsl(var(--chart-3))',
          totalPendiente: egresosOperativos.reduce((sum, f) => sum + f.monto_pendiente, 0),
          totalFacturas: egresosOperativos.length,
          totalProveedores: new Set(egresosOperativos.map(f => f.proveedor_nombre)).size,
          proveedores: agruparPorProveedor(egresosOperativos)
        },
        {
          id: 'acreedores',
          nombre: 'Acreedores Diversos',
          descripcion: 'Otras cuentas por pagar',
          icon: Users,
          color: 'hsl(var(--chart-4))',
          totalPendiente: egresosAcreedores.reduce((sum, f) => sum + f.monto_pendiente, 0),
          totalFacturas: egresosAcreedores.length,
          totalProveedores: new Set(egresosAcreedores.map(f => f.proveedor_nombre)).size,
          proveedores: agruparPorProveedor(egresosAcreedores)
        }
      ];

      return tipos;
    }
  });
};
