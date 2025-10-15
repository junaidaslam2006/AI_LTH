/**
 * @fileOverview Hugging Face Integration for Medical NLP
 * 
 * This module provides integration with Hugging Face models for medical
 * entity recognition, drug classification, and other medical AI tasks.
 */

export interface HuggingFaceConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface MedicalEntity {
  text: string;
  label: string;
  confidence: number;
  start: number;
  end: number;
}

export interface DrugClassification {
  drugName: string;
  therapeuticClass: string;
  confidence: number;
  additionalInfo?: Record<string, any>;
}

export class HuggingFaceClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: HuggingFaceConfig) {
    this.apiKey = config?.apiKey || process.env.HUGGINGFACE_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://api-inference.huggingface.co';

    if (!this.apiKey) {
      console.warn('[HuggingFace] No API key found - Hugging Face features will be limited');
      console.warn('[HuggingFace] Add HUGGINGFACE_API_KEY to .env.local for full functionality');
    } else {
      console.log('[HuggingFace] Client initialized successfully');
    }
  }

  /**
   * Extract medical entities from text using BioBERT model
   */
  async extractMedicalEntities(text: string): Promise<MedicalEntity[]> {
    if (!this.apiKey) {
      console.warn('[HuggingFace] Skipping entity extraction - no API key');
      return this.fallbackEntityExtraction(text);
    }
    
    try {
      const response = await this.callHuggingFaceAPI(
        'models/d4data/biomedical-ner-all',
        {
          inputs: text,
          options: { wait_for_model: true }
        }
      );

      if (!response || !Array.isArray(response)) {
        console.warn('[HuggingFace] No entities found or invalid response, using fallback');
        return this.fallbackEntityExtraction(text);
      }

      return response.map((entity: any) => ({
        text: entity.word,
        label: entity.entity_group || entity.entity,
        confidence: entity.score,
        start: entity.start,
        end: entity.end
      }));
    } catch (error) {
      console.error('[HuggingFace] Medical entity extraction failed, using fallback:', error);
      return this.fallbackEntityExtraction(text);
    }
  }

  /**
   * Simple fallback entity extraction using regex patterns
   */
  private fallbackEntityExtraction(text: string): MedicalEntity[] {
    const entities: MedicalEntity[] = [];
    
    // Common medicine name patterns
    const medicinePatterns = [
      /\b(paracetamol|acetaminophen|ibuprofen|aspirin|panadol|advil|tylenol)\b/gi,
      /\b\w+\s?(tablet|capsule|syrup|drops|injection|mg|ml)\b/gi
    ];
    
    medicinePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          label: 'MEDICATION',
          confidence: 0.7,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    });
    
    return entities;
  }

  /**
   * Classify drug information using medical classification model
   */
  async classifyDrug(drugText: string): Promise<DrugClassification | null> {
    try {
      const response = await this.callHuggingFaceAPI(
        'models/microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract',
        {
          inputs: `Drug classification: ${drugText}`,
          options: { wait_for_model: true }
        }
      );

      // This is a simplified implementation - in a real scenario,
      // you'd use a specialized drug classification model
      return {
        drugName: drugText,
        therapeuticClass: 'Unknown', // Would be extracted from model response
        confidence: 0.8,
        additionalInfo: response
      };
    } catch (error) {
      console.error('[HuggingFace] Drug classification failed:', error);
      return null;
    }
  }

  /**
   * Generate medical embeddings for similarity search
   */
  async generateMedicalEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await this.callHuggingFaceAPI(
        'models/microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract',
        {
          inputs: text,
          options: { 
            wait_for_model: true,
            use_cache: true
          }
        }
      );

      // Extract embeddings from the response
      if (response && Array.isArray(response) && response.length > 0) {
        return response[0];
      }
      
      return [];
    } catch (error) {
      console.error('[HuggingFace] Embedding generation failed:', error);
      return [];
    }
  }

  /**
   * Analyze medical text for sentiment and urgency
   */
  async analyzeMedicalSentiment(text: string): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral';
    urgency: 'low' | 'medium' | 'high';
    confidence: number;
  }> {
    try {
      const response = await this.callHuggingFaceAPI(
        'models/cardiffnlp/twitter-roberta-base-sentiment-latest',
        {
          inputs: text,
          options: { wait_for_model: true }
        }
      );

      if (!response || !Array.isArray(response) || response.length === 0) {
        return { sentiment: 'neutral', urgency: 'low', confidence: 0 };
      }

      const sentimentData = response[0];
      const sentiment = sentimentData.label?.toLowerCase().includes('positive') ? 'positive' 
                       : sentimentData.label?.toLowerCase().includes('negative') ? 'negative' 
                       : 'neutral';

      // Simple urgency detection based on keywords
      const urgentKeywords = ['emergency', 'urgent', 'severe', 'critical', 'immediate', 'pain', 'bleeding'];
      const urgency = urgentKeywords.some(keyword => text.toLowerCase().includes(keyword)) ? 'high' : 'low';

      return {
        sentiment,
        urgency,
        confidence: sentimentData.score || 0
      };
    } catch (error) {
      console.error('[HuggingFace] Sentiment analysis failed:', error);
      return { sentiment: 'neutral', urgency: 'low', confidence: 0 };
    }
  }

  /**
   * Extract drug interactions from medical text
   */
  async extractDrugInteractions(text: string): Promise<{
    drugs: string[];
    interactions: Array<{
      drug1: string;
      drug2: string;
      interactionType: string;
      severity: 'mild' | 'moderate' | 'severe';
      confidence: number;
    }>;
  }> {
    try {
      // First extract medical entities to find drugs
      const entities = await this.extractMedicalEntities(text);
      const drugs = entities
        .filter(entity => entity.label.toLowerCase().includes('drug') || entity.label.toLowerCase().includes('medication'))
        .map(entity => entity.text);

      // For now, return a basic structure
      // In a real implementation, you'd use a specialized interaction detection model
      return {
        drugs: drugs,
        interactions: [] // Would be populated by specialized model
      };
    } catch (error) {
      console.error('[HuggingFace] Drug interaction extraction failed:', error);
      return { drugs: [], interactions: [] };
    }
  }

  /**
   * Private method to make API calls to Hugging Face
   */
  private async callHuggingFaceAPI(endpoint: string, data: any): Promise<any> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Handle model loading cases
      if (result.error && result.error.includes('loading')) {
        console.log('[HuggingFace] Model is loading, retrying in 10 seconds...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        return this.callHuggingFaceAPI(endpoint, data);
      }

      return result;
    } catch (error) {
      console.error(`[HuggingFace] API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Perform OCR on image using TrOCR models for handwritten text
   */
  async performOCR(imageBlob: Blob, modelName: string = 'microsoft/trocr-base-handwritten'): Promise<{ generated_text: string }> {
    console.log(`[HuggingFace] Starting OCR with model: ${modelName}`);
    
    try {
      const formData = new FormData();
      formData.append('inputs', imageBlob);
      
      const response = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OCR API HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Handle model loading cases
      if (result.error && result.error.includes('loading')) {
        console.log('[HuggingFace] OCR model is loading, retrying in 15 seconds...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        return this.performOCR(imageBlob, modelName);
      }

      // TrOCR returns array with generated_text
      if (Array.isArray(result) && result.length > 0) {
        return { generated_text: result[0].generated_text || '' };
      }
      
      // Direct object response
      return { generated_text: result.generated_text || '' };
      
    } catch (error) {
      console.error(`[HuggingFace] OCR failed for model ${modelName}:`, error);
      throw error;
    }
  }
}

// Create singleton instance - will automatically use HUGGINGFACE_API_KEY from environment
export const huggingFaceClient = new HuggingFaceClient();