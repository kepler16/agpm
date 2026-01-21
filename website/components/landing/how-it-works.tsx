import { FolderGit2, Package2, Zap } from "lucide-react";

const steps = [
  {
    icon: FolderGit2,
    title: "1. Add Sources",
    description:
      "Point AGPM to git repositories containing skills, commands, or hooks. Supports GitHub shorthand or full URLs.",
  },
  {
    icon: Package2,
    title: "2. Select Artifacts",
    description:
      "Browse and select individual artifacts or entire collections. AGPM auto-discovers available items in any supported format.",
  },
  {
    icon: Zap,
    title: "3. Install & Use",
    description:
      "Install artifacts to your project. They're copied to the right directories for Claude, OpenCode, and other tools.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-y bg-muted/50 py-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground">
            A simple workflow for managing AI coding tool artifacts
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
