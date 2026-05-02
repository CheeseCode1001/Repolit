import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Terminal, Github, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <Link href="/" className="flex items-center gap-2 mr-6 text-primary hover:opacity-80 transition-opacity">
            <Terminal className="h-5 w-5" />
            <span className="font-mono font-bold tracking-tight">dev_painkiller</span>
          </Link>
          
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Optional global search or command palette trigger could go here */}
            </div>
            <nav className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild className="hidden md:flex text-muted-foreground hover:text-foreground">
                <a href="https://github.com" target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" />
                  <span className="sr-only">GitHub</span>
                </a>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-14 md:flex-row max-w-screen-2xl">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left font-mono">
            Built for developers. Open source analysis.
          </p>
        </div>
      </footer>
    </div>
  );
}
