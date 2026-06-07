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
import LeadsPage from "@/pages/leads";
import SalesManagerPage from "@/pages/sales-manager";
import PermissionsPage from "@/pages/permissions";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AuthenticatedApp() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <LoginPage />;

  const isCashier = user?.role === "cashier";

  // Cashiers only ever see the POS — every URL renders POSPage
  if (isCashier) {
    return (
      <Layout>
        <Switch>
          <Route path="/pos" component={POSPage} />
          <Route component={POSPage} />
        </Switch>
      </Layout>
    );
  }

  // Admin / Manager full routing
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
        <Route path="/leads" component={LeadsPage} />
        <Route path="/sales-manager" component={SalesManagerPage} />
        <Route path="/permissions" component={PermissionsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
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
