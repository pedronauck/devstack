import type * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BoxesIcon, LayoutGridIcon, Settings2Icon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: "/" | "/settings";
};

const navItems: NavItem[] = [
  { title: "Overview", to: "/", icon: LayoutGridIcon },
  { title: "Settings", to: "/settings", icon: Settings2Icon },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <Sidebar collapsible="none" variant="sidebar" className="min-h-svh" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <BoxesIcon className="size-4" />
              </div>
              <div className="grid min-w-0 text-left">
                <span className="truncate font-display font-semibold">{{projectTitle}}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">Starter workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => {
                const isActive =
                  item.to != null &&
                  (item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to));

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive}
                      render={item.to ? <Link to={item.to} /> : undefined}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="mx-2 mb-2 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/20 px-3 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
            Template
          </div>
          <p className="mt-1 text-sm leading-5 text-sidebar-foreground/80">
            Replace the starter shell with your domain routes, data and workflows.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
