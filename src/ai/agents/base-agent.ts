/**
 * @fileOverview Base Agent Class - Foundation for all medical agents
 * 
 * This is the core base class that all medical agents extend from.
 * It provides common functionality like LLM integration, logging, and error handling.
 */

import { z } from 'zod';

// Ensure this module can be imported by exporting something immediately
export const BASE_AGENT_VERSION = '1.0.0';

export interface AgentContext {
  conversationId?: string;
  userId?: string;
  language: 'english' | 'urdu';
  previousResponses?: AgentResponse[];
  medicalHistory?: string[];
}

export interface AgentResponse {
  agentName: string;
  response: string;
  confidence: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  outputSchema: z.ZodSchema<any>;
}

export abstract class BaseAgent {
  protected name: string;
  protected description: string;
  protected capabilities: AgentCapability[];
  protected model: string;

  constructor(name: string, description: string, model = 'meta-llama/llama-3.2-3b-instruct:free') {
    this.name = name;
    this.description = description;
    this.capabilities = [];
    this.model = model;
  }

  /**
   * Abstract method that each agent must implement
   */
  abstract process(input: any, context: AgentContext): Promise<AgentResponse>;

  /**
   * Get agent information
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.capabilities
    };
  }

  /**
   * Check if agent can handle a specific type of query
   */
  abstract canHandle(input: string, context: AgentContext): boolean;

  /**
   * Protected method for making LLM calls with consistent error handling
   * Uses OpenRouter with multimodal support
   */
  protected async callLLM(
    systemPrompt: string, 
    userPrompt: string, 
    context: AgentContext,
    outputSchema?: z.ZodSchema<any>
  ): Promise<string> {
    const fullSystemPrompt = `${systemPrompt}

IMPORTANT CONTEXT:
- Agent: ${this.name}
- Language: ${context.language}
- Always respond in ${context.language}
- Include appropriate medical disclaimers
- Maintain professional medical assistant tone`;

    try {
      const { openRouterClient } = await import('../openrouter');
      
      console.log(`[${this.name}] 🟢 Using OpenRouter API`);
      
      const response = await openRouterClient.generate({
        model: this.model,
        system: fullSystemPrompt,
        prompt: userPrompt,
        output: outputSchema
      });

      console.log(`[${this.name}] ✅ OpenRouter succeeded`);
      return response.text || response.output || "I couldn't generate a response.";
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${this.name}] ❌ OpenRouter failed:`, errorMessage);
      
      // Return user-friendly error
      const fallbackMessage = context.language === 'urdu' 
        ? '⚠️ معذرت، AI سروس عارضی طور پر دستیاب نہیں ہے۔ براہ کرم دوبارہ کوشش کریں۔'
        : '⚠️ Sorry, AI service is temporarily unavailable. Please try again in a moment.';
      
      return fallbackMessage;
    }
  }

  /**
   * Log agent activity for debugging and monitoring
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    console.log(`[${new Date().toISOString()}] [${this.name}] [${level.toUpperCase()}] ${message}`, data || '');
  }

  /**
   * Validate input against agent's capabilities
   */
  protected validateInput(input: any, schema: z.ZodSchema<any>) {
    try {
      return schema.parse(input);
    } catch (error) {
      this.log('error', 'Input validation failed', error);
      throw new Error(`Invalid input for ${this.name}`);
    }
  }

  /**
   * Generate standardized "unknown medicine" response when medication is not recognized
   */
  protected generateUnknownMedicineResponse(queryText: string, language: 'english' | 'urdu' = 'english'): string {
    if (language === 'urdu') {
      return `❌ **معذرت، میں "${queryText}" کے بارے میں نہیں جانتا**

میں نے اپنی میڈیکل ڈیٹا بیس میں "${queryText}" کے بارے میں کوئی معلومات نہیں ملی۔ یہ ممکن ہے کہ:

• دوا کا نام غلط لکھا گیا ہو
• یہ کوئی عام یا معروف دوا نہیں ہے
• یہ کسی خاص علاقے یا ملک کی دوا ہو

💡 **تجویز:** براہ کرم:
1. دوا کا نام دوبارہ چیک کریں
2. دوسرا نام استعمال کریں (برانڈ یا جنرک نام)
3. یا کسی معروف دوا کے بارے میں پوچھیں (مثلاً Panadol، Aspirin، Brufen)

⚠️ **نوٹ:** یہ صرف تعلیمی معلومات ہے—طبی مشورہ نہیں۔`;
    }

    return `❌ **Sorry, I don't know about "${queryText}"**

I couldn't find any information about "${queryText}" in my medical database. This could mean:

• The medicine name might be misspelled
• It's not a commonly recognized medicine
• It might be a regional or country-specific medicine

💡 **Suggestion:** Please:
1. Double-check the spelling
2. Try a different name (brand name or generic name)
3. Or ask about a well-known medicine (e.g., Panadol, Aspirin, Brufen)

⚠️ **Note:** This is educational information only—not medical advice.`;
  }
}