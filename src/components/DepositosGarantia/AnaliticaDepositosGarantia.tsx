// bukipin-dashboard/src/components/DepositosGarantia/AnaliticaDepositosGarantia.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useDepositosAnalitica, type TipoDeposito } from "@/hooks/useDepositosGarantia";

const formatMXN = (v: number) =>
  v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const COLORS = ["#0f172a", "#1e3a5f", "#1d4ed8", "#0284c7", "#0891b2", "#0d9488", "#059669", "#16a34a", "#65a30d", "#ca8a04"];

interface AnaliticaItem {
  id: string;
  entidad_nombre: string;
  entidad_tipo: string;
  saldo: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: AnaliticaItem = payload[0]?.payload;
  return (
    <div className="rounded-xl border bg-white px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-900 mb-1">{d.entidad_nombre}</p>
      <p className="text-muted-foreground">{d.entidad_tipo === "empresa" ? "Empresa" : "Persona física"}</p>
      <p className="mt-2 font-bold text-slate-900">{formatMXN(d.saldo)}</p>
    </div>
  );
};

interface Props {
  tipo: TipoDeposito;
}

const PAGE_SIZE = 25;

const AnaliticaDepositosGarantia = ({ tipo }: Props) => {
  const [showDialog, setShowDialog] = useState(false);
  const [page, setPage] = useState(0);

  const { data: items = [], isLoading } = useDepositosAnalitica(tipo);

  const top10 = items.slice(0, 10);
  const chartData = top10.map((d: AnaliticaItem) => ({
    ...d,
    name: d.entidad_nombre.length > 22 ? d.entidad_nombre.slice(0, 20) + "…" : d.entidad_nombre,
  }));

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paginaItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const esRecibido = tipo === "recibido";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-semibold">
              {esRecibido ? "Deudores por garantía recibida" : "Acreedores por garantía otorgada"}
            </CardTitle>
            <CardDescription>
              Saldo vigente por entidad, ordenado de mayor a menor. Mostrando top {Math.min(10, items.length)}.
            </CardDescription>
          </div>
          {items.length > 10 && (
            <Button variant="outline" size="sm" onClick={() => { setShowDialog(true); setPage(0); }}>
              Ver todos ({items.length})
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-slate-50 py-16 text-center">
              <BarChart3 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-muted-foreground">
                No hay depósitos activos para mostrar.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, top10.length * 52)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fontSize: 12, fill: "#334155" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="saldo" radius={[0, 6, 6, 0]} maxBarSize={36}>
                  {chartData.map((_: AnaliticaItem, idx: number) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Ver todos paginado de 25 en 25 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {esRecibido ? "Todos los deudores" : "Todos los acreedores"}
            </DialogTitle>
            <DialogDescription>
              {items.length} entidades con depósito en garantía activo, ordenadas por saldo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {paginaItems.map((item: AnaliticaItem, idx: number) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-sm font-bold text-muted-foreground text-center shrink-0">
                    {page * PAGE_SIZE + idx + 1}
                  </span>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                    {(item.entidad_nombre?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.entidad_nombre}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.entidad_tipo}</p>
                  </div>
                </div>
                <p className="shrink-0 font-semibold text-slate-900">{formatMXN(item.saldo)}</p>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnaliticaDepositosGarantia;
