// bukipin-dashboard/src/pages/Balanza.tsx
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Importa tus 3 paneles nuevos
import BalanzaComprobacion from "./BalanzaComprobacion";
import BalanzaResultados from "./BalanzaResultados";
import BalanzaBalance from "./BalanzaBalance";

type TabKey = "comprobacion" | "resultados" | "balance";

const DEFAULT_TAB: TabKey = "comprobacion";

function normalizeTab(v: string | null): TabKey {
  if (v === "comprobacion" || v === "resultados" || v === "balance") return v;
  return DEFAULT_TAB;
}

export default function Balanza() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = useMemo<TabKey>(() => {
    return normalizeTab(searchParams.get("tab"));
  }, [searchParams]);

  const setTab = (next: string) => {
    const t = normalizeTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", t);
    setSearchParams(sp, { replace: true });
  };

  const subtitle = useMemo(() => {
    switch (tab) {
      case "comprobacion":
        return "Vista general (Debe/Haber) para validar que todo cuadre y detectar inconsistencias.";
      case "resultados":
        return "Ingresos, costos y gastos del período (4xxx, 5xxx, 6xxx). Ideal para utilidad y fugas.";
      case "balance":
        return "Activos, pasivos y capital al corte (1xxx, 2xxx, 3xxx). Ideal para tu posición financiera.";
      default:
        return "";
    }
  }, [tab]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Balanza</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-3xl grid-cols-3">
          <TabsTrigger value="comprobacion">Balanza de Comprobación</TabsTrigger>
          <TabsTrigger value="resultados">Balanza de Resultados</TabsTrigger>
          <TabsTrigger value="balance">Balanza de Balance</TabsTrigger>
        </TabsList>

        <TabsContent value="comprobacion" className="mt-6">
          <BalanzaComprobacion />
        </TabsContent>

        <TabsContent value="resultados" className="mt-6">
          <BalanzaResultados />
        </TabsContent>

        <TabsContent value="balance" className="mt-6">
          <BalanzaBalance />
        </TabsContent>
      </Tabs>
    </div>
  );
}
