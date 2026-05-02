import { useState } from "react";
import { useLocation } from "wouter";
import { Search, GitBranch, Github, Code, Terminal, Clock, Star } from "lucide-react";
import { useListRepos, useGetStats, useCreateRepo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [url, setUrl] = useState("");

  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: repos, isLoading: reposLoading } = useListRepos();

  const createRepo = useCreateRepo();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    if (!url.includes("github.com")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid GitHub repository URL.",
        variant: "destructive",
      });
      return;
    }

    try {
      const repo = await createRepo.mutateAsync({ data: { url } });
      setLocation(`/repo/${repo.id}`);
    } catch (err: any) {
      toast({
        title: "Error starting analysis",
        description: err.message || "Failed to submit repository.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-screen-xl py-8 sm:py-12 flex flex-col gap-10 sm:gap-14">
      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-5 max-w-3xl mx-auto pt-4 sm:pt-8 w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs sm:text-sm font-mono border border-border/60 rounded-tl-[0px] rounded-tr-[0px] rounded-br-[0px] rounded-bl-[0px]">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>v1.0.0-beta — System Online</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl tracking-tight leading-tight font-bold">
          Kill{" "}
          <span className="text-primary font-mono">Onboarding</span> Pain.
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-mono max-w-2xl leading-relaxed px-2">
          Instantly unpack, map, and understand any codebase. Paste a GitHub
          URL and get architecture diagrams, onboarding steps, and security
          insights.
        </p>

        <form
          onSubmit={handleAnalyze}
          className="flex w-full max-w-xl flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2"
        >
          <div className="relative flex-1">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="url"
              placeholder="https://github.com/owner/repo"
              className="pl-10 h-11 sm:h-12 font-mono text-sm bg-card border-border/60 focus-visible:ring-primary w-full rounded-none"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-11 sm:h-12 font-mono font-bold tracking-wider shrink-0 rounded-none"
            disabled={createRepo.isPending}
          >
            {createRepo.isPending ? "SCANNING..." : "SCAN REPO"}
          </Button>
        </form>
      </section>
      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto w-full">
        <Card className="bg-card/60 backdrop-blur border-border/60 rounded-none">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> REPOS ANALYZED
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold font-mono text-primary">
                {stats?.totalRepos ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/60 rounded-none">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" /> TOTAL ANALYSES
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold font-mono text-primary">
                {stats?.totalAnalyses ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/60 rounded-none">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5" /> TOP LANGUAGES
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            {statsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats?.languageCounts &&
                  Object.entries(stats.languageCounts)
                    .slice(0, 3)
                    .map(([lang, count]) => (
                      <Badge
                        key={lang}
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {lang} ({count})
                      </Badge>
                    ))}
                {(!stats?.languageCounts ||
                  Object.keys(stats.languageCounts).length === 0) && (
                  <span className="text-sm text-muted-foreground font-mono">
                    No data
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
      {/* Recent Repos */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-border/50 pb-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-lg sm:text-xl font-bold font-mono tracking-tight">
            Recent Scans
          </h2>
        </div>

        {reposLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : repos?.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-border/50 rounded-lg">
            <Terminal className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground font-mono text-sm">
              No repositories analyzed yet.
            </p>
            <p className="text-xs text-muted-foreground/60 font-mono mt-1">
              Paste a GitHub URL above to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {repos?.map((repo) => (
              <Card
                key={repo.id}
                className="group cursor-pointer hover:border-primary/40 transition-all duration-200 bg-card/50 hover:bg-card/80 border-border/60 rounded-none"
                onClick={() => setLocation(`/repo/${repo.id}`)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-mono font-bold truncate">
                      {repo.owner}/{repo.name}
                    </CardTitle>
                    <StatusBadge status={repo.status} />
                  </div>
                  <CardDescription className="line-clamp-2 text-xs mt-1 min-h-[2rem]">
                    {repo.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="p-4 pt-2 flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-3">
                    {repo.language && (
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        {repo.language}
                      </div>
                    )}
                    {repo.stars != null && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {repo.stars}
                      </div>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-primary text-[10px]">
                    View <Search className="w-3 h-3" />
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "done":
      return (
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px] uppercase shrink-0 rounded-none"
        >
          DONE
        </Badge>
      );
    case "analyzing":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-[10px] uppercase animate-pulse shrink-0 rounded-none"
        >
          ANALYZING
        </Badge>
      );
    case "error":
      return (
        <Badge
          variant="outline"
          className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-[10px] uppercase shrink-0 rounded-none"
        >
          ERROR
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground font-mono text-[10px] uppercase shrink-0 rounded-none"
        >
          PENDING
        </Badge>
      );
  }
}
