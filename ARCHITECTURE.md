# Arquitectura de Datos - Sistema Contable

## Principio Fundamental: Única Fuente de Verdad

Este sistema contable sigue el principio de **Partida Doble** donde **TODOS** los movimientos financieros se registran como asientos contables. Los asientos contables son la **ÚNICA FUENTE DE VERDAD** para todos los reportes financieros.

## Flujo de Datos

```
┌─────────────────────┐
│   Transacción       │
│   (Ingresos,        │
│    Egresos, etc.)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Trigger SQL       │
│   (Automático)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Asiento Contable   │◄─── ÚNICA FUENTE DE VERDAD
│  + Detalle Asientos │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Estados            │
│  Financieros        │
│  (Balance, P&L,     │
│   Flujo Efectivo)   │
└─────────────────────┘
```

## Estructura de Tablas

### Tablas de Partida Doble (Fuente de Verdad)

1. **`asientos_contables`**
   - Encabezado del asiento
   - Contiene: id, user_id, fecha, numero_asiento, descripcion
   - Representa una transacción completa

2. **`detalle_asientos`**
   - Detalle del asiento (líneas de debe y haber)
   - Contiene: cuenta_codigo, debe, haber, descripcion
   - Cada línea representa un movimiento en una cuenta contable

### Tablas Operativas (Solo para Detalles)

3. **`transacciones_ingresos`**
   - Detalle operativo de ventas
   - Información de cliente, método de pago, etc.
   - **NO** se usa para cálculos financieros

4. **`transacciones_egresos`**
   - Detalle operativo de gastos
   - Información de proveedor, categoría, etc.
   - **NO** se usa para cálculos financieros

5. **`inversiones_capex`**
   - Detalle de activos fijos
   - Cálculo de depreciación
   - Los asientos se generan automáticamente

6. **`financiamientos`**
   - Detalle de créditos y préstamos
   - Amortización y cálculo de intereses
   - Los asientos se generan automáticamente

## Reglas de Consulta por Tipo de Componente

### 📊 REGLA 1: Estados Financieros (Balance, Estado de Resultados, Flujo de Efectivo)

**✅ PERMITIDO:**
- Consultar `asientos_contables`
- Consultar `detalle_asientos`
- Consultar `cuentas` (catálogo de cuentas)
- Consultar `subcuentas` (subcuentas contables)

**❌ PROHIBIDO:**
- Consultar `transacciones_ingresos`
- Consultar `transacciones_egresos`
- Consultar `inversiones_capex`
- Consultar `financiamientos`

**Razón:** Los estados financieros DEBEN reflejar la contabilidad oficial. Cualquier discrepancia entre las tablas operativas y los asientos contables genera inconsistencias.

**Ejemplos de componentes:**
- `src/components/EstadosFinancieros/BalanceGeneralEjecutivo.tsx`
- `src/components/EstadosFinancieros/EstadoResultadosEjecutivo.tsx`
- `src/components/FlujoEfectivo/FlujoEfectivoEjecutivo.tsx`
- `src/hooks/useBalanceGeneral.tsx`
- `src/hooks/useEstadoResultadosMensual.tsx`

### 📈 REGLA 2: Reportes Analíticos y Dashboard

**✅ PERMITIDO:**
- Consultar `asientos_contables`
- Consultar `detalle_asientos`
- Para cálculos financieros: **SOLO** asientos contables

**⚠️ PERMITIDO CON RESTRICCIONES:**
- Consultar `transacciones_*` **SOLO para visualización de detalles operativos** (cliente, proveedor, método de pago)
- **NUNCA** usar `transacciones_*` para sumar totales financieros

**Ejemplos de componentes:**
- `src/hooks/useVentasResumen.tsx` ✅ (Refactorizado para usar asientos)
- `src/components/Dashboard/VentasAnalytics.tsx` ✅ (Usa useVentasResumen)
- `src/hooks/useIngresosMensualesPorTipo.tsx` ✅ (Refactorizado para usar asientos)
- `src/hooks/useEgresosMensualesPorTipo.tsx` ✅ (Refactorizado para usar asientos)

### 🔍 REGLA 3: Módulos Operativos (Clientes, Proveedores, CxC, CxP)

**✅ PERMITIDO:**
- Consultar `transacciones_*` para detalles operativos
- Mostrar información de cliente/proveedor
- Mostrar método de pago, comentarios, etc.

**⚠️ RECOMENDACIÓN:**
- Para cálculos de saldos: Usar `asientos_contables`
- Para detalles de transacciones: Usar `transacciones_*`

**Ejemplos de componentes:**
- `src/hooks/useTransaccionesRecientes.tsx` ✅ (Para vista operativa)
- `src/components/Clientes/AnalyticasClientes.tsx`
- `src/hooks/useCuentasPorCobrar.tsx`

### 🛠️ REGLA 4: Formularios de Registro

**✅ PERMITIDO:**
- Insertar en `transacciones_*`
- Insertar en `inversiones_capex`
- Insertar en `financiamientos`

**🔒 AUTOMÁTICO:**
- Los triggers SQL se encargan de crear los asientos contables
- **NUNCA** insertar manualmente en `asientos_contables` desde formularios
- Dejar que el sistema maneje la contabilidad automáticamente

**Ejemplos de componentes:**
- `src/components/RegistroIngresos.tsx`
- `src/components/RegistroEgresos.tsx`
- `src/components/Inversiones/RegistroInversionForm.tsx`

## Plan de Cuentas Contables

### Activos (1XXX)
- **1001**: Caja (Efectivo)
- **1002**: Bancos
- **1003**: Cuentas por Cobrar
- **12XX**: Activos Fijos
- **1202**: Depreciación Acumulada

### Pasivos (2XXX)
- **2001**: Cuentas por Pagar
- **2002**: Créditos a Corto Plazo
- **21XX**: Créditos a Largo Plazo

### Capital (3XXX)
- **3001**: Capital Social
- **3002**: Utilidades Retenidas

### Ingresos (4XXX)
- **4001**: Ventas de Productos/Servicios
- **4002**: Otros Ingresos
- **4003**: Ganancia por Venta de Activos

### Costos y Gastos (5XXX)
- **5001-5099**: Costo de Ventas
- **5100-5108**: Gastos Operativos
- **5109-5110**: Depreciación
- **5111-5199**: Gastos Financieros (Intereses)
- **5201**: Intereses sobre Financiamientos
- **5202-5203**: Otros Gastos

## Triggers Automáticos Implementados

1. **`generar_asiento_capital()`**
   - Se activa en: INSERT en `transacciones_capital`
   - Genera asiento para aportaciones y dividendos

2. **`generar_asiento_inversion()`**
   - Se activa en: INSERT en `inversiones_capex`
   - Genera asiento de compra de activos fijos

3. **`generar_asiento_depreciacion_mensual()`**
   - Se activa en: UPDATE en `inversiones_capex`
   - Genera asientos de depreciación automática

4. **`generar_asiento_baja_activo()`**
   - Se activa en: UPDATE en `inversiones_capex` (cambio de estado)
   - Genera asiento de venta o baja de activos

5. **`generar_asiento_cobro_pago()`**
   - Se activa en: INSERT en `transacciones_cobros_pagos`
   - Genera asiento para cobros de CxC

## Validación de Consistencia

Se ha implementado el hook `useDataConsistency` que valida periódicamente:

1. **Balance de Asientos**: Verifica que cada asiento tenga Debe = Haber
2. **Consistencia de Totales**: Compara totales entre tablas operativas y asientos contables
3. **Alerta de Discrepancias**: Notifica al usuario si encuentra inconsistencias > 1%

## Mejores Prácticas

### ✅ DO (Hacer)

1. Consultar `asientos_contables` para todos los cálculos financieros
2. Usar `detalle_asientos` para obtener saldos por cuenta
3. Confiar en los triggers para generar asientos automáticamente
4. Validar que Debe = Haber en todos los asientos
5. Usar el hook `useDataConsistency` para detectar inconsistencias

### ❌ DON'T (No Hacer)

1. Consultar `transacciones_*` para calcular totales en estados financieros
2. Insertar manualmente en `asientos_contables` desde formularios
3. Modificar `detalle_asientos` sin actualizar el asiento padre
4. Confiar en sumas de `transacciones_*` para reportes oficiales
5. Ignorar las alertas de inconsistencia de datos

## Reseteo de Datos

Al ejecutar un reset completo desde Configuración:

1. Se borran todos los `detalle_asientos` (primero por foreign keys)
2. Se borran todos los `asientos_contables`
3. Se borran todas las `transacciones_*`
4. Se borran todas las `inversiones_capex` y `financiamientos`
5. Se resetean los valores de inventario a cero

**IMPORTANTE:** El reset incluye datos residuales con `user_id` null o de prueba para garantizar una limpieza completa.

## Referencias

- Documentación de Supabase: https://supabase.com/docs
- Principios de Contabilidad: Partida Doble
- Triggers SQL en PostgreSQL: https://www.postgresql.org/docs/current/trigger-definition.html

---

**Última actualización:** 2025-01
**Mantenido por:** Lovable AI
