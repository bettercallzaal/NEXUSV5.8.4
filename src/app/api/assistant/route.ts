import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client
let openai: OpenAI;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: false,
  });
  console.log('OpenAI client initialized successfully for assistant API');
} catch (error) {
  console.error('Failed to initialize OpenAI client for assistant API:', error);
}

// Path to the links data file
// Try both links.json and links-updated.json to ensure we find the correct file
const linksFilePath = path.join(process.cwd(), 'src', 'data', 'links.json');
const linksUpdatedFilePath = path.join(process.cwd(), 'src', 'data', 'links-updated.json');

// Log the paths we're checking
console.log('Checking for links files at:');
console.log(' - ' + linksFilePath);
console.log(' - ' + linksUpdatedFilePath);

// Function to load links data
async function loadLinksData() {
  // Try the primary links.json file first
  try {
    // Check if file exists first
    if (fs.existsSync(linksFilePath)) {
      console.log('Found links.json file, attempting to read');
      const data = await fs.promises.readFile(linksFilePath, 'utf8');
      try {
        const parsedData = JSON.parse(data);
        if (parsedData && parsedData.categories && parsedData.categories.length > 0) {
          console.log(`Successfully loaded links.json with ${parsedData.categories.length} categories`);
          return parsedData;
        } else {
          console.warn('links.json file exists but has no categories or invalid format');
        }
      } catch (parseError) {
        console.error('Error parsing links.json data:', parseError);
      }
    } else {
      console.warn(`Primary links file not found at path: ${linksFilePath}`);
    }
    
    // If we get here, try the links-updated.json file as fallback
    if (fs.existsSync(linksUpdatedFilePath)) {
      console.log('Trying links-updated.json as fallback');
      const data = await fs.promises.readFile(linksUpdatedFilePath, 'utf8');
      try {
        const parsedData = JSON.parse(data);
        if (parsedData && parsedData.categories && parsedData.categories.length > 0) {
          console.log(`Successfully loaded links-updated.json with ${parsedData.categories.length} categories`);
          return parsedData;
        } else {
          console.warn('links-updated.json file exists but has no categories or invalid format');
        }
      } catch (parseError) {
        console.error('Error parsing links-updated.json data:', parseError);
      }
    } else {
      console.error(`Fallback links file not found at path: ${linksUpdatedFilePath}`);
    }
    
    // If we get here, both files failed
    console.error('Could not load links data from any source');
    return { categories: [] };
  } catch (error) {
    console.error('Unexpected error loading links data:', error);
    return { categories: [] };
  }
}

// Function to extract all links from the nested structure
function extractAllLinks(data: any) {
  const allLinks: any[] = [];
  
  if (data.categories && Array.isArray(data.categories)) {
    data.categories.forEach((category: any) => {
      if (category.subcategories && Array.isArray(category.subcategories)) {
        category.subcategories.forEach((subcategory: any) => {
          if (subcategory.links && Array.isArray(subcategory.links)) {
            subcategory.links.forEach((link: any) => {
              allLinks.push({
                ...link,
                category: category.name,
                subcategory: subcategory.name
              });
            });
          }
        });
      }
    });
  }
  
  return allLinks;
}

// Function to search links by query
function searchLinks(links: any[], query: string) {
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
  
  if (searchTerms.length === 0) return [];
  
  return links.filter(link => {
    const searchableText = `${link.title} ${link.description || ''} ${link.category} ${link.subcategory} ${(link.tags || []).join(' ')}`.toLowerCase();
    
    return searchTerms.some(term => searchableText.includes(term));
  });
}

// Function to get links by category
function getLinksByCategory(links: any[], category: string) {
  return links.filter(link => 
    link.category.toLowerCase() === category.toLowerCase()
  );
}

// Function to get links by subcategory
function getLinksBySubcategory(links: any[], subcategory: string) {
  return links.filter(link => 
    link.subcategory.toLowerCase() === subcategory.toLowerCase()
  );
}

// Function to get all categories and subcategories
function getCategoriesAndSubcategories(data: any) {
  const result: { categories: string[], subcategories: { [key: string]: string[] } } = {
    categories: [],
    subcategories: {}
  };
  
  if (data.categories && Array.isArray(data.categories)) {
    data.categories.forEach((category: any) => {
      result.categories.push(category.name);
      result.subcategories[category.name] = [];
      
      if (category.subcategories && Array.isArray(category.subcategories)) {
        category.subcategories.forEach((subcategory: any) => {
          result.subcategories[category.name].push(subcategory.name);
        });
      }
    });
  }
  
  return result;
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    const { action, query, category, subcategory } = body;
    console.log(`Assistant API called with action: ${action}, query: ${query || 'none'}`);
    
    // Validate action
    if (!action) {
      console.error('No action specified in request');
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }
    
    // Load links data
    const linksData = await loadLinksData();
    if (!linksData.categories || linksData.categories.length === 0) {
      console.warn('No categories found in links data');
    }
    
    const allLinks = extractAllLinks(linksData);
    console.log(`Extracted ${allLinks.length} total links from data`);
    
    
    // Process based on action
    let result: any[] | { categories: string[], subcategories: { [key: string]: string[] } };
    
    switch (action) {
      case 'search':
        if (!query) {
          return NextResponse.json(
            { error: 'Search query is required' },
            { status: 400 }
          );
        }
        result = searchLinks(allLinks, query);
        break;
        
      case 'getByCategory':
        if (!category) {
          return NextResponse.json(
            { error: 'Category is required' },
            { status: 400 }
          );
        }
        result = getLinksByCategory(allLinks, category);
        break;
        
      case 'getBySubcategory':
        if (!subcategory) {
          return NextResponse.json(
            { error: 'Subcategory is required' },
            { status: 400 }
          );
        }
        result = getLinksBySubcategory(allLinks, subcategory);
        break;
        
      case 'getCategories':
        result = getCategoriesAndSubcategories(linksData);
        break;
        
      case 'getAll':
        result = allLinks;
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    // Use OpenAI to enhance the response if available
    if (openai && process.env.OPENAI_API_KEY && action === 'search' && Array.isArray(result) && result.length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are NexusAI, a helpful assistant for the ZAO Nexus portal. 
              Your task is to help users find relevant links and information.
              When responding about search results, be concise but informative.
              Format your response in a way that's easy to read and understand.`
            },
            {
              role: 'user',
              content: `User query: "${query}"
              
              Search results:
              ${JSON.stringify(Array.isArray(result) ? result.slice(0, 5) : [])}
              
              Please provide a helpful response to the user's query based on these search results.
              Include the most relevant links and explain why they might be useful.`
            }
          ],
          temperature: 0.7,
          max_tokens: 300,
        });

        const aiResponse = completion.choices[0].message?.content || '';

        return NextResponse.json({
          results: result,
          aiResponse
        });
      } catch (aiError) {
        console.error('Error using OpenAI for response enhancement:', aiError);
        return NextResponse.json({ results: result });
      }
    }
    
    return NextResponse.json({ results: result });
  } catch (error: any) {
    console.error('Error in assistant API:', error);
    
    return NextResponse.json(
      { error: 'An error occurred processing your request.' },
      { status: 500 }
    );
  }
}
