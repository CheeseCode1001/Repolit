import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "next-themes";
import { Sun, Moon, User, Github, Coffee } from "lucide-react";
import {
  useGetProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import Avatar from "boring-avatars";

const logoIcon = "/logo-icon.png";
const AVATAR_COLORS = ["#9402b1","#ffd500","#ff9f1a","#f07c19","#e24d28"];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-7 w-7 flex items-center justify-center border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border transition-colors"
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function ProfileButton() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: profile } = useGetProfile({
    query: { enabled: !!user, queryKey: getGetProfileQueryKey() },
  });

  const seed = profile?.avatarConfig ?? user?.userId ?? "default";

  return (
    <button
      onClick={() => setLocation("/profile")}
      aria-label="Profile"
      className="h-7 w-7 flex items-center justify-center border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border transition-colors overflow-hidden"
      title="Your Profile"
    >
      {user ? (
        <Avatar size={28} name={seed} variant="beam" colors={AVATAR_COLORS} />
      ) : (
        <User className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function UserNav() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center gap-2">
      <ProfileButton />
      <span className="text-xs font-mono text-muted-foreground hidden sm:inline truncate max-w-[120px]">
        {user?.username ?? ""}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="font-mono text-[10px] uppercase tracking-wider h-7 px-2 border-border/60"
        onClick={() => {
          logout().then(() => setLocation("/"));
        }}
      >
        Sign Out
      </Button>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();

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
              alt="Repolit"
              className="h-8 w-8 object-contain"
              style={{ borderRadius: "22%" }}
            />
            <span className="font-sans font-bold tracking-tight text-primary text-[28px]">
              repolit
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <a
              href="https://github.com/CheeseCode1001/Repograph"
              target="_blank"
              rel="noreferrer"
              className="h-7 w-7 flex items-center justify-center border border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border transition-colors rounded-md"
              title="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>
             <a
              href="https://github.com/sponsors/CheeseCode1001"
              target="_blank"
              rel="noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="px-1 sm:px-3 text-xs border-border/60 text-muted-foreground hover:bg-primary hover:text-white sm:gap-1 items-center"
            >
              <Coffee className="w-4 h-4" />
              <span className="hidden sm:inline-flex">Buy me a coffee</span>
            </Button>
            </a>
            <ThemeToggle />
            {!isSignedIn && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-mono text-[10px] uppercase tracking-wider px-2 sm:px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setLocation("/sign-up")}
                >
                  Sign Up
                </Button>
                <Button
                  size="sm"
                  className="font-mono text-[10px] uppercase tracking-wider px-2 sm:px-3"
                  onClick={() => setLocation("/sign-in")}
                >
                  Login
                </Button>
              </>
            )}
            {isSignedIn && <UserNav />}
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
      <footer className="border-t border-border/50 py-5">
        <div className="container max-w-screen-xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-center text-xs text-muted-foreground font-mono">
            Repolit — AI-powered repo analysis
          </p>
          <p className="text-xs text-muted-foreground font-mono opacity-50">
            Powered by Gemini
          </p>
        </div>
      </footer>
    </div>
  );
}
