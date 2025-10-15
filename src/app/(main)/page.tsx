
'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  Send,
  X,
  Scan,
  Bot,
  User,
  Plus,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { useChat, Message } from '@/hooks/use-chat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useRef, useEffect, useState } from 'react';
import { LiveScanModal } from '@/components/live-scan-modal';
import { MedicalUpload } from '@/components/medical/medical-upload';
import { useAuth } from '@/hooks/use-auth';
import { useFirestoreChat } from '@/hooks/use-firestore';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


export default function Home() {
  const { user } = useAuth();
  const { saveChatToFirestore } = useFirestoreChat();
  const {
    messages,
    input,
    language,
    isLoading,
    handleInputChange,
    handleSubmit,
    reset,
    setLanguage,
    history,
    setActiveChat,
    activeChatId,
    startNewChat,
    deleteChat,
  } = useChat();

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isLoading]);

  // Auto-save chat to Firestore when user is authenticated and messages change
  useEffect(() => {
    if (user && messages.length > 0) {
      const saveChat = async () => {
        try {
          const chatTitle = messages[0]?.content.slice(0, 50) + '...' || 'New Chat';
          await saveChatToFirestore(
            activeChatId || 'default',
            messages,
            chatTitle
          );
        } catch (error) {
          console.error('Failed to save chat:', error);
        }
      };
      
      // Debounce save to avoid too frequent writes
      const timeoutId = setTimeout(saveChat, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [user, messages, activeChatId, saveChatToFirestore]);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSubmit(input);
  };

  return (
    <>
      <SidebarProvider>
        <Sidebar side="left" collapsible="icon" variant="sidebar">
          <SidebarHeader>
             <Button
                variant="outline"
                className="w-full justify-start"
                onClick={startNewChat}
              >
                <Plus className="mr-2" />
                New Chat
              </Button>
          </SidebarHeader>
           <SidebarContent className="p-2">
             <ScrollArea className="h-[calc(100vh-150px)]">
              <SidebarMenu>
                {history.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      isActive={chat.id === activeChatId}
                      onClick={() => setActiveChat(chat.id)}
                      className="truncate"
                    >
                      <MessageSquare />
                      <span>{chat.title}</span>
                    </SidebarMenuButton>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1.5 h-6 w-6 opacity-0 group-hover/menu-item:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this chat.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteChat(chat.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </ScrollArea>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
           <main className="flex-1">
             <div className="md:hidden p-2">
                <SidebarTrigger />
             </div>
            <section id="hero" className="w-full py-12 md:py-16">
              <div className="container px-4 text-center md:px-6">
                <div className="mx-auto max-w-3xl space-y-4">
                  <h1 className="text-4xl font-bold tracking-tighter text-primary sm:text-5xl md:text-6xl">
                    Your Health, Explained Simply with AI-LTH
                  </h1>
                  <p className="text-lg text-muted-foreground md:text-xl">
                    Ask about any medicine and get clear explanations instantly in
                    English or Urdu.
                  </p>
                </div>
              </div>
            </section>

            <section id="chat" className="w-full pb-12">
                <div className="container mx-auto flex max-w-4xl flex-col gap-8 px-4">
                {/* Firebase Features Section */}
                {user && (
                  <div className="w-full max-w-4xl mx-auto">
                    <MedicalUpload />
                  </div>
                )}
                {/* Output Section */}
                <div className="w-full max-w-4xl mx-auto rounded-xl bg-secondary/30 p-4 border border-primary/50 shadow-lg shadow-primary/20 min-h-[50vh]">
                    <ScrollArea className="h-[50vh] w-full" ref={scrollAreaRef}>
                      <div className="space-y-6 p-4">
                        {messages.length === 0 && !isLoading && (
                          <div className="flex h-full items-center justify-center text-muted-foreground italic">
                            Welcome to AI-LTH. Ask me anything about any medicine.
                          </div>
                        )}
                        {messages.map((m: Message) => (
                          <div
                            key={m.id}
                            className={cn(
                              'flex items-start gap-3',
                              m.role === 'user' ? 'justify-end' : ''
                            )}
                          >
                            {m.role === 'assistant' && (
                              <Avatar className="h-8 w-8 border-2 border-primary/20">
                                <AvatarFallback className="bg-primary/20 font-bold text-primary">
                                  <Bot />
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div
                              className={cn(
                                'max-w-sm rounded-lg p-3 shadow-sm md:max-w-md lg:max-w-xl',
                                m.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              )}
                            >
                              {m.image && (
                                <img
                                  src={m.image}
                                  alt="uploaded"
                                  className="mb-2 max-w-full rounded-md"
                                />
                              )}

                              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                            </div>
                            {m.role === 'user' && (
                              <Avatar className="h-8 w-8">
                                <AvatarFallback><User /></AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8 border-2 border-primary/20">
                              <AvatarFallback className="bg-primary/20 font-bold text-primary">
                                  <Bot />
                                </AvatarFallback>
                            </Avatar>
                            <div className="rounded-lg bg-green-100/50 p-3 shadow-sm dark:bg-green-900/20">
                              <p className="animate-pulse text-sm text-muted-foreground">
                                AI is thinking...
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                {/* Chat Input Area */}
                <div className="w-full max-w-4xl mx-auto rounded-xl bg-background p-6 shadow-md border border-primary/50">
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                      <Textarea
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Ask about any medicine or type your question..."
                        className="min-h-[100px] w-full resize-none rounded-lg border-2 border-input bg-background px-4 py-3 text-base focus-visible:border-primary focus-visible:ring-0"
                        disabled={isLoading}
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isLoading || !input.trim()}
                          className="flex-1 sm:flex-none"
                        >
                          {isLoading ? (
                            <>
                              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-5 w-5" />
                              Ask AI
                            </>
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="lg">
                              {language === 'english' ? '🇬🇧 English' : '🇵🇰 Urdu'}
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLanguage('english')}>
                              🇬🇧 English
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLanguage('urdu')}>
                              🇵🇰 Urdu
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </form>
                  </div>
                </div>
            </section>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
