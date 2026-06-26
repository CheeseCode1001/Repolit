import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Coffee } from "lucide-react";

export function FundPage() {
  return (
    <div className="container max-w-screen-xl py-12 flex flex-col items-center justify-center flex-1">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Coffee className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold font-sans">Buy me a coffee</CardTitle>
          <CardDescription className="text-muted-foreground font-mono">
            Buy me a coffee, it keeps our servers running
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-muted/30 p-6 rounded-xl border border-border/50 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Bank Name</p>
              <p className="font-mono text-sm font-medium">Open Source Bank</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Account Name</p>
              <p className="font-mono text-sm font-medium">Repolit Support</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Account Number</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-lg font-bold text-primary">1234 5678 9012 3456</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
