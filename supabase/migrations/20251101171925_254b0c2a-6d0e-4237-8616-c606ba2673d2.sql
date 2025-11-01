-- FASE 1: Limpieza de datos residuales de prueba
-- Eliminar registros con user_id de prueba (00000000-0000-0000-0000-000000000000)

-- 1. Obtener los IDs de asientos de prueba para borrar sus detalles
DO $$
DECLARE
  asiento_ids uuid[];
BEGIN
  -- Recolectar IDs de asientos de prueba
  SELECT ARRAY_AGG(id) INTO asiento_ids
  FROM public.asientos_contables
  WHERE user_id = '00000000-0000-0000-0000-000000000000';

  -- Borrar detalle_asientos de estos asientos
  IF asiento_ids IS NOT NULL AND array_length(asiento_ids, 1) > 0 THEN
    DELETE FROM public.detalle_asientos
    WHERE asiento_id = ANY(asiento_ids);
  END IF;
END $$;

-- 2. Borrar asientos contables de prueba
DELETE FROM public.asientos_contables
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 3. Borrar todas las transacciones de prueba
DELETE FROM public.transacciones_cobros_pagos
WHERE user_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM public.transacciones_impuestos
WHERE user_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM public.transacciones_financiamientos
WHERE user_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM public.transacciones_capital
WHERE user_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM public.transacciones_egresos
WHERE user_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM public.transacciones_ingresos
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 4. Borrar inversiones y financiamientos de prueba
DELETE FROM public.inversiones_capex
WHERE user_id = '00000000-0000-0000-0000-000000000000';

DELETE FROM public.financiamientos
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 5. Borrar movimientos de inventario de prueba
DELETE FROM public.movimientos_inventario
WHERE user_id = '00000000-0000-0000-0000-000000000000' OR user_id IS NULL;