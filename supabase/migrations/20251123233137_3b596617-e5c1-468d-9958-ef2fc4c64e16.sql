-- Limpiar asiento duplicado de cancelación
-- Eliminar los detalles del asiento duplicado más reciente
DELETE FROM detalle_asientos 
WHERE asiento_id = '82d3a59e-05a6-4c34-acf9-52937122e3b8';

-- Eliminar el asiento duplicado más reciente
DELETE FROM asientos_contables
WHERE id = '82d3a59e-05a6-4c34-acf9-52937122e3b8'
  AND numero_asiento = 'CANC-EGR-b4087dfc-9d59-4de5-923a-1265004c0ec2';