
'use server';

/**
 * @fileOverview Main Medical Assistant Flow using an Agentic System
 *
 * This is the primary entry point for all user queries. It uses the
 * MedicalAgentOrchestrator to route requests to specialized agents.
 */

import { z } from 'genkit';
import { ai } from '../genkit';
import { createMedicalOrchestrator, OrchestratorResponse } from '../agents';
import { medicalOCR } from '../ocr';

const GeneralChatInputSchema = z.object({
  text: z.string().optional().describe('The text input from the user.'),
  imageDataUri: z
    .string()
    .optional()
    .describe(
      "An image from the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'.",
    ),
  language: z.enum(['english', 'urdu']).describe('The desired output language.'),
  conversationId: z.string().optional().describe('Unique identifier for conversation tracking.'),
  userId: z.string().optional().describe('User identifier for personalized responses.'),
});

export type GeneralChatInput = z.infer<typeof GeneralChatInputSchema>;

const GeneralChatOutputSchema = z.object({
  response: z.string().describe("The enhanced medical assistant's response."),
  agentsUsed: z.array(z.string()).optional().describe("AI agents that contributed to the response."),
  confidence: z.number().optional().describe("Confidence level of the response."),
  suggestions: z.array(z.string()).optional().describe("Follow-up suggestions for the user."),
});

export type GeneralChatOutput = z.infer<typeof GeneralChatOutputSchema>;

export async function generalChat(input: GeneralChatInput): Promise<GeneralChatOutput> {
  return generalChatFlow(input);
}

const generalChatFlow = ai.defineFlow(
    {
        name: 'generalChatFlow',
        inputSchema: GeneralChatInputSchema,
        outputSchema: GeneralChatOutputSchema,
    },
    async (input) => {
        console.log('[GeneralChatFlow] Received request:', input.text ? `${input.text.substring(0, 50)}...` : 'Image Request');
        
        try {
            // Step 1: Initialize the multi-agent system
            const medicalOrchestrator = createMedicalOrchestrator();

            // Step 2: Prepare context for the agents
            const agentContext = {
              conversationId: input.conversationId || `conv_${Date.now()}`,
              userId: input.userId,
              language: input.language,
              // In a stateful app, you'd load history here
              previousResponses: [], 
              medicalHistory: [],
            };

            // Step 3: Prepare input, performing OCR if necessary
            let orchestratorInput: string | { text?: string, imageDataUri?: string } = input.text || '';
            
            // If there's an image, pass it as a structured object.
            // The orchestrator will decide if it's for OCR or identification.
            if (input.imageDataUri) {
                orchestratorInput = {
                    text: input.text,
                    imageDataUri: input.imageDataUri,
                };
            }

            // Step 4: Process the query through the agent orchestrator
            const orchestratorResponse: OrchestratorResponse = await medicalOrchestrator.processQuery(
                orchestratorInput,
                agentContext
            );

            // Step 5: Format and return the response
            if (!orchestratorResponse || !orchestratorResponse.primaryResponse) {
                throw new Error('Agent orchestrator failed to produce a valid response.');
            }

            const suggestions = generateFollowUpSuggestions(orchestratorResponse, input.language);
            
            return {
                response: orchestratorResponse.primaryResponse,
                agentsUsed: orchestratorResponse.agentResponses.map(r => r.agentName),
                confidence: orchestratorResponse.confidence,
                suggestions: suggestions
            };
            
        } catch (error) {
            console.error('[GeneralChatFlow] Error in agentic flow:', error);
            
            const fallbackMessage = input.language === 'urdu'
                ? 'معذرت، میں آپ کے سوال کا جواب دینے میں مشکل میں ہوں۔ براہ کرم اپنے ڈاکٹر سے مشورہ کریں۔ **اہم:** یہ معلومات صرف تعلیمی مقاصد کے لیے ہیں۔'
                : "I'm sorry, I'm having difficulty processing your question. Please consult your healthcare provider for medical advice. **Important:** This information is for educational purposes only.";
            
            return {
                response: fallbackMessage,
                agentsUsed: ['FallbackAgent'],
                confidence: 0.1,
                suggestions: [
                    input.language === 'urdu' ? 'براہ کرم اپنا سوال دوبارہ پوچھیں' : 'Please try rephrasing your question',
                    input.language === 'urdu' ? 'اپنے ڈاکٹر سے مشورہ کریں۔' : 'Consult your healthcare provider'
                ]
            };
        }
    }
);


/**
 * Generate contextual follow-up suggestions based on the response
 */
function generateFollowUpSuggestions(
  orchestratorResponse: OrchestratorResponse,
  language: 'english' | 'urdu'
): string[] {
  const queryType = orchestratorResponse.queryAnalysis?.queryType || 'general';
  
  const suggestionsMap = {
      english: {
          medicine: ['Ask about side effects', 'Check for drug interactions'],
          drug_interaction: ['Ask about safe alternatives', 'Discuss dosage adjustments with a doctor'],
          dosage: ['What to do if I miss a dose?', 'Ask about food interactions'],
          side_effects: ['How to manage these side effects?', 'When should I see a doctor?'],
          report_analysis: ['What do these results mean for my health?', 'What are the next steps?'],
          default: ['Ask a more specific question', 'Tell me more about...']
      },
      urdu: {
          medicine: ['اس کے ضمنی اثرات کے بارے میں پوچھیں', 'دیگر ادویات کے ساتھ تعامل چیک کریں'],
          drug_interaction: ['محفوظ متبادل کے بارے میں پوچھیں', 'خوراک کی ایڈجسٹمنٹ پر ڈاکٹر سے بات کریں'],
          dosage: ['اگر میں ایک خوراک چھوٹ جاؤں تو کیا کروں؟', 'کھانے کے ساتھ تعامل کے بارے میں پوچھیں'],
          side_effects: ['ان ضمنی اثرات کا انتظام کیسے کریں؟', 'مجھے ڈاکٹر سے کب ملنا چاہئے؟'],
          report_analysis: ['ان نتائج کا میری صحت کے لیے کیا مطلب ہے؟', 'اگلے اقدامات کیا ہیں؟'],
          default: ['ایک زیادہ مخصوص سوال پوچھیں', 'مجھے مزید بتائیں...']
      }
  };

  return suggestionsMap[language][queryType as keyof typeof suggestionsMap.english] || suggestionsMap[language].default;
}
