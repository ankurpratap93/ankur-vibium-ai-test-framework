import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PORT = 3000;

const app = express();
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));

// API: list available test suites
app.get('/api/suites', (req, res) => {
  const testsDir = path.join(ROOT, 'src/k11-platform/tests');
  const suites = [];
  if (fs.existsSync(testsDir)) {
    for (const dir of fs.readdirSync(testsDir)) {
      const full = path.join(testsDir, dir);
      if (fs.statSync(full).isDirectory()) {
        const files = fs.readdirSync(full).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.js'));
        suites.push({ id: dir, name: dir.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), files, path: `src/k11-platform/tests/${dir}` });
      }
    }
  }
  res.json(suites);
});

// API: list reports
app.get('/api/reports', (req, res) => {
  const reportsDir = path.join(ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) return res.json([]);
  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 20);
  const reports = files.map(f => {
    try { return { file: f, ...JSON.parse(fs.readFileSync(path.join(reportsDir, f), 'utf8')) }; } catch { return { file: f }; }
  });
  res.json(reports);
});

// API: list artifacts
app.get('/api/artifacts', (req, res) => {
  const dirs = ['artifacts/valueup', 'artifacts/screenshots', 'apiResponses'];
  const all = [];
  for (const d of dirs) {
    const full = path.join(ROOT, d);
    if (fs.existsSync(full)) {
      for (const f of fs.readdirSync(full)) {
        const stat = fs.statSync(path.join(full, f));
        all.push({ dir: d, file: f, size: stat.size, modified: stat.mtime });
      }
    }
  }
  res.json(all);
});

// API: read artifact
app.get('/api/artifact/:dir/:file', (req, res) => {
  const filePath = path.join(ROOT, req.params.dir, req.params.file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  if (req.params.file.endsWith('.png')) return res.sendFile(filePath);
  if (req.params.file.endsWith('.json')) return res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  res.send(fs.readFileSync(filePath, 'utf8'));
});

// API: read config
app.get('/api/config', (req, res) => {
  const envPath = path.join(ROOT, '.env');
  const envExample = path.join(ROOT, '.env.example');
  res.json({
    hasEnv: fs.existsSync(envPath),
    example: fs.existsSync(envExample) ? fs.readFileSync(envExample, 'utf8') : '',
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket: stream test execution
wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'run') {
      const suitePath = msg.suite || 'src/k11-platform/tests';
      const args = ['jest', suitePath, '--runInBand', '--verbose', '--forceExit', '--no-cache'];

      ws.send(JSON.stringify({ type: 'status', status: 'running', suite: suitePath }));
      ws.send(JSON.stringify({ type: 'log', text: `$ npx ${args.join(' ')}`, level: 'cmd' }));

      const proc = spawn('npx', args, {
        cwd: ROOT,
        env: { ...process.env, NODE_ENV: 'test', FORCE_COLOR: '0' },
        shell: true,
      });

      const sendLog = (data, stream) => {
        const text = data.toString();
        for (const line of text.split('\n')) {
          if (!line.trim()) continue;
          let level = 'info';
          if (line.includes('PASS')) level = 'pass';
          else if (line.includes('FAIL')) level = 'fail';
          else if (line.includes('✓') || line.includes('✅')) level = 'pass';
          else if (line.includes('✕') || line.includes('❌')) level = 'fail';
          else if (line.includes('console.log')) level = 'log';
          else if (line.includes('●')) level = 'error';
          else if (stream === 'stderr') level = 'warn';
          ws.send(JSON.stringify({ type: 'log', text: line, level }));
        }
      };

      proc.stdout.on('data', d => sendLog(d, 'stdout'));
      proc.stderr.on('data', d => sendLog(d, 'stderr'));

      proc.on('close', (code) => {
        ws.send(JSON.stringify({ type: 'status', status: code === 0 ? 'passed' : 'failed', code }));
        ws.send(JSON.stringify({ type: 'done', code }));
      });

      // Allow abort
      ws.on('message', (inner) => {
        try {
          const cmd = JSON.parse(inner);
          if (cmd.type === 'abort') { proc.kill('SIGTERM'); ws.send(JSON.stringify({ type: 'status', status: 'aborted' })); }
        } catch {}
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  🚀 QA Dashboard running at http://localhost:${PORT}\n`);
});
