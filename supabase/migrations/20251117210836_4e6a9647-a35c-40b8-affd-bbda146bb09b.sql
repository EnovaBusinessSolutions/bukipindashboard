-- 1. Actualizar la función generar_asiento_capital() con la cuenta correcta
CREATE OR REPLACE FUNCTION public.generar_asiento_capital()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  cuenta_efectivo text;
BEGIN
  -- Determinar cuenta de efectivo (siempre usamos 1001 - Caja para capital)
  cuenta_efectivo := '1001';
  
  -- Generar número de asiento único
  numero_asiento_generado := 'CAP-' || NEW.id::text;

  -- Crear el asiento contable
  INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
  VALUES (
    NEW.user_id,
    numero_asiento_generado,
    CASE 
      WHEN NEW.tipo_movimiento = 'aportacion' THEN 'Aportación de capital: ' || NEW.socio
      ELSE 'Pago de dividendos: ' || NEW.socio
    END,
    NEW.fecha
  )
  RETURNING id INTO nuevo_asiento_id;

  -- Si es una aportación
  IF NEW.tipo_movimiento = 'aportacion' THEN
    -- DEBE: Caja (aumenta el efectivo)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      cuenta_efectivo,
      NEW.monto,
      0,
      'Aportación en efectivo'
    );

    -- HABER: Capital Social (aumenta el capital)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      '3001',
      0,
      NEW.monto,
      'Aportación de: ' || NEW.socio
    );
  
  -- Si es un dividendo
  ELSE
    -- DEBE: Utilidades Retenidas (disminuye el capital ganado)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      '3102',
      NEW.monto,
      0,
      'Dividendo pagado a: ' || NEW.socio
    );

    -- HABER: Caja (disminuye el efectivo)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      cuenta_efectivo,
      0,
      NEW.monto,
      'Pago de dividendo en efectivo'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Crear el trigger que ejecute la función automáticamente
DROP TRIGGER IF EXISTS trigger_generar_asiento_capital ON public.transacciones_capital;

CREATE TRIGGER trigger_generar_asiento_capital
  AFTER INSERT ON public.transacciones_capital
  FOR EACH ROW
  EXECUTE FUNCTION public.generar_asiento_capital();