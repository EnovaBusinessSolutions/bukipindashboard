-- Actualizar función de depreciación mensual con cuentas correctas
CREATE OR REPLACE FUNCTION public.generar_asiento_depreciacion_mensual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  cuenta_depreciacion_acumulada text;
BEGIN
  -- Solo generar asientos para activos activos con depreciación
  IF NEW.estado = 'activo' AND NEW.valor_depreciacion_mensual > 0 THEN
    
    -- Mapear cuenta de activo a cuenta de depreciación acumulada
    cuenta_depreciacion_acumulada := CASE COALESCE(NEW.cuenta_codigo, '1206')
      WHEN '1202' THEN '1207'  -- Edificios -> Dep. Acum. Edificios
      WHEN '1203' THEN '1208'  -- Maquinaria -> Dep. Acum. Maquinaria
      WHEN '1204' THEN '1209'  -- Mobiliario -> Dep. Acum. Mobiliario
      WHEN '1205' THEN '1210'  -- Vehículos -> Dep. Acum. Vehículos
      WHEN '1206' THEN '1211'  -- Equipo Cómputo -> Dep. Acum. Equipo Cómputo
      WHEN '1212' THEN '1213'  -- Otros Activos -> Dep. Acum. Otros
      ELSE '1213'              -- Default: Dep. Acum. Otros Activos
    END;
    
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

      -- DEBE: Gasto por Depreciación (cuenta correcta 5109)
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '5109',
        NEW.valor_depreciacion_mensual,
        0,
        'Gasto por depreciación'
      );

      -- HABER: Depreciación Acumulada (cuenta dinámica según tipo de activo)
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        cuenta_depreciacion_acumulada,
        0,
        NEW.valor_depreciacion_mensual,
        'Depreciación acumulada de ' || NEW.producto_nombre
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;