"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownProps {
  children: string;
}

/**
 * Renders assistant markdown safely. `react-markdown` escapes raw HTML by
 * default; we keep `skipHtml` on as a belt-and-braces guard. GFM plugin
 * adds tables, task lists, and fenced code — enough for CRM outputs
 * without YOLO-ing the whole markdown surface.
 *
 * Memoised per-message so a streaming message only re-renders as new
 * chunks arrive (not every keystroke elsewhere on the page).
 */
export const Markdown = memo(function Markdown({ children }: MarkdownProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={markdownComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});

const markdownComponents: Components = {
  a({ children, href }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  code({ className, children, ...props }) {
    const isBlock = /language-\w+/.test(className ?? "");
    if (isBlock) {
      return (
        <pre className="bg-muted my-2 overflow-x-auto rounded-md border p-3 text-xs">
          <code className={className}>{children}</code>
        </pre>
      );
    }
    return (
      <code
        className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  },
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border-border border-b px-2 py-1 text-left font-semibold">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border-border/60 border-b px-2 py-1">{children}</td>;
  },
};
