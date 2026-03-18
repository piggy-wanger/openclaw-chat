"use client";

import { useState, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type CollapsibleProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

type CollapsibleTriggerProps = {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
  onClick?: () => void;
};

type CollapsibleContentProps = {
  children: ReactNode;
  className?: string;
};

// Context for collapsible state
import { createContext, useContext } from "react";

type CollapsibleContextType = {
  isOpen: boolean;
  toggle: () => void;
};

const CollapsibleContext = createContext<CollapsibleContextType | null>(null);

function useCollapsible() {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error("useCollapsible must be used within a Collapsible");
  }
  return context;
}

function Collapsible({ children, defaultOpen = false, className }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <CollapsibleContext.Provider value={{ isOpen, toggle }}>
      <div className={cn("w-full", className)}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

function CollapsibleTrigger({ children, className, onClick }: CollapsibleTriggerProps) {
  const { isOpen, toggle } = useCollapsible();

  const handleClick = () => {
    toggle();
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn("w-full text-left", className)}
      aria-expanded={isOpen}
    >
      {children}
    </button>
  );
}

function CollapsibleContent({ children, className }: CollapsibleContentProps) {
  const { isOpen } = useCollapsible();

  if (!isOpen) return null;

  return <div className={className}>{children}</div>;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent, useCollapsible };
