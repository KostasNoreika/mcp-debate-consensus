import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DebateHistory {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureDirectory();
  }
  
  async ensureDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  async save(debate) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const id = `debate_${timestamp}_${randomId}`;
    const filepath = path.join(this.logDir, `${id}.json`);
    
    const dataToSave = {
      id,
      timestamp,
      ...debate
    };
    
    await fs.writeFile(
      filepath, 
      JSON.stringify(dataToSave),
      { encoding: 'utf8' }
    );
    
    return id;
  }
  
  async get(id) {
    const filepath = path.join(this.logDir, `${id}.json`);
    const data = await fs.readFile(filepath, 'utf8');
    return JSON.parse(data);
  }
  
  async list(limit = 10) {
    const files = await fs.readdir(this.logDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    // Sort by filename (which includes timestamp)
    jsonFiles.sort().reverse();
    
    // Take only the requested limit
    const filesToProcess = jsonFiles.slice(0, limit);
    
    const debates = [];
    for (const file of filesToProcess) {
      try {
        const id = file.replace('.json', '');
        const data = await this.get(id);
        debates.push({
          id: data.id || id,
          timestamp: data.timestamp,
          question: data.question,
          winner: data.winner || data.initialWinner,
          score: data.score
        });
      } catch (error) {
        // Skip corrupted files
        console.error(`Failed to read ${file}:`, error.message);
      }
    }
    
    return debates;
  }
  
  async cleanup(retentionDays = 30) {
    const files = await fs.readdir(this.logDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    for (const file of jsonFiles) {
      try {
        const filepath = path.join(this.logDir, file);
        const data = await fs.readFile(filepath, 'utf8');
        const debate = JSON.parse(data);
        
        if (debate.timestamp < cutoffTime) {
          await fs.unlink(filepath);
          console.log(`Deleted old debate: ${file}`);
        }
      } catch (error) {
        console.error(`Failed to process ${file}:`, error.message);
      }
    }
  }
}

export { DebateHistory };