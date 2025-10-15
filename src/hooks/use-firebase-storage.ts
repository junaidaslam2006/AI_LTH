/**
 * Firebase Storage Hooks for AI-LTH
 * 
 * Handles secure upload and management of:
 * - Medical document images (prescriptions, reports)
 * - Medicine photos for identification
 * - User profile images
 */

'use client';

import { useState } from 'react';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  uploadBytesResumable 
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export function useFirebaseStorage() {
  const { user, isAuthenticated } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  // Upload medical document or medicine image
  const uploadMedicalImage = async (
    file: File,
    type: 'prescription' | 'medicine' | 'report' | 'profile'
  ): Promise<{ success: boolean; url?: string; path?: string }> => {
    
    if (!isFirebaseConfigured || !isAuthenticated || !user) {
      toast({
        variant: 'destructive',
        title: 'Upload Unavailable',
        description: 'Firebase Storage is not configured or you are not signed in.',
      });
      return { success: false };
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File',
        description: 'Please upload an image file (JPG, PNG, etc.)',
      });
      return { success: false };
    }

    // Check file size (5MB limit for free tier)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please upload an image smaller than 5MB.',
      });
      return { success: false };
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create storage path
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storageRef = ref(storage, `users/${user.uid}/${type}/${fileName}`);

      // Upload with progress tracking
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Track upload progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
            console.log(`[Storage] Upload ${progress.toFixed(1)}% complete`);
          },
          (error) => {
            console.error('[Storage] Upload failed:', error);
            toast({
              variant: 'destructive',
              title: 'Upload Failed',
              description: 'Could not upload image. Please try again.',
            });
            setIsUploading(false);
            reject({ success: false });
          },
          async () => {
            try {
              // Get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              console.log('[Storage] Upload successful:', downloadURL);
              toast({
                title: 'Upload Complete',
                description: 'Your image has been uploaded successfully.',
              });
              
              setIsUploading(false);
              setUploadProgress(0);
              
              resolve({
                success: true,
                url: downloadURL,
                path: storageRef.fullPath
              });
            } catch (error) {
              console.error('[Storage] Failed to get download URL:', error);
              setIsUploading(false);
              reject({ success: false });
            }
          }
        );
      });

    } catch (error) {
      console.error('[Storage] Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Error',
        description: 'An error occurred during upload. Please try again.',
      });
      setIsUploading(false);
      return { success: false };
    }
  };

  // Delete uploaded file
  const deleteUploadedFile = async (filePath: string): Promise<boolean> => {
    if (!isFirebaseConfigured || !isAuthenticated) {
      return false;
    }

    try {
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
      
      console.log('[Storage] File deleted successfully:', filePath);
      return true;
    } catch (error) {
      console.error('[Storage] Failed to delete file:', error);
      return false;
    }
  };

  // Convert data URI to File for upload
  const dataUriToFile = (dataUri: string, fileName: string): File => {
    const arr = dataUri.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], fileName, { type: mime });
  };

  // Upload from data URI (useful for camera captures)
  const uploadFromDataUri = async (
    dataUri: string,
    type: 'prescription' | 'medicine' | 'report',
    fileName: string = 'capture.jpg'
  ) => {
    const file = dataUriToFile(dataUri, fileName);
    return await uploadMedicalImage(file, type);
  };

  return {
    isUploading,
    uploadProgress,
    uploadMedicalImage,
    uploadFromDataUri,
    deleteUploadedFile,
    isStorageReady: isFirebaseConfigured && isAuthenticated
  };
}