import { useLocation } from "wouter";
import { Terminal, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center text-center gap-6 max-w-sm">
        <div className="flex items-center gap-2 text-primary">
          <Terminal className="h-8 w-8" />
        </div>
        <div>
          <p className="text-6xl font-extrabold font-mono text-primary">404</p>
          <h1 className="mt-2 text-xl font-bold font-mono text-foreground">Page Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground font-mono">
            This route does not exist. Did you miss a redirect?
          </p>
        </div>
        <Button
          variant="outline"
          className="font-mono text-xs"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-3 h-3 mr-2" />
          RETURN HOME
        </Button>
      </div>
    </div>
  );
}
