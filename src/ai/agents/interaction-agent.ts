/**
 * @fileOverview Drug Interaction Agent - Specialized agent for drug interactions and safety
 * 
 * This agent handles drug-drug interactions, contraindications, food interactions,
 * and provides safety warnings for medication combinations.
 */

import { BaseAgent, AgentContext, AgentResponse } from './base-agent';
import { huggingFaceClient } from '../huggingface';
import { z } from 'zod';

const InteractionInputSchema = z.object({
  medications: z.array(z.string()).optional(),
  text: z.string().optional(),
  patientConditions: z.array(z.string()).optional(),
  age: z.number().optional(),
  isPregnant: z.boolean().optional()
});

const InteractionOutputSchema = z.object({
  interactions: z.array(z.object({
    drug1: z.string(),
    drug2: z.string(),
    severity: z.enum(['mild', 'moderate', 'severe', 'contraindicated']),
    description: z.string(),
    clinicalEffect: z.string(),
    management: z.string()
  })),
  contraindications: z.array(z.object({
    medication: z.string(),
    condition: z.string(),
    reason: z.string(),
    severity: z.enum(['warning', 'contraindicated'])
  })),
  foodInteractions: z.array(z.object({
    medication: z.string(),
    food: z.string(),
    effect: z.string(),
    recommendation: z.string()
  })),
  overallRiskLevel: z.enum(['low', 'moderate', 'high', 'critical'])
});

export class DrugInteractionAgent extends BaseAgent {
  constructor() {
    super(
      'InteractionAgent',
      'Specialized agent for analyzing drug interactions, contraindications, and medication safety warnings'
    );
    
    this.capabilities = [
      {
        name: 'checkDrugInteractions',
        description: 'Analyze interactions between multiple medications',
        inputSchema: InteractionInputSchema,
        outputSchema: InteractionOutputSchema
      },
      {
        name: 'checkContraindications',
        description: 'Check if medications are safe for patient conditions',
        inputSchema: InteractionInputSchema,
        outputSchema: InteractionOutputSchema
      }
    ];
  }

  /**
   * Check if this agent can handle the query
   */
  canHandle(input: string, context: AgentContext): boolean {
    const interactionKeywords = [
      'interaction', 'interact', 'combine', 'together', 'with',
      'safe', 'contraindication', 'avoid', 'warning', 'dangerous',
      'taking multiple', 'drug interaction', 'medication safety',
      'can i take', 'should i avoid', 'blood pressure medication'
    ];
    
    const inputLower = input.toLowerCase();
    return interactionKeywords.some(keyword => inputLower.includes(keyword));
  }

  /**
   * Main processing method
   */
  async process(input: any, context: AgentContext): Promise<AgentResponse> {
    this.log('info', 'Processing drug interaction request');
    
    try {
      let medications: string[] = [];
      let patientConditions: string[] = [];
      let patientInfo = {};

      // Extract medication and patient information
      if (typeof input === 'string') {
        const extractedInfo = await this.extractMedicationInfo(input, context);
        medications = extractedInfo.medications;
        patientConditions = extractedInfo.conditions;
        patientInfo = extractedInfo.patientInfo;
      } else if (input.medications) {
        medications = input.medications;
        patientConditions = input.patientConditions || [];
        patientInfo = {
          age: input.age,
          isPregnant: input.isPregnant
        };
      }

      if (medications.length === 0) {
        throw new Error('No medications found to analyze');
      }

      // Perform comprehensive interaction analysis
      const interactionAnalysis = await this.analyzeInteractions(
        medications,
        patientConditions,
        patientInfo,
        context
      );

      // Format response
      const formattedResponse = await this.formatInteractionResponse(
        interactionAnalysis,
        medications,
        context
      );

      return {
        agentName: this.name,
        response: formattedResponse,
        confidence: 0.85,
        metadata: {
          medications: medications,
          patientConditions: patientConditions,
          interactionAnalysis: interactionAnalysis
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.log('error', 'Failed to process interaction request', error);
      return {
        agentName: this.name,
        response: context.language === 'urdu'
          ? 'معذرت، میں دوائیوں کی تعامل کا تجزیہ کرنے میں ناکام ہوں۔ براہ کرم اپنے ڈاکٹر سے مشورہ کریں۔'
          : "I'm sorry, I couldn't analyze the drug interactions. Please consult your healthcare provider for medication safety advice.",
        confidence: 0,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      };
    }
  }

  /**
   * Extract medication and patient information from text
   */
  private async extractMedicationInfo(text: string, context: AgentContext): Promise<{
    medications: string[];
    conditions: string[];
    patientInfo: any;
  }> {
    // Use Hugging Face to extract medical entities
    const entities = await huggingFaceClient.extractMedicalEntities(text);
    
    const medications = entities
      .filter(e => e.label.toLowerCase().includes('drug') || e.label.toLowerCase().includes('medication'))
      .map(e => e.text);

    const conditions = entities
      .filter(e => e.label.toLowerCase().includes('disease') || e.label.toLowerCase().includes('condition'))
      .map(e => e.text);

    // Use LLM to extract additional information
    const extractionPrompt = `Extract medication names and patient conditions from this text:

"${text}"

Please identify:
1. All medication names mentioned
2. Any medical conditions mentioned
3. Patient demographics (age, pregnancy status if mentioned)

Format as:
Medications: [list]
Conditions: [list]
Age: [if mentioned]
Pregnant: [yes/no if mentioned]`;

    const response = await this.callLLM(
      'You are a medical information extraction specialist.',
      extractionPrompt,
      context
    );

    // Parse LLM response to supplement entity extraction
    const llmMeds = this.extractListFromResponse(response, 'Medications:');
    const llmConditions = this.extractListFromResponse(response, 'Conditions:');
    
    return {
      medications: [...new Set([...medications, ...llmMeds])].filter(Boolean),
      conditions: [...new Set([...conditions, ...llmConditions])].filter(Boolean),
      patientInfo: this.extractPatientInfo(response)
    };
  }

  /**
   * Analyze drug interactions comprehensively
   */
  private async analyzeInteractions(
    medications: string[],
    patientConditions: string[],
    patientInfo: any,
    context: AgentContext
  ): Promise<any> {
    const analysisPrompt = `Analyze the following medication combination for interactions and safety:

Medications: ${medications.join(', ')}
Patient Conditions: ${patientConditions.join(', ')}
Patient Info: ${JSON.stringify(patientInfo)}

Provide a comprehensive analysis including:

1. **Drug-Drug Interactions:**
   For each interaction, specify:
   - Medications involved
   - Severity (mild/moderate/severe/contraindicated)
   - Clinical effect and mechanism
   - Management recommendations

2. **Contraindications:**
   - Any medications contraindicated with patient conditions
   - Reasons and severity level

3. **Food/Lifestyle Interactions:**
   - Important dietary restrictions
   - Alcohol interactions
   - Timing considerations

4. **Special Populations:**
   - Age-related considerations
   - Pregnancy/breastfeeding safety
   - Kidney/liver function considerations

5. **Overall Risk Assessment:**
   - Overall risk level (low/moderate/high/critical)
   - Most concerning interactions
   - Immediate actions needed

Be thorough and evidence-based. If no significant interactions exist, state this clearly.`;

    const response = await this.callLLM(
      'You are a clinical pharmacist specializing in drug interactions and medication safety. Provide accurate, evidence-based analysis.',
      analysisPrompt,
      context
    );

    return this.parseInteractionAnalysis(response);
  }

  /**
   * Parse structured interaction analysis from LLM response
   */
  private parseInteractionAnalysis(response: string): any {
    const sections = this.splitIntoSections(response);
    
    return {
      drugInteractions: this.extractDrugInteractions(sections['drug-drug interactions'] || ''),
      contraindications: this.extractContraindications(sections['contraindications'] || ''),
      foodInteractions: this.extractFoodInteractions(sections['food/lifestyle interactions'] || ''),
      specialConsiderations: sections['special populations'] || '',
      overallRisk: this.extractOverallRisk(sections['overall risk assessment'] || ''),
      rawAnalysis: response
    };
  }

  /**
   * Extract drug interactions from text
   */
  private extractDrugInteractions(text: string): any[] {
    const interactions = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.includes('-') && (line.toLowerCase().includes('with') || line.toLowerCase().includes('and'))) {
        // Simple parsing - in real implementation, use more sophisticated NLP
        const interaction = {
          drugs: this.extractDrugNames(line),
          severity: this.extractSeverity(line),
          description: line.trim(),
          clinicalEffect: '',
          management: ''
        };
        
        if (interaction.drugs.length >= 2) {
          interactions.push(interaction);
        }
      }
    }
    
    return interactions;
  }

  /**
   * Extract contraindications from text
   */
  private extractContraindications(text: string): any[] {
    const contraindications = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.toLowerCase().includes('contraindicated') || line.toLowerCase().includes('avoid')) {
        contraindications.push({
          medication: this.extractDrugNames(line)[0] || 'Unknown',
          condition: 'Various conditions', // Would extract specific conditions
          reason: line.trim(),
          severity: line.toLowerCase().includes('contraindicated') ? 'contraindicated' : 'warning'
        });
      }
    }
    
    return contraindications;
  }

  /**
   * Extract food interactions from text
   */
  private extractFoodInteractions(text: string): any[] {
    const foodInteractions = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.toLowerCase().includes('food') || line.toLowerCase().includes('alcohol') || line.toLowerCase().includes('dietary')) {
        foodInteractions.push({
          medication: 'Multiple medications',
          food: this.extractFoodItems(line)[0] || 'Various foods',
          effect: line.trim(),
          recommendation: ''
        });
      }
    }
    
    return foodInteractions;
  }

  /**
   * Format interaction response based on language
   */
  private async formatInteractionResponse(
    analysis: any,
    medications: string[],
    context: AgentContext
  ): Promise<string> {
    const formatPrompt = `Format the following drug interaction analysis into a clear, professional response in ${context.language}:

Medications Analyzed: ${medications.join(', ')}

Analysis Results:
${JSON.stringify(analysis, null, 2)}

Create a structured response with:
1. **Summary of Analysis**
2. **Key Interactions Found** (if any)
3. **Important Warnings** (if any)
4. **Recommendations**
5. **When to Seek Medical Attention**

Use clear headings and bullet points. Include severity indicators where appropriate.
Always end with a strong medical disclaimer about consulting healthcare providers.`;

    return await this.callLLM(
      `You are a clinical pharmacist explaining drug interactions to patients. Be clear, thorough, and emphasize safety. Format in ${context.language}.`,
      formatPrompt,
      context
    );
  }

  // Helper methods for parsing
  private extractListFromResponse(response: string, marker: string): string[] {
    const lines = response.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(marker)) {
        const listText = lines[i].substring(lines[i].indexOf(marker) + marker.length).trim();
        return listText.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    return [];
  }

  private extractPatientInfo(response: string): any {
    const info: any = {};
    if (response.includes('Age:')) {
      const ageMatch = response.match(/Age:\s*(\d+)/);
      if (ageMatch) info.age = parseInt(ageMatch[1]);
    }
    if (response.toLowerCase().includes('pregnant: yes')) {
      info.isPregnant = true;
    }
    return info;
  }

  private splitIntoSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = text.split('\n');
    let currentSection = '';
    let currentContent = '';
    
    for (const line of lines) {
      if (line.startsWith('**') || line.match(/^\d+\./)) {
        if (currentSection) {
          sections[currentSection.toLowerCase()] = currentContent.trim();
        }
        currentSection = line.replace(/\*\*/g, '').replace(/^\d+\./, '').trim();
        currentContent = '';
      } else {
        currentContent += line + '\n';
      }
    }
    
    if (currentSection) {
      sections[currentSection.toLowerCase()] = currentContent.trim();
    }
    
    return sections;
  }

  private extractDrugNames(text: string): string[] {
    // Simple regex for common drug patterns - would use more sophisticated NLP in production
    const drugPattern = /([A-Z][a-z]+(?:ine|ol|ide|ate|um|ic acid|mycin|cillin))/g;
    const matches = text.match(drugPattern) || [];
    return matches;
  }

  private extractSeverity(text: string): 'mild' | 'moderate' | 'severe' | 'contraindicated' {
    const lower = text.toLowerCase();
    if (lower.includes('contraindicated') || lower.includes('dangerous')) return 'contraindicated';
    if (lower.includes('severe') || lower.includes('major')) return 'severe';
    if (lower.includes('moderate')) return 'moderate';
    return 'mild';
  }

  private extractOverallRisk(text: string): 'low' | 'moderate' | 'high' | 'critical' {
    const lower = text.toLowerCase();
    if (lower.includes('critical') || lower.includes('emergency')) return 'critical';
    if (lower.includes('high')) return 'high';
    if (lower.includes('moderate')) return 'moderate';
    return 'low';
  }

  private extractFoodItems(text: string): string[] {
    const foodKeywords = ['alcohol', 'food', 'grapefruit', 'dairy', 'caffeine', 'meal'];
    const lower = text.toLowerCase();
    return foodKeywords.filter(food => lower.includes(food));
  }
}