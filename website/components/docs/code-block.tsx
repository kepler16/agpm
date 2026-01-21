import { codeToHtml } from "shiki";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export async function CodeBlock({ code, language = "text" }: CodeBlockProps) {
  const html = await codeToHtml(code, {
    lang: language,
    theme: "github-dark",
  });

  return (
    <div
      className="mb-4 mt-6 overflow-x-auto rounded-lg border text-sm [&>pre]:p-4 [&>pre]:bg-zinc-950 dark:[&>pre]:bg-zinc-900"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
