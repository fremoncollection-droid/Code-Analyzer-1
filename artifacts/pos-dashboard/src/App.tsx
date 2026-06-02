import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AuthenticatedApp() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SalesModeProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthenticatedApp />
            </WouterRouter>
            <Toaster />
          </SalesModeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
