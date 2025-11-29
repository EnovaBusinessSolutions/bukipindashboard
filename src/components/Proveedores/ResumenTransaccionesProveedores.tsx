import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { format, isToday, isThisMonth, isThisYear } from "date-fns";
import { es } from "date-fns/locale";

interface TransaccionProveedor {
  id: string;
  proveedor_nombre: string | null;
  descripcion: string;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number | null;
  metodo_pago: string | null;
  estado: string;
  created_at: string;
}

export default function ResumenTransaccionesProveedores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("todos");
  const [proveedorFiltro, setProveedorFiltro] = useState<string>("todos");

  const { data: transacciones, isLoading } = useQuery({
    queryKey: ["transacciones-proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_egresos")
        .select("*")
        .eq("estado", "activo")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TransaccionProveedor[];
    },
  });

  const proveedoresUnicos = Array.from(
    new Set(
      transacciones
        ?.map((t) => t.proveedor_nombre)
        .filter((nombre): nombre is string => nombre !== null && nombre !== "")
    )
  ).sort();

  const transaccionesFiltradas = transacciones?.filter((transaccion) => {
    // Filtro por búsqueda
    const matchSearch =
      !searchTerm ||
      transaccion.proveedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaccion.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro por proveedor
    const matchProveedor =
      proveedorFiltro === "todos" || transaccion.proveedor_nombre === proveedorFiltro;

    // Filtro por período
    let matchPeriodo = true;
    if (periodoFiltro !== "todos") {
      const fecha = new Date(transaccion.created_at);
      if (periodoFiltro === "hoy") {
        matchPeriodo = isToday(fecha);
      } else if (periodoFiltro === "mes") {
        matchPeriodo = isThisMonth(fecha);
      } else if (periodoFiltro === "año") {
        matchPeriodo = isThisYear(fecha);
      }
    }

    return matchSearch && matchProveedor && matchPeriodo;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      activo: "default",
      pagado: "secondary",
      pendiente: "outline",
      cancelado: "destructive",
    };
    return <Badge variant={variants[estado] || "default"}>{estado}</Badge>;
  };

  const totalTransacciones = transaccionesFiltradas?.length || 0;
  const montoTotalNeto = transaccionesFiltradas?.reduce((sum, t) => sum + t.monto_total, 0) || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen de Transacciones con Proveedores</CardTitle>
        <CardDescription>
          Visualiza y filtra todas las transacciones de egresos registradas con proveedores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por proveedor o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={proveedorFiltro} onValueChange={setProveedorFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los proveedores</SelectItem>
              {proveedoresUnicos.map((proveedor) => (
                <SelectItem key={proveedor} value={proveedor}>
                  {proveedor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los períodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los períodos</SelectItem>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="año">Este año</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla de Transacciones */}
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : transaccionesFiltradas && transaccionesFiltradas.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Pendiente</TableHead>
                    <TableHead>Método Pago</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaccionesFiltradas.map((transaccion) => (
                    <TableRow key={transaccion.id}>
                      <TableCell>
                        {format(new Date(transaccion.created_at), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {transaccion.proveedor_nombre || "Sin proveedor"}
                      </TableCell>
                      <TableCell>{transaccion.descripcion}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(transaccion.monto_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(transaccion.monto_pagado)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(transaccion.monto_pendiente || 0)}
                      </TableCell>
                      <TableCell>{transaccion.metodo_pago || "N/A"}</TableCell>
                      <TableCell>{getEstadoBadge(transaccion.estado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Resumen */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Total de transacciones: <span className="font-semibold text-foreground">{totalTransacciones}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Monto total: <span className="font-semibold text-foreground">{formatCurrency(montoTotalNeto)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron transacciones con los filtros seleccionados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
