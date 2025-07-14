import fs from 'fs';
import path from 'path';
import { parse as csvParse } from 'csv-parse/sync';

// Define types locally to avoid import issues in admin scripts
interface Link {
  id: string;
  title: string;
  url: string;
  description: string;
  tags?: string[];
  isNew?: boolean;
  isOfficial?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface Subcategory {
  name: string;
  links: Link[];
}

interface Category {
  name: string;
  subcategories: Subcategory[];
}

interface LinksData {
  categories: Category[];
}

interface BatchImportOptions {
  filePath: string;
  fileType?: 'json' | 'csv';
  generateTags?: boolean;
  dryRun?: boolean;
  dataset?: string;
}

interface BatchImportResult {
  totalProcessed: number;
  added: number;
  updated: number;
  skipped: number;
  errors: Array<{
    link: any;
    error: string;
  }>;
}

/**
 * Batch import links from a JSON or CSV file
 * @param options Import options including file path, type, and processing flags
 */
export async function batchImportLinks(options: BatchImportOptions): Promise<BatchImportResult> {
  const { filePath, fileType = 'json', generateTags = false, dryRun = false, dataset = 'default' } = options;
  
  // Initialize result
  const result: BatchImportResult = {
    totalProcessed: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };
  
  try {
    // Determine the data path based on dataset
    const dataPath = path.join(process.cwd(), `src/data/links-data${dataset !== 'default' ? `-${dataset}` : ''}.json`);
    
    // Read source data
    let sourceLinks: any[] = [];
    
    if (fileType === 'csv') {
      // Parse CSV file
      const csvContent = fs.readFileSync(filePath, 'utf8');
      const records = csvParse(csvContent, {
        columns: true,
        skip_empty_lines: true
      });
      sourceLinks = records;
    } else {
      // Parse JSON file
      const jsonContent = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(jsonContent);
      
      // Handle different JSON formats
      if (Array.isArray(jsonData)) {
        sourceLinks = jsonData;
      } else if (jsonData.links && Array.isArray(jsonData.links)) {
        sourceLinks = jsonData.links;
      } else if (jsonData.categories && Array.isArray(jsonData.categories)) {
        // Extract links from categories structure
        sourceLinks = [];
        for (const category of jsonData.categories) {
          if (category.subcategories && Array.isArray(category.subcategories)) {
            for (const subcategory of category.subcategories) {
              if (subcategory.links && Array.isArray(subcategory.links)) {
                for (const link of subcategory.links) {
                  sourceLinks.push({
                    ...link,
                    category: category.name,
                    subcategory: subcategory.name
                  });
                }
              }
            }
          }
        }
      } else {
        throw new Error('Unsupported JSON format');
      }
    }
    
    // Read target data
    let targetData: LinksData;
    try {
      if (fs.existsSync(dataPath)) {
        targetData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      } else {
        targetData = { categories: [] };
      }
    } catch (err) {
      console.error(`Error reading target file: ${dataPath}`);
      console.error(err);
      targetData = { categories: [] };
    }
    
    // Process each link
    for (const sourceLink of sourceLinks) {
      result.totalProcessed++;
      
      try {
        // Validate required fields
        if (!sourceLink.url) {
          throw new Error('Missing URL');
        }
        if (!sourceLink.title) {
          throw new Error('Missing title');
        }
        
        // Normalize category and subcategory
        const categoryName = sourceLink.category || 'Uncategorized';
        const subcategoryName = sourceLink.subcategory || 'General';
        
        // Find or create category
        let category = targetData.categories.find((c: Category) => 
          c.name.toLowerCase() === categoryName.toLowerCase());
        
        if (!category) {
          category = {
            name: categoryName,
            subcategories: []
          };
          targetData.categories.push(category);
        }
        
        // Find or create subcategory
        let subcategory = category.subcategories.find((s: Subcategory) => 
          s.name.toLowerCase() === subcategoryName.toLowerCase());
        
        if (!subcategory) {
          subcategory = {
            name: subcategoryName,
            links: []
          };
          category.subcategories.push(subcategory);
        }
        
        // Check if link already exists
        const existingLinkIndex = subcategory.links.findIndex((l: Link) => 
          l.url.toLowerCase() === sourceLink.url.toLowerCase());
        
        // Generate tags if needed
        let tags = sourceLink.tags || [];
        if (generateTags && (!tags || tags.length === 0)) {
          tags = generateTagsFromTitle(sourceLink.title);
        }
        
        if (existingLinkIndex >= 0) {
          // Update existing link
          if (!dryRun) {
            const existingLink = subcategory.links[existingLinkIndex];
            subcategory.links[existingLinkIndex] = {
              ...existingLink,
              title: sourceLink.title || existingLink.title,
              description: sourceLink.description || existingLink.description,
              tags: tags.length > 0 ? tags : existingLink.tags,
              isNew: sourceLink.isNew !== undefined ? sourceLink.isNew : existingLink.isNew,
              isOfficial: sourceLink.isOfficial !== undefined ? sourceLink.isOfficial : existingLink.isOfficial,
              updatedAt: new Date().toISOString()
            };
          }
          result.updated++;
        } else {
          // Add new link
          if (!dryRun) {
            const newLink: Link = {
              id: sourceLink.id || generateLinkId(),
              title: sourceLink.title,
              url: sourceLink.url,
              description: sourceLink.description || '',
              tags: tags,
              isNew: sourceLink.isNew !== undefined ? sourceLink.isNew : true,
              isOfficial: sourceLink.isOfficial !== undefined ? sourceLink.isOfficial : false,
              createdAt: sourceLink.createdAt || new Date().toISOString()
            };
            subcategory.links.push(newLink);
          }
          result.added++;
        }
      } catch (error: any) {
        result.skipped++;
        result.errors.push({
          link: sourceLink,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    // Save changes if not in dry run mode
    if (!dryRun && (result.added > 0 || result.updated > 0)) {
      // Ensure the directory exists
      const dir = path.dirname(dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(dataPath, JSON.stringify(targetData, null, 2));
      console.log(`Updated links data saved to ${dataPath}`);
    }
    
    return result;
  } catch (err: any) {
    console.error('Error in batch import process:');
    console.error(err);
    
    return {
      totalProcessed: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: [{
        link: { url: options.filePath },
        error: err.message || 'Unknown error'
      }]
    };
  }
}

/**
 * Generate tags from a title
 */
function generateTagsFromTitle(title: string): string[] {
  // Simple implementation - extract keywords from title
  // Remove common words and punctuation
  const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as'];
  
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/) // Split by whitespace
    .filter(word => word.length > 2 && !stopWords.includes(word)) // Remove stop words and short words
    .slice(0, 5); // Limit to 5 tags
}

/**
 * Generate a unique ID for a link
 */
function generateLinkId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
