/**
 * Image preprocessing utilities for improving OCR accuracy
 * Optimized for handwritten medical documents
 */

export interface ImageProcessingResult {
    processedImage: string;
    processingSteps: string[];
    originalSize: { width: number; height: number };
    processedSize: { width: number; height: number };
  }
  
  /**
   * Image preprocessing service for medical documents
   */
  export class ImagePreprocessor {
    
    /**
     * Enhance image quality for better OCR recognition
     */
    async enhanceForOCR(
      imageDataUri: string,
      options: {
        enhanceContrast?: boolean;
        reduceNoise?: boolean;
        normalizeSize?: boolean;
        sharpenText?: boolean;
      } = {}
    ): Promise<ImageProcessingResult> {
      
      const processingSteps: string[] = [];
      
      try {
        // Create canvas for image processing
        const { canvas, ctx, originalSize } = await this.loadImageToCanvas(imageDataUri);
        processingSteps.push('Image loaded to canvas');
        
        // Apply processing steps
        if (options.enhanceContrast) {
          this.enhanceContrast(ctx, canvas.width, canvas.height);
          processingSteps.push('Enhanced contrast');
        }
        
        if (options.reduceNoise) {
          this.reduceNoise(ctx, canvas.width, canvas.height);
          processingSteps.push('Reduced noise');
        }
        
        if (options.sharpenText) {
          this.sharpenText(ctx, canvas.width, canvas.height);
          processingSteps.push('Sharpened text');
        }
        
        if (options.normalizeSize) {
          // Resize if too large or too small
          const { newCanvas, newCtx } = this.normalizeImageSize(canvas, ctx);
          processingSteps.push('Normalized size');
          
          // Return processed image
          const processedImage = newCanvas.toDataURL('image/jpeg', 0.9);
          
          return {
            processedImage,
            processingSteps,
            originalSize,
            processedSize: { width: newCanvas.width, height: newCanvas.height }
          };
        }
        
        // Return processed image
        const processedImage = canvas.toDataURL('image/jpeg', 0.9);
        
        return {
          processedImage,
          processingSteps,
          originalSize,
          processedSize: { width: canvas.width, height: canvas.height }
        };
        
      } catch (error) {
        console.error('[ImageProcessor] Enhancement failed:', error);
        
        // Return original image if processing fails
        return {
          processedImage: imageDataUri,
          processingSteps: ['Processing failed - using original'],
          originalSize: { width: 0, height: 0 },
          processedSize: { width: 0, height: 0 }
        };
      }
    }
    
    /**
     * Load image data URI into a canvas
     */
    private async loadImageToCanvas(imageDataUri: string): Promise<{
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      originalSize: { width: number; height: number };
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
          
          resolve({
            canvas,
            ctx,
            originalSize: { width: img.width, height: img.height }
          });
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = imageDataUri;
      });
    }
    
    /**
     * Enhance image contrast for better text visibility
     */
    private enhanceContrast(ctx: CanvasRenderingContext2D, width: number, height: number): void {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      const factor = 1.3; // Contrast enhancement factor
      const intercept = 128 * (1 - factor);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));     // Red
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept)); // Green
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept)); // Blue
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * Reduce noise using simple smoothing
     */
    private reduceNoise(ctx: CanvasRenderingContext2D, width: number, height: number): void {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const newData = new Uint8ClampedArray(data);
      
      // Simple blur to reduce noise
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          // Average with surrounding pixels
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighborIdx = ((y + dy) * width + (x + dx)) * 4 + c;
                sum += data[neighborIdx];
              }
            }
            newData[idx + c] = sum / 9;
          }
        }
      }
      
      const newImageData = new ImageData(newData, width, height);
      ctx.putImageData(newImageData, 0, 0);
    }
    
    /**
     * Sharpen text edges for better recognition
     */
    private sharpenText(ctx: CanvasRenderingContext2D, width: number, height: number): void {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const newData = new Uint8ClampedArray(data);
      
      // Sharpening kernel
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            let kernelIdx = 0;
            
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const neighborIdx = ((y + dy) * width + (x + dx)) * 4 + c;
                sum += data[neighborIdx] * kernel[kernelIdx];
                kernelIdx++;
              }
            }
            
            newData[idx + c] = Math.min(255, Math.max(0, sum));
          }
        }
      }
      
      const newImageData = new ImageData(newData, width, height);
      ctx.putImageData(newImageData, 0, 0);
    }
    
    /**
     * Normalize image size for optimal OCR processing
     */
    private normalizeImageSize(
      canvas: HTMLCanvasElement, 
      ctx: CanvasRenderingContext2D
    ): { newCanvas: HTMLCanvasElement; newCtx: CanvasRenderingContext2D } {
      
      const maxWidth = 2048;
      const maxHeight = 2048;
      const minWidth = 400;
      const minHeight = 300;
      
      let { width, height } = canvas;
      
      // Calculate scale factor
      let scale = 1;
      
      if (width > maxWidth || height > maxHeight) {
        scale = Math.min(maxWidth / width, maxHeight / height);
      } else if (width < minWidth || height < minHeight) {
        scale = Math.max(minWidth / width, minHeight / height);
      }
      
      if (scale === 1) {
        return { newCanvas: canvas, newCtx: ctx };
      }
      
      // Create new canvas with scaled size
      const newCanvas = document.createElement('canvas');
      newCanvas.width = Math.round(width * scale);
      newCanvas.height = Math.round(height * scale);
      
      const newCtx = newCanvas.getContext('2d');
      if (!newCtx) {
        return { newCanvas: canvas, newCtx: ctx };
      }
      
      // Enable image smoothing for better quality
      newCtx.imageSmoothingEnabled = true;
      newCtx.imageSmoothingQuality = 'high';
      
      // Draw scaled image
      newCtx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
      
      return { newCanvas, newCtx };
    }
    
    /**
     * Get image statistics for quality assessment
     */
    getImageStats(imageDataUri: string): Promise<{
      brightness: number;
      contrast: number;
      sharpness: number;
      recommendation: string;
    }> {
      return new Promise(async (resolve) => {
        try {
          const { canvas, ctx } = await this.loadImageToCanvas(imageDataUri);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Calculate brightness
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            totalBrightness += brightness;
          }
          const avgBrightness = totalBrightness / (data.length / 4);
          
          // Calculate contrast (simplified)
          let varianceSum = 0;
          for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            varianceSum += Math.pow(brightness - avgBrightness, 2);
          }
          const contrast = Math.sqrt(varianceSum / (data.length / 4));
          
          // Simple sharpness estimation
          const sharpness = this.estimateSharpness(data, canvas.width, canvas.height);
          
          // Generate recommendation
          let recommendation = 'Image quality is good for OCR';
          if (avgBrightness < 50) recommendation = 'Image is too dark - increase brightness';
          else if (avgBrightness > 200) recommendation = 'Image is too bright - reduce brightness';
          else if (contrast < 30) recommendation = 'Low contrast - enhance contrast for better OCR';
          else if (sharpness < 0.1) recommendation = 'Image appears blurry - use a sharper photo';
          
          resolve({
            brightness: Math.round(avgBrightness),
            contrast: Math.round(contrast),
            sharpness: Math.round(sharpness * 100) / 100,
            recommendation
          });
          
        } catch (error) {
          resolve({
            brightness: 0,
            contrast: 0,
            sharpness: 0,
            recommendation: 'Could not analyze image quality'
          });
        }
      });
    }
    
    /**
     * Estimate image sharpness using gradient magnitude
     */
    private estimateSharpness(data: Uint8ClampedArray, width: number, height: number): number {
      let sharpnessSum = 0;
      let count = 0;
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          const rightIdx = (y * width + x + 1) * 4;
          const belowIdx = ((y + 1) * width + x) * 4;
          
          // Calculate gradient in x and y directions
          const gx = Math.abs(data[rightIdx] - data[idx]);
          const gy = Math.abs(data[belowIdx] - data[idx]);
          
          sharpnessSum += Math.sqrt(gx * gx + gy * gy);
          count++;
        }
      }
      
      return count > 0 ? sharpnessSum / count / 255 : 0;
    }
  }
  
  // Export singleton instance
  export const imagePreprocessor = new ImagePreprocessor();