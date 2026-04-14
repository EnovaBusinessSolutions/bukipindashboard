import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanciamientos, type DireccionFinanciamiento, type Financiamiento } from "@/hooks/useFinanciamientos";
import TransaccionesFinanciamiento from "./TransaccionesFinanciamiento";

const toNum = (v: unknown, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const money = (value: number) =>
  `$${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getMontoTotal = (f: Financiamiento) =>
  toNum(f.monto_total_vista ?? f.montoTotalVista ?? f.total_dispuesto ?? f.monto_total, 0);

const getSaldoActual = (f: Financiamiento) =>
  toNum(f.saldo_actual_vista ?? f.saldoActualVista ?? f.saldo_total_actual ?? f.saldo_actual, 0);

const getSaldoInicial = (f: Financiamiento) =>
  toNum(f.monto_original ?? f.montoOriginal ?? f.total_dispuesto ?? getMontoTotal(f), 0);

const getSubtitulo = (direccion: DireccionFinanciamiento, f: Financiamiento) => {
  if (direccion === "realizado") {
    return f.deudor_nombre || f.nombre;
  }
  return f.institucion || f.institucion_financiera || "Sin institución";
};

const TransaccionesModuloFinanciamientos = ({
  direccion,
}: {
  direccion: DireccionFinanciamiento;
}) => {
  const { financiamientos, isLoading } = useFinanciamientos(direccion);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Historial por préstamo
        </CardTitle>
        <CardDescription>
          {direccion === "realizado"
            ? "Consulta la trazabilidad completa de cada préstamo otorgado y sus asientos contables."
            : "Consulta la trazabilidad completa de cada financiamiento y sus asientos contables."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {financiamientos.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-slate-50 px-6 py-12 text-center text-muted-foreground">
            No hay registros para mostrar en esta dirección.
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {financiamientos.map((financiamiento) => {
              const montoTotal = getMontoTotal(financiamiento);
              const saldoActual = getSaldoActual(financiamiento);
              const saldoInicial = getSaldoInicial(financiamiento);
              return (
                <AccordionItem key={financiamiento.id} value={financiamiento.id}>
                  <AccordionTrigger>
                    <div className="flex w-full flex-col gap-3 pr-4 text-left lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{financiamiento.nombre}</p>
                        <p className="text-sm text-muted-foreground">{getSubtitulo(direccion, financiamiento)}</p>
                      </div>
                      <div className="grid min-w-[320px] grid-cols-3 gap-2 text-sm">
                        <div className="rounded-xl border bg-slate-50 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            {direccion === "realizado" ? "Prestado" : "Monto total"}
                          </p>
                          <p className="font-semibold">{money(montoTotal)}</p>
                        </div>
                        <div className="rounded-xl border bg-slate-50 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            {direccion === "realizado" ? "Cobrado capital" : "Amortizado"}
                          </p>
                          <p className="font-semibold">
                            {money(Math.max(0, montoTotal - toNum(financiamiento.saldo_capital_actual ?? financiamiento.saldoCapitalActual, saldoActual)))}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-slate-50 px-3 py-2">
                          <p className="text-xs text-muted-foreground">
                            {direccion === "realizado" ? "Saldo por cobrar" : "Saldo actual"}
                          </p>
                          <p className="font-semibold">{money(saldoActual)}</p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TransaccionesFinanciamiento
                      financiamientoId={financiamiento.id}
                      nombreFinanciamiento={financiamiento.nombre}
                      montoTotal={montoTotal}
                      saldoActual={saldoActual}
                      saldoInicial={saldoInicial}
                      tipoCredito={direccion === "realizado" ? "Capital de Trabajo" : (financiamiento.tipoLabel || financiamiento.tipo_label || "Crédito Simple")}
                      direccion={direccion}
                    />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default TransaccionesModuloFinanciamientos;
