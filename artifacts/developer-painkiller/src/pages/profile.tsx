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
import ReactNiceAvatar, { genConfig } from "react-nice-avatar";
import type { AvatarConfig } from "react-nice-avatar";

type AvatarStyleOption = {
  label: string;
  config: Partial<AvatarConfig>;
};

const AVATAR_STYLE_OPTIONS: AvatarStyleOption[] = [
  { label: "Random 1", config: genConfig() },
  { label: "Random 2", config: genConfig() },
  { label: "Random 3", config: genConfig() },
  { label: "Random 4", config: genConfig() },
  { label: "Random 5", config: genConfig() },
  { label: "Random 6", config: genConfig() },
];

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
  const [selectedAvatarConfig, setSelectedAvatarConfig] = useState<Partial<AvatarConfig> | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<AvatarStyleOption[]>(AVATAR_STYLE_OPTIONS);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? user?.fullName ?? "");
      setUsername(profile.username ?? user?.username ?? "");
      setBio(profile.bio ?? "");
      if (profile.avatarConfig) {
        try {
          setSelectedAvatarConfig(JSON.parse(profile.avatarConfig));
        } catch { /* ignore */ }
      }
    }
  }, [profile, user]);

  const regenerateAvatars = () => {
    setAvatarOptions([
      { label: "Option 1", config: genConfig() },
      { label: "Option 2", config: genConfig() },
      { label: "Option 3", config: genConfig() },
      { label: "Option 4", config: genConfig() },
      { label: "Option 5", config: genConfig() },
      { label: "Option 6", config: genConfig() },
    ]);
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        data: {
          displayName,
          username,
          bio,
          avatarConfig: selectedAvatarConfig ? JSON.stringify(selectedAvatarConfig) : undefined,
        },
      });
      toast({ title: "Profile saved", description: "Your profile has been updated." });
    } catch (err: any) {
      toast({ title: "Failed to save profile", description: err.message, variant: "destructive" });
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

  const currentAvatar = selectedAvatarConfig;
  const points = profile?.points ?? 0;

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
            <div className="flex justify-center">
              {currentAvatar ? (
                <ReactNiceAvatar style={{ width: 96, height: 96 }} {...currentAvatar} />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border border-border">
                  <User className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
            </div>

            <p className="text-xs font-mono text-muted-foreground text-center">Pick an avatar style:</p>

            <div className="grid grid-cols-3 gap-2">
              {avatarOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAvatarConfig(opt.config)}
                  className={`p-1 rounded border-2 transition-colors flex justify-center items-center ${
                    JSON.stringify(selectedAvatarConfig) === JSON.stringify(opt.config)
                      ? "border-primary bg-primary/10"
                      : "border-border/40 hover:border-border"
                  }`}
                >
                  <ReactNiceAvatar style={{ width: 48, height: 48 }} {...opt.config} />
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full font-mono text-xs"
              onClick={regenerateAvatars}
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

        {/* Points & Connections */}
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
