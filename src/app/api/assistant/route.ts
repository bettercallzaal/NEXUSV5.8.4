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
const linksFilePath = path.join(process.cwd(), 'src', 'data', 'links.json');

// Function to load links data
async function loadLinksData() {
  try {
    const data = await fs.promises.readFile(linksFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading links data:', error);
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
    const body = await request.json();
    const { action, query, category, subcategory } = body;
    
    // Load links data
    const linksData = await loadLinksData();
    const allLinks = extractAllLinks(linksData);
    
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
