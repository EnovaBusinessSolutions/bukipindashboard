-- Actualizar trigger para manejar correctamente tipo_pago 'total' y 'contado'
CREATE OR REPLACE FUNCTION public.generar_asiento_inversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  cuenta_activo text;
BEGIN
  -- Validación: Si es pago total, debe coincidir el monto
  IF NEW.tipo_pago = 'total' THEN
    IF NEW.monto_pagado != NEW.valor_total THEN
      RAISE EXCEPTION 'Para pago total, el monto pagado debe ser igual al valor total';
    END IF;
    IF NEW.monto_pendiente != 0 THEN
      RAISE EXCEPTION 'Para pago total, el monto pendiente debe ser cero';
    END IF;
  END IF;

  -- Determinar cuenta de activo según categoría
  cuenta_activo := NEW.cuenta_codigo;
  IF cuenta_activo IS NULL THEN
    cuenta_activo := '1201'; -- Default: Activos Fijos
  END IF;
  
  -- Generar número de asiento único
  numero_asiento_generado := 'INV-' || NEW.id::text;

  -- Crear el asiento contable
  INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
  VALUES (
    NEW.user_id,
    numero_asiento_generado,
    'Inversión CAPEX: ' || NEW.producto_nombre,
    NEW.fecha_adquisicion
  )
  RETURNING id INTO nuevo_asiento_id;

  -- DEBE: Activo Fijo (aumenta el activo)
  INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
  VALUES (
    nuevo_asiento_id,
    cuenta_activo,
    NEW.valor_total,
    0,
    'Adquisición de activo: ' || NEW.producto_nombre
  );

  -- HABER: Registrar según tipo de pago
  -- Pago de contado o pago total
  IF NEW.tipo_pago IN ('contado', 'total') THEN
    IF NEW.metodo_pago = 'efectivo' THEN
      -- HABER: Caja
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '1001',
        0,
        NEW.monto_pagado,
        'Pago en efectivo'
      );
    ELSE
      -- HABER: Bancos
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '1002',
        0,
        NEW.monto_pagado,
        'Pago por transferencia/tarjeta'
      );
    END IF;
  ELSE
    -- Pago a crédito o parcial
    IF NEW.monto_pagado > 0 THEN
      -- Pago parcial - registrar lo pagado
      IF NEW.metodo_pago = 'efectivo' THEN
        INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
        VALUES (
          nuevo_asiento_id,
          '1001',
          0,
          NEW.monto_pagado,
          'Pago parcial en efectivo'
        );
      ELSE
        INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
        VALUES (
          nuevo_asiento_id,
          '1002',
          0,
          NEW.monto_pagado,
          'Pago parcial por transferencia'
        );
      END IF;
    END IF;
    
    -- Monto pendiente va a Cuentas por Pagar
    IF NEW.monto_pendiente > 0 THEN
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '2002',
        0,
        NEW.monto_pendiente,
        'Saldo por pagar'
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al generar asiento de inversión: %', SQLERRM;
END;
$function$;