import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/docs/table";
import { highlight } from "sugar-high";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings
    h1: ({ className, ...props }) => (
      <h1
        className={cn(
          "mt-2 scroll-m-20 text-4xl font-bold tracking-tight",
          className
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={cn(
          "mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
          className
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          "mt-8 scroll-m-20 text-2xl font-semibold tracking-tight",
          className
        )}
        {...props}
      />
    ),
    h4: ({ className, ...props }) => (
      <h4
        className={cn(
          "mt-8 scroll-m-20 text-xl font-semibold tracking-tight",
          className
        )}
        {...props}
      />
    ),
    // Paragraph
    p: ({ className, ...props }) => (
      <p
        className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
        {...props}
      />
    ),
    // Lists
    ul: ({ className, ...props }) => (
      <ul className={cn("my-6 ml-6 list-disc", className)} {...props} />
    ),
    ol: ({ className, ...props }) => (
      <ol className={cn("my-6 ml-6 list-decimal", className)} {...props} />
    ),
    li: ({ className, ...props }) => (
      <li className={cn("mt-2", className)} {...props} />
    ),
    // Blockquote
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          "mt-6 border-l-2 pl-6 italic text-muted-foreground",
          className
        )}
        {...props}
      />
    ),
    // Code - inline code and code blocks
    code: ({ className, children, ...props }) => {
      // Extract text content from children (handles React elements)
      const getTextContent = (node: React.ReactNode): string => {
        if (typeof node === "string") return node;
        if (typeof node === "number") return String(node);
        if (Array.isArray(node)) return node.map(getTextContent).join("");
        if (node && typeof node === "object" && "props" in node) {
          return getTextContent((node as React.ReactElement).props.children);
        }
        return "";
      };

      const codeString = getTextContent(children);

      // Code blocks have multi-line content or language class
      const isCodeBlock =
        className?.includes("language-") || codeString.includes("\n");

      if (isCodeBlock) {
        const html = highlight(codeString);
        return (
          <code
            className={cn("font-mono text-sm", className)}
            dangerouslySetInnerHTML={{ __html: html }}
            {...props}
          />
        );
      }

      // Inline code
      return (
        <code
          className={cn(
            "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    },
    // Code - code blocks
    pre: ({ className, ...props }) => (
      <pre
        className={cn(
          "mb-4 mt-6 overflow-x-auto rounded-lg border bg-zinc-950 px-4 py-4 dark:bg-zinc-900",
          className
        )}
        style={{ color: "#c9d1d9" }}
        {...props}
      />
    ),
    // Table
    table: ({ className, ...props }) => (
      <div className="my-6 w-full overflow-y-auto">
        <table className={cn("w-full", className)} {...props} />
      </div>
    ),
    tr: ({ className, ...props }) => (
      <tr className={cn("m-0 border-t p-0 even:bg-muted", className)} {...props} />
    ),
    th: ({ className, ...props }) => (
      <th
        className={cn(
          "border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
          className
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }) => (
      <td
        className={cn(
          "border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
          className
        )}
        {...props}
      />
    ),
    // Links
    a: ({ className, href, ...props }) => {
      const isExternal = href?.startsWith("http");
      if (isExternal) {
        return (
          <a
            className={cn("font-medium underline underline-offset-4", className)}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        );
      }
      return (
        <Link
          className={cn("font-medium underline underline-offset-4", className)}
          href={href || ""}
          {...props}
        />
      );
    },
    // Horizontal rule
    hr: ({ ...props }) => <hr className="my-4 md:my-8" {...props} />,
    // Export table components for JSX usage in MDX
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    ...components,
  };
}
