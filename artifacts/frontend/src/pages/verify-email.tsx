import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function VerifyEmailPage() {
  const [location, setLocation] = useLocation();
  const { verifyEmail } = useAuth();
  const { toast } = useToast();
  
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    const codeParam = params.get("code");
    
    if (emailParam) setEmail(emailParam);
    
    if (emailParam && codeParam) {
      setCode(codeParam);
      // Auto-submit if both are present in URL
      handleVerify(emailParam, codeParam);
    }
  }, []);

  const handleVerify = async (emailToVerify = email, codeToVerify = code) => {
    setLoading(true);
    try {
      await verifyEmail({ email: emailToVerify, code: codeToVerify });
      toast({ title: "Email verified!", description: "Your account is now fully active." });
      setLocation("/");
    } catch (err: any) {
      toast({ 
        title: "Verification failed", 
        description: err?.data?.error || err.message || "Invalid code",
        variant: "destructive"
      });
      // Clear URL params on failure so they can try manually
      window.history.replaceState({}, "", "/verify-email");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  return (
    <div className="flex items-center justify-center bg-background px-4 py-12 md:scale-80 scale-90">
      <Card className="w-full max-w-md border-border/60 bg-[hsl(240,5.9%,7%)]">
        <CardHeader className="space-y-1 pb-6 text-center">
        {/* logo */}
        <img src="/logo-icon.png" alt="Logo" className="w-14 h-14 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold font-mono tracking-tight text-[hsl(0,0%,98%)]">Verify your email</CardTitle>
          <p className="text-sm text-muted-foreground font-mono">
            Enter the code sent to your email address
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-mono text-[hsl(0,0%,98%)] uppercase tracking-wider">Email</label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-[hsl(0,0%,98%)] uppercase tracking-wider">Verification Code</label>
              <Input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-[hsl(240,3.7%,12%)] border-[hsl(240,3.7%,20%)] text-[hsl(0,0%,98%)] font-mono text-center tracking-widest"
                placeholder="Paste code here"
              />
            </div>
            
            <Button
              type="submit"
              disabled={loading || !email || !code}
              className="w-full bg-[#760BF7] text-white font-mono font-bold uppercase tracking-wider hover:bg-[#8b1cff] mt-4"
            >
              {loading ? "Verifying..." : "Verify Email"}
            </Button>
            
            <div className="mt-4 text-center text-sm font-mono text-[hsl(240,5%,64.9%)]">
              <Link href="/" className="text-muted-foreground hover:text-white transition-colors">
                Skip for now
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
