/**
 * @fileOverview Agent Index - Central export point for all medical agents
 * 
 * This file exports all the medical agents and related types for easy importing
 * throughout the application.
 */

import { BaseAgent, AgentContext, AgentResponse, AgentCapability } from './base-agent';
import { MedicalAgentOrchestrator, QueryAnalysis, OrchestratorResponse } from './orchestrator';
import DrugInformationAgent from './drug-information-agent';
import { DosageAgent } from './dosage-agent';
import { DrugInteractionAgent } from './interaction-agent';
import { SideEffectsAgent } from './side-effects-agent';
import { MedicalDocumentationAgent } from './medical-documentation-agent';

// Export all agents and types
export { BaseAgent };
export type { AgentContext, AgentResponse, AgentCapability };
export { MedicalAgentOrchestrator };
export type { QueryAnalysis, OrchestratorResponse };
export { DrugInformationAgent };
export { DosageAgent };
export { DrugInteractionAgent };
export { SideEffectsAgent };
export { MedicalDocumentationAgent };

// Re-export types for convenience
export type MedicalAgentContext = AgentContext;
export type MedicalAgentResponse = AgentResponse;

/**
 * Factory function to create a fully configured medical orchestrator
 * This registers ALL available medical agents for comprehensive coverage
 */
export function createMedicalOrchestrator(): MedicalAgentOrchestrator {
  const orchestrator = new MedicalAgentOrchestrator();
  
  console.log('[AgentFactory] Registering all medical agents...');
  
  // Register all specialized agents
  orchestrator.registerAgent(new DrugInformationAgent());
  orchestrator.registerAgent(new DosageAgent());
  orchestrator.registerAgent(new DrugInteractionAgent());
  orchestrator.registerAgent(new SideEffectsAgent());
  orchestrator.registerAgent(new MedicalDocumentationAgent());
  
  console.log('[AgentFactory] ✅ All agents registered:', orchestrator.getRegisteredAgents());
  
  return orchestrator;
}
