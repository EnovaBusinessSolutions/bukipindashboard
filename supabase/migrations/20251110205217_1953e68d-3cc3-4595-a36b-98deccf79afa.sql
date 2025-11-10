-- Eliminar el asiento contable con fecha futura
-- Este asiento no debería existir porque representa un cobro futuro
DELETE FROM detalle_asientos 
WHERE asiento_id = (
  SELECT id FROM asientos_contables 
  WHERE numero_asiento = 'COB-5f6e2f45-51ae-4e37-a61c-c35fb5554e1a'
);

DELETE FROM asientos_contables 
WHERE numero_asiento = 'COB-5f6e2f45-51ae-4e37-a61c-c35fb5554e1a';