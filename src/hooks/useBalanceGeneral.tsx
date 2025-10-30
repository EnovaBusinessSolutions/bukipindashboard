import { useAsientosBalanza } from "./useAsientosBalanza";

interface SaldosBalance {
  // Activos Circulantes
  caja: number;
  bancos: number;
  cuentasPorCobrar: number;
  inventario: number;
  
  // Activos Fijos
  activosFijos: number;
  
  // Pasivos Circulantes
  proveedores: number;
  
  // Pasivos Largo Plazo
  financiamientos: number;
  
  // Capital Contable
  capitalSocial: number;
  utilidadesRetenidas: number;
  
  // Resultados
  ingresos: number;
  costos: number;
  gastos: number;
  impuestos: number;
  utilidad: number;
}

export const useBalanceGeneral = () => {
  // Usar la misma fuente que la balanza - desde el inicio hasta ahora
  const startDate = new Date(0);
  const endDate = new Date();
  const { data: asientosData, ...queryProps } = useAsientosBalanza(startDate, endDate);

  const saldosPorCuenta = asientosData?.saldosPorCuenta || {};

  // Extraer saldos de cuentas específicas
  // Activos (naturaleza deudora - mantener como está)
  const caja = saldosPorCuenta["1001"]?.saldo || 0;
  const bancos = saldosPorCuenta["1002"]?.saldo || 0;
  const cuentasPorCobrar = saldosPorCuenta["1003"]?.saldo || 0;
  const inventario = saldosPorCuenta["1005"]?.saldo || 0;
  
  // Activos Fijos - sumar todas las cuentas 1007, 1008, etc
  const activosFijos = Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("10") && parseInt(codigo) >= 1007)
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  // Pasivos (naturaleza acreedora - convertir a positivo)
  const proveedores = Math.abs(saldosPorCuenta["2001"]?.saldo || 0);
  
  // Financiamientos - sumar todas las cuentas de pasivos largo plazo
  const financiamientos = Math.abs(Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("21"))
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0));

  // Capital (naturaleza acreedora - convertir a positivo)
  const capitalSocial = Math.abs(saldosPorCuenta["3001"]?.saldo || 0);
  const utilidadesRetenidas = Math.abs(saldosPorCuenta["3002"]?.saldo || 0);

  // Ingresos (naturaleza acreedora - convertir a positivo)
  const ingresos = Math.abs(Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("4"))
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0));

  // Costos y Gastos (naturaleza deudora - mantener como está)
  const costos = Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("5") && parseInt(codigo) >= 5001 && parseInt(codigo) <= 5099)
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  const gastos = Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("5") && parseInt(codigo) >= 5100)
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  // Impuestos (naturaleza deudora - mantener como está)
  const impuestos = Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("6"))
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  const utilidad = ingresos - (costos + gastos + impuestos);

  return {
    data: asientosData ? {
      caja,
      bancos,
      cuentasPorCobrar,
      inventario,
      activosFijos,
      proveedores,
      financiamientos,
      capitalSocial,
      utilidadesRetenidas,
      ingresos,
      costos,
      gastos,
      impuestos,
      utilidad
    } : undefined,
    ...queryProps
  };
};
