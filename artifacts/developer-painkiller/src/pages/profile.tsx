import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  useGetProfile,
  useUpdateProfile,
  useStartGitHubOAuth,
  useDisconnectGitHub,
  useGetGitHubRepos,
  getGetProfileQueryKey,
  getGetGitHubReposQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Star, Github, Save, User, Search, ExternalLink,
  Lock, Unlock, RefreshCw, X, Link2
} from "lucide-react";
import Avatar from "boring-avatars";
import { useQueryClient } from "@tanstack/react-query";

const AVATAR_SEEDS = [
  "alpha-forge", "beta-stream", "gamma-node", "delta-core",
  "epsilon-arc", "zeta-pulse", "eta-flux", "theta-wave",
  "iota-mesh", "kappa-grid", "lambda-stack", "mu-circuit",
];

const AVATAR_COLORS = ["#760BF7", "#a855f7", "#c084fc", "#e879f9", "#f472b6", "#818cf8"];

function BoringAvatar({ seed, size = 64 }: { seed: string; size?: number }) {
  return <Avatar size={size} name={seed} variant="beam" colors={AVATAR_COLORS} />;
}

function GitHubRepoBrowser({ githubUsername }: { githubUsername: string | null | undefined }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);

  const disconnectGitHub = useDisconnectGitHub();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: repos, isLoading, error, refetch } = useGetGitHubRepos(
    { q: debouncedQuery || undefined, page, per_page: 30 },
    { query: { queryKey: getGetGitHubReposQueryKey({ q: debouncedQuery || undefined, page, per_page: 30 }), enabled: !!githubUsername } }
  );

  const handleDisconnect = async () => {
    try {
      await disconnectGitHub.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      toast({ title: "GitHub disconnected" });
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    }
  };

  const handleSelectRepo = (htmlUrl: string) => {
    setLocation(`/?url=${encodeURIComponent(htmlUrl)}`);
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-primary" />
          <span className="text-sm font-mono font-medium">
            @{githubUsername}
          </span>
          <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
            CONNECTED
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-[10px] text-muted-foreground hover:text-destructive h-7 px-2"
          onClick={handleDisconnect}
          disabled={disconnectGitHub.isPending}
        >
          <X className="w-3 h-3 mr-1" /> DISCONNECT
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories..."
          className="pl-8 font-mono text-sm h-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Repo list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm font-mono text-muted-foreground">
            {(error as any)?.data?.error ?? "Failed to load repositories"}
          </p>
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3 mr-1.5" /> RETRY
          </Button>
        </div>
      ) : !repos || repos.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm font-mono text-muted-foreground">
            {debouncedQuery ? "No repositories match your search." : "No repositories found."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1 terminal-scroll">
          {repos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleSelectRepo(repo.htmlUrl)}
              className="w-full text-left p-3 border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                    {repo.private ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium truncate group-hover:text-primary transition-colors">
                      {repo.fullName}
                    </p>
                    {repo.description && (
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {repo.language && (
                        <span className="text-[10px] font-mono text-muted-foreground">{repo.language}</span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">
                        ★ {repo.stargazersCount}
                      </span>
                    </div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {repos && repos.length === 30 && (
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline" size="sm" className="font-mono text-xs h-7"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← PREV
          </Button>
          <span className="text-xs font-mono text-muted-foreground">Page {page}</span>
          <Button
            variant="outline" size="sm" className="font-mono text-xs h-7"
            onClick={() => setPage((p) => p + 1)}
          >
            NEXT →
          </Button>
        </div>
      )}
    </div>
  );
}

function GitHubConnectSection({ githubUsername }: { githubUsername: string | null | undefined }) {
  const { toast } = useToast();
  const startOAuth = useStartGitHubOAuth();

  const handleConnect = async () => {
    try {
      const res = await startOAuth.mutateAsync();
      window.location.href = res.url;
    } catch (err: any) {
      const msg = err?.data?.error ?? "Failed to start GitHub connection";
      toast({ title: "GitHub connection failed", description: msg, variant: "destructive" });
    }
  };

  if (githubUsername) {
    return <GitHubRepoBrowser githubUsername={githubUsername} />;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <Github className="w-10 h-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-mono font-medium">Connect your GitHub account</p>
        <p className="text-xs font-mono text-muted-foreground max-w-xs">
          Browse and import any of your repositories directly into Repolit for instant analysis.
        </p>
      </div>
      <Button
        onClick={handleConnect}
        disabled={startOAuth.isPending}
        className="font-mono text-xs font-bold tracking-wider"
      >
        <Github className="w-3.5 h-3.5 mr-1.5" />
        {startOAuth.isPending ? "REDIRECTING..." : "CONNECT GITHUB"}
      </Button>
    </div>
  );
}

export function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: { enabled: !!user, queryKey: getGetProfileQueryKey() },
  });

  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [selectedSeed, setSelectedSeed] = useState<string>("");
  const [visibleSeeds, setVisibleSeeds] = useState<string[]>(AVATAR_SEEDS.slice(0, 6));

  // Handle GitHub OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      toast({ title: "GitHub connected!", description: "Your repositories are now available." });
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("github_error")) {
      toast({ title: "GitHub connection failed", description: "Please try again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast, queryClient]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? user?.fullName ?? "");
      setUsername(profile.username ?? user?.username ?? "");
      setBio(profile.bio ?? "");
      setSelectedSeed(profile.avatarConfig ?? user?.id ?? "default");
    }
  }, [profile, user]);

  const shuffleSeeds = useCallback(() => {
    const extra = [
      `${displayName || "user"}-1`, `${displayName || "user"}-2`,
      `${username || "member"}-alpha`, `${username || "member"}-beta`,
      "dark-matter", "void-stream", "neon-circuit", "byte-forge",
    ];
    const pool = [...AVATAR_SEEDS, ...extra];
    setVisibleSeeds(pool.sort(() => Math.random() - 0.5).slice(0, 6));
  }, [displayName, username]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        data: {
          displayName: displayName || undefined,
          username: username || undefined,
          bio: bio || undefined,
          avatarConfig: selectedSeed || undefined,
        },
      });
      toast({ title: "Profile saved", description: "Your profile has been updated." });
    } catch (err: any) {
      const msg = err?.data?.error ?? err.message ?? "Unknown error";
      toast({ title: "Failed to save profile", description: msg, variant: "destructive" });
    }
  };

  if (!isLoaded) return null;

  if (!user) {
    return (
      <div className="container max-w-screen-xl py-20 text-center flex flex-col items-center">
        <User className="w-10 h-10 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold font-mono">Sign In Required</h1>
        <p className="text-muted-foreground font-mono mt-2 mb-6 text-sm">
          Please sign in to view your profile.
        </p>
        <Button onClick={() => setLocation("/sign-in")} className="font-mono text-xs">
          Sign In
        </Button>
      </div>
    );
  }

  const points = profile?.points ?? 0;
  const currentSeed = selectedSeed || user.id;

  return (
    <div className="container max-w-screen-xl py-6 sm:py-8 space-y-6">
      <Button
        variant="link"
        className="pl-0 w-fit text-muted-foreground hover:text-foreground font-mono text-xs"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="w-3 h-3 mr-1" /> BACK TO HOME
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight">YOUR PROFILE</h1>
        {profile && (
          <Badge variant="outline" className="font-mono text-xs w-fit flex items-center gap-1.5 border-primary/30 text-primary bg-primary/5">
            <Star className="w-3 h-3" /> {points} pts
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Column */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-muted-foreground">AVATAR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full overflow-hidden border-2 border-primary/30 p-0.5">
                <BoringAvatar seed={currentSeed} size={88} />
              </div>
              <span className="text-xs font-mono text-muted-foreground">Your avatar</span>
            </div>

            <p className="text-xs font-mono text-muted-foreground text-center">Pick a style:</p>

            <div className="grid grid-cols-3 gap-2">
              {visibleSeeds.map((seed, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedSeed(seed)}
                  className={`p-1.5 rounded border-2 transition-all flex justify-center items-center ${
                    selectedSeed === seed
                      ? "border-primary bg-primary/10 scale-105"
                      : "border-border/40 hover:border-border/80"
                  }`}
                >
                  <BoringAvatar seed={seed} size={48} />
                </button>
              ))}
            </div>

            <Button
              variant="outline" size="sm" className="w-full font-mono text-xs"
              onClick={shuffleSeeds}
            >
              SHUFFLE OPTIONS
            </Button>
          </CardContent>
        </Card>

        {/* Profile Info Column */}
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-muted-foreground">PROFILE INFO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Display Name</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={user.fullName ?? "Your name"}
                    className="font-mono text-sm"
                    maxLength={64}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    placeholder="your_username"
                    className="font-mono text-sm"
                    maxLength={32}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="font-mono text-sm resize-none"
                    rows={3}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Email</label>
                  <Input
                    value={user.primaryEmailAddress?.emailAddress ?? ""}
                    disabled
                    className="font-mono text-sm bg-muted/50 text-muted-foreground"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  className="font-mono text-xs font-bold tracking-wider w-full sm:w-auto"
                  disabled={updateProfile.isPending}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {updateProfile.isPending ? "SAVING..." : "SAVE CHANGES"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Points & Tier */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-muted-foreground">POINTS & TIER</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Points</span>
              <Badge variant="secondary" className="font-mono text-xs font-bold">
                <Star className="w-3 h-3 mr-1" /> {points}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Tier</span>
              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                FREE
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">Extra Scans Unlocked</span>
              <span className="text-xs font-mono">{profile?.extraScansUnlocked ?? 0}</span>
            </div>
            <div className="border-t border-border/40 pt-3">
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                Earn <span className="text-primary">10 pts</span> per scan.<br />
                Spend <span className="text-primary">10 pts</span> to unlock an extra scan beyond the free tier limit of 2.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Repositories */}
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-sm text-muted-foreground flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" /> GITHUB REPOSITORIES
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {profileLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <GitHubConnectSection githubUsername={profile?.githubUsername} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
