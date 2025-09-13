-- Agregar nuevos campos para base de datos de clientes
-- Eliminar campo cliente_contacto y agregar campos específicos

-- Agregar nuevas columnas para información detallada del cliente
ALTER TABLE transacciones_ingresos 
ADD COLUMN cliente_telefono TEXT,
ADD COLUMN cliente_email TEXT,
ADD COLUMN cliente_rfc TEXT;

-- Migrar datos existentes de cliente_contacto a cliente_telefono si existe información
UPDATE transacciones_ingresos 
SET cliente_telefono = cliente_contacto 
WHERE cliente_contacto IS NOT NULL AND cliente_contacto != '';

-- Eliminar la columna cliente_contacto ya que ahora tenemos campos específicos
ALTER TABLE transacciones_ingresos 
DROP COLUMN IF EXISTS cliente_contacto;