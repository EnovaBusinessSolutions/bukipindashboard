-- Eliminar columnas calculadas redundantes de la tabla productos
-- Estos campos se calcularán dinámicamente desde movimientos_inventario
ALTER TABLE productos 
  DROP COLUMN IF EXISTS cantidad_stock,
  DROP COLUMN IF EXISTS costo_unitario,
  DROP COLUMN IF EXISTS cantidad_comprada,
  DROP COLUMN IF EXISTS valor_total_inventario;

-- Documentar el cambio
COMMENT ON TABLE productos IS 'Tabla de productos. Los datos de inventario (stock, costos) se calculan dinámicamente desde movimientos_inventario usando useInventarioConMovimientos hook';