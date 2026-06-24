/**
 * Dashboard — Role-based rendering and navigation
 */

const Dashboard = {
  user: null,
  currentSection: 'overview',

  // ─── Initialization ──────────────────────────────────────────────────────

  async init() {
    try {
      const data = await API.get('/api/auth/me');
      if (!data || !data.user) {
        window.location.href = '/';
        return;
      }
      Dashboard.user = data.user;
      Dashboard.user.balance = data.balance || 0;

      Dashboard.renderSidebar();
      Dashboard.renderUserInfo();
      Dashboard.navigateTo('overview');
      Dashboard.initMobileMenu();
      Bills.init();
    } catch {
      window.location.href = '/';
    }
  },

  // ─── Sidebar Navigation ──────────────────────────────────────────────────

  renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    const role = Dashboard.user.role;
    let items = [];

    if (role === 'laborer') {
      items = [
        { section: 'overview', icon: '📊', label: 'Dashboard' },
        { section: 'upload', icon: '📷', label: 'Upload Bill' },
        { section: 'bills', icon: '📋', label: 'My Bills' },
        { section: 'transactions', icon: '💰', label: 'Transactions' },
      ];
    } else if (role === 'contractor') {
      items = [
        { section: 'overview', icon: '📊', label: 'Dashboard' },
        { section: 'bills', icon: '📋', label: 'Review Bills', badge: 'pending' },
        { section: 'laborers', icon: '👷', label: 'My Laborers' },
        { section: 'transactions', icon: '💰', label: 'Transactions' },
      ];
    } else if (role === 'admin') {
      items = [
        { section: 'overview', icon: '📊', label: 'Dashboard' },
        { section: 'bills', icon: '📋', label: 'Pending Approvals', badge: 'pending' },
        { section: 'allbills', icon: '📑', label: 'All Bills' },
        { section: 'contractors', icon: '🏗', label: 'Contractors' },
        { section: 'laborers', icon: '👷', label: 'All Laborers' },
        { section: 'transactions', icon: '💰', label: 'Transactions' },
      ];
    }

    nav.innerHTML = `
      <div class="nav-section-title">Navigation</div>
      ${items.map(item => `
        <div class="nav-item ${item.section === Dashboard.currentSection ? 'active' : ''}"
             data-section="${item.section}">
          <span class="nav-item-icon">${item.icon}</span>
          <span>${item.label}</span>
          ${item.badge ? `<span class="nav-item-badge" id="badge-${item.section}" style="display:none">0</span>` : ''}
        </div>
      `).join('')}
    `;

    // Click handlers
    nav.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', () => {
        Dashboard.navigateTo(el.dataset.section);
        // Close mobile menu
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('visible');
      });
    });

    // Load badge counts
    Dashboard.updateBadges();
  },

  async updateBadges() {
    try {
      const data = await API.get('/api/bills/stats/summary');
      if (!data) return;

      if (Dashboard.user.role === 'contractor' && data.pending_reviews > 0) {
        const badge = document.getElementById('badge-bills');
        if (badge) { badge.textContent = data.pending_reviews; badge.style.display = ''; }
      }
      if (Dashboard.user.role === 'admin' && data.pending_approvals > 0) {
        const badge = document.getElementById('badge-bills');
        if (badge) { badge.textContent = data.pending_approvals; badge.style.display = ''; }
      }
    } catch {}
  },

  renderUserInfo() {
    const initials = Dashboard.user.full_name
      .split(' ')
      .map(w => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = Dashboard.user.full_name;

    const roleLabels = { admin: 'Super Admin', contractor: 'Contractor', laborer: 'Laborer' };
    document.getElementById('userRole').textContent = roleLabels[Dashboard.user.role] || Dashboard.user.role;

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await API.post('/api/auth/logout', {});
      window.location.href = '/';
    });
  },

  // ─── Navigation ──────────────────────────────────────────────────────────

  async navigateTo(section) {
    Dashboard.currentSection = section;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });

    const content = document.getElementById('pageContent');
    content.innerHTML = `
      <div class="empty-state" style="padding: var(--space-8);">
        <div class="spinner" style="border-color: var(--color-gray-300); border-top-color: var(--color-primary); width:32px; height:32px; margin: 0 auto var(--space-4);"></div>
        <div class="empty-state-text" style="font-size: var(--font-size-sm);">Loading...</div>
      </div>
    `;

    try {
      await Dashboard.renderSection(section, content);
    } catch (err) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-text">Error loading content</div>
          <div class="empty-state-hint">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  },

  async renderSection(section, container) {
    const role = Dashboard.user.role;

    switch (section) {
      case 'overview':
        await Dashboard.renderOverview(container);
        break;
      case 'upload':
        Dashboard.renderUpload(container);
        break;
      case 'bills':
        await Dashboard.renderBills(container);
        break;
      case 'allbills':
        await Dashboard.renderAllBills(container);
        break;
      case 'laborers':
        await Dashboard.renderLaborers(container);
        break;
      case 'contractors':
        await Dashboard.renderContractors(container);
        break;
      case 'transactions':
        await Dashboard.renderTransactions(container);
        break;
    }
  },

  refreshCurrentSection() {
    Dashboard.navigateTo(Dashboard.currentSection);
  },

  // ─── Overview / Dashboard ────────────────────────────────────────────────

  async renderOverview(container) {
    const stats = await API.get('/api/bills/stats/summary');
    const role = Dashboard.user.role;

    let header = '';
    let statsHtml = '';

    if (role === 'laborer') {
      header = `
        <div class="page-header">
          <h1 class="page-title">Welcome, ${escapeHtml(Dashboard.user.full_name.split(' ')[0])}</h1>
          <p class="page-subtitle">Assigned to: ${escapeHtml(Dashboard.user.contractor_name || 'N/A')}</p>
        </div>
      `;
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Current Balance</span>
              <div class="stat-card-icon green">💰</div>
            </div>
            <div class="stat-card-value currency">${Number(stats.balance || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Pending Bills</span>
              <div class="stat-card-icon orange">⏳</div>
            </div>
            <div class="stat-card-value">${stats.pending_bills || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Approved Bills</span>
              <div class="stat-card-icon green">✓</div>
            </div>
            <div class="stat-card-value">${stats.approved_bills || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Total Bills</span>
              <div class="stat-card-icon blue">📋</div>
            </div>
            <div class="stat-card-value">${stats.total_bills || 0}</div>
          </div>
        </div>
      `;
    } else if (role === 'contractor') {
      header = `
        <div class="page-header">
          <h1 class="page-title">Contractor Dashboard</h1>
          <p class="page-subtitle">${escapeHtml(Dashboard.user.company_name || Dashboard.user.full_name)} · ${escapeHtml(Dashboard.user.user_id)}</p>
        </div>
      `;
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Pending Reviews</span>
              <div class="stat-card-icon orange">📋</div>
            </div>
            <div class="stat-card-value">${stats.pending_reviews || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Approved Today</span>
              <div class="stat-card-icon green">✓</div>
            </div>
            <div class="stat-card-value">${stats.approved_today || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Rejected Bills</span>
              <div class="stat-card-icon red">✕</div>
            </div>
            <div class="stat-card-value">${stats.rejected_bills || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Active Laborers</span>
              <div class="stat-card-icon blue">👷</div>
            </div>
            <div class="stat-card-value">${stats.active_laborers || 0}</div>
          </div>
        </div>
      `;
    } else if (role === 'admin') {
      header = `
        <div class="page-header">
          <h1 class="page-title">Admin Dashboard</h1>
          <p class="page-subtitle">Company-wide cash flow overview</p>
        </div>
      `;
      statsHtml = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Pending Approvals</span>
              <div class="stat-card-icon orange">📋</div>
            </div>
            <div class="stat-card-value">${stats.pending_approvals || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Today's Expenses</span>
              <div class="stat-card-icon green">💰</div>
            </div>
            <div class="stat-card-value currency">${Number(stats.today_expenses || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Monthly Expenses</span>
              <div class="stat-card-icon blue">📈</div>
            </div>
            <div class="stat-card-value currency">${Number(stats.month_expenses || 0).toLocaleString('en-IN')}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Contractors</span>
              <div class="stat-card-icon blue">🏗</div>
            </div>
            <div class="stat-card-value">${stats.active_contractors || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card-header">
              <span class="stat-card-label">Laborers</span>
              <div class="stat-card-icon orange">👷</div>
            </div>
            <div class="stat-card-value">${stats.active_laborers || 0}</div>
          </div>
        </div>
      `;
    }

    // Get recent bills for overview
    const billsData = await API.get('/api/bills');
    const recentBills = (billsData.bills || []).slice(0, 5);

    container.innerHTML = header + statsHtml;

    if (recentBills.length > 0) {
      container.innerHTML += `
        <div style="margin-top: var(--space-4);">
          ${Bills.renderBillsList(recentBills, role)}
        </div>
      `;
    }
  },

  // ─── Upload Section (Laborer) ────────────────────────────────────────────

  renderUpload(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Upload Bill</h1>
        <p class="page-subtitle">Take a photo or upload an image of your bill</p>
      </div>
      ${Bills.renderUploadForm()}
    `;
    Bills.initUploadForm();
  },

  // ─── Bills Section ──────────────────────────────────────────────────────

  async renderBills(container) {
    const role = Dashboard.user.role;
    let statusFilter = '';
    let title = 'Bills';
    let subtitle = '';

    if (role === 'laborer') {
      title = 'My Bills';
      subtitle = 'All bills you have submitted';
    } else if (role === 'contractor') {
      statusFilter = '?status=pending_contractor';
      title = 'Pending Reviews';
      subtitle = 'Bills awaiting your review';
    } else if (role === 'admin') {
      statusFilter = '?status=pending_admin';
      title = 'Pending Approvals';
      subtitle = 'Contractor-approved bills awaiting your final approval';
    }

    const data = await API.get(`/api/bills${statusFilter}`);

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">${title}</h1>
        <p class="page-subtitle">${subtitle}</p>
      </div>
      ${Bills.renderBillsList(data.bills || [], role)}
    `;
  },

  // ─── All Bills (Admin) ──────────────────────────────────────────────────

  async renderAllBills(container) {
    const data = await API.get('/api/bills');

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">All Bills</h1>
        <p class="page-subtitle">Complete bill history across all contractors</p>
      </div>
      ${Bills.renderBillsList(data.bills || [], 'admin')}
    `;
  },

  // ─── Laborers List ──────────────────────────────────────────────────────

  async renderLaborers(container) {
    const data = await API.get('/api/users/laborers');
    const laborers = data.laborers || [];

    let rows = '';
    if (laborers.length === 0) {
      rows = `
        <div class="empty-state">
          <div class="empty-state-icon">👷</div>
          <div class="empty-state-text">No laborers found</div>
        </div>
      `;
    } else {
      const showContractor = Dashboard.user.role === 'admin';
      rows = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Laborers (${laborers.length})</h3>
          </div>
          <div class="card-body-flush" style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Username</th>
                  ${showContractor ? '<th>Contractor</th>' : ''}
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                ${laborers.map(l => `
                  <tr>
                    <td><strong>${escapeHtml(l.user_id)}</strong></td>
                    <td>${escapeHtml(l.full_name)}</td>
                    <td>${escapeHtml(l.username)}</td>
                    ${showContractor ? `<td>${escapeHtml(l.contractor_name || '—')}</td>` : ''}
                    <td><strong>${formatCurrency(l.current_balance || 0)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">${Dashboard.user.role === 'admin' ? 'All Laborers' : 'My Laborers'}</h1>
        <p class="page-subtitle">${Dashboard.user.role === 'admin' ? 'All registered laborers' : 'Laborers assigned to you'}</p>
      </div>
      ${rows}
    `;
  },

  // ─── Contractors List (Admin) ────────────────────────────────────────────

  async renderContractors(container) {
    const data = await API.get('/api/users/contractors');
    const contractors = data.contractors || [];

    let rows = '';
    if (contractors.length === 0) {
      rows = `
        <div class="empty-state">
          <div class="empty-state-icon">🏗</div>
          <div class="empty-state-text">No contractors found</div>
        </div>
      `;
    } else {
      rows = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Contractors (${contractors.length})</h3>
          </div>
          <div class="card-body-flush" style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Laborers</th>
                </tr>
              </thead>
              <tbody>
                ${contractors.map(c => `
                  <tr>
                    <td><strong>${escapeHtml(c.user_id)}</strong></td>
                    <td>${escapeHtml(c.full_name)}</td>
                    <td>${escapeHtml(c.company_name || '—')}</td>
                    <td>${c.laborer_count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Contractors</h1>
        <p class="page-subtitle">All registered contractors and their teams</p>
      </div>
      ${rows}
    `;
  },

  // ─── Transactions ────────────────────────────────────────────────────────

  async renderTransactions(container) {
    const data = await API.get('/api/users/transactions');
    const transactions = data.transactions || [];

    let rows = '';
    if (transactions.length === 0) {
      rows = `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <div class="empty-state-text">No transactions yet</div>
          <div class="empty-state-hint">Transactions appear when bills are approved</div>
        </div>
      `;
    } else {
      rows = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Transaction History</h3>
          </div>
          <div class="card-body-flush" style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill #</th>
                  ${Dashboard.user.role !== 'laborer' ? '<th>User</th>' : ''}
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.map(t => `
                  <tr>
                    <td>${formatDateTime(t.created_at)}</td>
                    <td><strong>${escapeHtml(t.bill_number || '—')}</strong></td>
                    ${Dashboard.user.role !== 'laborer' ? `<td>${escapeHtml(t.laborer_name || t.user_name || '—')}</td>` : ''}
                    <td><strong>${formatCurrency(t.amount)}</strong></td>
                    <td><span class="status-badge ${t.type === 'credit' ? 'status-approved' : 'status-pending_admin'}">${t.type}</span></td>
                    <td>${escapeHtml(t.description || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Transactions</h1>
        <p class="page-subtitle">Payment and credit history</p>
      </div>
      ${rows}
    `;
  },

  // ─── Mobile Menu ─────────────────────────────────────────────────────────

  initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
      });
    }
  },
};

// ─── Boot ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  Dashboard.init();
});
