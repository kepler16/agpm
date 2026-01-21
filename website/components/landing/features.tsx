import {
  Package,
  GitBranch,
  Layers,
  Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const features = [
  {
    icon: Package,
    title: "Multi-Target Support",
    description:
      "Install artifacts to Claude, OpenCode, Codex, and other AI tools simultaneously. One config, multiple destinations.",
  },
  {
    icon: GitBranch,
    title: "Git-Backed Sources",
    description:
      "Version-controlled artifacts with SHA pinning. Reproducible installations with integrity verification.",
  },
  {
    icon: Layers,
    title: "Collections",
    description:
      "Group related artifacts together. Install entire collections with a single command for organized workflows.",
  },
  {
    icon: Search,
    title: "Auto-Discovery",
    description:
      "Automatically discovers artifacts in repositories. Supports marketplace, plugin, and simple formats.",
  },
];

export function Features() {
  return (
    <section className="container py-24">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
          Everything you need to manage AI artifacts
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          AGPM provides a unified way to discover, install, and update skills, commands,
          and hooks from any git repository.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <Card key={feature.title} className="relative overflow-hidden">
            <CardHeader>
              <feature.icon className="h-10 w-10 mb-4 text-primary" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
