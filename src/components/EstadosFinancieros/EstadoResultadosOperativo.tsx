import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodType } from "@/pages/EstadoResultados";

interface EstadoResultadosOperativoProps {
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
}

type SaldoCuenta = {
  cuenta_codigo?: string;
  debe_total?: number;
  haber_total?: number;
  saldo?: number;
};

const EstadoResultadosOperativo = ({ startDate, endDate }: EstadoResultadosOperativoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, endDate);

  const formatearPeriodo = (startDate: Date, endDate: Date): string => {
    const formatoFecha = (fecha: Date) =>
      fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

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
  const saldosPorCuenta: Record<string, SaldoCuenta> = asientosData?.saldosPorCuenta || {};



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

  // ✅ Saldo con naturaleza (y contra-cuenta 4003)
  const obtenerSaldo = (codigoCuenta: string): number => {
    const codigo = normalizeCodigo(codigoCuenta);

    const direct = saldosPorCuenta[codigo]?.saldo;
    const alt = saldosPorCuenta[codigo.replace(/\s+/g, "")]?.saldo;
    const saldo = Number(direct ?? alt ?? 0) || 0;

    const primerDigito = codigo.charAt(0);

    // 4003: Descuentos sobre ventas (contra cuenta)
    if (codigo === "4003") return -Math.abs(saldo);

    // 2,3,4 suelen ser acreedoras (si saldo viene negativo, lo hacemos positivo)
    if (["2", "3", "4"].includes(primerDigito)) return Math.abs(saldo);

    // activos/costos/gastos se dejan como vengan
    return saldo;
  };

  const codigosCatalogo = cuentasFlat
    .map((c: any) => String(c?.codigo ?? "").trim())
    .filter(Boolean);

  const codigosSaldos = Object.keys(saldosPorCuenta || {}).map((k) => String(k).trim()).filter(Boolean);

  const allCodigos = Array.from(new Set([...codigosCatalogo, ...codigosSaldos]));

  const cuentasPorRango = (predicate: (codigoNum: number) => boolean) => {
    const res: Array<{ codigo: string; nombre: string }> = [];

    for (const codigoStr of allCodigos) {
      const codigo = normalizeCodigo(codigoStr);
      const n = Number(codigo);
      if (!Number.isFinite(n)) continue;
      if (!predicate(n)) continue;

      const cuenta = cuentasFlat.find((c: any) => String(c?.codigo ?? "").trim() === codigo);
      res.push({
        codigo,
        nombre: cuenta?.nombre ?? "Cuenta",
      });
    }

    // ordenar por código
    res.sort((a, b) => Number(a.codigo) - Number(b.codigo));
    return res;
  };

  const sumCuentas = (lista: Array<{ codigo: string }>) =>
    lista.reduce((acc, c) => acc + obtenerSaldo(c.codigo), 0);

  // ✅ Definiciones por rangos
  const cuentasIngresos = cuentasPorRango((n) => n >= 4000 && n <= 4999);
  const cuentasCostos = cuentasPorRango((n) => n >= 5000 && n <= 5099);
  const cuentasDepreciaciones = cuentasPorRango((n) => n === 5109 || n === 5110);
  const cuentasGastosOperativos = cuentasPorRango((n) => n >= 5100 && n <= 5199 && n !== 5109 && n !== 5110);
  const cuentasOtrosGastos = cuentasPorRango((n) => n >= 5200 && n <= 5299 && n !== 5201);
  const cuentasCostoFinanciero = cuentasPorRango((n) => n === 5201 || (n >= 5111 && n <= 5199));
  const cuentasImpuestos = cuentasPorRango((n) => n >= 6000 && n <= 6999);

  const totalIngresos = sumCuentas(cuentasIngresos);
  const totalCostos = sumCuentas(cuentasCostos);
  const totalGastosOperativos = sumCuentas(cuentasGastosOperativos);
  const totalOtrosGastos = sumCuentas(cuentasOtrosGastos);
  const totalDepreciaciones = sumCuentas(cuentasDepreciaciones);
  const totalCostoFinanciero = sumCuentas(cuentasCostoFinanciero);
  const totalImpuestos = sumCuentas(cuentasImpuestos);

  const utilidadBruta = totalIngresos - totalCostos;
  const ebitda = utilidadBruta - totalGastosOperativos - totalOtrosGastos;
  const ebit = ebitda - totalDepreciaciones;
  const utilidadAntesImpuestos = ebit - totalCostoFinanciero;
  const utilidadNeta = utilidadAntesImpuestos - totalImpuestos;

  const money = (n: number) => `$${Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`;
  const pct = (n: number) => (totalIngresos !== 0 ? `${((n / totalIngresos) * 100).toFixed(2)}%` : "0.00%");

  const Row = ({ codigo, nombre }: { codigo: string; nombre: string }) => {
    const saldo = obtenerSaldo(codigo);
    return (
      <div className="grid grid-cols-3 gap-4 items-center">
        <span className="text-sm">
          {codigo} - {nombre}
        </span>
        <span className="font-medium text-right">{money(saldo)}</span>
        <span className="text-right">{pct(saldo)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-2xl text-center">Estado de Resultados - Formato Operativo</CardTitle>
          <p className="text-sm text-muted-foreground text-center font-medium mt-2">
            {formatearPeriodo(startDate, endDate)}
          </p>
        </CardHeader>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este Estado de Resultados refleja automáticamente todas las transacciones registradas: ingresos, costos, gastos,
          depreciaciones, costo financiero e impuestos.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Ingresos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Ingresos (4xxx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              {cuentasIngresos.map((c) => (
                <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />
              ))}

              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-green-600">
                  <span>Total Ingresos</span>
                  <span className="text-right">{money(totalIngresos)}</span>
                  <span className="text-right">{pct(totalIngresos)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Costos de Ventas (50xx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              {cuentasCostos.map((c) => (
                <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />
              ))}

              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-orange-600">
                  <span>Total Costos</span>
                  <span className="text-right">{money(totalCostos)}</span>
                  <span className="text-right">{pct(totalCostos)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Bruta */}
        <Card>
          <CardHeader>
            <CardTitle className={utilidadBruta >= 0 ? "text-blue-600" : "text-red-600"}>Utilidad Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <span>Ingresos</span>
                <span className="text-right">{money(totalIngresos)}</span>
                <span className="text-right">100.00%</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Costos</span>
                <span className="text-right">({money(totalCostos)})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalCostos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}</span>
              </div>

              <div className="border-t pt-2 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${utilidadBruta >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  <span>Utilidad Bruta</span>
                  <span className="text-right">{money(utilidadBruta)}</span>
                  <span className="text-right">{pct(utilidadBruta)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gastos Operativos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Gastos Operativos (51xx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              {cuentasGastosOperativos.map((c) => (
                <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />
              ))}

              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-red-600">
                  <span>Total Gastos Operativos</span>
                  <span className="text-right">{money(totalGastosOperativos)}</span>
                  <span className="text-right">{pct(totalGastosOperativos)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Otros Gastos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Otros Gastos (52xx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              {cuentasOtrosGastos.map((c) => (
                <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />
              ))}

              {cuentasOtrosGastos.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-3">No hay otros gastos registrados</div>
              )}

              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-red-600">
                  <span>Total Otros Gastos</span>
                  <span className="text-right">{money(totalOtrosGastos)}</span>
                  <span className="text-right">{pct(totalOtrosGastos)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* EBITDA */}
        <Card>
          <CardHeader>
            <CardTitle className={ebitda >= 0 ? "text-blue-600" : "text-red-600"}>EBITDA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <span>Utilidad Bruta</span>
                <span className="text-right">{money(utilidadBruta)}</span>
                <span className="text-right">{pct(utilidadBruta)}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Gastos Operativos</span>
                <span className="text-right">({money(totalGastosOperativos)})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalGastosOperativos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Otros Gastos</span>
                <span className="text-right">({money(totalOtrosGastos)})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalOtrosGastos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}</span>
              </div>

              <div className="border-t pt-2 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold ${ebitda >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  <span>EBITDA</span>
                  <span className="text-right">{money(ebitda)}</span>
                  <span className="text-right">{pct(ebitda)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Depreciaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">Depreciaciones y Amortizaciones (5109/5110)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              {cuentasDepreciaciones.map((c) => (
                <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />
              ))}

              {cuentasDepreciaciones.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-3">No hay depreciaciones registradas</div>
              )}

              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-purple-600">
                  <span>Total Depreciaciones</span>
                  <span className="text-right">{money(totalDepreciaciones)}</span>
                  <span className="text-right">{pct(totalDepreciaciones)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costo Financiero */}
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-600">Costo Financiero (5201)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              {cuentasCostoFinanciero.map((c) => (
                <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />
              ))}

              {cuentasCostoFinanciero.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-3">No hay costos financieros registrados</div>
              )}

              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-amber-600">
                  <span>Total Costo Financiero</span>
                  <span className="text-right">{money(totalCostoFinanciero)}</span>
                  <span className="text-right">{pct(totalCostoFinanciero)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Impuestos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-rose-600">Impuestos (6xxx)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Cuenta</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              {cuentasImpuestos.map((c) => (
                <Row key={c.codigo} codigo={c.codigo} nombre={c.nombre} />
              ))}

              {cuentasImpuestos.length === 0 && (
                <div className="text-sm text-muted-foreground col-span-3">No hay impuestos registrados</div>
              )}

              <div className="border-t pt-2 mt-4">
                <div className="grid grid-cols-3 gap-4 items-center font-bold text-rose-600">
                  <span>Total Impuestos</span>
                  <span className="text-right">{money(totalImpuestos)}</span>
                  <span className="text-right">{pct(totalImpuestos)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Utilidad Neta */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className={utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}>Utilidad Neta del Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 pb-2 border-b font-semibold text-sm">
                <span>Concepto</span>
                <span className="text-right">Monto</span>
                <span className="text-right">% Ingresos</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <span>Utilidad Antes de Impuestos</span>
                <span className="text-right">{money(utilidadAntesImpuestos)}</span>
                <span className="text-right">{pct(utilidadAntesImpuestos)}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <span>(-) Impuestos</span>
                <span className="text-right">({money(totalImpuestos)})</span>
                <span className="text-right">{totalIngresos !== 0 ? `(${((totalImpuestos / totalIngresos) * 100).toFixed(2)}%)` : "0.00%"}</span>
              </div>

              <div className="border-t-2 pt-3 mt-4">
                <div className={`grid grid-cols-3 gap-4 items-center font-bold text-xl ${utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  <span>{utilidadNeta >= 0 ? "Utilidad Neta" : "Pérdida Neta"}</span>
                  <span className="text-right">{money(utilidadNeta)}</span>
                  <span className="text-right">{pct(utilidadNeta)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EstadoResultadosOperativo;
