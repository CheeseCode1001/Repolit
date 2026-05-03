import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useGetRepo,
  getGetRepoQueryKey,
  useGetRepoAnalysis,
  getGetRepoAnalysisQueryKey,
  useDeleteRepo,
  useChatWithRepo,
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
  Activity,
  ExternalLink,
  Compass,
  MessageSquare,
  Send,
  User,
  Bot,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MermaidDiagram } from "@/components/mermaid";
import { Textarea } from "@/components/ui/textarea";
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

type StartHereFile = {
  file: string;
  title: string;
  why: string;
  insight: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function RepoDashboard() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const [logs, setLogs] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: repo, isLoading: repoLoading } = useGetRepo(id, {
    query: { enabled: !!id, queryKey: getGetRepoQueryKey(id) },
  });

  const { data: analysis, isLoading: analysisLoading } = useGetRepoAnalysis(
    id,
    {
      query: {
        enabled: !!id && repo?.status === "done",
        queryKey: getGetRepoAnalysisQueryKey(id),
      },
    }
  );

  const deleteRepo = useDeleteRepo();
  const chatWithRepo = useChatWithRepo();

  const handleDelete = async () => {
    try {
      await deleteRepo.mutateAsync({ id });
      toast({ title: "Repository deleted" });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Failed to delete repository",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const startAnalysis = async () => {
    if (!id || isAnalyzing) return;
    setIsAnalyzing(true);
    setLogs(["[SYSTEM] Initializing analysis sequence..."]);

    queryClient.setQueryData(getGetRepoQueryKey(id), (old: any) =>
      old ? { ...old, status: "analyzing" } : old
    );

    try {
      const token = await getToken();
      const response = await fetch(`/api/repos/${id}/analyze`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.step && data.step !== "done" && data.step !== "error") {
                setLogs((prev) => [...prev, `[PROCESS] ${data.step}`]);
              }
              if (data.step === "error") {
                setLogs((prev) => [...prev, `[ERROR] ${data.error}`]);
                toast({
                  title: "Analysis failed",
                  description: data.error,
                  variant: "destructive",
                });
                queryClient.invalidateQueries({
                  queryKey: getGetRepoQueryKey(id),
                });
              }
              if (data.step === "done") {
                setLogs((prev) => [...prev, `[SYSTEM] Analysis complete.`]);
                queryClient.invalidateQueries({
                  queryKey: getGetRepoQueryKey(id),
                });
                queryClient.invalidateQueries({
                  queryKey: getGetRepoAnalysisQueryKey(id),
                });
              }
            } catch (e) {
              /* ignore parse errors */
            }
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        `[FATAL] Connection lost: ${err.message}`,
      ]);
      queryClient.invalidateQueries({ queryKey: getGetRepoQueryKey(id) });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendChat = async () => {
    const question = chatInput.trim();
    if (!question || chatWithRepo.isPending) return;

    const userMessage: ChatMessage = { role: "user", content: question };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    try {
      const result = await chatWithRepo.mutateAsync({
        id,
        data: { question },
      });
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: result.answer,
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      toast({
        title: "Chat failed",
        description: err.message || "Could not get an answer.",
        variant: "destructive",
      });
      setChatMessages((prev) => prev.slice(0, -1));
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (repo?.status === "pending" && !isAnalyzing) {
      startAnalysis();
    }
  }, [repo?.status]);

  if (repoLoading) {
    return (
      <div className="container max-w-screen-xl py-6 sm:py-8 space-y-6">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 sm:h-96 w-full" />
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="container max-w-screen-xl py-20 text-center flex flex-col items-center">
        <ShieldAlert className="w-10 h-10 text-muted-foreground mb-4" />
        <h1 className="text-xl sm:text-2xl font-bold font-mono">
          Repository Not Found
        </h1>
        <p className="text-muted-foreground font-mono mt-2 mb-6 text-sm">
          This repository does not exist or was deleted.
        </p>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          className="font-mono text-xs"
        >
          <ArrowLeft className="w-3 h-3 mr-2" /> RETURN HOME
        </Button>
      </div>
    );
  }

  const isWorking =
    repo.status === "pending" || repo.status === "analyzing" || isAnalyzing;

  type SecurityFinding = {
    severity: "critical" | "high" | "medium" | "low" | "info";
    title: string;
    description: string;
    recommendation: string;
  };
  let securityFindings: SecurityFinding[] = [];
  if (analysis?.security) {
    try {
      const parsed = JSON.parse(analysis.security);
      securityFindings = Array.isArray(parsed) ? parsed : [];
    } catch (e) {}
  }

  let startHereFiles: StartHereFile[] = [];
  if (analysis?.startHere) {
    try {
      const parsed = JSON.parse(analysis.startHere);
      startHereFiles = Array.isArray(parsed) ? parsed : [];
    } catch (e) {}
  }

  const SUGGESTED_QUESTIONS = [
    "Where is authentication handled?",
    "How do I add a new API route?",
    "What is the data flow from frontend to database?",
    "Where should I look to understand the main business logic?",
    "How is error handling structured?",
  ];

  return (
    <div className="container max-w-screen-xl py-6 sm:py-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="link"
          className="pl-0 w-fit text-muted-foreground hover:text-foreground font-mono text-xs"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-3 h-3 mr-1" /> BACK TO DASHBOARD
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono tracking-tight truncate">
                {repo.owner}/
                <span className="text-primary">{repo.name}</span>
              </h1>
              <StatusBadge status={repo.status} isAnalyzing={isAnalyzing} />
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 text-xs sm:text-sm text-muted-foreground font-mono">
              {repo.language && (
                <div className="flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5" /> {repo.language}
                </div>
              )}
              {repo.stars != null && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> {repo.stars} stars
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary hover:underline underline-offset-4 flex items-center gap-1"
                >
                  github.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {repo.description && (
              <p className="mt-3 text-muted-foreground max-w-2xl font-sans text-sm leading-relaxed">
                {repo.description}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {repo.status === "error" && !isAnalyzing && (
              <Button
                onClick={startAnalysis}
                variant="outline"
                size="sm"
                className="font-mono text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1.5" /> RETRY
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/40"
                >
                  <Trash2 className="w-3 h-3 mr-1.5" /> DELETE
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border mx-4 sm:mx-0 max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono text-base">
                    Delete Repository Data?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-xs">
                    This will permanently remove the analysis data for{" "}
                    {repo.owner}/{repo.name}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="font-mono text-xs">
                    CANCEL
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    CONFIRM DELETE
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Terminal / Analysis states */}
      {isWorking ? (
        <Card className="bg-card border-border/60 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/20 py-3 px-4">
            <CardTitle className="font-mono text-xs flex items-center gap-2 text-muted-foreground">
              <Terminal className="w-3.5 h-3.5 text-primary" />
              ANALYSIS TERMINAL
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64 sm:h-80 md:h-96 w-full bg-black/60 font-mono text-xs sm:text-sm p-4 text-green-400/90 terminal-scroll">
              {logs.length === 0 ? (
                <div className="opacity-50 animate-pulse">
                  Waiting for connection...
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={
                        log.includes("[ERROR]") || log.includes("[FATAL]")
                          ? "text-red-400"
                          : log.includes("[SYSTEM]")
                          ? "text-blue-400"
                          : ""
                      }
                    >
                      {log}
                    </div>
                  ))}
                  <div className="animate-pulse mt-2 text-primary">_</div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      ) : repo.status === "error" ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-10 sm:py-14 text-center px-4">
            <ShieldAlert className="w-10 h-10 text-destructive mb-3" />
            <h3 className="text-lg font-bold font-mono text-destructive mb-2">
              Analysis Failed
            </h3>
            <p className="text-muted-foreground font-mono mb-6 max-w-md text-sm">
              There was an error while analyzing this repository. It may be too
              large, inaccessible, or the AI service timed out.
            </p>
            <Button
              onClick={startAnalysis}
              variant="outline"
              size="sm"
              className="font-mono text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> TRY AGAIN
            </Button>
          </CardContent>
        </Card>
      ) : analysisLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 sm:h-64 w-full" />
        </div>
      ) : analysis ? (
        <Tabs defaultValue="overview" className="w-full">
          {/* Full-width tab list */}
          <div className="w-full">
            <TabsList className="flex w-full justify-stretch h-auto p-1 bg-card border border-border/60 rounded-none gap-0.5 font-mono">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none"
              >
                <Activity className="w-3 h-3 sm:mr-1.5 shrink-0" />
                <span className="hidden sm:inline">OVERVIEW</span>
              </TabsTrigger>
              <TabsTrigger
                value="start-here"
                className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none"
              >
                <Compass className="w-3 h-3 sm:mr-1.5 shrink-0" />
                <span className="hidden sm:inline">START HERE</span>
              </TabsTrigger>
              <TabsTrigger
                value="architecture"
                className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none"
              >
                <Map className="w-3 h-3 sm:mr-1.5 shrink-0" />
                <span className="hidden sm:inline">ARCHITECTURE</span>
              </TabsTrigger>
              <TabsTrigger
                value="onboarding"
                className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none"
              >
                <BookOpen className="w-3 h-3 sm:mr-1.5 shrink-0" />
                <span className="hidden sm:inline">ONBOARDING</span>
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none"
              >
                <ShieldAlert className="w-3 h-3 sm:mr-1.5 shrink-0" />
                <span className="hidden sm:inline">SECURITY</span>
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex-1 text-[10px] sm:text-xs py-2 px-1 sm:px-4 rounded-none"
              >
                <MessageSquare className="w-3 h-3 sm:mr-1.5 shrink-0" />
                <span className="hidden sm:inline">ASK AI</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-3 sm:mt-4">
            <TabsContent value="overview" className="m-0">
              <Card className="border-border/60">
                <CardContent className="p-4 sm:p-6 md:p-8 prose prose-invert prose-sm sm:prose-base prose-dark-green max-w-none font-sans">
                  {analysis.summary ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysis.summary}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground font-mono text-sm">
                      No summary available.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="start-here" className="m-0">
              {startHereFiles.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 px-1 pb-1 border-b border-border/40">
                    <Compass className="w-4 h-4 text-primary" />
                    <p className="text-xs font-mono text-muted-foreground">
                      Read these files first — ordered by priority. Each one unlocks a key part of the codebase.
                    </p>
                  </div>
                  {startHereFiles.map((item, i) => (
                    <Card key={i} className="border-border/60 bg-card/50">
                      <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                            <span className="text-[10px] font-bold font-mono text-primary">{i + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <CardTitle className="text-sm font-mono font-bold text-foreground">
                                {item.title}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-mono text-primary/70">
                              <FileCode className="w-3 h-3 shrink-0" />
                              <span className="truncate">{item.file}</span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 sm:px-5 pb-4 space-y-3 pl-[calc(1rem+1.5rem+0.75rem)] sm:pl-[calc(1.25rem+1.5rem+0.75rem)]">
                        <p className="text-sm font-sans text-muted-foreground leading-relaxed">
                          {item.why}
                        </p>
                        {item.insight && (
                          <div className="border-l-2 border-primary/40 pl-3 bg-primary/5 py-2 pr-3 rounded-r">
                            <p className="text-xs font-mono text-primary/80 leading-relaxed">
                              <span className="text-primary font-bold">Senior insight: </span>
                              {item.insight}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-border/50 py-12">
                  <CardContent className="flex flex-col items-center justify-center text-center p-0">
                    <Compass className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
                    <p className="text-muted-foreground font-mono text-sm">
                      No Start Here guide available.
                    </p>
                    <p className="text-xs text-muted-foreground/60 font-mono mt-1">
                      Re-analyze this repository to generate a guide.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="architecture" className="m-0">
              <div className="h-72 sm:h-[500px] md:h-[600px]">
                {analysis.architecture ? (
                  <MermaidDiagram chart={analysis.architecture} />
                ) : (
                  <Card className="h-full flex items-center justify-center border-dashed border-border/50">
                    <p className="text-muted-foreground font-mono text-sm">
                      No architecture diagram available.
                    </p>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="onboarding" className="m-0">
              <Card className="border-border/60">
                <CardContent className="p-4 sm:p-6 md:p-8 prose prose-invert prose-sm sm:prose-base prose-dark-green max-w-none font-sans">
                  {analysis.onboarding ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysis.onboarding}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground font-mono text-sm">
                      No onboarding guide available.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="m-0">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
                {securityFindings.length > 0 ? (
                  securityFindings.map((finding, i) => {
                    const sev = (finding.severity ?? "").toLowerCase();
                    const isHigh = sev === "critical" || sev === "high";
                    const isMedium = sev === "medium";
                    const severityLabel = (finding.severity ?? "info").toUpperCase();
                    return (
                      <Card
                        key={i}
                        className={`border ${
                          isHigh
                            ? "border-destructive/40 bg-destructive/5"
                            : isMedium
                            ? "border-yellow-500/40 bg-yellow-500/5"
                            : "border-border/60 bg-card"
                        }`}
                      >
                        <CardHeader className="pb-2 pt-4 px-4">
                          <div className="flex justify-between items-start gap-2">
                            <CardTitle className="text-xs sm:text-sm font-mono flex items-center gap-2">
                              <ShieldAlert
                                className={`w-4 h-4 shrink-0 ${
                                  isHigh
                                    ? "text-destructive"
                                    : isMedium
                                    ? "text-yellow-500"
                                    : "text-muted-foreground"
                                }`}
                              />
                              {finding.title || `Finding #${i + 1}`}
                            </CardTitle>
                            <Badge
                              variant={isHigh ? "destructive" : "outline"}
                              className={`font-mono text-[10px] shrink-0 ${
                                isMedium
                                  ? "text-yellow-500 border-yellow-500/30"
                                  : !isHigh
                                  ? "text-muted-foreground"
                                  : ""
                              }`}
                            >
                              {severityLabel}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-2">
                          <p className="text-xs sm:text-sm font-sans text-muted-foreground leading-relaxed">
                            {finding.description}
                          </p>
                          {finding.recommendation && (
                            <p className="text-xs font-mono text-primary/80 border-l-2 border-primary/30 pl-3 leading-relaxed">
                              {finding.recommendation}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="col-span-full border-dashed border-border/50 py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center p-0">
                      <ShieldAlert className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
                      <p className="text-muted-foreground font-mono text-sm">
                        No specific security findings reported.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="chat" className="m-0">
              <Card className="border-border/60">
                <CardHeader className="border-b border-border/50 bg-muted/20 py-3 px-4">
                  <CardTitle className="font-mono text-xs flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    ASK ANYTHING ABOUT THIS CODEBASE
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col">
                  {/* Chat messages */}
                  <ScrollArea className="h-80 sm:h-96 w-full p-4">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
                        <div className="text-center space-y-1">
                          <Bot className="w-8 h-8 text-primary/40 mx-auto mb-2" />
                          <p className="text-sm font-mono text-muted-foreground">
                            Ask anything about {repo.owner}/{repo.name}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground/60">
                            I have context from the full analysis
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                          {SUGGESTED_QUESTIONS.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => setChatInput(q)}
                              className="text-[10px] sm:text-xs font-mono px-2.5 py-1.5 rounded-none border border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors text-left"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 py-2">
                        {chatMessages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex gap-3 ${
                              msg.role === "user" ? "justify-end" : "justify-start"
                            }`}
                          >
                            {msg.role === "assistant" && (
                              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                                <Bot className="w-3.5 h-3.5 text-primary" />
                              </div>
                            )}
                            <div
                              className={`max-w-[85%] rounded-none px-3 py-2.5 text-sm font-sans leading-relaxed ${
                                msg.role === "user"
                                  ? "bg-primary/10 border border-primary/20 text-foreground"
                                  : "bg-muted/40 border border-border/50 text-foreground prose prose-invert prose-sm max-w-none"
                              }`}
                            >
                              {msg.role === "assistant" ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {msg.content}
                                </ReactMarkdown>
                              ) : (
                                <p>{msg.content}</p>
                              )}
                            </div>
                            {msg.role === "user" && (
                              <div className="w-6 h-6 rounded-full bg-muted border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        {chatWithRepo.isPending && (
                          <div className="flex gap-3 justify-start">
                            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                              <Bot className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="bg-muted/40 border border-border/50 px-3 py-2.5 rounded-none">
                              <div className="flex gap-1 items-center h-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Input */}
                  <div className="border-t border-border/50 p-3 sm:p-4 flex gap-2 items-end">
                    <Textarea
                      placeholder={`Ask about ${repo.name}... (e.g. "Where is auth handled?")`}
                      className="min-h-[44px] max-h-32 resize-none font-mono text-xs bg-background border-border/60 focus-visible:ring-primary rounded-none flex-1"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChat();
                        }
                      }}
                      disabled={chatWithRepo.isPending}
                    />
                    <Button
                      onClick={handleSendChat}
                      size="sm"
                      className="h-[44px] w-[44px] p-0 shrink-0 rounded-none"
                      disabled={!chatInput.trim() || chatWithRepo.isPending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
  isAnalyzing,
}: {
  status: string;
  isAnalyzing?: boolean;
}) {
  if (isAnalyzing || status === "analyzing") {
    return (
      <Badge
        variant="outline"
        className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-mono text-[10px] uppercase animate-pulse shrink-0 rounded-none"
      >
        ANALYZING
      </Badge>
    );
  }
  switch (status) {
    case "done":
      return (
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px] uppercase shrink-0 rounded-none"
        >
          ANALYZED
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
