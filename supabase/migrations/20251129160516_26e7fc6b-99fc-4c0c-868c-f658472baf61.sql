-- Crear asiento contable para el pago de $6,000 a Proveedor Maquinas (Italika)
-- Este pago existe en transacciones_cobros_pagos pero no tiene su asiento contable

DO $$
DECLARE
  pago_record RECORD;
  nuevo_asiento_id uuid;
BEGIN
  -- Obtener información del pago
  SELECT * INTO pago_record
  FROM transacciones_cobros_pagos
  WHERE id = 'a8d60f27-951b-446e-9aa7-eeafa2ff9fd1';

  -- Crear el asiento contable
  INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
  VALUES (
    pago_record.user_id,
    'PAG-CXP-' || pago_record.id::text,
    pago_record.descripcion,
    pago_record.fecha
  )
  RETURNING id INTO nuevo_asiento_id;

  -- DEBE: Proveedores (disminuye la deuda) - $6,000
  INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
  VALUES (
    nuevo_asiento_id,
    '2001',
    6000,
    0,
    'Pago a proveedor - Disminuye CxP'
  );

  -- HABER: Bancos (disminuye el efectivo) - $6,000
  INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
  VALUES (
    nuevo_asiento_id,
    '1002',
    0,
    6000,
    'Pago por transferencia bancaria'
  );

  RAISE NOTICE 'Asiento contable creado exitosamente para el pago de $6,000';
END $$;