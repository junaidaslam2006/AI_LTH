/**
 * Test that the system ONLY explains medicines and rejects non-medicine queries
 */

// Load environment variables FIRST
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

// Verify API key loaded
console.log('🔑 API Key loaded:', process.env.OPENROUTER_API_KEY ? '✅ YES' : '❌ NO');
console.log('🔑 Key preview:', process.env.OPENROUTER_API_KEY?.substring(0, 20) + '...\n');

import { createMedicalOrchestrator } from './src/ai/agents';

async function testMedicineOnly() {
  console.log('🧪 Testing: System ONLY explains medicines');
  console.log('═══════════════════════════════════════\n');

  const orchestrator = createMedicalOrchestrator();

  const testCases = [
    {
      name: 'Medicine Query 1',
      input: 'what is panadol',
      shouldWork: true
    },
    {
      name: 'Medicine Query 2',
      input: 'tell me about aspirin',
      shouldWork: true
    },
    {
      name: 'Medicine Query 3',
      input: 'paracetamol',
      shouldWork: true
    },
    {
      name: 'Non-medicine Query 1',
      input: 'what is the weather',
      shouldWork: false
    },
    {
      name: 'Non-medicine Query 2',
      input: 'hello how are you',
      shouldWork: false
    },
    {
      name: 'Medical Advice (should reject)',
      input: 'should I take panadol',
      shouldWork: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`🔬 Test: ${testCase.name}`);
    console.log(`📝 Input: "${testCase.input}"`);
    console.log(`✅ Expected: ${testCase.shouldWork ? 'Medicine info' : 'Rejection'}`);
    console.log(`${'─'.repeat(50)}`);

    try {
      const result = await orchestrator.processQuery(testCase.input, {
        language: 'english',
        conversationId: 'test-' + Date.now()
      });

      console.log('\n📊 Result:');
      console.log(`  • Query Type: ${result.queryAnalysis.queryType}`);
      console.log(`  • Agents Used: ${result.agentResponses.map(a => a.agentName).join(', ')}`);
      console.log(`  • Confidence: ${Math.round(result.confidence * 100)}%`);
      
      console.log('\n💬 Response Preview:');
      console.log(result.primaryResponse.substring(0, 200) + '...\n');

      // Verify behavior
      if (testCase.shouldWork) {
        const hasMedicineInfo = result.primaryResponse.includes('Medicine Name') || 
                                result.primaryResponse.includes('💊') ||
                                result.primaryResponse.includes('description');
        console.log(hasMedicineInfo ? '✅ PASS: Provided medicine info' : '❌ FAIL: Should provide medicine info');
      } else {
        const isRejection = result.primaryResponse.includes('not recognized') || 
                           result.primaryResponse.includes('IMPORTANT') ||
                           result.primaryResponse.includes('educational information only') ||
                           result.confidence < 0.5;
        console.log(isRejection ? '✅ PASS: Correctly rejected' : '❌ FAIL: Should reject non-medicine queries');
      }

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('🎯 Test Complete!');
  console.log('═'.repeat(50));
}

testMedicineOnly().catch(console.error);
