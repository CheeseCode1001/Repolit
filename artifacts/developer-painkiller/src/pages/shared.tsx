import { useParams, useLocation } from "wouter";
import { useGetSharedAnalysis, getGetSharedAnalysisQueryKey } from "@workspace/api-client-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, GitBranch, Code, Star, Activity, Map, BookOpen, ShieldAlert, Compass, ExternalLink, FileCode, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchitectureViewer } from "@/components/architecture-viewer";
import { CommitHistory } from "@/components/commit-history";

type StartHereFile = { file: string; title: string; why: string; insight: string };

export function SharedAnalysisPage() {
  const params = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const token = params.token ?? "";

  const { data, isLoading, error } = useGetSharedAnalysis(token, {
    query: { enabled: !!token, queryKey: getGetSharedAnalysisQueryKey(token) },
  });

  if (isLoading) {
    return (
      <div className="container max-w-screen-xl py-6 sm:py-8 space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-screen-xl py-20 text-center flex flex-col items-center">
        <ShieldAlert className="w-10 h-10 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold font-mono">Shared Analysis Not Found</h1>
        <p className="text-muted-foreground font-mono mt-2 mb-6 text-sm">
          This link may be invalid or the analysis was deleted.
        </p>
        <Button onClick={() => setLocation("/")} variant="outline" className="font-mono text-xs">
          <ArrowLeft className="w-3 h-3 mr-2" /> RETURN HOME
        </Button>
      </div>
    );
  }

  const { repo, analysis } = data;

  let securityFindings: { severity: string; title: string; description: string; recommendation: string }[] = [];
  if (analysis?.security) {
    try { securityFindings = JSON.parse(analysis.security); } catch { /* ignore */ }
  }

  let startHereFiles: StartHereFile[] = [];
  if (analysis?.startHere) {
    try { const p = JSON.parse(analysis.startHere); startHereFiles = Array.isArray(p) ? p : []; } catch { /* ignore */ }
  }

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-500/10 text-red-400 border-red-500/30";
      case "high": return "bg-orange-500/10 text-orange-400 border-orange-500/30";
      case "medium": return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
      case "low": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      default: return "bg-muted text-muted-foreground border-border/40";
    }
  };

  return (
    <div className="container max-w-screen-xl py-6 sm:py-8 space-y-5 sm:space-y-6">
      <Button
        variant="link"
        className="pl-0 w-fit text-muted-foreground hover:text-foreground font-mono text-xs"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="w-3 h-3 mr-1" /> BACK TO HOME
      </Button>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30 bg-primary/5">
            SHARED
          </Badge>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono tracking-tight">
            {repo.owner}/<span className="text-primary">{repo.name}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
          {repo.language && <span className="flex items-center gap-1"><Code className="w-3.5 h-3.5" />{repo.language}</span>}
          {repo.stars != null && <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" />{repo.stars} stars</span>}
          <a href={repo.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary">
            <GitBranch className="w-3.5 h-3.5" />github.com <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {repo.description && <p className="text-muted-foreground text-sm font-sans">{repo.description}</p>}
      </div>

      {analysis ? (
        <Tabs defaultValue="overview" className="w-full">
          <div className="w-full">
            <TabsList className="flex w-full justify-stretch h-auto p-1 bg-card border border-border/60 rounded-none gap-0.5 font-mono">
              <TabsTrigger value="overview" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none">
                <Activity className="w-3 h-3 sm:mr-1.5 shrink-0" /><span className="hidden sm:inline">OVERVIEW</span>
              </TabsTrigger>
              <TabsTrigger value="start-here" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none">
                <Compass className="w-3 h-3 sm:mr-1.5 shrink-0" /><span className="hidden sm:inline">START HERE</span>
              </TabsTrigger>
              <TabsTrigger value="architecture" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none">
                <Map className="w-3 h-3 sm:mr-1.5 shrink-0" /><span className="hidden sm:inline">ARCHITECTURE</span>
              </TabsTrigger>
              <TabsTrigger value="onboarding" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none">
                <BookOpen className="w-3 h-3 sm:mr-1.5 shrink-0" /><span className="hidden sm:inline">ONBOARDING</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none">
                <ShieldAlert className="w-3 h-3 sm:mr-1.5 shrink-0" /><span className="hidden sm:inline">SECURITY</span>
              </TabsTrigger>
              <TabsTrigger value="commits" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none">
                <GitBranch className="w-3 h-3 sm:mr-1.5 shrink-0" /><span className="hidden sm:inline">COMMITS</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-3 sm:mt-4">
            <TabsContent value="overview" className="m-0">
              <Card className="border-border/60">
                <CardContent className="p-4 sm:p-6 md:p-8 prose dark:prose-invert prose-sm sm:prose-base max-w-none font-sans">
                  {analysis.summary ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.summary}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground font-mono text-sm">No summary available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="start-here" className="m-0">
              {startHereFiles.length > 0 ? (
                <div className="space-y-3">
                  {startHereFiles.map((item, i) => (
                    <Card key={i} className="border-border/60 bg-card/50">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold font-mono text-primary">{i + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm font-mono font-bold">{item.title}</CardTitle>
                            <div className="flex items-center gap-1.5 text-xs font-mono text-primary/70 mt-0.5">
                              <FileCode className="w-3 h-3" /><span className="truncate">{item.file}</span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pl-[calc(1rem+1.5rem+0.75rem)] space-y-3">
                        <p className="text-sm text-muted-foreground">{item.why}</p>
                        {item.insight && (
                          <div className="border-l-2 border-primary/40 pl-3 bg-primary/5 py-2 pr-3">
                            <p className="text-xs font-mono text-primary/80">
                              <span className="text-primary font-bold">Senior insight: </span>{item.insight}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-border/50 py-12">
                  <CardContent className="flex flex-col items-center text-center p-0">
                    <Compass className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
                    <p className="text-muted-foreground font-mono text-sm">No Start Here guide available.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="architecture" className="m-0">
              {analysis.architecture ? (
                <ArchitectureViewer chart={analysis.architecture} />
              ) : (
                <Card className="border-dashed border-border/50 py-20">
                  <CardContent className="flex flex-col items-center text-center p-0">
                    <Map className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
                    <p className="text-muted-foreground font-mono text-sm">No architecture diagram available.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="onboarding" className="m-0">
              <Card className="border-border/60">
                <CardContent className="p-4 sm:p-6 md:p-8 prose dark:prose-invert prose-sm sm:prose-base max-w-none font-sans">
                  {analysis.onboarding ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.onboarding}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground font-mono text-sm">No onboarding guide available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="m-0">
              {securityFindings.length > 0 ? (
                <div className="space-y-3">
                  {securityFindings.map((f, i) => (
                    <Card key={i} className="border-border/60 bg-card/50">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`font-mono text-[10px] uppercase ${severityColor(f.severity)}`}>
                            {f.severity}
                          </Badge>
                          <CardTitle className="text-sm font-mono">{f.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 space-y-2">
                        <p className="text-sm text-muted-foreground">{f.description}</p>
                        <div className="border-l-2 border-primary/30 pl-3 py-1">
                          <p className="text-xs font-mono text-primary/80"><span className="font-bold">Fix: </span>{f.recommendation}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-border/50 py-12">
                  <CardContent className="flex flex-col items-center text-center p-0">
                    <ShieldAlert className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
                    <p className="text-muted-foreground font-mono text-sm">No security findings available.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="commits" className="m-0">
              <CommitHistory commitHistoryJson={analysis.commitHistory} />
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <Card className="border-dashed border-border/50 py-12">
          <CardContent className="flex flex-col items-center text-center p-0">
            <MessageSquare className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
            <p className="text-muted-foreground font-mono text-sm">Analysis not yet available.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
