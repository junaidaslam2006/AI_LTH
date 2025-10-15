/**
 * Client-side image processing utilities
 * These functions run in the browser and process images before sending to server
 */

/**
 * Enhanced image processing for better OCR results
 * Runs entirely in the browser before sending to server
 */
export async function processImageForOCR(imageDataUri: string): Promise<string> {
  try {
    console.log('[ClientImageProcessor] Processing image for OCR');
    
    // Load image into canvas
    const { canvas, ctx } = await loadImageToCanvas(imageDataUri);
    
    // Apply enhancements
    enhanceContrastAndSharpness(ctx, canvas.width, canvas.height);
    
    // Return processed image
    const processedImageUri = canvas.toDataURL('image/jpeg', 0.9);
    console.log('[ClientImageProcessor] Image processing complete');
    
    return processedImageUri;
  } catch (error) {
    console.error('[ClientImageProcessor] Processing failed:', error);
    return imageDataUri; // Return original if processing fails
  }
}

/**
 * Load image data URI into browser canvas
 */
async function loadImageToCanvas(imageDataUri: string): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      resolve({ canvas, ctx });
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUri;
  });
}

/**
 * Enhance contrast and sharpness for better OCR
 */
function enhanceContrastAndSharpness(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Enhance contrast
  const factor = 1.3;
  const intercept = 128 * (1 - factor);
  
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast enhancement to RGB channels
    data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));     // Red
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept)); // Green  
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept)); // Blue
    // Alpha channel (data[i + 3]) remains unchanged
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Validate image before processing
 */
export function validateImageForProcessing(imageDataUri: string): { isValid: boolean; message: string } {
  try {
    if (!imageDataUri || !imageDataUri.startsWith('data:image/')) {
      return { isValid: false, message: 'Invalid image format' };
    }
    
    // Check image size (estimate from base64 length)
    const sizeInBytes = (imageDataUri.length * 3) / 4;
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    
    if (sizeInBytes > maxSize) {
      return { isValid: false, message: 'Image too large (max 10MB)' };
    }
    
    return { isValid: true, message: 'Image is valid for processing' };
    
  } catch (error) {
    return { isValid: false, message: 'Error validating image' };
  }
}