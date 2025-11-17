-- Reclasificar la transacción de "Acrílicos" a la cuenta correcta
UPDATE detalle_asientos 
SET cuenta_codigo = '2101'
WHERE id = '9e419b2b-b08d-4d40-a8b5-33758fa8f9ff';