import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeWindow } from "@/components/shared/code-window";

export function Hero() {
  return (
    <section className="container py-24 md:py-32">
      <div className="flex flex-col items-center text-center space-y-8">
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Universal Package Manager for{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI Coding Tools
            </span>
          </h1>
          <p className="text-xl text-muted-foreground md:text-2xl max-w-2xl mx-auto">
            Manage skills, commands, and hooks across Claude, OpenCode, Codex, and more.
            Version-controlled artifacts with reproducible installations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg" asChild>
            <Link href="/docs/getting-started">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link
              href="https://github.com/kepler16/agpm"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="mr-2 h-4 w-4" />
              View on GitHub
            </Link>
          </Button>
        </div>

        <div className="w-full max-w-2xl mt-8">
          <CodeWindow title="Install AGPM">
            <code className="text-sm sm:text-base">
              <span className="text-muted-foreground">$</span>{" "}
              <span className="text-green-500 dark:text-green-400">pnpm</span> add -g @agpm/cli
            </code>
          </CodeWindow>
        </div>
      </div>
    </section>
  );
}
