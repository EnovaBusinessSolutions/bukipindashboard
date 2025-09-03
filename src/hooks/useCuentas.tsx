import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Cuenta = {
  codigo: string;
  nombre: string;
  estado_financiero: string;
  grupo: string;
  subgrupo: string;
};

export type EstadosFinancieros = {
  [key: string]: {
    [key: string]: {
      [key: string]: Cuenta[];
    };
  };
};

export const useCuentas = () => {
  return useQuery({
    queryKey: ["cuentas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuentas")
        .select("*")
        .order("codigo");

      if (error) throw error;

      // Transform flat data into nested structure
      const estadosFinancieros: EstadosFinancieros = {};

      data?.forEach((cuenta) => {
        const { estado_financiero, grupo, subgrupo } = cuenta;
        
        if (!estadosFinancieros[estado_financiero]) {
          estadosFinancieros[estado_financiero] = {};
        }
        
        if (!estadosFinancieros[estado_financiero][grupo]) {
          estadosFinancieros[estado_financiero][grupo] = {};
        }
        
        if (!estadosFinancieros[estado_financiero][grupo][subgrupo]) {
          estadosFinancieros[estado_financiero][grupo][subgrupo] = [];
        }
        
        estadosFinancieros[estado_financiero][grupo][subgrupo].push(cuenta);
      });

      return { estadosFinancieros, cuentasFlat: data || [] };
    },
  });
};