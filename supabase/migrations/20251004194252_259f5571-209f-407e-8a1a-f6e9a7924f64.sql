-- Agregar campo para imágenes de comprobantes en transacciones_egresos
ALTER TABLE transacciones_egresos 
ADD COLUMN imagen_comprobante text;