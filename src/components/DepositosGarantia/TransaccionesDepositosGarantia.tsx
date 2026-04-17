// bukipin-dashboard/src/components/DepositosGarantia/TransaccionesDepositosGarantia.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptText, TrendingUp, TrendingDown } from "lucide-react";
import { useDepositosMovimientos, useDepositos, type TipoDeposito } from "@/hooks/useDepositosGarantia";

const formatMXN = (v: number) =>
  v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const formatFecha = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

const TIPO_MOV_CONFIG: Record<string, { label: string; color: string }> = {
  nuevo:       { label: "Nuevo",       color: "bg-blue-100 text-blue-800" },
  aumento:     { label: "Aumento",     color: "bg-emerald-100 text-emerald-800" },
  disminucion: { label: "Disminución", color: "bg-amber-100 text-amber-800" },
  devolucion:  { label: "Dev. parcial",color: "bg-orange-100 text-orange-800" },
  liquidacion: { label: "Liquidación", color: "bg-slate-100 text-slate-700" },
};

interface Props {
  tipo: TipoDeposito;
}

const TransaccionesDepositosGarantia = ({ tipo }: Props) => {
  const [filtroDeposito, setFiltroDeposito] = useState<string>("todos");

  const { data: depositosLista = [] } = useDepositos(tipo, "todos");
  const { data, isLoading } = useDepositosMovimientos(tipo);

  const movimientos = data?.movimientos ?? [];
  const totales = data?.totales ?? { entradas: 0, salidas: 0, neto: 0 };

  const movFiltrados = filtroDeposito === "todos"
    ? movimientos
    : movimientos.filter((m) => m.deposito_id === filtroDeposito);

  const entradasFiltradas = movFiltrados.filter((m) => m.monto_con_signo > 0).reduce((s, m) => s + m.monto, 0);
  const salidasFiltradas  = movFiltrados.filter((m) => m.monto_con_signo < 0).reduce((s, m) => s + m.monto, 0);
  const netoFiltrado      = entradasFiltradas - salidasFiltradas;

  // suppress unused variable warning
  void totales;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Totales */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Entradas</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">{formatMXN(entradasFiltradas)}</p>
        </div>
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Salidas</p>
          <p className="mt-1 text-lg font-bold text-rose-600">{formatMXN(salidasFiltradas)}</p>
        </div>
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Neto</p>
          <p className={`mt-1 text-lg font-bold ${netoFiltrado >= 0 ? "text-slate-900" : "text-rose-600"}`}>
            {formatMXN(netoFiltrado)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">Registros</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{movFiltrados.length}</p>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">Historial de movimientos</CardTitle>
            <CardDescription>
              Todos los depósitos, aumentos, devoluciones y liquidaciones registradas.
            </CardDescription>
          </div>
          {/* Filtro por entidad */}
          <div className="w-56 shrink-0">
            <Select value={filtroDeposito} onValueChange={setFiltroDeposito}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Filtrar por entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {depositosLista.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.entidad_nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {movFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-slate-50 py-12 text-center">
              <ReceiptText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-muted-foreground">No hay movimientos registrados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-3 text-left font-medium">Fecha</th>
                    <th className="py-3 text-left font-medium">Entidad</th>
                    <th className="py-3 text-left font-medium">Tipo</th>
                    <th className="py-3 text-right font-medium">Monto</th>
                    <th className="py-3 text-left font-medium pl-4">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movFiltrados.map((mov) => {
                    const cfg = TIPO_MOV_CONFIG[mov.tipo_movimiento] ?? { label: mov.tipo_movimiento, color: "bg-slate-100 text-slate-700" };
                    const esPositivo = mov.monto_con_signo > 0;
                    return (
                      <tr key={mov.id} className="group hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 text-muted-foreground whitespace-nowrap">{formatFecha(mov.fecha)}</td>
                        <td className="py-3 font-medium text-slate-900 max-w-[160px] truncate">{mov.entidad_nombre || "—"}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3 text-right font-semibold whitespace-nowrap">
                          <span className={`flex items-center justify-end gap-1 ${esPositivo ? "text-emerald-600" : "text-rose-600"}`}>
                            {esPositivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            {esPositivo ? "+" : "-"}{formatMXN(mov.monto)}
                          </span>
                        </td>
                        <td className="py-3 pl-4 text-muted-foreground max-w-[200px] truncate">
                          {mov.referencia || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransaccionesDepositosGarantia;
