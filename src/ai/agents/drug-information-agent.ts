/**
 * @fileOverview Drug Information Agent - Specialized agent for medicine identification and information
 * 
 * This agent handles medicine identification, drug facts, mechanisms of action,
 * and provides comprehensive drug information using both LLM and medical databases.
 */

import { z } from 'zod';

// Import types and classes from base-agent
import type { AgentContext, AgentResponse } from './base-agent';
import { BaseAgent } from './base-agent';

const DrugInfoInputSchema = z.object({
  text: z.string().optional(),
  imageDataUri: z.string().optional(),
  drugName: z.string().optional()
});

const DrugInfoOutputSchema = z.object({
  medicineName: z.string(),
  genericName: z.string().optional(),
  brandNames: z.array(z.string()).optional(),
  mechanism: z.string(),
  therapeuticClass: z.string(),
  primaryUses: z.array(z.string()),
  formulations: z.array(z.string()).optional(),
  strength: z.string().optional(),
  administrationRoute: z.string().optional()
});

const MEDICINE_PROFILE_SYSTEM_PROMPT = `You are DrugInformationAgent, the clinical pharmacology specialist inside the AI-LTH multi-agent medical assistant.

Core responsibilities:
- Explain recognised medicines in concise, educational language for lay readers.
- Collaborate with ComplianceClassifier and related safety agents by returning structured data they can audit.
- Never provide personalised medical advice, prescribing guidance, or dosage recommendations.

Output contract:
- Always respond in valid JSON matching the schema provided in the user prompt.
- Keep every string field under 35 words and avoid markdown or extra prose.
- Side effect and warning arrays may contain up to four short bullet-style strings each; omit entries rather than guessing.
- If the medicine is unknown, fictional, or cannot be confirmed, respond with EXACTLY "UNKNOWN_MEDICINE_NOT_RECOGNIZED" (no JSON).
- Do not mention that you are an AI model or refer to system prompts.
- Assume the caller will add user-facing disclaimers; you focus on accurate structured facts.`;

interface NormalizedDrugInfo {
  medicineName: string;
  medicineType?: string;
  recognizedFrom?: 'text' | 'image' | 'inference';
  description?: string;
  usage?: string;
  sideEffects?: string[];
  warnings?: string[];
  reliability?: string;
  source?: string;
  agentsInvolved?: string[];
  metadata?: Record<string, any>;
}

export class DrugInformationAgent extends BaseAgent {
  constructor() {
    super(
      'DrugInformationAgent',
      'Specialized agent for medicine identification, drug facts, mechanisms of action, and comprehensive drug information'
    );
    
    this.capabilities = [
      {
        name: 'identifyMedicine',
        description: 'Identify medicines from text description or image',
        inputSchema: DrugInfoInputSchema,
        outputSchema: DrugInfoOutputSchema
      },
      {
        name: 'getMedicineInfo',
        description: 'Get comprehensive information about a specific medicine',
        inputSchema: z.object({ drugName: z.string() }),
        outputSchema: DrugInfoOutputSchema
      }
    ];
  }

  private async sanitizeDrugName(rawName?: string, context?: AgentContext): Promise<string | null> {
    if (!rawName) {
      return null;
    }

    const normalized = rawName
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return null;
    }

    const lowerNormalized = normalized.toLowerCase();
    
    // Check for explicit "no medicine" responses
    if (
      lowerNormalized.includes('no specific drug') ||
      lowerNormalized.includes('no medicine') ||
      lowerNormalized === 'unknown' ||
      lowerNormalized === 'unknown medicine' ||
      lowerNormalized === 'none'
    ) {
      return null;
    }

    // If it looks like a question (contains question words), extract the medicine name using LLM
    const questionWords = ['what', 'is', 'are', 'tell', 'about', 'explain', 'describe', 'how', 'why', 'when', 'where', 'show', 'give', 'can', 'you'];
    const hasQuestionWords = questionWords.some(word => {
      // Match whole words to avoid false matches
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(lowerNormalized);
    });
    
    if (hasQuestionWords && context) {
      // Use LLM to extract just the medicine name
      const extractPrompt = `Extract ONLY the medicine/drug name from this user query. Return just the medicine name, nothing else.

User Query: "${normalized}"

Examples:
- "what is paracetamol" → Paracetamol
- "tell me about aspirin" → Aspirin
- "panadol information" → Panadol
- "how does ibuprofen work" → Ibuprofen
- "what are side effects of brufen" → Brufen

Rules:
1. Return ONLY the medicine name (single word or two words maximum)
2. Do NOT include question words, articles, or explanations
3. Capitalize first letter
4. If no medicine mentioned, return "NONE"

Medicine name:`;

      try {
        const extracted = await this.callLLM(
          'You extract medicine names from questions. Return ONLY the medicine name, nothing else.',
          extractPrompt,
          context
        );
        
        const cleanedExtracted = extracted.trim()
          .split('\n')[0] // Take only first line
          .replace(/^["']|["']$/g, '') // Remove quotes  
          .replace(/\.$/, '') // Remove trailing period
          .replace(/^(the|a|an)\s+/i, '') // Remove articles
          .trim();
        
        // Check if it's not a refusal or "NONE"
        if (cleanedExtracted && 
            cleanedExtracted.length >= 2 && 
            cleanedExtracted.length <= 50 &&
            !cleanedExtracted.toLowerCase().includes('can\'t') &&
            !cleanedExtracted.toLowerCase().includes('cannot') &&
            !cleanedExtracted.toLowerCase().includes('sorry') &&
            cleanedExtracted.toUpperCase() !== 'NONE') {
          console.log('[DrugInformationAgent] LLM extracted medicine name:', cleanedExtracted);
          return cleanedExtracted;
        } else {
          console.log('[DrugInformationAgent] LLM extraction failed or returned NONE:', cleanedExtracted);
          return null; // Return null instead of falling back to raw input
        }
      } catch (error) {
        console.warn('[DrugInformationAgent] Failed to extract with LLM:', error);
        return null; // Return null on error
      }
    }

    // For non-questions, clean up the text to extract potential medicine names
    // Remove common words that aren't medicine names
    const commonWords = ['medicine', 'drug', 'medication', 'tablet', 'pill', 'capsule', 'syrup', 'information', 'details', 'about', 'of', 'the', 'a', 'an'];
    let cleaned = normalized;
    
    // Remove common words
    commonWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      cleaned = cleaned.replace(regex, ' ');
    });
    
    // Clean up extra spaces and punctuation
    const simplified = cleaned
      .replace(/[,;:\/-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!simplified || simplified.length < 2 || simplified.length > 50) {
      return null;
    }

    return simplified;
  }

  /**
   * Check if this agent can handle the query
   */
  canHandle(input: string, context: AgentContext): boolean {
    const normalized = (input ?? '').trim();
    const canHandle = normalized.length > 0;
    console.log('[DrugInformationAgent] Can handle query:', canHandle);
    return canHandle;
  }

  /**
   * Main processing method
   */
  async process(input: any, context: AgentContext): Promise<AgentResponse> {
    console.log('[DrugInformationAgent] Starting to process request:', typeof input, input);
    this.log('info', 'Processing drug information request', { input: typeof input });
    
    try {
      const queryText = typeof input === 'string' ? input : input?.text || '';

      let queryIntent: 'medicine_info' | 'medical_advice' | 'other' = 'medicine_info';
      if (queryText.trim()) {
        queryIntent = await this.classifyQueryIntent(queryText, context);
      }

      if (queryIntent === 'medical_advice') {
        return this.generateDirectAdviceResponse(context);
      }
      
      if (queryIntent === 'other' && typeof input === 'string') {
        return {
          agentName: this.name,
          response: this.generateUnknownMedicineResponse(queryText || 'the mentioned item', context.language),
          confidence: 0.2,
          metadata: { queryType: 'non_medicine_request' },
          timestamp: new Date()
        };
      }

  let drugInfo: NormalizedDrugInfo | { isUnknown: boolean; unknownResponse: string };
  let confidence = 0.8;
      
      // Handle different input types
      if (typeof input === 'string') {
        drugInfo = await this.extractDrugInfoFromText(input, context);
      } else if (input.imageDataUri) {
        drugInfo = await this.identifyPillFromImage(input.imageDataUri, context);
        confidence = 0.7; // Lower confidence for image identification
      } else if (input.text) {
        drugInfo = await this.extractDrugInfoFromText(input.text, context);
      } else {
        throw new Error('Invalid input format');
      }

      if ('source' in drugInfo && drugInfo.source) {
        confidence = 0.9;
      }

      // Format response based on language
      const formattedResponse = await this.formatDrugResponse(drugInfo, context);
      
      return {
        agentName: this.name,
        response: formattedResponse,
        confidence: confidence,
        metadata: {
          drugInfo: drugInfo,
          processingMethod: typeof input === 'string' ? 'text' : input.imageDataUri ? 'image' : 'structured',
          source: 'source' in drugInfo ? drugInfo.source : undefined
        },
        timestamp: new Date()
      };
      
    } catch (error) {
      this.log('error', 'Failed to process drug information request', error);
      return {
        agentName: this.name,
        response: context.language === 'urdu' 
          ? 'معذرت، میں اس دوا کی معلومات حاصل کرنے میں ناکام ہوں۔ براہ کرم دوبارہ کوشش کریں۔'
          : "I'm sorry, I couldn't retrieve information about this medicine. Please try again with a clearer description.",
        confidence: 0,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      };
    }
  }

  private generateDirectAdviceResponse(context: AgentContext): AgentResponse {
    const disclaimer = context.language === 'urdu'
      ? `**⚠️ اہم طبی اطلاع ⚠️**
یہ نظام صرف تعلیمی معلومات فراہم کرتا ہے۔ ہم طبی مشورہ، تشخیص، یا علاج کی تجاویز نہیں دے سکتے۔

براہ کرم اپنے قابل اعتماد، لائسنس یافتہ ہیلتھ کیئر فراہم کنندہ یا فارماسسٹ سے مشورہ کریں جو آپ کے مکمل طبی پس منظر کے مطابق رہنمائی کر سکے۔`
      : `**⚠️ IMPORTANT MEDICAL NOTICE ⚠️**
This system only provides educational information about medicines. It cannot prescribe, recommend treatments, or decide what you should take.

Please speak with your licensed healthcare provider or a qualified pharmacist who can review your full medical history and give personalized medical advice.`;

    return {
      agentName: this.name,
      response: disclaimer,
      confidence: 0.6,
      metadata: { queryType: 'medical_advice_request' },
      timestamp: new Date()
    };
  }

  private async classifyQueryIntent(
    query: string,
    context: AgentContext
  ): Promise<'medicine_info' | 'medical_advice' | 'other'> {
    const trimmed = query.trim();
    if (!trimmed) {
      return 'other';
    }

    // Use AI to dynamically classify the query intent
    const classificationPrompt = `Analyze this user query and classify its intent.

Query: """${trimmed}"""

Classification Rules:
1. MEDICINE_INFORMATION - User asking about a medicine (any medicine name, what it does, how it works, side effects, etc.)
   Examples: "panadol", "what is aspirin", "tell me about metformin", "brufen side effects", "medicine paracetamol"
   
2. MEDICAL_ADVICE - User asking what THEY personally should take or do
   Examples: "should I take panadol", "how much for me", "can I take this", "what dose is right for me"
   
3. OTHER - Not about medicines at all
   Examples: "hello", "what's the weather", "tell me a joke"

IMPORTANT: If the query mentions ANY medicine name (brand or generic), classify as MEDICINE_INFORMATION unless it's clearly asking for personal advice.

Respond with ONLY one word: "MEDICINE_INFORMATION", "MEDICAL_ADVICE", or "OTHER"`;

    try {
      const response = await this.callLLM(
        'You are an intelligent query classifier for a medical information system. Detect medicine-related queries dynamically without relying on keyword lists. Recognize both brand names and generic names from any country.',
        classificationPrompt,
        context
      );

      const normalized = response.trim().toUpperCase().replace(/[_-]/g, '');

      if (normalized.includes('ADVICE')) {
        return 'medical_advice';
      }

      if (normalized.includes('INFORMATION') || normalized.includes('MEDICINE')) {
        return 'medicine_info';
      }

      // Default to medicine_info if uncertain - better to try extracting than reject
      return 'medicine_info';
      
    } catch (error) {
      console.error('[DrugInformationAgent] Error classifying query intent:', error);
      // On error, default to medicine_info and let downstream logic handle it
      return 'medicine_info';
    }
  }

  /**
   * Extract drug information from text using NLP
   */
  private async extractDrugInfoFromText(text: string, context: AgentContext): Promise<any> {
    try {
      // First, check if the input is already a simple medicine name (1-3 words, no complex sentences)
      const trimmedText = text.trim();
      const wordCount = trimmedText.split(/\s+/).length;
      
      // If it's a short query (likely a direct medicine name), try sanitizing directly first
      if (wordCount <= 5) {
        const directSanitized = await this.sanitizeDrugName(trimmedText, context);
        if (directSanitized && directSanitized.length >= 3) {
          console.log('[DrugInformationAgent] Direct medicine name detected:', directSanitized);
          return await this.getDrugInformation(directSanitized, context, 'text');
        }
      }

      // For longer/complex text, use entity extraction
      const { huggingFaceClient } = await import('../huggingface');
      
      // Use Hugging Face to extract medical entities
      const entities = await huggingFaceClient.extractMedicalEntities(text);
      const drugEntities = entities.filter((e: any) => 
        e.label.toLowerCase().includes('drug') || 
        e.label.toLowerCase().includes('medication') ||
        e.label.toLowerCase().includes('chemical')
    );

    // If we found drug entities, get detailed information
    let drugName = '';
    if (drugEntities.length > 0) {
      drugName = drugEntities[0].text;
    } else {
      // Try to extract drug name using LLM
      const extractionPrompt = `Extract the medicine/drug name from this text. If no specific drug is mentioned, indicate "No specific drug mentioned".
      
Text: "${text}"

Respond with just the drug name or "No specific drug mentioned":`;

      drugName = await this.callLLM(
        'You are a medical information extraction specialist.',
        extractionPrompt,
        context
      );
    }

    const sanitizedName = await this.sanitizeDrugName(drugName, context);

    if (!sanitizedName) {
      // Return unknown medicine response when no drug is mentioned
      return {
        isUnknown: true,
        unknownResponse: this.generateUnknownMedicineResponse('the mentioned item', context.language)
      };
    }

    // Get comprehensive drug information
    return await this.getDrugInformation(sanitizedName, context, 'text');
    } catch (error) {
      console.error('[DrugInformationAgent] Error extracting drug info from text:', error);
      // Fallback to LLM-only extraction
      const extractionPrompt = `Extract the medicine/drug name from this text and provide basic information about it.
      
Text: "${text}"

If no specific drug is mentioned, indicate "No specific drug mentioned":`;

      const fallbackResult = await this.callLLM(
        'You are a medical information extraction specialist.',
        extractionPrompt,
        context
      );
      const fallbackName = fallbackResult?.trim();
      const sanitizedFallback = await this.sanitizeDrugName(fallbackName, context);

      if (!sanitizedFallback) {
        return {
          isUnknown: true,
          unknownResponse: this.generateUnknownMedicineResponse('the mentioned item', context.language)
        };
      }

      return await this.getDrugInformation(sanitizedFallback, context, 'inference');
    }
  }

  /**
   * Identify pill from image (using existing pill identification logic)
   */
  private async identifyPillFromImage(imageDataUri: string, context: AgentContext): Promise<any> {
    const identificationPrompt = `You are a medical expert specializing in pill identification. Analyze the provided image and identify the medication.

Provide detailed information about the pill including:
1. Medicine name (brand and generic)
2. Strength/dosage
3. Manufacturer if identifiable
4. Shape, color, and markings

If you cannot confidently identify the pill, please say so and suggest consulting a pharmacist.`;

    const [mimetype, base64Data] = imageDataUri.split(';base64,');
    if (!mimetype || !base64Data) {
      throw new Error('Invalid image format');
    }

    const response = await this.callLLM(
      'You are a medical pill identification expert.',
      identificationPrompt,
      context
    );

    // Extract drug name from response and get detailed info
    const drugNameMatch = response.match(/(?:medicine|drug|pill)(?:\s+name)?:?\s*([^\n,.]+)/i);
    const drugName = drugNameMatch ? drugNameMatch[1].trim() : '';

    if (drugName) {
      const sanitizedName = await this.sanitizeDrugName(drugName, context);
      if (sanitizedName) {
        return await this.getDrugInformation(sanitizedName, context, 'image');
      }
    }

    return {
      isUnknown: true,
      unknownResponse: context.language === 'urdu'
        ? 'مجھے اس تصویر میں کوئی واضح دوا نظر نہیں آئی۔ براہ کرم دوا کی صاف تصویر فراہم کریں یا نام لکھیں تاکہ میں وضاحت کر سکوں۔'
        : "I didn't detect a recognizable medicine in this image. Please provide a clear photo of the pill or share the medicine name so I can explain it."
    };
  }

  /**
   * Get comprehensive drug information using LLM
   */
  private async getDrugInformation(
    drugName: string,
    context: AgentContext,
    origin: 'text' | 'image' | 'inference' = 'text'
  ): Promise<NormalizedDrugInfo | { isUnknown: boolean; unknownResponse: string }> {
    const originalTrimmed = drugName.trim();
    const sanitizedName = await this.sanitizeDrugName(drugName, context);

    if (!sanitizedName) {
      if (
        !originalTrimmed ||
        /no specific drug/i.test(originalTrimmed) ||
        ['unknown', 'unknown medicine'].includes(originalTrimmed.toLowerCase())
      ) {
        return {
          isUnknown: true,
          unknownResponse: this.generateUnknownMedicineResponse('the mentioned item', context.language)
        };
      }
    }

    const trimmedName = sanitizedName ?? originalTrimmed;

    if (!trimmedName) {
      return {
        isUnknown: true,
        unknownResponse: this.generateUnknownMedicineResponse('the mentioned item', context.language)
      };
    }

    const originHint = origin === 'image'
      ? 'The medicine name was recognized from an uploaded image.'
      : origin === 'inference'
        ? 'The medicine name was inferred automatically from context.'
        : 'The medicine name was provided directly by the user as text.';

    const infoPrompt = `Create a concise educational profile for the medicine "${trimmedName}".
${originHint}

Respond ONLY with valid JSON using this schema:
{
  "medicineName": string,
  "type": string,
  "description": string,
  "usage": string,
  "sideEffects": string[],
  "warnings": string[],
  "reliability": "High" | "Moderate" | "Low",
  "source": string,
  "agents": string[]
}

Guidelines:
- Keep every field short (<= 35 words) and factual.
- "usage" should describe typical purpose or administration context without telling the reader what THEY should take.
- Provide up to four concise bullet items for sideEffects and warnings. If unknown, use an empty array.
- If the medicine is not recognized or appears fictional, respond with the exact text "UNKNOWN_MEDICINE_NOT_RECOGNIZED" and nothing else.`;

    const response = await this.callLLM(
      MEDICINE_PROFILE_SYSTEM_PROMPT,
      infoPrompt,
      context
    );

    // Check if response is an error message instead of actual data
    if (!response || response.includes('API configuration') || response.includes('API key')) {
      console.error('[DrugInformationAgent] API configuration error detected');
      return {
        isUnknown: true,
        unknownResponse: context.language === 'urdu'
          ? `⚠️ معذرت، میں "${trimmedName}" کی معلومات حاصل نہیں کر سکا۔ API configuration کی ضرورت ہے۔ براہ کرم منتظم سے رابطہ کریں۔`
          : `⚠️ Sorry, I couldn't retrieve information about "${trimmedName}". API configuration is required. Please contact the administrator to set up API keys.`
      };
    }

    if (response.trim().toUpperCase().includes('UNKNOWN_MEDICINE_NOT_RECOGNIZED')) {
      return {
        isUnknown: true,
        unknownResponse: this.generateUnknownMedicineResponse(trimmedName, context.language)
      };
    }

    const normalized = this.parseMedicineProfile(response, trimmedName, origin);
    if (!normalized) {
      return {
        isUnknown: true,
        unknownResponse: this.generateUnknownMedicineResponse(trimmedName, context.language)
      };
    }

    return normalized;
  }

  private parseMedicineProfile(
    rawResponse: string,
    fallbackName: string,
    origin: 'text' | 'image' | 'inference'
  ): NormalizedDrugInfo | null {
    console.log('[DrugInformationAgent] Attempting to parse LLM response:', rawResponse?.substring(0, 200));
    
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[DrugInformationAgent] Failed to locate JSON payload in LLM response');
      console.warn('[DrugInformationAgent] Raw response:', rawResponse);
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
      console.log('[DrugInformationAgent] Successfully parsed JSON:', parsed.medicineName);
    } catch (error) {
      console.warn('[DrugInformationAgent] Failed to parse JSON from LLM response', error);
      console.warn('[DrugInformationAgent] JSON string was:', jsonMatch[0].substring(0, 200));
      return null;
    }

    const toStringValue = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      }
      return undefined;
    };

    const toStringArray = (value: unknown): string[] | undefined => {
      if (!Array.isArray(value)) {
        return undefined;
      }
      const cleaned = value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry ?? '')).trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 4);

      return cleaned.length ? cleaned : undefined;
    };

    // Check if the medicine type indicates it's unknown
    const medicineType = toStringValue(parsed.type);
    const description = toStringValue(parsed.description);
    
    // If type is "Unknown" or description indicates unknown/not specified, treat as unknown medicine
    if (
      medicineType?.toLowerCase() === 'unknown' ||
      medicineType?.toLowerCase().includes('not specified') ||
      description?.toLowerCase().includes('not specified') ||
      description?.toLowerCase().includes('not available') ||
      description?.toLowerCase().includes('medication type not specified')
    ) {
      console.log('[DrugInformationAgent] Detected unknown medicine indicators in LLM response');
      return null;
    }

    const normalized: NormalizedDrugInfo = {
      medicineName: toStringValue(parsed.medicineName) ?? fallbackName,
      medicineType: toStringValue(parsed.type),
      recognizedFrom: origin,
      description: toStringValue(parsed.description),
      usage: toStringValue(parsed.usage),
      sideEffects: toStringArray(parsed.sideEffects),
      warnings: toStringArray(parsed.warnings),
      reliability: toStringValue(parsed.reliability) ?? 'Moderate',
      source: toStringValue(parsed.source) ?? 'AI-LTH Medical Info Agent',
      agentsInvolved: toStringArray(parsed.agents) ?? ['DrugInformationAgent', 'ComplianceClassifier'],
      metadata: {
        llmResponse: rawResponse,
      },
    };

    return normalized;
  }

  private async formatDrugResponse(
    drugInfo: NormalizedDrugInfo | { isUnknown: boolean; unknownResponse: string },
    context: AgentContext
  ): Promise<string> {
    if ('isUnknown' in drugInfo && drugInfo.isUnknown) {
      return drugInfo.unknownResponse;
    }

    const normalized = drugInfo as NormalizedDrugInfo;
    const isUrdu = context.language === 'urdu';

    const labels = isUrdu
      ? {
          medicineName: '💊 دوائی کا نام',
          type: '📋 قسم',
          description: '📝 تفصیل',
          usage: '💡 استعمال',
          sideEffects: '⚠️ ممکنہ ضمنی اثرات',
          warnings: '🚨 اہم انتباہات',
          none: 'معلومات دستیاب نہیں',
          disclaimer: '⚠️ **اہم:** یہ صرف تعلیمی معلومات ہے—طبی مشورہ نہیں۔ کوئی بھی دوا لینے سے پہلے اپنے ڈاکٹر یا فارماسسٹ سے مشورہ کریں۔',
        }
      : {
          medicineName: '💊 MEDICINE',
          type: '📋 CATEGORY',
          description: '📝 WHAT IT IS',
          usage: '💡 USED FOR',
          sideEffects: '⚠️ SIDE EFFECTS',
          warnings: '🚨 WARNINGS',
          none: 'Not available',
          disclaimer: '⚠️ **IMPORTANT:** For educational purposes only. Always consult your doctor or pharmacist before taking any medication.',
        };

    const renderList = (items?: string[], numbered: boolean = false): string => {
      if (!items?.length) {
        return `   ${labels.none}`;
      }
      return items
        .map((item, index) => item.trim())
        .filter(Boolean)
        .map((item, index) => numbered ? `   ${index + 1}. ${item}` : `   • ${item}`)
        .join('\n');
    };

    const usageText = normalized.usage ?? (isUrdu ? 'استعمال کی معلومات دستیاب نہیں' : 'Not specified');
    const descriptionText = normalized.description ?? (isUrdu ? 'تفصیل دستیاب نہیں' : 'Not available');
    const medicineType = normalized.medicineType ?? (isUrdu ? 'معلوم نہیں' : 'General Medicine');

    // Create a clean, modern, card-like structure
    const lines = [
      '',
      '┌─────────────────────────────────────────────────┐',
      `│  ${labels.medicineName}                                     │`,
      `│  ${normalized.medicineName || (isUrdu ? 'نام دستیاب نہیں' : 'Unknown')}`,
      '├─────────────────────────────────────────────────┤',
      `│  ${labels.type}: ${medicineType}`,
      '└─────────────────────────────────────────────────┘',
      '',
      `${labels.description}`,
      `   ${descriptionText}`,
      '',
      `${labels.usage}`,
      `   ${usageText}`,
      '',
      `${labels.sideEffects}`,
      renderList(normalized.sideEffects, false),
      '',
      `${labels.warnings}`,
      renderList(normalized.warnings, false),
      '',
      '─────────────────────────────────────────────────',
      labels.disclaimer,
      '─────────────────────────────────────────────────',
      '',
    ];

    return lines.join('\n');
  }


}

export default DrugInformationAgent;