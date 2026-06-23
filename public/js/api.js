/**
 * API client helper — wraps fetch with auth handling
 */

const API = {
  async request(url, options = {}) {
    const config = {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
    };

    // Don't set Content-Type for FormData (multer needs multipart boundary)
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Not authenticated — redirect to login (unless already on login page or checking auth)
        const isAuthCheck = url.includes('/api/auth/me');
        const isLoginPage = window.location.pathname === '/' || window.location.pathname === '/index.html';
        if (!isAuthCheck && !isLoginPage) {
          window.location.href = '/';
        }
        return null;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error('Cannot connect to server');
      }
      throw err;
    }
  },

  get(url) {
    return this.request(url, { method: 'GET' });
  },

  post(url, body) {
    const options = { method: 'POST' };
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
    return this.request(url, options);
  },

  patch(url, body) {
    return this.request(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};

// ─── Toast Notifications ─────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', info: 'ℹ' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${escapeHtml(message)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ─── Status label mapping ────────────────────────────────────────────────────

function getStatusLabel(status) {
  const map = {
    draft: 'Draft',
    pending_contractor: 'Pending Contractor',
    pending_admin: 'Pending Admin',
    approved: 'Approved',
    rejected_contractor: 'Rejected (Contractor)',
    rejected_admin: 'Rejected (Admin)',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
