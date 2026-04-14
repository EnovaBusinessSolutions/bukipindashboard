import React, { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock3, Landmark, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFinanciamientos,
  type DireccionFinanciamiento,
} from "@/hooks/useFinanciamientos";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const money = (value: number) =>
  `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const KpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = "",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  valueClassName?: string;
}) => (
  <Card className="rounded-2xl shadow-sm">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
      <div className="space-y-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`text-2xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
        <CardDescription>{subtitle}</CardDescription>
      </div>
      <div className="rounded-2xl border bg-slate-50 p-3">
        <Icon className="h-5 w-5 text-slate-600" />
      </div>
    </CardHeader>
  </Card>
);

const ResumenFinanciamientos = ({
  direccion = "recibido",
}: {
  direccion?: DireccionFinanciamiento;
}) => {
  const { resumen, transacciones, financiamientos, isLoading } = useFinanciamientos(direccion);

  const esRealizado = direccion === "realizado";

  const ultimosMovimientos = useMemo(() => {
    return [...transacciones]
      .sort((a, b) => {
        const ad = new Date(a.fecha || a.createdAt || a.created_at || 0).getTime();
        const bd = new Date(b.fecha || b.createdAt || b.created_at || 0).getTime();
        return bd - ad;
      })
      .slice(0, 8);
  }, [transacciones]);

  const interesesCargados = useMemo(() => {
    return transacciones.reduce((sum, tx) => {
      const tipo = String(tx.tipo || tx.tipo_transaccion || "").toLowerCase();
      if (tipo !== "cargo_intereses" && tipo !== "cargo_interes") return sum;
      return sum + toNum(tx.monto_intereses ?? tx.montoIntereses ?? tx.monto, 0);
    }, 0);
  }, [transacciones]);

  const interesesCobrados = useMemo(() => {
    return financiamientos.reduce(
      (sum, fin) => sum + toNum(fin.total_intereses_pagados ?? fin.totalInteresesPagados, 0),
      0
    );
  }, [financiamientos]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title={esRealizado ? "Total prestado" : "Total dispuesto"}
          value={money(toNum(resumen.total_dispuesto, 0))}
          subtitle={esRealizado ? "Capital entregado acumulado" : "Capital utilizado acumulado"}
          icon={Landmark}
        />
        <KpiCard
          title={esRealizado ? "Total cobrado capital" : "Total amortizado"}
          value={money(toNum(resumen.total_amortizado_capital, 0))}
          subtitle={esRealizado ? "Cobranza aplicada a capital" : "Pagos aplicados a capital"}
          icon={TrendingUp}
          valueClassName="text-emerald-600"
        />
        <KpiCard
          title="Intereses cargados"
          value={money(interesesCargados)}
          subtitle={esRealizado ? "Intereses generados sobre préstamos" : "Intereses cargados al financiamiento"}
          icon={Clock3}
          valueClassName="text-amber-600"
        />
        <KpiCard
          title={esRealizado ? "Intereses cobrados" : "Cargos acumulados"}
          value={money(
            esRealizado
              ? interesesCobrados
              : transacciones.reduce(
                  (sum, tx) =>
                    sum +
                    (["cargo_intereses", "cargo_interes", "cargo_moratorio", "cargo_comision"].includes(
                      String(tx.tipo || tx.tipo_transaccion).toLowerCase()
                    )
                      ? toNum(tx.monto, 0)
                      : 0),
                  0
                )
          )}
          subtitle={esRealizado ? "Intereses reconocidos en movimientos" : "Intereses, moratorios y comisiones"}
          icon={TrendingDown}
          valueClassName="text-rose-600"
        />
        <KpiCard
          title={esRealizado ? "Saldo total por cobrar" : "Saldo total actual"}
          value={money(toNum(resumen.saldo_total_actual, 0))}
          subtitle="Saldo vigente del portafolio"
          icon={Wallet}
        />
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">Últimos movimientos</CardTitle>
          <CardDescription>
            {esRealizado
              ? "Actividad reciente del portafolio de préstamos otorgados."
              : "Actividad reciente del portafolio de financiamientos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ultimosMovimientos.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-slate-50 px-6 py-12 text-center text-muted-foreground">
              No hay movimientos recientes.
            </div>
          ) : (
            ultimosMovimientos.map((tx) => (
              <div
                key={tx.id || tx._id}
                className="flex flex-col gap-3 rounded-2xl border bg-white p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <Badge variant="outline">{String(tx.tipo || tx.tipo_transaccion || "movimiento")}</Badge>
                  <div className="text-sm text-slate-900">{tx.descripcion || "Sin descripción"}</div>
                  <div className="text-xs text-muted-foreground">
                    {tx.fecha ? format(new Date(tx.fecha), "dd/MM/yyyy", { locale: es }) : "-"}
                  </div>
                </div>
                <div className="text-lg font-semibold text-slate-900">{money(toNum(tx.monto, 0))}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResumenFinanciamientos;
