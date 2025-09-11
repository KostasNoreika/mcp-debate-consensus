/**
 * Enhanced Debate with Local Qwen3-235B as primary arbitrator
 */

const { SynthesisDebate } = require('./debate');
const { callOllama, ollamaAdapter } = require('./ollama-adapter');

class EnhancedDebate extends SynthesisDebate {
  constructor() {
    super();
    this.localArbitrator = 'qwen3:235b';
  }

  /**
   * Override runDebate to use enhanced arbitration
   */
  async runDebate(question, projectPath) {
    try {
      // Check if local model is available
      const hasLocalModel = await this.checkLocalModel();
      
      // Run standard debate process
      const result = await super.runDebate(question, projectPath);
      
      // If local model available, enhance with deep analysis
      if (hasLocalModel) {
        result.solution = await this.enhancedArbitration(
          question, 
          result.solution,
          projectPath
        );
      }
      
      return result;
    } catch (error) {
      console.error('Enhanced debate failed:', error);
      return super.runDebate(question, projectPath);
    }
  }

  /**
   * Check if Qwen3-235B is available locally
   */
  async checkLocalModel() {
    try {
      const models = await ollamaAdapter.listModels();
      return models.some(m => m.includes('qwen3') && m.includes('235'));
    } catch {
      return false;
    }
  }

  /**
   * Enhanced arbitration with Qwen3-235B
   * Returns only the final solution without meta information
   */
  async enhancedArbitration(question, currentSolution, projectPath) {
    const prompt = `${question}

Context: ${projectPath}

Task: Provide the optimal solution. Be comprehensive and detailed.
Focus on practical implementation.
Do not mention other models or the consensus process.
Give only the solution code and necessary explanations.`;

    try {
      console.log('Running enhanced arbitration with Qwen3-235B...');
      
      const response = await callOllama(this.localArbitrator, prompt, {
        temperature: 0.3, // Lower temperature for more focused response
        timeout: 300000   // 5 minutes for large model
      });
      
      // Extract code if response contains markdown blocks
      const codeMatch = response.match(/```[\s\S]*?```/g);
      if (codeMatch) {
        // Return code blocks with explanations between them
        return response;
      }
      
      // If no code blocks, return full response
      return response;
      
    } catch (error) {
      console.warn('Enhanced arbitration failed, using standard solution:', error.message);
      return currentSolution.code || currentSolution;
    }
  }

  /**
   * Override synthesis to produce cleaner output
   */
  synthesize(bestProposal, improvements) {
    // Get base synthesis
    const result = super.synthesize(bestProposal, improvements);
    
    // Clean up the code - remove debug comments and meta information
    let cleanCode = result.code;
    
    // Remove comments about which model contributed what
    cleanCode = cleanCode.replace(/\/\/\s*(claude|gpt5|qwen|gemini):.*/gi, '');
    
    // Remove empty lines that are too many
    cleanCode = cleanCode.replace(/\n{3,}/g, '\n\n');
    
    result.code = cleanCode.trim();
    return result;
  }
}

module.exports = { EnhancedDebate };