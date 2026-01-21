import { CodeWindow } from "@/components/shared/code-window";

const steps = [
  {
    comment: "# Add a source repository",
    command: "agpm source add anthropics/skills",
  },
  {
    comment: "# Discover available artifacts",
    command: "agpm source discover anthropics/skills",
  },
  {
    comment: "# Add an artifact to your project",
    command: "agpm add anthropics/skills pdf",
  },
  {
    comment: "# Install to target directories",
    command: "agpm install",
  },
];

export function QuickStart() {
  return (
    <section className="container py-24">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Get started in seconds
          </h2>
          <p className="text-lg text-muted-foreground">
            Four simple commands to discover, add, and install artifacts from any repository.
          </p>
        </div>
        <CodeWindow title="Terminal">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="space-y-1">
                <div className="text-zinc-500 text-sm">{step.comment}</div>
                <div>
                  <span className="text-zinc-500">$</span>{" "}
                  <span className="text-green-400">{step.command.split(" ")[0]}</span>{" "}
                  <span className="text-zinc-100">
                    {step.command.split(" ").slice(1).join(" ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CodeWindow>
      </div>
    </section>
  );
}
