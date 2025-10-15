/**
 * Google Gemini API Client via Genkit
 * Primary LLM provider for AI-LTH
 */

import { ai } from './genkit';

export interface GeminiRequest {
  system?: string;
  prompt: string;
  model?: string;
}

export interface GeminiResponse {
  text: string;
}

class GeminiClient {
  private hasApiKey: boolean;

  constructor() {
    this.hasApiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
    
    if (this.hasApiKey) {
      console.log('[Gemini] Client initialized successfully with Genkit');
    } else {
      console.warn('[Gemini] No API key found - Gemini features disabled');
      console.warn('[Gemini] Add GEMINI_API_KEY to .env.local for full functionality');
    }
  }

  async generate(request: GeminiRequest): Promise<GeminiResponse> {
    if (!this.hasApiKey) {
      throw new Error('Gemini client not initialized - API key missing');
    }

    const { system, prompt } = request;

    try {
      // Combine system prompt and user prompt
      const fullPrompt = system 
        ? `${system}\n\n${prompt}`
        : prompt;

      console.log('[Gemini] Generating response via Genkit...');
      
      const llmResponse = await ai.generate({
        model: 'googleai/gemini-pro',
        prompt: fullPrompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 4000,
        },
      });

      const text = llmResponse.text;
      console.log('[Gemini] Response received:', text.substring(0, 100) + '...');

      return { text };
    } catch (error: any) {
      console.error('[Gemini] API Error:', error.message || error);
      throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
    }
  }
}

// Lazy-loaded singleton instance
let geminiClientInstance: GeminiClient | null = null;

export const geminiClient = new Proxy({} as GeminiClient, {
  get(target, prop) {
    if (!geminiClientInstance) {
      console.log('[Gemini] Creating lazy-loaded client instance');
      geminiClientInstance = new GeminiClient();
    }
    return (geminiClientInstance as any)[prop];
  }
});
