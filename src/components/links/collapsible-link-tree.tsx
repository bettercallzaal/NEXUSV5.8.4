"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, ExternalLink, FolderOpen, Folder, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Category, Link, LinksData } from "@/types/links";
import { Search } from "@/components/ui/search";

interface CollapsibleLinkTreeProps {
  data: { categories: Category[] };
  className?: string;
  searchQuery?: string;
  onLinkClick?: (link: Link) => void;
}

export function CollapsibleLinkTree({ data, className, searchQuery = "", onLinkClick }: CollapsibleLinkTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  
  // Create a flattened array of all links for searching
  const allLinks = useMemo(() => {
    const links: Array<Link & { category: string; subcategory: string }> = [];
    
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
  
  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery) {
      return data.categories;
    }
    
    const query = searchQuery.toLowerCase();
    
    return data.categories
      .map((category) => {
        // Check if category name matches
        const categoryMatches = category.name.toLowerCase().includes(query);
        
        // Filter subcategories
        const filteredSubcategories = category.subcategories
          .map((subcategory) => {
            // Check if subcategory name matches
            const subcategoryMatches = subcategory.name.toLowerCase().includes(query);
            
            // Filter links
            const filteredLinks = subcategory.links.filter((link) => 
              link.title.toLowerCase().includes(query) || 
              (link.description && link.description.toLowerCase().includes(query)) ||
              (link.tags && link.tags.some(tag => tag.toLowerCase().includes(query)))
            );
            
            // Include subcategory if it matches or has matching links
            if (subcategoryMatches || filteredLinks.length > 0) {
              return {
                ...subcategory,
                links: filteredLinks,
              };
            }
            
            return null;
          })
          .filter(Boolean) as typeof category.subcategories;
        
        // Include category if it matches or has matching subcategories
        if (categoryMatches || filteredSubcategories.length > 0) {
          return {
            ...category,
            subcategories: filteredSubcategories,
          };
        }
        
        return null;
      })
      .filter(Boolean) as Category[];
  }, [data.categories, searchQuery]);

  // Toggle a single category
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Toggle a single subcategory
  const toggleSubcategory = (subcategoryKey: string) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryKey)) {
        newSet.delete(subcategoryKey);
      } else {
        newSet.add(subcategoryKey);
      }
      return newSet;
    });
  };

  // Expand all categories and subcategories
  const expandAll = () => {
    const allCategories = new Set<string>();
    const allSubcategories = new Set<string>();
    
    data.categories.forEach(category => {
      allCategories.add(category.name);
      category.subcategories.forEach(subcategory => {
        allSubcategories.add(`${category.name}:${subcategory.name}`);
      });
    });
    
    setExpandedCategories(allCategories);
    setExpandedSubcategories(allSubcategories);
  };

  // Collapse all categories and subcategories
  const collapseAll = () => {
    setExpandedCategories(new Set());
    setExpandedSubcategories(new Set());
  };

  // Count total links
  const totalLinks = useMemo(() => {
    return allLinks.length;
  }, [allLinks]);

  // Count filtered links
  const filteredLinksCount = useMemo(() => {
    let count = 0;
    filteredCategories.forEach(category => {
      category.subcategories.forEach(subcategory => {
        count += subcategory.links.length;
      });
    });
    return count;
  }, [filteredCategories]);

  return (
    <div className={cn("w-full space-y-4", className)}>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={expandAll}
            className="flex items-center"
          >
            <ChevronDown className="mr-1 h-4 w-4" />
            Expand All
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={collapseAll}
            className="flex items-center"
          >
            <ChevronUp className="mr-1 h-4 w-4" />
            Collapse All
          </Button>
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {searchQuery ? `Showing ${filteredLinksCount} of ${totalLinks} links` : `${totalLinks} links total`}
      </div>
      
      {filteredCategories.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No links found matching your search.</p>
        </div>
      ) : (
        <div className="border rounded-md">
          {filteredCategories.map((category) => {
            const isCategoryExpanded = expandedCategories.has(category.name);
            
            return (
              <div key={category.name} className="border-b last:border-b-0">
                <button
                  onClick={() => toggleCategory(category.name)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-3 text-left font-medium transition-colors",
                    isCategoryExpanded ? "bg-secondary/50" : "hover:bg-secondary/20"
                  )}
                >
                  <div className="flex items-center">
                    {isCategoryExpanded ? (
                      <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{category.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {category.subcategories.reduce(
                        (acc, subcategory) => acc + subcategory.links.length,
                        0
                      )}
                    </Badge>
                  </div>
                  {isCategoryExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {isCategoryExpanded && (
                  <div className="border-t">
                    {category.subcategories.map((subcategory) => {
                      const subcategoryKey = `${category.name}:${subcategory.name}`;
                      const isSubcategoryExpanded = expandedSubcategories.has(subcategoryKey);
                      
                      return (
                        <div key={subcategoryKey} className="border-b last:border-b-0">
                          <button
                            onClick={() => toggleSubcategory(subcategoryKey)}
                            className={cn(
                              "flex w-full items-center justify-between px-4 py-2 pl-8 text-left text-sm transition-colors",
                              isSubcategoryExpanded ? "bg-accent/30" : "hover:bg-accent/10"
                            )}
                          >
                            <div className="flex items-center">
                              {isSubcategoryExpanded ? (
                                <FolderOpen className="mr-2 h-3 w-3 text-muted-foreground" />
                              ) : (
                                <Folder className="mr-2 h-3 w-3 text-muted-foreground" />
                              )}
                              <span>{subcategory.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {subcategory.links.length}
                              </Badge>
                            </div>
                            {isSubcategoryExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </button>
                          
                          {isSubcategoryExpanded && (
                            <div className="border-t bg-background/50">
                              {subcategory.links.map((link, index) => (
                                <div
                                  key={link.url + index}
                                  onClick={() => onLinkClick ? onLinkClick(link) : window.open(link.url, "_blank", "noopener,noreferrer")}
                                  className="flex items-start px-4 py-2 pl-12 hover:bg-accent/20 group border-b last:border-b-0 cursor-pointer"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-medium text-sm group-hover:underline">
                                        {link.title}
                                      </h4>
                                      <ExternalLink className="h-3 w-3 opacity-70" />
                                    </div>
                                    {link.description && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {link.description}
                                      </p>
                                    )}
                                    {link.tags && link.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {link.tags.map((tag) => (
                                          <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
