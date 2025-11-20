#!/usr/bin/env node

/**
 * Setup script for Debate Consensus MCP Server
 * 
 * This script performs comprehensive setup checks and initialization:
 * - Validates .env file and OPENROUTER_API_KEY
 * - Creates necessary directories
 * - Verifies wrapper scripts are executable
 * - Starts proxy server
 * - Runs health checks
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SetupManager {
    constructor() {
        this.projectRoot = __dirname;
        this.envFile = path.join(this.projectRoot, '.env');
        this.requiredDirs = [
            '.claude-k1',
            '.claude-k2', 
            '.claude-k3',
            '.claude-k4',
            'logs'
        ];
        this.wrapperScripts = [
            'k1-wrapper.sh',
            'k2-wrapper.sh',
            'k3-wrapper.sh', 
            'k4-wrapper.sh'
        ];
        this.PROXY_PORT = 3456;
        this.setupComplete = false;
    }

    async run() {
        console.log('🚀 Debate Consensus MCP Server Setup\n');
        console.log('📍 Project root:', this.projectRoot);
        console.log('🔧 Performing comprehensive setup checks...\n');

        try {
            await this.checkEnvFile();
            await this.createDirectories();
            await this.checkWrapperScripts();
            await this.startProxyServer();
            await this.runHealthCheck();
            
            this.setupComplete = true;
            console.log('\n✅ Setup completed successfully!');
            console.log('\n🎯 Ready to use:');
            console.log('   npm start           # Start MCP server');
            console.log('   npm test            # Run tests');
            console.log('   npm run health      # Health check');
            
        } catch (error) {
            console.error('\n❌ Setup failed:', error.message);
            console.error('\n🔧 Manual steps may be required. Check the error above.');
            process.exit(1);
        }
    }

    /**
     * Check .env file and OPENROUTER_API_KEY
     */
    async checkEnvFile() {
        console.log('1️⃣  Checking .env file and API key...');
        
        try {
            await fs.access(this.envFile);
            console.log('   ✅ .env file exists');
        } catch (error) {
            console.log('   ⚠️  .env file not found, creating template...');
            
            const envTemplate = `# OpenRouter API Key (required)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Debate timeout in minutes (optional, default: 60)
DEBATE_TIMEOUT_MINUTES=60

# Development settings (optional)
NODE_ENV=development
DEBUG=false
`;
            
            await fs.writeFile(this.envFile, envTemplate);
            console.log('   📝 Created .env template');
            throw new Error('Please add your OPENROUTER_API_KEY to the .env file and run setup again');
        }
        
        // Load and validate environment variables
        dotenv.config({ path: this.envFile });
        
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
            throw new Error('OPENROUTER_API_KEY is required in .env file. Get your key from https://openrouter.ai/');
        }
        
        console.log('   ✅ OPENROUTER_API_KEY found and configured');
        
        const timeoutMinutes = parseInt(process.env.DEBATE_TIMEOUT_MINUTES) || 60;
        console.log(`   ⏱️  Timeout: ${timeoutMinutes} minutes`);
    }

    /**
     * Create necessary directories
     */
    async createDirectories() {
        console.log('\n2️⃣  Creating necessary directories...');
        
        for (const dir of this.requiredDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            
            try {
                await fs.mkdir(dirPath, { recursive: true });
                console.log(`   ✅ Created/verified: ${dir}/`);
            } catch (error) {
                console.error(`   ❌ Failed to create ${dir}/:`, error.message);
                throw error;
            }
        }
        
        // Create a sample log file if logs directory is empty
        const logsDir = path.join(this.projectRoot, 'logs');
        const logFiles = await fs.readdir(logsDir);
        
        if (logFiles.length === 0) {
            const sampleLog = {
                timestamp: Date.now(),
                type: 'setup',
                message: 'Logs directory initialized by setup script',
                version: '1.0.0'
            };
            
            await fs.writeFile(
                path.join(logsDir, `setup_${Date.now()}.json`),
                JSON.stringify(sampleLog, null, 2)
            );
            console.log('   📝 Initialized logs directory');
        }
    }

    /**
     * Check wrapper scripts are executable
     */
    async checkWrapperScripts() {
        console.log('\n3️⃣  Checking wrapper scripts...');
        
        for (const script of this.wrapperScripts) {
            const scriptPath = path.join(this.projectRoot, script);
            
            try {
                await fs.access(scriptPath);
                console.log(`   ✅ Found: ${script}`);
                
                // Check if executable
                const stats = await fs.stat(scriptPath);
                const isExecutable = stats.mode & parseInt('111', 8);
                
                if (!isExecutable) {
                    console.log(`   🔧 Making ${script} executable...`);
                    await fs.chmod(scriptPath, '755');
                }
                
            } catch (error) {
                console.log(`   ⚠️  Wrapper script missing: ${script}`);
                console.log(`      Creating basic wrapper for ${script}...`);
                
                const kNumber = script.match(/k(\d)/)?.[1] || '1';
                const wrapperContent = `#!/bin/bash
# Auto-generated wrapper script for k${kNumber}
# This script routes Claude CLI calls through the k-proxy server

export ANTHROPIC_API_URL="http://localhost:${3456 + parseInt(kNumber)}/v1"
export ANTHROPIC_API_KEY="proxy-key-k${kNumber}"

# Execute Claude CLI with all arguments
exec claude "$@"
`;
                
                await fs.writeFile(scriptPath, wrapperContent);
                await fs.chmod(scriptPath, '755');
                console.log(`   📝 Created wrapper: ${script}`);
            }
        }
    }

    /**
     * Start proxy server if not running
     */
    async startProxyServer() {
        console.log('\n4️⃣  Checking proxy server...');
        
        // Check if already running
        try {
            const response = await axios.get(`http://localhost:${this.PROXY_PORT}/health`, { 
                timeout: 2000 
            });
            console.log('   ✅ K-Proxy server already running');
            console.log(`   🔗 URL: http://localhost:${this.PROXY_PORT}`);
            return;
        } catch (error) {
            console.log('   🚀 Starting k-proxy server...');
        }
        
        // Start proxy server
        const proxyScript = path.join(this.projectRoot, 'k-proxy-server.js');
        
        return new Promise((resolve, reject) => {
            const proxyProcess = spawn('node', [proxyScript], {
                cwd: this.projectRoot,
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: true
            });
            
            let startupOutput = '';
            let resolved = false;
            
            proxyProcess.stdout.on('data', (data) => {
                startupOutput += data.toString();
                
                if (startupOutput.includes('proxy running on http://localhost') && !resolved) {
                    resolved = true;
                    console.log('   ✅ K-Proxy server started successfully');
                    console.log(`   🔗 URL: http://localhost:${this.PROXY_PORT}`);
                    
                    // Detach the process so it keeps running
                    proxyProcess.unref();
                    resolve();
                }
            });
            
            proxyProcess.stderr.on('data', (data) => {
                console.error('   [PROXY ERROR]', data.toString().trim());
            });
            
            proxyProcess.on('error', (error) => {
                if (!resolved) {
                    reject(new Error(`Failed to start proxy: ${error.message}`));
                }
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (!resolved) {
                    proxyProcess.kill();
                    reject(new Error('Proxy server startup timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Run comprehensive health check
     */
    async runHealthCheck() {
        console.log('\n5️⃣  Running health checks...');
        
        // Check proxy server
        try {
            const response = await axios.get(`http://localhost:${this.PROXY_PORT}/health`, {
                timeout: 5000
            });
            console.log('   ✅ K-Proxy server responding');
            console.log(`   📊 Status: ${response.data.status}`);
        } catch (error) {
            throw new Error(`Proxy health check failed: ${error.message}`);
        }
        
        // Check individual k-proxy endpoints
        const kPorts = [3457, 3458, 3459, 3460];
        const kNames = ['k1', 'k2', 'k3', 'k4'];
        
        for (let i = 0; i < kPorts.length; i++) {
            try {
                const response = await axios.get(`http://localhost:${kPorts[i]}/health`, {
                    timeout: 3000
                });
                console.log(`   ✅ ${kNames[i]} endpoint responding (${response.data.model})`);
            } catch (error) {
                console.log(`   ⚠️  ${kNames[i]} endpoint not responding (this is normal during startup)`);
            }
        }
        
        // Test directory permissions
        const testFile = path.join(this.projectRoot, 'logs', `test_${Date.now()}.tmp`);
        try {
            await fs.writeFile(testFile, 'setup test');
            await fs.unlink(testFile);
            console.log('   ✅ File system permissions OK');
        } catch (error) {
            throw new Error(`File system permission test failed: ${error.message}`);
        }
        
        console.log('   🔍 Health check completed');
    }
}

// Run setup if called directly
const setup = new SetupManager();
setup.run().catch((error) => {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
});

export { SetupManager };