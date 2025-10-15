/**
 * Firebase Authentication Hooks for AI-LTH
 * 
 * Provides user authentication functionality including:
 * - Sign up with email/password
 * - Sign in with email/password  
 * - Sign out
 * - Authentication state monitoring
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { toast } = useToast();

  // Monitor authentication state
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        console.log('[Auth] User signed in:', user.email);
      } else {
        console.log('[Auth] User signed out');
      }
    });

    return unsubscribe;
  }, []);

  // Sign up new user
  const signUp = async (email: string, password: string) => {
    if (!isFirebaseConfigured) {
      toast({
        variant: 'destructive',
        title: 'Authentication Unavailable',
        description: 'Firebase is not configured. Authentication features are disabled.',
      });
      return { success: false, error: 'Firebase not configured' };
    }

    setIsSigningIn(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Account Created',
        description: 'Welcome to AI-LTH! You can now save your medicine searches.',
      });
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      toast({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: errorMessage,
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sign in existing user
  const signIn = async (email: string, password: string) => {
    if (!isFirebaseConfigured) {
      toast({
        variant: 'destructive',
        title: 'Authentication Unavailable', 
        description: 'Firebase is not configured. Authentication features are disabled.',
      });
      return { success: false, error: 'Firebase not configured' };
    }

    setIsSigningIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Welcome Back!',
        description: 'You can now access your saved medicine searches.',
      });
      return { success: true, user: userCredential.user };
    } catch (error: any) {
      const errorMessage = getAuthErrorMessage(error.code);
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: errorMessage,
      });
      return { success: false, error: errorMessage };
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sign out user
  const signOut = async () => {
    if (!isFirebaseConfigured) return;

    try {
      await firebaseSignOut(auth);
      toast({
        title: 'Signed Out',
        description: 'You have been successfully signed out.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Sign Out Failed',
        description: 'There was an error signing out. Please try again.',
      });
    }
  };

  return {
    user,
    loading,
    isSigningIn,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!user,
    isFirebaseConfigured
  };
}

// Helper function to convert Firebase auth errors to user-friendly messages
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'An authentication error occurred. Please try again.';
  }
}