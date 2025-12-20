import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface CostoMensual {
  mes: string;
  mesNumero: number;
  [key: string]: number | string; // Para las cuentas dinámicas
}

interface CostoPorCuenta {
  cuenta: string;
  nombreCuenta: string;
  data: { mes: string; monto: number }[];
}

type EgresoCostoRow = {
  monto_total: number | null;
  cuenta_codigo: string | null;
  subcuenta_id: string | null;
  created_at: string;
};

type CuentaRow = {
  codigo: string;
  nombre: string;
};

export const useCostosMensuales = (año?: number, enabled: boolean = true) => {
  const añoActual = año || new Date().getFullYear();

  return useQuery({
    queryKey: ["costos-mensuales", añoActual],
    enabled,
    queryFn: async () => {
      const meses = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      // Rango anual (ISO)
      const fechaInicioAño = new Date(añoActual, 0, 1, 0, 0, 0, 0).toISOString();
      const fechaFinAño = new Date(añoActual, 11, 31, 23, 59, 59, 999).toISOString();

      // ✅ 1) Traer todos los egresos tipo "costo" del año (una sola llamada)
      // Endpoint esperado:
      // GET /api/egresos?tipo_egreso=costo&start=...&end=...&fields=monto_total,cuenta_codigo,subcuenta_id,created_at
      const egresosJson = await apiFetch(
        `/api/egresos?tipo_egreso=costo&start=${encodeURIComponent(fechaInicioAño)}&end=${encodeURIComponent(
          fechaFinAño
        )}&fields=monto_total,cuenta_codigo,subcuenta_id,created_at`,
        { method: "GET" }
      );
      const transaccionesAño: EgresoCostoRow[] = (egresosJson as any)?.data ?? egresosJson ?? [];

      // Agrupar transacciones por mes
      const transaccionesPorMes = new Map<number, EgresoCostoRow[]>();

      (transaccionesAño || []).forEach((t) => {
        const mes = new Date(t.created_at).getMonth(); // 0-11
        if (!transaccionesPorMes.has(mes)) transaccionesPorMes.set(mes, []);
        transaccionesPorMes.get(mes)!.push(t);
      });

      const costosMensuales: CostoMensual[] = [];
      const costosPorCuentaMap = new Map<string, CostoPorCuenta>();

      // Procesar cada mes
      for (let mes = 0; mes < 12; mes++) {
        const transaccionesMes = transaccionesPorMes.get(mes) || [];

        const costoMes: CostoMensual = {
          mes: meses[mes],
          mesNumero: mes + 1
        };

        let totalMes = 0;
        const costosDelMes = new Map<string, number>();

        for (const trans of transaccionesMes) {
          const monto = Number(trans.monto_total ?? 0) || 0;
          totalMes += monto;

          if (trans.cuenta_codigo) {
            const prev = costosDelMes.get(trans.cuenta_codigo) || 0;
            costosDelMes.set(trans.cuenta_codigo, prev + monto);
          }
        }

        // Volcar agrupación al mes y al time-series por cuenta
        costosDelMes.forEach((monto, cuenta) => {
          costoMes[cuenta] = monto;

          if (!costosPorCuentaMap.has(cuenta)) {
            costosPorCuentaMap.set(cuenta, {
              cuenta,
              nombreCuenta: cuenta,
              data: []
            });
          }

          costosPorCuentaMap.get(cuenta)!.data.push({
            mes: meses[mes],
            monto
          });
        });

        costoMes["total"] = totalMes;
        costosMensuales.push(costoMes);
      }

      // ✅ 2) Traer nombres de cuentas (una sola llamada)
      const cuentasCodigos = Array.from(costosPorCuentaMap.keys());

      let cuentasData: CuentaRow[] = [];
      if (cuentasCodigos.length > 0) {
        // Endpoint esperado:
        // GET /api/cuentas?codigos=1001,2001,....
        const cuentasJson = await apiFetch(
          `/api/cuentas?codigos=${encodeURIComponent(cuentasCodigos.join(","))}`,
          { method: "GET" }
        );
        cuentasData = (cuentasJson as any)?.data ?? cuentasJson ?? [];
      }

      const cuentasMap = new Map((cuentasData || []).map((c) => [c.codigo, c.nombre]));

      costosPorCuentaMap.forEach((value, key) => {
        value.nombreCuenta = cuentasMap.get(key) || key;
      });

      // Rellenar meses faltantes con 0 (por si alguna cuenta aparece después)
      const costosPorCuenta = Array.from(costosPorCuentaMap.values());

      costosPorCuenta.forEach((cuenta) => {
        meses.forEach((mesNombre, index) => {
          if (!cuenta.data.find((d) => d.mes === mesNombre)) {
            cuenta.data.splice(index, 0, { mes: mesNombre, monto: 0 });
          }
        });
      });

      const cuentas = costosPorCuenta.map((c) => ({
        codigo: c.cuenta,
        nombre: c.nombreCuenta
      }));

      return {
        costosMensuales,
        costosPorCuenta,
        cuentas
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false
  });
};
