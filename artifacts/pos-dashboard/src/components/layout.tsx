import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingCart, Package, CreditCard, BarChart2,
  ArrowLeftRight, Calendar, Settings, LogOut, Menu, X, Store, ChevronDown,
  Users, ShieldCheck
} from "lucide-react";
import { useListLocations } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/pos", icon: ShoppingCart, label: "Point of Sale" },
  { path: "/inventory", icon: Package, label: "Inventory" },
  { path: "/transactions", icon: CreditCard, label: "Transactions" },
  { path: "/analytics", icon: BarChart2, label: "Analytics" },
  { path: "/transfers", icon: ArrowLeftRight, label: "Transfers" },
  { path: "/shifts", icon: Calendar, label: "Shifts" },
  { path: "/cashiers", icon: Users, label: "Cashiers", roles: ["admin", "manager"] },
  { path: "/audit", icon: ShieldCheck, label: "Audit", roles: ["admin", "manager"] },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, selectedLocationId, setSelectedLocationId } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: locations } = useListLocations();

  const selectedLocation = locations?.find(l => l.id === selectedLocationId);
  const canSwitchLocation = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Store className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sidebar-foreground text-sm">MirrorTech</p>
            <p className="text-xs text-sidebar-foreground/50">POS System</p>
          </div>
          <button className="ml-auto lg:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Location selector */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          {canSwitchLocation ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent text-sidebar-accent-foreground text-xs hover:bg-sidebar-accent/80 transition-colors">
                  <Store className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate flex-1 text-left">{selectedLocation?.name ?? "Select Location"}</span>
                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {locations?.map(loc => (
                  <DropdownMenuItem key={loc.id} onSelect={() => setSelectedLocationId(loc.id)}>
                    <Store className="w-3 h-3 mr-2" />
                    {loc.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              <Store className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{selectedLocation?.name ?? "No location assigned"}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ path, icon: Icon, label, roles }) => {
            if (roles && !roles.includes(user?.role ?? "")) return null;
            const active = location === path || (path !== "/" && location.startsWith(path));
            return (
              <Link key={path} href={path}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.username}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-foreground bg-transparent hover:bg-sidebar-accent"
            onClick={logout}
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">MirrorTech POS</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
