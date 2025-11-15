import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Financiamiento {
  id: string;
  user_id: string;
  nombre: string;
  descripcion?: string;
  tipo_credito: string;
  monto_total: number;
  tasa_interes: number;
  plazo_meses: number;
  fecha_inicio: string;
  fecha_vencimiento: string;
  saldo_inicial: number;
  saldo_actual: number;
  institucion_financiera: string;
  numero_cuenta?: string;
  condiciones?: string;
  subcuenta_id?: string;
  cuenta_codigo?: string;
  estado: string;
  created_at: string;
  updated_at: string;
}

export interface TransaccionFinanciamiento {
  id: string;
  user_id: string;
  financiamiento_id: string;
  tipo_transaccion: string;
  monto: number;
  fecha: string;
  capital_pagado: number;
  interes_pagado: number;
  saldo_restante: number;
  descripcion?: string;
  metodo_pago?: string;
  numero_referencia?: string;
  created_at: string;
}

export const useFinanciamientos = () => {
  const queryClient = useQueryClient();

  const { data: financiamientos = [], isLoading } = useQuery({
    queryKey: ["financiamientos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamientos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Financiamiento[];
    },
  });

  const { data: transacciones = [] } = useQuery({
    queryKey: ["transacciones_financiamientos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_financiamientos")
        .select("*")
        .order("fecha", { ascending: false });

      if (error) throw error;
      return data as TransaccionFinanciamiento[];
    },
  });

  const crearFinanciamiento = useMutation({
    mutationFn: async (financiamiento: Omit<Financiamiento, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      console.log("Iniciando creación de financiamiento:", financiamiento);

      // Para tarjetas de crédito, el saldo inicial es 0 (no se desembolsa)
      const esTarjetaCredito = financiamiento.tipo_credito === 'tarjeta_corporativa';
      const financiamientoData = esTarjetaCredito 
        ? { ...financiamiento, saldo_inicial: 0, saldo_actual: 0, user_id: user.id }
        : { ...financiamiento, user_id: user.id };

      // Crear el financiamiento
      const { data: nuevoFinanciamiento, error: errorFinanciamiento } = await supabase
        .from("financiamientos")
        .insert([financiamientoData])
        .select()
        .single();

      if (errorFinanciamiento) {
        console.error("Error al crear financiamiento:", errorFinanciamiento);
        throw errorFinanciamiento;
      }

      console.log("Financiamiento creado:", nuevoFinanciamiento);

      // Para tarjetas de crédito Y líneas revolventes, NO crear transacción ni asientos contables
      // Solo registrar el límite de crédito disponible
      const esLineaRevolvente = financiamiento.tipo_credito === 'revolvente';
      if (esTarjetaCredito || esLineaRevolvente) {
        console.log(`${esTarjetaCredito ? 'Tarjeta de crédito' : 'Línea revolvente'} registrada - no se genera asiento contable`);
        return nuevoFinanciamiento;
      }

      // Para créditos simples, crear transacción de desembolso inicial
      const transaccionDesembolso = {
        user_id: user.id,
        financiamiento_id: nuevoFinanciamiento.id,
        tipo_transaccion: "desembolso",
        monto: financiamiento.monto_total,
        fecha: financiamiento.fecha_inicio,
        capital_pagado: 0,
        interes_pagado: 0,
        saldo_restante: financiamiento.monto_total,
        descripcion: `Desembolso inicial del financiamiento: ${financiamiento.nombre}`,
      };

      console.log("Creando transacción de desembolso:", transaccionDesembolso);

      const { error: errorTransaccion } = await supabase
        .from("transacciones_financiamientos")
        .insert([transaccionDesembolso]);

      if (errorTransaccion) {
        console.error("Error al crear transacción:", errorTransaccion);
        throw errorTransaccion;
      }

      console.log("Transacción de desembolso creada");

      // Generar número de asiento
      const { data: numeroAsiento, error: errorNumero } = await supabase
        .rpc('generate_asiento_number', { p_user_id: user.id });

      if (errorNumero) {
        console.error("Error al generar número de asiento:", errorNumero);
        throw errorNumero;
      }

      console.log("Número de asiento generado:", numeroAsiento);

      // Crear asiento contable (Débito: Bancos, Crédito: Pasivo Bancario)
      const { data: asiento, error: errorAsiento } = await supabase
        .from("asientos_contables")
        .insert([{
          user_id: user.id,
          numero_asiento: numeroAsiento,
          fecha: financiamiento.fecha_inicio,
          descripcion: `Registro de financiamiento: ${financiamiento.nombre} - ${financiamiento.institucion_financiera}`,
        }])
        .select()
        .single();

      if (errorAsiento) {
        console.error("Error al crear asiento:", errorAsiento);
        throw errorAsiento;
      }

      console.log("Asiento contable creado:", asiento);

      // Crear detalles del asiento (Débito a Bancos - cuenta 1002)
      const { error: errorDebito } = await supabase
        .from("detalle_asientos")
        .insert([{
          asiento_id: asiento.id,
          cuenta_codigo: "1002",
          debe: financiamiento.monto_total,
          haber: 0,
          descripcion: `Desembolso de ${financiamiento.tipo_credito} - ${financiamiento.institucion_financiera}`,
        }]);

      if (errorDebito) {
        console.error("Error al crear débito:", errorDebito);
        throw errorDebito;
      }

      // Crear detalles del asiento (Crédito a Pasivo Bancario - cuenta 2101)
      const { error: errorCredito } = await supabase
        .from("detalle_asientos")
        .insert([{
          asiento_id: asiento.id,
          cuenta_codigo: "2101",
          debe: 0,
          haber: financiamiento.monto_total,
          descripcion: `Préstamo ${financiamiento.tipo_credito} - ${financiamiento.institucion_financiera}`,
        }]);

      if (errorCredito) {
        console.error("Error al crear crédito:", errorCredito);
        throw errorCredito;
      }

      console.log("Asientos contables completados");

      return nuevoFinanciamiento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
      toast({
        title: "Financiamiento registrado",
        description: "El financiamiento se ha registrado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const crearTransaccion = useMutation({
    mutationFn: async (transaccion: Omit<TransaccionFinanciamiento, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Crear la transacción
      const { data, error } = await supabase
        .from("transacciones_financiamientos")
        .insert([{ ...transaccion, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      // Actualizar saldo del financiamiento
      if (transaccion.financiamiento_id && transaccion.saldo_restante !== undefined) {
        await supabase
          .from("financiamientos")
          .update({ saldo_actual: transaccion.saldo_restante })
          .eq("id", transaccion.financiamiento_id);
      }

      // Si es una amortización, crear asiento contable
      if (transaccion.tipo_transaccion === "amortizacion") {
        // Obtener información del financiamiento
        const { data: financiamiento } = await supabase
          .from("financiamientos")
          .select("*")
          .eq("id", transaccion.financiamiento_id)
          .single();

        if (financiamiento) {
          // Generar número de asiento
          const { data: numeroAsiento } = await supabase
            .rpc('generate_asiento_number', { p_user_id: user.id });

          // Crear asiento contable
          const { data: asiento } = await supabase
            .from("asientos_contables")
            .insert([{
              user_id: user.id,
              numero_asiento: numeroAsiento,
              fecha: transaccion.fecha,
              descripcion: `Pago de amortización: ${financiamiento.nombre}`,
            }])
            .select()
            .single();

          if (asiento) {
            // Débito a Pasivo Bancario (capital)
            if (transaccion.capital_pagado > 0) {
              await supabase
                .from("detalle_asientos")
                .insert([{
                  asiento_id: asiento.id,
                  cuenta_codigo: "2101",
                  debe: transaccion.capital_pagado,
                  haber: 0,
                  descripcion: `Pago a capital - ${financiamiento.nombre}`,
                }]);
            }

            // Débito a Gastos Financieros (intereses)
            if (transaccion.interes_pagado > 0) {
              await supabase
                .from("detalle_asientos")
                .insert([{
                  asiento_id: asiento.id,
                  cuenta_codigo: "5201",
                  debe: transaccion.interes_pagado,
                  haber: 0,
                  descripcion: `Intereses pagados - ${financiamiento.nombre}`,
                }]);
            }

            // Crédito a Bancos/Caja según método de pago
            const cuentaPago = transaccion.metodo_pago === "efectivo" ? "1001" : "1002";
            await supabase
              .from("detalle_asientos")
              .insert([{
                asiento_id: asiento.id,
                cuenta_codigo: cuentaPago,
                debe: 0,
                haber: transaccion.monto,
                descripcion: `Pago de financiamiento - ${financiamiento.nombre}`,
              }]);
          }
        }
      }

      // Si es un cargo por interés, crear asiento contable
      if (transaccion.tipo_transaccion === "cargo_interes") {
        const { data: financiamiento } = await supabase
          .from("financiamientos")
          .select("*")
          .eq("id", transaccion.financiamiento_id)
          .single();

        if (financiamiento) {
          const { data: numeroAsiento } = await supabase
            .rpc('generate_asiento_number', { p_user_id: user.id });

          const { data: asiento } = await supabase
            .from("asientos_contables")
            .insert([{
              user_id: user.id,
              numero_asiento: numeroAsiento,
              fecha: transaccion.fecha,
              descripcion: `Cargo por intereses: ${financiamiento.nombre}`,
            }])
            .select()
            .single();

          if (asiento) {
            // Débito a Gastos Financieros
            await supabase
              .from("detalle_asientos")
              .insert([{
                asiento_id: asiento.id,
                cuenta_codigo: "5201",
                debe: transaccion.monto,
                haber: 0,
                descripcion: transaccion.descripcion || `Cargo por intereses - ${financiamiento.nombre}`,
              }]);

            // Crédito a Pasivo Bancario
            await supabase
              .from("detalle_asientos")
              .insert([{
                asiento_id: asiento.id,
                cuenta_codigo: "2101",
                debe: 0,
                haber: transaccion.monto,
                descripcion: `Acumulación de intereses - ${financiamiento.nombre}`,
              }]);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transacciones_financiamientos"] });
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
      toast({
        title: "Transacción registrada",
        description: "La transacción se ha registrado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const crearDisposicion = useMutation({
    mutationFn: async (disposicion: {
      financiamiento_id: string;
      monto: number;
      fecha: string;
      metodo_pago: string;
      descripcion?: string;
      numero_referencia?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Obtener financiamiento
      const { data: financiamiento, error: errorFin } = await supabase
        .from("financiamientos")
        .select("*")
        .eq("id", disposicion.financiamiento_id)
        .single();

      if (errorFin || !financiamiento) throw new Error("Financiamiento no encontrado");

      // Validar que hay límite disponible
      const limiteDisponible = financiamiento.monto_total - financiamiento.saldo_actual;
      if (disposicion.monto > limiteDisponible) {
        throw new Error(`Límite insuficiente. Disponible: $${limiteDisponible.toFixed(2)}`);
      }

      // Crear transacción
      const nuevoSaldo = financiamiento.saldo_actual + disposicion.monto;
      
      const { error: errorTransaccion } = await supabase
        .from("transacciones_financiamientos")
        .insert([{
          user_id: user.id,
          financiamiento_id: disposicion.financiamiento_id,
          tipo_transaccion: "disposicion",
          monto: disposicion.monto,
          fecha: disposicion.fecha,
          capital_pagado: 0,
          interes_pagado: 0,
          saldo_restante: nuevoSaldo,
          descripcion: disposicion.descripcion || `Disposición de línea revolvente`,
          metodo_pago: disposicion.metodo_pago,
          numero_referencia: disposicion.numero_referencia,
        }]);

      if (errorTransaccion) throw errorTransaccion;

      // Actualizar saldo del financiamiento
      const { error: errorUpdate } = await supabase
        .from("financiamientos")
        .update({ saldo_actual: nuevoSaldo })
        .eq("id", disposicion.financiamiento_id);

      if (errorUpdate) throw errorUpdate;

      // Crear asiento contable
      const { data: numeroAsiento } = await supabase
        .rpc('generate_asiento_number', { p_user_id: user.id });

      const { data: asiento } = await supabase
        .from("asientos_contables")
        .insert([{
          user_id: user.id,
          numero_asiento: numeroAsiento,
          fecha: disposicion.fecha,
          descripcion: `Disposición: ${financiamiento.nombre} - $${disposicion.monto.toFixed(2)}`,
        }])
        .select()
        .single();

      if (asiento) {
        // DEBE: Bancos/Caja (aumenta el efectivo)
        const cuentaDestino = disposicion.metodo_pago === "efectivo" ? "1001" : "1002";
        await supabase
          .from("detalle_asientos")
          .insert([{
            asiento_id: asiento.id,
            cuenta_codigo: cuentaDestino,
            debe: disposicion.monto,
            haber: 0,
            descripcion: `Disposición de ${financiamiento.nombre}`,
          }]);

        // HABER: Préstamos Bancarios (aumenta el pasivo)
        await supabase
          .from("detalle_asientos")
          .insert([{
            asiento_id: asiento.id,
            cuenta_codigo: "2101",
            debe: 0,
            haber: disposicion.monto,
            descripcion: `Disposición de línea revolvente - ${financiamiento.institucion_financiera}`,
          }]);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financiamientos"] });
      queryClient.invalidateQueries({ queryKey: ["transacciones_financiamientos"] });
      toast({
        title: "Disposición registrada",
        description: "La disposición se ha registrado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    financiamientos,
    transacciones,
    isLoading,
    crearFinanciamiento,
    crearTransaccion,
    crearDisposicion,
  };
};
