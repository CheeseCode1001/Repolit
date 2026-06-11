import { GitCommit, ExternalLink, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

type Commit = {
  sha: string;
  message: string;
  author: string;
  login: string | null;
  avatar: string | null;
  date: string;
  url: string;
};

type Props = {
  commitHistoryJson: string | null | undefined;
};

export function CommitHistory({ commitHistoryJson }: Props) {
  let commits: Commit[] = [];
  if (commitHistoryJson) {
    try {
      const parsed = JSON.parse(commitHistoryJson);
      commits = Array.isArray(parsed) ? parsed : [];
    } catch { /* ignore */ }
  }

  if (commits.length === 0) {
    return (
      <Card className="border-dashed border-border/50 py-12">
        <CardContent className="flex flex-col items-center justify-center text-center p-0">
          <GitCommit className="w-8 h-8 text-muted-foreground mb-2 opacity-40" />
          <p className="text-muted-foreground font-mono text-sm">No commit history available.</p>
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">
            Re-analyze this repository to fetch recent commits.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 pb-2 border-b border-border/40">
        <GitCommit className="w-4 h-4 text-primary" />
        <p className="text-xs font-mono text-muted-foreground">
          {commits.length} recent commits — ordered newest first.
        </p>
      </div>

      <div className="space-y-1.5">
        {commits.map((commit, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 border border-border/40 bg-card/50 hover:bg-card/80 transition-colors group"
          >
            <div className="flex-shrink-0 mt-0.5">
              {commit.avatar ? (
                <img
                  src={commit.avatar}
                  alt={commit.login ?? commit.author}
                  className="w-7 h-7 rounded-full border border-border/40"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-muted border border-border/40 flex items-center justify-center">
                  <GitCommit className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-sans text-foreground leading-snug truncate">
                {commit.message}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] uppercase text-muted-foreground border-border/40 px-1.5 py-0"
                >
                  {commit.sha}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {commit.login ?? commit.author}
                </span>
                {commit.date && (
                  <span className="text-xs text-muted-foreground/70 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(commit.date), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>

            {commit.url && (
              <a
                href={commit.url}
                target="_blank"
                rel="noreferrer"
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
