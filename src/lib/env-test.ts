/**
 * Environment Configuration Test & Debug
 * 
 * This file helps debug environment variable loading issues in Next.js
 */

// Test environment variable loading
export function testEnvironmentVariables() {
    console.log('[EnvTest] Testing environment variables...');
    
    const requiredVars = [
      'GEMINI_API_KEY',
      'OPENROUTER_API_KEY', 
      'HUGGINGFACE_API_KEY'
    ];
    
    const results = requiredVars.map(varName => {
      const value = process.env[varName];
      const isPresent = !!value && value.trim() !== '' && !value.includes('your_');
      
      console.log(`[EnvTest] ${varName}: ${isPresent ? '✅ FOUND' : '❌ MISSING'}`);
      
      if (isPresent && value) {
        console.log(`[EnvTest] ${varName} preview: ${value.substring(0, 10)}...`);
      }
      
      return { varName, isPresent, value: isPresent ? value : undefined };
    });
    
    const allPresent = results.every(r => r.isPresent);
    console.log(`[EnvTest] All required variables present: ${allPresent ? '✅' : '❌'}`);
    
    return { allPresent, results };
  }
  
  // Call test on import in development
  if (process.env.NODE_ENV === 'development') {
    testEnvironmentVariables();
  }