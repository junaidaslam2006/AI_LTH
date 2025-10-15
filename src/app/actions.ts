'use server';

import { identifyPill } from '@/ai/flows/identify-pill';
import { generalChat, GeneralChatInput, GeneralChatOutput } from '@/ai/flows/general-chat';
import { speechToText, SpeechToTextInput } from '@/ai/flows/speech-to-text';
import { z } from 'zod';

const IdentifyPillSchema = z.object({
  imageDataUri: z.string().min(1, 'Image data is required.'),
});

export async function identifyPillAction(prevState: any, formData: FormData) {
  const validatedFields = IdentifyPillSchema.safeParse({
    imageDataUri: formData.get('imageDataUri'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Invalid input.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await identifyPill(validatedFields.data);
    return { message: 'success', data: result };
  } catch (e: any) {
    console.error(e);
    const errorMessage = e.message || 'An error occurred during pill identification.';
    if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('permission')) {
        return { message: 'Authentication Error: Please check your API key and ensure the Generative Language API is enabled in your Google Cloud project.' };
    }
    return { message: errorMessage };
  }
}

const ChatSchema = z.object({
  text: z.string().optional(),
  imageDataUri: z.string().optional(),
  language: z.enum(['english', 'urdu']),
});

export async function chatAction(input: GeneralChatInput): Promise<{
    message: string;
    data?: GeneralChatOutput;
    errors?: any;
}> {
    const validatedFields = ChatSchema.safeParse(input);

    if (!validatedFields.success) {
        return {
            message: 'Invalid input.',
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    
    if(!validatedFields.data.text && !validatedFields.data.imageDataUri) {
        return {
            message: 'Invalid input.',
            errors: {
                text: ['Please enter text or upload an image.'],
            }
        };
    }

    try {
        const result = await generalChat(validatedFields.data);
        return { message: 'success', data: result };
    } catch (e: any) {
        console.error(e);
        const errorMessage = e.message || 'An error occurred during the chat.';
        if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('permission')) {
            return { message: 'Authentication Error: Please check your API key and ensure the Generative Language API is enabled in your Google Cloud project.' };
        }
        return { message: errorMessage };
    }
}

const SpeechToTextSchema = z.object({
    audioDataUri: z.string(),
});

export async function speechToAction(input: SpeechToTextInput): Promise<{
    message: string;
    data?: string;
    errors?: any;
}> {
    const validatedFields = SpeechToTextSchema.safeParse(input);

    if(!validatedFields.success) {
        return {
            message: 'Invalid input.',
            errors: validatedFields.error.flatten().fieldErrors,
        }
    }

    try {
        const result = await speechToText(validatedFields.data);
        return { message: 'success', data: result.text };
    } catch (e: any) {
        console.error(e);
        const errorMessage = e.message || 'An error occurred during speech-to-text transcription.';
         if (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('permission')) {
            return { message: 'Authentication Error: Please check your API key and ensure the Generative Language API is enabled in your Google Cloud project.' };
        }
        return { message: errorMessage };
    }
}
