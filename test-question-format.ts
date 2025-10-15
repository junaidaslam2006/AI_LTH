// Test: "what is panadol" - Should extract "panadol" and explain it
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { generalChat } from './src/ai/flows/general-chat';

console.log('🧪 Testing: "what is panadol"\n');

async function test() {
  try {
    const result = await generalChat({
      text: 'what is panadol',
      language: 'english',
    });
    
    console.log('✅ Response:');
    console.log('═'.repeat(70));
    console.log(result.response);
    console.log('═'.repeat(70));
    console.log(`\n📊 Metadata:`);
    console.log(`  • Agents: ${result.agentsUsed?.join(', ')}`);
    console.log(`  • Confidence: ${result.confidence ? Math.round(result.confidence * 100) + '%' : 'N/A'}`);
    
    const hasMedicineInfo = 
      result.response.includes('Medicine Name') ||
      result.response.includes('Panadol') ||
      result.response.includes('paracetamol') ||
      result.response.includes('💊');
    
    console.log(`\n${hasMedicineInfo ? '✅ SUCCESS' : '❌ FAILED'}: ${hasMedicineInfo ? 'Medicine info provided!' : 'Did not extract medicine name'}`);
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

test().catch(console.error);
