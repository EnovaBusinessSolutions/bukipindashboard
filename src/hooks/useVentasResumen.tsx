import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface VentasResumen {
  ventasDelDia: number;
  ventasDelMes: number;
  ventasDelAno: number;
  otrosIngresosDelDia: number;
  otrosIngresosDelMes: number;
  otrosIngresosDelAno: number;
  descuentosDelDia: number;
  descuentosDelMes: number;
  descuentosDelAno: number;
  ingresoNetoDelDia: number;
  ingresoNetoDelMes: number;
  ingresoNetoDelAno: number;
  totalIngresosDelDia: number;
  totalIngresosDelMes: number;
  totalIngresosDelAno: number;
}

type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string } | T;
const unwrap = <T,>(json: ApiEnvelope<T>): T => (json as any)?.data ?? (json as T);

const clamp0 = (n: any) => Math.max(0, Number(n) || 0);

const ZERO: VentasResumen = {
  ventasDelDia: 0,
  ventasDelMes: 0,
  ventasDelAno: 0,
  otrosIngresosDelDia: 0,
  otrosIngresosDelMes: 0,
  otrosIngresosDelAno: 0,
  descuentosDelDia: 0,
  descuentosDelMes: 0,
  descuentosDelAno: 0,
  ingresoNetoDelDia: 0,
  ingresoNetoDelMes: 0,
  ingresoNetoDelAno: 0,
  totalIngresosDelDia: 0,
  totalIngresosDelMes: 0,
  totalIngresosDelAno: 0,
};

/**
 * Hook para obtener resumen de ventas DESDE ASIENTOS CONTABLES (Única Fuente de Verdad)
 *
 * Cuentas:
 * - 4001: Ventas (acreedor) => haber - debe
 * - 4003: Descuentos sobre ventas (contra-cuenta, deudora) => debe - haber
 * - Otras 4XXX: Otros ingresos (acreedor) => haber - debe
 */
export const useVentasResumen = () => {
  const query = useQuery({
    queryKey: ["ventas-resumen"],
    queryFn: async (): Promise<VentasResumen> => {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        .toISOString()
        .split("T")[0];
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];

      // Endpoint recomendado:
      // GET /api/contabilidad/detalle-asientos?from=YYYY-MM-DD&to=YYYY-MM-DD&cuenta_prefix=4
      // Debe devolver items con:
      // { cuenta_codigo, debe, haber, fecha }  (fecha del asiento)
      //
      // Nota: Si tu backend devuelve { asientos_contables: { fecha } } también lo soportamos.
      const json = await apiFetch(
        `/api/contabilidad/detalle-asientos?from=${encodeURIComponent(startOfYear)}&to=${encodeURIComponent(
          today.toISOString().split("T")[0]
        )}&cuenta_prefix=4`,
        { method: "GET" }
      );

      const detalles = unwrap<any[]>(json) || [];

      if (!detalles.length) return ZERO;

      let ventasDelDia = 0;
      let ventasDelMes = 0;
      let ventasDelAno = 0;

      let otrosIngresosDelDia = 0;
      let otrosIngresosDelMes = 0;
      let otrosIngresosDelAno = 0;

      let descuentosDelDia = 0;
      let descuentosDelMes = 0;
      let descuentosDelAno = 0;

      detalles.forEach((detalle) => {
        const codigo = String(detalle?.cuenta_codigo || "");

        const fechaAsiento: string =
          detalle?.fecha ||
          detalle?.asientos_contables?.fecha ||
          detalle?.asiento_fecha ||
          "";

        if (!fechaAsiento) return;

        const debe = Number(detalle?.debe || 0);
        const haber = Number(detalle?.haber || 0);

        // 4003 = descuentos (debe - haber)
        if (codigo === "4003") {
          const montoDescuento = (debe || 0) - (haber || 0);

          if (fechaAsiento >= startOfDay) descuentosDelDia += montoDescuento;
          if (fechaAsiento >= startOfMonth) descuentosDelMes += montoDescuento;
          if (fechaAsiento >= startOfYear) descuentosDelAno += montoDescuento;
          return;
        }

        // 4001 = ventas (haber - debe)
        if (codigo === "4001") {
          const montoVenta = (haber || 0) - (debe || 0);

          if (fechaAsiento >= startOfDay) ventasDelDia += montoVenta;
          if (fechaAsiento >= startOfMonth) ventasDelMes += montoVenta;
          if (fechaAsiento >= startOfYear) ventasDelAno += montoVenta;
          return;
        }

        // Otras 4XXX = otros ingresos (haber - debe)
        if (codigo.startsWith("4")) {
          const montoOtros = (haber || 0) - (debe || 0);

          if (fechaAsiento >= startOfDay) otrosIngresosDelDia += montoOtros;
          if (fechaAsiento >= startOfMonth) otrosIngresosDelMes += montoOtros;
          if (fechaAsiento >= startOfYear) otrosIngresosDelAno += montoOtros;
        }
      });

      // Ingresos netos (ventas - descuentos)
      const ingresoNetoDelDia = clamp0(ventasDelDia - descuentosDelDia);
      const ingresoNetoDelMes = clamp0(ventasDelMes - descuentosDelMes);
      const ingresoNetoDelAno = clamp0(ventasDelAno - descuentosDelAno);

      return {
        ventasDelDia: clamp0(ventasDelDia),
        ventasDelMes: clamp0(ventasDelMes),
        ventasDelAno: clamp0(ventasDelAno),

        otrosIngresosDelDia: clamp0(otrosIngresosDelDia),
        otrosIngresosDelMes: clamp0(otrosIngresosDelMes),
        otrosIngresosDelAno: clamp0(otrosIngresosDelAno),

        // descuentos pueden ser 0+ (contra-cuenta). Los dejamos tal cual (no clamp) para que respeten contabilidad.
        descuentosDelDia: Number(descuentosDelDia) || 0,
        descuentosDelMes: Number(descuentosDelMes) || 0,
        descuentosDelAno: Number(descuentosDelAno) || 0,

        ingresoNetoDelDia,
        ingresoNetoDelMes,
        ingresoNetoDelAno,

        totalIngresosDelDia: clamp0(ingresoNetoDelDia + otrosIngresosDelDia),
        totalIngresosDelMes: clamp0(ingresoNetoDelMes + otrosIngresosDelMes),
        totalIngresosDelAno: clamp0(ingresoNetoDelAno + otrosIngresosDelAno),
      };
    },

    // equivalente “realtime”: refrescar periódicamente
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    ventasResumen: query.data ?? ZERO,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
};
