import axios from 'axios';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  message: string;
  error?: string;
  links?: any[];
}

interface LinkSearchResult {
  title: string;
  url: string;
  description?: string;
  category: string;
  subcategory: string;
  tags?: string[];
}

/**
 * Service for handling chat interactions with OpenAI API
 */
export const chatService = {
  /**
   * Send a message to the OpenAI API and get a response
   * @param messages - Array of previous messages for context
   * @param query - The user's current query
   * @returns ChatResponse with message or error
   */
  async sendMessage(messages: ChatMessage[], query: string): Promise<ChatResponse> {
    try {
      // Check if this is a search query
      const isSearchQuery = this.isLinkSearchQuery(query);
      
      // If it looks like a search query, first try to find relevant links
      let relevantLinks: LinkSearchResult[] = [];
      let linksContext = '';
      
      if (isSearchQuery) {
        try {
          console.log('Detected search query, calling assistant API:', query);
          // Search for relevant links using the assistant API
          const searchResponse = await axios.post('/api/assistant', {
            action: 'search',
            query: query
          });
          
          console.log('Assistant API response:', JSON.stringify(searchResponse.data).substring(0, 200));
          
          if (searchResponse.data.results && Array.isArray(searchResponse.data.results) && searchResponse.data.results.length > 0) {
            relevantLinks = searchResponse.data.results.slice(0, 5);
            console.log(`Found ${relevantLinks.length} relevant links`);
            
            // Format links as context for the AI
            linksContext = 'Here are some relevant links from the Nexus database:\n\n' +
              relevantLinks.map((link, index) => {
                return `${index + 1}. ${link.title}\n` +
                       `   Category: ${link.category} > ${link.subcategory}\n` +
                       `   URL: ${link.url}\n` +
                       `   ${link.description ? 'Description: ' + link.description : ''}\n` +
                       `   ${link.tags && link.tags.length > 0 ? 'Tags: ' + link.tags.join(', ') : ''}`;
              }).join('\n\n');
            
            // If we have an AI-enhanced response, use it
            if (searchResponse.data.aiResponse) {
              console.log('Using AI-enhanced response from assistant API');
              return {
                message: searchResponse.data.aiResponse,
                links: relevantLinks
              };
            }
          } else {
            console.log('No links found for query:', query);
            linksContext = 'I searched the Nexus database but couldn\'t find any links matching your query.';
          }
        } catch (searchError: any) {
          console.error('Error searching for links:', searchError);
          if (searchError.response) {
            console.error('Assistant API error details:', {
              status: searchError.response.status,
              statusText: searchError.response.statusText,
              data: searchError.response.data
            });
          }
          // Continue with regular chat if search fails
        }
      }

      // Prepare the messages for the API call
      const apiMessages = [
        ...messages,
        { role: 'user', content: query }
      ];

      // Add a system message if one doesn't exist
      if (!apiMessages.some(msg => msg.role === 'system')) {
        apiMessages.unshift({
          role: 'system',
          content: 'You are NexusAI, a helpful assistant for the ZAO Nexus portal. ' +
            'You help users find links, understand categories, and navigate the platform. ' +
            'Keep responses concise and focused on helping users find information in the Nexus database. ' +
            'When users ask about specific topics, try to recommend relevant categories or subcategories to explore.'
        });
      }
      
      // If we have relevant links, add them as context
      if (linksContext) {
        apiMessages.splice(1, 0, {
          role: 'system',
          content: linksContext
        });
      }

      // Make the API call
      console.log('Calling chat API with messages:', JSON.stringify(apiMessages.map(m => ({ role: m.role, content: m.content.substring(0, 50) + '...' }))));
      
      try {
        const response = await axios.post('/api/chat', {
          messages: apiMessages
        });
        
        console.log('Chat API response received successfully');
        
        return {
          message: response.data.message,
          links: relevantLinks.length > 0 ? relevantLinks : undefined
        };
      } catch (chatError: any) {
        console.error('Error in chat API call:', chatError);
        
        // Extract detailed error information if available
        if (chatError.response) {
          console.error('Chat API error details:', {
            status: chatError.response.status,
            statusText: chatError.response.statusText,
            data: chatError.response.data
          });
          
          // If we have a specific error message from the API, use it
          if (chatError.response.data && chatError.response.data.error) {
            return {
              message: '',
              error: `AI error: ${chatError.response.data.error}${chatError.response.data.details ? ' - ' + chatError.response.data.details : ''}`
            };
          }
        }
        
        return {
          message: '',
          error: 'Failed to get response from AI. Please try again later.'
        };
      }
    } catch (error) {
      console.error('General error in chat service:', error);
      return {
        message: '',
        error: 'Failed to get response from AI. Please check your connection and try again.'
      };
    }
  },
  
  /**
   * Determine if a query is likely looking for links
   * @param query - The user query to analyze
   * @returns boolean indicating if this is likely a search query
   */
  isLinkSearchQuery(query: string): boolean {
    const searchTerms = [
      'find', 'search', 'looking for', 'where', 'how to', 'link', 'links',
      'show me', 'get', 'discord', 'website', 'resource', 'resources',
      'where can i', 'how do i', 'url', 'site', 'category', 'related to'
    ];
    
    const lowerQuery = query.toLowerCase();
    return searchTerms.some(term => lowerQuery.includes(term));
  },

  /**
   * Search for links related to a query
   * @param query - The search query
   * @returns ChatResponse with search results or error
   */
  async searchLinks(query: string): Promise<ChatResponse> {
    try {
      const response = await axios.post('/api/search', {
        query
      });

      return {
        message: response.data.results
      };
    } catch (error) {
      console.error('Error in link search:', error);
      return {
        message: '',
        error: 'Failed to search for links. Please try again later.'
      };
    }
  }
};

export type { ChatMessage, ChatResponse };
