-- Corregir el saldo actual de la tarjeta Amex Corp
-- El saldo correcto según transacciones activas es $4,000
UPDATE financiamientos 
SET saldo_actual = 4000 
WHERE id = '77ca12dc-a22a-4b2b-a4b5-ad4d77d9e301';