import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCuentas } from "@/hooks/useCuentas";
import { useAsientosBalanza } from "@/hooks/useAsientosBalanza";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BalanceGeneralOperativoProps {
  cutoffDate: Date;
}

interface SaldoCuenta {
  cuenta_codigo: string;
  debe_total: number;
  haber_total: number;
  saldo: number;
}

const BalanceGeneralOperativo = ({ cutoffDate }: BalanceGeneralOperativoProps) => {
  const { data: cuentasData, isLoading: cuentasLoading } = useCuentas();

  // Usar la misma lógica que la balanza
  const startDate = new Date(0); // Desde el inicio
  const { data: asientosData, isLoading: asientosLoading } = useAsientosBalanza(startDate, cutoffDate);

  if (cuentasLoading || asientosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cuentasFlat = cuentasData?.cuentasFlat || [];
  const saldosPorCuenta = asientosData?.saldosPorCuenta || {};

  // Verificar si hay datos
  const hayDatos = asientosData?.movimientos && asientosData.movimientos.length > 0;

  if (!hayDatos) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-muted-foreground">No hay datos financieros registrados</p>
            <p className="text-sm text-muted-foreground">
              Comienza registrando transacciones para ver el balance general
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Función para obtener el saldo de una cuenta desde los asientos de balanza
  const obtenerSaldo = (codigoCuenta: string): number => {
    return saldosPorCuenta[codigoCuenta]?.saldo || 0;
  };

  // Calcular TODOS los activos desde los saldos de la balanza (cuentas 1xxx)
  const codigosActivos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("1"));
  const totalActivos = codigosActivos.reduce((sum, codigo) => {
    const saldo = saldosPorCuenta[codigo]?.saldo || 0;
    return sum + saldo;
  }, 0);

  // Calcular TODOS los pasivos desde los saldos de la balanza (cuentas 2xxx)
  const codigosPasivos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("2"));
  const totalPasivos = codigosPasivos.reduce((sum, codigo) => {
    const saldo = saldosPorCuenta[codigo]?.saldo || 0;
    return sum + saldo;
  }, 0);

  // Calcular TODOS los capital contable desde los saldos de la balanza (cuentas 3xxx)
  const codigosCapital = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("3"));
  const totalCapitalContable = codigosCapital.reduce((sum, codigo) => {
    const saldo = saldosPorCuenta[codigo]?.saldo || 0;
    return sum + saldo;
  }, 0);

  // Calcular utilidad del ejercicio desde los saldos de la balanza (cuentas 4xxx - 5xxx - 6xxx)
  const ingresosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("4"));
  const egresosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("5"));
  const impuestosCodigos = Object.keys(saldosPorCuenta).filter((c) => c.startsWith("6"));

  const ingresos = ingresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const egresos = egresosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);
  const impuestos = impuestosCodigos.reduce((sum, c) => sum + (saldosPorCuenta[c]?.saldo || 0), 0);

  const utilidadEjercicio = ingresos - egresos - impuestos;

  // Desglosar activos por tipo para mostrar
  const activoCirculante = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const activoFijo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  // Separar activos fijos brutos de depreciación acumulada
  const activoFijoBruto = activoFijo.filter((cuenta) => {
    const codigo = parseInt(cuenta.codigo);
    return (codigo >= 1201 && codigo <= 1206) || codigo === 1212; // Activos brutos
  });

  const depreciacionAcumulada = activoFijo.filter((cuenta) => {
    const codigo = parseInt(cuenta.codigo);
    return codigo >= 1207 && codigo <= 1213; // Depreciaciones acumuladas
  });

  const activoDiferido = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Activo Diferido" && cuenta.estado_financiero === "Balance General"
  );

  const pasivoCortoPlazo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Pasivo Circulante" && cuenta.estado_financiero === "Balance General"
  );

  const pasivoLargoPlazo = cuentasFlat.filter(
    (cuenta) => cuenta.subgrupo === "Pasivo No Circulante" && cuenta.estado_financiero === "Balance General"
  );

  // Subtotales para display
  const totalActivoCirculante = activoCirculante.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalActivoFijoBruto = activoFijoBruto.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalDepreciacionAcumulada = depreciacionAcumulada.reduce(
    (total, cuenta) => total + obtenerSaldo(cuenta.codigo),
    0
  );
  const totalActivoFijoNeto = totalActivoFijoBruto + totalDepreciacionAcumulada; // depreciación acumulada suele venir negativa
  const totalActivoDiferido = activoDiferido.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  const totalPasivoCortoPlazo = pasivoCortoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);
  const totalPasivoLargoPlazo = pasivoLargoPlazo.reduce((total, cuenta) => total + obtenerSaldo(cuenta.codigo), 0);

  // ✅ Requerimiento cliente:
  // Capital Contable solo con 2 rubros:
  // 1) Utilidad del ejercicio
  // 2) Otras cuentas de capital (todas las 3xxx agrupadas)
  const otrasCuentasCapital = totalCapitalContable;

  const totalCapitalContableConUtilidad = otrasCuentasCapital + utilidadEjercicio;
  const totalPasivoMasCapital = totalPasivos + totalCapitalContableConUtilidad;

  const balanceCuadrado = Math.abs(totalActivos - totalPasivoMasCapital) < 0.01;

  return (
    <div className="space-y-6">
      {/* Alerta informativa */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Balance General al {cutoffDate.toLocaleDateString("es-CO")} - Los saldos reflejan la situación financiera a
          esta fecha específica.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lado Izquierdo - Activos */}
        <div className="space-y-6">
          {/* Activo Circulante */}
          <Card className="border-2">
            <CardHeader className="bg-blue-50 dark:bg-blue-950">
              <CardTitle className="text-blue-700">Activo Circulante</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                <span>Cuenta</span>
                <span className="text-right">Saldo</span>
                <span className="text-right">% Activos</span>
              </div>

              <div className="space-y-1">
                {activoCirculante.map((cuenta) => {
                  const saldo = obtenerSaldo(cuenta.codigo);
                  const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : "0.00";

                  return (
                    <div
                      key={cuenta.codigo}
                      className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300"
                    >
                      <span className="text-sm">
                        {cuenta.codigo} - {cuenta.nombre}
                      </span>
                      <span className="text-right">
                        ${saldo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right">{percentage}%</span>
                    </div>
                  );
                })}

                <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-blue-600 text-base">
                  <span>Total Activo Circulante</span>
                  <span className="text-right">
                    ${totalActivoCirculante.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right">
                    {totalActivos > 0 ? ((totalActivoCirculante / totalActivos) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activo Fijo */}
          <Card className="border-2">
            <CardHeader className="bg-indigo-50 dark:bg-indigo-950">
              <CardTitle className="text-indigo-700">Activo Fijo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                <span>Cuenta</span>
                <span className="text-right">Saldo</span>
                <span className="text-right">% Activos</span>
              </div>

              <div className="space-y-1">
                {/* Activos Fijos Brutos */}
                <div className="space-y-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div className="font-medium text-sm text-slate-600 dark:text-slate-400 py-2">Activo Fijo Bruto</div>
                  {activoFijoBruto.map((cuenta) => {
                    const saldo = obtenerSaldo(cuenta.codigo);
                    const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : "0.00";

                    return (
                      <div
                        key={cuenta.codigo}
                        className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300 pl-4"
                      >
                        <span className="text-sm">
                          {cuenta.codigo} - {cuenta.nombre}
                        </span>
                        <span className="text-right">
                          ${saldo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-right">{percentage}%</span>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-3 gap-4 items-center py-2 font-medium text-indigo-600 pl-4">
                    <span className="text-sm">Subtotal Activo Fijo Bruto</span>
                    <span className="text-right">
                      ${totalActivoFijoBruto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-right">
                      {totalActivos > 0 ? ((totalActivoFijoBruto / totalActivos) * 100).toFixed(2) : "0.00"}%
                    </span>
                  </div>
                </div>

                {/* Depreciación Acumulada */}
                <div className="space-y-1 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div className="font-medium text-sm text-slate-600 dark:text-slate-400 py-2">
                    Depreciación Acumulada
                  </div>
                  {depreciacionAcumulada.map((cuenta) => {
                    const saldo = obtenerSaldo(cuenta.codigo);
                    const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : "0.00";

                    return (
                      <div
                        key={cuenta.codigo}
                        className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300 pl-4"
                      >
                        <span className="text-sm">
                          {cuenta.codigo} - {cuenta.nombre}
                        </span>
                        <span className="text-right text-rose-600">
                          ({Math.abs(saldo).toLocaleString("es-CO", { minimumFractionDigits: 2 })})
                        </span>
                        <span className="text-right text-rose-600">
                          ({Math.abs(parseFloat(percentage)).toFixed(2)}%)
                        </span>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-3 gap-4 items-center py-2 font-medium text-rose-600 pl-4">
                    <span className="text-sm">Subtotal Depreciación Acum.</span>
                    <span className="text-right">
                      ({Math.abs(totalDepreciacionAcumulada).toLocaleString("es-CO", { minimumFractionDigits: 2 })})
                    </span>
                    <span className="text-right">
                      (
                      {Math.abs(totalActivos > 0 ? (totalDepreciacionAcumulada / totalActivos) * 100 : 0).toFixed(2)}
                      %)
                    </span>
                  </div>
                </div>

                {/* Total Activo Fijo Neto */}
                <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-indigo-600 text-base">
                  <span>= Activo Fijo Neto</span>
                  <span className="text-right">
                    ${totalActivoFijoNeto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right">
                    {totalActivos > 0 ? ((totalActivoFijoNeto / totalActivos) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activo Diferido */}
          <Card className="border-2">
            <CardHeader className="bg-cyan-50 dark:bg-cyan-950">
              <CardTitle className="text-cyan-700">Activo Diferido / Largo Plazo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                <span>Cuenta</span>
                <span className="text-right">Saldo</span>
                <span className="text-right">% Activos</span>
              </div>

              <div className="space-y-1">
                {activoDiferido.map((cuenta) => {
                  const saldo = obtenerSaldo(cuenta.codigo);
                  const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : "0.00";

                  return (
                    <div
                      key={cuenta.codigo}
                      className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300"
                    >
                      <span className="text-sm">
                        {cuenta.codigo} - {cuenta.nombre}
                      </span>
                      <span className="text-right">
                        ${saldo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right">{percentage}%</span>
                    </div>
                  );
                })}

                <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-cyan-600 text-base">
                  <span>Total Activo Diferido</span>
                  <span className="text-right">
                    ${totalActivoDiferido.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right">
                    {totalActivos > 0 ? ((totalActivoDiferido / totalActivos) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Activos */}
          <Card className="border-2 border-blue-400 dark:border-blue-500">
            <CardHeader className="bg-blue-100 dark:bg-blue-900">
              <CardTitle className="text-blue-800">Total Activo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 items-center font-bold text-xl text-blue-800">
                <span>Total Activos</span>
                <span className="text-right">
                  ${totalActivos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-right">100.00%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lado Derecho - Pasivos y Capital Contable */}
        <div className="space-y-6">
          {/* Card de Pasivos */}
          <Card className="border-2">
            <CardHeader className="bg-red-50 dark:bg-red-950">
              <CardTitle className="text-xl text-red-700">Pasivo</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Pasivo Corto Plazo */}
                <Card className="border-2">
                  <CardHeader className="bg-red-50 dark:bg-red-950">
                    <CardTitle className="text-red-700">Pasivo Corto Plazo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                      <span>Cuenta</span>
                      <span className="text-right">Saldo</span>
                      <span className="text-right">% Activos</span>
                    </div>

                    <div className="space-y-1">
                      {pasivoCortoPlazo.map((cuenta) => {
                        const saldo = obtenerSaldo(cuenta.codigo);
                        const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : "0.00";

                        return (
                          <div
                            key={cuenta.codigo}
                            className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300"
                          >
                            <span className="text-sm">
                              {cuenta.codigo} - {cuenta.nombre}
                            </span>
                            <span className="text-right">
                              ${saldo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-right">{percentage}%</span>
                          </div>
                        );
                      })}

                      <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-red-600 text-base">
                        <span>Total Pasivo Corto Plazo</span>
                        <span className="text-right">
                          ${totalPasivoCortoPlazo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-right">
                          {totalActivos > 0 ? ((totalPasivoCortoPlazo / totalActivos) * 100).toFixed(2) : "0.00"}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pasivo Largo Plazo */}
                <Card className="border-2">
                  <CardHeader className="bg-orange-50 dark:bg-orange-950">
                    <CardTitle className="text-orange-700">Pasivo Largo Plazo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                      <span>Cuenta</span>
                      <span className="text-right">Saldo</span>
                      <span className="text-right">% Activos</span>
                    </div>

                    <div className="space-y-1">
                      {pasivoLargoPlazo.map((cuenta) => {
                        const saldo = obtenerSaldo(cuenta.codigo);
                        const percentage = totalActivos > 0 ? ((saldo / totalActivos) * 100).toFixed(2) : "0.00";

                        return (
                          <div
                            key={cuenta.codigo}
                            className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300"
                          >
                            <span className="text-sm">
                              {cuenta.codigo} - {cuenta.nombre}
                            </span>
                            <span className="text-right">
                              ${saldo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-right">{percentage}%</span>
                          </div>
                        );
                      })}

                      <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-semibold text-orange-600 text-base">
                        <span>Total Pasivo Largo Plazo</span>
                        <span className="text-right">
                          ${totalPasivoLargoPlazo.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-right">
                          {totalActivos > 0 ? ((totalPasivoLargoPlazo / totalActivos) * 100).toFixed(2) : "0.00"}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Pasivo */}
                <Card className="border-2 border-red-400 dark:border-red-500">
                  <CardHeader className="bg-red-100 dark:bg-red-900">
                    <CardTitle className="text-red-800">Total Pasivo</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-3 gap-4 items-center font-bold text-xl text-red-800">
                      <span>Total Pasivo</span>
                      <span className="text-right">
                        ${totalPasivos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right">
                        {totalActivos > 0 ? ((totalPasivos / totalActivos) * 100).toFixed(2) : "0.00"}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Card de Capital Contable */}
          <Card className="border-2">
            <CardHeader className="bg-green-50 dark:bg-green-950">
              <CardTitle className="text-xl text-green-700">Capital Contable</CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-2 font-semibold text-sm text-slate-600 dark:text-slate-400">
                <span>Cuenta</span>
                <span className="text-right">Saldo</span>
                <span className="text-right">% Activos</span>
              </div>

              {/* ✅ SOLO 2 RUBROS (requerimiento del cliente) */}
              <div className="space-y-1">
                {/* 1) Utilidad del ejercicio */}
                <div className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                  <span className="text-sm font-medium">Utilidad del ejercicio</span>
                  <span className="text-right">
                    ${utilidadEjercicio.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right">
                    {totalActivos > 0 ? ((utilidadEjercicio / totalActivos) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>

                {/* 2) Otras cuentas de capital (todas las 3xxx agrupadas) */}
                <div className="grid grid-cols-3 gap-4 items-center py-2 text-slate-700 dark:text-slate-300">
                  <span className="text-sm font-medium">Otras cuentas de capital</span>
                  <span className="text-right">
                    ${otrasCuentasCapital.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right">
                    {totalActivos > 0 ? ((otrasCuentasCapital / totalActivos) * 100).toFixed(2) : "0.00"}%
                  </span>
                </div>

                {/* Total Capital Contable */}
                <div className="grid grid-cols-3 gap-4 items-center py-3 border-t-2 border-slate-300 dark:border-slate-600 pt-4 font-bold text-green-600 text-lg">
                  <span>Total Capital Contable</span>
                  <span className="text-right">
                    ${totalCapitalContableConUtilidad.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-right">
                    {totalActivos > 0
                      ? ((totalCapitalContableConUtilidad / totalActivos) * 100).toFixed(2)
                      : "0.00"}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card Total Pasivo + Capital Contable */}
          <Card className="border-2 border-slate-400 dark:border-slate-500">
            <CardHeader className="bg-slate-100 dark:bg-slate-800">
              <CardTitle>Total Pasivo + Capital Contable</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 items-center font-bold text-xl">
                <span>Total</span>
                <span className="text-right">
                  ${totalPasivoMasCapital.toLocaleString("es-CO", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-right">
                  {totalActivos > 0 ? ((totalPasivoMasCapital / totalActivos) * 100).toFixed(2) : "0.00"}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Balance Status */}
      <div className="mt-6 text-center">
        <div className={`font-semibold text-lg ${balanceCuadrado ? "text-green-600" : "text-amber-600"}`}>
          {balanceCuadrado ? "✓ Balance Cuadrado" : `⚠ Diferencia: $${Math.abs(totalActivos - totalPasivoMasCapital).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`}
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneralOperativo;
