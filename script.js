'use strict';

const state = {
  currentUser: null,
  permissions: [],
  users: [],
  data: [],
  sortBy: 'name',
  sortDir: 'asc',
  charts: {},
  activityCount: 0
};

const ui = {
  loginPanel: document.getElementById('loginPanel'),
  dashboardPanel: document.getElementById('dashboardPanel'),
  loginForm: document.getElementById('loginForm'),
  logoutBtn: document.getElementById('logoutBtn'),
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
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
};

function notify(message) {
  const entry = document.createElement('div');
  entry.className = 'notice';
  entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  ui.notifications.prepend(entry);
  state.activityCount += 1;
  document.getElementById('kpiActivity').textContent = `${state.activityCount} events`;
}

function setRoleUi() {
  const canCreate = state.permissions.includes('create');
  const canSettings = state.permissions.includes('settings');
  document.getElementById('users').classList.toggle('hidden', !canCreate && !state.permissions.includes('read'));
  document.getElementById('settings').classList.toggle('hidden', !canSettings);
  ui.userForm.classList.toggle('hidden', !canCreate);
}

function updateKpis() {
  const totalRevenue = state.data.reduce((sum, item) => sum + item.revenue, 0);
  const totalUsers = state.users.length;
  const avgPerf = state.data.length
    ? Math.round(state.data.reduce((sum, item) => sum + item.performance, 0) / state.data.length)
    : 0;
  document.getElementById('kpiRevenue').textContent = `$${totalRevenue.toLocaleString()}`;
  document.getElementById('kpiUsers').textContent = `${totalUsers}`;
  document.getElementById('kpiPerformance').textContent = `${avgPerf}%`;
}

function renderUsers(search = '') {
  const term = search.toLowerCase();
  const sorted = [...state.users]
    .filter((u) => Object.values(u).join(' ').toLowerCase().includes(term))
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

  Object.values(state.charts).forEach((chart) => chart.destroy());

  state.charts.line = new Chart(lineCtx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Revenue', data: revenue, borderColor: '#3ca9ff', tension: 0.4 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.charts.pie = new Chart(pieCtx, {
    type: 'pie',
    data: { labels, datasets: [{ data: performance, backgroundColor: ['#3ca9ff', '#8a61ff', '#22c55e', '#f97316'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Performance', data: performance, backgroundColor: '#8a61ff' }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
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
}

async function loadDashboard() {
  const [{ user, permissions }, { users }, { data }] = await Promise.all([
    api('/api/me'),
    api('/api/users'),
    api('/api/data')
  ]);

  state.currentUser = user;
  state.permissions = permissions;
  state.users = users;
  state.data = data;

  ui.userBadge.textContent = `${user.name} (${user.role})`;
  updateKpis();
  renderUsers();
  setRoleUi();
  initCharts();
  notify('Dashboard loaded successfully');
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
      if (dragged && dragged !== card) {
        container.insertBefore(dragged, card);
      }
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

ui.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(ui.loginForm);
  try {
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password')
      })
    });
    ui.loginPanel.classList.add('hidden');
    ui.dashboardPanel.classList.remove('hidden');
    await loadDashboard();
  } catch (error) {
    notify(error.message);
  }
});

ui.logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (_error) {
    // no-op
  }
  ui.dashboardPanel.classList.add('hidden');
  ui.loginPanel.classList.remove('hidden');
  ui.userBadge.textContent = 'Guest';
  notify('Logged out');
});

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
    notify('User created');
    updateKpis();
  } catch (error) {
    notify(error.message);
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
  notify(`Settings saved for ${form.get('displayName')}`);
});

ui.exportCsv.addEventListener('click', exportCsv);
ui.themeToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
});

(async () => {
  bindNavigation();
  bindDragDrop();
  bindLazyLoad();
  try {
    await loadDashboard();
    ui.loginPanel.classList.add('hidden');
    ui.dashboardPanel.classList.remove('hidden');
  } catch (_error) {
    ui.loginPanel.classList.remove('hidden');
  }
})();
