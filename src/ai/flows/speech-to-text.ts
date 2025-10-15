
'use server';

/**
 * @fileOverview A flow for transcribing audio to text using a speech-to-text model.
 *
 * - speechToText - A function that takes an audio data URI and returns the transcribed text.
 * - SpeechToTextInput - The input type for the speechToText function.
 * - SpeechToTextOutput - The return type for the speechToText function.
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


const SpeechToTextInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "Audio data as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'.",
    ),
});

export type SpeechToTextInput = z.infer<typeof SpeechToTextInputSchema>;

const SpeechToTextOutputSchema = z.object({
  text: z.string().describe('The transcribed text from the audio.'),
});

export type SpeechToTextOutput = z.infer<typeof SpeechToTextOutputSchema>;

export async function speechToText(input: SpeechToTextInput): Promise<SpeechToTextOutput> {
  return speechToTextFlow(input);
}


const speechToTextFlow = ai.defineFlow(
    {
        name: 'speechToTextFlow',
        inputSchema: SpeechToTextInputSchema,
        outputSchema: SpeechToTextOutputSchema,
    },
    async (input) => {
        try {

            const [mimetype, base64Data] = input.audioDataUri.split(';base64,');
            if (!mimetype || !base64Data) {
                throw new Error("Invalid audio data URI format.");
            }

            const promptParts: Part[] = [
                {
                    inlineData: {
                        mimeType: mimetype.replace('data:', ''),
                        data: base64Data,
                    }
                },
                { text: 'Transcribe the audio.'}
            ];

            const response = await openRouterClient.generate({
                model: 'meta-llama/llama-3.2-3b-instruct:free',
                prompt: promptParts,
            });

            const transcribedText = response.text;

            if (!transcribedText) {
                throw new Error("Transcription failed to produce text.");
            }

            return { text: transcribedText };
        } catch (error) {
            console.error('Error during speech-to-text transcription:', error);
            throw new Error('Failed to transcribe audio. Please ensure the audio format is correct and try again.');
        }
    }
);
