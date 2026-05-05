import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Show, useUser, useClerk } from "@clerk/react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
const logoIcon = "/logo-icon.png";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-7 w-7 flex items-center justify-center border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border transition-colors"
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}

function UserNav() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-muted-foreground hidden sm:inline truncate max-w-[120px]">
        {user?.primaryEmailAddress?.emailAddress ?? user?.username ?? ""}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="font-mono text-[10px] uppercase tracking-wider h-7 px-2 border-border/60"
        onClick={() => signOut(() => setLocation("/"))}
      >
        Sign Out
      </Button>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-xl items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={logoIcon}
              alt="Repograph"
              className="h-8 w-8 object-contain"
            />
            <span className="font-mono font-bold tracking-tight sm:text-base text-primary text-[20px]">
              repograph
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Show when="signed-out">
              <Button
                variant="ghost"
                size="sm"
                className="font-mono text-[10px] uppercase tracking-wider h-7 px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setLocation("/sign-up")}
              >
                Sign Up
              </Button>
              <Button
                size="sm"
                className="font-mono text-[10px] uppercase tracking-wider h-7 px-3"
                onClick={() => setLocation("/sign-in")}
              >
                Sign In
              </Button>
            </Show>
            <Show when="signed-in">
              <UserNav />
            </Show>
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
      <footer className="border-t border-border/50 py-5">
        <div className="container max-w-screen-xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-center text-xs text-muted-foreground font-mono">
            repograph — AI-powered repo analysis
          </p>
          <p className="text-xs text-muted-foreground font-mono opacity-50">
            Powered by Gemini 2.5 Flash
          </p>
        </div>
      </footer>
    </div>
  );
}
