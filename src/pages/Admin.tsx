import React from "react";
import Navbar from "@/components/Layout/Navbar";
import Sidebar from "@/components/Layout/Sidebar";
import ResetearDatos from "@/components/Admin/ResetearDatos";

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8 ml-64">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Administración</h1>
            <p className="text-muted-foreground">
              Herramientas administrativas para gestionar el sistema
            </p>
          </div>
          
          <ResetearDatos />
        </main>
      </div>
    </div>
  );
};

export default Admin;
