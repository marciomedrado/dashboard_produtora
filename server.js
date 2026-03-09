const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 1818;

// Detect if running inside pkg
const isPkg = typeof process.pkg !== 'undefined';
const rootDir = isPkg ? path.dirname(process.execPath) : __dirname;

app.use(express.json());

// Assets (public) are bundled inside pkg
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// ─── Data file paths (Outside EXE if pkg) ──────────────────────
const DATA_DIR = path.join(rootDir, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const APPS_FILE = path.join(DATA_DIR, 'apps.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// ─── Helper: read/write JSON ────────────────────────────────────
function readJSON(file, fallback = []) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) { console.error(`Error reading ${file}:`, e.message); }
    return fallback;
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Initialize default data if missing ─────────────────────────
function initDefaults() {
    if (!fs.existsSync(CHANNELS_FILE)) {
        writeJSON(CHANNELS_FILE, [
            { id: 'ch1', name: 'Canal Principal', color: '#6C5CE7', icon: '🎬', folders: [] },
        ]);
    }
    if (!fs.existsSync(APPS_FILE)) {
        writeJSON(APPS_FILE, []);
    }
    if (!fs.existsSync(PROJECTS_FILE)) {
        writeJSON(PROJECTS_FILE, []);
    }
    if (!fs.existsSync(SETTINGS_FILE)) {
        writeJSON(SETTINGS_FILE, {
            productionStages: [
                { id: 'idea', name: 'Ideia', icon: '💡', color: '#FDCB6E' },
                { id: 'script', name: 'Roteiro', icon: '📝', color: '#74B9FF' },
                { id: 'images', name: 'Produção de Imagens', icon: '🎨', color: '#FF9F43' },
                { id: 'recording', name: 'Gravação', icon: '🎙️', color: '#FF7675' },
                { id: 'editing', name: 'Edição', icon: '🎞️', color: '#A29BFE' },
                { id: 'thumbnail', name: 'Thumbnail', icon: '🖼️', color: '#55EFC4' },
                { id: 'review', name: 'Revisão', icon: '🔍', color: '#FD79A8' },
                { id: 'schedule', name: 'Agendar', icon: '📅', color: '#00CEC9' },
                { id: 'published', name: 'Publicado', icon: '✅', color: '#00B894' },
            ],
            labels: [
                { id: 'lbl1', name: 'Urgente', color: '#EB3B5A' },
                { id: 'lbl2', name: 'SEO', color: '#3867D6' },
                { id: 'lbl3', name: 'Tendência', color: '#FA8231' },
                { id: 'lbl4', name: 'Parceria', color: '#20BF6B' },
                { id: 'lbl5', name: 'Monetizado', color: '#8854D0' },
                { id: 'lbl6', name: 'Viral', color: '#F7B731' },
            ]
        });
    }
}
initDefaults();

// ══════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════

// ─── CHANNELS ───────────────────────────────────────────────────
app.get('/api/channels', (req, res) => {
    res.json(readJSON(CHANNELS_FILE, []));
});

app.post('/api/channels', (req, res) => {
    const channels = readJSON(CHANNELS_FILE, []);
    const newChannel = {
        id: 'ch' + Date.now(),
        name: req.body.name || 'Novo Canal',
        color: req.body.color || '#6C5CE7',
        icon: req.body.icon || '🎬',
        folders: req.body.folders || []
    };
    channels.push(newChannel);
    writeJSON(CHANNELS_FILE, channels);
    res.json(newChannel);
});

app.put('/api/channels/:id', (req, res) => {
    const channels = readJSON(CHANNELS_FILE, []);
    const idx = channels.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Canal não encontrado' });
    channels[idx] = { ...channels[idx], ...req.body };
    writeJSON(CHANNELS_FILE, channels);
    res.json(channels[idx]);
});

app.delete('/api/channels/:id', (req, res) => {
    let channels = readJSON(CHANNELS_FILE, []);
    channels = channels.filter(c => c.id !== req.params.id);
    writeJSON(CHANNELS_FILE, channels);
    res.json({ ok: true });
});

// ─── APPS / TOOLS ───────────────────────────────────────────────
app.get('/api/apps', (req, res) => {
    res.json(readJSON(APPS_FILE, []));
});

app.post('/api/apps', (req, res) => {
    const apps = readJSON(APPS_FILE, []);
    const newApp = {
        id: 'app' + Date.now(),
        name: req.body.name || 'Novo App',
        path: req.body.path || '',
        icon: req.body.icon || '🔧',
        category: req.body.category || 'geral',
        stage: req.body.stage || '',
        description: req.body.description || ''
    };
    apps.push(newApp);
    writeJSON(APPS_FILE, apps);
    res.json(newApp);
});

app.put('/api/apps/:id', (req, res) => {
    const apps = readJSON(APPS_FILE, []);
    const idx = apps.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'App não encontrado' });
    apps[idx] = { ...apps[idx], ...req.body };
    writeJSON(APPS_FILE, apps);
    res.json(apps[idx]);
});

app.delete('/api/apps/:id', (req, res) => {
    let apps = readJSON(APPS_FILE, []);
    apps = apps.filter(a => a.id !== req.params.id);
    writeJSON(APPS_FILE, apps);
    res.json({ ok: true });
});

// ─── PROJECTS (Videos) ──────────────────────────────────────────
app.get('/api/projects', (req, res) => {
    res.json(readJSON(PROJECTS_FILE, []));
});

app.post('/api/projects', (req, res) => {
    const projects = readJSON(PROJECTS_FILE, []);
    const newProject = {
        id: 'proj' + Date.now(),
        title: req.body.title || 'Novo Vídeo',
        channelId: req.body.channelId || '',
        stage: req.body.stage || 'idea',
        notes: req.body.notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: req.body.dueDate || '',
        tags: req.body.tags || [],
        priority: req.body.priority || 'normal'
    };
    projects.push(newProject);
    writeJSON(PROJECTS_FILE, projects);
    res.json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
    const projects = readJSON(PROJECTS_FILE, []);
    const idx = projects.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Projeto não encontrado' });
    projects[idx] = { ...projects[idx], ...req.body, updatedAt: new Date().toISOString() };
    writeJSON(PROJECTS_FILE, projects);
    res.json(projects[idx]);
});

app.delete('/api/projects/:id', (req, res) => {
    let projects = readJSON(PROJECTS_FILE, []);
    projects = projects.filter(p => p.id !== req.params.id);
    writeJSON(PROJECTS_FILE, projects);
    res.json({ ok: true });
});

// ─── SETTINGS ───────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
    res.json(readJSON(SETTINGS_FILE, {}));
});

app.put('/api/settings', (req, res) => {
    const settings = readJSON(SETTINGS_FILE, {});
    const updated = { ...settings, ...req.body };
    writeJSON(SETTINGS_FILE, updated);
    res.json(updated);
});

// ─── SYSTEM: Launch app ─────────────────────────────────────────
app.post('/api/launch', (req, res) => {
    const { path: appPath } = req.body;
    if (!appPath) return res.status(400).json({ error: 'Caminho não fornecido' });

    // Normalize the path
    const normalizedPath = path.normalize(appPath);

    // Check if the path exists
    if (!fs.existsSync(normalizedPath)) {
        return res.status(404).json({ error: `Caminho não encontrado: ${normalizedPath}` });
    }

    const stat = fs.statSync(normalizedPath);

    if (stat.isDirectory()) {
        // Open folder in Explorer
        exec(`explorer "${normalizedPath}"`, (err) => {
            if (err) console.error('Error opening folder:', err.message);
        });
        res.json({ ok: true, type: 'folder', path: normalizedPath });
    } else {
        // Launch the application from its own directory context!
        const appDir = path.dirname(normalizedPath);
        exec(`start "" "${normalizedPath}"`, { shell: true, cwd: appDir }, (err) => {
            if (err) console.error('Error launching app:', err.message);
        });
        res.json({ ok: true, type: 'file', path: normalizedPath });
    }
});

// ─── SYSTEM: Browse folder dialog (list contents) ───────────────
app.post('/api/browse', (req, res) => {
    const { folderPath } = req.body;
    const targetPath = folderPath || 'C:\\';

    if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    try {
        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const result = items
            .filter(item => {
                // Filter out system/hidden items
                try {
                    const fullPath = path.join(targetPath, item.name);
                    fs.accessSync(fullPath, fs.constants.R_OK);
                    return true;
                } catch { return false; }
            })
            .map(item => ({
                name: item.name,
                isDirectory: item.isDirectory(),
                path: path.join(targetPath, item.name)
            }))
            .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
        res.json({ path: targetPath, items: result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── SYSTEM: Get drives ─────────────────────────────────────────
app.get('/api/drives', (req, res) => {
    exec('wmic logicaldisk get name', (err, stdout) => {
        if (err) {
            return res.json(['C:']);
        }
        const drives = stdout.split('\r\n')
            .map(l => l.trim())
            .filter(l => /^[A-Z]:$/.test(l));
        res.json(drives.length ? drives : ['C:']);
    });
});

// ─── Serve the frontend ─────────────────────────────────────────
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n  🎬 Dashboard Produtora rodando em http://localhost:${PORT}\n`);

    // Abrir o navegador automaticamente (usando exec para evitar problemas de bundle com pkg)
    const url = `http://localhost:${PORT}`;
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
    exec(`${start} ${url}`);
});
