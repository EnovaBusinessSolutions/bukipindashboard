-- Paso 1: Crear asiento contable para el pago de $6,000 a Italika (maquinas)
DO $$
DECLARE
  v_user_id uuid;
  v_nuevo_asiento_id uuid;
  v_fecha date;
BEGIN
  -- Obtener user_id y fecha de la transacción de pago de $6,000
  SELECT user_id, fecha INTO v_user_id, v_fecha
  FROM transacciones_cobros_pagos
  WHERE id = 'a8d60f27-5f64-46c5-ba88-d6177d1a0e50'
  LIMIT 1;

  -- Si existe el user_id, crear el asiento
  IF v_user_id IS NOT NULL THEN
    -- Crear el asiento contable
    INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
    VALUES (
      v_user_id,
      'PAG-CXP-' || EXTRACT(EPOCH FROM NOW())::bigint,
      'Pago a proveedor: Italika',
      v_fecha
    )
    RETURNING id INTO v_nuevo_asiento_id;

    -- DEBE: Proveedores (disminuye el pasivo)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      v_nuevo_asiento_id,
      '2001',
      6000,
      0,
      'Pago a proveedor de maquinas'
    );

    -- HABER: Bancos (disminuye el activo)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      v_nuevo_asiento_id,
      '1002',
      0,
      6000,
      'Pago por transferencia'
    );
  END IF;
END $$;

-- Paso 2: Eliminar asientos COB- que no tienen detalles (creados erróneamente por el trigger anterior)
DELETE FROM public.asientos_contables
WHERE numero_asiento LIKE 'COB-%'
AND id IN (
  SELECT ac.id
  FROM public.asientos_contables ac
  LEFT JOIN public.detalle_asientos da ON da.asiento_id = ac.id
  WHERE ac.numero_asiento LIKE 'COB-%'
  GROUP BY ac.id
  HAVING COUNT(da.id) = 0
);