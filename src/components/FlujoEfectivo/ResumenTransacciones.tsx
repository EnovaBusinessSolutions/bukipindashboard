import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";

interface ResumenTransaccionesProps {
  startDate: Date;
  endDate: Date;
  filtroMetodoPago: "consolidado" | "efectivo" | "bancos";
}

type MovimientoDetalle = {
  fecha: string | null; // YYYY-MM-DD (ISO)
  tipo: "efectivo" | "bancos"; // método
  monto: number; // con signo (positivo = entra, negativo = sale)
  memo?: string;
  asientoId?: string;
  categoria?: "operativo" | "inversion" | "financiamiento";
};

type ApiResponse = {
  ok?: boolean;
  data?: {
    movimientosDetalle?: MovimientoDetalle[];
  };
  movimientosDetalle?: MovimientoDetalle[]; // compat por si viene plano
};

function toISODateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateSafe(dateStr?: string | null) {
  if (!dateStr) return "-";
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return "-";
  return format(dt, "dd MMM yyyy", { locale: es });
}

function categoriaLabel(cat: string) {
  if (cat === "operativo") return "Operativo";
  if (cat === "inversion") return "Inversión";
  if (cat === "financiamiento") return "Financiamiento";
  return "Otros";
}

function categoriaBadgeVariant(cat: string): any {
  if (cat === "operativo") return "default";
  if (cat === "inversion") return "secondary";
  if (cat === "financiamiento") return "outline";
  return "outline";
}

function metodoBadge(tipo: "efectivo" | "bancos") {
  return tipo === "efectivo" ? "efectivo" : "bancos";
}

function groupByCategoria(list: MovimientoDetalle[]) {
  const g: Record<string, MovimientoDetalle[]> = {
    operativo: [],
    inversion: [],
    financiamiento: [],
    otros: [],
  };

  for (const m of list) {
    const cat = m?.categoria;
    if (cat === "operativo") g.operativo.push(m);
    else if (cat === "inversion") g.inversion.push(m);
    else if (cat === "financiamiento") g.financiamiento.push(m);
    else g.otros.push(m);
  }

  return g;
}

const ResumenTransacciones = ({ startDate, endDate, filtroMetodoPago }: ResumenTransaccionesProps) => {
  const start = toISODateOnly(startDate);
  const end = toISODateOnly(endDate);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["resumen-transacciones", start, end, filtroMetodoPago],
    queryFn: async () => {
      // ✅ Usamos el endpoint existente (analitico) y leemos movimientosDetalle
      const json: any = await apiFetch(`/api/flujo-efectivo/analitico?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      const root = (json?.data ?? json) as any;

      const movimientosDetalle: MovimientoDetalle[] = Array.isArray(root?.movimientosDetalle)
        ? root.movimientosDetalle
        : Array.isArray(root?.data?.movimientosDetalle)
        ? root.data.movimientosDetalle
        : [];

      // Filtro por método (tipo)
      const filtered = movimientosDetalle.filter((m) => {
        if (!m) return false;
        if (filtroMetodoPago === "consolidado") return true;
        return m.tipo === filtroMetodoPago;
      });

      // Orden por fecha desc (y si no hay fecha, al final)
      filtered.sort((a, b) => {
        const ta = a?.fecha ? new Date(a.fecha).getTime() : 0;
        const tb = b?.fecha ? new Date(b.fecha).getTime() : 0;
        return tb - ta;
      });

      return filtered;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    const msg =
      (error as any)?.message ||
      "No se pudieron cargar las transacciones. Revisa tu sesión o el backend.";
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    );
  }

  const movimientos = Array.isArray(data) ? data : [];
  const grouped = groupByCategoria(movimientos);

  const renderTable = (title: string, rows: MovimientoDetalle[], catKey: string) => {
    const total = rows.reduce((acc, r) => acc + (Number(r?.monto) || 0), 0);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              {title}
              <Badge variant={categoriaBadgeVariant(catKey)} className="text-xs">
                {rows.length}
              </Badge>
            </span>
            <span className={`text-sm font-semibold ${total >= 0 ? "text-finance-success" : "text-destructive"}`}>
              {formatCurrency(total)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Monto (Neto)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay movimientos en esta sección
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((m, idx) => {
                  const cat = m?.categoria ?? "otros";
                  const monto = Number(m?.monto) || 0;
                  const memo = String(m?.memo ?? "").trim() || "(Sin descripción)";
                  return (
                    <TableRow key={`${m?.asientoId ?? "x"}-${idx}`}>
                      <TableCell>{formatDateSafe(m?.fecha)}</TableCell>
                      <TableCell className="max-w-[520px] truncate">{memo}</TableCell>
                      <TableCell>
                        <Badge variant={categoriaBadgeVariant(cat)}>{categoriaLabel(cat)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{metodoBadge(m?.tipo)}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${monto >= 0 ? "text-finance-success" : "text-destructive"}`}>
                        {monto >= 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(monto))}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {renderTable("Operativo", grouped.operativo, "operativo")}
      {renderTable("Inversión", grouped.inversion, "inversion")}
      {renderTable("Financiamiento", grouped.financiamiento, "financiamiento")}

      {/* Sección opcional */}
      {grouped.otros.length > 0 && renderTable("Otros", grouped.otros, "otros")}
    </div>
  );
};

export default ResumenTransacciones;
