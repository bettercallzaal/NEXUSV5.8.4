import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
let openai: OpenAI;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: false, // Ensure this is only used server-side
  });
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
  // We'll handle this in the POST function
}

export async function POST(request: Request) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Check if OpenAI client was initialized successfully
    if (!openai) {
      console.error('OpenAI client not initialized');
      return NextResponse.json(
        { error: 'OpenAI client initialization failed' },
        { status: 500 }
      );
    }

    // Parse the request body
    let messages;
    try {
      const body = await request.json();
      messages = body.messages;
      console.log('Received request with messages:', JSON.stringify(messages));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error('Invalid messages array:', messages);
      return NextResponse.json(
        { error: 'Please provide a valid messages array' },
        { status: 400 }
      );
    }

    console.log('Calling OpenAI API with model: gpt-3.5-turbo');
    
    // Call OpenAI API
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 150,
      });

      // Extract the response
      const responseMessage = completion.choices[0].message?.content || 'No response from AI';
      console.log('Received response from OpenAI:', responseMessage.substring(0, 50) + '...');

      // Return the response
      return NextResponse.json({ message: responseMessage });
    } catch (apiError: any) {
      console.error('OpenAI API error:', apiError);
      
      // More detailed error logging
      if (apiError.response) {
        console.error('API response error:', {
          status: apiError.response.status,
          statusText: apiError.response.statusText,
          data: apiError.response.data,
          headers: apiError.response.headers
        });
        
        return NextResponse.json(
          { 
            error: 'AI service error', 
            details: apiError.response.data?.error?.message || apiError.message 
          },
          { status: apiError.response.status }
        );
      } else if (apiError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'Could not connect to OpenAI API' },
          { status: 503 }
        );
      } else {
        return NextResponse.json(
          { error: 'AI service error', details: apiError.message },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Unhandled error in chat API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}
