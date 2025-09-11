/**
 * File Context Provider
 * Provides project context to models that don't have direct file access
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class FileContextProvider {
  constructor() {
    this.maxFileSize = 50000; // 50KB max per file
    this.maxTotalSize = 500000; // 500KB total
  }

  /**
   * Gather project context for models
   */
  async gatherProjectContext(projectPath) {
    const context = {
      structure: '',
      packageJson: '',
      mainFiles: {},
      testCoverage: '',
      productionConfig: '',
      summary: ''
    };

    try {
      // 1. Get project structure
      const { stdout: tree } = await execAsync(`find ${projectPath} -type f -name "*.json" -o -name "*.js" -o -name "*.ts" | head -50`);
      context.structure = tree;

      // 2. Read package.json
      try {
        const packageJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
        context.packageJson = packageJson;
      } catch {}

      // 3. Check for test coverage
      try {
        const { stdout: coverage } = await execAsync(`cd ${projectPath} && npm run test:coverage --silent 2>/dev/null | tail -20`);
        context.testCoverage = coverage || 'No coverage data';
      } catch {
        context.testCoverage = 'No test coverage found';
      }

      // 4. Check for production configs
      const configFiles = ['.env.production', 'config/production.json', 'docker-compose.yml'];
      for (const file of configFiles) {
        try {
          const exists = await fs.access(path.join(projectPath, file));
          context.productionConfig += `✅ ${file} exists\n`;
        } catch {
          context.productionConfig += `❌ ${file} missing\n`;
        }
      }

      // 5. Generate summary
      context.summary = this.generateSummary(context);

      return context;

    } catch (error) {
      console.error('Error gathering context:', error);
      return {
        error: error.message,
        summary: 'Unable to analyze project'
      };
    }
  }

  generateSummary(context) {
    let summary = 'PROJECT ANALYSIS:\n\n';
    
    if (context.packageJson) {
      try {
        const pkg = JSON.parse(context.packageJson);
        summary += `Name: ${pkg.name}\n`;
        summary += `Version: ${pkg.version}\n`;
        summary += `Scripts: ${Object.keys(pkg.scripts || {}).join(', ')}\n`;
        summary += `Dependencies: ${Object.keys(pkg.dependencies || {}).length} packages\n`;
      } catch {}
    }

    summary += '\nPRODUCTION READINESS:\n';
    summary += context.productionConfig;

    summary += '\nTEST COVERAGE:\n';
    summary += context.testCoverage.substring(0, 200);

    return summary;
  }

  /**
   * Inject context into prompt for models
   */
  enhancePromptWithContext(originalPrompt, projectPath) {
    return new Promise(async (resolve) => {
      const context = await this.gatherProjectContext(projectPath);
      
      const enhancedPrompt = `${originalPrompt}

PROJECT CONTEXT:
================
${context.summary}

FILE STRUCTURE (sample):
${context.structure.substring(0, 500)}

PACKAGE.JSON:
${context.packageJson.substring(0, 1000)}

Based on this actual project analysis, provide your recommendation.`;

      resolve(enhancedPrompt);
    });
  }
}

module.exports = { FileContextProvider };