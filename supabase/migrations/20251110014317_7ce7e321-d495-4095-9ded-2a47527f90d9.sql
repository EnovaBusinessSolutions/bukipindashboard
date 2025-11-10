-- Eliminar el trigger si existe
DROP TRIGGER IF EXISTS trigger_reversion_baja_activo ON public.inversiones_capex;

-- Función para generar asiento de reversión de baja de activo
CREATE OR REPLACE FUNCTION public.generar_asiento_reversion_baja_activo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  asiento_original_id uuid;
  numero_asiento_original text;
  nuevo_asiento_id uuid;
  numero_asiento_reversion text;
  detalle_record RECORD;
BEGIN
  -- Solo procesar si cambió de 'vendido'/'dado_de_baja' a 'activo'
  IF OLD.estado IN ('vendido', 'dado_de_baja') AND NEW.estado = 'activo' THEN
    
    -- Buscar el asiento original de baja
    numero_asiento_original := 'BAJA-' || NEW.id::text;
    
    SELECT id INTO asiento_original_id
    FROM public.asientos_contables
    WHERE numero_asiento = numero_asiento_original;
    
    IF asiento_original_id IS NULL THEN
      RAISE EXCEPTION 'No se encontró el asiento original de baja para revertir';
    END IF;
    
    -- Generar número de asiento de reversión
    numero_asiento_reversion := 'REV-BAJA-' || NEW.id::text;
    
    -- Verificar que no exista ya un asiento de reversión
    IF EXISTS (SELECT 1 FROM public.asientos_contables WHERE numero_asiento = numero_asiento_reversion) THEN
      RETURN NEW; -- Ya se revirtió anteriormente
    END IF;
    
    -- Crear el asiento de reversión
    INSERT INTO public.asientos_contables (user_id, numero_asiento, descripcion, fecha)
    SELECT 
      user_id,
      numero_asiento_reversion,
      'REVERSIÓN: ' || descripcion,
      CURRENT_DATE
    FROM public.asientos_contables
    WHERE id = asiento_original_id
    RETURNING id INTO nuevo_asiento_id;
    
    -- Copiar los detalles invirtiendo debe/haber
    FOR detalle_record IN 
      SELECT * FROM public.detalle_asientos 
      WHERE asiento_id = asiento_original_id
    LOOP
      INSERT INTO public.detalle_asientos (
        asiento_id, 
        cuenta_codigo, 
        debe, 
        haber, 
        descripcion
      ) VALUES (
        nuevo_asiento_id,
        detalle_record.cuenta_codigo,
        detalle_record.haber,  -- Invertir: lo que era HABER ahora es DEBE
        detalle_record.debe,   -- Invertir: lo que era DEBE ahora es HABER
        'Reversión: ' || detalle_record.descripcion
      );
    END LOOP;
    
    -- Si había una CxC pendiente de venta, eliminarla
    DELETE FROM public.transacciones_cobros_pagos
    WHERE referencia_tabla = 'inversiones_capex'
    AND referencia_id = NEW.id
    AND tipo_transaccion = 'cobro'
    AND metodo_pago = 'pendiente';
    
    -- Limpiar todos los campos relacionados con la baja/venta
    NEW.fecha_baja := NULL;
    NEW.motivo_baja := NULL;
    NEW.valor_venta := NULL;
    NEW.metodo_pago_venta := NULL;
    NEW.tipo_pago_venta := NULL;
    NEW.monto_pagado_venta := 0;
    NEW.monto_pendiente_venta := 0;
    NEW.fecha_vencimiento_venta := NULL;
    NEW.comprador_nombre := NULL;
    NEW.comprador_rfc := NULL;
    NEW.comprador_telefono := NULL;
    NEW.comprador_email := NULL;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger de reversión
CREATE TRIGGER trigger_reversion_baja_activo
BEFORE UPDATE ON public.inversiones_capex
FOR EACH ROW
WHEN (
  OLD.estado IN ('vendido', 'dado_de_baja') 
  AND NEW.estado = 'activo'
)
EXECUTE FUNCTION public.generar_asiento_reversion_baja_activo();