-- Modificar trigger para generar números únicos con timestamp
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

    -- Generar número de asiento único CON TIMESTAMP
    numero_asiento_generado := 'BAJA-' || NEW.id::text || '-' || 
      TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS');

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
      
      -- 1. REGISTRAR LO QUE SE PAGÓ (si hay monto pagado)
      IF COALESCE(NEW.monto_pagado_venta, 0) > 0 THEN
        
        -- Determinar cuenta según método de pago
        IF NEW.metodo_pago_venta = 'efectivo' THEN
          -- DEBE: Caja
          INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
          VALUES (
            nuevo_asiento_id,
            '1001',
            NEW.monto_pagado_venta,
            0,
            'Ingreso por venta de activo - Efectivo'
          );
        ELSE
          -- DEBE: Bancos
          INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
          VALUES (
            nuevo_asiento_id,
            '1002',
            NEW.monto_pagado_venta,
            0,
            'Ingreso por venta de activo - Transferencia'
          );
        END IF;
        
      END IF;
      
      -- 2. REGISTRAR LO QUE FALTA POR COBRAR (si hay saldo pendiente)
      IF COALESCE(NEW.monto_pendiente_venta, 0) > 0 THEN
        -- DEBE: Cuentas por Cobrar
        INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
        VALUES (
          nuevo_asiento_id,
          '1003',
          NEW.monto_pendiente_venta,
          0,
          'Venta de activo a crédito' || 
          CASE 
            WHEN NEW.comprador_nombre IS NOT NULL 
            THEN ' - ' || NEW.comprador_nombre
            ELSE ''
          END
        );
      END IF;
      
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

    -- FASE 4: Si quedó saldo pendiente, crear registro de CxC
    IF NEW.estado = 'vendido' AND COALESCE(NEW.monto_pendiente_venta, 0) > 0 THEN
      INSERT INTO public.transacciones_cobros_pagos (
        user_id,
        referencia_id,
        referencia_tabla,
        tipo_transaccion,
        monto,
        fecha,
        metodo_pago,
        descripcion
      ) VALUES (
        NEW.user_id,
        NEW.id,
        'inversiones_capex',
        'cobro',
        NEW.monto_pendiente_venta,
        COALESCE(NEW.fecha_vencimiento_venta, COALESCE(NEW.fecha_baja, CURRENT_DATE)),
        'pendiente',
        'Venta de activo fijo: ' || NEW.producto_nombre || 
        CASE 
          WHEN NEW.comprador_nombre IS NOT NULL 
          THEN ' - Cliente: ' || NEW.comprador_nombre
          ELSE ''
        END
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;