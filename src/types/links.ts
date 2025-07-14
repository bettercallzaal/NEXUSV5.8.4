export interface Link {
  id?: string;
  title: string;
  url: string;
  description: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  isNew?: boolean;
  isOfficial?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subcategory {
  name: string;
  links: Link[];
}

export interface Category {
  name: string;
  subcategories: Subcategory[];
}

export interface LinksData {
  categories: Category[];
}

export interface SubcategoryWithCount {
  name: string;
  count: number;
}

export interface CategoryWithCount {
  name: string;
  count: number;
  subcategories: SubcategoryWithCount[];
}

export interface LinkSearchResult extends Link {
  category: string;
  subcategory: string;
  relevanceScore?: number;
}