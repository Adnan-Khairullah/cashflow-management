/**
 * Bills module — Upload, list, approve/reject
 */

const Bills = {
  // ─── Upload Bill Form (Laborer) ──────────────────────────────────────────

  renderUploadForm() {
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Upload New Bill</h3>
        </div>
        <div class="card-body">
          <form id="uploadBillForm">
            <div class="upload-zone" id="uploadZone">
              <div class="upload-zone-icon">📷</div>
              <div class="upload-zone-text">Click or drag to upload bill photo</div>
              <div class="upload-zone-hint">JPG, PNG, WEBP — Max 10MB</div>
              <input type="file" id="billPhotoInput" accept="image/*" capture="environment" hidden>
            </div>
            <div id="uploadPreviewContainer" style="display:none; text-align:center; margin-top: var(--space-4);">
              <div class="upload-preview">
                <img id="uploadPreviewImg" src="" alt="Preview">
                <button type="button" class="upload-preview-remove" id="removePhotoBtn">✕</button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-5);">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="billAmount">Amount (₹) *</label>
                <input type="number" class="form-input" id="billAmount" placeholder="e.g. 1500" step="0.01" min="1" required>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="billNote">Note (Optional)</label>
                <input type="text" class="form-input" id="billNote" placeholder="e.g. Cement purchase">
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block" id="submitBillBtn" style="margin-top: var(--space-5);">
              Submit Bill
            </button>
          </form>
        </div>
      </div>
    `;
  },

  initUploadForm() {
    const zone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('billPhotoInput');
    const previewContainer = document.getElementById('uploadPreviewContainer');
    const previewImg = document.getElementById('uploadPreviewImg');
    const removeBtn = document.getElementById('removePhotoBtn');
    const form = document.getElementById('uploadBillForm');
    const submitBtn = document.getElementById('submitBillBtn');

    if (!zone) return;

    let selectedFile = null;

    zone.addEventListener('click', () => fileInput.click());

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
      }
    });

    removeBtn.addEventListener('click', () => {
      selectedFile = null;
      fileInput.value = '';
      previewContainer.style.display = 'none';
      zone.style.display = '';
    });

    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewContainer.style.display = 'block';
        zone.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('billAmount').value;
      const note = document.getElementById('billNote').value;

      if (!selectedFile) {
        showToast('Please upload a bill photo', 'error');
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Submitting...';

      try {
        const formData = new FormData();
        formData.append('photo', selectedFile);
        formData.append('amount', amount);
        formData.append('note', note);

        const data = await API.post('/api/bills', formData);
        if (data && data.success) {
          showToast(`Bill ${data.bill.bill_number} submitted successfully!`, 'success');
          // Reset form
          selectedFile = null;
          fileInput.value = '';
          previewContainer.style.display = 'none';
          zone.style.display = '';
          form.reset();
          // Refresh bills list
          if (typeof Dashboard !== 'undefined') {
            Dashboard.navigateTo('bills');
          }
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Bill';
      }
    });
  },

  // ─── Bills List ──────────────────────────────────────────────────────────

  renderBillsList(bills, role) {
    if (!bills || bills.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">No bills found</div>
          <div class="empty-state-hint">${role === 'laborer' ? 'Upload your first bill to get started' : 'No bills to review at this time'}</div>
        </div>
      `;
    }

    const showActions = (role === 'contractor' || role === 'admin');
    const showContractor = (role === 'admin');

    let rows = bills.map(bill => {
      const actions = [];

      if (role === 'contractor' && bill.status === 'pending_contractor') {
        actions.push(`<button class="btn btn-success btn-sm" onclick="Bills.approveBill(${bill.id})">✓ Approve</button>`);
        actions.push(`<button class="btn btn-danger btn-sm" onclick="Bills.openRejectModal(${bill.id})">✕ Reject</button>`);
      }

      if (role === 'admin' && bill.status === 'pending_admin') {
        actions.push(`<button class="btn btn-success btn-sm" onclick="Bills.approveBill(${bill.id})">✓ Approve</button>`);
        actions.push(`<button class="btn btn-danger btn-sm" onclick="Bills.openRejectModal(${bill.id})">✕ Reject</button>`);
      }

      return `
        <tr>
          <td><strong>${escapeHtml(bill.bill_number)}</strong></td>
          ${bill.image_url ? `<td><img class="bill-photo-thumb" src="${bill.image_url}" alt="Bill" onclick="Bills.openLightbox('${bill.image_url}')"></td>` : '<td>—</td>'}
          <td>${escapeHtml(bill.laborer_name || '—')}</td>
          ${showContractor ? `<td>${escapeHtml(bill.contractor_name || '—')}</td>` : ''}
          <td><strong>${formatCurrency(bill.amount)}</strong></td>
          <td><span class="status-badge status-${bill.status}">${getStatusLabel(bill.status)}</span></td>
          <td>${formatDateTime(bill.upload_timestamp)}</td>
          ${showActions ? `<td><div class="action-row">${actions.join('')}</div></td>` : ''}
        </tr>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Bills</h3>
        </div>
        <div class="card-body-flush" style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Photo</th>
                <th>Laborer</th>
                ${showContractor ? '<th>Contractor</th>' : ''}
                <th>Amount</th>
                <th>Status</th>
                <th>Uploaded</th>
                ${showActions ? '<th>Actions</th>' : ''}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ─── Approve Bill ────────────────────────────────────────────────────────

  async approveBill(billId) {
    try {
      const data = await API.patch(`/api/bills/${billId}/approve`, {});
      if (data && data.success) {
        showToast('Bill approved successfully', 'success');
        if (typeof Dashboard !== 'undefined') {
          Dashboard.refreshCurrentSection();
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ─── Reject Bill Modal ──────────────────────────────────────────────────

  _rejectBillId: null,

  openRejectModal(billId) {
    Bills._rejectBillId = billId;
    document.getElementById('rejectModal').classList.add('visible');
    // Clear previous selection
    document.querySelectorAll('input[name="rejectReason"]').forEach(r => r.checked = false);
    document.querySelectorAll('.rejection-reason-option').forEach(o => o.classList.remove('selected'));
  },

  closeRejectModal() {
    Bills._rejectBillId = null;
    document.getElementById('rejectModal').classList.remove('visible');
  },

  async confirmReject() {
    const selected = document.querySelector('input[name="rejectReason"]:checked');
    if (!selected) {
      showToast('Please select a rejection reason', 'error');
      return;
    }

    try {
      const data = await API.patch(`/api/bills/${Bills._rejectBillId}/reject`, {
        reason: selected.value,
      });
      if (data && data.success) {
        showToast('Bill rejected', 'info');
        Bills.closeRejectModal();
        if (typeof Dashboard !== 'undefined') {
          Dashboard.refreshCurrentSection();
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  // ─── Lightbox ────────────────────────────────────────────────────────────

  openLightbox(src) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightboxImage').src = src;
    lb.classList.add('visible');
  },

  closeLightbox() {
    document.getElementById('lightbox').classList.remove('visible');
  },

  // ─── Init event handlers ────────────────────────────────────────────────

  init() {
    // Reject modal
    const rejectClose = document.getElementById('rejectModalClose');
    const rejectCancel = document.getElementById('rejectCancelBtn');
    const rejectConfirm = document.getElementById('rejectConfirmBtn');
    const lightbox = document.getElementById('lightbox');

    if (rejectClose) rejectClose.addEventListener('click', Bills.closeRejectModal);
    if (rejectCancel) rejectCancel.addEventListener('click', Bills.closeRejectModal);
    if (rejectConfirm) rejectConfirm.addEventListener('click', Bills.confirmReject);
    if (lightbox) lightbox.addEventListener('click', Bills.closeLightbox);

    // Rejection reason visual selection
    document.querySelectorAll('.rejection-reason-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.rejection-reason-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
      });
    });
  },
};
