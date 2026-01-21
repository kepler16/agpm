import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="container mx-auto py-24 px-4 md:px-6 lg:px-8">
      <div className="rounded-lg border bg-card p-8 md:p-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
          Ready to get started?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Install AGPM and start managing your AI coding tool artifacts today.
          Join the community on GitHub.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/docs/getting-started">
              Read the Docs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link
              href="https://github.com/kepler16/agpm/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Report an Issue
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
