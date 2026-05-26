
const API_BASE = '/api'; // Relative URL — works for any host

// ─── Token helpers ─────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('sf_token');
}

function saveToken(token) {
  localStorage.setItem('sf_token', token);
}

function clearToken() {
  localStorage.removeItem('sf_token');
  localStorage.removeItem('sf_user');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

function saveUser(user) {
  localStorage.setItem('sf_user', JSON.stringify(user));
}

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('sf_user'));
  } catch {
    return null;
  }
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const root = document.documentElement;
const toggle = document.querySelector('[data-theme-toggle]');

// Persist theme across sessions
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

// ─── Mobile sidebar ────────────────────────────────────────────────────────────
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

// ─── Toast notifications (replaces all alert() calls) ─────────────────────────
function showToast(message, type = 'success') {
  const existing = document.getElementById('sf-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'sf-toast';
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast-show'));

  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── DOM refs ──────────────────────────────────────────────────────────────────
const productBody       = document.getElementById('productTableBody');
const supplierList      = document.getElementById('supplierList');
const productForm       = document.getElementById('productForm');
const supplierForm      = document.getElementById('supplierForm');
const transactionForm   = document.getElementById('transactionForm');
const searchInput       = document.getElementById('searchInput');
const transactionBody   = document.getElementById('transactionTableBody');
const reportTotalProds  = document.getElementById('reportTotalProducts');
const reportTotalSupps  = document.getElementById('reportTotalSuppliers');
const reportTotalTrans  = document.getElementById('reportTotalTransactions');
const reportInvValue    = document.getElementById('reportInventoryValue');
const reportLowBody     = document.getElementById('reportLowStockBody');
const navButtons        = document.querySelectorAll('.nav-btn');
const views             = document.querySelectorAll('.view-section');

// ─── App state ─────────────────────────────────────────────────────────────────
let allProducts     = [];
let allSuppliers    = [];
let allTransactions = [];
let currentUser     = null;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getStatus(quantity, reorderLevel) {
  if (quantity === 0) return { text: 'Out', className: 'out' };
  if (quantity <= reorderLevel) return { text: 'Low', className: 'low' };
  return { text: 'Healthy', className: 'good' };
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN');
}

function isAdmin() {
  return currentUser?.role === 'Admin';
}

// ─── Supplier dropdown population ──────────────────────────────────────────────
function populateSupplierDropdown(suppliers) {
  const select = document.getElementById('supplier_id');
  if (!select) return;

  const current = select.value;
  select.innerHTML = '<option value="">-- Select supplier --</option>';
  suppliers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.supplier_id;
    opt.textContent = `${s.supplier_name} (ID: ${s.supplier_id})`;
    if (String(s.supplier_id) === String(current)) opt.selected = true;
    select.appendChild(opt);
  });
}

// ─── Products ──────────────────────────────────────────────────────────────────
function renderProducts(products) {
  if (!productBody) return;

  if (!products.length) {
    productBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No products found.</td></tr>`;
    return;
  }

  productBody.innerHTML = products.map(p => {
    const qty      = Number(p.quantity);
    const reorder  = Number(p.reorder_level);
    const status   = getStatus(qty, reorder);
    const actions  = isAdmin()
      ? `<button class="btn btn-icon" title="Edit" onclick="openEditProduct(${p.product_id})">✏️</button>
         <button class="btn btn-icon btn-danger" title="Remove" onclick="deleteProduct(${p.product_id})">🗑️</button>`
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
    const res  = await fetch(`${API_BASE}/products`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { handleUnauthorized(); return []; }
    const data = await res.json();
    allProducts = Array.isArray(data) ? data : [];
    renderProducts(allProducts);
    populateSupplierDropdown(allSuppliers); 
    return allProducts;
  } catch (err) {
    console.error('Error loading products:', err);
    return [];
  }
}

// ─── Suppliers ─────────────────────────────────────────────────────────────────
function renderSuppliers(suppliers) {
  if (!supplierList) return;

  if (!suppliers.length) {
    supplierList.innerHTML = `<div class="empty-cell">No suppliers found.</div>`;
    return;
  }

  supplierList.innerHTML = suppliers.map(s => {
    const actions = isAdmin()
      ? `<div style="display:flex;gap:.5rem;margin-top:.4rem;">
           <button class="btn btn-icon" onclick="openEditSupplier(${s.supplier_id})">✏️</button>
           <button class="btn btn-icon btn-danger" onclick="deleteSupplier(${s.supplier_id})">🗑️</button>
         </div>`
      : '';

    return `
      <div class="list-item">
        <strong>${s.supplier_name}</strong>
        <div class="tiny">ID: ${s.supplier_id}</div>
        <div class="tiny">📞 ${s.phone || 'N/A'}</div>
        <div class="tiny">📍 ${s.address || 'N/A'}</div>
        ${actions}
      </div>`;
  }).join('');
}

async function loadSuppliers() {
  try {
    const res  = await fetch(`${API_BASE}/suppliers`, { headers: authHeaders() });
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
  if (!transactionBody) return;

  if (!transactions.length) {
    transactionBody.innerHTML = `<tr><td colspan="6" class="empty-cell">No transactions found.</td></tr>`;
    return;
  }

  transactionBody.innerHTML = transactions.map(t => {
    const typeClass = t.transaction_type === 'IN' ? 'good'
                    : t.transaction_type === 'OUT' ? 'low' : 'out';
    return `
      <tr>
        <td>${t.transaction_id}</td>
        <td>${t.product_name || t.product_id}</td>
        <td>${t.user_name || t.user_id}</td>
        <td><span class="status ${typeClass}">${t.transaction_type}</span></td>
        <td>${t.quantity}</td>
        <td>${formatDateTime(t.transaction_date)}</td>
      </tr>`;
  }).join('');
}

async function loadTransactions() {
  try {
    const res  = await fetch(`${API_BASE}/transactions`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { handleUnauthorized(); return []; }
    const data = await res.json();
    allTransactions = Array.isArray(data) ? data : [];
    renderTransactions(allTransactions);
    return allTransactions;
  } catch (err) {
    console.error('Error loading transactions:', err);
    return [];
  }
}

// ─── Reports ───────────────────────────────────────────────────────────────────
async function loadReports() {
  if (!reportTotalProds) return;

  try {
    const res  = await fetch(`${API_BASE}/reports/summary`, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) { handleUnauthorized(); return; }
    const data = await res.json();

    const s = data.summary || {};
    reportTotalProds.textContent = s.total_products    ?? 0;
    reportTotalSupps.textContent = s.total_suppliers   ?? 0;
    reportTotalTrans.textContent = s.total_transactions ?? 0;
    reportInvValue.textContent   = formatCurrency(s.inventory_value ?? 0);

    const lowStock = data.lowStock || [];
    if (!lowStock.length) {
      reportLowBody.innerHTML = `<tr><td colspan="5" class="empty-cell">No low stock items.</td></tr>`;
      return;
    }

    reportLowBody.innerHTML = lowStock.map(item => `
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

// ─── Product Form ──────────────────────────────────────────────────────────────
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
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save product');

      showToast(result.message || 'Product saved successfully!');
      productForm.reset();
      await loadDashboard();
      await loadReports();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Supplier Form ─────────────────────────────────────────────────────────────
if (supplierForm) {
  supplierForm.addEventListener('submit', async e => {
    e.preventDefault();

    const payload = {
      supplier_name: document.getElementById('supplier_name')?.value?.trim(),
      phone:         document.getElementById('supplier_phone')?.value?.trim(),
      address:       document.getElementById('supplier_address')?.value?.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/suppliers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save supplier');

      showToast(result.message || 'Supplier added successfully!');
      supplierForm.reset();
      await loadSuppliers();
      await loadReports();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Transaction Form ──────────────────────────────────────────────────────────
if (transactionForm) {
  transactionForm.addEventListener('submit', async e => {
    e.preventDefault();

    const payload = {
      product_id:       Number(document.getElementById('transactionProductId')?.value),
      user_id:          currentUser?.id || 1,
      transaction_type: document.getElementById('transactionType')?.value,
      quantity:         Number(document.getElementById('transactionQuantity')?.value)
    };

    try {
      const res = await fetch(`${API_BASE}/transactions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save transaction');

      showToast(result.message || 'Transaction saved!');
      transactionForm.reset();
      await loadTransactions();
      await loadDashboard();
      await loadReports();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Search ────────────────────────────────────────────────────────────────────
if (searchInput) {
  searchInput.addEventListener('input', e => {
    const val = e.target.value.toLowerCase().trim();
    const filtered = allProducts.filter(item =>
      (item.product_name || '').toLowerCase().includes(val) ||
      (item.category     || '').toLowerCase().includes(val)
    );
    renderProducts(filtered);
  });
}

// ─── Delete Product ────────────────────────────────────────────────────────────
async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to remove this product?')) return;

  try {
    const res    = await fetch(`${API_BASE}/products/${productId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete product');

    showToast(result.message || 'Product deleted');
    await loadDashboard();
    await loadReports();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Delete Supplier ───────────────────────────────────────────────────────────
async function deleteSupplier(supplierId) {
  if (!confirm('Are you sure you want to remove this supplier?')) return;

  try {
    const res    = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete supplier');

    showToast(result.message || 'Supplier deleted');
    await loadSuppliers();
    await loadReports();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Edit Product Modal ────────────────────────────────────────────────────────
function openEditProduct(productId) {
  const product = allProducts.find(p => p.product_id === productId);
  if (!product) return;

  document.getElementById('editProductId').value        = product.product_id;
  document.getElementById('editProductName').value      = product.product_name;
  document.getElementById('editCategory').value         = product.category;
  document.getElementById('editQuantity').value         = product.quantity;
  document.getElementById('editPrice').value            = product.price;
  document.getElementById('editReorderLevel').value     = product.reorder_level;
  document.getElementById('editSupplierId').value       = product.supplier_id;
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
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update product');

      showToast(result.message || 'Product updated!');
      closeEditProduct();
      await loadDashboard();
      await loadReports();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Edit Supplier Modal ───────────────────────────────────────────────────────
function openEditSupplier(supplierId) {
  const supplier = allSuppliers.find(s => s.supplier_id === supplierId);
  if (!supplier) return;

  document.getElementById('editSuppId').value      = supplier.supplier_id;
  document.getElementById('editSupplierName').value = supplier.supplier_name;
  document.getElementById('editSupplierPhone').value = supplier.phone;
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
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update supplier');

      showToast(result.message || 'Supplier updated!');
      closeEditSupplier();
      await loadSuppliers();
      await loadReports();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Navigation ────────────────────────────────────────────────────────────────
function showView(viewName) {
  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === viewName);
  });

  views.forEach(view => { view.style.display = 'none'; });

  const target = document.getElementById(`view-${viewName}`);
  if (target) target.style.display = 'block';

  if (sidebar && overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
}

navButtons.forEach(btn => {
  btn.addEventListener('click', async e => {
    const viewName = e.currentTarget.textContent.trim().toLowerCase();
    showView(viewName);

    try {
      if      (viewName === 'dashboard')    await loadDashboard();
      else if (viewName === 'products')     await loadProducts();
      else if (viewName === 'suppliers')    await loadSuppliers();
      else if (viewName === 'transactions') await loadTransactions();
      else if (viewName === 'reports')      await loadReports();
    } catch (err) {
      console.error(`Error loading ${viewName}:`, err);
    }
  });
});

// ─── Auth ──────────────────────────────────────────────────────────────────────
const authForm         = document.getElementById('authForm');
const authTitle        = document.getElementById('authTitle');
const authName         = document.getElementById('authName');
const authEmail        = document.getElementById('authEmail');
const authPassword     = document.getElementById('authPassword');
const authRole         = document.getElementById('authRole');
const authMessage      = document.getElementById('authMessage');
const authSubmitBtn    = document.getElementById('authSubmitBtn');
const authSwitchBtn    = document.getElementById('authSwitchBtn');
const authSwitchText   = document.getElementById('authSwitchText');
const signupNameField  = document.getElementById('signupNameField');
const signupRoleField  = document.getElementById('signupRoleField');
const userSwitcherBtn  = document.getElementById('userSwitcherBtn');
const activeUserLabel  = document.getElementById('activeUserLabel');
const loginScreen      = document.getElementById('loginScreen');

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  authMessage.style.display = 'none';
  authMessage.textContent   = '';

  if (mode === 'login') {
    authTitle.textContent       = 'Login to StockFlow';
    authSubmitBtn.textContent   = 'Login';
    authSwitchText.textContent  = "Don't have an account?";
    authSwitchBtn.textContent   = 'Sign up';
    signupNameField.style.display = 'none';
    signupRoleField.style.display = 'none';
    authName.removeAttribute('required');
  } else {
    authTitle.textContent       = 'Create New Account';
    authSubmitBtn.textContent   = 'Sign Up';
    authSwitchText.textContent  = 'Already have an account?';
    authSwitchBtn.textContent   = 'Login';
    signupNameField.style.display = 'block';
    signupRoleField.style.display = 'block';
    authName.setAttribute('required', 'required');
  }
}

function openAuthScreen(mode = 'login') {
  setAuthMode(mode);
  if (loginScreen) loginScreen.style.display = 'flex';
}

function closeAuthScreen() {
  if (loginScreen) loginScreen.style.display = 'none';
}

function updateActiveUserUI(user) {
  if (userSwitcherBtn) {
    userSwitcherBtn.textContent = user?.name
      ? user.name.substring(0, 2).toUpperCase()
      : 'GU';
  }
  if (activeUserLabel) {
    activeUserLabel.textContent = user ? `${user.name} (${user.role})` : 'Guest';
  }

  // Role-based UI: hide add/edit/delete for non-admin
  const adminOnlyEls = document.querySelectorAll('.admin-only');
  adminOnlyEls.forEach(el => {
    el.style.display = (user?.role === 'Admin') ? '' : 'none';
  });
}

function handleUnauthorized() {
  clearToken();
  currentUser = null;
  updateActiveUserUI(null);
  openAuthScreen('login');
  showToast('Session expired. Please log in again.', 'error');
}

if (authSwitchBtn) {
  authSwitchBtn.addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  });
}

if (userSwitcherBtn) {
  userSwitcherBtn.addEventListener('click', () => {
    clearToken();
    currentUser = null;
    updateActiveUserUI(null);
    openAuthScreen('login');
  });
}

if (authForm) {
  authForm.addEventListener('submit', async e => {
    e.preventDefault();

    authMessage.style.display = 'none';
    authMessage.textContent   = '';
    authSubmitBtn.disabled    = true;
    authSubmitBtn.textContent = authMode === 'login' ? 'Logging in...' : 'Creating account...';

    try {
      if (authMode === 'login') {
        const res  = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:    authEmail.value.trim(),
            password: authPassword.value.trim()
          })
        });

        const data = await res.json();

        if (data.success) {
          saveToken(data.token);
          saveUser(data.user);
          currentUser = data.user;
          updateActiveUserUI(data.user);
          closeAuthScreen();
          showView('dashboard');
          await loadDashboard();
          await loadReports();
        } else {
          authMessage.style.display = 'block';
          authMessage.textContent   = data.message || 'Invalid credentials';
          authMessage.style.color   = 'var(--color-error)';
        }
      } else {
        const res  = await fetch(`${API_BASE}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:     authName.value.trim(),
            email:    authEmail.value.trim(),
            password: authPassword.value.trim(),
            role:     authRole.value
          })
        });

        const data = await res.json();

        authMessage.style.display = 'block';
        authMessage.textContent   = data.message || 'Signup complete';
        authMessage.style.color   = data.success ? 'var(--color-success)' : 'var(--color-error)';

        if (data.success) {
          const savedEmail    = authEmail.value.trim();
          const savedPassword = authPassword.value.trim();
          authForm.reset();
          setAuthMode('login');
          authEmail.value    = savedEmail;
          authPassword.value = savedPassword;
        }
      }
    } catch (err) {
      authMessage.style.display = 'block';
      authMessage.textContent   = 'Unable to connect to server';
      authMessage.style.color   = 'var(--color-error)';
    } finally {
      authSubmitBtn.disabled    = false;
      authSubmitBtn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
    }
  });
}

// ─── Expose globals (for inline onclick handlers) ──────────────────────────────
window.deleteProduct    = deleteProduct;
window.deleteSupplier   = deleteSupplier;
window.openEditProduct  = openEditProduct;
window.closeEditProduct = closeEditProduct;
window.openEditSupplier = openEditSupplier;
window.closeEditSupplier = closeEditSupplier;

// ─── Init ──────────────────────────────────────────────────────────────────────
// Try to restore session from localStorage
const savedToken = getToken();
const savedUser  = getSavedUser();

if (savedToken && savedUser) {
  currentUser = savedUser;
  updateActiveUserUI(savedUser);
  showView('dashboard');
  loadDashboard();
  loadReports();
} else {
  updateActiveUserUI(null);
  openAuthScreen('login');
}