import { useEffect } from "react";
import { Link } from "wouter";
import { Terminal, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity shrink-0"
          >
            <Terminal className="h-5 w-5" />
            <span className="font-mono font-bold tracking-tight text-sm sm:text-base">
              dev_painkiller
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-muted-foreground hover:text-foreground h-9 w-9"
            >
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-w-0">{children}</main>

      <footer className="border-t border-border/50 py-5">
        <div className="container max-w-screen-xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-center text-xs text-muted-foreground font-mono">
            Built for developers. Open source analysis.
          </p>
          <p className="text-xs text-muted-foreground font-mono opacity-50">
            Powered by Gemini 2.5 Flash
          </p>
        </div>
      </footer>
    </div>
  );
}
