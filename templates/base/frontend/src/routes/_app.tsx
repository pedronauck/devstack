import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <SidebarProvider defaultOpen sidebarWidth="14rem">
      <AppSidebar />
      <SidebarInset className="my-4 mr-4 ml-2 overflow-hidden rounded-xl border bg-card shadow-sm">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
