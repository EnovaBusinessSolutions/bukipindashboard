-- Paso 1: Crear función para generar asientos de cobros automáticamente
CREATE OR REPLACE FUNCTION public.generar_asiento_cobro_pago()
RETURNS TRIGGER AS $$
DECLARE
  nuevo_asiento_id uuid;
  cuenta_efectivo text;
  numero_asiento_generado text;
BEGIN
  -- Determinar la cuenta de efectivo según método de pago
  IF NEW.metodo_pago = 'efectivo' THEN
    cuenta_efectivo := '1001'; -- Caja
  ELSE
    cuenta_efectivo := '1002'; -- Bancos
  END IF;

  -- Generar número de asiento único
  numero_asiento_generado := 'COB-' || NEW.id::text;

  -- Crear el asiento contable
  INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
  VALUES (
    NEW.user_id,
    numero_asiento_generado,
    'Cobro: ' || COALESCE(NEW.descripcion, 'Sin descripción'),
    NEW.fecha
  )
  RETURNING id INTO nuevo_asiento_id;

  -- Si es un cobro (CxC)
  IF NEW.tipo_transaccion = 'cobro' THEN
    -- DEBE: Caja/Bancos (aumenta el efectivo)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      cuenta_efectivo,
      NEW.monto,
      0,
      'Cobro en ' || NEW.metodo_pago
    );

    -- HABER: Cuentas por Cobrar (disminuye la CxC)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      '1003',
      0,
      NEW.monto,
      'Cobro de CxC'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Paso 2: Crear trigger para ejecutar la función automáticamente
DROP TRIGGER IF EXISTS trigger_generar_asiento_cobro_pago ON public.transacciones_cobros_pagos;
CREATE TRIGGER trigger_generar_asiento_cobro_pago
AFTER INSERT ON public.transacciones_cobros_pagos
FOR EACH ROW
EXECUTE FUNCTION public.generar_asiento_cobro_pago();

-- Paso 3: Corregir datos históricos - Generar asientos retroactivos para cobros existentes
-- Primero, crear los asientos contables para transacciones de cobro que no tienen asiento
INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
SELECT 
  tcp.user_id,
  'COB-RETRO-' || tcp.id::text,
  'Cobro retroactivo: ' || COALESCE(tcp.descripcion, 'Sin descripción'),
  tcp.fecha
FROM public.transacciones_cobros_pagos tcp
WHERE tcp.tipo_transaccion = 'cobro'
  AND NOT EXISTS (
    SELECT 1 FROM public.asientos_contables ac 
    WHERE ac.numero_asiento = 'COB-' || tcp.id::text 
       OR ac.numero_asiento = 'COB-RETRO-' || tcp.id::text
  );

-- Paso 4: Insertar detalles de asientos retroactivos
WITH asientos_cobros AS (
  SELECT 
    ac.id as asiento_id,
    tcp.id as transaccion_id,
    tcp.monto,
    tcp.metodo_pago
  FROM public.transacciones_cobros_pagos tcp
  JOIN public.asientos_contables ac ON ac.numero_asiento = 'COB-RETRO-' || tcp.id::text
  WHERE tcp.tipo_transaccion = 'cobro'
)
INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
SELECT 
  asiento_id,
  CASE WHEN metodo_pago = 'efectivo' THEN '1001' ELSE '1002' END,
  monto,
  0,
  'Cobro en ' || metodo_pago
FROM asientos_cobros
UNION ALL
SELECT 
  asiento_id,
  '1003',
  0,
  monto,
  'Cobro de CxC'
FROM asientos_cobros;