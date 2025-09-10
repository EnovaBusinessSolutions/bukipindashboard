-- Políticas temporales para prototipo - permitir operaciones sin autenticación

-- Eliminar políticas restrictivas actuales de subcuentas
DROP POLICY IF EXISTS "Users can create their own subcuentas" ON public.subcuentas;
DROP POLICY IF EXISTS "Users can view their own subcuentas" ON public.subcuentas;
DROP POLICY IF EXISTS "Users can update their own subcuentas" ON public.subcuentas;
DROP POLICY IF EXISTS "Users can delete their own subcuentas" ON public.subcuentas;

-- Crear políticas abiertas para prototipo
CREATE POLICY "Allow all operations for prototype" 
ON public.subcuentas 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- También hacer lo mismo para transacciones_ingresos para evitar problemas similares
DROP POLICY IF EXISTS "Users can create their own transacciones_ingresos" ON public.transacciones_ingresos;
DROP POLICY IF EXISTS "Users can view their own transacciones_ingresos" ON public.transacciones_ingresos;
DROP POLICY IF EXISTS "Users can update their own transacciones_ingresos" ON public.transacciones_ingresos;
DROP POLICY IF EXISTS "Allow read for test user" ON public.transacciones_ingresos;

-- Políticas abiertas para transacciones_ingresos
CREATE POLICY "Allow all operations for prototype transacciones" 
ON public.transacciones_ingresos 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Lo mismo para asientos_contables
DROP POLICY IF EXISTS "Users can create their own asientos_contables" ON public.asientos_contables;
DROP POLICY IF EXISTS "Users can view their own asientos_contables" ON public.asientos_contables;
DROP POLICY IF EXISTS "Allow read for test user asientos" ON public.asientos_contables;

CREATE POLICY "Allow all operations for prototype asientos" 
ON public.asientos_contables 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Y para detalle_asientos
DROP POLICY IF EXISTS "Users can create their own detalle_asientos" ON public.detalle_asientos;
DROP POLICY IF EXISTS "Users can view their own detalle_asientos" ON public.detalle_asientos;
DROP POLICY IF EXISTS "Allow read for test user detalle" ON public.detalle_asientos;

CREATE POLICY "Allow all operations for prototype detalle" 
ON public.detalle_asientos 
FOR ALL 
USING (true) 
WITH CHECK (true);