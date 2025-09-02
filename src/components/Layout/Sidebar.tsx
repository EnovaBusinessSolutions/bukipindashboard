import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const Sidebar = () => {
  const mainMenuItems = [
    { name: "Dashboard", active: true },
  ];

  const accountItems = [
    { name: "Plan de Cuentas", active: false },
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
            <Button
              key={item.name}
              variant="ghost"
              className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
              }`}
            >
              {item.name}
            </Button>
          ))}
        </nav>
      </div>

      <Separator className="mx-6 bg-sidebar-border" />

      {/* Cuentas Contables Section */}
      <div className="px-3 py-4 flex-1">
        <h2 className="text-sidebar-foreground font-semibold text-sm mb-3 px-3">
          Contabilidad
        </h2>
        <nav className="space-y-1">
          {accountItems.map((item) => (
            <Button
              key={item.name}
              variant="ghost"
              className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                item.active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''
              }`}
            >
              {item.name}
            </Button>
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