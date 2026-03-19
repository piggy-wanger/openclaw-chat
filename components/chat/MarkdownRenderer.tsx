"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

// 代码块复制按钮组件
function CopyButton({ getCode }: { getCode: () => string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      const code = getCode();
      await navigator.clipboard.writeText(code);
      setCopied(true);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [getCode]);

  // cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors"
      aria-label={copied ? "已复制" : "复制代码"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-foreground" />
      )}
    </button>
  );
}

// 代码块组件
function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  // 从 DOM 获取纯文本代码内容
  const getCodeText = useCallback(() => {
    return preRef.current?.textContent || "";
  }, []);

  // 判断是否是代码块（有语言标记）
  const isCodeBlock = !!language;

  if (!isCodeBlock) {
    // 行内代码 - 简单检查是否是多行
    const childText = typeof children === "string" ? children : "";
    if (!childText.includes("\n")) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-muted/50 text-foreground text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
  }

  // 代码块
  return (
    <div className="relative group my-3">
      {language && (
        <div className="absolute top-0 left-0 px-3 py-1 text-xs text-muted-foreground bg-muted rounded-t-lg border-b border-border font-mono">
          {language}
        </div>
      )}
      <pre
        ref={preRef}
        className={cn(
          "overflow-x-auto rounded-lg bg-card p-4 text-sm",
          language && "pt-8"
        )}
      >
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
      <CopyButton getCode={getCodeText} />
    </div>
  );
}

// 链接组件
function Link({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
      {...props}
    >
      {children}
    </a>
  );
}

// 表格组件
function Table({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto my-3">
      <table
        className="min-w-full border-collapse border border-border text-sm"
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

function Th({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className="border border-border px-3 py-2 bg-muted text-left font-medium"
      {...props}
    >
      {children}
    </th>
  );
}

function Td({ children, ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className="border border-border px-3 py-2" {...props}>
      {children}
    </td>
  );
}

// 主渲染组件
function MarkdownRendererInner({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code: CodeBlock,
          a: Link,
          table: Table,
          th: Th,
          td: Td,
          // 段落样式
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          // 标题样式
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h3>
          ),
          // 列表样式
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
          ),
          // 引用样式
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-4 my-3 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          // 水平线
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownRenderer = memo(MarkdownRendererInner);
