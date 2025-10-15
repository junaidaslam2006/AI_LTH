/**
 * OCR Service for Handwritten Medical Documents
 * Uses Microsoft TrOCR Large model - optimized for messy medical handwriting
 * 
 * Primary Model: microsoft/trocr-large-handwritten
 * - Larger transformer model with better accuracy on medical handwriting
 * - Specifically good at doctor's messy cursive writing and medical abbreviations
 * - Improved recognition of pharmaceutical terms and dosage information
 * 
 * Fallback Model: microsoft/trocr-base-handwritten  
 * - Used when large model has low confidence
 * - Sometimes better at simpler, clearer handwriting
 */

interface OCRResult {
    extractedText: string;
    confidence: number;
    processingTime: number;
    modelUsed: string;
  }
  
  /**
   * OCR Service class for processing handwritten medical documents
   */
  export class MedicalOCRService {
    private readonly model = 'microsoft/trocr-large-handwritten';
    private readonly fallbackModel = 'microsoft/trocr-base-handwritten';
  
    /**
     * Extract text from handwritten medical document image
     */
    async extractTextFromImage(
      imageDataUri: string
    ): Promise<OCRResult> {
      const startTime = Date.now();
      
      try {
        console.log('[OCR] Starting text extraction from handwritten document');
        
        // Try primary large handwritten model first (best for medical handwriting)
        let result = await this.performOCR(imageDataUri, this.model);
        
        // If confidence is low, try fallback base model (faster, sometimes catches different patterns)
        if (result.confidence < 0.5) {
          console.log('[OCR] Low confidence with large model, trying base handwritten fallback');
          const fallbackResult = await this.performOCR(imageDataUri, this.fallbackModel);
          
          // Use better result - large model usually wins but sometimes base catches simpler text better
          if (fallbackResult.confidence > result.confidence) {
            console.log('[OCR] Base model performed better, using its result');
            result = fallbackResult;
          } else {
            console.log('[OCR] Large model result retained (better confidence)');
          }
        } else {
          console.log('[OCR] Large model achieved good confidence, proceeding with result');
        }
        
        const processingTime = Date.now() - startTime;
        
        console.log(`[OCR] Text extraction completed in ${processingTime}ms`);
        console.log(`[OCR] Confidence: ${result.confidence}`);
        console.log(`[OCR] Extracted text length: ${result.extractedText.length} characters`);
        
        return {
          ...result,
          processingTime
        };
        
      } catch (error) {
        console.error('[OCR] Error extracting text:', error);
        
        return {
          extractedText: '',
          confidence: 0,
          processingTime: Date.now() - startTime,
          modelUsed: 'error'
        };
      }
    }
  
    /**
     * Perform OCR using HuggingFace TrOCR model
     */
    private async performOCR(imageDataUri: string, modelName: string): Promise<OCRResult> {
      try {
        // Dynamic import to avoid circular dependencies
        const { huggingFaceClient } = await import('./huggingface');
        
        // Convert data URI to blob for HuggingFace API
        const imageBlob = this.dataUriToBlob(imageDataUri);
        
        // Call HuggingFace OCR API
        const response = await huggingFaceClient.performOCR(imageBlob, modelName);
        
        return {
          extractedText: response.generated_text || '',
          confidence: this.calculateConfidence(response),
          processingTime: 0, // Will be set by caller
          modelUsed: modelName
        };
        
      } catch (error) {
        console.error(`[OCR] Error with model ${modelName}:`, error);
        throw error;
      }
    }
  
    /**
     * Convert data URI to Blob for API calls
     */
    private dataUriToBlob(dataUri: string): Blob {
      const [header, data] = dataUri.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const binary = atob(data);
      const array = new Uint8Array(binary.length);
      
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      
      return new Blob([array], { type: mime });
    }
  
    /**
     * Calculate confidence score from HuggingFace response
     * Enhanced for medical handwriting recognition with TrOCR Large
     */
    private calculateConfidence(response: any): number {
      // HuggingFace doesn't always return confidence scores
      // We'll implement medical-specific heuristics for TrOCR Large
      
      const text = response.generated_text || '';
      
      if (!text) return 0;
      
      // Base confidence higher for TrOCR Large (it's more accurate)
      let confidence = 0.6; // Higher base confidence for large model
      
      // Longer medical text generally means better recognition
      if (text.length > 30) confidence += 0.15;
      if (text.length > 100) confidence += 0.1;
      if (text.length > 250) confidence += 0.05;
      
      // Enhanced medical terms detection for doctors' handwriting
      const medicalTerms = [
        // Common prescription terms
        'patient', 'diagnosis', 'treatment', 'prescription', 'medicine', 'medication',
        'dose', 'dosage', 'mg', 'tablet', 'capsule', 'syrup', 'injection',
        // Medical abbreviations doctors use
        'bid', 'tid', 'qid', 'prn', 'po', 'iv', 'im', 'od', 'bd',
        // Common medical words in handwriting
        'take', 'daily', 'twice', 'morning', 'evening', 'after', 'before',
        'food', 'meal', 'pain', 'fever', 'blood', 'pressure', 'sugar',
        // Drug categories
        'antibiotic', 'painkiller', 'vitamin', 'supplement', 'drops', 'ointment'
      ];
      
      const foundTerms = medicalTerms.filter(term => 
        text.toLowerCase().includes(term.toLowerCase())
      ).length;
      
      confidence += Math.min(foundTerms * 0.03, 0.25); // More generous for medical terms
      
      // Check for medical dosage patterns (good sign for medical documents)
      const dosagePatterns = [
        /\d+\s*mg/gi,           // "10 mg", "250mg"
        /\d+\s*ml/gi,           // "5 ml", "10ml"  
        /\d+\s*times?/gi,       // "2 times", "3 time"
        /\d+x\s*daily/gi,       // "2x daily"
        /\d+\/day/gi,           // "1/day"
        /\d+\s*tablet/gi,       // "1 tablet"
        /\d+\s*capsule/gi       // "2 capsules"
      ];
      
      const dosageMatches = dosagePatterns.reduce((count, pattern) => {
        return count + (text.match(pattern) || []).length;
      }, 0);
      
      confidence += Math.min(dosageMatches * 0.08, 0.2); // High bonus for dosage info
      
      // Check for medical abbreviation patterns
      const medicalAbbrevs = /\b(bid|tid|qid|prn|po|iv|im|od|bd|hs|ac|pc|qh|stat)\b/gi;
      const abbrevMatches = (text.match(medicalAbbrevs) || []).length;
      confidence += Math.min(abbrevMatches * 0.1, 0.15);
      
      // Penalize for excessive special characters (but be more lenient for medical symbols)
      const specialChars = (text.match(/[^a-zA-Z0-9\s.,!?()\-\/]/g) || []).length;
      const specialRatio = specialChars / text.length;
      if (specialRatio > 0.15) confidence -= 0.15; // More lenient threshold
      
      // Boost confidence if text looks like typical medical prescription format
      const prescriptionIndicators = [
        /rx[:\s]/gi,                    // "Rx:" or "Rx "
        /sig[:\s]/gi,                   // "Sig:" or "Sig "
        /dispense?[:\s]/gi,             // "Disp:" or "Dispense "
        /refill/gi,                     // "Refill"
        /\d+\s*refills?/gi,             // "2 refills"
        /doctor|dr\.?/gi,               // "Doctor" or "Dr."
        /pharmacy/gi                     // "Pharmacy"
      ];
      
      const prescriptionMatches = prescriptionIndicators.reduce((count, pattern) => {
        return count + (text.match(pattern) || []).length;
      }, 0);
      
      if (prescriptionMatches > 0) confidence += 0.1; // Prescription format bonus
      
      return Math.max(0.1, Math.min(1, confidence)); // Minimum 10% confidence
    }
  
    /**
     * Validate if image is suitable for OCR
     */
    validateImage(imageDataUri: string): { isValid: boolean; message: string } {
      try {
        if (!imageDataUri || !imageDataUri.startsWith('data:image/')) {
          return { isValid: false, message: 'Invalid image format' };
        }
        
        // Check image size (basic validation)
        const sizeInBytes = (imageDataUri.length * 3) / 4;
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (sizeInBytes > maxSize) {
          return { isValid: false, message: 'Image too large (max 10MB)' };
        }
        
        return { isValid: true, message: 'Image is valid for OCR processing' };
        
      } catch (error) {
        return { isValid: false, message: 'Error validating image' };
      }
    }
  }
  
  // Export instance for easy use
  export const medicalOCR = new MedicalOCRService();
