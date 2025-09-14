import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
const Sidebar = () => {
  const location = useLocation();
  const [openSections, setOpenSections] = useState({
    contabilidad: false,
    registros: false,
    cobrosPagos: false,
    estadosFinancieros: false
  });
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const mainMenuItems = [{
    name: "Dashboard",
    path: "/",
    active: location.pathname === "/"
  }];
  const accountItems = [{
    name: "Plan de Cuentas",
    path: "/plan-cuentas",
    active: location.pathname === "/plan-cuentas"
  }];
  const estadosFinancierosItems = [{
    name: "Estado de Resultados",
    path: "/estados-financieros/resultados",
    active: location.pathname === "/estados-financieros/resultados"
  }, {
    name: "Balance General",
    path: "/estados-financieros/balance",
    active: location.pathname === "/estados-financieros/balance"
  }];
  const registrosItems = [{
    name: "Registro de Ingresos",
    path: "/registros/ingresos",
    active: location.pathname === "/registros/ingresos"
  }, {
    name: "Registro de Egresos",
    path: "/registros/egresos",
    active: location.pathname === "/registros/egresos"
  }, {
    name: "Registro de Asientos",
    path: "/registros/asientos",
    active: location.pathname === "/registros/asientos"
  }, {
    name: "Registro de Inventario",
    path: "/registros/inventario",
    active: location.pathname === "/registros/inventario"
  }];
  const cobrosPagosItems = [{
    name: "Cuentas por Cobrar",
    path: "/cobros-pagos/cuentas-por-cobrar",
    active: location.pathname === "/cobros-pagos/cuentas-por-cobrar"
  }, {
    name: "Cuentas por Pagar",
    path: "/cobros-pagos/cuentas-por-pagar",
    active: location.pathname === "/cobros-pagos/cuentas-por-pagar"
  }, {
    name: "Base de Datos Clientes",
    path: "/clientes",
    active: location.pathname === "/clientes"
  }];
  return <div className="bg-sidebar h-screen w-64 flex flex-col">
      {/* Logo Section */}
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">F</span>
          </div>
          <h1 className="text-xl font-bold text-sidebar-foreground">Bukipin</h1>
        </div>
      </div>

      {/* Main Menu */}
      <div className="px-3 pb-4">
        <nav className="space-y-1">
          {mainMenuItems.map(item => <Link key={item.name} to={item.path}>
              <Button variant="ghost" size="sm" className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                {item.name}
              </Button>
            </Link>)}
        </nav>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Contabilidad Section */}
      <div className="px-3 py-4">
        <Collapsible open={openSections.contabilidad} onOpenChange={() => toggleSection('contabilidad')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Contabilidad</span>
              {openSections.contabilidad ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {accountItems.map(item => <Link key={item.name} to={item.path}>
                <Button variant="ghost" size="sm" className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                  {item.name}
                </Button>
              </Link>)}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Registros Section */}
      <div className="px-3 py-4">
        <Collapsible open={openSections.registros} onOpenChange={() => toggleSection('registros')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Registros</span>
              {openSections.registros ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {registrosItems.map(item => <Link key={item.name} to={item.path}>
                <Button variant="ghost" size="sm" className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                  {item.name}
                </Button>
              </Link>)}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Cobros y Pagos Section */}
      <div className="px-3 py-4">
        <Collapsible open={openSections.cobrosPagos} onOpenChange={() => toggleSection('cobrosPagos')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Cobros y Pagos</span>
              {openSections.cobrosPagos ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {cobrosPagosItems.map(item => <Link key={item.name} to={item.path}>
                <Button variant="ghost" size="sm" className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                  {item.name}
                </Button>
              </Link>)}
          </CollapsibleContent>
        </Collapsible>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Estados Financieros Section */}
      <div className="px-3 py-4 flex-1">
        <Collapsible open={openSections.estadosFinancieros} onOpenChange={() => toggleSection('estadosFinancieros')}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="font-semibold text-sm">Estados Financieros</span>
              {openSections.estadosFinancieros ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 mt-2">
            {estadosFinancierosItems.map(item => <Link key={item.name} to={item.path}>
                <Button variant="ghost" size="sm" className={`w-full justify-start ml-4 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors duration-200 ${item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                  {item.name}
                </Button>
              </Link>)}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Bottom Section */}
      <div className="p-6 border-t border-sidebar-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-medium text-sm">U</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-sidebar-foreground">Usuario</p>
            <p className="text-xs text-sidebar-foreground opacity-70">Administrador</p>
          </div>
        </div>
      </div>
    </div>;
};
export default Sidebar;