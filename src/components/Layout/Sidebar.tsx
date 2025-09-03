import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link, useLocation } from "react-router-dom";

const Sidebar = () => {
  const location = useLocation();
  
  const mainMenuItems = [
    { name: "Dashboard", path: "/", active: location.pathname === "/" },
  ];

  const accountItems = [
    { name: "Plan de Cuentas", path: "/plan-cuentas", active: location.pathname === "/plan-cuentas" },
  ];

  const registrosItems = [
    { name: "Registro de Ingresos", path: "/registros/ingresos", active: location.pathname === "/registros/ingresos" },
    { name: "Registro de Egresos", path: "/registros/egresos", active: location.pathname === "/registros/egresos" },
    { name: "Registro de Asientos", path: "/registros/asientos", active: location.pathname === "/registros/asientos" },
  ];

  return (
    <div className="bg-sidebar h-screen w-64 flex flex-col">
      {/* Logo Section */}
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">F</span>
          </div>
          <h1 className="text-xl font-bold text-sidebar-foreground">Finapp</h1>
        </div>
      </div>

      {/* Main Menu */}
      <div className="px-3 pb-4">
        <nav className="space-y-1">
          {mainMenuItems.map((item) => (
            <Link key={item.name} to={item.path}>
              <Button
                variant="ghost"
                className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                  item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
                }`}
              >
                {item.name}
              </Button>
            </Link>
          ))}
        </nav>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Cuentas Contables Section */}
      <div className="px-3 py-4">
        <h2 className="text-sidebar-foreground font-semibold text-sm mb-3 px-3">
          Contabilidad
        </h2>
        <nav className="space-y-1">
          {accountItems.map((item) => (
            <Link key={item.name} to={item.path}>
              <Button
                variant="ghost"
                className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                  item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
                }`}
              >
                {item.name}
              </Button>
            </Link>
          ))}
        </nav>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Registros Section */}
      <div className="px-3 py-4 flex-1">
        <h2 className="text-sidebar-foreground font-semibold text-sm mb-3 px-3">
          Registros
        </h2>
        <nav className="space-y-1">
          {registrosItems.map((item) => (
            <Link key={item.name} to={item.path}>
              <Button
                variant="ghost"
                className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                  item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
                }`}
              >
                {item.name}
              </Button>
            </Link>
          ))}
        </nav>
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
    </div>
  );
};

export default Sidebar;