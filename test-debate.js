import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(__dirname, 'index.js')],
  env: { ...process.env }
});

const client = new Client({
  name: 'test-client',
  version: '1.0',
  capabilities: {}  // Fix for MCP SDK initialization
});

async function test() {
  await client.connect(transport);
  console.log('Connected to MCP server');

  const tools = await client.listTools();
  console.log('Available tools:', tools.tools.map(t => t.name));

  // Get question from command line or use default
  const question = process.argv[2] || 'What is the best way to handle errors in async JavaScript?';
  console.log('\nAsking question:', question);

  // Test debate tool
  const result = await client.callTool('debate', {
    question: question
  });

  console.log('\n=== DEBATE RESULT ===');
  console.log(JSON.parse(result.content[0].text));

  await client.close();
}

test().catch(console.error);
