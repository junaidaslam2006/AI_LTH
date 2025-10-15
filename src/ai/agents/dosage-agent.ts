/**
 * @fileOverview Dosage Agent - Specialized agent for medication dosage calculation and administration
 * 
 * This agent handles dosage calculations, administration schedules, timing recommendations,
 * and special population considerations.
 */

import { BaseAgent, AgentContext, AgentResponse } from './base-agent';
import { z } from 'zod';

const DosageInputSchema = z.object({
  medication: z.string(),
  patientWeight: z.number().optional(),
  patientAge: z.number().optional(),
  indication: z.string().optional(),
  renalFunction: z.enum(['normal', 'mild_impairment', 'moderate_impairment', 'severe_impairment']).optional(),
  hepaticFunction: z.enum(['normal', 'mild_impairment', 'moderate_impairment', 'severe_impairment']).optional(),
  isPregnant: z.boolean().optional(),
  isBreastfeeding: z.boolean().optional(),
  text: z.string().optional()
});

export class DosageAgent extends BaseAgent {
  constructor() {
    super(
      'DosageAgent',
      'Specialized agent for medication dosage calculations, administration schedules, and timing recommendations'
    );
  }

  canHandle(input: string, context: AgentContext): boolean {
    const inputLower = input.toLowerCase();
    
    // Broad check: any dosage-related terms?
    const dosageTerms = ['dose', 'dosage', 'mg', 'ml', 'tablet', 'capsule', 
                         'how much', 'how many', 'strength', 'frequency', 
                         'administration', 'take', 'timing'];
    
    return dosageTerms.some(term => inputLower.includes(term));
  }

  async process(input: any, context: AgentContext): Promise<AgentResponse> {
    this.log('info', 'Processing dosage request');
    
    try {
      // Dynamic AI-based analysis: Is this personal advice or educational?
      if (typeof input === 'string') {
        const intentAnalysis = await this.analyzeQueryIntent(input, context);
        
        if (intentAnalysis === 'PERSONAL') {
          this.log('info', 'Detected personal advice request - returning disclaimer');
          return {
            agentName: this.name,
            response: context.language === 'urdu'
              ? '⚠️ میں ذاتی طبی مشورہ فراہم نہیں کر سکتا۔ براہ کرم اپنے ڈاکٹر یا فارماسسٹ سے مشورہ کریں جو آپ کی مخصوص صورتحال کے لیے صحیح خوراک تجویز کر سکتے ہیں۔'
              : "⚠️ I cannot provide personal medical advice. Please consult your doctor or pharmacist who can recommend the right dosage for your specific situation.",
            confidence: 0.95,
            metadata: { reason: 'Personal advice request blocked' },
            timestamp: new Date()
          };
        }
      }
      
      let dosageInfo: any;
      
      if (typeof input === 'string') {
        dosageInfo = await this.extractDosageInfoFromText(input, context);
      } else {
        dosageInfo = await this.calculateDosage(input, context);
      }
      
      // Check if medicine is unknown
      if (dosageInfo.isUnknown) {
        return {
          agentName: this.name,
          response: dosageInfo.unknownResponse,
          confidence: 0.9,
          metadata: { reason: 'Unknown medicine' },
          timestamp: new Date()
        };
      }
      
      const formattedResponse = await this.formatDosageResponse(dosageInfo, context);
      
      return {
        agentName: this.name,
        response: formattedResponse,
        confidence: 0.8,
        metadata: { dosageInfo },
        timestamp: new Date()
      };
      
    } catch (error) {
      this.log('error', 'Failed to process dosage request', error);
      return {
        agentName: this.name,
        response: context.language === 'urdu'
          ? 'معذرت، میں خوراک کی معلومات فراہم کرنے میں ناکام ہوں۔ براہ کرم اپنے ڈاکٹر سے مشورہ کریں۔'
          : "I'm sorry, I couldn't provide dosage information. Please consult your healthcare provider for proper dosing guidance.",
        confidence: 0,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      };
    }
  }

  private async analyzeQueryIntent(query: string, context: AgentContext): Promise<'PERSONAL' | 'EDUCATIONAL'> {
    const analysisPrompt = `Analyze this user query and classify it as either PERSONAL or EDUCATIONAL:

Query: "${query}"

PERSONAL (asking for personal medical advice - what THEY should do):
- "How much panadol should I take?"
- "Can I take 2 tablets?"
- "What dose is right for me?"
- "Should I increase my dose?"
- "How many should I take for my headache?"
- "Can I take this with food?"

EDUCATIONAL (asking for general knowledge):
- "What is the standard dosage of panadol?"
- "What are typical panadol doses?"
- "Explain panadol dosing guidelines"
- "What dosages does panadol come in?"
- "How is panadol typically administered?"
- "What are normal panadol doses for adults?"

Respond with ONLY one word: "PERSONAL" or "EDUCATIONAL"`;

    try {
      const analysis = await this.callLLM(
        'You are a query classifier. Determine if the user wants personal medical advice or educational information.',
        analysisPrompt,
        context
      );

      const result = analysis.trim().toUpperCase();
      return result.includes('PERSONAL') ? 'PERSONAL' : 'EDUCATIONAL';
      
    } catch (error) {
      this.log('error', 'Error analyzing query intent', error);
      // Conservative: treat as personal advice on error
      return 'PERSONAL';
    }
  }

  private async extractDosageInfoFromText(text: string, context: AgentContext): Promise<any> {
    // First check if we can identify a valid medicine
    const medicationName = this.extractMedicationName(text);
    
    if (medicationName === 'Unknown medication' || !medicationName || medicationName.trim() === '') {
      return {
        isUnknown: true,
        unknownResponse: this.generateUnknownMedicineResponse(text, context.language)
      };
    }
    
    const dosagePrompt = `Provide EDUCATIONAL dosage information for this query:

"${text}"

Explain in educational terms (NOT as personal advice):
1. Medication name: ${medicationName}
2. Standard adult dosage ranges
3. Typical frequency of administration
4. Common timing guidelines (with/without food)
5. General treatment duration patterns
6. Important safety considerations

IMPORTANT RULES:
- If "${medicationName}" is NOT a recognized pharmaceutical product, respond with exactly: "UNKNOWN_MEDICINE_NOT_RECOGNIZED"
- NEVER tell the user what they personally should take
- Use phrases like "typically prescribed as" or "standard dosage is" NOT "you should take"
- Always frame as educational information, not personal medical advice`;

    const response = await this.callLLM(
      'You are a clinical pharmacology educator providing EDUCATIONAL dosage information ONLY. Never give personal medical advice or tell users what they should take. Use educational framing like "typically prescribed as" or "standard dose is". If you don\'t recognize the medicine, respond with "UNKNOWN_MEDICINE_NOT_RECOGNIZED" exactly.',
      dosagePrompt,
      context
    );

    // Check if medicine is not recognized
    if (response.includes('UNKNOWN_MEDICINE_NOT_RECOGNIZED') || 
        response.toLowerCase().includes('not recognized') ||
        response.toLowerCase().includes('unknown medicine')) {
      return {
        isUnknown: true,
        unknownResponse: this.generateUnknownMedicineResponse(medicationName, context.language)
      };
    }

    return this.parseDosageInfo(response, text);
  }

  private async calculateDosage(input: any, context: AgentContext): Promise<any> {
    const calculationPrompt = `Provide EDUCATIONAL dosage information for:

Medication: ${input.medication}
Context: General educational overview

Explain (educationally, NOT as personal advice):
1. Standard adult dosage ranges
2. Typical pediatric dosing considerations
3. General dose adjustment principles for organ impairment
4. Maximum daily dose limits
5. Common administration schedules
6. Timing considerations
7. Special population warnings

Frame everything as "typically prescribed as" or "standard practice is" - NEVER "you should take"`;

    return await this.callLLM(
      'You are a clinical pharmacology educator explaining typical dosing patterns educationally. Never calculate personal doses or give medical advice.',
      calculationPrompt,
      context
    );
  }

  private parseDosageInfo(response: string, originalText: string): any {
    return {
      medication: this.extractMedicationName(originalText),
      standardDose: this.extractValue(response, 'dose'),
      frequency: this.extractValue(response, 'frequency'),
      timing: this.extractValue(response, 'timing'),
      duration: this.extractValue(response, 'duration'),
      specialConsiderations: this.extractValue(response, 'considerations'),
      rawResponse: response
    };
  }

  private async formatDosageResponse(dosageInfo: any, context: AgentContext): Promise<string> {
    const formatPrompt = `Format this EDUCATIONAL dosage information in ${context.language}:

${JSON.stringify(dosageInfo, null, 2)}

Structure the response with:
1. Medication & Standard Dosage (use "typically prescribed as" NOT "you should take")
2. How It's Typically Administered (educational)
3. Common Timing & Frequency Patterns
4. General Safety Guidelines
5. Special Considerations

CRITICAL: Frame everything educationally. Use phrases like:
- "Standard adult dose is typically..."
- "Generally administered as..."
- "Commonly prescribed at..."

NEVER use "you should take" or "take X amount"

End with: "⚠️ This is educational information only. Your doctor will determine the right dose for your specific situation."`;

    return await this.callLLM(
      `You are a medication educator explaining dosing concepts in ${context.language}. Provide educational information only - never personal medical advice. Always use phrases like "typically prescribed" not "you should take".`,
      formatPrompt,
      context
    );
  }

  private extractMedicationName(text: string): string {
    const words = text.split(' ');
    // Simple heuristic - look for capitalized words that might be drug names
    for (const word of words) {
      if (word.length > 3 && /^[A-Z]/.test(word)) {
        return word;
      }
    }
    return 'Unknown medication';
  }

  private extractValue(text: string, key: string): string {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(key.toLowerCase())) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          return line.substring(colonIndex + 1).trim();
        }
      }
    }
    return 'Not specified';
  }
}