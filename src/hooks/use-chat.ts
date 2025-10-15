
"use client"

import { useState, useRef, ChangeEvent, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { chatAction } from '@/app/actions';
import { GeneralChatInput } from '@/ai/flows/general-chat';
import { nanoid } from 'nanoid';
import { processImageForOCR, validateImageForProcessing } from '@/lib/client-image-processor';


export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
};

export type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
};

// Image processing now handled by client-side utilities


const toDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function useChat() {
    const [history, setHistory] = useState<Omit<ChatSession, 'messages'>[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    const [input, setInput] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const [language, setLanguage] = useState<'english' | 'urdu'>('english');
    const [isLoading, setIsLoading] = useState(false);

    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Load history from localStorage on initial render
    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem('chatHistory');
            const storedActiveId = localStorage.getItem('activeChatId');
            if (storedHistory) {
                const parsedHistory: ChatSession[] = JSON.parse(storedHistory);
                setHistory(parsedHistory.map(({ id, title }) => ({ id, title })));
                if(storedActiveId) {
                    setActiveChat(storedActiveId)
                } else if (parsedHistory.length > 0) {
                    setActiveChat(parsedHistory[0].id);
                } else {
                    startNewChat();
                }
            } else {
                startNewChat();
            }
        } catch (error) {
            console.error("Failed to parse chat history from localStorage", error);
            startNewChat();
        }
    }, []);

    // Save history to localStorage whenever it changes
    const saveChatSession = (chatId: string, updatedMessages: Message[]) => {
        try {
            const storedHistory = localStorage.getItem('chatHistory');
            const history: ChatSession[] = storedHistory ? JSON.parse(storedHistory) : [];
            const chatIndex = history.findIndex(chat => chat.id === chatId);
            const title = updatedMessages.find(m => m.role === 'user')?.content.substring(0, 30) || 'New Chat';

            if (chatIndex > -1) {
                history[chatIndex].messages = updatedMessages;
                history[chatIndex].title = title;
            } else {
                history.push({ id: chatId, title, messages: updatedMessages });
            }
            
            localStorage.setItem('chatHistory', JSON.stringify(history));
            setHistory(history.map(({ id, title }) => ({ id, title })));
        } catch (error) {
            console.error("Failed to save chat session", error);
        }
    };
    
    const startNewChat = () => {
        const newId = nanoid();
        setActiveChatId(newId);
        setMessages([]);
        localStorage.setItem('activeChatId', newId);
        // Don't save to history until there's a message
    }

    const setActiveChat = (chatId: string) => {
        try {
            const storedHistory = localStorage.getItem('chatHistory');
            if (storedHistory) {
                const history: ChatSession[] = JSON.parse(storedHistory);
                const chat = history.find(c => c.id === chatId);
                if (chat) {
                    setActiveChatId(chat.id);
                    setMessages(chat.messages);
                    localStorage.setItem('activeChatId', chat.id);
                } else {
                    startNewChat();
                }
            }
        } catch (error) {
            console.error("Failed to set active chat", error);
        }
    }
    
    const deleteChat = (chatId: string) => {
        try {
            const storedHistory = localStorage.getItem('chatHistory');
            let history: ChatSession[] = storedHistory ? JSON.parse(storedHistory) : [];
            history = history.filter(c => c.id !== chatId);
            localStorage.setItem('chatHistory', JSON.stringify(history));
            setHistory(history.map(({ id, title }) => ({ id, title })));

            if(activeChatId === chatId) {
                if (history.length > 0) {
                    setActiveChat(history[0].id);
                } else {
                    startNewChat();
                }
            }
        } catch (error) {
            console.error("Failed to delete chat", error);
        }
    }

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImageUrl(URL.createObjectURL(file));
        }
    };
    
    const reset = () => {
        setInput('');
        setImageFile(null);
        setImageUrl(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const handleSubmit = useCallback(async (text: string) => {
        // Auto-start a new chat if none exists
        let currentChatId = activeChatId;
        if (!currentChatId) {
            const newId = nanoid();
            setActiveChatId(newId);
            localStorage.setItem('activeChatId', newId);
            currentChatId = newId;
        }

        if (!text.trim() && !imageFile) {
        toast({
            variant: 'destructive',
            title: 'Input required',
            description: 'Please enter a message or upload an image.',
        });
        return;
        }

        setIsLoading(true);

        let imageDataUri: string | undefined = undefined;
        if (imageFile) {
            const originalDataUri = await toDataURL(imageFile);
            
            // Validate and process image on client-side before sending
            const validation = validateImageForProcessing(originalDataUri);
            if (!validation.isValid) {
                toast({
                    variant: 'destructive',
                    title: 'Image Error',
                    description: validation.message,
                });
                setIsLoading(false);
                return;
            }
            
            // Process image for better OCR results
            imageDataUri = await processImageForOCR(originalDataUri);
        }

        const userMessage: Message = {
        id: nanoid(),
        role: 'user',
        content: text,
        image: imageUrl ?? undefined,
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        
        reset();

        const chatInput: GeneralChatInput = {
        text,
        imageDataUri,
        language,
        };

        const result = await chatAction(chatInput);

        if (result.message === 'success' && result.data) {
            const assistantMessage: Message = {
                id: nanoid(),
                role: 'assistant',
                content: result.data.response,
            };
            const finalMessages = [...updatedMessages, assistantMessage];
            setMessages(finalMessages);
            saveChatSession(currentChatId, finalMessages);
        } else {
            const errorMessage = result.message || 'An error occurred.';
            toast({
                variant: 'destructive',
                title: 'Error',
                description: errorMessage,
            });
            setMessages(updatedMessages); // Keep user message on error
        }
        
        setIsLoading(false);
    }, [activeChatId, imageFile, imageUrl, language, toast, messages, saveChatSession]);


    return {
        messages,
        input,
        setInput,
        language,
        setLanguage,
        isLoading,
        handleInputChange,
        handleFileChange,
        handleSubmit,
        imageFile,
        imageUrl,
        fileInputRef,
        reset,
        history,
        activeChatId,
        setActiveChat,
        startNewChat,
        deleteChat,
    };
}
