import {genkit} from 'genkit';
import { checkEnvironment, testAgentImports } from './env-checker';

// Check environment configuration on startup
console.log('[AI-LTH] Initializing AI services with OpenRouter...');
const envStatus = checkEnvironment();

if (!envStatus.allRequired) {
  console.error('[AI-LTH] Critical environment variables missing!');
  console.error('[AI-LTH] Missing variables:', envStatus.missingRequired);
  
  // In Firebase, this will show in the function logs
  if (process.env.NODE_ENV === 'production') {
    console.error('[AI-LTH] Set environment variables in Firebase Functions configuration');
  }
}

// Configure Genkit with minimal setup - we're using OpenRouter directly
export const ai = genkit({
  plugins: [],
});

// Export OpenRouter client for all AI operations (text + vision)
export { openRouterClient } from './openrouter';
export { huggingFaceClient } from './huggingface';

// Test agent imports asynchronously (don't block initialization)
testAgentImports().then(result => {
  if (result.success) {
    console.log('[AI-LTH] ✅ All agents loaded successfully');
  } else {
    console.error('[AI-LTH] ❌ Agent loading failed:', result.error);
  }
}).catch(error => {
  console.error('[AI-LTH] ❌ Agent test failed:', error);
});

console.log('[AI-LTH] AI services initialized with OpenRouter free models');
