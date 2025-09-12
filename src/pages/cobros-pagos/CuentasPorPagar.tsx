import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, DollarSign, Building, AlertCircle } from "lucide-react";

const CuentasPorPagar = () => {
  const [searchTerm, setSearchTerm] = useState("");

  // Datos de ejemplo - posteriormente se conectará con Supabase
  const cuentasPorPagar = [
    {
      id: "1",
      proveedor_nombre: "Proveedor ABC",
      descripcion: "Compra de materiales",
      monto_total: 500000,
      monto_pagado: 200000,
      monto_pendiente: 300000,
      fecha_vencimiento: "2024-02-15",
    },
    {
      id: "2",
      proveedor_nombre: "Servicios XYZ",
      descripcion: "Servicios profesionales",
      monto_total: 800000,
      monto_pagado: 0,
      monto_pendiente: 800000,
      fecha_vencimiento: "2024-02-20",
    },
  ];

  const filteredCuentas = cuentasPorPagar.filter(
    (cuenta) =>
      cuenta.proveedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cuenta.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPorPagar = filteredCuentas.reduce((sum, cuenta) => sum + cuenta.monto_pendiente, 0);
  const vencidas = filteredCuentas.filter(cuenta => 
    new Date(cuenta.fecha_vencimiento) < new Date()
  ).length;
  const porVencer = filteredCuentas.filter(cuenta => 
    new Date(cuenta.fecha_vencimiento) >= new Date()
  ).length;

  const getEstadoBadge = (fechaVencimiento: string, montoPendiente: number) => {
    if (montoPendiente === 0) {
      return <Badge variant="secondary">Pagado</Badge>;
    }
    
    const fechaVence = new Date(fechaVencimiento);
    const hoy = new Date();
    
    if (fechaVence < hoy) {
      return <Badge variant="destructive">Vencida</Badge>;
    } else {
      return <Badge variant="default">Por vencer</Badge>;
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cuentas por Pagar</h1>
            <p className="text-muted-foreground">
              Gestiona y da seguimiento a las cuentas pendientes de pago
            </p>
          </div>
        </div>

        {/* Métricas Resumen */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total por Pagar</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalPorPagar.toLocaleString('es-CO')}
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
              <Building className="h-4 w-4 text-muted-foreground" />
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
                  placeholder="Buscar por proveedor o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Próximamente */}
        <Card>
          <CardHeader>
            <CardTitle>Listado de Cuentas por Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Funcionalidad en desarrollo</h3>
              <p className="text-muted-foreground">
                El módulo de cuentas por pagar estará disponible próximamente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CuentasPorPagar;