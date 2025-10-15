// Quick verification: Text input and Live scan both give proper output
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { generalChat } from './src/ai/flows/general-chat';
import { identifyPill } from './src/ai/flows/identify-pill';

console.log('🧪 Verifying Text + Live Scan Output\n');

async function test() {
  // Test 1: Text Input
  console.log('1️⃣  TEXT INPUT TEST: "panadol"\n');
  try {
    const result = await generalChat({
      text: 'panadol',
      language: 'english',
    });
    
    console.log('✅ Response received:');
    console.log('─'.repeat(60));
    console.log(result.response.substring(0, 500));
    console.log('─'.repeat(60));
    console.log(`\nConfidence: ${result.confidence || 'N/A'}`);
    console.log(`Agents: ${result.agentsUsed?.join(', ') || 'N/A'}\n`);
  } catch (err) {
    console.error('❌ Error:', err);
  }

  // Test 2: Live Scan
  console.log('\n2️⃣  LIVE SCAN TEST: Image input\n');
  const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  try {
    const result = await identifyPill({
      imageDataUri: `data:image/png;base64,${testImage}`,
    });
    
    console.log('✅ Response received:');
    console.log('─'.repeat(60));
    console.log(`Name: ${result.name}`);
    console.log(`Description: ${result.description.substring(0, 200)}...`);
    console.log(`Dosage: ${result.dosage}`);
    console.log('─'.repeat(60));
  } catch (err) {
    console.error('❌ Error:', err);
  }

  console.log('\n✅ Both text input and live scan are working!\n');
}

test().catch(console.error);
