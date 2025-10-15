
'use server';

/**
 * @fileOverview A flow for identifying a pill from an image using a multimodal model.
 */

import { z } from 'genkit';
import { ai } from '../genkit';
import { openRouterClient } from '../openrouter';

// Define Part interface for compatibility
interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

const IdentifyPillInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image of a pill, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'.",
    ),
});

export type IdentifyPillInput = z.infer<typeof IdentifyPillInputSchema>;

const IdentifyPillOutputSchema = z.object({
  name: z.string().describe('The common name of the pill.'),
  description: z
    .string()
    .describe('A brief description of the pill and its purpose.'),
  dosage: z.string().describe('The typical dosage instructions.'),
});

export type IdentifyPillOutput = z.infer<typeof IdentifyPillOutputSchema>;

export async function identifyPill(input: IdentifyPillInput): Promise<IdentifyPillOutput> {
  return identifyPillFlow(input);
}


const identifyPillFlow = ai.defineFlow(
    {
        name: 'identifyPillFlow',
        inputSchema: IdentifyPillInputSchema,
        outputSchema: IdentifyPillOutputSchema,
    },
    async (input) => {
        const systemPrompt = `You are an expert medical AI assistant specializing in medicine identification from images.

Your task is to analyze the image and identify any medicines, medical items, or health-related products shown.

**Response Guidelines:**

1. **For Medicine/Medical Items (pills, tablets, capsules, medicine bottles, medical devices, reports):**
   - Provide the medicine name (brand and/or generic)
   - Give a clear, concise description of what it is and what it's used for
   - Include typical dosage or usage information
   - Keep each field under 50 words, professional and educational

2. **For Non-Medical Items (food, household items, personal objects, etc.):**
   Respond with:
   - name: "Not a Medical Item"
   - description: "This appears to be [describe what you see]. I'm designed to identify medicines, medical devices, and health-related items only. Please scan a medicine or use the text chat for general health questions."
   - dosage: "N/A"

3. **If Image is Unclear or Empty:**
   - name: "Unable to Identify"
   - description: "The image is unclear or I cannot identify any medicine. Please ensure good lighting, focus, and that the medicine/label is clearly visible."
   - dosage: "Please try again with a clearer image"

**Output Format:**
Return ONLY a valid JSON object with exactly these three keys:
{
  "name": "Medicine Name Here",
  "description": "Clear educational description here",
  "dosage": "Typical usage information here"
}

Do not include any markdown formatting, extra text, or explanations outside the JSON.`;

        const [mimetype, base64Data] = input.imageDataUri.split(';base64,');
        if (!mimetype || !base64Data) {
            throw new Error("Invalid image data URI format.");
        }

        const promptParts: Part[] = [{
            inlineData: {
                mimeType: mimetype.replace('data:', ''),
                data: base64Data
            }
        }];

        try {
            console.log('[IdentifyPill] Using OpenRouter multimodal model for image analysis...');
            
            // Use OpenRouter's free vision model
            const llmResponse = await openRouterClient.generate({
                model: 'qwen/qwen-2-vl-7b-instruct:free', // OpenRouter free vision model
                system: systemPrompt,
                prompt: promptParts,
                output: IdentifyPillOutputSchema,
            });

            const output = llmResponse.output;
            if (!output) {
                console.error('[IdentifyPill] Empty response from model');
                throw new Error("Empty response from the model.");
            }
            
            console.log('[IdentifyPill] Successfully identified:', output.name);
            
            return output;

        } catch (error) {
            console.error("[IdentifyPill] Error calling OpenRouter multimodal API:", error);
            return {
                name: "Error During Identification",
                description: "An error occurred while analyzing the image. This could be due to network issues or API limitations. Please ensure you have a clear image of a medicine and try again.",
                dosage: "N/A - Please retry",
            };
        }
    }
);
