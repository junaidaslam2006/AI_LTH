/**
 * Firestore Database Hooks for AI-LTH
 * 
 * Handles persistent storage of:
 * - Chat conversations and history
 * - User medicine searches  
 * - User preferences and settings
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Message, ChatSession } from '@/hooks/use-chat';

export function useFirestoreChat() {
  const { user, isAuthenticated } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Save chat session to Firestore
  const saveChatToFirestore = async (chatId: string, messages: Message[], title?: string) => {
    if (!isFirebaseConfigured || !isAuthenticated || !user) {
      return false;
    }

    setIsSyncing(true);
    try {
      const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
      
      const chatData = {
        id: chatId,
        title: title || messages.find(m => m.role === 'user')?.content.substring(0, 30) || 'New Chat',
        messages: messages,
        lastUpdated: serverTimestamp(),
        messageCount: messages.length
      };

      await setDoc(chatRef, chatData);
      console.log('[Firestore] Chat saved successfully:', chatId);
      return true;
    } catch (error) {
      console.error('[Firestore] Failed to save chat:', error);
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: 'Could not save chat to cloud. Your data is still saved locally.',
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Load chat sessions from Firestore
  const loadChatsFromFirestore = async (): Promise<ChatSession[]> => {
    if (!isFirebaseConfigured || !isAuthenticated || !user) {
      return [];
    }

    try {
      const chatsRef = collection(db, 'users', user.uid, 'chats');
      const q = query(chatsRef, orderBy('lastUpdated', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      
      const chats: ChatSession[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        chats.push({
          id: data.id,
          title: data.title,
          messages: data.messages || []
        });
      });

      console.log('[Firestore] Loaded', chats.length, 'chats from cloud');
      return chats;
    } catch (error) {
      console.error('[Firestore] Failed to load chats:', error);
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: 'Could not load chats from cloud. Using local data.',
      });
      return [];
    }
  };

  // Delete chat from Firestore
  const deleteChatFromFirestore = async (chatId: string) => {
    if (!isFirebaseConfigured || !isAuthenticated || !user) {
      return false;
    }

    try {
      const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
      await deleteDoc(chatRef);
      console.log('[Firestore] Chat deleted successfully:', chatId);
      return true;
    } catch (error) {
      console.error('[Firestore] Failed to delete chat:', error);
      return false;
    }
  };

  // Save user preferences
  const saveUserPreferences = async (preferences: {
    language: 'english' | 'urdu';
    theme?: 'light' | 'dark';
    [key: string]: any;
  }) => {
    if (!isFirebaseConfigured || !isAuthenticated || !user) {
      return false;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        preferences,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error('[Firestore] Failed to save preferences:', error);
      return false;
    }
  };

  // Load user preferences
  const loadUserPreferences = async () => {
    if (!isFirebaseConfigured || !isAuthenticated || !user) {
      return null;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        return docSnap.data().preferences;
      }
      return null;
    } catch (error) {
      console.error('[Firestore] Failed to load preferences:', error);
      return null;
    }
  };

  return {
    isSyncing,
    saveChatToFirestore,
    loadChatsFromFirestore,
    deleteChatFromFirestore,
    saveUserPreferences,
    loadUserPreferences,
    isFirebaseReady: isFirebaseConfigured && isAuthenticated
  };
}