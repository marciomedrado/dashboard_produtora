/* ═══════════════════════════════════════════════════════════════════
   Dashboard Produtora — Frontend Application
   ═══════════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
// Path registry: stores raw paths by ID so we never need to escape them in onclick
const pathRegistry = new Map();
function registerPath(rawPath) {
  const id = 'p' + Math.random().toString(36).substring(2, 10);
  pathRegistry.set(id, rawPath);
  return id;
}

let state = {
  channels: [],
  apps: [],
  projects: [],
  settings: { productionStages: [] },
  currentView: 'dashboard',
  currentFolderPath: 'C:\\',
  browseMode: null,       // 'app' | 'channel-folder'
  browseCallback: null,
  browsePath: 'C:\\',
  browseSelected: '',
};

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  setupNavigation();
  setupSidebar();
  startClock();
  renderDashboard();
});

// ═══════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════
async function loadAll() {
  const [channels, apps, projects, settings] = await Promise.all([
    api('/api/channels'),
    api('/api/apps'),
    api('/api/projects'),
    api('/api/settings')
  ]);
  state.channels = channels;
  state.apps = apps;
  state.projects = projects;
  state.settings = settings;
}

async function api(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    return res.json();
  } catch (e) {
    console.error('API Error:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      showView(view);
    });
  });
}

function showView(viewName) {
  state.currentView = viewName;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update views
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${viewName}`);
  });

  // Render based on view
  switch (viewName) {
    case 'dashboard': renderDashboard(); break;
    case 'pipeline': renderPipeline(); break;
    case 'apps': renderApps(); break;
    case 'channels': renderChannels(); break;
    case 'folders': renderFolders(); break;
    case 'settings': renderSettings(); break;
  }
}

// ─── Sidebar Toggle ─────────────────────────────────────────────
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
}

// ─── Clock ──────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('sidebarClock');
  function update() {
    const now = new Date();
    el.textContent = now.toLocaleString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit'
    });
  }
  update();
  setInterval(update, 30000);
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════════════════════════════════
function renderDashboard() {
  // Greeting
  const hour = new Date().getHours();
  let greeting = 'Boa noite';
  if (hour >= 5 && hour < 12) greeting = 'Bom dia';
  else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
  document.getElementById('dashboardGreeting').textContent =
    `${greeting}! Aqui está o resumo da sua produção.`;

  // Stats
  const stages = state.settings.productionStages || [];
  const totalProjects = state.projects.length;
  const inProgress = state.projects.filter(p => p.stage !== 'published' && p.stage !== 'idea').length;
  const published = state.projects.filter(p => p.stage === 'published').length;
  const urgent = state.projects.filter(p => p.priority === 'urgent' || p.priority === 'high').length;

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card" style="--stat-color: var(--accent)">
      <div class="stat-icon">📹</div>
      <div class="stat-value">${totalProjects}</div>
      <div class="stat-label">Total de Vídeos</div>
    </div>
    <div class="stat-card" style="--stat-color: var(--info)">
      <div class="stat-icon">⚡</div>
      <div class="stat-value">${inProgress}</div>
      <div class="stat-label">Em Produção</div>
    </div>
    <div class="stat-card" style="--stat-color: var(--success)">
      <div class="stat-icon">✅</div>
      <div class="stat-value">${published}</div>
      <div class="stat-label">Publicados</div>
    </div>
    <div class="stat-card" style="--stat-color: var(--danger)">
      <div class="stat-icon">🔥</div>
      <div class="stat-value">${urgent}</div>
      <div class="stat-label">Prioridade Alta</div>
    </div>
  `;

  // Quick Apps
  const quickApps = document.getElementById('quickApps');
  if (state.apps.length === 0) {
    quickApps.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚀</div>
        <div class="empty-state-text">Nenhuma ferramenta cadastrada</div>
        <div class="empty-state-sub">Vá em Ferramentas para adicionar</div>
      </div>`;
  } else {
    quickApps.innerHTML = state.apps.slice(0, 8).map(app => {
      const pid = registerPath(app.path);
      return `
      <div class="quick-app-item" onclick="launchById('${pid}')" title="${escapeHtml(app.name)}">
        <span class="quick-app-icon">${app.icon || '🔧'}</span>
        <span class="quick-app-name">${escapeHtml(app.name)}</span>
      </div>
    `;
    }).join('');
  }

  // Upcoming
  const upcoming = document.getElementById('upcomingList');
  const upcomingProjects = state.projects
    .filter(p => p.stage !== 'published')
    .sort((a, b) => {
      const pri = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (pri[a.priority] || 2) - (pri[b.priority] || 2);
    })
    .slice(0, 6);

  if (upcomingProjects.length === 0) {
    upcoming.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Nenhum vídeo em produção</div>
        <div class="empty-state-sub">Crie novos vídeos no Pipeline</div>
      </div>`;
  } else {
    upcoming.innerHTML = upcomingProjects.map(p => {
      const stage = stages.find(s => s.id === p.stage);
      const channel = state.channels.find(c => c.id === p.channelId);
      return `
        <div class="upcoming-item" onclick="editProject('${p.id}')">
          <div class="upcoming-stage-dot" style="background: ${stage?.color || '#888'}"></div>
          <div class="upcoming-info">
            <div class="upcoming-title">${escapeHtml(p.title)}</div>
            <div class="upcoming-meta">${channel ? channel.icon + ' ' + channel.name : ''} · ${stage?.name || p.stage}</div>
          </div>
          <span class="upcoming-priority priority-${p.priority}">${priorityLabel(p.priority)}</span>
        </div>
      `;
    }).join('');
  }

  // Channels Overview
  const overview = document.getElementById('channelsOverview');
  if (state.channels.length === 0) {
    overview.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📺</div>
        <div class="empty-state-text">Nenhum canal criado</div>
      </div>`;
  } else {
    overview.innerHTML = state.channels.map(ch => {
      const chProjects = state.projects.filter(p => p.channelId === ch.id);
      const chInProg = chProjects.filter(p => p.stage !== 'published' && p.stage !== 'idea').length;
      const chDone = chProjects.filter(p => p.stage === 'published').length;
      return `
        <div class="channel-overview-card" style="--ch-color: ${ch.color}">
          <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${ch.color}"></div>
          <div class="channel-overview-header">
            <span class="channel-overview-icon">${ch.icon || '🎬'}</span>
            <span class="channel-overview-name">${escapeHtml(ch.name)}</span>
          </div>
          <div class="channel-overview-stats">
            <div class="channel-overview-stat">
              <div class="channel-overview-stat-val">${chProjects.length}</div>
              <div class="channel-overview-stat-lbl">Total</div>
            </div>
            <div class="channel-overview-stat">
              <div class="channel-overview-stat-val" style="color:var(--info)">${chInProg}</div>
              <div class="channel-overview-stat-lbl">Produzindo</div>
            </div>
            <div class="channel-overview-stat">
              <div class="channel-overview-stat-val" style="color:var(--success)">${chDone}</div>
              <div class="channel-overview-stat-lbl">Publicados</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE VIEW (Kanban)
// ═══════════════════════════════════════════════════════════════════
function renderPipeline() {
  const stages = state.settings.productionStages || [];
  const board = document.getElementById('pipelineBoard');
  const filterSel = document.getElementById('pipelineChannelFilter');

  // Populate channel filter
  filterSel.innerHTML = '<option value="">Todos os Canais</option>' +
    state.channels.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');

  filterSel.onchange = () => renderPipelineColumns();
  renderPipelineColumns();
}

function renderPipelineColumns() {
  const stages = state.settings.productionStages || [];
  const board = document.getElementById('pipelineBoard');
  const filterVal = document.getElementById('pipelineChannelFilter').value;

  let projects = state.projects;
  if (filterVal) projects = projects.filter(p => p.channelId === filterVal);

  board.innerHTML = stages.map(stage => {
    const stageProjects = projects.filter(p => p.stage === stage.id);
    return `
      <div class="pipeline-col">
        <div class="pipeline-col-header" style="--col-color: ${stage.color}">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${stage.color}"></div>
          <span class="pipeline-col-icon">${stage.icon}</span>
          <span class="pipeline-col-title">${escapeHtml(stage.name)}</span>
          <span class="pipeline-col-count">${stageProjects.length}</span>
        </div>
        <div class="pipeline-col-body" data-stage="${stage.id}" 
             ondragover="event.preventDefault(); this.classList.add('drag-over')" 
             ondragleave="this.classList.remove('drag-over')"
             ondrop="dropProject(event, '${stage.id}')">
          ${stageProjects.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.8rem;">Arraste vídeos aqui</div>' : ''}
          ${stageProjects.map(p => {
      const ch = state.channels.find(c => c.id === p.channelId);

      // Calculate Checklist Progress
      let progressHtml = '';
      if (p.checklist && p.checklist.length > 0) {
        const done = p.checklist.filter(c => c.done).length;
        const total = p.checklist.length;
        const pct = Math.round((done / total) * 100);
        progressHtml = `
          <div class="pipeline-card-progress" title="Checklist: ${done}/${total}">
            <div style="width: 14px">☑️</div>
            <div class="pipeline-card-progress-bar">
              <div class="pipeline-card-progress-fill ${done === total ? 'complete' : ''}" style="width: ${pct}%"></div>
            </div>
            <div style="font-size: 0.65rem">${done}/${total}</div>
          </div>
        `;
      }

      // Render Labels
      let labelsHtml = '';
      if (p.labels && p.labels.length > 0) {
        const allLabels = state.settings.labels || [];
        const cardLabels = p.labels.map(lId => allLabels.find(l => l.id === lId)).filter(Boolean);
        labelsHtml = `
          <div class="pipeline-card-labels">
            ${cardLabels.map(l => `<div class="pipeline-label" style="background-color: ${l.color}" title="${escapeAttr(l.name)}">${escapeHtml(l.name)}</div>`).join('')}
          </div>
        `;
      }

      // Check Dueto Status
      let dueClass = '';
      let dueText = '';
      if (p.dueDate) {
        const due = new Date(p.dueDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = due - today;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) dueClass = 'due-overdue';
        else if (diffDays === 0) dueClass = 'due-today';
        else if (diffDays <= 3) dueClass = 'due-soon';

        dueText = `<span class="${dueClass}">📅 ${formatDate(p.dueDate)}</span>`;
      }

      return `
              <div class="pipeline-card" draggable="true" 
                   onclick="openCardDetail('${p.id}')"
                   ondragstart="dragProject(event, '${p.id}')"
                   ondragend="event.target.classList.remove('dragging')">
                <div class="pipeline-card-actions">
                  <button onclick="event.stopPropagation(); editProject('${p.id}')" title="Editar">✏️</button>
                  <button onclick="event.stopPropagation(); deleteProject('${p.id}')" title="Excluir">🗑️</button>
                </div>
                ${labelsHtml}
                <div class="pipeline-card-title">${escapeHtml(p.title)}</div>
                ${ch ? `<div class="pipeline-card-channel"><span>${ch.icon}</span> ${escapeHtml(ch.name)}</div>` : ''}
                <div class="pipeline-card-meta">
                  <span>
                    <span class="upcoming-priority priority-${p.priority}">${priorityLabel(p.priority)}</span>
                    ${p.path ? (() => { const pid = registerPath(p.path); return `<button class="btn-ghost btn-sm" onclick="event.stopPropagation(); launchById('${pid}')" title="Abrir Pasta">📂</button>`; })() : ''}
                  </span>
                  ${dueText}
                </div>
                ${progressHtml}
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ─── Drag & Drop ────────────────────────────────────────────────
function dragProject(event, projectId) {
  event.dataTransfer.setData('text/plain', projectId);
  event.target.classList.add('dragging');
}

async function dropProject(event, newStage) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const projectId = event.dataTransfer.getData('text/plain');

  const project = state.projects.find(p => p.id === projectId);
  if (!project || project.stage === newStage) return;

  project.stage = newStage;
  await api(`/api/projects/${projectId}`, { method: 'PUT', body: { stage: newStage } });
  renderPipelineColumns();
  toast(`Movido para "${getStageName(newStage)}"`, 'success');
}

// ═══════════════════════════════════════════════════════════════════
// APPS VIEW
// ═══════════════════════════════════════════════════════════════════
function renderApps() {
  const stages = state.settings.productionStages || [];
  const filterBar = document.getElementById('appsFilterBar');
  const grid = document.getElementById('appsGrid');

  // Build filter chips
  const stageCategories = [...new Set(state.apps.map(a => a.stage).filter(Boolean))];
  filterBar.innerHTML = `
    <button class="filter-chip active" data-filter="" onclick="filterApps(this, '')">Todos</button>
    ${stages.map(s => {
    if (!stageCategories.includes(s.id)) return '';
    return `<button class="filter-chip" data-filter="${s.id}" onclick="filterApps(this, '${s.id}')">${s.icon} ${s.name}</button>`;
  }).join('')}
  `;

  renderAppsGrid('');
}

function filterApps(btn, filter) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderAppsGrid(filter);
}

function renderAppsGrid(filter) {
  const grid = document.getElementById('appsGrid');
  const stages = state.settings.productionStages || [];
  let apps = state.apps;
  if (filter) apps = apps.filter(a => a.stage === filter);

  if (apps.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <div class="empty-state-icon">🔧</div>
        <div class="empty-state-text">Nenhuma ferramenta ${filter ? 'nesta etapa' : 'cadastrada'}</div>
        <div class="empty-state-sub">Clique em "Adicionar Ferramenta" para começar</div>
      </div>`;
    return;
  }

  grid.innerHTML = apps.map(app => {
    const stage = stages.find(s => s.id === app.stage);
    return `
      <div class="app-card" style="--app-color: ${stage?.color || 'var(--accent)'}">
        <div class="app-card-actions">
          <button onclick="event.stopPropagation(); editApp('${app.id}')" title="Editar">✏️</button>
          <button onclick="event.stopPropagation(); deleteApp('${app.id}')" title="Excluir">🗑️</button>
        </div>
        <span class="app-card-icon">${app.icon || '🔧'}</span>
        <div class="app-card-name">${escapeHtml(app.name)}</div>
        <div class="app-card-desc">${escapeHtml(app.description || '')}</div>
        ${stage ? `<span class="app-card-stage" style="background: ${stage.color}22; color: ${stage.color}">${stage.icon} ${stage.name}</span>` : ''}
        <button class="app-card-launch" onclick="event.stopPropagation(); launchById('${(() => registerPath(app.path))()}')">
          ▶ Abrir
        </button>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// CHANNELS VIEW
// ═══════════════════════════════════════════════════════════════════
function renderChannels() {
  const grid = document.getElementById('channelsGrid');
  const stages = state.settings.productionStages || [];

  if (state.channels.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <div class="empty-state-icon">📺</div>
        <div class="empty-state-text">Nenhum canal criado</div>
        <div class="empty-state-sub">Clique em "Novo Canal" para começar</div>
      </div>`;
    return;
  }

  grid.innerHTML = state.channels.map(ch => {
    const chProjects = state.projects.filter(p => p.channelId === ch.id);
    const chInProg = chProjects.filter(p => p.stage !== 'published' && p.stage !== 'idea').length;
    const chDone = chProjects.filter(p => p.stage === 'published').length;

    return `
      <div class="channel-card">
        <div class="channel-card-banner" style="background: linear-gradient(135deg, ${ch.color}, ${ch.color}88)"></div>
        <div class="channel-card-body">
          <div class="channel-card-header">
            <div class="channel-card-title">
              <span class="channel-card-icon">${ch.icon || '🎬'}</span>
              <span class="channel-card-name">${escapeHtml(ch.name)}</span>
            </div>
            <div class="channel-card-actions">
              <button class="btn-icon btn-sm" onclick="editChannel('${ch.id}')" title="Editar">✏️</button>
              <button class="btn-icon btn-sm" onclick="deleteChannel('${ch.id}')" title="Excluir">🗑️</button>
            </div>
          </div>

          ${ch.folders && ch.folders.length > 0 ? `
            <div class="channel-card-folders">
              <div class="channel-card-folders-title">📁 Pastas</div>
              ${ch.folders.map(f => `
                <div class="channel-folder-item" onclick="launchById('${registerPath(f)}')" title="Abrir pasta">
                  📂 ${escapeHtml(f.split('\\').pop() || f)}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="channel-stats">
            <div class="channel-stat">
              <div class="channel-stat-val">${chProjects.length}</div>
              <div class="channel-stat-lbl">Vídeos</div>
            </div>
            <div class="channel-stat">
              <div class="channel-stat-val" style="color:var(--info)">${chInProg}</div>
              <div class="channel-stat-lbl">Produzindo</div>
            </div>
            <div class="channel-stat">
              <div class="channel-stat-val" style="color:var(--success)">${chDone}</div>
              <div class="channel-stat-lbl">Publicados</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// FOLDERS VIEW
// ═══════════════════════════════════════════════════════════════════
async function renderFolders() {
  await loadDrives();
  await browseFolderTo(state.currentFolderPath);
}

async function loadDrives() {
  const drives = await api('/api/drives');
  const el = document.getElementById('folderDrives');
  el.innerHTML = (drives || ['C:']).map(d => `
    <button class="drive-btn" onclick="browseFolderTo('${d}\\\\')">${d}</button>
  `).join('');
}

async function browseFolderTo(folderPath) {
  state.currentFolderPath = folderPath;
  const data = await api('/api/browse', { method: 'POST', body: { folderPath } });
  if (!data || data.error) {
    toast(data?.error || 'Erro ao acessar pasta', 'error');
    return;
  }

  // Breadcrumb
  const parts = data.path.split('\\').filter(Boolean);
  const breadcrumb = document.getElementById('folderBreadcrumb');
  let accumulated = '';
  breadcrumb.innerHTML = parts.map((part, i) => {
    accumulated += part + '\\';
    const p = accumulated;
    return `${i > 0 ? '<span class="breadcrumb-sep">›</span>' : ''}<span class="breadcrumb-item" onclick="browseFolderTo('${escapeAttr(p)}')">${escapeHtml(part)}</span>`;
  }).join('');

  // Contents
  const contents = document.getElementById('folderContents');
  if (data.items.length === 0) {
    contents.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><div class="empty-state-text">Pasta vazia</div></div>';
    return;
  }

  contents.innerHTML = data.items.map(item => `
    <div class="folder-item" onclick="${item.isDirectory ? `browseFolderTo('${escapeAttr(item.path)}')` : `launchById('${registerPath(item.path)}')`}">
      <span class="folder-item-icon">${item.isDirectory ? '📁' : getFileIcon(item.name)}</span>
      <span class="folder-item-name">${escapeHtml(item.name)}</span>
      <span class="folder-item-type">${item.isDirectory ? 'Pasta' : getFileExt(item.name)}</span>
    </div>
  `).join('');

  // Mark active drive
  document.querySelectorAll('.drive-btn').forEach(btn => {
    btn.classList.toggle('active', data.path.startsWith(btn.textContent));
  });
}

async function openFolderInExplorer() {
  await api('/api/launch', { method: 'POST', body: { path: state.currentFolderPath } });
  toast('Abrindo no Explorer...', 'info');
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════════════════════════════════
function renderSettings() {
  const stages = state.settings.productionStages || [];
  const editor = document.getElementById('stagesEditor');

  editor.innerHTML = stages.map((s, i) => `
    <div class="stage-editor-item">
      <input type="text" class="stage-icon-input" value="${s.icon}" onchange="updateStage(${i}, 'icon', this.value)" title="Ícone">
      <input type="text" class="stage-name-input" value="${escapeAttr(s.name)}" onchange="updateStage(${i}, 'name', this.value)" placeholder="Nome da etapa">
      <input type="color" class="stage-color-input" value="${s.color}" onchange="updateStage(${i}, 'color', this.value)" title="Cor">
      <button class="stage-remove" onclick="removeStage(${i})" title="Remover">✕</button>
    </div>
  `).join('');

  renderLabelsEditor();
}

// ─── Settings: Labels ───────────────────────────────────────────
function renderLabelsEditor() {
  const labels = state.settings.labels || [];
  const editor = document.getElementById('labelsEditor');

  if (!editor) return;

  editor.innerHTML = labels.map((l, i) => `
    <div class="label-editor-item">
      <input type="color" value="${l.color}" onchange="updateLabel(${i}, 'color', this.value)" title="Cor da Etiqueta">
      <input type="text" value="${escapeAttr(l.name)}" onchange="updateLabel(${i}, 'name', this.value)" placeholder="Nome da Etiqueta">
      <div class="label-preview" style="background-color: ${l.color}">${escapeHtml(l.name)}</div>
      <button class="stage-remove" onclick="removeLabel(${i})" title="Remover Etiqueta">✕</button>
    </div>
  `).join('');
}

async function updateLabel(index, field, value) {
  state.settings.labels[index][field] = value;
  await api('/api/settings', { method: 'PUT', body: state.settings });
  renderLabelsEditor();
  toast('Etiqueta atualizada', 'success');
}

async function removeLabel(index) {
  if (!confirm('Remover esta etiqueta?')) return;
  state.settings.labels.splice(index, 1);
  await api('/api/settings', { method: 'PUT', body: state.settings });
  renderLabelsEditor();
  toast('Etiqueta removida', 'success');
}

async function addLabel() {
  if (!state.settings.labels) state.settings.labels = [];
  const id = 'lbl' + Date.now();
  state.settings.labels.push({
    id, name: 'Nova Etiqueta', color: '#6C5CE7'
  });
  await api('/api/settings', { method: 'PUT', body: state.settings });
  renderLabelsEditor();
  toast('Etiqueta adicionada', 'success');
}

async function updateStage(index, field, value) {
  state.settings.productionStages[index][field] = value;
  await api('/api/settings', { method: 'PUT', body: state.settings });
  toast('Etapa atualizada', 'success');
}

async function removeStage(index) {
  if (!confirm('Remover esta etapa?')) return;
  state.settings.productionStages.splice(index, 1);
  await api('/api/settings', { method: 'PUT', body: state.settings });
  renderSettings();
  toast('Etapa removida', 'success');
}

async function addStage() {
  const id = 'stage' + Date.now();
  state.settings.productionStages.push({
    id, name: 'Nova Etapa', icon: '📌', color: '#9B59B6'
  });
  await api('/api/settings', { method: 'PUT', body: state.settings });
  renderSettings();
  toast('Etapa adicionada', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// MODALS — APP
// ═══════════════════════════════════════════════════════════════════
function openAppModal(appId = null) {
  const stages = state.settings.productionStages || [];
  document.getElementById('appStage').innerHTML =
    '<option value="">Nenhuma</option>' +
    stages.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');

  if (appId) {
    const app = state.apps.find(a => a.id === appId);
    if (!app) return;
    document.getElementById('appModalTitle').textContent = 'Editar Ferramenta';
    document.getElementById('appEditId').value = app.id;
    document.getElementById('appName').value = app.name;
    document.getElementById('appPath').value = app.path;
    document.getElementById('appIcon').value = app.icon;
    document.getElementById('appStage').value = app.stage || '';
    document.getElementById('appDescription').value = app.description || '';
  } else {
    document.getElementById('appModalTitle').textContent = 'Adicionar Ferramenta';
    document.getElementById('appEditId').value = '';
    document.getElementById('appName').value = '';
    document.getElementById('appPath').value = '';
    document.getElementById('appIcon').value = '🔧';
    document.getElementById('appStage').value = '';
    document.getElementById('appDescription').value = '';
  }

  openModal('appModal');
}

async function saveApp() {
  const id = document.getElementById('appEditId').value;
  const data = {
    name: document.getElementById('appName').value.trim(),
    path: document.getElementById('appPath').value.trim(),
    icon: document.getElementById('appIcon').value.trim() || '🔧',
    stage: document.getElementById('appStage').value,
    description: document.getElementById('appDescription').value.trim()
  };

  if (!data.name) { toast('Nome é obrigatório', 'error'); return; }
  if (!data.path) { toast('Caminho é obrigatório', 'error'); return; }

  if (id) {
    await api(`/api/apps/${id}`, { method: 'PUT', body: data });
    const idx = state.apps.findIndex(a => a.id === id);
    if (idx !== -1) state.apps[idx] = { ...state.apps[idx], ...data };
    toast('Ferramenta atualizada!', 'success');
  } else {
    const newApp = await api('/api/apps', { method: 'POST', body: data });
    if (newApp) state.apps.push(newApp);
    toast('Ferramenta adicionada!', 'success');
  }

  closeModal('appModal');
  if (state.currentView === 'apps') renderApps();
  if (state.currentView === 'dashboard') renderDashboard();
}

function editApp(id) { openAppModal(id); }

async function deleteApp(id) {
  if (!confirm('Remover esta ferramenta?')) return;
  await api(`/api/apps/${id}`, { method: 'DELETE' });
  state.apps = state.apps.filter(a => a.id !== id);
  renderApps();
  toast('Ferramenta removida', 'success');
}

// ─── Browse for App Path ────────────────────────────────────────
function openBrowseForApp() {
  state.browseMode = 'app';
  state.browseCallback = (selectedPath) => {
    document.getElementById('appPath').value = selectedPath;
  };
  state.browseSelected = '';
  state.browsePath = 'C:\\';
  openBrowseModal();
}

// ═══════════════════════════════════════════════════════════════════
// MODALS — CHANNEL
// ═══════════════════════════════════════════════════════════════════
function openChannelModal(channelId = null) {
  if (channelId) {
    const ch = state.channels.find(c => c.id === channelId);
    if (!ch) return;
    document.getElementById('channelModalTitle').textContent = 'Editar Canal';
    document.getElementById('channelEditId').value = ch.id;
    document.getElementById('channelName').value = ch.name;
    document.getElementById('channelColor').value = ch.color;
    document.getElementById('channelIcon').value = ch.icon || '🎬';
    renderChannelFolders(ch.folders || []);
  } else {
    document.getElementById('channelModalTitle').textContent = 'Novo Canal';
    document.getElementById('channelEditId').value = '';
    document.getElementById('channelName').value = '';
    document.getElementById('channelColor').value = '#6C5CE7';
    document.getElementById('channelIcon').value = '🎬';
    renderChannelFolders([]);
  }

  openModal('channelModal');
}

function renderChannelFolders(folders) {
  const list = document.getElementById('channelFoldersList');
  list.innerHTML = folders.map((f, i) => `
    <div class="channel-folder-entry">
      <input type="text" class="input-styled channel-folder-path" value="${escapeAttr(f)}" placeholder="C:\\Caminho\\da\\pasta">
      <button class="btn-icon" onclick="browseForChannelFolder(${i})" title="Procurar">📂</button>
      <button class="remove-folder-btn" onclick="this.parentElement.remove()" title="Remover">✕</button>
    </div>
  `).join('');
}

function addChannelFolder() {
  const list = document.getElementById('channelFoldersList');
  const idx = list.children.length;
  const div = document.createElement('div');
  div.className = 'channel-folder-entry';
  div.innerHTML = `
    <input type="text" class="input-styled channel-folder-path" value="" placeholder="C:\\Caminho\\da\\pasta">
    <button class="btn-icon" onclick="browseForChannelFolder(${idx})" title="Procurar">📂</button>
    <button class="remove-folder-btn" onclick="this.parentElement.remove()" title="Remover">✕</button>
  `;
  list.appendChild(div);
}

function browseForChannelFolder(index) {
  state.browseMode = 'channel-folder';
  state.browseCallback = (selectedPath) => {
    const inputs = document.querySelectorAll('.channel-folder-path');
    if (inputs[index]) inputs[index].value = selectedPath;
  };
  state.browseSelected = '';
  state.browsePath = 'C:\\';
  openBrowseModal();
}

async function saveChannel() {
  const id = document.getElementById('channelEditId').value;
  const folders = Array.from(document.querySelectorAll('.channel-folder-path'))
    .map(input => input.value.trim())
    .filter(Boolean);

  const data = {
    name: document.getElementById('channelName').value.trim(),
    color: document.getElementById('channelColor').value,
    icon: document.getElementById('channelIcon').value.trim() || '🎬',
    folders
  };

  if (!data.name) { toast('Nome é obrigatório', 'error'); return; }

  if (id) {
    await api(`/api/channels/${id}`, { method: 'PUT', body: data });
    const idx = state.channels.findIndex(c => c.id === id);
    if (idx !== -1) state.channels[idx] = { ...state.channels[idx], ...data };
    toast('Canal atualizado!', 'success');
  } else {
    const newCh = await api('/api/channels', { method: 'POST', body: data });
    if (newCh) state.channels.push(newCh);
    toast('Canal criado!', 'success');
  }

  closeModal('channelModal');
  if (state.currentView === 'channels') renderChannels();
  if (state.currentView === 'dashboard') renderDashboard();
}

function editChannel(id) { openChannelModal(id); }

async function deleteChannel(id) {
  if (!confirm('Remover este canal? Os vídeos vinculados não serão excluídos.')) return;
  await api(`/api/channels/${id}`, { method: 'DELETE' });
  state.channels = state.channels.filter(c => c.id !== id);
  renderChannels();
  toast('Canal removido', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// MODALS — PROJECT
// ═══════════════════════════════════════════════════════════════════
function openProjectModal(projectId = null) {
  const stages = state.settings.productionStages || [];

  // Populate selects
  document.getElementById('projectChannel').innerHTML =
    '<option value="">Sem canal</option>' +
    state.channels.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('');

  document.getElementById('projectStage').innerHTML =
    stages.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');

  // Labels Selector
  const allLabels = state.settings.labels || [];
  const projectLabels = projectId ? (state.projects.find(p => p.id === projectId)?.labels || []) : [];
  document.getElementById('projectLabels').innerHTML = allLabels.map(l => `
    <div class="label-toggle ${projectLabels.includes(l.id) ? 'selected' : ''}" 
         style="background-color: ${l.color}" 
         onclick="this.classList.toggle('selected'); this.dataset.id = '${l.id}'"
         data-id="${projectLabels.includes(l.id) ? l.id : ''}">
      ${escapeHtml(l.name)}
    </div>
  `).join('');

  // Checklist
  const projectChecklist = projectId ? (state.projects.find(p => p.id === projectId)?.checklist || []) : [];
  window._tempChecklist = JSON.parse(JSON.stringify(projectChecklist));
  renderChecklistEditor();

  if (projectId) {
    const p = state.projects.find(pr => pr.id === projectId);
    if (!p) return;
    document.getElementById('projectModalTitle').textContent = 'Editar Vídeo';
    document.getElementById('projectEditId').value = p.id;
    document.getElementById('projectTitle').value = p.title;
    document.getElementById('projectPath').value = p.path || '';
    document.getElementById('projectChannel').value = p.channelId || '';
    document.getElementById('projectStage').value = p.stage;
    document.getElementById('projectPriority').value = p.priority;
    document.getElementById('projectDueDate').value = p.dueDate || '';
    document.getElementById('projectNotes').value = p.notes || '';
  } else {
    document.getElementById('projectModalTitle').textContent = 'Novo Vídeo';
    document.getElementById('projectEditId').value = '';
    document.getElementById('projectTitle').value = '';
    document.getElementById('projectPath').value = '';
    document.getElementById('projectChannel').value = '';
    document.getElementById('projectStage').value = stages[0]?.id || '';
    document.getElementById('projectPriority').value = 'normal';
    document.getElementById('projectDueDate').value = '';
    document.getElementById('projectNotes').value = '';
  }

  openModal('projectModal');
}

async function saveProject() {
  const id = document.getElementById('projectEditId').value;
  const data = {
    title: document.getElementById('projectTitle').value.trim(),
    path: document.getElementById('projectPath').value.trim(),
    channelId: document.getElementById('projectChannel').value,
    stage: document.getElementById('projectStage').value,
    priority: document.getElementById('projectPriority').value,
    dueDate: document.getElementById('projectDueDate').value,
    notes: document.getElementById('projectNotes').value.trim(),
    labels: Array.from(document.querySelectorAll('.label-toggle.selected')).map(el => el.dataset.id || el.getAttribute('onclick').match(/'([^']+)'/)[1]),
    checklist: window._tempChecklist.map((c, i) => ({
      text: document.getElementById(`checklist-input-${i}`).value,
      done: document.getElementById(`checklist-cb-${i}`).checked
    })).filter(c => c.text.trim() !== '')
  };

  if (!data.title) { toast('Título é obrigatório', 'error'); return; }

  if (id) {
    await api(`/api/projects/${id}`, { method: 'PUT', body: data });
    const idx = state.projects.findIndex(p => p.id === id);
    if (idx !== -1) state.projects[idx] = { ...state.projects[idx], ...data };
    toast('Vídeo atualizado!', 'success');
  } else {
    const newP = await api('/api/projects', { method: 'POST', body: data });
    if (newP) state.projects.push(newP);
    toast('Vídeo adicionado!', 'success');
  }

  closeModal('projectModal');
  if (state.currentView === 'pipeline') renderPipelineColumns();
  if (state.currentView === 'dashboard') renderDashboard();
}

function editProject(id) { openProjectModal(id); }

async function deleteProject(id) {
  if (!confirm('Remover este vídeo?')) return;
  await api(`/api/projects/${id}`, { method: 'DELETE' });
  state.projects = state.projects.filter(a => a.id !== id);
  renderPipelineColumns();
  toast('Vídeo removido', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// CARD DETAIL (TRELLO LIKE)
// ═══════════════════════════════════════════════════════════════════
function openCardDetail(id) {
  const p = state.projects.find(pr => pr.id === id);
  if (!p) return;

  const ch = state.channels.find(c => c.id === p.channelId);
  const stage = (state.settings.productionStages || []).find(s => s.id === p.stage);

  // Labels
  let labelsHtml = '';
  if (p.labels && p.labels.length > 0) {
    const allLabels = state.settings.labels || [];
    const cardLabels = p.labels.map(lId => allLabels.find(l => l.id === lId)).filter(Boolean);
    labelsHtml = `
      <div class="card-detail-section">
        <h4>🏷️ Etiquetas</h4>
        <div class="card-detail-labels">
          ${cardLabels.map(l => `<div class="card-detail-label" style="background-color: ${l.color}">${escapeHtml(l.name)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  // Checklist
  let checklistHtml = '';
  if (p.checklist && p.checklist.length > 0) {
    const done = p.checklist.filter(c => c.done).length;
    const total = p.checklist.length;
    const pct = Math.round((done / total) * 100);

    checklistHtml = `
      <div class="card-detail-section">
        <h4>✅ Checklist</h4>
        <div class="pipeline-card-progress" style="margin-bottom:12px;">
          <div style="font-weight:600; color:var(--text-primary)">${Math.round(pct)}%</div>
          <div class="pipeline-card-progress-bar" style="height:6px;">
            <div class="pipeline-card-progress-fill ${done === total ? 'complete' : ''}" style="width: ${pct}%"></div>
          </div>
        </div>
        <div class="card-detail-checklist">
          ${p.checklist.map((item, i) => `
            <label class="card-detail-checklist-item ${item.done ? 'checked' : ''}">
              <input type="checkbox" onchange="toggleCardChecklist('${p.id}', ${i}, this.checked)" ${item.done ? 'checked' : ''}>
              <span>${escapeHtml(item.text)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Notes
  let notesHtml = '';
  if (p.notes) {
    notesHtml = `
      <div class="card-detail-section">
        <h4>📝 Notas</h4>
        <div class="card-detail-notes">${escapeHtml(p.notes)}</div>
      </div>
    `;
  }

  // Path btn
  let pathBtn = '';
  if (p.path) {
    const pid = registerPath(p.path);
    pathBtn = `<button class="btn-secondary" style="width:100%; justify-content:center; margin-top:8px" onclick="launchById('${pid}')">📂 Abrir Pasta</button>`;
  }

  document.getElementById('cardDetailBody').innerHTML = `
    <div class="card-detail-grid">
      <div class="card-detail-main">
        ${labelsHtml}
        ${notesHtml}
        ${checklistHtml}
        
        ${(!p.notes && (!p.checklist || p.checklist.length === 0) && (!p.labels || p.labels.length === 0)) ?
      '<div class="empty-state"><div class="empty-state-text">Card vazio. Edite para adicionar conteúdo.</div></div>' : ''}
      </div>
      
      <div class="card-detail-sidebar">
        <div class="card-detail-section">
          <h4>📊 Informações</h4>
          <div class="card-detail-info-item">
            <span class="label">Canal</span>
            <span class="value">${ch ? ch.icon + ' ' + escapeHtml(ch.name) : '-'}</span>
          </div>
          <div class="card-detail-info-item">
            <span class="label">Etapa</span>
            <span class="value" style="color: ${stage?.color || 'inherit'}">${stage ? stage.icon + ' ' + stage.name : p.stage}</span>
          </div>
          <div class="card-detail-info-item">
            <span class="label">Prioridade</span>
            <span class="value"><span class="upcoming-priority priority-${p.priority}">${priorityLabel(p.priority)}</span></span>
          </div>
          <div class="card-detail-info-item">
            <span class="label">Data Limite</span>
            <span class="value">${p.dueDate ? formatDate(p.dueDate) : '-'}</span>
          </div>
          ${pathBtn}
        </div>
      </div>
    </div>
  `;

  document.getElementById('cardDetailTitle').textContent = p.title;

  const editBtn = document.getElementById('cardDetailEditBtn');
  editBtn.onclick = () => {
    closeModal('cardDetailModal');
    editProject(p.id);
  };

  openModal('cardDetailModal');
}

async function toggleCardChecklist(projectId, index, isChecked) {
  const p = state.projects.find(pr => pr.id === projectId);
  if (!p) return;

  p.checklist[index].done = isChecked;
  await api(`/api/projects/${projectId}`, { method: 'PUT', body: p });

  // Automatically update views without closing modal
  renderPipelineColumns();
  if (state.currentView === 'dashboard') renderDashboard();
  openCardDetail(projectId); // Re-render modal details to update progress bar
}

// ─── Checklist Editor Helpers ─────────────────────────────────────
function renderChecklistEditor() {
  const container = document.getElementById('projectChecklist');
  container.innerHTML = window._tempChecklist.map((item, i) => `
    <div class="checklist-item">
      <input type="checkbox" id="checklist-cb-${i}" ${item.done ? 'checked' : ''} onchange="window._tempChecklist[${i}].done = this.checked">
      <input type="text" id="checklist-input-${i}" value="${escapeAttr(item.text)}" placeholder="Nova tarefa..." onchange="window._tempChecklist[${i}].text = this.value">
      <button class="checklist-remove" onclick="removeChecklistItem(${i})">✕</button>
    </div>
  `).join('');
}

function addChecklistItem() {
  window._tempChecklist.push({ text: '', done: false });
  renderChecklistEditor();
}

function removeChecklistItem(index) {
  window._tempChecklist.splice(index, 1);
  renderChecklistEditor();
}

// ─── Browse for Project Path ─────────────────────────────────────
function openBrowseForProject() {
  state.browseMode = 'channel-folder'; // reuse folder browser logic
  state.browseCallback = (selectedPath) => {
    document.getElementById('projectPath').value = selectedPath;
  };
  state.browseSelected = '';
  state.browsePath = 'C:\\';
  openBrowseModal();
}

// ═══════════════════════════════════════════════════════════════════
// BROWSE MODAL
// ═══════════════════════════════════════════════════════════════════
async function openBrowseModal() {
  openModal('browseModal');

  // Load drives
  const drives = await api('/api/drives');
  document.getElementById('browseDrives').innerHTML =
    (drives || ['C:']).map(d => `
      <button class="drive-btn" onclick="browseTo('${d}\\\\')">${d}</button>
    `).join('');

  browseTo(state.browsePath);
}

async function browseTo(folderPath) {
  state.browsePath = folderPath;
  document.getElementById('browseCurrentPath').value = folderPath;

  const data = await api('/api/browse', { method: 'POST', body: { folderPath } });
  if (!data || data.error) {
    document.getElementById('browseList').innerHTML = `<div class="empty-state"><div class="empty-state-text">${data?.error || 'Erro'}</div></div>`;
    return;
  }

  const list = document.getElementById('browseList');
  list.innerHTML = data.items.map(item => `
    <div class="browse-item ${item.path === state.browseSelected ? 'selected' : ''}" 
         onclick="${item.isDirectory ? `browseTo('${escapeAttr(item.path)}')` : `selectBrowseItem('${escapeAttr(item.path)}')`}"
         ondblclick="${item.isDirectory ? '' : `confirmBrowse()`}">
      <span class="browse-item-icon">${item.isDirectory ? '📁' : getFileIcon(item.name)}</span>
      <span>${escapeHtml(item.name)}</span>
    </div>
  `).join('');

  // For folder selection, allow selecting the current folder
  if (state.browseMode === 'channel-folder') {
    state.browseSelected = folderPath;
  }
}

function selectBrowseItem(itemPath) {
  state.browseSelected = itemPath;
  document.querySelectorAll('.browse-item').forEach(el => el.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

function confirmBrowse() {
  const selected = state.browseSelected || state.browsePath;
  if (state.browseCallback) {
    state.browseCallback(selected);
  }
  closeModal('browseModal');
}

// ═══════════════════════════════════════════════════════════════════
// LAUNCH
// ═══════════════════════════════════════════════════════════════════

// Launch by registered path ID — avoids all escaping issues
function launchById(pathId) {
  const rawPath = pathRegistry.get(pathId);
  if (rawPath) launchApp(rawPath);
  else toast('Caminho não encontrado no registro', 'error');
}

async function launchApp(appPath) {
  if (!appPath) return;

  // URLs: open in a new browser tab directly
  if (/^https?:\/\//i.test(appPath)) {
    window.open(appPath, '_blank', 'noopener');
    toast(`Abrindo: ${appPath}`, 'success');
    return;
  }

  // Local paths: ask the server to launch (exe, folder, etc.)
  const result = await api('/api/launch', { method: 'POST', body: { path: appPath } });
  if (result && result.ok) {
    toast(`Abrindo: ${appPath.split('\\').pop() || appPath}`, 'success');
  } else {
    toast(result?.error || 'Erro ao abrir', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('show');
  });
});

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function priorityLabel(p) {
  const labels = { urgent: 'Urgente', high: 'Alta', normal: 'Normal', low: 'Baixa' };
  return labels[p] || p;
}

function getStageName(stageId) {
  const s = (state.settings.productionStages || []).find(s => s.id === stageId);
  return s ? s.name : stageId;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getFileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const icons = {
    exe: '⚙️', msi: '⚙️', bat: '⚙️', cmd: '⚙️', ps1: '⚙️',
    mp4: '🎥', avi: '🎥', mkv: '🎥', mov: '🎥', wmv: '🎥', webm: '🎥',
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵', ogg: '🎵',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️', psd: '🖼️',
    pdf: '📄', doc: '📄', docx: '📄', txt: '📄', rtf: '📄',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📑', pptx: '📑',
    zip: '📦', rar: '📦', '7z': '📦',
    js: '💻', ts: '💻', py: '💻', html: '💻', css: '💻', json: '💻',
    srt: '💬', ass: '💬', vtt: '💬',
    prproj: '🎬', aep: '🎬', drp: '🎬',
  };
  return icons[ext] || '📄';
}

function getFileExt(name) {
  const ext = name.split('.').pop();
  return ext !== name ? '.' + ext : '';
}

// ─── Toast ──────────────────────────────────────────────────────
function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ─── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  }
});
