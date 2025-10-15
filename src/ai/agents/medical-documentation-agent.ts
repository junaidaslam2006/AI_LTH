
import { BaseAgent, AgentContext, AgentResponse } from './base-agent';

/**
 * Specialized agent for medical documentation and OCR
 * Handles document analysis, OCR for handwritten notes, and structuring medical info
 */
export class MedicalDocumentationAgent extends BaseAgent {
  constructor() {
    super(
      'MedicalDocumentationAgent',
      'Analyzes medical documents, performs OCR on handwritten notes, and structures medical information'
    );
  }

  /**
   * Check if this agent can handle medical documentation queries
   */
  canHandle(input: string, context: AgentContext): boolean {
    console.log('[MedicalDocumentationAgent] Checking if can handle:', input);
    
    // This agent is often triggered by the presence of an image, 
    // but can also be triggered by text asking to analyze a document.
    const docKeywords = [
      'document', 'prescription', 'handwritten', 'note', 'doctor\'s note',
      'medical record', 'chart', 'read this', 'analyze this document',
      'transcribe this', 'what does this say'
    ];
    
    const inputLower = input.toLowerCase();
    const canHandle = docKeywords.some(keyword => inputLower.includes(keyword));
    console.log('[MedicalDocumentationAgent] Can handle documentation query:', canHandle);
    return canHandle;
  }

  /**
   * Process medical documentation requests (primarily OCR)
   */
  async process(input: string | { text?: string; imageDataUri?: string }, context: AgentContext): Promise<AgentResponse> {
    console.log('[MedicalDocumentationAgent] Processing medical document request');
    this.log('info', 'Processing document request', { input: typeof input });
    
    // This agent requires an image
    if (typeof input === 'string' || !input.imageDataUri) {
      return {
        agentName: this.name,
        response: context.language === 'urdu'
          ? 'اس کام کے لیے براہ کرم ایک تصویر فراہم کریں۔'
          : 'Please provide an image for this task.',
        confidence: 0.2,
        metadata: { reason: 'No image provided for OCR' },
        timestamp: new Date()
      };
    }

    try {
      // Dynamic import to avoid circular dependencies
      const { medicalOCR } = await import('../ocr');

      // Validate image first
      const validation = medicalOCR.validateImage(input.imageDataUri);
      if (!validation.isValid) {
        throw new Error(`Invalid image: ${validation.message}`);
      }

      // Extract text from the handwritten document image
      const ocrResult = await medicalOCR.extractTextFromImage(input.imageDataUri);

      if (!ocrResult.extractedText || ocrResult.confidence < 0.3) {
        return {
          agentName: this.name,
          response: context.language === 'urdu'
            ? 'معذرت، میں اس دستاویز کو واضح طور پر نہیں پڑھ سکا۔ براہ کرم ایک صاف تصویر فراہم کریں۔'
            : 'I\'m sorry, I could not read this document clearly. Please provide a clearer image.',
          confidence: ocrResult.confidence,
          metadata: { reason: 'Low OCR confidence or no text extracted', ...ocrResult },
          timestamp: new Date()
        };
      }

      // After OCR, format the text for other agents to use
      const formattedResponse = this.formatOcrResponse(ocrResult, context);

      return {
        agentName: this.name,
        // The response is the transcribed text, which the orchestrator will pass to other agents
        response: formattedResponse,
        confidence: ocrResult.confidence,
        metadata: { ...ocrResult, isOcrResult: true },
        timestamp: new Date()
      };
      
    } catch (error) {
      this.log('error', 'Failed to process medical document', error);
      return {
        agentName: this.name,
        response: context.language === 'urdu' 
          ? 'معذرت، دستاویز کا تجزیہ کرتے وقت ایک خرابی واقع ہوئی۔'
          : 'An error occurred while analyzing the document.',
        confidence: 0,
        metadata: { error: true },
        timestamp: new Date()
      };
    }
  }

  /**
   * Format the OCR response to be passed to other agents
   */
  private formatOcrResponse(ocrResult: any, context: AgentContext): string {
    const header = context.language === 'urdu'
        ? `دستاویز سے نکالی گئی عبارت (اعتماد: ${(ocrResult.confidence * 100).toFixed(0)}٪):`
        : `Extracted text from document (Confidence: ${(ocrResult.confidence * 100).toFixed(0)}%):`;
    
    return `${header}\n\n"${ocrResult.extractedText}"`;
  }
}
