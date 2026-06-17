"use client";

import { useEffect } from "react";
import { NotesProvider } from "@/contexts/NotesContext";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import { StorageEngine } from "@/lib/storage-engine";
import AuthGuard from "@/components/utility/AuthGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    StorageEngine.init();
  }, []);

  return (
    <AuthGuard> 
      <NotesProvider>
        <SidebarProvider>
          <div className="flex h-screen w-screen overflow-hidden bg-background">
            <AppSidebar />
            <SidebarInset className="flex flex-1 flex-col overflow-hidden">
              {children}
            </SidebarInset>
          </div>
        </SidebarProvider>
      </NotesProvider>
    </AuthGuard>
  );
}