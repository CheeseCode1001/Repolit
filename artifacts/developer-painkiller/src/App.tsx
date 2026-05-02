import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { RepoDashboard } from "@/pages/repo";
import NotFound from "@/pages/not-found";
import { SplashScreen } from "@/components/splash-screen";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "hsl(142.1, 70.6%, 45.3%)",
    colorForeground: "hsl(0, 0%, 98%)",
    colorMutedForeground: "hsl(240, 5%, 64.9%)",
    colorDanger: "hsl(0, 62.8%, 30.6%)",
    colorBackground: "hsl(240, 5.9%, 5%)",
    colorInput: "hsl(240, 3.7%, 12%)",
    colorInputForeground: "hsl(0, 0%, 98%)",
    colorNeutral: "hsl(240, 3.7%, 35%)",
    fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0px",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(240,5.9%,7%)] border border-[hsl(240,3.7%,15.9%)] w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent",
    footer: "!shadow-none !border-0 !bg-transparent",
    headerTitle: "text-[hsl(0,0%,98%)] font-bold font-mono",
    headerSubtitle: "text-[hsl(240,5%,64.9%)]",
    socialButtonsBlockButtonText: "text-[hsl(0,0%,98%)] font-mono",
    socialButtonsBlockButton: "border border-[hsl(240,3.7%,20%)] bg-[hsl(240,3.7%,10%)]",
    formFieldLabel: "text-[hsl(0,0%,98%)] font-mono text-xs uppercase tracking-wider",
    formFieldInput: "bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono",
    footerActionLink: "text-[hsl(142.1,70.6%,45.3%)] font-mono",
    footerActionText: "text-[hsl(240,5%,64.9%)]",
    dividerText: "text-[hsl(240,5%,64.9%)] font-mono text-xs",
    dividerLine: "bg-[hsl(240,3.7%,15.9%)]",
    formButtonPrimary: "bg-[hsl(142.1,70.6%,45.3%)] text-black font-mono font-bold uppercase tracking-wider",
    identityPreviewEditButton: "text-[hsl(142.1,70.6%,45.3%)]",
    formFieldSuccessText: "text-[hsl(142.1,70.6%,45.3%)]",
    alertText: "text-[hsl(0,0%,98%)]",
    alert: "bg-[hsl(0,62.8%,10%)] border-[hsl(0,62.8%,20%)]",
    logoBox: "flex justify-center py-2",
    logoImage: "h-12",
    footerAction: "bg-transparent",
    otpCodeFieldInput: "bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/repo/:id" component={RepoDashboard} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Repograph account",
          },
        },
        signUp: {
          start: {
            title: "Create account",
            subtitle: "Start analyzing repositories today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </>
  );
}

export default App;
