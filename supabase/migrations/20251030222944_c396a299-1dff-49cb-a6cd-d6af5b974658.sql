
-- Eliminar transacciones_ingresos que no tienen asientos_contables asociados
DELETE FROM transacciones_ingresos
WHERE id NOT IN (
  SELECT DISTINCT transaccion_ingreso_id 
  FROM asientos_contables 
  WHERE transaccion_ingreso_id IS NOT NULL
);
