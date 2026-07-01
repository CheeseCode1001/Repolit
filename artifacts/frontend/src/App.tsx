import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { RepoDashboard } from "@/pages/repo";
import { ProfilePage } from "@/pages/profile";
import { SharedAnalysisPage } from "@/pages/shared";
import NotFound from "@/pages/not-found";
import { SplashScreen } from "@/components/splash-screen";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAnonId } from "@/lib/anon-session";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SignInPage } from "@/pages/sign-in";
import { SignUpPage } from "@/pages/sign-up";


const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function AuthTokenRegistrar() {
  useEffect(() => {
    const anonId = getAnonId();

    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.startsWith("/api")) {
        const headers = new Headers((init as RequestInit)?.headers);
        if (!headers.has("x-anon-id")) {
          headers.set("x-anon-id", anonId);
        }
        return originalFetch(input, { ...(init as RequestInit), headers });
      }
      return originalFetch(input, init as RequestInit);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

function Router() {
  const { user } = useAuth();
  
  // Custom router logic could be here if needed for protected routes
  // Currently, the backend protects what's needed and frontend handles gracefully

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/repo/:id" component={RepoDashboard} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/shared/:token" component={SharedAnalysisPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Providers() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <AuthTokenRegistrar />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="repolit-theme">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <WouterRouter base={basePath}>
        <Providers />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
