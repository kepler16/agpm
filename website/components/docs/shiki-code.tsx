import { codeToHtml } from "shiki";
import { cn } from "@/lib/utils";

interface ShikiCodeProps {
  code: string;
  language?: string;
  className?: string;
}

export async function ShikiCode({
  code,
  language = "text",
  className,
}: ShikiCodeProps) {
  const html = await codeToHtml(code, {
    lang: language,
    theme: "github-dark",
  });

  // Extract just the inner content (shiki outputs <pre><code>...</code></pre>)
  // We extract the code element content to avoid double wrapping
  // Remove only newlines between </span> and <span to prevent extra spacing
  // while preserving the structure for blank lines
  // Also remove trailing empty .line spans
  const codeContent = html
    .replace(/^<pre[^>]*><code[^>]*>/, "")
    .replace(/<\/code><\/pre>$/, "")
    .replace(/<\/span>\n<span/g, "</span><span")
    .replace(/(<span class="line"><\/span>)+$/, "");

  return (
    <code
      className={cn("font-mono text-sm [&_.line]:block", className)}
      dangerouslySetInnerHTML={{ __html: codeContent }}
    />
  );
}
