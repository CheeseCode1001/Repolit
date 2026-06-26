import { useEffect, useRef, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { RepoDashboard } from "@/pages/repo";
import { ProfilePage } from "@/pages/profile";
import { SharedAnalysisPage } from "@/pages/shared";
import NotFound from "@/pages/not-found";
import { SplashScreen } from "@/components/splash-screen";
import { FundPage } from "@/pages/fund";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAnonId, clearAnonId } from "@/lib/anon-session";
import { useToast } from "@/hooks/use-toast";
import { requestNotificationPermission, showBrowserNotification } from "@/lib/notifications";

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

function buildClerkAppearance(isDark: boolean) {
  const logoImageUrl = `${window.location.origin}${basePath}/logo-icon.png`;

  if (isDark) {
    return {
      theme: shadcn,
      cssLayerName: "clerk",
      options: {
        logoPlacement: "inside" as const,
        logoLinkUrl: basePath || "/",
        logoImageUrl,
        socialButtonsPlacement: "top" as const,
        socialButtonsVariant: "blockButton" as const,
      },
      variables: {
        colorPrimary: "#760BF7",
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
        footerActionLink: "text-[#760BF7] font-mono",
        footerActionText: "text-[hsl(240,5%,64.9%)]",
        dividerText: "text-[hsl(240,5%,64.9%)] font-mono text-xs",
        dividerLine: "bg-[hsl(240,3.7%,15.9%)]",
        formButtonPrimary: "bg-[#760BF7] text-white font-mono font-bold uppercase tracking-wider hover:bg-[#8b1cff]",
        identityPreviewEditButton: "text-[#760BF7]",
        formFieldSuccessText: "text-[#760BF7]",
        alertText: "text-[hsl(0,0%,98%)]",
        alert: "bg-[hsl(0,62.8%,10%)] border-[hsl(0,62.8%,20%)]",
        logoBox: "flex justify-center py-2",
        logoImage: "h-12 w-12 rounded-xl",
        footerAction: "bg-transparent",
        otpCodeFieldInput: "bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono",
        formFieldRow: "",
        main: "",
      },
    };
  }

  return {
    theme: shadcn,
    cssLayerName: "clerk",
    options: {
      logoPlacement: "inside" as const,
      logoLinkUrl: basePath || "/",
      logoImageUrl,
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
    },
    variables: {
      colorPrimary: "#760BF7",
      colorForeground: "hsl(240, 10%, 10%)",
      colorMutedForeground: "hsl(240, 5%, 45%)",
      colorDanger: "hsl(0, 62.8%, 40%)",
      colorBackground: "hsl(0, 0%, 98%)",
      colorInput: "hsl(0, 0%, 94%)",
      colorInputForeground: "hsl(240, 10%, 10%)",
      colorNeutral: "hsl(240, 5%, 55%)",
      fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
      borderRadius: "0px",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: "bg-white border border-gray-200 w-[440px] max-w-full overflow-hidden shadow-lg",
      card: "!shadow-none !border-0 !bg-transparent",
      footer: "!shadow-none !border-0 !bg-transparent !bg-gray-50",
      headerTitle: "text-gray-900 font-bold font-mono",
      headerSubtitle: "text-gray-500",
      socialButtonsBlockButtonText: "text-gray-900 font-mono",
      socialButtonsBlockButton: "border border-gray-200 bg-white hover:bg-gray-50",
      formFieldLabel: "text-gray-700 font-mono text-xs uppercase tracking-wider",
      formFieldInput: "bg-white border-gray-300 text-gray-900 font-mono",
      footerActionLink: "text-[#760BF7] font-mono",
      footerActionText: "text-gray-500",
      dividerText: "text-gray-400 font-mono text-xs",
      dividerLine: "bg-gray-200",
      formButtonPrimary: "bg-[#760BF7] text-white font-mono font-bold uppercase tracking-wider hover:bg-[#8b1cff]",
      identityPreviewEditButton: "text-[#760BF7]",
      formFieldSuccessText: "text-[#760BF7]",
      alertText: "text-gray-900",
      alert: "bg-red-50 border-red-200",
      logoBox: "flex justify-center py-2",
      logoImage: "h-12 w-12 rounded-xl",
      footerAction: "bg-gray-50",
      otpCodeFieldInput: "bg-white border-gray-300 text-gray-900 font-mono",
      formFieldRow: "",
      main: "",
    },
  };
}


function ClerkAuthTokenRegistrar() {
  const { getToken } = useAuth();

  useEffect(() => {
    const anonId = getAnonId();

    const wrappedGetter = async () => {
      const delays = [200, 500, 1000, 2000];
      let token = await getToken();
      for (const delay of delays) {
        if (token) break;
        await new Promise((r) => setTimeout(r, delay));
        token = await getToken();
      }
      return token;
    };

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

    setAuthTokenGetter(wrappedGetter);
    return () => {
      setAuthTokenGetter(null);
      window.fetch = originalFetch;
    };
  }, [getToken]);

  return null;
}

const FUNNY_WELCOME_MESSAGES = [
  "You're in! Ready to roast some repos? 🔥",
  "Welcome! Your codebase will never be the same 😈",
  "You joined! Let the AI do the hard work 🤖",
  "Access granted. No repo can hide from us now 🔍",
  "You're officially a Repolit power user 💜",
  "Login successful. Coffee not included ☕",
];

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
        if (userId && prevUserIdRef.current === null) {
          clearAnonId();
          const msg = FUNNY_WELCOME_MESSAGES[Math.floor(Math.random() * FUNNY_WELCOME_MESSAGES.length)];
          const firstName = user?.firstName ?? user?.username ?? null;
          const greeting = firstName ? `Hey ${firstName}! 👋` : "Welcome back! 👋";
          setTimeout(() => {
            toast({ title: greeting, description: msg });
            requestNotificationPermission().then(() => {
              showBrowserNotification("Repolit 💜", `${greeting} ${msg}`);
            });
          }, 800);
        }
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, toast]);

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
        <Route path="/profile" component={ProfilePage} />
        <Route path="/shared/:token" component={SharedAnalysisPage} />
        <Route path="/fund" component={FundPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const clerkAppearance = buildClerkAppearance(isDark);

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
            subtitle: "Sign in to your Repolit account",
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
        <ClerkAuthTokenRegistrar />
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
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="repolit-theme">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
