-- Crear tabla instituciones_financieras
CREATE TABLE instituciones_financieras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  logo_url TEXT,
  ejecutivo_nombre TEXT,
  ejecutivo_telefono TEXT,
  ejecutivo_email TEXT,
  telefono_principal TEXT,
  email_principal TEXT,
  direccion TEXT,
  ciudad TEXT,
  estado TEXT,
  codigo_postal TEXT,
  sitio_web TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint para evitar duplicados por usuario
  CONSTRAINT unique_nombre_institucion_per_user UNIQUE(user_id, nombre)
);

-- Índices para mejorar performance
CREATE INDEX idx_instituciones_user_id ON instituciones_financieras(user_id);
CREATE INDEX idx_instituciones_nombre ON instituciones_financieras(nombre);
CREATE INDEX idx_instituciones_activo ON instituciones_financieras(activo);

-- RLS Policies
ALTER TABLE instituciones_financieras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instituciones"
  ON instituciones_financieras FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own instituciones"
  ON instituciones_financieras FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instituciones"
  ON instituciones_financieras FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instituciones"
  ON instituciones_financieras FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_instituciones_financieras_updated_at
  BEFORE UPDATE ON instituciones_financieras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Modificar tabla financiamientos para agregar FK
ALTER TABLE financiamientos
ADD COLUMN institucion_financiera_id UUID 
REFERENCES instituciones_financieras(id);

-- Crear índice
CREATE INDEX idx_financiamientos_institucion_id 
ON financiamientos(institucion_financiera_id);

-- Migrar datos existentes
INSERT INTO instituciones_financieras (user_id, nombre, activo)
SELECT DISTINCT 
  user_id,
  institucion_financiera as nombre,
  true as activo
FROM financiamientos
WHERE institucion_financiera IS NOT NULL
  AND institucion_financiera != ''
ON CONFLICT (user_id, nombre) DO NOTHING;

-- Actualizar financiamientos con el ID de la institución
UPDATE financiamientos f
SET institucion_financiera_id = i.id
FROM instituciones_financieras i
WHERE f.institucion_financiera = i.nombre
  AND f.user_id = i.user_id
  AND f.institucion_financiera_id IS NULL;