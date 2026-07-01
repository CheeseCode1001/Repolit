import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function SignInPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login({ login: loginId, password });
      toast({ title: "Welcome back!", description: "You have successfully signed in." });
      window.location.href = "/";
    } catch (err: any) {
      toast({ 
        title: "Sign in failed", 
        description: err?.data?.error || err.message || "Invalid credentials",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md border-border/60 md:scale-80 scale-90">
        <CardHeader className="space-y-1 pb-6 text-center">
          <img src="/logo-icon.png" alt="Logo" className="w-14 h-14 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold font-mono tracking-tight ">Welcome back</CardTitle>
          <p className="text-sm text-muted-foreground font-mono">Sign in to your Repolit account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider">Username or Email</label>
              <Input
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="font-mono"
                placeholder="your_username or email@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider">Password</label>
              <Input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
              />
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-mono font-bold uppercase tracking-wider hover:bg-primary/90 mt-4"
            >
              {loading ? "Signing in..." : "Continue"}
            </Button>
            
            <div className="mt-4 text-center text-sm font-mono text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
