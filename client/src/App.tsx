import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import ErrorBoundary from "@/components/error-boundary";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthWrapper from "@/components/AuthWrapper";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/dashboard";
import EnhancedDevices from "@/pages/EnhancedDevices";
import SimpleTopics from "@/pages/SimpleTopics";
import EnhancedMessages from "@/pages/EnhancedMessages";
import EnhancedAnalytics from "@/pages/EnhancedAnalytics";
import EnhancedSettings from "@/pages/EnhancedSettings";
import Publisher from "@/pages/publisher";
import EnhancedAdmin from "@/pages/EnhancedAdmin";
import ModernAdminDashboard from "@/pages/ModernAdminDashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/connections" component={EnhancedDevices} />
        <Route path="/topics" component={SimpleTopics} />
        <Route path="/messages" component={EnhancedMessages} />
        <Route path="/analytics" component={EnhancedAnalytics} />
        <Route path="/publisher" component={Publisher} />
        <Route path="/admin">
          <ProtectedRoute requiredRole="admin">
            <ModernAdminDashboard />
          </ProtectedRoute>
        </Route>
        <Route path="/admin-legacy">
          <ProtectedRoute requiredRole="admin">
            <EnhancedAdmin />
          </ProtectedRoute>
        </Route>
        <Route path="/settings" component={EnhancedSettings} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <AuthWrapper>
                <Router />
              </AuthWrapper>
            </AuthProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;