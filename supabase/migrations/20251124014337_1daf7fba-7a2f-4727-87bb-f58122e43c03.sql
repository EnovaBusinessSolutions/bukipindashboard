
-- Crear asiento de ajuste para cuadrar Cuentas por Cobrar
-- Saldo contable actual: $23,165
-- Saldo real pendiente: $24,205  
-- Diferencia a ajustar: $1,040

DO $$
DECLARE
  nuevo_asiento_id uuid;
  user_id_sistema uuid;
BEGIN
  -- Obtener un user_id del sistema (usar el primero disponible)
  SELECT user_id INTO user_id_sistema
  FROM transacciones_ingresos
  WHERE user_id IS NOT NULL
  LIMIT 1;

  -- Crear el asiento contable de ajuste
  INSERT INTO public.asientos_contables (
    user_id, 
    numero_asiento, 
    descripcion, 
    fecha
  )
  VALUES (
    user_id_sistema,
    'AJUSTE-CXC-2025-001',
    'Ajuste de conciliación de Cuentas por Cobrar - Cuadre con transacciones reales pendientes',
    CURRENT_DATE
  )
  RETURNING id INTO nuevo_asiento_id;

  -- DEBE: Cuentas por Cobrar (aumenta el saldo)
  INSERT INTO public.detalle_asientos (
    asiento_id, 
    cuenta_codigo, 
    debe, 
    haber, 
    descripcion
  )
  VALUES (
    nuevo_asiento_id,
    '1003',
    1040.00,
    0,
    'Ajuste para cuadrar saldo de CxC con transacciones reales'
  );

  -- HABER: Utilidades Retenidas (ajuste patrimonial)
  INSERT INTO public.detalle_asientos (
    asiento_id, 
    cuenta_codigo, 
    debe, 
    haber, 
    descripcion
  )
  VALUES (
    nuevo_asiento_id,
    '3102',
    0,
    1040.00,
    'Ajuste por discrepancia en registro histórico de CxC'
  );

  RAISE NOTICE 'Asiento de ajuste creado exitosamente: AJUSTE-CXC-2025-001';
END $$;

-- Verificar el nuevo saldo de CxC
SELECT 
  SUM(debe) as total_debe,
  SUM(haber) as total_haber,
  SUM(debe - haber) as saldo_neto_cxc
FROM detalle_asientos
WHERE cuenta_codigo = '1003';
