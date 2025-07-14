"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import Fuse from "fuse.js";
import { ExternalLink, Grid2X2, List as ListIcon, Loader2, Share, Copy, Clock, CheckCircle, AlignJustify, FolderTree, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkCard } from "@/components/links/link-card";
import { LinkRow } from "@/components/links/link-row";
import { Badge } from "@/components/ui/badge";
import { CollapsibleLinkTree } from "@/components/links/collapsible-link-tree";

import { cn } from "@/lib/utils";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { FilterSheet } from "@/components/links/filter-sheet";
import { CategoryScroll } from "@/components/links/category-scroll";
import { EnhancedSearch } from "@/components/links/enhanced-search";
import { toast } from "sonner";

// Import types from our types file
import { Link, Category, LinksData, CategoryWithCount, SubcategoryWithCount } from "@/types/links";

// Define interface for tag with count
interface TagWithCount {
  name: string;
  count: number;
}

interface Data {
  categories: Category[];
}

interface MobileOptimizedLinkListProps {
  data: Data;
  onLinkClick?: (link: Link) => void;
  logEvent?: (eventName: string, eventData?: Record<string, any>) => void;
}

type ViewMode = "grid" | "list" | "compact" | "tree";

type FlattenedLink = Link & {
  category: string;
  subcategory: string;
};

type SortOption = "newest" | "oldest" | "popular" | "az";

export function MobileOptimizedLinkList({ 
  data, 
  onLinkClick,
  logEvent = () => {}
}: MobileOptimizedLinkListProps) {
  // State for view mode (grid, list, compact, tree)
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  
  // State for search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [newOnly, setNewOnly] = useState(false);
  const [officialOnly, setOfficialOnly] = useState(false);
  
  // State for expanded items in list view
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Refs for UI interactions
  const containerRef = useRef<HTMLDivElement>(null);
  const [isContainerFocused, setIsContainerFocused] = useState(false);
  
  // Flatten the nested data structure for easier filtering and searching
  const allLinks = useMemo(() => {
    const links: FlattenedLink[] = [];
    
    data.categories.forEach((category) => {
      category.subcategories.forEach((subcategory) => {
        subcategory.links.forEach((link) => {
          links.push({
            ...link,
            category: category.name,
            subcategory: subcategory.name,
          });
        });
      });
    });
    
    return links;
  }, [data]);
  
  // Calculate category counts for filters
  const categoryCounts = useMemo(() => {
    const counts: Record<string, CategoryWithCount> = {};
    
    data.categories.forEach((category) => {
      const subcategoryCounts: SubcategoryWithCount[] = [];
      let totalCount = 0;
      
      category.subcategories.forEach((sub) => {
        const count = sub.links.length;
        totalCount += count;
        
        subcategoryCounts.push({
          name: sub.name,
          count
        });
      });
      
      counts[category.name] = {
        name: category.name,
        count: totalCount,
        subcategories: subcategoryCounts
      };
    });
    
    return counts;
  }, [data]);
  
  // Extract all unique tags with counts
  const allTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    
    allLinks.forEach((link) => {
      if (link.tags && link.tags.length > 0) {
        link.tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);
  }, [allLinks]);
  
  // Setup search with Fuse.js
  const fuse = useMemo(() => {
    return new Fuse(allLinks, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'description', weight: 1 },
        { name: 'category', weight: 0.5 },
        { name: 'subcategory', weight: 0.5 },
        { name: 'tags', weight: 0.5 }
      ],
      threshold: 0.3,
      includeScore: true
    });
  }, [allLinks]);
  
  // Apply filters and search to links
  const filteredLinks = useMemo(() => {
    let result = [...allLinks];
    
    // Apply category filter
    if (selectedCategory) {
      result = result.filter(link => link.category === selectedCategory);
      
      // Apply subcategory filter if a category is selected
      if (selectedSubcategory) {
        result = result.filter(link => link.subcategory === selectedSubcategory);
      }
    }
    
    // Apply tag filters
    if (selectedTags.length > 0) {
      result = result.filter(link => {
        if (!link.tags || link.tags.length === 0) return false;
        return selectedTags.every(tag => link.tags!.includes(tag));
      });
    }
    
    // Apply new only filter
    if (newOnly) {
      result = result.filter(link => link.isNew);
    }
    
    // Apply official only filter
    if (officialOnly) {
      result = result.filter(link => link.isOfficial);
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery);
      result = searchResults.map(res => res.item);
    }
    
    // Apply sorting
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          return 0;
        });
        break;
      case "oldest":
        result.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          return 0;
        });
        break;
      case "popular":
        // Placeholder for popularity sorting - would need a popularity metric
        result.sort((a, b) => 0); // No-op sort as placeholder
        break;
      case "az":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    
    return result;
  }, [allLinks, selectedCategory, selectedSubcategory, selectedTags, newOnly, officialOnly, searchQuery, fuse, sortBy]);
  
  // Handle search input
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    logEvent("search", { query });
  }, [logEvent]);
  
  // Handle category selection
  const handleCategorySelect = useCallback((category: string) => {
    if (category === selectedCategory) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    } else {
      setSelectedCategory(category);
      setSelectedSubcategory(null);
    }
    logEvent("filter_category", { category });
  }, [selectedCategory, logEvent]);
  
  // Handle subcategory selection
  const handleSubcategorySelect = useCallback((subcategory: string) => {
    if (subcategory === selectedSubcategory) {
      setSelectedSubcategory(null);
    } else {
      setSelectedSubcategory(subcategory);
    }
    logEvent("filter_subcategory", { subcategory });
  }, [selectedSubcategory, logEvent]);
  
  // Handle tag selection
  const handleTagSelect = useCallback((tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
    logEvent("filter_tag", { tag });
  }, [logEvent]);
  
  // Handle sort change
  const handleSortChange = useCallback((sort: string) => {
    setSortBy(sort as SortOption);
    logEvent("sort_changed", { sort });
  }, [logEvent]);
  
  // Handle new only filter
  const handleNewOnlyChange = useCallback((checked: boolean) => {
    setNewOnly(checked);
    logEvent("filter_new_only", { checked });
  }, [logEvent]);
  
  // Handle official only filter
  const handleOfficialOnlyChange = useCallback((checked: boolean) => {
    setOfficialOnly(checked);
    logEvent("filter_official_only", { checked });
  }, [logEvent]);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedTags([]);
    setNewOnly(false);
    setOfficialOnly(false);
    setSortBy("newest");
    setSearchQuery("");
    logEvent("clear_filters");
  }, [logEvent]);
  
  // Handle link click
  const handleLinkClick = useCallback((link: Link) => {
    if (onLinkClick) {
      onLinkClick(link);
    } else {
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
    logEvent("link_clicked", { title: link.title, url: link.url });
  }, [onLinkClick, logEvent]);
  
  // Handle share link
  const handleShareLink = useCallback((e: React.MouseEvent, link: Link) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (navigator.share) {
      navigator.share({
        title: link.title,
        text: link.description,
        url: link.url
      }).catch(() => {
        navigator.clipboard.writeText(link.url);
        toast("Link copied to clipboard", {
          icon: <Copy className="h-4 w-4" />
        });
      });
    } else {
      navigator.clipboard.writeText(link.url);
      toast("Link copied to clipboard", {
        icon: <Copy className="h-4 w-4" />
      });
    }
    
    logEvent("share_link", { title: link.title });
  }, [logEvent]);
  
  // Handle copy link
  const handleCopyLink = useCallback((e: React.MouseEvent, link: Link) => {
    e.stopPropagation();
    e.preventDefault();
    
    navigator.clipboard.writeText(link.url);
    toast("Link copied to clipboard", {
      icon: <Copy className="h-4 w-4" />
    });
    
    logEvent("copy_link", { title: link.title });
  }, [logEvent]);
  
  // Handle toggle expand for list items
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);
  
  // Handle container focus for keyboard navigation
  const handleContainerFocus = useCallback(() => {
    setIsContainerFocused(true);
  }, []);
  
  const handleContainerBlur = useCallback(() => {
    setIsContainerFocused(false);
  }, []);
  
  // Render compact view
  const renderCompactView = useCallback(() => {
    return (
      <div className="space-y-2">
        {filteredLinks.map((link, index) => (
          <div 
            key={link.id || index}
            className="p-2 bg-secondary/20 rounded-md hover:bg-secondary/40 transition-colors"
            role="button"
            tabIndex={0}
            onClick={() => handleLinkClick(link)}
            onKeyDown={(e) => e.key === "Enter" && handleLinkClick(link)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-sm">{link.title}</h3>
                <p className="text-xs text-muted-foreground truncate">{link.description}</p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [filteredLinks, handleLinkClick]);
  
  // Render tree view
  const renderTreeView = useCallback(() => {
    return (
      <CollapsibleLinkTree 
        data={data} 
        onLinkClick={handleLinkClick} 
        searchQuery={searchQuery}
      />
    );
  }, [data, handleLinkClick, searchQuery]);
  
  return (
    <TooltipProvider>
      <div className="w-full">
        {/* Sticky search and filter bar */}
        <div className="sticky top-16 z-10 bg-background/95 backdrop-blur-sm py-2 border-b">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <EnhancedSearch 
                onSearch={handleSearch}
                searchResults={filteredLinks.map(link => ({
                  id: link.id,
                  title: link.title,
                  description: link.description,
                  url: link.url,
                  category: link.category,
                  subcategory: link.subcategory
                }))}
                placeholder="Search links..." 
                className="w-full sm:w-[300px]"
                value={searchQuery}
                onResultClick={handleLinkClick}
              />
              
              <div className="flex flex-wrap items-center gap-2">
                <FilterSheet
                  categoryCounts={categoryCounts}
                  allTags={allTags}
                  selectedCategory={selectedCategory}
                  selectedSubcategory={selectedSubcategory}
                  selectedTags={selectedTags}
                  onCategorySelect={handleCategorySelect}
                  onSubcategorySelect={handleSubcategorySelect}
                  onTagSelect={handleTagSelect}
                  onSortChange={handleSortChange}
                  onNewOnlyChange={handleNewOnlyChange}
                  onOfficialOnlyChange={handleOfficialOnlyChange}
                  onClearFilters={clearFilters}
                  sortBy={sortBy}
                  newOnly={newOnly}
                  officialOnly={officialOnly}
                />
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "grid" ? "default" : "outline"}
                        size="icon"
                        onClick={() => {
                          setViewMode("grid");
                          logEvent("view_mode_changed", { mode: "grid" });
                        }}
                      >
                        <Grid2X2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Grid View</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="icon"
                        onClick={() => {
                          setViewMode("list");
                          logEvent("view_mode_changed", { mode: "list" });
                        }}
                      >
                        <ListIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>List View</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "compact" ? "default" : "outline"}
                        size="icon"
                        onClick={() => {
                          setViewMode("compact");
                          logEvent("view_mode_changed", { mode: "compact" });
                        }}
                      >
                        <AlignJustify className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Compact View</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "tree" ? "default" : "outline"}
                        size="icon"
                        onClick={() => {
                          setViewMode("tree");
                          logEvent("view_mode_changed", { mode: "tree" });
                        }}
                      >
                        <FolderTree className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Tree View</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
          
          {/* Horizontal category navigation */}
          <CategoryScroll
            categoryCounts={categoryCounts}
            selectedCategory={selectedCategory}
            selectedSubcategory={selectedSubcategory}
            onCategorySelect={handleCategorySelect}
            onSubcategorySelect={handleSubcategorySelect}
          />
        </div>
        
        {/* Content area */}
        {filteredLinks.length === 0 && searchQuery.trim() !== "" ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
            <h3 className="font-heading text-xl font-medium">No links found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters to find what you're looking for.
            </p>
            <Button onClick={clearFilters} variant="outline">
              Clear all filters
            </Button>
          </div>
        ) : viewMode === "tree" ? (
          renderTreeView()
        ) : viewMode === "compact" ? (
          renderCompactView()
        ) : (
          <div 
            ref={containerRef}
            className="w-full rounded-lg bg-card links-container overflow-visible" 
            tabIndex={-1} // Make the container focusable
            id="links-container"
            role="region"
            aria-label="Links collection"
            onFocus={handleContainerFocus}
            onBlur={handleContainerBlur}
          >
            <div className="p-4 pb-20">
              {filteredLinks.map((link, index) => (
                <div 
                  key={link.id || index}
                  className="mb-4 p-2 bg-secondary/50 rounded-md hover:bg-secondary/80 transition-colors"
                  role="listitem"
                >
                  {viewMode === "grid" 
                    ? (
                      <div className="p-3">
                        <LinkCard 
                          title={link.title}
                          description={link.description}
                          url={link.url}
                          category={link.category}
                          subcategory={link.subcategory}
                          tags={link.tags}
                          isNew={link.isNew}
                          onClick={() => handleLinkClick(link)}
                          className="h-full transition-all border border-border/40 rounded-md overflow-hidden"
                        />
                      </div>
                    ) : (
                      <div className="px-3 py-2">
                        <LinkRow 
                          title={link.title}
                          description={link.description}
                          url={link.url}
                          category={link.category}
                          subcategory={link.subcategory}
                          tags={link.tags}
                          isNew={link.isNew}
                          className="border border-border/40 rounded-md p-3 hover:bg-accent/30 transition-colors"
                          isExpanded={link.id ? expandedItems.has(link.id) : false}
                          onToggleExpand={() => link.id && handleToggleExpand(link.id)}
                        >
                          {link.id && expandedItems.has(link.id) && (
                            <div className="mt-3 animate-fade-in flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e: React.MouseEvent) => handleShareLink(e, link)}
                              >
                                <Share className="mr-1 h-3 w-3" /> Share
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e: React.MouseEvent) => handleCopyLink(e, link)}
                              >
                                <Copy className="mr-1 h-3 w-3" /> Copy URL
                              </Button>
                            </div>
                          )}
                        </LinkRow>
                      </div>
                    )
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
