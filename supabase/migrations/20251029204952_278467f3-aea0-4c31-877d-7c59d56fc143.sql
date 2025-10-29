-- Corregir transacciones de ingresos con descuentos que causan descuadres
-- El monto_total debe ser igual a monto_pagado + monto_pendiente
-- El descuento ya está registrado en monto_descuento y monto_neto

UPDATE transacciones_ingresos 
SET monto_total = monto_pagado + monto_pendiente
WHERE id IN ('cf8817ff-8a9c-4444-9ff5-1c1702f5a2de', '8eb1b6bf-3ee8-4b20-8aa7-4270ab6c8ccd');