import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlanCuentas from "./pages/PlanCuentas";
import Inventario from "./pages/Inventario";
import EstadoResultados from "./pages/EstadoResultados";
import BalanceGeneral from "./pages/BalanceGeneral";
import Sidebar from "./components/Layout/Sidebar";
import RegistroIngresos from "./pages/registros/RegistroIngresos";
import RegistroEgresos from "./pages/registros/RegistroEgresos";
import RegistroAsientos from "./pages/registros/RegistroAsientos";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="h-screen bg-background flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/plan-cuentas" element={<PlanCuentas />} />
              <Route path="/estados-financieros/resultados" element={<EstadoResultados />} />
              <Route path="/estados-financieros/balance" element={<BalanceGeneral />} />
              <Route path="/registros/ingresos" element={<RegistroIngresos />} />
              <Route path="/registros/egresos" element={<RegistroEgresos />} />
              <Route path="/registros/asientos" element={<RegistroAsientos />} />
              <Route path="/registros/inventario" element={<Inventario />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;