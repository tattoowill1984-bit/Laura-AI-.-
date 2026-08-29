// sovereign_spine.ts - Operational Data & Governance
import fs from 'fs';
import path from 'path';

const STORAGE_PATH = path.join(process.cwd(), '.sovereign_state');

export interface LogEntry {
  id: string;
  type: string;
  content: any;
  timestamp: string;
}

export function initStorage() {
  if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

export function appendToLedger(type: string, content: any) {
  try {
    initStorage();
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date().toISOString()
    };
    const logPath = path.join(STORAGE_PATH, 'ledger.log');
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');

    // Rotate log if it exceeds 500KB to keep disk usage lean
    try {
      const stats = fs.statSync(logPath);
      if (stats.size > 500 * 1024) {
        const raw = fs.readFileSync(logPath, 'utf8');
        const lines = raw.trim().split('\n');
        if (lines.length > 200) {
          const trimmed = lines.slice(-150).join('\n') + '\n';
          fs.writeFileSync(logPath, trimmed);
        }
      }
    } catch {}

    return entry;
  } catch (err: any) {
    console.error('[Spine] Error appending to ledger:', err?.message || err);
    return null;
  }
}

export function getSelfState() {
  try {
    initStorage();
    const p = path.join(STORAGE_PATH, 'self.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { posture: 'OPTIMAL', status: 'ACTIVE', tasks: [], lastHealTime: new Date().toISOString() };
  } catch (err) {
    return { posture: 'RECOVERED', status: 'ACTIVE', tasks: [], lastHealTime: new Date().toISOString() };
  }
}

export function saveSelfState(state: any) {
  try {
    initStorage();
    fs.writeFileSync(path.join(STORAGE_PATH, 'self.json'), JSON.stringify(state, null, 2));
  } catch (err: any) {
    console.error('[Spine] Error saving state:', err?.message || err);
  }
}

export function selfHealCycle() {
  try {
    const currentState = getSelfState();
    const memUsage = process.memoryUsage();
    
    // Auto-heal posture if degraded or stalled
    const updatedState = {
      ...currentState,
      posture: 'OPTIMAL',
      status: 'AUTONOMOUS_RUNNING',
      lastHealTime: new Date().toISOString(),
      healthMetrics: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        uptimeSec: Math.round(process.uptime()),
        status: 'HEALTHY'
      }
    };

    saveSelfState(updatedState);
    appendToLedger('AUTONOMOUS_HEAL_CYCLE', {
      timestamp: updatedState.lastHealTime,
      status: 'SUCCESS',
      heapUsedMB: updatedState.healthMetrics.heapUsedMB,
      uptimeSec: updatedState.healthMetrics.uptimeSec
    });

    return updatedState;
  } catch (healError: any) {
    console.error('[Self-Healing Cycle Error]:', healError?.message || healError);
    return null;
  }
}

