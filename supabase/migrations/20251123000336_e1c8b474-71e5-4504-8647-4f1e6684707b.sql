-- Migrar pagos iniciales históricos a transacciones_cobros_pagos
-- Esto insertará los pagos iniciales de todas las transacciones de ingresos
-- que tienen monto_pagado > 0 pero no tienen un registro correspondiente

INSERT INTO transacciones_cobros_pagos (
  user_id,
  tipo_transaccion,
  referencia_id,
  referencia_tabla,
  monto,
  metodo_pago,
  fecha,
  descripcion
)
SELECT 
  ti.user_id,
  'cobro',
  ti.id,
  'transacciones_ingresos',
  ti.monto_pagado,
  ti.metodo_pago,
  ti.created_at::date,
  'Pago inicial - ' || ti.descripcion
FROM transacciones_ingresos ti
WHERE ti.monto_pagado > 0
  AND ti.estado = 'activo'
  AND NOT EXISTS (
    SELECT 1 
    FROM transacciones_cobros_pagos tcp
    WHERE tcp.referencia_id = ti.id
      AND tcp.referencia_tabla = 'transacciones_ingresos'
      AND tcp.tipo_transaccion = 'cobro'
      AND tcp.descripcion LIKE 'Pago inicial%'
  );