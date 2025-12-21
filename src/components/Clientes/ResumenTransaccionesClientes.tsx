import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TransaccionCliente {
  id: string;
  cliente_nombre: string | null;
  descripcion: string;
  monto_total: number;
  monto_descuento: number | null;
  monto_neto: number;
  metodo_pago: string;
  estado: string;
  created_at: string; // ISO
}

// Soporta payload Mongo (camelCase) y legacy (snake_case)
function normalizeTransaccionCliente(raw: any): TransaccionCliente {
  return {
    id: String(raw.id ?? raw._id ?? ""),
    cliente_nombre: raw.cliente_nombre ?? raw.clienteNombre ?? null,
    descripcion: String(raw.descripcion ?? raw.concepto ?? ""),
    monto_total: Number(raw.monto_total ?? raw.montoTotal ?? raw.total ?? 0),
    monto_descuento: raw.monto_descuento ?? raw.montoDescuento ?? null,
    monto_neto: Number(raw.monto_neto ?? raw.montoNeto ?? raw.neto ?? 0),
    metodo_pago: String(raw.metodo_pago ?? raw.metodoPago ?? raw.metodo ?? "N/A"),
    estado: String(raw.estado ?? "activo"),
    created_at: String(raw.created_at ?? raw.createdAt ?? raw.fecha ?? new Date().toISOString()),
  };
}

export default function ResumenTransaccionesClientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [periodoFiltro, setPeriodoFiltro] = useState("todos");
  const [clienteFiltro, setClienteFiltro] = useState("todos");

  
  const { data: transacciones = [], isLoading, isError, error } = useQuery({
    queryKey: ["transacciones-clientes"],
    queryFn: async () => {
      // Equivalente a:
      // .not("cliente_nombre", "is", null).eq("estado","activo").order("created_at",{ascending:false})
      const res = await apiFetch<any[]>(
        "/api/transacciones/ingresos?estado=activo&cliente_nombre_not_null=1&sort=created_at:desc"
      );

      const items = (res as any)?.data ?? res;
      return Array.isArray(items) ? items.map(normalizeTransaccionCliente) : [];
    },
  });

  // Lista única de clientes (memo)
  const clientesUnicos = useMemo(() => {
    return Array.from(new Set(transacciones.map((t) => t.cliente_nombre).filter(Boolean))).sort() as string[];
  }, [transacciones]);

  // Filtrar transacciones (memo)
  const transaccionesFiltradas = useMemo(() => {
    return transacciones.filter((transaccion) => {
      // Filtro de búsqueda
      const matchSearch =
        searchTerm === "" ||
        transaccion.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaccion.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro de cliente
      const matchCliente = clienteFiltro === "todos" || transaccion.cliente_nombre === clienteFiltro;

      // Filtro de período
      let matchPeriodo = true;
      if (periodoFiltro !== "todos") {
        const fechaTransaccion = new Date(transaccion.created_at);
        const hoy = new Date();

        if (periodoFiltro === "hoy") {
          matchPeriodo = fechaTransaccion.toDateString() === hoy.toDateString();
        } else if (periodoFiltro === "mes") {
          matchPeriodo =
            fechaTransaccion.getMonth() === hoy.getMonth() &&
            fechaTransaccion.getFullYear() === hoy.getFullYear();
        } else if (periodoFiltro === "año") {
          matchPeriodo = fechaTransaccion.getFullYear() === hoy.getFullYear();
        }
      }

      return matchSearch && matchCliente && matchPeriodo;
    });
  }, [transacciones, searchTerm, clienteFiltro, periodoFiltro]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      activo: "default",
      cancelado: "destructive",
    };
    return <Badge variant={variants[estado] || "secondary"}>{estado}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transacciones de Clientes</CardTitle>
        <CardDescription>Resumen de todas las transacciones de ingresos asociadas a clientes</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por cliente o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {clientesUnicos.map((cliente) => (
                <SelectItem key={cliente} value={cliente}>
                  {cliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="mes">Este mes</SelectItem>
              <SelectItem value="año">Este año</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla de transacciones */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando transacciones...</div>
        ) : isError ? (
          <div className="text-center py-8 text-muted-foreground">
            No se pudieron cargar las transacciones.
            <div className="text-xs opacity-70 mt-2">{(error as any)?.message ?? "Error desconocido"}</div>
          </div>
        ) : transaccionesFiltradas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No se encontraron transacciones</div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Descuento</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead>Método Pago</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaccionesFiltradas.map((transaccion) => (
                  <TableRow key={transaccion.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(transaccion.created_at), "dd MMM yyyy", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{transaccion.cliente_nombre || "Sin nombre"}</TableCell>
                    <TableCell className="max-w-xs truncate">{transaccion.descripcion}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(transaccion.monto_total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {transaccion.monto_descuento ? formatCurrency(transaccion.monto_descuento) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(transaccion.monto_neto)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaccion.metodo_pago}</Badge>
                    </TableCell>
                    <TableCell>{getEstadoBadge(transaccion.estado)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Resumen */}
        {transaccionesFiltradas.length > 0 && (
          <div className="mt-6 flex justify-end gap-8 text-sm">
            <div>
              <span className="text-muted-foreground">Total transacciones: </span>
              <span className="font-semibold">{transaccionesFiltradas.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total neto: </span>
              <span className="font-semibold">
                {formatCurrency(transaccionesFiltradas.reduce((sum, t) => sum + t.monto_neto, 0))}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
