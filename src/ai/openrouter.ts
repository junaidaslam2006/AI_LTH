// Custom OpenRouter API client for direct API calls
export interface OpenRouterConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: OpenRouterConfig) {
    // Debug environment variables
    console.log('[OpenRouter] DEBUG - All env keys containing ROUTER:', Object.keys(process.env).filter(k => k.includes('ROUTER')));
    console.log('[OpenRouter] DEBUG - process.env.OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'EXISTS' : 'UNDEFINED');
    
    this.apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://openrouter.ai/api/v1';

    console.log('[OpenRouter] Initializing...');
    console.log('[OpenRouter] API key found:', this.apiKey ? `${this.apiKey.substring(0, 15)}...` : 'MISSING');

    if (!this.apiKey) {
      console.warn('[OpenRouter] ⚠️ No API key found - AI features will be limited');
      console.warn('[OpenRouter] Add OPENROUTER_API_KEY to .env.local for full functionality');
    }
  }

  async generate(request: {
    prompt: any;
    system?: string;
    model?: string;
    output?: any;
  }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your environment variables.');
    }
    
    // Default to meta-llama free model (tested and working)
    const { prompt, system, model = 'meta-llama/llama-3.2-3b-instruct:free' } = request;
    
    // Convert prompt parts to OpenRouter format
    const messages = [];
    
    if (system) {
      messages.push({
        role: 'system',
        content: system
      });
    }

    // Handle different prompt formats
    if (Array.isArray(prompt)) {
      // Handle multimodal prompts
      const content = [];
      for (const part of prompt) {
        if (part.text) {
          content.push({
            type: 'text',
            text: part.text
          });
        } else if (part.inlineData) {
          content.push({
            type: 'image_url',
            image_url: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
            }
          });
        }
      }
      messages.push({
        role: 'user',
        content: content.length === 1 && content[0].type === 'text' ? content[0].text : content
      });
    } else if (typeof prompt === 'string') {
      messages.push({
        role: 'user',
        content: prompt
      });
    }

    console.log('[OpenRouter] Making request with model:', model);
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:9002',
        'X-Title': 'AI-LTH Health Assistant'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[OpenRouter] API Error Response:', error);
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('[OpenRouter] API Response received:', data.choices?.[0]?.message?.content?.substring(0, 100) + '...');
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenRouter API');
    }

    const responseText = data.choices[0].message.content;

    return {
      text: responseText,
      output: request.output ? this.tryParseJSON(responseText) : undefined
    };
  }

  private tryParseJSON(text: string) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

// Create a singleton instance that loads API key from environment
let _openRouterClient: OpenRouterClient | null = null;

function getOpenRouterClient(): OpenRouterClient {
  // Always recreate to get fresh env vars during development
  console.log('[OpenRouter] Creating client instance (API key from env)');
  const apiKey = process.env.OPENROUTER_API_KEY;
  console.log('[OpenRouter] Raw API key from env:', apiKey ? `${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}` : 'MISSING');
  
  if (!apiKey) {
    console.error('[OpenRouter] ❌ OPENROUTER_API_KEY not found in environment!');
    console.error('[OpenRouter] Available env vars:', Object.keys(process.env).filter(k => k.includes('ROUTER')));
  }
  
  _openRouterClient = new OpenRouterClient({ 
    apiKey: apiKey 
  });
  
  return _openRouterClient;
}

// Export a simple object with generate method that creates client on-demand
export const openRouterClient = {
  generate: async (request: Parameters<OpenRouterClient['generate']>[0]) => {
    return getOpenRouterClient().generate(request);
  }
};