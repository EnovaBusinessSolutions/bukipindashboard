-- Crear función para generar asientos contables de inversiones CAPEX
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

  -- HABER: Caja/Bancos o Cuentas por Pagar según tipo de pago
  IF NEW.tipo_pago = 'contado' THEN
    -- Pago de contado
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
END;
$function$;

-- Crear trigger para generar asientos automáticamente
DROP TRIGGER IF EXISTS trigger_generar_asiento_inversion ON public.inversiones_capex;
CREATE TRIGGER trigger_generar_asiento_inversion
  AFTER INSERT ON public.inversiones_capex
  FOR EACH ROW
  EXECUTE FUNCTION public.generar_asiento_inversion();

-- Crear función para generar asientos de depreciación mensual
CREATE OR REPLACE FUNCTION public.generar_asiento_depreciacion_mensual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
BEGIN
  -- Solo generar asientos para activos activos con depreciación
  IF NEW.estado = 'activo' AND NEW.valor_depreciacion_mensual > 0 THEN
    -- Generar número de asiento único
    numero_asiento_generado := 'DEP-' || NEW.id::text || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMM');

    -- Verificar si ya existe asiento de depreciación para este mes
    IF NOT EXISTS (
      SELECT 1 FROM public.asientos_contables 
      WHERE numero_asiento = numero_asiento_generado
    ) THEN
      -- Crear el asiento contable
      INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
      VALUES (
        NEW.user_id,
        numero_asiento_generado,
        'Depreciación mensual: ' || NEW.producto_nombre,
        CURRENT_DATE
      )
      RETURNING id INTO nuevo_asiento_id;

      -- DEBE: Gasto por Depreciación
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '5003',
        NEW.valor_depreciacion_mensual,
        0,
        'Gasto por depreciación'
      );

      -- HABER: Depreciación Acumulada
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '1202',
        0,
        NEW.valor_depreciacion_mensual,
        'Depreciación acumulada de ' || NEW.producto_nombre
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Crear función para asientos de baja de activos
CREATE OR REPLACE FUNCTION public.generar_asiento_baja_activo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  depreciacion_acumulada numeric;
  valor_neto numeric;
  ganancia_perdida numeric;
BEGIN
  -- Solo procesar si cambió a estado 'vendido' o 'dado_baja'
  IF NEW.estado IN ('vendido', 'dado_baja') AND OLD.estado = 'activo' THEN
    -- Calcular depreciación acumulada (aproximada)
    depreciacion_acumulada := NEW.valor_depreciacion_mensual * 
      EXTRACT(MONTH FROM AGE(COALESCE(NEW.fecha_baja, CURRENT_DATE), NEW.fecha_inicio_depreciacion));
    
    valor_neto := NEW.valor_total - depreciacion_acumulada;
    ganancia_perdida := COALESCE(NEW.valor_venta, 0) - valor_neto;

    -- Generar número de asiento único
    numero_asiento_generado := 'BAJA-' || NEW.id::text;

    -- Crear el asiento contable de baja
    INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
    VALUES (
      NEW.user_id,
      numero_asiento_generado,
      'Baja de activo: ' || NEW.producto_nombre || ' - ' || COALESCE(NEW.motivo_baja, ''),
      COALESCE(NEW.fecha_baja, CURRENT_DATE)
    )
    RETURNING id INTO nuevo_asiento_id;

    -- DEBE: Depreciación Acumulada (eliminar la acumulada)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      '1202',
      depreciacion_acumulada,
      0,
      'Eliminar depreciación acumulada'
    );

    -- Si hubo venta
    IF NEW.estado = 'vendido' AND NEW.valor_venta > 0 THEN
      -- DEBE: Caja/Bancos (ingreso por venta)
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '1001',
        NEW.valor_venta,
        0,
        'Ingreso por venta de activo'
      );
    END IF;

    -- HABER: Activo Fijo (eliminar el activo)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      COALESCE(NEW.cuenta_codigo, '1201'),
      0,
      NEW.valor_total,
      'Dar de baja activo'
    );

    -- Registrar ganancia o pérdida
    IF ganancia_perdida != 0 THEN
      IF ganancia_perdida > 0 THEN
        -- HABER: Ganancia por venta de activo
        INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
        VALUES (
          nuevo_asiento_id,
          '4003',
          0,
          ganancia_perdida,
          'Ganancia por venta de activo'
        );
      ELSE
        -- DEBE: Pérdida por venta de activo
        INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
        VALUES (
          nuevo_asiento_id,
          '5004',
          ABS(ganancia_perdida),
          0,
          'Pérdida por venta/baja de activo'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Crear trigger para baja de activos
DROP TRIGGER IF EXISTS trigger_generar_asiento_baja_activo ON public.inversiones_capex;
CREATE TRIGGER trigger_generar_asiento_baja_activo
  AFTER UPDATE ON public.inversiones_capex
  FOR EACH ROW
  WHEN (NEW.estado IN ('vendido', 'dado_baja') AND OLD.estado = 'activo')
  EXECUTE FUNCTION public.generar_asiento_baja_activo();