-- Eliminar productos sin respaldo contable
DELETE FROM productos
WHERE id IN (
  'e9e6708d-21e6-4a16-9040-d90c47d2c89d',  -- Coca Cola
  '3068477f-e425-4d95-9b0e-be9caad91968',  -- Cruz Blanca
  'b663f853-75f5-4f6a-a801-1c28e822ee80'   -- cruz blanca (servicios)
);