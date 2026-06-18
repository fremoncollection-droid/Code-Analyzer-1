import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BrandingProvider } from "@/lib/branding";
import { SalesModeProvider } from "@/lib/sales-mode";
import Layout from "@/components/layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import POSPage from "@/pages/pos";
import InventoryPage from "@/pages/inventory";
import TransactionsPage from "@/pages/transactions";
import AnalyticsPage from "@/pages/analytics";
import TransfersPage from "@/pages/transfers";
import ShiftsPage from "@/pages/shifts";
import SettingsPage from "@/pages/settings";
import CashiersPage from "@/pages/cashiers";
import AuditPage from "@/pages/audit";
import SalesLogsPage from "@/pages/sales-logs";
import DisplayPage from "@/pages/display";
import PermissionsPage from "@/pages/permissions";
import NotFound from "@/pages/not-found";
import { useListPermissions } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// Map permission moduleKey → page component
const MODULE_ROUTES: Record<string, { path: string; component: React.ComponentType }> = {
  inventory:    { path: "/inventory",    component: InventoryPage },
  transactions: { path: "/transactions", component: TransactionsPage },
  analytics:    { path: "/analytics",   component: AnalyticsPage },
  transfers:    { path: "/transfers",   component: TransfersPage },
  shifts:       { path: "/shifts",      component: ShiftsPage },
  "sales-logs": { path: "/sales-logs",  component: SalesLogsPage },
  settings:     { path: "/settings",    component: SettingsPage },
  display:      { path: "/display",     component: DisplayPage },
  audit:        { path: "/audit",       component: AuditPage },
};

// Cashier routing: always has POS + any modules explicitly granted canView
function CashierApp() {
  const { data: myPerms } = useListPermissions(undefined, {
    query: { staleTime: 60_000 },
  } as any);

  const grantedModules = (myPerms ?? [])
    .filter((p: any) => p.canView)
    .map((p: any) => p.module as string);

  return (
    <Layout>
      <Switch>
        <Route path="/pos" component={POSPage} />
        {grantedModules.map(mod => {
          const r = MODULE_ROUTES[mod];
          if (!r) return null;
          return <Route key={mod} path={r.path} component={r.component} />;
        })}
        {/* Catch-all: always land on POS */}
        <Route component={POSPage} />
      </Switch>
    </Layout>
  );
}

// Admin / Manager: full routing
function StaffApp() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/pos" component={POSPage} />
        <Route path="/inventory" component={InventoryPage} />
        <Route path="/transactions" component={TransactionsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/transfers" component={TransfersPage} />
        <Route path="/shifts" component={ShiftsPage} />
        <Route path="/cashiers" component={CashiersPage} />
        <Route path="/audit" component={AuditPage} />
        <Route path="/sales-logs" component={SalesLogsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/display" component={DisplayPage} />
        <Route path="/permissions" component={PermissionsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  if (user?.role === "cashier") return <CashierApp />;
  return <StaffApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandingProvider>
          <AuthProvider>
            <SalesModeProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AuthenticatedApp />
              </WouterRouter>
              <Toaster />
            </SalesModeProvider>
          </AuthProvider>
        </BrandingProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
