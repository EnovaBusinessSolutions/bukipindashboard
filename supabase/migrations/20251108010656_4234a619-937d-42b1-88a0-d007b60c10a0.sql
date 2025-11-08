
-- Eliminar todos los asientos contables simulados y sus detalles
-- Primero eliminar detalles (por foreign key)
DELETE FROM detalle_asientos 
WHERE asiento_id IN (
  SELECT id FROM asientos_contables 
  WHERE numero_asiento LIKE 'SIM-DEP-%'
);

-- Luego eliminar asientos
DELETE FROM asientos_contables 
WHERE numero_asiento LIKE 'SIM-DEP-%';
