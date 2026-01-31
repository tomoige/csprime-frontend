"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";

const ChatMarkdown = ({ content }: { content: string }) => {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Code blocks
          pre: ({ children }) => (
            <pre className="rounded-xl overflow-x-auto my-4 text-sm shadow-lg">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-[0.9em] border border-zinc-200 dark:border-zinc-700"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-6 mb-3 text-slate-800 dark:text-slate-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold mt-5 mb-2 text-slate-800 dark:text-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 text-slate-800 dark:text-slate-100">
              {children}
            </h3>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="my-2 leading-7 text-slate-700 dark:text-slate-300">
              {children}
            </p>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="my-3 space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 space-y-1 list-decimal list-inside text-slate-700 dark:text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-4 border-l-4 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 italic">
              {children}
            </blockquote>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-800 dark:text-slate-200 underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
            >
              {children}
            </a>
          ),
          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {children}
            </strong>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-4 border-slate-200 dark:border-slate-700" />
          ),
          // Tables (from GFM)
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold text-slate-800 dark:text-slate-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ChatMarkdown;
