-- Crear trigger para generar asientos contables automáticamente desde transacciones_capital
CREATE OR REPLACE FUNCTION public.generar_asiento_capital()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  cuenta_efectivo text;
  cuenta_capital text;
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
    -- DEBE: Utilidades Retenidas (disminuye el capital)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      '3002',
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

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_generar_asiento_capital ON public.transacciones_capital;
CREATE TRIGGER trigger_generar_asiento_capital
  AFTER INSERT ON public.transacciones_capital
  FOR EACH ROW
  EXECUTE FUNCTION public.generar_asiento_capital();

-- Migrar datos históricos: generar asientos para transacciones de capital existentes
DO $$
DECLARE
  transaccion RECORD;
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  cuenta_efectivo text := '1001';
BEGIN
  -- Procesar cada transacción de capital existente que no tenga asiento
  FOR transaccion IN 
    SELECT * FROM public.transacciones_capital
    WHERE NOT EXISTS (
      SELECT 1 FROM public.asientos_contables 
      WHERE numero_asiento = 'CAP-' || transacciones_capital.id::text
    )
  LOOP
    -- Generar número de asiento
    numero_asiento_generado := 'CAP-' || transaccion.id::text;

    -- Crear el asiento contable
    INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
    VALUES (
      transaccion.user_id,
      numero_asiento_generado,
      CASE 
        WHEN transaccion.tipo_movimiento = 'aportacion' THEN 'Aportación de capital: ' || transaccion.socio
        ELSE 'Pago de dividendos: ' || transaccion.socio
      END,
      transaccion.fecha
    )
    RETURNING id INTO nuevo_asiento_id;

    -- Si es una aportación
    IF transaccion.tipo_movimiento = 'aportacion' THEN
      -- DEBE: Caja
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        cuenta_efectivo,
        transaccion.monto,
        0,
        'Aportación en efectivo'
      );

      -- HABER: Capital Social
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '3001',
        0,
        transaccion.monto,
        'Aportación de: ' || transaccion.socio
      );
    
    -- Si es un dividendo
    ELSE
      -- DEBE: Utilidades Retenidas
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '3002',
        transaccion.monto,
        0,
        'Dividendo pagado a: ' || transaccion.socio
      );

      -- HABER: Caja
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        cuenta_efectivo,
        0,
        transaccion.monto,
        'Pago de dividendo en efectivo'
      );
    END IF;
  END LOOP;
END $$;

-- Eliminar asientos contables descuadrados (donde debe != haber)
DELETE FROM public.detalle_asientos
WHERE asiento_id IN (
  SELECT asiento_id 
  FROM public.detalle_asientos
  GROUP BY asiento_id
  HAVING SUM(debe) != SUM(haber)
);

DELETE FROM public.asientos_contables
WHERE id NOT IN (
  SELECT DISTINCT asiento_id 
  FROM public.detalle_asientos
);