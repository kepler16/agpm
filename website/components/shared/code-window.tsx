import { cn } from "@/lib/utils";

interface CodeWindowProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function CodeWindow({ title, children, className }: CodeWindowProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden",
        className
      )}
    >
      {title && (
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <div className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
      )}
      <div className="p-4 font-mono bg-zinc-950 text-zinc-100 dark:bg-zinc-900">
        {children}
      </div>
    </div>
  );
}
