import { useEffect } from "react";
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
import DragDropDemo from "@/pages/DragDropDemo";

function useViewportHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewportHeight = () => {
      const viewport = window.visualViewport;
      const nextHeight = Math.round((viewport?.height ?? window.innerHeight) * 100) / 100;
      document.documentElement.style.setProperty("--app-viewport-height", `${nextHeight}px`);
    };

    updateViewportHeight();

    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      viewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/statistics" component={Statistics} />
      <ProtectedRoute path="/users" component={UserManagement} />
      <ProtectedRoute path="/demo/drag-drop" component={DragDropDemo} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useViewportHeight();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="app-shell">
            <Toaster />
            <main className="flex min-h-0 flex-1">
              <Router />
            </main>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
