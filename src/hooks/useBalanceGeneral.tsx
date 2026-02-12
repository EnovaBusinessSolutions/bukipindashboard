import { useAsientosBalanza } from "./useAsientosBalanza";

interface SaldosBalance {
  
  caja: number;
  bancos: number;
  cuentasPorCobrar: number;
  inventario: number;
  
  
  activosFijos: number;
  
  
  proveedores: number;
  
  
  financiamientos: number;
  
  
  capitalSocial: number;
  utilidadesRetenidas: number;
  
  
  ingresos: number;
  costos: number;
  gastos: number;
  impuestos: number;
  utilidad: number;
}

export const useBalanceGeneral = () => {
  
  const startDate = new Date(0);
  const endDate = new Date();
  const { data: asientosData, ...queryProps } = useAsientosBalanza(startDate, endDate);

  const saldosPorCuenta = asientosData?.saldosPorCuenta || {};

  
  const caja = saldosPorCuenta["1001"]?.saldo || 0;
  const bancos = saldosPorCuenta["1002"]?.saldo || 0;
  const cuentasPorCobrar = saldosPorCuenta["1003"]?.saldo || 0;
  const inventario = saldosPorCuenta["1005"]?.saldo || 0;
  
  
  const activosFijos = Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("10") && parseInt(codigo) >= 1007)
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  
  const proveedores = Math.abs(saldosPorCuenta["2001"]?.saldo || 0);
  
  
  const financiamientos = Math.abs(Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("21"))
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0));

  
  const capitalSocial = Math.abs(saldosPorCuenta["3001"]?.saldo || 0);
  const utilidadesRetenidas = Math.abs(saldosPorCuenta["3002"]?.saldo || 0);

  
  const ingresos = Math.abs(Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("4"))
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0));

  
  const costos = Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("5") && parseInt(codigo) >= 5001 && parseInt(codigo) <= 5099)
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  const gastos = Object.keys(saldosPorCuenta)
    .filter(codigo => codigo.startsWith("5") && parseInt(codigo) >= 5100)
    .reduce((sum, codigo) => sum + (saldosPorCuenta[codigo]?.saldo || 0), 0);

  
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
