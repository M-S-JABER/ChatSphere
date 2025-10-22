import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Statistics from "@/pages/Statistics";
import UserManagement from "@/pages/UserManagement";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import Webhooks from "@/pages/Webhooks";
import WebhookEvents from "@/pages/Admin/WebhookEvents";
import DataEditor from "@/pages/Admin/DataEditor";
import WebhookDiagnostics from "@/pages/WebhookDiagnostics";
import ApiPlayground from "@/pages/Admin/ApiPlayground";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/statistics" component={Statistics} />
        <ProtectedRoute path="/webhooks" component={Webhooks} />
    <ProtectedRoute path="/admin/webhooks" component={WebhookEvents} />
    <ProtectedRoute path="/admin/data-editor" component={DataEditor} />
    <ProtectedRoute path="/admin/api-playground" component={ApiPlayground} />
      <ProtectedRoute path="/users" component={UserManagement} />
      <ProtectedRoute path="/diagnostics" component={WebhookDiagnostics} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
