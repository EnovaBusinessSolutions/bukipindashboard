import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlanCuentas from "./pages/PlanCuentas";
import Sidebar from "./components/Layout/Sidebar";

const queryClient = new QueryClient();

// Componentes temporales para registros
const RegistroIngresos = () => (
  <div className="h-full overflow-hidden flex flex-col">
    <div className="p-6 border-b bg-background">
      <h1 className="text-3xl font-bold text-foreground">Registro de Ingresos</h1>
      <p className="text-muted-foreground mt-2">
        Registra y gestiona todos los ingresos de la empresa
      </p>
    </div>
    <div className="flex-1 overflow-auto p-6">
      <div className="text-center py-8 text-muted-foreground">
        Formulario de registro de ingresos próximamente...
      </div>
    </div>
  </div>
);

const RegistroEgresos = () => (
  <div className="h-full overflow-hidden flex flex-col">
    <div className="p-6 border-b bg-background">
      <h1 className="text-3xl font-bold text-foreground">Registro de Egresos</h1>
      <p className="text-muted-foreground mt-2">
        Registra y gestiona todos los gastos y egresos de la empresa
      </p>
    </div>
    <div className="flex-1 overflow-auto p-6">
      <div className="text-center py-8 text-muted-foreground">
        Formulario de registro de egresos próximamente...
      </div>
    </div>
  </div>
);

const RegistroAsientos = () => (
  <div className="h-full overflow-hidden flex flex-col">
    <div className="p-6 border-b bg-background">
      <h1 className="text-3xl font-bold text-foreground">Registro de Asientos Contables</h1>
      <p className="text-muted-foreground mt-2">
        Crea y gestiona asientos contables de partida doble
      </p>
    </div>
    <div className="flex-1 overflow-auto p-6">
      <div className="text-center py-8 text-muted-foreground">
        Formulario de asientos contables próximamente...
      </div>
    </div>
  </div>
);

const RegistroInventario = () => (
  <div className="h-full overflow-hidden flex flex-col">
    <div className="p-6 border-b bg-background">
      <h1 className="text-3xl font-bold text-foreground">Registro de Inventario</h1>
      <p className="text-muted-foreground mt-2">
        Controla y gestiona el inventario de productos y materiales
      </p>
    </div>
    <div className="flex-1 overflow-auto p-6">
      <div className="text-center py-8 text-muted-foreground">
        Formulario de control de inventario próximamente...
      </div>
    </div>
  </div>
);

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
              <Route path="/registros/ingresos" element={<RegistroIngresos />} />
              <Route path="/registros/egresos" element={<RegistroEgresos />} />
              <Route path="/registros/asientos" element={<RegistroAsientos />} />
              <Route path="/registros/inventario" element={<RegistroInventario />} />
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