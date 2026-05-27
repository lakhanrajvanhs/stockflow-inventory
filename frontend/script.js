const API_BASE = '/api';

// ─── Token / Session Helpers ───────────────────────────────────────────────────
function getToken()       { return localStorage.getItem('sf_token'); }
function saveToken(t)     { localStorage.setItem('sf_token', t); }
function clearSession()   { localStorage.removeItem('sf_token'); localStorage.removeItem('sf_user'); }
function saveUser(u)      { localStorage.setItem('sf_user', JSON.stringify(u)); }
function getSavedUser()   { try { return JSON.parse(localStorage.getItem('sf_user')); } catch { return null; } }

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

// Also expose globally so index.html inline script can use it
window.authHeaders = authHeaders;

// ─── Theme ────────────────────────────────────────────────────────────────────
const root   = document.documentElement;
const toggle = document.querySelector('[data-theme-toggle]');

let theme = localStorage.getItem('sf_theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
root.setAttribute('data-theme', theme);

if (toggle) {
  toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    localStorage.setItem('sf_theme', theme);
  });
}

// ─── Mobile Sidebar ────────────────────────────────────────────────────────────
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

if (menuBtn && sidebar && overlay) {
  menuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('sf-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'sf-toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── App State ─────────────────────────────────────────────────────────────────
let allProducts     = [];
let allSuppliers    = [];
let allTransactions = [];
let currentUser     = null;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function isAdmin() { return currentUser?.role === 'Admin'; }

function getStatus(quantity, reorderLevel) {
  if (quantity === 0)             return { text: 'Out',     className: 'out'  };
  if (quantity <= reorderLevel)   return { text: 'Low',     className: 'low'  };
  return                                 { text: 'Healthy', className: 'good' };
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })}`;
}

// Nicely formatted date: "27 May 2026, 3:22 PM"
function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// ─── Handle 401 / session expiry ──────────────────────────────────────────────
function handleUnauthorized() {
  clearSession();
  currentUser = null;
  updateActiveUserUI(null);
  // Show login screen again
  const loginScreen = document.getElementById('loginScreen');
  const appDashboard = document.getElementById('appDashboard');
  if (loginScreen)   loginScreen.style.display  = 'flex';
  if (appDashboard)  appDashboard.style.display = 'none';
  showToast('Session expired. Please log in again.', 'error');
}

// ─── Role-based UI ─────────────────────────────────────────────────────────────
function updateActiveUserUI(user) {
  const userInitials   = document.getElementById('userInitials');
  const activeUserLabel = document.getElementById('activeUserLabel');

  if (userInitials) {
    userInitials.textContent = user?.name
      ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : '?';
  }
  if (activeUserLabel) {
    activeUserLabel.textContent = user ? `${user.name} (${user.role})` : 'Guest';
  }

  // Show/hide admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = (user?.role === 'Admin') ? '' : 'none';
  });
}

// ─── Supplier Dropdown Population ─────────────────────────────────────────────
function populateSupplierDropdown(suppliers) {
  // In Add Product form
  const sel = document.getElementById('supplier_id');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select Supplier --</option>';
  suppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value       = s.supplier_id;
    opt.textContent = `${s.supplier_name} (ID: ${s.supplier_id})`;
    if (String(s.supplier_id) === String(current)) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ─── Product Dropdown Population (for Transactions) ───────────────────────────
function populateProductDropdown(products) {
  const sel = document.getElementById('transactionProductId');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select Product --</option>';
  products.forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.product_id;
    opt.textContent = `${p.product_name} (ID: ${p.product_id})`;
    if (String(p.product_id) === String(current)) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ─── Delete Confirmation ───────────────────────────────────────────────────────
function showDeleteConfirm(title, message, onConfirm) {
  const modal      = document.getElementById('deleteModal');
  const titleEl    = document.getElementById('deleteModalTitle');
  const msgEl      = document.getElementById('deleteModalMsg');
  const confirmBtn = document.getElementById('deleteConfirmBtn');
  const cancelBtn  = document.getElementById('deleteCancelBtn');

  if (!modal) { if (confirm(`${title}\n${message}`)) onConfirm(); return; }

  titleEl.textContent = title;
  msgEl.textContent   = message;
  modal.style.display = 'flex';

  confirmBtn.onclick = () => { modal.style.display = 'none'; onConfirm(); };
  cancelBtn.onclick  = () => { modal.style.display = 'none'; };
}
window.showDeleteConfirm = showDeleteConfirm;

// ─── Products ──────────────────────────────────────────────────────────────────
function renderProducts(products) {
  const productBody = document.getElementById('productTableBody');
  if (!productBody) return;

  if (!products.length) {
    productBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No products found.</td></tr>`;
    return;
  }

  productBody.innerHTML = products.map(p => {
    const qty     = Number(p.quantity);
    const reorder = Number(p.reorder_level);
    const status  = getStatus(qty, reorder);

    const actions = isAdmin()
      ? `<button class="btn btn-icon" title="Edit"   onclick="openEditProduct(${p.product_id})">✏️</button>
         <button class="btn btn-icon btn-danger" title="Delete" onclick="deleteProduct(${p.product_id}, '${p.product_name}')">🗑️</button>`
      : `<span class="muted tiny">View only</span>`;

    return `
      <tr>
        <td>${p.product_id}</td>
        <td>${p.product_name}</td>
        <td>${p.category || '-'}</td>
        <td>${qty}</td>
        <td>${formatCurrency(p.price)}</td>
        <td><span class="status ${status.className}">${status.text}</span></td>
        <td>${actions}</td>
      </tr>`;
  }).join('');
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { handleUnauthorized(); return []; }
    const data = await res.json();
    allProducts = Array.isArray(data) ? data : [];
    renderProducts(allProducts);
    populateSupplierDropdown(allSuppliers);
    populateProductDropdown(allProducts);
    return allProducts;
  } catch (err) {
    console.error('Error loading products:', err);
    return [];
  }
}

// ─── Suppliers ─────────────────────────────────────────────────────────────────
function renderSuppliers(suppliers) {
  const supplierList = document.getElementById('supplierList');
  if (!supplierList) return;

  if (!suppliers.length) {
    supplierList.innerHTML = `<div class="empty-cell">No suppliers found.</div>`;
    return;
  }

  supplierList.innerHTML = suppliers.map(s => {
    const actions = isAdmin()
      ? `<div style="display:flex;gap:.5rem;margin-top:.4rem;">
           <button class="btn btn-icon" onclick="openEditSupplier(${s.supplier_id})">✏️</button>
           <button class="btn btn-icon btn-danger" onclick="deleteSupplier(${s.supplier_id}, '${s.supplier_name}')">🗑️</button>
         </div>`
      : '';
    return `
      <div class="list-item">
        <strong>${s.supplier_name}</strong>
        <div class="tiny">ID: ${s.supplier_id}</div>
        <div class="tiny">📞 ${s.phone    || 'N/A'}</div>
        <div class="tiny">📍 ${s.address  || 'N/A'}</div>
        ${actions}
      </div>`;
  }).join('');
}

async function loadSuppliers() {
  try {
    const res = await fetch(`${API_BASE}/suppliers`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { handleUnauthorized(); return []; }
    const data = await res.json();
    allSuppliers = Array.isArray(data) ? data : [];
    renderSuppliers(allSuppliers);
    populateSupplierDropdown(allSuppliers);
    return allSuppliers;
  } catch (err) {
    console.error('Error loading suppliers:', err);
    return [];
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function updateStats(products, suppliers) {
  const totalValue = products.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.price), 0
  );
  const lowStock = products.filter(
    item => Number(item.quantity) <= Number(item.reorder_level)
  ).length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('inventoryValue', formatCurrency(totalValue));
  set('productCount',   products.length);
  set('lowStockCount',  lowStock);
  set('supplierCount',  suppliers.length);
}

async function loadDashboard() {
  try {
    const [products, suppliers] = await Promise.all([loadProducts(), loadSuppliers()]);
    updateStats(products, suppliers);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

// ─── Transactions ──────────────────────────────────────────────────────────────
function renderTransactions(transactions) {
  const transactionBody = document.getElementById('transactionTableBody');
  if (!transactionBody) return;

  if (!transactions.length) {
    transactionBody.innerHTML = `<tr><td colspan="6" class="empty-cell">No transactions found.</td></tr>`;
    return;
  }

  transactionBody.innerHTML = transactions.map(t => {
    const typeClass = t.transaction_type === 'IN'     ? 'good'
                    : t.transaction_type === 'OUT'    ? 'low' : 'out';
    return `
      <tr>
        <td>${t.transaction_id}</td>
        <td>${t.product_name  || t.product_id}</td>
        <td>${t.user_name     || t.user_id}</td>
        <td><span class="status ${typeClass}">${t.transaction_type}</span></td>
        <td>${t.quantity}</td>
        <td>${formatDateTime(t.transaction_date)}</td>
      </tr>`;
  }).join('');
}

async function loadTransactions() {
  try {
    const res = await fetch(`${API_BASE}/transactions`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { handleUnauthorized(); return []; }
    const data = await res.json();
    allTransactions = Array.isArray(data) ? data : [];
    renderTransactions(allTransactions);
    populateProductDropdown(allProducts);
    return allTransactions;
  } catch (err) {
    console.error('Error loading transactions:', err);
    return [];
  }
}

// ─── Reports ───────────────────────────────────────────────────────────────────
async function loadReports() {
  const reportTotalProds = document.getElementById('reportTotalProducts');
  if (!reportTotalProds) return;

  try {
    const res = await fetch(`${API_BASE}/reports/summary`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { handleUnauthorized(); return; }
    const data = await res.json();

    const s = data.summary || {};
    document.getElementById('reportTotalProducts').textContent    = s.total_products     ?? 0;
    document.getElementById('reportTotalSuppliers').textContent   = s.total_suppliers    ?? 0;
    document.getElementById('reportTotalTransactions').textContent = s.total_transactions ?? 0;
    document.getElementById('reportInventoryValue').textContent   = formatCurrency(s.inventory_value ?? 0);

    const lowStock    = data.lowStock || [];
    const reportLowBody = document.getElementById('reportLowStockBody');
    if (!reportLowBody) return;

    reportLowBody.innerHTML = !lowStock.length
      ? `<tr><td colspan="5" class="empty-cell">No low stock items.</td></tr>`
      : lowStock.map(item => `
          <tr>
            <td>${item.product_id}</td>
            <td>${item.product_name}</td>
            <td>${item.category || '-'}</td>
            <td>${item.quantity}</td>
            <td>${item.reorder_level}</td>
          </tr>`).join('');
  } catch (err) {
    console.error('Reports error:', err);
  }
}

// ─── Product Form (Add) ────────────────────────────────────────────────────────
const productForm = document.getElementById('productForm');
if (productForm) {
  productForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      product_name:  document.getElementById('product_name')?.value?.trim(),
      category:      document.getElementById('category')?.value?.trim(),
      quantity:      Number(document.getElementById('quantity')?.value),
      price:         Number(document.getElementById('price')?.value),
      reorder_level: Number(document.getElementById('reorder_level')?.value),
      supplier_id:   Number(document.getElementById('supplier_id')?.value)
    };

    try {
      const res    = await fetch(`${API_BASE}/products`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save product');
      showToast(result.message || 'Product saved!');
      productForm.reset();
      await loadDashboard();
      await loadReports();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Supplier Form (Add) ───────────────────────────────────────────────────────
const supplierForm = document.getElementById('supplierForm');
if (supplierForm) {
  supplierForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      supplier_name: document.getElementById('supplier_name')?.value?.trim(),
      phone:         document.getElementById('supplier_phone')?.value?.trim(),
      address:       document.getElementById('supplier_address')?.value?.trim()
    };

    try {
      const res    = await fetch(`${API_BASE}/suppliers`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save supplier');
      showToast(result.message || 'Supplier added!');
      supplierForm.reset();
      await loadSuppliers();
      await loadReports();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Transaction Form ──────────────────────────────────────────────────────────
const transactionForm = document.getElementById('transactionForm');
if (transactionForm) {
  transactionForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      product_id:       Number(document.getElementById('transactionProductId')?.value),
      user_id:          currentUser?.id,
      transaction_type: document.getElementById('transactionType')?.value,
      quantity:         Number(document.getElementById('transactionQuantity')?.value)
    };

    if (!payload.product_id) return showToast('Please select a product', 'error');
    if (!payload.user_id)    return showToast('User not found, please log in again', 'error');

    try {
      const res    = await fetch(`${API_BASE}/transactions`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save transaction');
      showToast(result.message || 'Transaction saved!');
      transactionForm.reset();
      await loadTransactions();
      await loadDashboard();
      await loadReports();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Delete Product (with confirmation modal) ──────────────────────────────────
async function deleteProduct(productId, productName) {
  showDeleteConfirm(
    'Delete Product',
    `Are you sure you want to delete "${productName}"? This cannot be undone.`,
    async () => {
      try {
        const res    = await fetch(`${API_BASE}/products/${productId}`, {
          method: 'DELETE', headers: authHeaders()
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to delete product');
        showToast(result.message || 'Product deleted');
        await loadDashboard();
        await loadReports();
      } catch (err) { showToast(err.message, 'error'); }
    }
  );
}

// ─── Delete Supplier (with confirmation modal) ─────────────────────────────────
async function deleteSupplier(supplierId, supplierName) {
  showDeleteConfirm(
    'Delete Supplier',
    `Are you sure you want to delete "${supplierName}"? This cannot be undone.`,
    async () => {
      try {
        const res    = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
          method: 'DELETE', headers: authHeaders()
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to delete supplier');
        showToast(result.message || 'Supplier deleted');
        await loadSuppliers();
        await loadReports();
      } catch (err) { showToast(err.message, 'error'); }
    }
  );
}

// ─── Edit Product Modal ────────────────────────────────────────────────────────
function openEditProduct(productId) {
  const product = allProducts.find(p => p.product_id === productId);
  if (!product) return;

  document.getElementById('editProductId').value      = product.product_id;
  document.getElementById('editProductName').value    = product.product_name;
  document.getElementById('editCategory').value       = product.category;
  document.getElementById('editQuantity').value       = product.quantity;
  document.getElementById('editPrice').value          = product.price;
  document.getElementById('editReorderLevel').value   = product.reorder_level;
  document.getElementById('editSupplierId').value     = product.supplier_id;
  document.getElementById('editProductModal').style.display = 'flex';
}

function closeEditProduct() {
  document.getElementById('editProductModal').style.display = 'none';
}

const editProductForm = document.getElementById('editProductForm');
if (editProductForm) {
  editProductForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id      = document.getElementById('editProductId').value;
    const payload = {
      product_name:  document.getElementById('editProductName').value.trim(),
      category:      document.getElementById('editCategory').value.trim(),
      quantity:      Number(document.getElementById('editQuantity').value),
      price:         Number(document.getElementById('editPrice').value),
      reorder_level: Number(document.getElementById('editReorderLevel').value),
      supplier_id:   Number(document.getElementById('editSupplierId').value)
    };

    try {
      const res    = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update product');
      showToast(result.message || 'Product updated!');
      closeEditProduct();
      await loadDashboard();
      await loadReports();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Edit Supplier Modal ───────────────────────────────────────────────────────
function openEditSupplier(supplierId) {
  const supplier = allSuppliers.find(s => s.supplier_id === supplierId);
  if (!supplier) return;

  document.getElementById('editSuppId').value          = supplier.supplier_id;
  document.getElementById('editSupplierName').value    = supplier.supplier_name;
  document.getElementById('editSupplierPhone').value   = supplier.phone;
  document.getElementById('editSupplierAddress').value = supplier.address;
  document.getElementById('editSupplierModal').style.display = 'flex';
}

function closeEditSupplier() {
  document.getElementById('editSupplierModal').style.display = 'none';
}

const editSupplierForm = document.getElementById('editSupplierForm');
if (editSupplierForm) {
  editSupplierForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id      = document.getElementById('editSuppId').value;
    const payload = {
      supplier_name: document.getElementById('editSupplierName').value.trim(),
      phone:         document.getElementById('editSupplierPhone').value.trim(),
      address:       document.getElementById('editSupplierAddress').value.trim()
    };

    try {
      const res    = await fetch(`${API_BASE}/suppliers/${id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update supplier');
      showToast(result.message || 'Supplier updated!');
      closeEditSupplier();
      await loadSuppliers();
      await loadReports();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Search ────────────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', e => {
    const val = e.target.value.toLowerCase().trim();
    renderProducts(allProducts.filter(item =>
      (item.product_name || '').toLowerCase().includes(val) ||
      (item.category     || '').toLowerCase().includes(val)
    ));
  });
}

// ─── Navigation ────────────────────────────────────────────────────────────────
const navButtons = document.querySelectorAll('.nav-btn');
const views      = document.querySelectorAll('.view-section');

function showView(viewName) {
  navButtons.forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.view || btn.textContent.trim().toLowerCase()) === viewName);
  });
  views.forEach(v => { v.style.display = 'none'; });
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.style.display = 'block';

  if (sidebar && overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
}

navButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const viewName = btn.dataset.view || btn.textContent.trim().toLowerCase();
    showView(viewName);

    try {
      if      (viewName === 'dashboard')    await loadDashboard();
      else if (viewName === 'products')     { await loadSuppliers(); await loadProducts(); }
      else if (viewName === 'suppliers')    await loadSuppliers();
      else if (viewName === 'transactions') { await loadProducts(); await loadTransactions(); }
      else if (viewName === 'reports')      await loadReports();
    } catch (err) { console.error(`Error loading ${viewName}:`, err); }
  });
});

// ─── Auth: Login/Signup (driven from index.html inline script) ─────────────────
// The index.html inline <script> handles the auth form UI and submit.
// When login succeeds it calls window.onLoginSuccess(user) below.
window.onLoginSuccess = function(user) {
  currentUser = user;
  updateActiveUserUI(user);
  showView('dashboard');
  loadDashboard();
  loadReports();
};

// ─── Logout Button ─────────────────────────────────────────────────────────────
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    clearSession();
    currentUser = null;
    updateActiveUserUI(null);
    allProducts = []; allSuppliers = []; allTransactions = [];
    const loginScreen  = document.getElementById('loginScreen');
    const appDashboard = document.getElementById('appDashboard');
    if (loginScreen)   loginScreen.style.display  = 'flex';
    if (appDashboard)  appDashboard.style.display = 'none';
  });
}

// ─── Expose globals for inline onclick handlers ────────────────────────────────
window.deleteProduct     = deleteProduct;
window.deleteSupplier    = deleteSupplier;
window.openEditProduct   = openEditProduct;
window.closeEditProduct  = closeEditProduct;
window.openEditSupplier  = openEditSupplier;
window.closeEditSupplier = closeEditSupplier;

// ─── Auth Form Handler ─────────────────────────────────────────────────────────
const authForm       = document.getElementById('authForm');
const authTitle      = document.getElementById('authTitle');
const authEmail      = document.getElementById('authEmail');
const authPassword   = document.getElementById('authPassword');
const authName       = document.getElementById('authName');
const authRole       = document.getElementById('authRole');
const authMessage    = document.getElementById('authMessage');
const authSubmitBtn  = document.getElementById('authSubmitBtn');
const authSwitchBtn  = document.getElementById('authSwitchBtn');
const authSwitchText = document.getElementById('authSwitchText');
const signupNameField = document.getElementById('signupNameField');
const signupRoleField = document.getElementById('signupRoleField');
const loginScreen    = document.getElementById('loginScreen');
const appDashboard   = document.getElementById('appDashboard');

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  if (authMessage) { authMessage.style.display = 'none'; authMessage.textContent = ''; }
  if (mode === 'login') {
    if (authTitle)      authTitle.textContent      = 'Login to StockFlow';
    if (authSubmitBtn)  authSubmitBtn.textContent  = 'Login';
    if (authSwitchText) authSwitchText.textContent = "Don't have an account?";
    if (authSwitchBtn)  authSwitchBtn.textContent  = 'Sign up';
    if (signupNameField) signupNameField.style.display = 'none';
    if (signupRoleField) signupRoleField.style.display = 'none';
  } else {
    if (authTitle)      authTitle.textContent      = 'Create New Account';
    if (authSubmitBtn)  authSubmitBtn.textContent  = 'Sign Up';
    if (authSwitchText) authSwitchText.textContent = 'Already have an account?';
    if (authSwitchBtn)  authSwitchBtn.textContent  = 'Login';
    if (signupNameField) signupNameField.style.display = 'block';
    if (signupRoleField) signupRoleField.style.display = 'block';
  }
}

function showAppDashboard(user) {
  currentUser = user;
  saveUser(user);
  updateActiveUserUI(user);
  if (loginScreen)   loginScreen.style.display  = 'none';
  if (appDashboard)  appDashboard.style.display = '';
  showView('dashboard');
  loadDashboard();
  loadReports();
}

if (authSwitchBtn) {
  authSwitchBtn.addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  });
}

if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authMessage) authMessage.style.display = 'none';
    if (authSubmitBtn) { authSubmitBtn.disabled = true; authSubmitBtn.textContent = authMode === 'login' ? 'Logging in...' : 'Creating account...'; }

    try {
      if (authMode === 'login') {
        const res  = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:    authEmail.value.trim(),
            password: authPassword.value
          })
        });
        const data = await res.json();

        if (data.success) {
          saveToken(data.token);
          showAppDashboard(data.user);
        } else {
          if (authMessage) {
            authMessage.textContent   = data.message || 'Invalid credentials';
            authMessage.style.display = 'block';
            authMessage.style.color   = '#e53e3e';
          }
        }
      } else {
        const res  = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:     authName.value.trim(),
            email:    authEmail.value.trim(),
            password: authPassword.value,
            role:     authRole.value
          })
        });
        const data = await res.json();

        if (authMessage) {
          authMessage.textContent   = data.message || (data.success ? 'Account created!' : 'Signup failed');
          authMessage.style.display = 'block';
          authMessage.style.color   = data.success ? '#38a169' : '#e53e3e';
        }
        if (data.success) {
          setTimeout(() => {
            setAuthMode('login');
            if (authEmail) authEmail.value = authEmail.value;
          }, 1000);
        }
      }
    } catch (err) {
      if (authMessage) {
        authMessage.textContent   = 'Network error. Please try again.';
        authMessage.style.display = 'block';
        authMessage.style.color   = '#e53e3e';
      }
    } finally {
      if (authSubmitBtn) {
        authSubmitBtn.disabled    = false;
        authSubmitBtn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
      }
    }
  });
}

// ─── Init: Restore session ─────────────────────────────────────────────────────
const savedToken = getToken();
const savedUser  = getSavedUser();

if (savedToken && savedUser) {
  showAppDashboard(savedUser);
} else {
  if (loginScreen)  loginScreen.style.display  = 'flex';
  if (appDashboard) appDashboard.style.display = 'none';
}