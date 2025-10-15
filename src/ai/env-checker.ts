/**
 * @fileOverview Environment Configuration Checker
 * 
 * This utility checks for required environment variables and provides
 * helpful error messages for Firebase deployment.
 */

export interface EnvironmentCheck {
  variable: string;
  required: boolean;
  description: string;
  present: boolean;
  value?: string;
}

export interface EnvironmentStatus {
  allRequired: boolean;
  checks: EnvironmentCheck[];
  missingRequired: string[];
  warnings: string[];
}

const envVariables = [
  {
    variable: 'OPENROUTER_API_KEY',
    required: true,
    description: 'OpenRouter API key for accessing free AI models'
  },
  {
    variable: 'HUGGINGFACE_API_KEY',
    required: false,
    description: 'Hugging Face API key for medical NLP models (optional)'
  },
  {
    variable: 'GEMINI_API_KEY',
    required: false,
    description: 'Google AI (Gemini) API key (OPTIONAL - not used, only OpenRouter models)'
  },
  {
    variable: 'NEXT_PUBLIC_APP_URL',
    required: false,
    description: 'Public URL of your application (for OpenRouter referrer)'
  }
];

export function checkEnvironment(): EnvironmentStatus {
  console.log('[EnvChecker] Checking environment configuration...');
  
  const checks: EnvironmentCheck[] = [];
  const missingRequired: string[] = [];
  const warnings: string[] = [];
  
  for (const config of envVariables) {
    const value = process.env[config.variable];
    const present = !!value && value.trim() !== '';
    
    checks.push({
      variable: config.variable,
      required: config.required,
      description: config.description,
      present,
      value: present ? '***' + value.slice(-4) : undefined
    });
    
    if (config.required && !present) {
      missingRequired.push(config.variable);
    }
    
    if (!config.required && !present) {
      warnings.push(`Optional variable ${config.variable} is not set: ${config.description}`);
    }
  }
  
  const allRequired = missingRequired.length === 0;
  
  // Log results
  console.log('[EnvChecker] Environment check results:');
  checks.forEach(check => {
    const status = check.present ? '✓' : '✗';
    const required = check.required ? '(REQUIRED)' : '(optional)';
    console.log(`  ${status} ${check.variable} ${required}: ${check.description}`);
  });
  
  if (!allRequired) {
    console.error('[EnvChecker] Missing required environment variables:', missingRequired);
    console.error('[EnvChecker] Please set these variables in your Firebase environment configuration');
  }
  
  if (warnings.length > 0) {
    console.warn('[EnvChecker] Warnings:', warnings);
  }
  
  return {
    allRequired,
    checks,
    missingRequired,
    warnings
  };
}

export function getEnvironmentHelp(): string {
  return `
Environment Variables Setup Help:

For Firebase Functions:
1. Set environment variables using Firebase CLI:
   firebase functions:config:set gemini.api_key="your_gemini_key"
   firebase functions:config:set openrouter.api_key="your_openrouter_key" 
   firebase functions:config:set huggingface.api_key="your_huggingface_key"

2. Or use Firebase environment configuration in your project console

For local development:
1. Create a .env file in your project root:
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   HUGGINGFACE_API_KEY=your_huggingface_api_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:9002

2. Make sure .env is in your .gitignore file

API Key Sources:
- Gemini: https://makersuite.google.com/app/apikey
- OpenRouter: https://openrouter.ai/keys  
- Hugging Face: https://huggingface.co/settings/tokens
`;
}

/**
 * Test if agents can be loaded without compilation errors
 */
export async function testAgentImports(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[EnvChecker] Testing agent imports...');
    
    // Test base agent import
    await import('./agents/base-agent');
    console.log('[EnvChecker] ✅ BaseAgent import successful');
    
    // Test individual agent imports
    await import('./agents/drug-information-agent');
    console.log('[EnvChecker] ✅ DrugInformationAgent import successful');
    
    await import('./agents/dosage-agent');
    console.log('[EnvChecker] ✅ DosageAgent import successful');
    
    await import('./agents/interaction-agent');
    console.log('[EnvChecker] ✅ InteractionAgent import successful');
    
    await import('./agents/side-effects-agent');
    console.log('[EnvChecker] ✅ SideEffectsAgent import successful');
    
    await import('./agents/orchestrator');
    console.log('[EnvChecker] ✅ Orchestrator import successful');
    
    // Test index imports
    await import('./agents');
    console.log('[EnvChecker] ✅ Agents index import successful');
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[EnvChecker] ❌ Agent import failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// Auto-check on import in development with better debugging
if (process.env.NODE_ENV !== 'production') {
  const status = checkEnvironment();
  if (!status.allRequired) {
    console.warn('\n🚨 Environment variables missing - some features may not work');
    console.warn(getEnvironmentHelp());
    console.warn('\n💡 For immediate testing, the app will continue with limited functionality');
  } else {
    console.log('✅ All required environment variables are configured');
  }
}