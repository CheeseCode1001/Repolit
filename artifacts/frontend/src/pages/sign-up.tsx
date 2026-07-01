import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { CheckCircle2 } from "lucide-react";

// Password strength calculation
const getPasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length > 5) strength += 1;
  if (password.length > 7) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  return Math.min(4, strength); // 0-4 scale
};

const getStrengthColor = (strength: number) => {
  switch (strength) {
    case 0: return "bg-[hsl(240,3.7%,20%)]"; // default
    case 1: return "bg-red-500";
    case 2: return "bg-yellow-500";
    case 3: return "bg-blue-500";
    case 4: return "bg-[#760BF7]";
    default: return "bg-[hsl(240,3.7%,20%)]";
  }
};

const getStrengthLabel = (strength: number) => {
  switch (strength) {
    case 0: return "Too short";
    case 1: return "Weak";
    case 2: return "Fair";
    case 3: return "Good";
    case 4: return "Strong";
    default: return "";
  }
};

export function SignUpPage() {
  const [, setLocation] = useLocation();
  const { signup } = useAuth();
  const { toast } = useToast();
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      setUsernameError(username ? "Username must be at least 3 characters" : "");
      return;
    }

    if (!/^[a-zA-Z0-9_-]*$/.test(username)) {
      setUsernameAvailable(null);
      setUsernameError("Only letters, numbers, _, and - allowed");
      return;
    }
    
    setUsernameError("");

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await customFetch<{available: boolean}>(`/api/auth/check-username/${username}`);
        setUsernameAvailable(res.available);
      } catch (err) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameAvailable === false) return;
    if (strength < 2) {
      toast({ title: "Weak Password", description: "Please choose a stronger password", variant: "destructive" });
      return;
    }
    if (usernameError) return;

    setLoading(true);
    
    try {
      await signup({ username, email, password });
      toast({ title: "Account created", description: "Please check your email to verify your account." });
      setLocation("/verify-email");
    } catch (err: any) {
      toast({ 
        title: "Sign up failed", 
        description: err?.data?.error || err.message || "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-background px-4 py-12 md:scale-80 scale-90">
      <Card className="w-full max-w-md border-border/60 bg-[hsl(240,5.9%,7%)]">
        <CardHeader className="space-y-1 pb-6 text-center">
        {/* logo */}
        <img src="/logo-icon.png" alt="Logo" className="w-14 h-14 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold font-mono tracking-tight text-[hsl(0,0%,98%)]">Create account</CardTitle>
          <p className="text-sm text-muted-foreground font-mono">Start analyzing repositories today</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2 relative">
              <label className="text-xs font-mono text-[hsl(0,0%,98%)] uppercase tracking-wider">Username</label>
              <Input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                className={`bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono ${
                  usernameAvailable === false || usernameError ? "border-red-500" : 
                  usernameAvailable === true ? "border-green-500" : ""
                }`}
                placeholder="your_username"
              />
              {!checkingUsername && !usernameError && usernameAvailable === true && (
                <CheckCircle2 className="absolute right-3 top-[34px] h-4 w-4 text-green-500" />
              )}
              <div className="text-[10px] font-mono">
                {checkingUsername && <span className="text-muted-foreground">Checking...</span>}
                {usernameError && <span className="text-red-500">{usernameError}</span>}
                {!checkingUsername && !usernameError && usernameAvailable === false && <span className="text-red-500">Username is already taken</span>}
                {!checkingUsername && !usernameError && usernameAvailable === true && <span className="text-green-500">Username is available</span>}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-mono text-[hsl(0,0%,98%)] uppercase tracking-wider">Email</label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                className="bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-[hsl(0,0%,98%)] uppercase tracking-wider flex justify-between">
                <span>Password</span>
                {password && <span className="text-muted-foreground capitalize">{getStrengthLabel(strength)}</span>}
              </label>
              <Input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono"
              />
              {/* Password strength meter */}
              <div className="flex gap-1 h-1.5 mt-2">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-full flex-1 rounded-sm transition-colors duration-300 ${
                      password.length > 0 && strength >= level 
                        ? getStrengthColor(strength)
                        : "bg-[hsl(240,3.7%,15%)]"
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <Button
              type="submit"
              disabled={loading || usernameAvailable === false || !!usernameError || strength < 2}
              className="w-full bg-[#760BF7] text-white font-mono font-bold uppercase tracking-wider hover:bg-[#8b1cff] mt-6"
            >
              {loading ? "Creating..." : "Continue"}
            </Button>
            
            <div className="mt-4 text-center text-sm font-mono text-[hsl(240,5%,64.9%)]">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-[#760BF7] hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
