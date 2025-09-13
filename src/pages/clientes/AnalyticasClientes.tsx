import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, MapPin, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router-dom";

interface ClienteAnalytica {
  cliente_nombre: string;
  cliente_email?: string;
  cliente_telefono?: string;
  total_compras: number;
  monto_total: number;
  ultima_compra: string;
  primera_compra: string;
}

interface UbicacionAnalytica {
  ubicacion: string;
  total_clientes: number;
  total_ventas: number;
  monto_promedio: number;
}

const AnalyticasClientes = () => {
  const [filtroTiempo, setFiltroTiempo] = useState("todos");
  const [vistaActual, setVistaActual] = useState("clientes");

  // Consulta para analíticas de clientes
  const { data: clientesAnalyticas = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['analiticas-clientes', filtroTiempo],
    queryFn: async () => {
      let query = supabase
        .from('transacciones_ingresos')
        .select(`
          cliente_nombre,
          cliente_email,
          cliente_telefono,
          monto_total,
          created_at
        `)
        .not('cliente_nombre', 'is', null);

      // Aplicar filtro de tiempo
      if (filtroTiempo !== "todos") {
        const fechaLimite = new Date();
        switch (filtroTiempo) {
          case "30dias":
            fechaLimite.setDate(fechaLimite.getDate() - 30);
            break;
          case "90dias":
            fechaLimite.setDate(fechaLimite.getDate() - 90);
            break;
          case "1año":
            fechaLimite.setFullYear(fechaLimite.getFullYear() - 1);
            break;
        }
        query = query.gte('created_at', fechaLimite.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;

      // Agrupar por cliente
      const clientesMap = new Map<string, ClienteAnalytica>();
      
      data?.forEach((transaccion) => {
        const key = `${transaccion.cliente_nombre}_${transaccion.cliente_email}`;
        const existing = clientesMap.get(key);
        
        if (existing) {
          existing.total_compras += 1;
          existing.monto_total += Number(transaccion.monto_total);
          existing.ultima_compra = transaccion.created_at > existing.ultima_compra 
            ? transaccion.created_at 
            : existing.ultima_compra;
          existing.primera_compra = transaccion.created_at < existing.primera_compra 
            ? transaccion.created_at 
            : existing.primera_compra;
        } else {
          clientesMap.set(key, {
            cliente_nombre: transaccion.cliente_nombre,
            cliente_email: transaccion.cliente_email,
            cliente_telefono: transaccion.cliente_telefono,
            total_compras: 1,
            monto_total: Number(transaccion.monto_total),
            ultima_compra: transaccion.created_at,
            primera_compra: transaccion.created_at
          });
        }
      });

      return Array.from(clientesMap.values())
        .sort((a, b) => b.monto_total - a.monto_total);
    }
  });

  // Consulta para analíticas por ubicación
  const { data: ubicacionesAnalyticas = [], isLoading: loadingUbicaciones } = useQuery({
    queryKey: ['analiticas-ubicaciones', filtroTiempo],
    queryFn: async () => {
      // Obtener clientes con sus ubicaciones
      const { data: clientes } = await supabase
        .from('clientes')
        .select('nombre, email, ciudad, estado');

      // Obtener transacciones
      let query = supabase
        .from('transacciones_ingresos')
        .select(`
          cliente_nombre,
          cliente_email,
          monto_total,
          created_at
        `)
        .not('cliente_nombre', 'is', null);

      if (filtroTiempo !== "todos") {
        const fechaLimite = new Date();
        switch (filtroTiempo) {
          case "30dias":
            fechaLimite.setDate(fechaLimite.getDate() - 30);
            break;
          case "90dias":
            fechaLimite.setDate(fechaLimite.getDate() - 90);
            break;
          case "1año":
            fechaLimite.setFullYear(fechaLimite.getFullYear() - 1);
            break;
        }
        query = query.gte('created_at', fechaLimite.toISOString());
      }

      const { data: transacciones, error } = await query;
      if (error) throw error;

      // Mapear transacciones con ubicaciones
      const ubicacionesMap = new Map<string, UbicacionAnalytica>();
      
      transacciones?.forEach((transaccion) => {
        // Buscar cliente en la base de datos de clientes
        const cliente = clientes?.find(c => 
          c.nombre === transaccion.cliente_nombre && 
          c.email === transaccion.cliente_email
        );
        
        let ubicacion = "Sin ubicación";
        if (cliente?.ciudad && cliente?.estado) {
          ubicacion = `${cliente.ciudad}, ${cliente.estado}`;
        } else if (cliente?.ciudad) {
          ubicacion = cliente.ciudad;
        } else if (cliente?.estado) {
          ubicacion = cliente.estado;
        }

        const existing = ubicacionesMap.get(ubicacion);
        if (existing) {
          existing.total_ventas += 1;
          existing.monto_promedio = (existing.monto_promedio * (existing.total_ventas - 1) + Number(transaccion.monto_total)) / existing.total_ventas;
        } else {
          ubicacionesMap.set(ubicacion, {
            ubicacion,
            total_clientes: 1,
            total_ventas: 1,
            monto_promedio: Number(transaccion.monto_total)
          });
        }
      });

      return Array.from(ubicacionesMap.values())
        .sort((a, b) => b.total_ventas - a.total_ventas);
    }
  });

  const totalClientes = clientesAnalyticas.length;
  const totalVentas = clientesAnalyticas.reduce((sum, cliente) => sum + cliente.total_compras, 0);
  const totalMonto = clientesAnalyticas.reduce((sum, cliente) => sum + cliente.monto_total, 0);
  const montoPromedio = totalClientes > 0 ? totalMonto / totalClientes : 0;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/clientes">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Clientes
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-8 w-8" />
                Analíticas de Clientes
              </h1>
              <p className="text-muted-foreground mt-2">
                Análisis detallado del historial de compras y comportamiento de clientes
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Select value={filtroTiempo} onValueChange={setFiltroTiempo}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tiempos</SelectItem>
                <SelectItem value="30dias">Últimos 30 días</SelectItem>
                <SelectItem value="90dias">Últimos 90 días</SelectItem>
                <SelectItem value="1año">Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Vista Selector */}
        <div className="flex gap-2 mt-4">
          <Button
            variant={vistaActual === "clientes" ? "default" : "outline"}
            onClick={() => setVistaActual("clientes")}
            size="sm"
          >
            <Users className="h-4 w-4 mr-2" />
            Por Cliente
          </Button>
          <Button
            variant={vistaActual === "ubicaciones" ? "default" : "outline"}
            onClick={() => setVistaActual("ubicaciones")}
            size="sm"
          >
            <MapPin className="h-4 w-4 mr-2" />
            Por Ubicación
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Métricas Generales */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Clientes</p>
                    <p className="text-2xl font-bold text-primary">{totalClientes}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ventas</p>
                    <p className="text-2xl font-bold text-green-600">{totalVentas}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-blue-600">
                      ${totalMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Promedio por Cliente</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${montoPromedio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Datos */}
          <Card>
            <CardHeader>
              <CardTitle>
                {vistaActual === "clientes" ? "Historial por Cliente" : "Análisis por Ubicación"}
              </CardTitle>
              <CardDescription>
                {vistaActual === "clientes" 
                  ? "Detalle de compras y comportamiento de cada cliente"
                  : "Distribución geográfica de ventas y clientes"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(vistaActual === "clientes" ? loadingClientes : loadingUbicaciones) ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando analíticas...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {vistaActual === "clientes" ? (
                          <>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Total Compras</TableHead>
                            <TableHead>Monto Total</TableHead>
                            <TableHead>Promedio por Compra</TableHead>
                            <TableHead>Primera Compra</TableHead>
                            <TableHead>Última Compra</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Ubicación</TableHead>
                            <TableHead>Total Clientes</TableHead>
                            <TableHead>Total Ventas</TableHead>
                            <TableHead>Monto Promedio</TableHead>
                            <TableHead>Estado</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vistaActual === "clientes" ? (
                        clientesAnalyticas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No hay datos de clientes para mostrar
                            </TableCell>
                          </TableRow>
                        ) : (
                          clientesAnalyticas.map((cliente, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="font-medium">{cliente.cliente_nombre}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {cliente.cliente_email && (
                                    <div>{cliente.cliente_email}</div>
                                  )}
                                  {cliente.cliente_telefono && (
                                    <div className="text-muted-foreground">{cliente.cliente_telefono}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{cliente.total_compras}</Badge>
                              </TableCell>
                              <TableCell className="font-medium text-green-600">
                                ${cliente.monto_total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                ${(cliente.monto_total / cliente.total_compras).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(cliente.primera_compra).toLocaleDateString('es-MX')}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(cliente.ultima_compra).toLocaleDateString('es-MX')}
                              </TableCell>
                            </TableRow>
                          ))
                        )
                      ) : (
                        ubicacionesAnalyticas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              No hay datos de ubicaciones para mostrar
                            </TableCell>
                          </TableRow>
                        ) : (
                          ubicacionesAnalyticas.map((ubicacion, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{ubicacion.ubicacion}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{ubicacion.total_clientes}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{ubicacion.total_ventas}</Badge>
                              </TableCell>
                              <TableCell className="font-medium text-blue-600">
                                ${ubicacion.monto_promedio.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={ubicacion.total_ventas > 5 ? "default" : "outline"}
                                  className={ubicacion.total_ventas > 5 ? "bg-green-100 text-green-800" : ""}
                                >
                                  {ubicacion.total_ventas > 10 ? "Alto" : ubicacion.total_ventas > 5 ? "Medio" : "Bajo"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalyticasClientes;