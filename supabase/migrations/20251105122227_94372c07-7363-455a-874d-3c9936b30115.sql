-- Mejorar el trigger generar_asiento_compra_inventario para evitar descuadres
-- Validar que los montos de la transacción coincidan con el costo total del movimiento

CREATE OR REPLACE FUNCTION public.generar_asiento_compra_inventario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_asiento_id uuid;
  numero_asiento_generado text;
  producto_nombre text;
  user_id_movimiento uuid;
  monto_pagado numeric;
  monto_pendiente numeric;
  metodo_pago text;
  tipo_pago text;
  proveedor_nombre_transaccion text;
BEGIN
  -- Solo procesar compras (no ventas ni ajustes)
  IF NEW.tipo_movimiento = 'compra' AND NEW.descripcion NOT LIKE 'CANCELACIÓN%' THEN
    
    -- Obtener información del producto
    SELECT nombre INTO producto_nombre
    FROM productos
    WHERE id = NEW.producto_id;
    
    -- Obtener user_id (viene del movimiento o del producto)
    user_id_movimiento := NEW.user_id;
    
    IF user_id_movimiento IS NULL THEN
      SELECT user_id INTO user_id_movimiento
      FROM productos
      WHERE id = NEW.producto_id;
    END IF;
    
    -- Buscar transacción de egreso relacionada para obtener info de pago
    -- VALIDAR QUE EL MONTO TOTAL COINCIDA CON EL COSTO TOTAL
    SELECT 
      te.monto_pagado, 
      te.monto_pendiente, 
      te.metodo_pago,
      te.tipo_pago,
      te.proveedor_nombre
    INTO monto_pagado, monto_pendiente, metodo_pago, tipo_pago, proveedor_nombre_transaccion
    FROM transacciones_egresos te
    WHERE te.tipo_egreso IN ('compra_inventario', 'costo')
    AND te.descripcion LIKE '%' || producto_nombre || '%'
    AND te.user_id = user_id_movimiento
    AND ABS(te.monto_total - NEW.costo_total) < 0.01  -- Validar que coincida el monto
    ORDER BY te.created_at DESC
    LIMIT 1;
    
    -- Si no se encuentra info de pago, asumir pago de contado en efectivo
    IF monto_pagado IS NULL THEN
      monto_pagado := NEW.costo_total;
      monto_pendiente := 0;
      metodo_pago := 'efectivo';
      tipo_pago := 'contado';
    END IF;
    
    -- Generar número de asiento único
    numero_asiento_generado := 'COMP-INV-' || NEW.id::text;
    
    -- Crear el asiento contable
    INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
    VALUES (
      user_id_movimiento,
      numero_asiento_generado,
      'Compra de inventario: ' || COALESCE(producto_nombre, 'Producto'),
      NEW.fecha
    )
    RETURNING id INTO nuevo_asiento_id;
    
    -- DEBE: Inventario de Mercancías (aumenta el activo)
    INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
    VALUES (
      nuevo_asiento_id,
      '1005',
      NEW.costo_total,
      0,
      'Compra de ' || NEW.cantidad || ' unidades de ' || COALESCE(producto_nombre, 'Producto')
    );
    
    -- HABER: Registrar monto pagado si hay pago inicial
    IF monto_pagado > 0 THEN
      IF metodo_pago = 'efectivo' THEN
        INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
        VALUES (
          nuevo_asiento_id,
          '1001',
          0,
          monto_pagado,
          CASE 
            WHEN tipo_pago = 'parcial' THEN 'Pago parcial en efectivo'
            ELSE 'Pago en efectivo'
          END
        );
      ELSE
        INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
        VALUES (
          nuevo_asiento_id,
          '1002',
          0,
          monto_pagado,
          CASE 
            WHEN tipo_pago = 'parcial' THEN 'Pago parcial por transferencia'
            ELSE 'Pago por transferencia/tarjeta'
          END
        );
      END IF;
    END IF;
    
    -- HABER: Registrar monto pendiente si hay saldo a crédito
    IF monto_pendiente > 0 THEN
      INSERT INTO public.detalle_asientos (asiento_id, cuenta_codigo, debe, haber, descripcion)
      VALUES (
        nuevo_asiento_id,
        '2002',
        0,
        monto_pendiente,
        'Saldo pendiente por pagar' || 
        CASE 
          WHEN proveedor_nombre_transaccion IS NOT NULL 
          THEN ' - ' || proveedor_nombre_transaccion
          ELSE ''
        END
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;