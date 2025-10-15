/**
 * @fileOverview Side Effects Agent - Specialized agent for medication side effects analysis
 * 
 * This agent provides comprehensive side effect profiles, risk assessment,
 * severity levels, and monitoring recommendations.
 */

import { BaseAgent, AgentContext, AgentResponse } from './base-agent';
import { z } from 'zod';

export class SideEffectsAgent extends BaseAgent {
  constructor() {
    super(
      'SideEffectsAgent',
      'Specialized agent for analyzing medication side effects, risk assessment, and safety monitoring'
    );
  }

  canHandle(input: string, context: AgentContext): boolean {
    const sideEffectKeywords = [
      'side effect', 'adverse effect', 'reaction', 'allergy', 'allergic',
      'symptoms after taking', 'caused by', 'experience', 'feeling',
      'nausea', 'dizziness', 'headache', 'rash', 'itching', 'swelling',
      'what to expect', 'common effects', 'rare effects', 'serious effects'
    ];
    
    return sideEffectKeywords.some(keyword => input.toLowerCase().includes(keyword));
  }

  async process(input: any, context: AgentContext): Promise<AgentResponse> {
    this.log('info', 'Processing side effects request');
    
    try {
      let sideEffectsInfo: any;
      
      if (typeof input === 'string') {
        sideEffectsInfo = await this.analyzeSideEffectsFromText(input, context);
      } else {
        sideEffectsInfo = await this.getSideEffectsProfile(input.medication || input.text, context);
      }
      
      // Check if medicine is unknown
      if (sideEffectsInfo.isUnknown) {
        return {
          agentName: this.name,
          response: sideEffectsInfo.unknownResponse,
          confidence: 0.9,
          metadata: { reason: 'Unknown medicine' },
          timestamp: new Date()
        };
      }
      
      const formattedResponse = await this.formatSideEffectsResponse(sideEffectsInfo, context);
      
      return {
        agentName: this.name,
        response: formattedResponse,
        confidence: 0.85,
        metadata: { sideEffectsInfo },
        timestamp: new Date()
      };
      
    } catch (error) {
      this.log('error', 'Failed to process side effects request', error);
      return {
        agentName: this.name,
        response: context.language === 'urdu'
          ? 'معذرت، میں ضمنی اثرات کی معلومات فراہم کرنے میں ناکام ہوں۔ اگر آپ کو کوئی غیر معمولی علامات محسوس ہو رہی ہیں تو فوری طور پر ڈاکٹر سے رابطہ کریں۔'
          : "I'm sorry, I couldn't provide side effects information. If you're experiencing unusual symptoms, please contact your healthcare provider immediately.",
        confidence: 0,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      };
    }
  }

  private async analyzeSideEffectsFromText(text: string, context: AgentContext): Promise<any> {
    // Check if we can identify a specific medicine
    const medicationCheck = `Does this text mention a specific medication or drug name? Text: "${text}"
    
    Respond with:
    1. The medication name if mentioned
    2. "NO_SPECIFIC_MEDICINE" if no specific drug is mentioned
    3. "UNKNOWN_MEDICINE" if the mentioned item is not a real pharmaceutical product`;

    const medicationResponse = await this.callLLM(
      'You are a pharmaceutical expert. Identify if a specific, real medication is mentioned.',
      medicationCheck,
      context
    );

    if (medicationResponse.includes('UNKNOWN_MEDICINE') || 
        medicationResponse.toLowerCase().includes('not a real pharmaceutical') ||
        medicationResponse.toLowerCase().includes('not recognized')) {
      
      return {
        isUnknown: true,
        unknownResponse: this.generateUnknownMedicineResponse(text, context.language)
      };
    }
    
    const analysisPrompt = `Analyze the following text for medication side effects information:

"${text}"

Determine if this is:
1. A query about potential side effects of a medication
2. A report of symptoms someone is experiencing
3. A request for side effect management advice

If it's a symptom report, assess:
- Severity of symptoms
- Urgency of medical attention needed
- Possible medication-related causes
- Immediate recommendations

If it's a side effects inquiry, provide:
- Common side effects
- Serious side effects to watch for
- When to seek medical attention
- Risk factors that increase likelihood`;

    const response = await this.callLLM(
      'You are a clinical pharmacist specializing in medication side effects and adverse reactions.',
      analysisPrompt,
      context
    );

    return this.parseSideEffectsAnalysis(response, text);
  }

  private async getSideEffectsProfile(medication: string, context: AgentContext): Promise<any> {
    const profilePrompt = `Provide comprehensive side effects profile for: ${medication}

Include:

**Common Side Effects (>10% of patients):**
- List with frequency percentages
- Severity level (mild/moderate)
- Typical onset timing
- Duration and resolution

**Less Common Side Effects (1-10%):**
- Include frequency ranges
- Clinical significance
- Management strategies

**Rare but Serious Side Effects (<1%):**
- Emergency situations requiring immediate medical attention
- Warning signs to watch for
- Risk factors that increase likelihood

**Special Populations:**
- Elderly patients
- Pregnancy and breastfeeding
- Pediatric considerations
- Patients with kidney/liver disease

**Drug-Specific Monitoring:**
- Laboratory tests needed
- Clinical monitoring parameters
- Follow-up schedule recommendations

**When to Contact Healthcare Provider:**
- Immediate emergency situations
- Concerning but non-emergency symptoms
- Routine monitoring needs

Be thorough and evidence-based. Include frequency data where available.`;

    const response = await this.callLLM(
      'You are a clinical pharmacologist providing comprehensive side effect profiles for medications.',
      profilePrompt,
      context
    );

    return this.parseSideEffectsProfile(response, medication);
  }

  private parseSideEffectsAnalysis(response: string, originalText: string): any {
    const analysis = {
      queryType: this.determineQueryType(originalText),
      medication: this.extractMedicationFromText(originalText),
      symptoms: this.extractSymptoms(originalText),
      urgency: this.assessUrgency(response),
      recommendations: this.extractRecommendations(response),
      rawAnalysis: response
    };

    return analysis;
  }

  private parseSideEffectsProfile(response: string, medication: string): any {
    const sections = this.splitResponseIntoSections(response);
    
    return {
      medication: medication,
      commonSideEffects: this.parseSideEffectsList(sections.common || ''),
      uncommonSideEffects: this.parseSideEffectsList(sections.uncommon || sections['less common'] || ''),
      seriousSideEffects: this.parseSideEffectsList(sections.serious || sections.rare || ''),
      specialPopulations: sections['special populations'] || '',
      monitoring: sections.monitoring || sections['drug-specific monitoring'] || '',
      whenToContact: sections['when to contact'] || sections.emergency || '',
      rawProfile: response
    };
  }

  private async formatSideEffectsResponse(sideEffectsInfo: any, context: AgentContext): Promise<string> {
    const formatPrompt = `Format this side effects information into a clear, helpful patient response in ${context.language}:

${JSON.stringify(sideEffectsInfo, null, 2)}

Create a well-structured response with:

1. **Overview** - Brief introduction
2. **Common Side Effects** - What most people might experience
3. **Serious Side Effects** - Warning signs that need immediate attention
4. **What to Do** - Practical advice for managing side effects
5. **When to Seek Help** - Clear guidance on when to contact healthcare providers

Use clear headings and bullet points. Make it easy to scan quickly.
Include appropriate urgency indicators (⚠️ for warnings, 🚨 for emergencies).
Always emphasize the importance of medical consultation.

Tone: Reassuring but informative, emphasizing safety without causing panic.`;

    return await this.callLLM(
      `You are a healthcare educator explaining medication side effects to patients in ${context.language}. Be clear, balanced, and safety-focused.`,
      formatPrompt,
      context
    );
  }

  // Helper methods for parsing and analysis
  private determineQueryType(text: string): 'side_effects_inquiry' | 'symptom_report' | 'management_advice' {
    const lower = text.toLowerCase();
    
    if (lower.includes('experiencing') || lower.includes('feeling') || lower.includes('having')) {
      return 'symptom_report';
    } else if (lower.includes('how to') || lower.includes('what should i do') || lower.includes('manage')) {
      return 'management_advice';
    } else {
      return 'side_effects_inquiry';
    }
  }

  private extractMedicationFromText(text: string): string {
    // Simple extraction - in production, would use more sophisticated NLP
    const words = text.split(' ');
    for (const word of words) {
      if (word.length > 3 && /^[A-Z]/.test(word) && !['I', 'The', 'My', 'This', 'That'].includes(word)) {
        return word.replace(/[.,!?]/, '');
      }
    }
    return 'Unknown medication';
  }

  private extractSymptoms(text: string): string[] {
    const symptomKeywords = [
      'nausea', 'vomiting', 'dizziness', 'headache', 'fatigue', 'drowsiness',
      'rash', 'itching', 'swelling', 'pain', 'stomach', 'diarrhea', 'constipation',
      'blurred vision', 'dry mouth', 'difficulty sleeping', 'anxiety', 'depression'
    ];
    
    const lower = text.toLowerCase();
    return symptomKeywords.filter(symptom => lower.includes(symptom));
  }

  private assessUrgency(response: string): 'low' | 'moderate' | 'high' | 'emergency' {
    const lower = response.toLowerCase();
    
    if (lower.includes('emergency') || lower.includes('immediate') || lower.includes('urgent')) {
      return 'emergency';
    } else if (lower.includes('serious') || lower.includes('concerning')) {
      return 'high';
    } else if (lower.includes('moderate') || lower.includes('monitor')) {
      return 'moderate';
    } else {
      return 'low';
    }
  }

  private extractRecommendations(response: string): string[] {
    const lines = response.split('\n');
    const recommendations = [];
    
    for (const line of lines) {
      if (line.includes('recommend') || line.includes('should') || line.includes('contact') || line.includes('seek')) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations;
  }

  private splitResponseIntoSections(response: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = response.split('\n');
    let currentSection = '';
    let currentContent = '';
    
    for (const line of lines) {
      if (line.startsWith('**') || line.match(/^\d+\./) || line.includes(':')) {
        if (currentSection) {
          sections[currentSection.toLowerCase()] = currentContent.trim();
        }
        currentSection = line.replace(/\*\*/g, '').replace(/^\d+\./, '').replace(':', '').trim();
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

  private parseSideEffectsList(text: string): Array<{
    effect: string;
    frequency?: string;
    severity: 'mild' | 'moderate' | 'severe';
  }> {
    const effects = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.includes('-') || line.includes('•')) {
        const effect = line.replace(/[-•]/, '').trim();
        effects.push({
          effect: effect,
          frequency: this.extractFrequency(effect),
          severity: this.assessSeverity(effect)
        });
      }
    }
    
    return effects;
  }

  private extractFrequency(text: string): string | undefined {
    const frequencyPattern = /(\d+%|\d+-\d+%|common|rare|very rare|frequent)/i;
    const match = text.match(frequencyPattern);
    return match ? match[0] : undefined;
  }

  private assessSeverity(text: string): 'mild' | 'moderate' | 'severe' {
    const lower = text.toLowerCase();
    
    if (lower.includes('severe') || lower.includes('serious') || lower.includes('emergency')) {
      return 'severe';
    } else if (lower.includes('moderate') || lower.includes('significant')) {
      return 'moderate';
    } else {
      return 'mild';
    }
  }
}