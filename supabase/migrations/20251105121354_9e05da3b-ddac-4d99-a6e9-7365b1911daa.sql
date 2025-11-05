
-- Corregir el asiento descuadrado COMP-INV-06194c87-c6f9-4582-a0f4-bf7d70df25d3
-- El inventario es de $600, pero el haber solo suma $400 ($100 bancos + $300 CxP)
-- Debe ser: $600 = $100 (bancos) + $500 (CxP)

UPDATE detalle_asientos
SET haber = 500.00
WHERE id = 'af58647e-6d78-468d-aa3f-6eaa387d94ce'
AND asiento_id = (
  SELECT id FROM asientos_contables 
  WHERE numero_asiento = 'COMP-INV-06194c87-c6f9-4582-a0f4-bf7d70df25d3'
);

-- Verificación: El asiento debe quedar balanceado
-- Debe: $600 (Inventario)
-- Haber: $100 (Bancos) + $500 (CxP) = $600 ✓
