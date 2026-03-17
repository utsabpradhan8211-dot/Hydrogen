'use strict';

const state = {
  users: [],
  data: [],
  sortBy: 'name',
  sortDir: 'asc',
  charts: {},
  activityCount: 0,
  metricTimer: null
};

const ui = {
  dashboardPanel: document.getElementById('dashboardPanel'),
  userBadge: document.getElementById('userBadge'),
  userForm: document.getElementById('userForm'),
  userTableBody: document.getElementById('userTableBody'),
  globalSearch: document.getElementById('globalSearch'),
  notifications: document.getElementById('notifications'),
  settingsForm: document.getElementById('settingsForm'),
  exportCsv: document.getElementById('exportCsv'),
  themeToggle: document.getElementById('themeToggle')
};

const escapeHtml = (text) => String(text)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
};

function notify(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'notice';
  entry.style.borderColor = type === 'error' ? 'rgba(255,120,120,.45)' : 'var(--border)';
  entry.textContent = `${new Date().toLocaleTimeString()} • ${message}`;
  ui.notifications.prepend(entry);
  state.activityCount += 1;
  document.getElementById('kpiActivity').textContent = `${state.activityCount} events`;
}

function updateKpis() {
  const totalRevenue = state.data.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const totalUsers = state.users.length;
  const avgPerf = state.data.length
    ? Math.round(state.data.reduce((sum, item) => sum + Number(item.performance || 0), 0) / state.data.length)
    : 0;

  document.getElementById('kpiRevenue').textContent = `$${totalRevenue.toLocaleString()}`;
  document.getElementById('kpiUsers').textContent = `${totalUsers}`;
  document.getElementById('kpiPerformance').textContent = `${avgPerf}%`;
}

function renderUsers(search = '') {
  const term = search.toLowerCase();
  const sorted = [...state.users]
    .filter((user) => Object.values(user).join(' ').toLowerCase().includes(term))
    .sort((a, b) => {
      const left = String(a[state.sortBy]).toLowerCase();
      const right = String(b[state.sortBy]).toLowerCase();
      return state.sortDir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });

  ui.userTableBody.innerHTML = sorted.map((user) => `
    <tr>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.role)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn secondary-btn" data-action="edit" data-id="${user.id}">Edit</button>
          <button class="action-btn" data-action="delete" data-id="${user.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function initCharts() {
  const labels = state.data.map((item) => item.label);
  const revenue = state.data.map((item) => item.revenue);
  const performance = state.data.map((item) => item.performance);

  const lineCtx = document.getElementById('lineChart');
  const pieCtx = document.getElementById('pieChart');
  const barCtx = document.getElementById('barChart');
  if (!lineCtx || !pieCtx || !barCtx || !window.Chart) return;

  Object.values(state.charts).forEach((chart) => chart.destroy());

  state.charts.line = new Chart(lineCtx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Revenue', data: revenue, borderColor: '#46d0ff', tension: 0.36 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.charts.pie = new Chart(pieCtx, {
    type: 'pie',
    data: { labels, datasets: [{ data: performance, backgroundColor: ['#46d0ff', '#9a66ff', '#00d39f', '#ff9f43'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Performance', data: performance, backgroundColor: '#9a66ff' }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function simulateRealtimeMetrics() {
  clearInterval(state.metricTimer);
  state.metricTimer = setInterval(() => {
    if (!state.data.length) return;
    const i = Math.floor(Math.random() * state.data.length);
    state.data[i].performance = Math.max(20, Math.min(100, state.data[i].performance + Math.round((Math.random() - 0.5) * 8)));
    state.data[i].revenue = Math.max(1000, state.data[i].revenue + Math.round((Math.random() - 0.4) * 4000));
    updateKpis();
    initCharts();
  }, 7000);
}

function exportCsv() {
  const headers = ['id', 'label', 'revenue', 'performance', 'activeUsers', 'category'];
  const rows = state.data.map((entry) => headers.map((h) => JSON.stringify(entry[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'analytics-export.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  notify('Analytics CSV exported');
}

async function loadDashboard() {
  const [usersRes, dataRes] = await Promise.all([
    api('/api/users').catch(() => ({ users: [] })),
    api('/api/data').catch(() => ({ data: [] }))
  ]);

  state.users = usersRes.users;
  state.data = dataRes.data;

  updateKpis();
  renderUsers();
  initCharts();
  simulateRealtimeMetrics();
  notify('Dashboard synchronized');
}

function bindNavigation() {
  document.querySelectorAll('.nav-link').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const section = button.dataset.section;
      document.querySelectorAll('.section').forEach((node) => node.classList.add('hidden'));
      if (section !== 'overview') {
        document.getElementById(section).classList.remove('hidden');
      }
    });
  });
}

function bindDragDrop() {
  const cards = document.querySelectorAll('.kpi-card');
  const container = document.getElementById('kpiGrid');
  let dragged;
  cards.forEach((card) => {
    card.addEventListener('dragstart', () => { dragged = card; });
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', () => {
      if (dragged && dragged !== card) container.insertBefore(dragged, card);
    });
  });
}

function bindLazyLoad() {
  const targets = document.querySelectorAll('[data-lazy="true"]');
  targets.forEach((target) => target.classList.add('skeleton'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('skeleton');
        observer.unobserve(entry.target);
      }
    });
  });
  targets.forEach((target) => observer.observe(target));
}

ui.userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(ui.userForm);
  try {
    await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'),
        username: form.get('username'),
        email: form.get('email'),
        role: form.get('role')
      })
    });
    const { users } = await api('/api/users');
    state.users = users;
    renderUsers(ui.globalSearch.value);
    ui.userForm.reset();
    updateKpis();
    notify('Crew member added');
  } catch (error) {
    notify(error.message, 'error');
  }
});

ui.userTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const userId = Number(button.dataset.id);
  const action = button.dataset.action;
  const record = state.users.find((u) => u.id === userId);
  if (!record) return;

  try {
    if (action === 'delete') {
      await api(`/api/users/${userId}`, { method: 'DELETE' });
      notify(`Deleted crew profile: ${record.username}`);
    }

    if (action === 'edit') {
      const nextName = prompt('Update name', record.name);
      if (!nextName) return;
      await api(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: nextName })
      });
      notify(`Updated crew profile: ${record.username}`);
    }

    const { users } = await api('/api/users');
    state.users = users;
    renderUsers(ui.globalSearch.value);
  } catch (error) {
    notify(error.message, 'error');
  }
});

ui.globalSearch.addEventListener('input', (event) => {
  renderUsers(event.target.value);
});

document.querySelectorAll('th[data-sort]').forEach((header) => {
  header.addEventListener('click', () => {
    const key = header.dataset.sort;
    state.sortDir = state.sortBy === key && state.sortDir === 'asc' ? 'desc' : 'asc';
    state.sortBy = key;
    renderUsers(ui.globalSearch.value);
  });
});

ui.settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(ui.settingsForm);
  ui.userBadge.textContent = `${form.get('displayName')} • Autonomous`;
  notify(`System profile updated for ${form.get('displayName')}`);
});

ui.exportCsv.addEventListener('click', exportCsv);
ui.themeToggle.addEventListener('click', () => document.documentElement.classList.toggle('light'));

(async () => {
  bindNavigation();
  bindDragDrop();
  bindLazyLoad();
  await loadDashboard();
})();
