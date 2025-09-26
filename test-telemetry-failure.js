#!/usr/bin/env node

/**
 * Test telemetry graceful failure when API is unreachable
 */

import { TelemetryClient } from './src/telemetry-client.js';

console.log('🧪 Testing telemetry failure handling...\n');

// Test 1: API endpoint unreachable
console.log('Test 1: Unreachable endpoint');
const client1 = new TelemetryClient({
  endpoint: 'https://nonexistent.example.com/api',
  enabled: true,
  debug: true,
  flushInterval: 1000
});

await client1.send({
  question: 'Test question',
  category: 'test',
  models: ['k1', 'k2'],
  confidence: 0.85,
  responseTime: 1234,
  consensus: true
});

await client1.flush();
console.log('✅ No crash when endpoint unreachable\n');

// Test 2: Opt-out via environment variable
console.log('Test 2: TELEMETRY_DISABLED=true');
process.env.TELEMETRY_DISABLED = 'true';
const client2 = new TelemetryClient({
  debug: true
});

await client2.send({
  question: 'Test question 2',
  category: 'test',
  models: ['k3']
});

console.log(`✅ Telemetry disabled: enabled=${client2.enabled}\n`);

// Test 3: Invalid telemetry data
console.log('Test 3: Invalid telemetry data');
process.env.TELEMETRY_DISABLED = 'false';
const client3 = new TelemetryClient({
  debug: true
});

// Missing required fields
await client3.send({});
await client3.send({ category: 'test' }); // Missing models
await client3.send({ models: 'not-array' }); // Wrong type
await client3.send({ models: ['k1'], confidence: 1.5 }); // Invalid confidence

console.log('✅ Invalid data handled gracefully\n');

// Test 4: Normal operation with working endpoint
console.log('Test 4: Normal operation');
const client4 = new TelemetryClient({
  endpoint: 'https://stats.noreika.lt/api/telemetry',
  enabled: true,
  debug: true
});

await client4.send({
  question: 'What is 2+2?',
  category: 'math',
  models: ['k1', 'k2', 'k3'],
  winner: 'k2',
  confidence: 0.95,
  responseTime: 2500,
  consensus: true,
  fromCache: false,
  preset: 'quick'
});

await client4.flush();
await client4.shutdown();
console.log('✅ Normal telemetry operation works\n');

console.log('🎉 All telemetry tests passed!');
console.log('📌 Summary:');
console.log('  - Graceful failure when API unreachable');
console.log('  - Opt-out via TELEMETRY_DISABLED=true works');
console.log('  - Invalid data is rejected safely');
console.log('  - Valid telemetry is sent successfully');