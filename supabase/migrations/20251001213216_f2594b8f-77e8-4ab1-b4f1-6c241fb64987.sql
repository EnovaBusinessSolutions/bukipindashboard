-- Eliminar todas las políticas actuales
DROP POLICY IF EXISTS "Allow authenticated users to view their own proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Allow authenticated users to insert their own proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Allow authenticated users to update their own proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own proveedores" ON public.proveedores;

-- Crear política temporal permisiva para debugging
CREATE POLICY "Allow all for authenticated users" 
ON public.proveedores 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);