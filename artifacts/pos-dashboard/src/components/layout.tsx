import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { useSalesMode, type SalesMode } from "@/lib/sales-mode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingCart, Package, CreditCard, BarChart2,
  ArrowLeftRight, Calendar, Settings, LogOut, Menu, X, Store, ChevronDown,
  Users, ShieldCheck, ClipboardList, Building2, ShoppingBag, Monitor, Shield
} from "lucide-react";
import { useListLocations, useListPermissions } from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Full nav definition — every item has a moduleKey so permissions can unlock it for cashiers
const NAV_ITEMS = [
  { path: "/",            icon: LayoutDashboard, label: "Dashboard",      roles: ["admin", "manager"] },
  { path: "/pos",         icon: ShoppingCart,    label: "Point of Sale",  moduleKey: "pos" },
  { path: "/inventory",   icon: Package,         label: "Inventory",      roles: ["admin", "manager"], moduleKey: "inventory" },
  { path: "/transactions",icon: CreditCard,      label: "Transactions",   roles: ["admin", "manager"], moduleKey: "transactions" },
  { path: "/analytics",   icon: BarChart2,       label: "Analytics",      roles: ["admin", "manager"], moduleKey: "analytics" },
  { path: "/transfers",   icon: ArrowLeftRight,  label: "Transfers",      roles: ["admin", "manager"], moduleKey: "transfers" },
  { path: "/shifts",      icon: Calendar,        label: "Shifts",         roles: ["admin", "manager"], moduleKey: "shifts" },
  { path: "/cashiers",    icon: Users,           label: "Cashiers",       roles: ["admin", "manager"] },
  { path: "/audit",       icon: ShieldCheck,     label: "Audit",          roles: ["admin", "manager"], moduleKey: "audit" },
  { path: "/sales-logs",  icon: ClipboardList,   label: "Sales Logs",     roles: ["admin", "manager"], moduleKey: "sales-logs" },
  { path: "/permissions", icon: Shield,          label: "Permissions",    roles: ["admin"] },
  { path: "/settings",    icon: Settings,        label: "Settings",       roles: ["admin", "manager"], moduleKey: "settings" },
  { path: "/display",     icon: Monitor,         label: "Display",        roles: ["admin", "manager"], moduleKey: "display" },
];

function ModeToggle() {
  const { salesMode, setSalesMode, isRetail } = useSalesMode();
  return (
    <div className="flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5">
      <button
        onClick={() => setSalesMode("retail")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
          isRetail
            ? "bg-emerald-500 text-white"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ShoppingBag className="w-3 h-3" />
        Retail
      </button>
      <button
        onClick={() => setSalesMode("wholesale")}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
          !isRetail
            ? "bg-blue-600 text-white"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Building2 className="w-3 h-3" />
        Wholesale
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, selectedLocationId, setSelectedLocationId } = useAuth();
  const { branding } = useBranding();
  const { isWholesale } = useSalesMode();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: locations } = useListLocations();

  const isCashier = user?.role === "cashier";

  // Cashiers: fetch their own permissions to unlock extra sidebar items
  const { data: myPerms } = useListPermissions(undefined, {
    query: { enabled: isCashier, staleTime: 60_000 },
  } as any);
  const grantedModules = new Set<string>(
    isCashier ? (myPerms ?? []).filter((p: any) => p.canView).map((p: any) => p.module) : []
  );

  const selectedLocation = locations?.find(l => l.id === selectedLocationId);
  const canSwitchLocation = user?.role === "admin" || user?.role === "manager";

  function isNavVisible(item: (typeof NAV_ITEMS)[number]) {
    if (isCashier) {
      // Cashiers always see POS; see other items only if explicitly granted canView
      if (item.path === "/pos") return true;
      return item.moduleKey ? grantedModules.has(item.moduleKey) : false;
    }
    // Admin / manager: role-based (no roles = visible to all)
    if (item.roles && !item.roles.includes(user?.role ?? "")) return false;
    return true;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}
        data-mode={isWholesale ? "wholesale" : "retail"}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
          <img
            src="/fremon-logo.png"
            alt="Fremon Collection"
            className="h-12 w-auto"
            style={{ filter: "invert(1) brightness(0.95)" }}
          />
          <button className="lg:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground ml-2" onClick={() => setSidebarOpen(false)}>
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

        {/* Mode pill */}
        <div className={cn(
          "mx-3 mt-3 mb-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-bold tracking-wide",
          isWholesale
            ? "bg-blue-600/20 text-blue-300 border border-blue-600/30"
            : "bg-emerald-600/20 text-emerald-300 border border-emerald-600/30"
        )}>
          {isWholesale
            ? <><Building2 className="w-3 h-3" /> WHOLESALE MODE</>
            : <><Store className="w-3 h-3" /> RETAIL MODE</>}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            if (!isNavVisible(item)) return null;
            const { path, icon: Icon, label } = item;
            const active = location === path || (path !== "/" && location.startsWith(path));
            return (
              <Link key={path} href={path}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors",
                    active
                      ? isWholesale
                        ? "bg-blue-600 text-white"
                        : "bg-sidebar-primary text-sidebar-primary-foreground"
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
        {/* Desktop header */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-border bg-card sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm">{branding.appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
          </div>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm">{branding.appName}</span>
          </div>
          <ModeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
