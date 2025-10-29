-- Corregir las primeras 5 transacciones de ingresos que tienen inconsistencias
-- donde monto_pagado + monto_pendiente no es igual a monto_total

UPDATE transacciones_ingresos 
SET monto_pendiente = 50 
WHERE id IN ('2fc09cec-7721-4c41-9ec1-c4ba7cdbcd21', '55118534-0a14-4075-8e86-89c16561b2b1', '8d626d41-41a2-4fc5-bbd6-5efcbd120adc');

UPDATE transacciones_ingresos 
SET monto_pendiente = 100 
WHERE id IN ('696f92ad-933f-4fce-8691-87bf8d0ef4b0', '730d7e0e-b528-4f89-a6c9-4ddc5d3392ae');