import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['/opt/mcp/servers/debate-consensus/index.js'],
  env: { ...process.env }
});

const client = new Client({ name: 'test-client', version: '1.0' });

async function test() {
  await client.connect(transport);
  console.log('Connected to MCP server');
  
  const tools = await client.listTools();
  console.log('Available tools:', tools.tools.map(t => t.name));
  
  // Test debate tool
  const result = await client.callTool('debate', {
    question: 'What is the best way to handle errors in async JavaScript?'
  });
  
  console.log('\n=== DEBATE RESULT ===');
  console.log(JSON.parse(result.content[0].text));
  
  await client.close();
}

test().catch(console.error);
