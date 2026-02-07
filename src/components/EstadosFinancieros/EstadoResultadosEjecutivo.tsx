import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { PeriodType } from "@/pages/EstadoResultados";

interface EstadoResultadosEjecutivoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

const EstadoResultadosEjecutivo = ({ startDate, endDate }: EstadoResultadosEjecutivoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

  // Función para formatear el período
  const formatearPeriodo = (startDate: Date, endDate: Date): string => {
    const formatoFecha = (fecha: Date) => {
      return fecha.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const fechaInicio = formatoFecha(startDate);
    const fechaFin = formatoFecha(endDate);

    if (startDate.toDateString() === endDate.toDateString()) {
      return `Estado de Resultados del ${fechaInicio}`;
    }

    return `Estado de Resultados del ${fechaInicio} al ${fechaFin}`;
  };

  if (cuentasLoading || asientosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];
  const saldosPorCuenta: Record<string, { saldo?: number; debe_total?: number; haber_total?: number }> =
    asientosData?.saldosPorCuenta || {};

  // ✅ Hay datos si hay movimientos o si hay saldos por cuenta
  const hayDatos =
    (Array.isArray(asientosData?.movimientos) && asientosData!.movimientos.length > 0) ||
    (saldosPorCuenta && Object.keys(saldosPorCuenta).length > 0);

  if (!hayDatos) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">No hay datos financieros registrados</p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el estado de resultados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const normalizeCodigo = (codigo: string) => String(codigo || "").trim();

  // ✅ Obtener saldo robusto por código (por si viene con espacios o keys raras)
  const obtenerSaldo = (codigoCuenta: string): number => {
    const codigo = normalizeCodigo(codigoCuenta);

    const direct = saldosPorCuenta[codigo]?.saldo;
    const alt = saldosPorCuenta[codigo.replace(/\s+/g, "")]?.saldo;
    const saldo = Number(direct ?? alt ?? 0) || 0;

    const primerDigito = codigo.charAt(0);

    // 4003: Descuentos sobre ventas (contra cuenta)
    if (codigo === "4003") {
      return -Math.abs(saldo);
    }

    // 2,3,4 normalmente son acreedoras (en muchos motores el saldo puede venir negativo)
    if (["2", "3", "4"].includes(primerDigito)) {
      return Math.abs(saldo);
    }

    // activos/costos/gastos suelen ser deudoras
    return saldo;
  };

  // ✅ Clasificación E2E por rangos, NO por subgrupo
  const getCodigoNum = (c: any): number => {
    const raw = c?.codigo ?? c?.cuenta_codigo ?? c?.codigoCuenta ?? c?.accountCodigo ?? "";
    const n = Number(String(raw).trim());
    return Number.isFinite(n) ? n : NaN;
  };

  // Tomamos códigos del catálogo; si por algún motivo el catálogo falla,
  // hacemos fallback a lo que venga en saldosPorCuenta.
  const codigosCatalogo = cuentasFlat
    .map((c: any) => String(c?.codigo ?? "").trim())
    .filter((x: string) => x);

  const codigosSaldos = Object.keys(saldosPorCuenta || {}).map((k) => String(k).trim()).filter(Boolean);

  const allCodigos = Array.from(new Set([...codigosCatalogo, ...codigosSaldos]));

  const sumBy = (predicate: (codigoNum: number, codigoStr: string) => boolean) => {
    let total = 0;
    for (const codigoStr of allCodigos) {
      const codigo = normalizeCodigo(codigoStr);
      const codigoNum = Number(codigo);
      if (!Number.isFinite(codigoNum)) continue;
      if (!predicate(codigoNum, codigo)) continue;
      total += obtenerSaldo(codigo);
    }
    return total;
  };

  // Ingresos: 4xxx (incluye 41xx), con reglas especiales de 4002/4003/4004 si aplica
  // Nota: tu hook mensual hace un tratamiento especial a 4002/4003; aquí respetamos 4003 y dejamos 4002 como ingreso si existe (puedes ajustar si lo usas como devoluciones).
  const totalIngresos = sumBy((n) => n >= 4000 && n <= 4999);

  // Costos: 50xx
  const costoVentas = sumBy((n) => n >= 5000 && n <= 5099);

  // Depreciaciones: 5109/5110
  const depreciaciones = sumBy((n) => n === 5109 || n === 5110);

  // Gastos operativos: 51xx excluyendo 5109/5110
  const gastosOperativos = sumBy((n) => n >= 5100 && n <= 5199 && n !== 5109 && n !== 5110);

  // Otros gastos: 52xx (excepto 5201 que lo dejamos en costo financiero)
  const otrosGastos = sumBy((n) => n >= 5200 && n <= 5299 && n !== 5201);

  // Costo financiero: 5201 y/o 5111-5199 si lo usan así
  const costoFinanciero = sumBy((n) => n === 5201 || (n >= 5111 && n <= 5199));

  // Impuestos: 6xxx
  const impuestos = sumBy((n) => n >= 6000 && n <= 6999);

  const utilidadBruta = totalIngresos - costoVentas;
  const ebitda = utilidadBruta - gastosOperativos - otrosGastos;
  const ebit = ebitda - depreciaciones;
  const utilidadAntesImpuestos = ebit - costoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - impuestos;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("es-CO", { minimumFractionDigits: 2 });
    return value < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  const LineItem = ({
    label,
    value,
    isHeader = false,
    isSubtotal = false,
    isTotal = false,
    isNegative = false,
    indent = 0,
  }: {
    label: string;
    value: number;
    isHeader?: boolean;
    isSubtotal?: boolean;
    isTotal?: boolean;
    isNegative?: boolean;
    indent?: number;
  }) => {
    const getColor = () => {
      if (isTotal) return value >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400";
      if (isSubtotal) return value >= 0 ? "text-blue-700 dark:text-blue-400" : "text-rose-700 dark:text-rose-400";
      if (isNegative) return "text-slate-600 dark:text-slate-400";
      return "text-slate-700 dark:text-slate-300";
    };

    const getFontWeight = () => {
      if (isTotal) return "font-bold text-xl";
      if (isSubtotal) return "font-semibold text-lg";
      if (isHeader) return "font-medium";
      return "";
    };

    const percentage = totalIngresos !== 0 ? ((value / totalIngresos) * 100).toFixed(2) : "0.00";

    return (
      <div
        className={`grid grid-cols-3 gap-4 items-center py-3 ${
          isSubtotal || isTotal ? "border-t-2 border-slate-300 dark:border-slate-600 pt-4" : ""
        }`}
        style={{ marginLeft: indent > 0 ? `${indent * 1}rem` : "0" }}
      >
        <span className={`${getFontWeight()} ${getColor()}`}>{label}</span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>{formatCurrency(value)}</span>
        <span className={`${getFontWeight()} ${getColor()} text-right`}>
          {isNegative && value !== 0 ? `(${percentage}%)` : `${percentage}%`}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {utilidadNeta >= 0 ? (
          <TrendingUp className="h-8 w-8 text-green-600" />
        ) : (
          <TrendingDown className="h-8 w-8 text-red-600" />
        )}
        <p className="text-muted-foreground">Vista ejecutiva consolidada del período</p>
      </div>

      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-2xl">Resumen Financiero</CardTitle>
          <p className="text-sm text-muted-foreground mt-2 font-medium">{formatearPeriodo(startDate, endDate)}</p>
        </CardHeader>

        <CardContent className="p-6">
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
              <span>Concepto</span>
              <span className="text-right">Monto</span>
              <span className="text-right">% Ingresos</span>
            </div>

            <LineItem label="Total Ingresos" value={totalIngresos} isSubtotal />
            <LineItem label="(-) Costo de Ventas" value={costoVentas} isNegative />
            <LineItem label="Utilidad Bruta" value={utilidadBruta} isSubtotal />

            <LineItem label="(-) Gastos Operativos" value={gastosOperativos} isNegative />
            <LineItem label="(-) Otros Gastos" value={otrosGastos} isNegative />
            <LineItem label="EBITDA" value={ebitda} isSubtotal />

            <LineItem label="(-) Depreciaciones y Amortizaciones" value={depreciaciones} isNegative />
            <LineItem label="EBIT (Utilidad Operativa)" value={ebit} isSubtotal />

            <LineItem label="(-) Costo Financiero" value={costoFinanciero} isNegative />
            <LineItem label="Utilidad Antes de Impuestos" value={utilidadAntesImpuestos} isSubtotal />

            <LineItem label="(-) Impuestos" value={impuestos} isNegative />

            <LineItem
              label={utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"}
              value={utilidadNeta}
              isTotal
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstadoResultadosEjecutivo;
