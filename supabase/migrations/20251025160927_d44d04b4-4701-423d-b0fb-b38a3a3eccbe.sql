-- Corregir el saldo de las tarjetas corporativas existentes
-- Solo el límite (monto_total) debe mantenerse, los saldos deben ser 0 hasta que se usen

UPDATE financiamientos
SET 
  saldo_actual = 0,
  saldo_inicial = 0
WHERE tipo_credito = 'tarjeta_corporativa';