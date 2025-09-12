import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Calendar, DollarSign, User, AlertCircle } from "lucide-react";

const CuentasPorCobrar = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: cuentasPorCobrar, isLoading } = useQuery({
    queryKey: ["cuentas-por-cobrar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacciones_ingresos")
        .select("*")
        .gt("monto_pendiente", 0)
        .order("fecha_vencimiento", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredCuentas = cuentasPorCobrar?.filter(
    (cuenta) =>
      cuenta.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalPorCobrar = filteredCuentas.reduce((sum, cuenta) => sum + (cuenta.monto_pendiente || 0), 0);
  const vencidas = filteredCuentas.filter(cuenta => 
    cuenta.fecha_vencimiento && new Date(cuenta.fecha_vencimiento) < new Date()
  ).length;
  const porVencer = filteredCuentas.filter(cuenta => 
    cuenta.fecha_vencimiento && new Date(cuenta.fecha_vencimiento) >= new Date()
  ).length;

  const getEstadoBadge = (fechaVencimiento: string | null, montoPendiente: number) => {
    if (montoPendiente === 0) {
      return <Badge variant="secondary">Cobrado</Badge>;
    }
    
    if (!fechaVencimiento) {
      return <Badge variant="outline">Sin vencimiento</Badge>;
    }

    const fechaVence = new Date(fechaVencimiento);
    const hoy = new Date();
    
    if (fechaVence < hoy) {
      return <Badge variant="destructive">Vencida</Badge>;
    } else {
      return <Badge variant="default">Por vencer</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Cargando cuentas por cobrar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cuentas por Cobrar</h1>
            <p className="text-muted-foreground">
              Gestiona y da seguimiento a las cuentas pendientes de cobro
            </p>
          </div>
        </div>

        {/* Métricas Resumen */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total por Cobrar</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalPorCobrar.toLocaleString('es-CO')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cuentas Vencidas</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{vencidas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{porVencer}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredCuentas.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtrar Cuentas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por cliente o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Cuentas por Cobrar */}
        <Card>
          <CardHeader>
            <CardTitle>Listado de Cuentas por Cobrar</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCuentas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No se encontraron cuentas por cobrar.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto Total</TableHead>
                      <TableHead>Monto Pagado</TableHead>
                      <TableHead>Monto Pendiente</TableHead>
                      <TableHead>Fecha Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCuentas.map((cuenta) => (
                      <TableRow key={cuenta.id}>
                        <TableCell className="font-medium">
                          {cuenta.cliente_nombre || "Sin nombre"}
                        </TableCell>
                        <TableCell>{cuenta.descripcion}</TableCell>
                        <TableCell>
                          ${cuenta.monto_total.toLocaleString('es-CO')}
                        </TableCell>
                        <TableCell>
                          ${cuenta.monto_pagado.toLocaleString('es-CO')}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${cuenta.monto_pendiente?.toLocaleString('es-CO') || 0}
                        </TableCell>
                        <TableCell>
                          {cuenta.fecha_vencimiento
                            ? format(new Date(cuenta.fecha_vencimiento), "dd/MM/yyyy", {
                                locale: es,
                              })
                            : "Sin vencimiento"}
                        </TableCell>
                        <TableCell>
                          {getEstadoBadge(cuenta.fecha_vencimiento, cuenta.monto_pendiente || 0)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline">
                            Registrar Pago
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CuentasPorCobrar;