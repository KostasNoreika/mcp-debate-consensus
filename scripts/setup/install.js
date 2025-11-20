#!/usr/bin/env node

/**
 * Cross-platform installation script for MCP Debate Consensus Server
 * Automatically detects OS and sets up Claude CLI integration
 */

import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const prefix = type === 'success' ? `${COLORS.green}✅` :
                 type === 'warning' ? `${COLORS.yellow}⚠️` :
                 type === 'error' ? `${COLORS.red}❌` :
                 `${COLORS.cyan}📌`;
  console.log(`${prefix} ${message}${COLORS.reset}`);
}

function header(title) {
  console.log(`\n${COLORS.bright}${COLORS.cyan}${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}${COLORS.reset}\n`);
}

async function checkCommand(command) {
  return new Promise((resolve) => {
    exec(`which ${command} 2>/dev/null || where ${command} 2>nul`, (error) => {
      resolve(!error);
    });
  });
}

async function execCommand(command, description) {
  return new Promise((resolve, reject) => {
    log(`${description}...`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log(`Failed: ${stderr || error.message}`, 'error');
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${COLORS.yellow}${question}${COLORS.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function checkPrerequisites() {
  header('Checking Prerequisites');
  
  const checks = {
    node: await checkCommand('node'),
    npm: await checkCommand('npm'),
    git: await checkCommand('git')
  };
  
  let allGood = true;
  
  if (!checks.node) {
    log('Node.js is not installed. Please install Node.js 18+', 'error');
    allGood = false;
  } else {
    const version = await execCommand('node --version', 'Checking Node.js version');
    log(`Node.js ${version} found`, 'success');
  }
  
  if (!checks.npm) {
    log('npm is not installed. Please install npm', 'error');
    allGood = false;
  }
  
  if (!checks.git) {
    log('Git is not installed (optional but recommended)', 'warning');
  }
  
  return allGood;
}

async function installDependencies() {
  header('Installing Dependencies');
  
  try {
    await execCommand('npm install', 'Installing main dependencies');
    log('Main dependencies installed', 'success');
    
    // Install proxy server dependencies
    process.chdir('claude-router');
    await execCommand('npm install', 'Installing proxy server dependencies');
    process.chdir('..');
    log('Proxy server dependencies installed', 'success');
    
    return true;
  } catch (error) {
    log('Failed to install dependencies', 'error');
    return false;
  }
}

async function setupEnvironment() {
  header('Setting Up Environment');
  
  // Check if .env exists
  try {
    await fs.access('.env');
    log('.env file already exists', 'success');
  } catch {
    // Copy from example
    try {
      await fs.copyFile('.env.example', '.env');
      log('Created .env file from template', 'success');
      
      const apiKey = await prompt('Enter your OpenRouter API key (or press Enter to add later): ');
      if (apiKey) {
        const envContent = await fs.readFile('.env', 'utf8');
        const updated = envContent.replace('your_openrouter_api_key_here', apiKey);
        await fs.writeFile('.env', updated);
        log('API key configured', 'success');
      } else {
        log('Remember to add your OpenRouter API key to .env file', 'warning');
      }
    } catch (error) {
      log('Failed to create .env file', 'error');
      return false;
    }
  }
  
  return true;
}

async function detectClaudeCLI() {
  header('Detecting Claude CLI');
  
  const platform = os.platform();
  const homeDir = os.homedir();
  
  // Common Claude CLI locations
  const locations = [
    path.join(homeDir, '.claude', 'local', 'claude'),
    path.join(homeDir, '.claude', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    'C:\\Program Files\\Claude CLI\\claude.exe',
    'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Claude\\claude.exe'
  ];
  
  // Check if claude command is available
  const hasClaudeCommand = await checkCommand('claude');
  if (hasClaudeCommand) {
    const claudePath = await execCommand('which claude 2>/dev/null || where claude 2>nul', 'Finding Claude CLI');
    log(`Claude CLI found at: ${claudePath}`, 'success');
    return claudePath.trim();
  }
  
  // Check common locations
  for (const loc of locations) {
    try {
      await fs.access(loc, fsSync.constants.X_OK);
      log(`Claude CLI found at: ${loc}`, 'success');
      return loc;
    } catch {
      // Continue checking
    }
  }
  
  log('Claude CLI not found', 'warning');
  log('You can install it with: npm install -g @anthropic/claude-cli', 'info');
  
  const install = await prompt('Would you like to install Claude CLI now? (y/n): ');
  if (install.toLowerCase() === 'y') {
    try {
      await execCommand('npm install -g @anthropic/claude-cli', 'Installing Claude CLI');
      log('Claude CLI installed successfully', 'success');
      return 'claude'; // Use the global command
    } catch (error) {
      log('Failed to install Claude CLI. Please install manually', 'error');
      return null;
    }
  }
  
  return null;
}

async function updateWrapperScripts(claudePath) {
  header('Updating Wrapper Scripts');
  
  const wrappers = ['k1-wrapper.sh', 'k2-wrapper.sh', 'k3-wrapper.sh', 'k4-wrapper.sh'];
  const platform = os.platform();
  
  for (const wrapper of wrappers) {
    try {
      let content = await fs.readFile(wrapper, 'utf8');
      
      // Update Claude CLI path
      if (claudePath && claudePath !== 'claude') {
        content = content.replace(
          /exec .* --dangerously-skip-permissions/,
          `exec ${claudePath} --dangerously-skip-permissions`
        );
      }
      
      // Update home directory variable for cross-platform
      if (platform === 'win32') {
        content = content.replace('$HOME', '%USERPROFILE%');
      }
      
      await fs.writeFile(wrapper, content);
      
      // Make executable on Unix-like systems
      if (platform !== 'win32') {
        await fs.chmod(wrapper, '755');
      }
      
      log(`Updated ${wrapper}`, 'success');
    } catch (error) {
      log(`Failed to update ${wrapper}: ${error.message}`, 'error');
    }
  }
  
  return true;
}

async function createConfigDirs() {
  header('Creating Configuration Directories');
  
  const homeDir = os.homedir();
  const configs = ['.claude-k1', '.claude-k2', '.claude-k3', '.claude-k4'];
  
  for (const config of configs) {
    const configPath = path.join(homeDir, config);
    try {
      await fs.mkdir(configPath, { recursive: true });
      
      // Create basic MCP config for each
      const mcpConfig = {
        mcpServers: {}
      };
      
      await fs.writeFile(
        path.join(configPath, '.claude.json'),
        JSON.stringify(mcpConfig, null, 2)
      );
      
      log(`Created config directory: ${config}`, 'success');
    } catch (error) {
      if (error.code !== 'EEXIST') {
        log(`Failed to create ${config}: ${error.message}`, 'warning');
      }
    }
  }
  
  return true;
}

async function testSetup() {
  header('Testing Setup');
  
  // Test proxy server
  log('Starting proxy server test...');
  const proxy = spawn('node', ['k-proxy-server.js'], {
    detached: false,
    stdio: 'pipe'
  });
  
  let proxyStarted = false;
  
  proxy.stdout.on('data', (data) => {
    if (data.toString().includes('proxy running')) {
      proxyStarted = true;
    }
  });
  
  // Wait for proxy to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  if (proxyStarted) {
    log('Proxy server started successfully', 'success');
  } else {
    log('Proxy server may not have started correctly', 'warning');
  }
  
  proxy.kill();
  
  // Check if test script exists
  try {
    await fs.access('test-debate.js');
    log('Test script available', 'success');
    log('Run "npm test" to verify the installation', 'info');
  } catch {
    log('Test script not found', 'warning');
  }
  
  return true;
}

async function showNextSteps() {
  header('Installation Complete! 🎉');
  
  console.log(`
${COLORS.bright}Next Steps:${COLORS.reset}

1. ${COLORS.yellow}Add your OpenRouter API key:${COLORS.reset}
   Edit the .env file and add your key
   Get one at: https://openrouter.ai/keys

2. ${COLORS.yellow}Start the proxy server:${COLORS.reset}
   node k-proxy-server.js

3. ${COLORS.yellow}Run a test debate:${COLORS.reset}
   node test-debate.js "Your question here"

4. ${COLORS.yellow}For MCP integration:${COLORS.reset}
   Add to your ~/.claude.json:
   {
     "mcpServers": {
       "debate-consensus": {
         "command": "node",
         "args": ["${process.cwd()}/index.js"],
         "env": {
           "OPENROUTER_API_KEY": "your-key-here"
         }
       }
     }
   }

${COLORS.green}Documentation:${COLORS.reset} See README.md for full details
${COLORS.green}Support:${COLORS.reset} Open an issue on GitHub if you need help
`);
}

async function main() {
  console.clear();
  header('MCP Debate Consensus Server - Installation');
  
  console.log(`Platform: ${os.platform()}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Installation Directory: ${process.cwd()}\n`);
  
  // Run installation steps
  const steps = [
    { fn: checkPrerequisites, name: 'Prerequisites' },
    { fn: installDependencies, name: 'Dependencies' },
    { fn: setupEnvironment, name: 'Environment' },
    { fn: detectClaudeCLI, name: 'Claude CLI', saveResult: true },
    { fn: createConfigDirs, name: 'Config Directories' },
    { fn: null, name: 'Wrapper Scripts', special: 'updateWrappers' },
    { fn: testSetup, name: 'Setup Test' }
  ];
  
  let claudePath = null;
  
  for (const step of steps) {
    if (step.special === 'updateWrappers') {
      if (!await updateWrapperScripts(claudePath)) {
        log(`Step "${step.name}" encountered issues`, 'warning');
      }
    } else if (step.fn) {
      const result = await step.fn();
      if (step.saveResult) {
        claudePath = result;
      }
      if (!result && step.name === 'Prerequisites') {
        log('Cannot continue without prerequisites', 'error');
        process.exit(1);
      }
    }
  }
  
  await showNextSteps();
}

// Run installation
main().catch(error => {
  log(`Installation failed: ${error.message}`, 'error');
  process.exit(1);
});