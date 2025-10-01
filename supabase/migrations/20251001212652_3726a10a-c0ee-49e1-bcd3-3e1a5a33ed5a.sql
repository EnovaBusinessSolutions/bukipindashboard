-- Eliminar las políticas actuales de proveedores
DROP POLICY IF EXISTS "Users can view their own proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Users can create their own proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Users can update their own proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Users can delete their own proveedores" ON public.proveedores;

-- Crear nuevas políticas más permisivas para usuarios autenticados
CREATE POLICY "Allow authenticated users to view their own proveedores" 
ON public.proveedores 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Allow authenticated users to insert their own proveedores" 
ON public.proveedores 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow authenticated users to update their own proveedores" 
ON public.proveedores 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow authenticated users to delete their own proveedores" 
ON public.proveedores 
FOR DELETE 
TO authenticated
USING (user_id = auth.uid());