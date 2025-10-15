
/**
 * @fileOverview Medical Agent Orchestrator - Central coordinator for all medical agents
 * 
 * This orchestrator manages routing queries to appropriate agents and coordinates
 * multi-agent workflows for complex medical queries.
 */

import { BaseAgent, AgentContext, AgentResponse } from './base-agent';
import { z } from 'zod';
import { MedicalDocumentationAgent } from './medical-documentation-agent';

export interface QueryAnalysis {
  queryType: 'medicine' | 'drug_interaction' | 'dosage' | 'side_effects' | 'medical_documentation' | 'general';
  complexity: 'simple' | 'moderate' | 'complex';
  requiredAgents: string[];
  priority: number;
  medicalEntities: string[];
}

export interface OrchestratorResponse {
  primaryResponse: string;
  agentResponses: AgentResponse[];
  queryAnalysis: QueryAnalysis;
  confidence: number;
  reasoning: string[];
}

const QueryAnalysisSchema = z.object({
  queryType: z.enum(['medicine', 'drug_interaction', 'dosage', 'side_effects', 'medical_documentation', 'general']),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  requiredAgents: z.array(z.string()),
  priority: z.number().min(1).max(10),
  medicalEntities: z.array(z.string())
});

export class MedicalAgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private conversationMemory: Map<string, AgentContext[]> = new Map();

  constructor() {
    console.log('[Orchestrator] Medical Agent Orchestrator initialized');
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getInfo().name, agent);
    console.log(`[Orchestrator] Registered agent: ${agent.getInfo().name}`);
  }

  /**
   * Get list of all registered agents
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Main entry point for processing medical queries
   */
  async processQuery(
    input: string | { text?: string; imageDataUri?: string },
    context: AgentContext
  ): Promise<OrchestratorResponse> {
    try {
      console.log('[Orchestrator] Processing new query');

      let queryText = typeof input === 'string' ? input : (input.text || '');
      let processedInput: string | { text?: string; imageDataUri?: string } = input;
      
      // Step 1: Handle image input separately for potential OCR
      if (typeof input === 'object' && input.imageDataUri) {
        const docAgent = this.agents.get('MedicalDocumentationAgent') as MedicalDocumentationAgent;
        if (docAgent) {
            console.log('[Orchestrator] Image detected. Running MedicalDocumentationAgent for OCR.');
            const ocrResponse = await docAgent.process(input, context);
            if (ocrResponse.confidence > 0.3 && ocrResponse.metadata?.isOcrResult) {
                console.log('[Orchestrator] OCR successful. Using transcribed text for analysis.');
                // Combine original query text with OCR result for better context
                queryText = `${queryText}\n\n${ocrResponse.response}`;
                // The input for subsequent agents will be the combined text
                processedInput = queryText;
            } else {
                console.log('[Orchestrator] OCR confidence low or failed. Proceeding with original text/image.');
            }
        }
      }
      
      // Step 2: Analyze the query to understand what type of medical assistance is needed
      const queryAnalysis = await this.analyzeQuery(queryText || "Image analysis request", context);
      
      // Step 3: Route to appropriate agents based on analysis
      const agentResponses = await this.routeToAgents(queryAnalysis, processedInput, context);
      
      // Step 4: Synthesize responses into a coherent final answer
      const finalResponse = await this.synthesizeResponses(agentResponses, queryAnalysis, context);
      
      // Step 5: Store context for future queries
      this.updateConversationMemory(context, queryAnalysis, agentResponses);
      
      return {
        primaryResponse: finalResponse.response,
        agentResponses,
        queryAnalysis,
        confidence: finalResponse.confidence,
        reasoning: finalResponse.reasoning
      };
      
    } catch (error) {
      console.error('[Orchestrator] Error processing query:', error);
      return {
        primaryResponse: `I apologize, but I encountered an error while processing your medical query. Please try rephrasing your question or contact support if the issue persists.`,
        agentResponses: [],
        queryAnalysis: {
          queryType: 'general',
          complexity: 'simple',
          requiredAgents: [],
          priority: 1,
          medicalEntities: []
        },
        confidence: 0,
        reasoning: ['Error occurred during processing']
      };
    }
  }

  /**
   * Analyze the incoming query to determine required agents and complexity
   */
  private async analyzeQuery(queryText: string, context: AgentContext): Promise<QueryAnalysis> {
    const analysisPrompt = `You are a medical query analysis expert. Analyze the following medical query and determine:

1. Query Type: What type of medical information is being requested?
2. Complexity: How complex is this query?
3. Required Agents: Which specialized agents would be needed?
4. Priority: How urgent/important is this query?
5. Medical Entities: What medical terms, drugs, conditions are mentioned?

Available Agent Types (USE ONLY THESE):
- DrugInformationAgent: Medicine identification, drug facts, mechanisms, general medicine questions
- InteractionAgent: Drug interactions, contraindications, warnings  
- DosageAgent: Dosage calculations, administration guidelines
- SideEffectsAgent: Side effects analysis, risk assessment
- MedicalDocumentationAgent: Medical documents, prescriptions, certificates, OCR analysis

IMPORTANT: Only use the agent names listed above. For general medical questions about symptoms, conditions, or treatments, use DrugInformationAgent. If the query involves reading a document, always include MedicalDocumentationAgent.

Query: "${queryText}"

Respond with a JSON object matching this schema:
{
  "queryType": "medicine|drug_interaction|dosage|side_effects|medical_documentation|general",
  "complexity": "simple|moderate|complex",
  "requiredAgents": ["AgentName1", "AgentName2"],
  "priority": 1-10,
  "medicalEntities": ["entity1", "entity2"]
}`;

    try {
      const response = await this.callAnalysisLLM(analysisPrompt, context);
      return QueryAnalysisSchema.parse(JSON.parse(response));
    } catch (error) {
      console.error('[Orchestrator] Query analysis failed, using fallback:', error);
      // Fallback analysis
      return {
        queryType: 'medicine',
        complexity: 'moderate',
        requiredAgents: ['DrugInformationAgent'],
        priority: 5,
        medicalEntities: []
      };
    }
  }

  /**
   * Route query to appropriate agents based on analysis
   */
  private async routeToAgents(
    analysis: QueryAnalysis,
    input: string | { text?: string; imageDataUri?: string },
    context: AgentContext
  ): Promise<AgentResponse[]> {
    const responses: AgentResponse[] = [];
    
    // Filter to only use available agents and fallback to DrugInformationAgent for unknown agents
    const availableAgentNames = Array.from(this.agents.keys());
    let requiredAgentNames = analysis.requiredAgents;

    // If the input is an object with an image, and the analysis didn't pick it up,
    // ensure the correct agent is added.
    if (typeof input === 'object' && input.imageDataUri) {
        if (!requiredAgentNames.includes('MedicalDocumentationAgent') && !requiredAgentNames.includes('DrugInformationAgent')) {
            // If it's an image, it's either a document to read or a pill to identify.
            // Let's add DrugInformationAgent as it can handle pill identification.
            // The OCR step already ran if it was a document.
            console.log("[Orchestrator] Image provided. Ensuring DrugInformationAgent is included for potential pill ID.");
            requiredAgentNames.push('DrugInformationAgent');
        }
    }
    
    const validAgents = [...new Set(requiredAgentNames)].map(agentName => {
      if (availableAgentNames.includes(agentName)) {
        return agentName;
      } else {
        console.log(`[Orchestrator] Agent ${agentName} not found, using DrugInformationAgent as fallback`);
        return 'DrugInformationAgent';
      }
    });

    const queryText = typeof input === 'string' ? input : (input.text || '');
    
    const agentPromises = validAgents.map(async (agentName) => {
        const agent = this.agents.get(agentName);
        const canHandle = agent?.canHandle(queryText, context) ?? false;
        const shouldForce = agentName === 'DrugInformationAgent' && this.shouldForceDrugInformationAgent(queryText, analysis);

        if (agent && (canHandle || shouldForce)) {
          try {
            // Pass the potentially OCR'd text or the original input object
            return await agent.process(input, context);
          } catch (error) {
            console.error(`[Orchestrator] Agent ${agentName} failed:`, error);
            return null;
          }
        }
        return null;
      });
      
    const results = await Promise.all(agentPromises);
    responses.push(...results.filter((r): r is AgentResponse => r !== null && r.response.trim() !== ''));

    
    // If no agents could handle the query, provide a helpful default response
    if (responses.length === 0) {
      const isDirectAdviceRequest = await this.isMedicalAdviceRequest(queryText, context);

      const responseTemplate = isDirectAdviceRequest
        ? this.getMedicalAdviceDisclaimer(context.language)
        : this.getGeneralFallback(context.language);
      responses.push(responseTemplate);
    }
    
    return responses;
  }

  private shouldForceDrugInformationAgent(queryText: string, analysis: QueryAnalysis): boolean {
    const normalizedQuery = (queryText || '').trim();

    if (!normalizedQuery) {
      return false;
    }

    if (analysis.queryType === 'medicine') {
      return true;
    }

    if (analysis.requiredAgents.includes('DrugInformationAgent')) {
      return true;
    }

    if (analysis.medicalEntities.some(entity => !!entity.trim())) {
      return true;
    }

    return false;
  }

  /**
   * Synthesize multiple agent responses into a coherent final answer
   */
  private async synthesizeResponses(
    agentResponses: AgentResponse[],
    analysis: QueryAnalysis,
    context: AgentContext
  ): Promise<{ response: string; confidence: number; reasoning: string[] }> {
    if (agentResponses.length === 0) {
      return {
        response: `I apologize, but I wasn't able to process your ${analysis.queryType} query at this time. Please try rephrasing your question or contact support.`,
        confidence: 0,
        reasoning: ['No agents available to handle this query']
      };
    }
    
    if (agentResponses.length === 1) {
      return {
        response: agentResponses[0].response,
        confidence: agentResponses[0].confidence,
        reasoning: [`Single agent response from ${agentResponses[0].agentName}`]
      };
    }
    
    // Synthesize multiple responses
    const synthesisPrompt = `You are a senior medical assistant. Your job is to synthesize reports from several junior specialist agents into a single, coherent, and comprehensive response for the user.

Query Type: ${analysis.queryType}
Language: ${context.language}

Agent Reports:
${agentResponses.map(r => `\n--- Report from ${r.agentName} (Confidence: ${r.confidence * 100}%) ---\n${r.response}`).join('\n\n')}

Your task:
1.  **Synthesize, Do Not Repeat:** Combine the information logically. Start with the most important information. Do not just list the reports.
2.  **Remove Redundancy:** The agents may have overlapping information (like disclaimers). Include a comprehensive disclaimer only once at the end.
3.  **Ensure Natural Flow:** The final response should read as if a single expert wrote it.
4.  **Maintain Accuracy:** Do not add or invent information not present in the agent reports.
5.  **Final Response Language:** The entire final response must be in ${context.language}.

Provide the final synthesized response below:`;

    try {
      const synthesizedResponse = await this.callAnalysisLLM(synthesisPrompt, context);
      const avgConfidence = agentResponses.reduce((sum, r) => sum + r.confidence, 0) / agentResponses.length;
      
      return {
        response: synthesizedResponse,
        confidence: Math.round(avgConfidence * 100) / 100,
        reasoning: agentResponses.map(r => `Incorporated ${r.agentName} response`)
      };
    } catch (error) {
      console.error('[Orchestrator] Response synthesis failed:', error);
      // Fallback: return the highest confidence response
      const bestResponse = agentResponses.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      return {
        response: bestResponse.response,
        confidence: bestResponse.confidence,
        reasoning: [`Fallback to best single agent response: ${bestResponse.agentName}`]
      };
    }
  }

  /**
   * Update conversation memory for context in future queries
   */
  private updateConversationMemory(
    context: AgentContext,
    analysis: QueryAnalysis,
    responses: AgentResponse[]
  ): void {
    if (!context.conversationId) return;
    
    const conversationHistory = this.conversationMemory.get(context.conversationId) || [];
    
    // Add new context
    conversationHistory.push({
      ...context,
      previousResponses: responses
    });
    
    // Keep only last 10 interactions to prevent memory bloat
    if (conversationHistory.length > 10) {
      conversationHistory.splice(0, conversationHistory.length - 10);
    }
    
    this.conversationMemory.set(context.conversationId, conversationHistory);
  }

  /**
   * Helper method for LLM calls in orchestrator
   */
  private async callAnalysisLLM(prompt: string, context: AgentContext): Promise<string> {
    const { openRouterClient } = await import('../openrouter');
    
    const response = await openRouterClient.generate({
      model: 'meta-llama/llama-3.2-3b-instruct:free',
      system: `You are a medical query analysis expert helping coordinate specialized medical agents. Always provide accurate JSON responses when requested. Respond in ${context.language}.`,
      prompt: prompt
    });
    
    return response.text || '';
  }

  private async isMedicalAdviceRequest(queryText: string, context: AgentContext): Promise<boolean> {
    const trimmed = (queryText ?? '').trim();
    if (!trimmed) {
      return false;
    }

    const classificationPrompt = `Determine whether the user is asking for personalized medical advice (something they should take, dosage for themselves, or treatment guidance for their specific situation).

Query: """${trimmed}"""

Respond with one of these labels only:
- MEDICAL_ADVICE
- OTHER`;

    try {
      const response = await this.callAnalysisLLM(classificationPrompt, context);
      const normalized = response.trim().toUpperCase();
      return normalized.startsWith('MEDICAL_ADVICE');
    } catch (error) {
      console.error('[Orchestrator] Medical advice intent classification failed:', error);
      return false;
    }
  }

    private getMedicalAdviceDisclaimer(language: 'english' | 'urdu'): AgentResponse {
        return {
            agentName: 'EducationalSystem',
            response: language === 'urdu' 
                ? `**⚠️ اہم اطلاع ⚠️**
    یہ سسٹم صرف ادویات کی تعلیمی معلومات فراہم کرتا ہے۔ یہ طبی مشورہ، تشخیص، یا علاج تجویز نہیں کرتا۔
    
    **براہ کرم مشورہ لیں:**
    - اپنے لائسنس یافتہ ڈاکٹر سے
    - کسی تجربہ کار فارماسسٹ سے
    
    **صحت کے مسائل کے لیے ہمیشہ پیشہ ور طبی مشورہ لیں۔**`
                : `**⚠️ IMPORTANT NOTICE ⚠️**
    This system provides ONLY educational information about medicines. It does NOT provide medical advice, diagnoses, or treatment recommendations.
    
    **Please consult with:**
    - Your licensed healthcare provider
    - A qualified pharmacist  
    
    **For any health concerns, always seek professional medical consultation.**`,
            confidence: 1.0,
            metadata: { queryType: 'rejected_medical_advice' },
            timestamp: new Date()
        };
    }

    private getGeneralFallback(language: 'english' | 'urdu'): AgentResponse {
        return {
            agentName: 'EducationalSystem',
      response: language === 'urdu' 
        ? 'یہ معاون صرف مخصوص ادویات کے بارے میں تعلیمی معلومات فراہم کرتا ہے۔ براہ کرم دوا کا واضح نام بتائیں تاکہ میں وضاحت کر سکوں۔'
        : 'This assistant only explains recognised medicines. Please share the exact medicine name you want to learn about.',
            confidence: 0.3,
            metadata: { queryType: 'unrecognized_query' },
            timestamp: new Date()
        };
    }
}
