import { useEffect, useState } from "react";
import { Lock, Unlock, Github } from "lucide-react";
import {
  useGetGitHubRepos,
  getGetGitHubReposQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type GitHubRepoPickerProps = {
  open: boolean;
  query: string;
  githubUsername: string;
  onSelect: (htmlUrl: string) => void;
  className?: string;
};

export function GitHubRepoPicker({
  open,
  query,
  githubUsername,
  onSelect,
  className,
}: GitHubRepoPickerProps) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: repos, isLoading, error } = useGetGitHubRepos(
    { q: debouncedQuery || undefined, page: 1, per_page: 10 },
    {
      query: {
        queryKey: getGetGitHubReposQueryKey({
          q: debouncedQuery || undefined,
          page: 1,
          per_page: 10,
        }),
        enabled: open && !!githubUsername,
      },
    },
  );

  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border border-border/60 bg-popover shadow-lg terminal-scroll",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Github className="h-3 w-3" />
        Your repositories
      </div>

      {isLoading ? (
        <div className="px-3 py-4 text-xs font-mono text-muted-foreground">
          Searching repositories...
        </div>
      ) : error ? (
        <div className="px-3 py-4 text-xs font-mono text-destructive">
          {(error as { data?: { error?: string } })?.data?.error ??
            "Failed to load repositories"}
        </div>
      ) : !repos || repos.length === 0 ? (
        <div className="px-3 py-4 text-xs font-mono text-muted-foreground">
          {debouncedQuery
            ? "No repositories match your search."
            : "No repositories found."}
        </div>
      ) : (
        repos.map((repo) => (
          <button
            key={repo.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(repo.htmlUrl)}
            className="flex w-full items-start gap-2 border-b border-border/30 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-primary/5"
          >
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {repo.private ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Unlock className="h-3.5 w-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-mono font-medium">
                {repo.fullName}
              </span>
              {repo.description && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {repo.description}
                </span>
              )}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
