import React, { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  DollarSign,
  TrendingDown,
  Wallet,
  Landmark,
  ArrowLeft,
  ClipboardList,
  BarChart3,
  BookOpen,
} from "lucide-react";

import RegistroFinanciamientoForm from "@/components/Financiamientos/RegistroFinanciamientoForm";
import RegistroDisposicionForm from "@/components/Financiamientos/RegistroDisposicionForm";
import RegistroAmortizacionForm from "@/components/Financiamientos/RegistroAmortizacionForm";
import RegistroCargoInteresForm from "@/components/Financiamientos/RegistroCargoInteresForm";
import ResumenFinanciamientos from "@/components/Financiamientos/ResumenFinanciamientos";
import DetalleCreditosFinanciamientos from "@/components/Financiamientos/DetalleCreditosFinanciamientos";
import AnalyticaFinanciamientos from "@/components/Financiamientos/AnalyticaFinanciamientos";
import CatalogoAcreedores from "@/components/Financiamientos/CatalogoAcreedores";

type TipoRegistro = "" | "financiamiento" | "disposicion" | "amortizacion" | "interes";
type TabValue = "registro" | "detalle" | "resumen" | "analitica" | "catalogo";

type RegistroOption = {
  key: Exclude<TipoRegistro, "">;
  title: string;
  description: string;
  icon: React.ElementType;
  iconWrapClass: string;
  iconClass: string;
};

const registroOptions: RegistroOption[] = [
  {
    key: "financiamiento",
    title: "Nuevo Financiamiento",
    description: "Registra un nuevo crédito simple, revolvente o tarjeta de crédito.",
    icon: CreditCard,
    iconWrapClass: "bg-primary/10",
    iconClass: "text-primary",
  },
  {
    key: "disposicion",
    title: "Disposición",
    description: "Registra una disposición sobre una línea de crédito revolvente.",
    icon: Wallet,
    iconWrapClass: "bg-cyan-500/10",
    iconClass: "text-cyan-600",
  },
  {
    key: "amortizacion",
    title: "Amortización",
    description: "Registra pagos a capital, mensualidades o pagos mixtos.",
    icon: DollarSign,
    iconWrapClass: "bg-emerald-500/10",
    iconClass: "text-emerald-600",
  },
  {
    key: "interes",
    title: "Cargo por Intereses",
    description: "Registra intereses ordinarios, moratorios o comisiones cobradas.",
    icon: TrendingDown,
    iconWrapClass: "bg-rose-500/10",
    iconClass: "text-rose-600",
  },
];

const getRegistroTitle = (tipoRegistro: TipoRegistro) => {
  if (tipoRegistro === "financiamiento") return "Registrar Nuevo Financiamiento";
  if (tipoRegistro === "disposicion") return "Registrar Disposición";
  if (tipoRegistro === "amortizacion") return "Registrar Amortización";
  if (tipoRegistro === "interes") return "Registrar Cargo por Intereses";
  return "Registro de Financiamientos";
};

const getRegistroDescription = (tipoRegistro: TipoRegistro) => {
  if (tipoRegistro === "financiamiento") {
    return "Captura la información principal del crédito y sus condiciones financieras.";
  }
  if (tipoRegistro === "disposicion") {
    return "Registra el uso de una línea revolvente y actualiza el saldo dispuesto.";
  }
  if (tipoRegistro === "amortizacion") {
    return "Registra pagos aplicados a capital, intereses, moratorios o comisiones.";
  }
  if (tipoRegistro === "interes") {
    return "Registra cargos adicionales que incrementan el saldo del financiamiento.";
  }
  return "Selecciona el tipo de operación que deseas registrar.";
};

const RegistroFinanciamientos = () => {
  const [tabActiva, setTabActiva] = useState<TabValue>("registro");
  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistro>("");

  const handleTabChange = (value: string) => {
    const nextTab = value as TabValue;
    setTabActiva(nextTab);

    if (nextTab !== "registro") {
      setTipoRegistro("");
    }
  };

  const volverASeleccion = () => setTipoRegistro("");

  const registroHeader = useMemo(
    () => ({
      title: getRegistroTitle(tipoRegistro),
      description: getRegistroDescription(tipoRegistro),
    }),
    [tipoRegistro]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/40">
      <div className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                <Landmark className="h-3.5 w-3.5" />
                Módulo financiero
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Registro de Financiamientos
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Gestiona créditos, líneas revolventes, tarjetas corporativas y movimientos
                  asociados desde un solo panel.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Registro</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Altas y movimientos</p>
              </div>
              <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Detalle</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Vista por crédito</p>
              </div>
              <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Resumen</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Transacciones</p>
              </div>
              <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
                <p className="text-xs text-muted-foreground">Analítica</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Indicadores clave</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-7xl px-6 py-6">
          <Tabs value={tabActiva} onValueChange={handleTabChange} className="w-full">
            <div className="rounded-2xl border bg-white p-2 shadow-sm">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent md:grid-cols-5">
                <TabsTrigger
                  value="registro"
                  className="flex items-center gap-2 rounded-xl px-3 py-3 data-[state=active]:shadow-sm"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Registro</span>
                </TabsTrigger>

                <TabsTrigger
                  value="detalle"
                  className="flex items-center gap-2 rounded-xl px-3 py-3 data-[state=active]:shadow-sm"
                >
                  <ClipboardList className="h-4 w-4" />
                  <span>Detalle</span>
                </TabsTrigger>

                <TabsTrigger
                  value="resumen"
                  className="flex items-center gap-2 rounded-xl px-3 py-3 data-[state=active]:shadow-sm"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Resumen</span>
                </TabsTrigger>

                <TabsTrigger
                  value="analitica"
                  className="flex items-center gap-2 rounded-xl px-3 py-3 data-[state=active]:shadow-sm"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analítica</span>
                </TabsTrigger>

                <TabsTrigger
                  value="catalogo"
                  className="flex items-center gap-2 rounded-xl px-3 py-3 data-[state=active]:shadow-sm"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Catálogo</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="registro" className="mt-6 space-y-6">
              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-2xl font-semibold tracking-tight">
                    {registroHeader.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {registroHeader.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {!tipoRegistro ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {registroOptions.map((option) => {
                        const Icon = option.icon;

                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setTipoRegistro(option.key)}
                            className="group rounded-2xl border bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${option.iconWrapClass}`}
                              >
                                <Icon className={`h-7 w-7 ${option.iconClass}`} />
                              </div>

                              <div className="min-w-0 space-y-2">
                                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                                  {option.title}
                                </h3>
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {option.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {registroHeader.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Completa el formulario para registrar la operación.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={volverASeleccion}
                          className="gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Volver a selección
                        </Button>
                      </div>

                      {tipoRegistro === "financiamiento" && <RegistroFinanciamientoForm />}
                      {tipoRegistro === "disposicion" && <RegistroDisposicionForm />}
                      {tipoRegistro === "amortizacion" && <RegistroAmortizacionForm />}
                      {tipoRegistro === "interes" && <RegistroCargoInteresForm />}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detalle" className="mt-6">
              <DetalleCreditosFinanciamientos />
            </TabsContent>

            <TabsContent value="resumen" className="mt-6">
              <ResumenFinanciamientos />
            </TabsContent>

            <TabsContent value="analitica" className="mt-6">
              <AnalyticaFinanciamientos />
            </TabsContent>

            <TabsContent value="catalogo" className="mt-6">
              <CatalogoAcreedores />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default RegistroFinanciamientos;