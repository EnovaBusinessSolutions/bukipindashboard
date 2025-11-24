-- ============================================================================
-- MIGRACIÓN: CORRECCIÓN DE CUENTAS POR COBRAR
-- Elimina cobros incorrectos de ventas de CONTADO que generaron saldo negativo
-- ============================================================================

-- PASO 1: Identificar y eliminar asientos contables incorrectos generados por el trigger
-- Estos son asientos tipo "COB-{uuid}" que corresponden a ventas de contado

DO $$
DECLARE
  asiento_record RECORD;
  deleted_count INTEGER := 0;
BEGIN
  -- Encontrar asientos de cobro incorrectos (ventas de contado)
  FOR asiento_record IN
    SELECT DISTINCT ac.id, ac.numero_asiento
    FROM asientos_contables ac
    WHERE ac.numero_asiento LIKE 'COB-%'
    AND EXISTS (
      SELECT 1 
      FROM transacciones_cobros_pagos tcp
      JOIN transacciones_ingresos ti ON tcp.referencia_id = ti.id
      WHERE tcp.referencia_tabla = 'transacciones_ingresos'
        AND tcp.tipo_transaccion = 'cobro'
        AND ti.tipo_pago = 'contado'
        AND ac.numero_asiento = 'COB-' || tcp.id::text
    )
  LOOP
    -- Eliminar detalles del asiento
    DELETE FROM detalle_asientos WHERE asiento_id = asiento_record.id;
    
    -- Eliminar asiento contable
    DELETE FROM asientos_contables WHERE id = asiento_record.id;
    
    deleted_count := deleted_count + 1;
    
    RAISE NOTICE 'Eliminado asiento incorrecto: %', asiento_record.numero_asiento;
  END LOOP;
  
  RAISE NOTICE 'Total de asientos incorrectos eliminados: %', deleted_count;
END $$;

-- PASO 2: Eliminar registros incorrectos de transacciones_cobros_pagos
-- Estos son cobros de ventas de CONTADO que no deberían existir

DELETE FROM transacciones_cobros_pagos
WHERE id IN (
  SELECT tcp.id
  FROM transacciones_cobros_pagos tcp
  JOIN transacciones_ingresos ti ON tcp.referencia_id = ti.id
  WHERE tcp.referencia_tabla = 'transacciones_ingresos'
    AND tcp.tipo_transaccion = 'cobro'
    AND ti.tipo_pago = 'contado'
);

-- PASO 3: Validación final - Reportar saldo de CxC después de la corrección
DO $$
DECLARE
  saldo_cxc_contable NUMERIC;
  ventas_pendientes_reales NUMERIC;
BEGIN
  -- Calcular saldo contable de CxC
  SELECT COALESCE(SUM(debe - haber), 0)
  INTO saldo_cxc_contable
  FROM detalle_asientos da
  JOIN asientos_contables ac ON da.asiento_id = ac.id
  WHERE da.cuenta_codigo = '1003';
  
  -- Calcular ventas pendientes reales
  SELECT COALESCE(SUM(monto_pendiente), 0)
  INTO ventas_pendientes_reales
  FROM transacciones_ingresos
  WHERE tipo_pago IN ('credito', 'parcial')
    AND monto_pendiente > 0
    AND estado = 'activo';
  
  RAISE NOTICE '================================================';
  RAISE NOTICE 'VALIDACIÓN FINAL DE CUENTAS POR COBRAR';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Saldo contable CxC (cuenta 1003): $%', saldo_cxc_contable;
  RAISE NOTICE 'Ventas pendientes reales: $%', ventas_pendientes_reales;
  RAISE NOTICE 'Diferencia: $%', ABS(saldo_cxc_contable - ventas_pendientes_reales);
  
  IF ABS(saldo_cxc_contable - ventas_pendientes_reales) < 1 THEN
    RAISE NOTICE '✅ VALIDACIÓN EXITOSA - Los saldos coinciden';
  ELSE
    RAISE WARNING '⚠️ Los saldos NO coinciden - Revisar manualmente';
  END IF;
END $$;