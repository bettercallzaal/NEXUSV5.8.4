"use client";

import React from "react";
import { ExternalLink, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LinkCardProps {
  title: string;
  description: string;
  url: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  isNew?: boolean;
  className?: string;
  onClick?: () => void;
  onToggleExpand?: () => void;
  isExpanded?: boolean;
  children?: React.ReactNode;
}

export function LinkCard({ 
  title, 
  description, 
  url, 
  category, 
  subcategory, 
  tags, 
  isNew, 
  className, 
  onClick, 
  onToggleExpand,
  isExpanded,
  children 
}: LinkCardProps) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "group relative rounded-2xl bg-zinc-900/60 p-4 transition-all hover-lift focus-within:ring-2 focus-within:ring-accent/50",
          className
        )}
        onClick={onClick}
      >
        <div className="mb-1 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <h3 className="line-clamp-1 font-heading text-lg font-semibold text-foreground">
              {title}
            </h3>
            {isNew && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                New
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={copyToClipboard}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                  aria-label="Copy link URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {copied ? "Copied!" : "Copy URL"}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-accent"
                  aria-label="Open link in new tab"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="top">Open in new tab</TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        <p className="line-clamp-2 text-sm text-zinc-400">
          {description}
        </p>
        
        {tags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {(category || subcategory) && (
          <div className="mt-2 flex items-center text-xs text-muted-foreground">
            {category && (
              <>
                <span>{category}</span>
                {subcategory && <span className="mx-1">•</span>}
              </>
            )}
            {subcategory && <span>{subcategory}</span>}
          </div>
        )}
        
        {children}
      </div>
    </TooltipProvider>
  );
}
