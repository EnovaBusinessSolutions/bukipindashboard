// bukipin-dashboard/src/components/DepositosGarantia/BaseDatosDepositosGarantia.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Search } from "lucide-react";
import { useDepositos, type TipoDeposito } from "@/hooks/useDepositosGarantia";

const formatMXN = (v: number) =>
  v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const formatFecha = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

interface Props {
  tipo: TipoDeposito;
}

const BaseDatosDepositosGarantia = ({ tipo }: Props) => {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"activo" | "liquidado" | "todos">("todos");

  const { data: depositos = [], isLoading } = useDepositos(tipo, filtroEstado);

  const esFiltrado = busqueda.trim().length > 0;
  const depositosFiltrados = esFiltrado
    ? depositos.filter((d) =>
        d.entidad_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        d.entidad_rfc?.toLowerCase().includes(busqueda.toLowerCase())
      )
    : depositos;

  const esRecibido = tipo === "recibido";

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">
            {esRecibido ? "Directorio de deudores" : "Directorio de acreedores"}
          </CardTitle>
          <CardDescription>
            {esRecibido
              ? "Entidades que nos han dejado un depósito en garantía."
              : "Entidades a las que hemos entregado un depósito en garantía."}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro estado */}
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as "activo" | "liquidado" | "todos")}>
            <SelectTrigger className="w-36 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="liquidado">Liquidados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RFC..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        {depositosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-slate-50 py-12 text-center">
            <Database className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-muted-foreground">
              {esFiltrado ? "No se encontraron coincidencias." : "No hay entidades registradas."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl border bg-white overflow-hidden">
            {depositosFiltrados.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                    {(dep.entidad_nombre?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-900 truncate">{dep.entidad_nombre}</p>
                      <Badge
                        variant="outline"
                        className={
                          dep.estado === "activo"
                            ? "border-emerald-300 text-emerald-700 text-[10px]"
                            : "border-slate-300 text-slate-500 text-[10px]"
                        }
                      >
                        {dep.estado === "activo" ? "Activo" : "Liquidado"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dep.entidad_rfc && <span className="mr-2">{dep.entidad_rfc}</span>}
                      <span className="capitalize">{dep.entidad_tipo}</span>
                      {dep.fecha_inicio && (
                        <span className="ml-2">· Desde {formatFecha(dep.fecha_inicio)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className={`text-sm font-bold ${dep.estado === "activo" ? "text-slate-900" : "text-muted-foreground line-through"}`}>
                    {formatMXN(dep.saldo_actual)}
                  </p>
                  {dep.referencia && (
                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">{dep.referencia}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-right">
          {depositosFiltrados.length} {depositosFiltrados.length === 1 ? "registro" : "registros"}
        </p>
      </CardContent>
    </Card>
  );
};

export default BaseDatosDepositosGarantia;
