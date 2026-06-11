import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Star, Github, Save, User } from "lucide-react";
import Avatar from "boring-avatars";

// Preset seeds for avatar picker
const AVATAR_SEEDS = [
  "alpha-forge",
  "beta-stream",
  "gamma-node",
  "delta-core",
  "epsilon-arc",
  "zeta-pulse",
  "eta-flux",
  "theta-wave",
  "iota-mesh",
  "kappa-grid",
  "lambda-stack",
  "mu-circuit",
];

const AVATAR_COLORS = ["#4ade80", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa", "#fbbf24"];

function BoringAvatar({ seed, size = 64 }: { seed: string; size?: number }) {
  return (
    <Avatar
      size={size}
      name={seed}
      variant="beam"
      colors={AVATAR_COLORS}
    />
  );
}

export function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const { toast } = useToast();

  const { data: profile, isLoading: profileLoading } = useGetProfile({
    query: { enabled: !!user, queryKey: getGetProfileQueryKey() },
  });

  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [selectedSeed, setSelectedSeed] = useState<string>("");
  const [visibleSeeds, setVisibleSeeds] = useState<string[]>(AVATAR_SEEDS.slice(0, 6));

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? user?.fullName ?? "");
      setUsername(profile.username ?? user?.username ?? "");
      setBio(profile.bio ?? "");
      // avatarConfig is now the seed string directly
      setSelectedSeed(profile.avatarConfig ?? user?.id ?? "default");
    }
  }, [profile, user]);

  const shuffleSeeds = () => {
    const all = AVATAR_SEEDS;
    // Generate 6 random seeds from the list plus some user-based combos
    const extra = [
      `${displayName || "user"}-1`,
      `${displayName || "user"}-2`,
      `${username || "member"}-alpha`,
      `${username || "member"}-beta`,
      "dark-matter",
      "void-stream",
      "neon-circuit",
      "byte-forge",
    ];
    const pool = [...all, ...extra];
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 6);
    setVisibleSeeds(shuffled);
  };

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
            {/* Current avatar preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full overflow-hidden border-2 border-primary/30 p-0.5">
                <BoringAvatar seed={currentSeed} size={88} />
              </div>
              <span className="text-xs font-mono text-muted-foreground">Your avatar</span>
            </div>

            <p className="text-xs font-mono text-muted-foreground text-center">Pick a style:</p>

            {/* Preset picker */}
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
              variant="outline"
              size="sm"
              className="w-full font-mono text-xs"
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
                    className="font-mono text-sm rounded-none"
                    maxLength={64}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    placeholder="your_username"
                    className="font-mono text-sm rounded-none"
                    maxLength={32}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="font-mono text-sm rounded-none resize-none"
                    rows={3}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Email</label>
                  <Input
                    value={user.primaryEmailAddress?.emailAddress ?? ""}
                    disabled
                    className="font-mono text-sm rounded-none bg-muted/50 text-muted-foreground"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  className="font-mono text-xs font-bold tracking-wider rounded-none w-full sm:w-auto"
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

        {/* Connections */}
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-muted-foreground">ACCOUNT & CONNECTIONS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-border/40 bg-card/50">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-mono">GitHub</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => openUserProfile()}
              >
                MANAGE
              </Button>
            </div>
            <p className="text-xs font-mono text-muted-foreground">
              Connect GitHub and manage your account settings via the Clerk profile panel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
