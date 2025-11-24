-- Modificar el trigger para que solo se ejecute en cobros (no en pagos)
CREATE OR REPLACE FUNCTION public.generar_asiento_cobro_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  cuenta_efectivo text;
  numero_asiento_generado text;
BEGIN
  -- SOLO procesar si es un COBRO (no pagos)
  IF NEW.tipo_transaccion != 'cobro' THEN
    RETURN NEW;
  END IF;

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

  RETURN NEW;
END;
$function$;