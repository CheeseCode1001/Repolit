import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  useGetRepo, 
  getGetRepoQueryKey,
  useGetRepoAnalysis, 
  getGetRepoAnalysisQueryKey,
  useDeleteRepo
} from "@workspace/api-client-react";
import { 
  Terminal, 
  Code, 
  ShieldAlert, 
  Map, 
  BookOpen, 
  ArrowLeft, 
  Trash2,
  RefreshCw,
  GitBranch,
  Star,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MermaidDiagram } from "@/components/mermaid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RepoDashboard() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [logs, setLogs] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: repo, isLoading: repoLoading } = useGetRepo(id, { 
    query: { enabled: !!id, queryKey: getGetRepoQueryKey(id) } 
  });

  const { data: analysis, isLoading: analysisLoading } = useGetRepoAnalysis(id, { 
    query: { 
      enabled: !!id && repo?.status === "done", 
      queryKey: getGetRepoAnalysisQueryKey(id) 
    } 
  });

  const deleteRepo = useDeleteRepo();

  const handleDelete = async () => {
    try {
      await deleteRepo.mutateAsync({ id });
      toast({ title: "Repository deleted" });
      setLocation("/");
    } catch (err: any) {
      toast({ 
        title: "Failed to delete repository", 
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const startAnalysis = async () => {
    if (!id || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setLogs(["[SYSTEM] Initializing analysis sequence..."]);
    
    // Optimistically update repo status
    queryClient.setQueryData(getGetRepoQueryKey(id), (old: any) => 
      old ? { ...old, status: "analyzing" } : old
    );

    try {
      const response = await fetch(`/api/repos/${id}/analyze`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error("Failed to start analysis");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Keep the last partial chunk in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.step) {
                if (data.step !== "done" && data.step !== "error") {
                  setLogs(prev => [...prev, `[PROCESS] ${data.step}`]);
                }
              }
              
              if (data.step === "error") {
                setLogs(prev => [...prev, `[ERROR] ${data.error}`]);
                toast({
                  title: "Analysis failed",
                  description: data.error,
                  variant: "destructive"
                });
                // Invalidate to get true status
                queryClient.invalidateQueries({ queryKey: getGetRepoQueryKey(id) });
              }
              
              if (data.step === "done") {
                setLogs(prev => [...prev, `[SYSTEM] Analysis complete.`]);
                queryClient.invalidateQueries({ queryKey: getGetRepoQueryKey(id) });
                queryClient.invalidateQueries({ queryKey: getGetRepoAnalysisQueryKey(id) });
              }
            } catch (e) {
              console.error("Error parsing SSE data", e, line);
            }
          }
        }
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `[FATAL] Connection lost: ${err.message}`]);
      queryClient.invalidateQueries({ queryKey: getGetRepoQueryKey(id) });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-start analysis if pending
  useEffect(() => {
    if (repo?.status === "pending" && !isAnalyzing) {
      startAnalysis();
    }
  }, [repo?.status]);


  if (repoLoading) {
    return (
      <div className="container max-w-screen-xl py-8 space-y-8">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="container max-w-screen-xl py-24 text-center flex flex-col items-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold font-mono">Repository Not Found</h1>
        <p className="text-muted-foreground font-mono mt-2 mb-6">The requested repository does not exist or was deleted.</p>
        <Button onClick={() => setLocation("/")} variant="outline" className="font-mono">
          <ArrowLeft className="w-4 h-4 mr-2" /> RETURN HOME
        </Button>
      </div>
    );
  }

  const isWorking = repo.status === "pending" || repo.status === "analyzing" || isAnalyzing;
  
  let securityFindings: string[] = [];
  if (analysis?.security) {
    try {
      securityFindings = JSON.parse(analysis.security);
    } catch(e) {}
  }

  return (
    <div className="container max-w-screen-xl py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <Button variant="link" className="pl-0 text-muted-foreground hover:text-foreground font-mono text-xs mb-2" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-3 h-3 mr-1" /> BACK TO DASHBOARD
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-mono tracking-tight">
              {repo.owner}/<span className="text-primary">{repo.name}</span>
            </h1>
            <StatusBadge status={repo.status} isAnalyzing={isAnalyzing} />
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground font-mono">
            {repo.language && (
              <div className="flex items-center gap-1.5">
                <Code className="w-4 h-4" /> {repo.language}
              </div>
            )}
            {repo.stars != null && (
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4" /> {repo.stars} stars
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-4 h-4" /> <a href={repo.url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline underline-offset-4">github.com</a>
            </div>
          </div>
          {repo.description && (
            <p className="mt-4 text-muted-foreground max-w-2xl font-sans text-sm">
              {repo.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {repo.status === "error" && !isAnalyzing && (
            <Button onClick={startAnalysis} variant="outline" className="font-mono text-xs">
              <RefreshCw className="w-3 h-3 mr-2" /> RETRY ANALYSIS
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="font-mono text-xs text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/50">
                <Trash2 className="w-3 h-3 mr-2" /> DELETE
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-mono">Delete Repository Data?</AlertDialogTitle>
                <AlertDialogDescription className="font-mono">
                  This will permanently remove the analysis data for {repo.owner}/{repo.name}.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-mono">CANCEL</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="font-mono bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  CONFIRM DELETE
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {isWorking ? (
        <Card className="bg-card border-border shadow-md mt-8">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4" /> ANALYSIS TERMINAL
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] w-full bg-black/50 font-mono text-sm p-4 text-green-400/90">
              {logs.length === 0 ? (
                <div className="opacity-50 animate-pulse">Waiting for connection...</div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className={log.includes("[ERROR]") || log.includes("[FATAL]") ? "text-red-400" : log.includes("[SYSTEM]") ? "text-blue-400" : ""}>
                      <span className="text-muted-foreground mr-2">{new Date().toISOString().split('T')[1].slice(0,-1)}</span>
                      {log}
                    </div>
                  ))}
                  <div className="animate-pulse mt-2">_</div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ) : repo.status === "error" ? (
        <Card className="border-destructive/30 bg-destructive/5 mt-8">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
            <h3 className="text-xl font-bold font-mono text-destructive mb-2">Analysis Failed</h3>
            <p className="text-muted-foreground font-mono mb-6 max-w-md">
              There was an error while attempting to analyze this repository. It may be too large, inaccessible, or the AI service timed out.
            </p>
            <Button onClick={startAnalysis} variant="outline" className="font-mono">
              <RefreshCw className="w-4 h-4 mr-2" /> TRY AGAIN
            </Button>
          </CardContent>
        </Card>
      ) : analysisLoading ? (
        <div className="space-y-4 mt-8">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : analysis ? (
        <Tabs defaultValue="overview" className="w-full mt-8">
          <TabsList className="w-full justify-start h-auto p-1 bg-card border border-border rounded-md gap-1 font-mono">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs py-2 px-4 rounded-sm">
              <Activity className="w-3.5 h-3.5 mr-2" /> OVERVIEW
            </TabsTrigger>
            <TabsTrigger value="architecture" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs py-2 px-4 rounded-sm">
              <Map className="w-3.5 h-3.5 mr-2" /> ARCHITECTURE
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs py-2 px-4 rounded-sm">
              <BookOpen className="w-3.5 h-3.5 mr-2" /> ONBOARDING
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs py-2 px-4 rounded-sm">
              <ShieldAlert className="w-3.5 h-3.5 mr-2" /> SECURITY
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <TabsContent value="overview" className="m-0 focus-visible:outline-none">
              <Card className="border-border shadow-sm">
                <CardContent className="p-6 md:p-8 prose prose-invert prose-emerald max-w-none font-sans">
                  {analysis.summary ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysis.summary}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground font-mono">No summary available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="architecture" className="m-0 focus-visible:outline-none h-[600px]">
              {analysis.architecture ? (
                <MermaidDiagram chart={analysis.architecture.replace(/```mermaid\n|\n```/g, '')} />
              ) : (
                <Card className="h-full flex items-center justify-center border-dashed border-border/50">
                  <p className="text-muted-foreground font-mono">No architecture diagram available.</p>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="onboarding" className="m-0 focus-visible:outline-none">
              <Card className="border-border shadow-sm">
                <CardContent className="p-6 md:p-8 prose prose-invert prose-emerald max-w-none font-sans">
                  {analysis.onboarding ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysis.onboarding}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground font-mono">No onboarding guide available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="security" className="m-0 focus-visible:outline-none">
              <div className="grid gap-4 md:grid-cols-2">
                {securityFindings.length > 0 ? (
                  securityFindings.map((finding, i) => {
                    const isHigh = finding.toLowerCase().includes('high') || finding.toLowerCase().includes('critical');
                    const isMedium = finding.toLowerCase().includes('medium');
                    
                    return (
                      <Card key={i} className={`border ${isHigh ? 'border-destructive/50 bg-destructive/5' : isMedium ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border bg-card'}`}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-sm font-mono flex items-center gap-2">
                              <ShieldAlert className={`w-4 h-4 ${isHigh ? 'text-destructive' : isMedium ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                              Finding #{i+1}
                            </CardTitle>
                            {isHigh && <Badge variant="destructive" className="font-mono text-[10px]">HIGH</Badge>}
                            {isMedium && <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 font-mono text-[10px]">MEDIUM</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm font-sans text-muted-foreground">
                            {finding}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="col-span-2 border-dashed border-border/50 py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center p-0">
                      <ShieldAlert className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                      <p className="text-muted-foreground font-mono">No specific security findings reported.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, isAnalyzing }: { status: string, isAnalyzing?: boolean }) {
  if (isAnalyzing || status === "analyzing") {
    return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-[10px] uppercase animate-pulse">ANALYZING</Badge>;
  }
  
  switch (status) {
    case "done":
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono text-[10px] uppercase">ANALYZED</Badge>;
    case "error":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-[10px] uppercase">ERROR</Badge>;
    default:
      return <Badge variant="outline" className="bg-muted text-muted-foreground font-mono text-[10px] uppercase">PENDING</Badge>;
  }
}
