import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";

interface BalanzaEntry {
  fecha: string;
  tipo: string;
  descripcion: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
  referencia: string;
}

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

type DetalleAsientoRow = {
  cuenta_codigo: string;
  debe: number | string | null;
  haber: number | string | null;
  descripcion?: string | null;
  asiento?: {
    fecha?: string | null; // "YYYY-MM-DD"
    descripcion?: string | null;
    numero_asiento?: string | null;
  } | null;
};

export const useAsientosBalanza = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["asientos-balanza", startDate, endDate],
    queryFn: async () => {
      // Usar endDate tal cual; la balanza debe mostrar TODOS los asientos en rango
      const start = startDate.toISOString().split("T")[0];
      const end = endDate.toISOString().split("T")[0];

      // 1) Traer movimientos (detalle_asientos + asiento)
      const detallesJson = await apiFetch(
        `/api/contabilidad/asientos/detalle?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { method: "GET" }
      );
      const detalles: DetalleAsientoRow[] = (detallesJson as any)?.data ?? detallesJson ?? [];

      // 2) Traer catálogo de cuentas (codigo, nombre)
      const cuentasJson = await apiFetch(`/api/catalogos/cuentas?fields=codigo,nombre`, { method: "GET" });
      const cuentasData: Array<{ codigo: string; nombre: string }> =
        (cuentasJson as any)?.data ?? cuentasJson ?? [];

      const cuentasMap = new Map(cuentasData.map((c) => [c.codigo, c.nombre]));

      // 3) Transformar a BalanzaEntry
      const movimientos: BalanzaEntry[] = (detalles || []).map((detalle) => {
        const asiento = detalle.asiento || null;
        const numeroAsiento = asiento?.numero_asiento || "";

        // Tipo por prefijo
        let tipo = "Otro";
        if (numeroAsiento.startsWith("ING-")) tipo = "Ingreso";
        else if (numeroAsiento.startsWith("EGR-")) tipo = "Egreso";
        else if (numeroAsiento.startsWith("INV-")) tipo = "Inversión";
        else if (numeroAsiento.startsWith("CAP-")) tipo = "Capital";
        else if (numeroAsiento.startsWith("FIN-")) tipo = "Financiamiento";
        else if (numeroAsiento.startsWith("IMP-") || numeroAsiento.startsWith("ISR-")) tipo = "Impuesto";
        else if (numeroAsiento.startsWith("COB-")) tipo = "Cobro";
        else if (numeroAsiento.startsWith("PAG-CXP-")) tipo = "Pago CxP";
        else if (numeroAsiento.startsWith("PAG-")) tipo = "Pago";
        else if (numeroAsiento.startsWith("DEP-")) tipo = "Depreciación";

        // Descripción final: preferir asiento.descripcion (más confiable)
        const descripcionFinal = asiento?.descripcion || detalle.descripcion || "";

        // Formatear fecha (evitar offset TZ): parse manual YYYY-MM-DD
        let fechaFormateada = "";
        const rawFecha = asiento?.fecha;
        if (rawFecha) {
          const parts = rawFecha.split("-");
          if (parts.length === 3) {
            const yyyy = parseInt(parts[0], 10);
            const mm = parseInt(parts[1], 10) - 1;
            const dd = parseInt(parts[2], 10);
            const d = new Date(yyyy, mm, dd);
            fechaFormateada = format(d, "dd/MM/yyyy");
          }
        }

        const cuentaCodigo = detalle.cuenta_codigo;

        return {
          fecha: fechaFormateada,
          tipo,
          descripcion: descripcionFinal,
          cuenta_codigo: cuentaCodigo,
          cuenta_nombre: cuentasMap.get(cuentaCodigo) || cuentaCodigo,
          debe: Number(detalle.debe) || 0,
          haber: Number(detalle.haber) || 0,
          referencia: numeroAsiento,
        };
      });

      // 4) Saldos por cuenta
      const saldosPorCuenta: Record<string, SaldoCuenta> = {};

      movimientos.forEach((mov) => {
        const codigo = mov.cuenta_codigo;
        if (!saldosPorCuenta[codigo]) {
          saldosPorCuenta[codigo] = {
            cuenta_codigo: codigo,
            debe_total: 0,
            haber_total: 0,
            saldo: 0,
          };
        }
        saldosPorCuenta[codigo].debe_total += mov.debe;
        saldosPorCuenta[codigo].haber_total += mov.haber;
      });

      // 5) Naturaleza (deudora/acreedor)
      Object.values(saldosPorCuenta).forEach((cuenta) => {
        const primerDigito = cuenta.cuenta_codigo.charAt(0);

        // Deudora: Activos(1), Costos(5), Gastos(6)
        if (["1", "5", "6"].includes(primerDigito)) {
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
        // Acreedora: Pasivos(2), Capital(3), Ingresos(4)
        else if (["2", "3", "4"].includes(primerDigito)) {
          cuenta.saldo = cuenta.haber_total - cuenta.debe_total;
        } else {
          // Fallback: deudora por defecto
          cuenta.saldo = cuenta.debe_total - cuenta.haber_total;
        }
      });

      return { movimientos, saldosPorCuenta };
    },
    enabled: !!startDate && !!endDate,
  });
};
