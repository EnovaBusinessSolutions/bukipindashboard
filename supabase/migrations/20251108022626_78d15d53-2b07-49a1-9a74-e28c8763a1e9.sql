-- Corregir la función de baja de activos para generar asientos balanceados
-- con las cuentas correctas de depreciación acumulada y ganancia/pérdida

CREATE OR REPLACE FUNCTION public.generar_asiento_baja_activo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  cuenta_depreciacion_acumulada text;
  depreciacion_acumulada numeric;
  valor_neto numeric;
  ganancia_perdida numeric;
BEGIN
  -- Solo procesar si cambió a estado 'vendido' o 'dado_de_baja'
  IF NEW.estado IN ('vendido', 'dado_de_baja') AND OLD.estado = 'activo' THEN
    
    -- Mapear cuenta de depreciación según tipo de activo
    cuenta_depreciacion_acumulada := CASE COALESCE(NEW.cuenta_codigo, '1206')
      WHEN '1202' THEN '1207'  -- Edificios -> Dep. Acum. Edificios
      WHEN '1203' THEN '1208'  -- Maquinaria -> Dep. Acum. Maquinaria
      WHEN '1204' THEN '1209'  -- Mobiliario -> Dep. Acum. Mobiliario
      WHEN '1205' THEN '1210'  -- Vehículos -> Dep. Acum. Vehículos
      WHEN '1206' THEN '1211'  -- Equipo Cómputo -> Dep. Acum. Equipo Cómputo
      WHEN '1212' THEN '1213'  -- Otros Activos -> Dep. Acum. Otros
      ELSE '1213'              -- Default: Dep. Acum. Otros Activos
    END;
    
    -- Calcular depreciación acumulada
    depreciacion_acumulada := NEW.valor_depreciacion_mensual * 
      EXTRACT(MONTH FROM AGE(COALESCE(NEW.fecha_baja, CURRENT_DATE), NEW.fecha_inicio_depreciacion));
    
    -- Valor en libros = Valor original - Depreciación acumulada
    valor_neto := NEW.valor_total - depreciacion_acumulada;
    
    -- Ganancia o pérdida = Valor de venta - Valor en libros
    ganancia_perdida := COALESCE(NEW.valor_venta, 0) - valor_neto;

    -- Generar número de asiento único
    numero_asiento_generado := 'BAJA-' || NEW.id::text;

    -- Crear el asiento contable de baja
    INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
    VALUES (
      NEW.user_id,
      numero_asiento_generado,
      'Baja de activo: ' || NEW.producto_nombre || 
      CASE 
        WHEN NEW.motivo_baja IS NOT NULL THEN ' - ' || NEW.motivo_baja
        ELSE ''
      END,
      COALESCE(NEW.fecha_baja, CURRENT_DATE)
    )
    RETURNING id INTO nuevo_asiento_id;

    -- DEBE: Depreciación Acumulada (eliminar la acumulada)
    IF depreciacion_acumulada > 0 THEN
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        cuenta_depreciacion_acumulada,
        depreciacion_acumulada,
        0,
        'Eliminar depreciación acumulada'
      );
    END IF;

    -- Si hubo venta
    IF NEW.estado = 'vendido' AND NEW.valor_venta > 0 THEN
      -- DEBE: Caja (ingreso por venta)
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '1001',
        NEW.valor_venta,
        0,
        'Ingreso por venta de activo'
      );
    END IF;

    -- Registrar ganancia o pérdida
    IF ganancia_perdida > 0 THEN
      -- HABER: Ganancia por venta de activo (cuenta correcta 4103)
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '4103',
        0,
        ganancia_perdida,
        'Ganancia por venta de activo'
      );
    ELSIF ganancia_perdida < 0 THEN
      -- DEBE: Pérdida por venta/baja de activo (cuenta correcta 5203)
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '5203',
        ABS(ganancia_perdida),
        0,
        'Pérdida por ' || 
        CASE 
          WHEN NEW.estado = 'vendido' THEN 'venta'
          ELSE 'baja'
        END || ' de activo'
      );
    END IF;

    -- HABER: Activo Fijo (eliminar el activo) - SIEMPRE AL FINAL
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      COALESCE(NEW.cuenta_codigo, '1206'),
      0,
      NEW.valor_total,
      'Dar de baja activo'
    );

  END IF;

  RETURN NEW;
END;
$function$;