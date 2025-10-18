import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PlanCuentas from "./pages/PlanCuentas";
import Inventario from "./pages/Inventario";
import EstadoResultados from "./pages/EstadoResultados";
import BalanceGeneral from "./pages/BalanceGeneral";
import FlujoEfectivo from "./pages/FlujoEfectivo";
import Balanza from "./pages/Balanza";
import Sidebar from "./components/Layout/Sidebar";
import RegistroIngresos from "./pages/registros/RegistroIngresos";
import RegistroEgresos from "./pages/registros/RegistroEgresos";
import RegistroInversiones from "./pages/registros/RegistroInversiones";
import RegistroFinanciamientos from "./pages/registros/RegistroFinanciamientos";
import RegistroCapital from "./pages/registros/RegistroCapital";
import CuentasPorCobrar from "./pages/cobros-pagos/CuentasPorCobrar";
import CuentasPorPagar from "./pages/cobros-pagos/CuentasPorPagar";
import Clientes from "./pages/Clientes";
import AnalyticasClientes from "./pages/clientes/AnalyticasClientes";
import Proveedores from "./pages/Proveedores";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="h-screen bg-background flex overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 overflow-auto">
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/plan-cuentas" element={<PlanCuentas />} />
                        <Route path="/estados-financieros/resultados" element={<EstadoResultados />} />
                        <Route path="/estados-financieros/balance" element={<BalanceGeneral />} />
                        <Route path="/estados-financieros/flujo-efectivo" element={<FlujoEfectivo />} />
                        <Route path="/estados-financieros/balanza" element={<Balanza />} />
                        <Route path="/registros/ingresos" element={<RegistroIngresos />} />
                        <Route path="/registros/egresos" element={<RegistroEgresos />} />
                        <Route path="/registros/inversiones" element={<RegistroInversiones />} />
                        <Route path="/registros/inventario" element={<Inventario />} />
                        <Route path="/registros/financiamientos" element={<RegistroFinanciamientos />} />
                        <Route path="/registros/capital" element={<RegistroCapital />} />
                        <Route path="/cobros-pagos/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
                        <Route path="/cobros-pagos/cuentas-por-pagar" element={<CuentasPorPagar />} />
                        <Route path="/clientes" element={<Clientes />} />
                        <Route path="/clientes/analiticas" element={<AnalyticasClientes />} />
                        <Route path="/proveedores" element={<Proveedores />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;