-- 1. Actualizar subgrupo de cuentas de depreciación
UPDATE cuentas 
SET subgrupo = 'Depreciaciones y Amortizaciones'
WHERE codigo IN ('5109', '5110');

-- 2. Habilitar extensiones necesarias para cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Crear cron job que se ejecuta los días 28-31 de cada mes a las 23:59
-- Esto asegura que se ejecute al final del mes (28, 29, 30 o 31 según el mes)
-- La función ya tiene lógica para prevenir duplicados
SELECT cron.schedule(
  'generar-depreciaciones-automaticas',
  '59 23 28-31 * *',
  $$
  SELECT net.http_post(
    url := 'https://rvutjdrjxuilmjugnbtq.supabase.co/functions/v1/generar-depreciaciones-manual',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2dXRqZHJqeHVpbG1qdWduYnRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4OTU5MTIsImV4cCI6MjA3MjQ3MTkxMn0.oH2EcpiLJUcIgcE-pjogAztvLkSnGjEbdstkOFEvbGs"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);