/**
 * Firebase Configuration for AI-LTH Medical Assistant
 * 
 * This configures Firebase services for:
 * - Authentication: User accounts and secure login
 * - Firestore: Chat history and user data storage  
 * - Storage: Medical document and image uploads
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Validate Firebase configuration
const isFirebaseConfigured = Object.values(firebaseConfig).every(value => 
  value && value !== 'your_firebase_api_key_here'
);

if (!isFirebaseConfigured) {
  console.warn('[Firebase] Configuration not complete. Add Firebase config to .env.local');
  console.warn('[Firebase] Create a project at https://console.firebase.google.com/');
}

// Initialize Firebase
let app, auth, db, storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  if (isFirebaseConfigured) {
    console.log('[Firebase] ✅ Successfully initialized');
  }
} catch (error) {
  console.error('[Firebase] ❌ Failed to initialize:', error);
}

export { app, auth, db, storage, isFirebaseConfigured };