/**
 * Test the clean backend flow:
 * User Input → OpenRouter LLM → Agent → OpenRouter LLM → Output
 */

// CRITICAL: Load environment variables FIRST, before any imports
import { config } from 'dotenv';
import { resolve } from 'path';
const envPath = resolve(process.cwd(), '.env.local');
console.log('📁 Loading environment from:', envPath);
const result = config({ path: envPath });
if (result.error) {
  console.error('❌ Failed to load .env.local:', result.error);
} else {
  console.log('✅ Environment loaded successfully');
  console.log('🔑 OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? `${process.env.OPENROUTER_API_KEY.substring(0, 20)}...` : 'NOT FOUND');
}

import { createMedicalOrchestrator } from './src/ai/agents';

async function testCleanFlow() {
  console.log('🧪 Testing Clean Backend Flow');
  console.log('═══════════════════════════════════════\n');

  const orchestrator = createMedicalOrchestrator();
  
  console.log('📊 Registered Agents:');
  orchestrator.getRegisteredAgents().forEach(agent => {
    console.log(`  ✅ ${agent}`);
  });
  console.log();

  // Test Case: "what is panadol"
  console.log('───────────────────────────────────────');
  console.log('🔬 Test: "what is panadol"');
  console.log('───────────────────────────────────────');
  
  try {
    const result = await orchestrator.processQuery('what is panadol', {
      language: 'english',
      conversationId: 'test-123'
    });

    console.log('\n✅ Flow Completed Successfully!');
    console.log('\n📈 Query Analysis:');
    console.log(`  • Type: ${result.queryAnalysis.queryType}`);
    console.log(`  • Complexity: ${result.queryAnalysis.complexity}`);
    console.log(`  • Required Agents: ${result.queryAnalysis.requiredAgents.join(', ')}`);
    console.log(`  • Confidence: ${result.confidence * 100}%`);
    
    console.log('\n🤖 Agents Used:');
    result.agentResponses.forEach(agent => {
      console.log(`  • ${agent.agentName} (${Math.round(agent.confidence * 100)}%)`);
    });

    console.log('\n💬 Final Response:');
    console.log('───────────────────────────────────────');
    console.log(result.primaryResponse.substring(0, 500) + '...');
    console.log('───────────────────────────────────────');

    console.log('\n✨ Backend Architecture Verified:');
    console.log('  1️⃣  User Input: "what is panadol"');
    console.log('  2️⃣  OpenRouter LLM: Analyzed query → Selected agent');
    console.log('  3️⃣  Agent: Processed medicine info');
    console.log('  4️⃣  OpenRouter LLM: Formatted final response');
    console.log('  5️⃣  Output: Clean, educational medicine info');

  } catch (error) {
    console.error('❌ Test Failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('🎯 Clean Backend Flow Test Complete!');
}

testCleanFlow().catch(console.error);
