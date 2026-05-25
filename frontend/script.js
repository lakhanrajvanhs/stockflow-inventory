
const API_BASE = "http://localhost:5001/api";

/* Theme */
const root = document.documentElement;
const toggle = document.querySelector("[data-theme-toggle]");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
let theme = prefersDark ? "dark" : "light";
root.setAttribute("data-theme", theme);

if (toggle) {
  toggle.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", theme);
  });
}

/* Mobile sidebar */
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

if (menuBtn && sidebar && overlay) {
  menuBtn.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });
}

/* DOM refs */
const productBody = document.getElementById("productTableBody");
const supplierList = document.getElementById("supplierList");
const productForm = document.getElementById("productForm");
const supplierForm = document.getElementById("supplierForm");
const transactionForm = document.getElementById("transactionForm");
const searchInput = document.getElementById("searchInput");
const loadProductsBtn = document.getElementById("loadProductsBtn");
const clearFormBtn = document.getElementById("clearFormBtn");

const navButtons = document.querySelectorAll(".nav-btn");
const views = document.querySelectorAll(".view-section");

const transactionTableBody = document.getElementById("transactionTableBody");

const reportTotalProducts = document.getElementById("reportTotalProducts");
const reportTotalSuppliers = document.getElementById("reportTotalSuppliers");
const reportTotalTransactions = document.getElementById("reportTotalTransactions");
const reportInventoryValue = document.getElementById("reportInventoryValue");
const reportLowStockBody = document.getElementById("reportLowStockBody");

/* App state */
let allProducts = [];
let allSuppliers = [];
let allTransactions = [];
let currentUser = null;

/* Helpers */
function getStatus(quantity, reorderLevel) {
  if (quantity === 0) return { text: "Out", className: "out" };
  if (quantity <= reorderLevel) return { text: "Low", className: "low" };
  return { text: "Healthy", className: "good" };
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN");
}

/* Products */
function renderProducts(products) {
  if (!productBody) return;

  if (!products.length) {
    productBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No products found.</td>
      </tr>
    `;
    return;
  }

  productBody.innerHTML = products
    .map((product) => {
      const quantity = Number(product.quantity);
      const reorderLevel = Number(product.reorder_level);
      const status = getStatus(quantity, reorderLevel);

      return `
        <tr>
          <td>${product.product_id}</td>
          <td>${product.product_name}</td>
          <td>${product.category || "-"}</td>
          <td>${quantity}</td>
          <td>${formatCurrency(product.price)}</td>
          <td><span class="status ${status.className}">${status.text}</span></td>
          <td>
            <button 
              class="btn btn-secondary" 
              style="padding: 0.25rem 0.5rem; min-height: auto; font-size: 0.8rem; color: var(--color-error);" 
              onclick="deleteProduct(${product.product_id})">
              Remove
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadProducts() {
  const response = await fetch(`${API_BASE}/products`);
  const data = await response.json();
  allProducts = Array.isArray(data) ? data : [];
  renderProducts(allProducts);
  return allProducts;
}

/* Suppliers */
// FIXED: Uncommented the function block
function renderSuppliers(suppliers) {
  if (!supplierList) return;

  if (!suppliers.length) {
    supplierList.innerHTML = `<div class="empty-cell">No suppliers found.</div>`;
    return;
  }

  supplierList.innerHTML = suppliers
    .map(
      (supplier) => `
        <div class="list-item">
          <strong>${supplier.supplier_name}</strong>
          <div class="tiny">ID: ${supplier.supplier_id}</div>
          <div class="tiny">Phone: ${supplier.phone || "N/A"}</div>
          <div class="tiny">Address: ${supplier.address || "N/A"}</div>
        </div>
      `
    )
    .join("");
}

async function loadSuppliers() {
  const response = await fetch(`${API_BASE}/suppliers`);
  const data = await response.json();
  allSuppliers = Array.isArray(data) ? data : [];
  renderSuppliers(allSuppliers);
  return allSuppliers;
}

async function loadSuppliers() {
  const response = await fetch(`${API_BASE}/suppliers`);
  const data = await response.json();
  allSuppliers = Array.isArray(data) ? data : [];
  renderSuppliers(allSuppliers);
  return allSuppliers;
}

/* Dashboard */
function updateStats(products, suppliers, transactions = []) {
  const totalValue = products.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.price),
    0
  );

  const lowStock = products.filter(
    (item) => Number(item.quantity) <= Number(item.reorder_level)
  ).length;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("inventoryValue", `₹${totalValue.toLocaleString("en-IN")}`);
  setText("productCount", products.length);
  setText("lowStockCount", lowStock);
  setText("supplierCount", suppliers.length);

  setText("statProducts", products.length);
  setText("statSuppliers", suppliers.length);
  setText("statLow", lowStock);
  setText("statTransactions", transactions.length);
}

async function loadDashboard() {
  try {
    const [products, suppliers, transactions] = await Promise.all([
      loadProducts(),
      loadSuppliers(),
      loadTransactionsSafe()
    ]);

    updateStats(products, suppliers, transactions);
  } catch (error) {
    console.error("Error loading dashboard:", error);
  }
}

/* Product form */
if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      product_name: document.getElementById("product_name")?.value?.trim(),
      category: document.getElementById("category")?.value?.trim(),
      quantity: Number(document.getElementById("quantity")?.value),
      price: Number(document.getElementById("price")?.value),
      reorder_level: Number(document.getElementById("reorder_level")?.value),
      supplier_id: Number(document.getElementById("supplier_id")?.value)
    };
    
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save product");
      }

      alert(result.message || "Product saved successfully");
      productForm.reset();
      await loadDashboard();
      await loadReports();
    } catch (error) {
      console.error("Error saving product:", error);
      alert(error.message);
    }
  });
}

/* Supplier form */
if (supplierForm) {
  supplierForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      supplier_name: document.getElementById("supplier_name")?.value?.trim(),
      phone: document.getElementById("supplier_phone")?.value?.trim(),
      address: document.getElementById("supplier_address")?.value?.trim()
    };
  

    try {
      const response = await fetch(`${API_BASE}/suppliers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save supplier");
      }

      alert(result.message || "Supplier saved successfully");
      supplierForm.reset();
      await loadSuppliers();
      await loadReports();
    } catch (error) {
      console.error("Error saving supplier:", error);
      alert(error.message);
    }
  });
}

/* Search */
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const value = e.target.value.toLowerCase().trim();

    const filtered = allProducts.filter((item) => {
      return (
        (item.product_name || "").toLowerCase().includes(value) ||
        (item.category || "").toLowerCase().includes(value)
      );
    });

    renderProducts(filtered);
  });
}

if (loadProductsBtn) {
  loadProductsBtn.addEventListener("click", async () => {
    await loadDashboard();
  });
}

if (clearFormBtn) {
  clearFormBtn.addEventListener("click", () => {
    if (productForm) productForm.reset();
  });
}

/* Transactions */
function renderTransactions(transactions) {
  if (!transactionTableBody) return;

  if (!transactions.length) {
    transactionTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">No transactions found.</td>
      </tr>
    `;
    return;
  }

  transactionTableBody.innerHTML = transactions
    .map(
      (item) => `
        <tr>
          <td>${item.transaction_id}</td>
          <td>${item.product_name || item.product_id}</td>
          <td>${item.user_name || item.user_id}</td>
          <td>${item.transaction_type}</td>
          <td>${item.quantity}</td>
          <td>${formatDateTime(item.transaction_date)}</td>
        </tr>
      `
    )
    .join("");
}

async function loadTransactions() {
  const response = await fetch(`${API_BASE}/transactions`);
  const data = await response.json();
  allTransactions = Array.isArray(data) ? data : [];
  renderTransactions(allTransactions);
  return allTransactions;
}

async function loadTransactionsSafe() {
  try {
    return await loadTransactions();
  } catch (error) {
    console.error("Error loading transactions:", error);
    return [];
  }
}


if (transactionForm) {
  transactionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const transactionUserIdInput = document.getElementById("transactionUserId");

    const payload = {
      product_id: Number(document.getElementById("transactionProductId")?.value),
      user_id: Number(transactionUserIdInput?.value || currentUser?.id || 1),
      transaction_type: document.getElementById("transactionType")?.value,
      quantity: Number(document.getElementById("transactionQuantity")?.value)
    };

    try {
      const response = await fetch(`${API_BASE}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to save transaction");

      alert(result.message || "Transaction saved successfully");
      transactionForm.reset();

      if (transactionUserIdInput && currentUser?.id) {
        transactionUserIdInput.value = currentUser.id;
      }

      await loadTransactions();
      await loadDashboard();
      await loadReports();
    } catch (error) {
      console.error("Transaction save error:", error);
      alert(error.message);
    }
  });
}

/* Reports */
async function loadReports() {
  if (
    !reportTotalProducts ||
    !reportTotalSuppliers ||
    !reportTotalTransactions ||
    !reportInventoryValue ||
    !reportLowStockBody
  ) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/reports/summary`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Failed to load reports");

    const summary = data.summary || {};
    const lowStock = data.lowStock || [];

    reportTotalProducts.textContent = summary.total_products ?? 0;
    reportTotalSuppliers.textContent = summary.total_suppliers ?? 0;
    reportTotalTransactions.textContent = summary.total_transactions ?? 0;
    reportInventoryValue.textContent = formatCurrency(summary.inventory_value ?? 0);

    if (!lowStock.length) {
      reportLowStockBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-cell">No low stock items.</td>
        </tr>
      `;
      return;
    }

    reportLowStockBody.innerHTML = lowStock
      .map(
        (item) => `
          <tr>
            <td>${item.product_id}</td>
            <td>${item.product_name}</td>
            <td>${item.category || "-"}</td>
            <td>${item.quantity}</td>
            <td>${item.reorder_level}</td>
          </tr>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error loading reports:", error);
  }
}

/* Navigation */
function showView(viewName) {
  navButtons.forEach((button) => {
    const isActive = button.textContent.trim().toLowerCase() === viewName;
    button.classList.toggle("active", isActive);
  });

  views.forEach((view) => {
    view.style.display = "none";
  });

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.style.display = "block";
  }

  if (sidebar && overlay) {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    const viewName = e.currentTarget.textContent.trim().toLowerCase();
    showView(viewName);

    try {
      if (viewName === "dashboard") {
        await loadDashboard();
      } else if (viewName === "products") {
        await loadProducts();
      } else if (viewName === "suppliers") {
        await loadSuppliers();
      } else if (viewName === "transactions") {
        await loadTransactions();
      } else if (viewName === "reports") {
        await loadReports();
      }
    } catch (error) {
      console.error(`Error loading ${viewName}:`, error);
    }
  });
});


const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authRole = document.getElementById("authRole");
const authMessage = document.getElementById("authMessage");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const authSwitchText = document.getElementById("authSwitchText");
const signupNameField = document.getElementById("signupNameField");
const signupRoleField = document.getElementById("signupRoleField");
const userSwitcherBtn = document.getElementById("userSwitcherBtn");
const activeUserLabel = document.getElementById("activeUserLabel");

let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;

  authMessage.style.display = "none";
  authMessage.textContent = "";

  if (mode === "login") {
    authTitle.textContent = "Login to StockFlow";
    authSubmitBtn.textContent = "Login";
    authSwitchText.textContent = "Don't have an account?";
    authSwitchBtn.textContent = "Sign up";
    signupNameField.style.display = "none";
    signupRoleField.style.display = "none";
    authName.removeAttribute("required");
  } else {
    authTitle.textContent = "Create New Account";
    authSubmitBtn.textContent = "Sign Up";
    authSwitchText.textContent = "Already have an account?";
    authSwitchBtn.textContent = "Login";
    signupNameField.style.display = "block";
    signupRoleField.style.display = "block";
    authName.setAttribute("required", "required");
  }
}

function openAuthScreen(mode = "login") {
  setAuthMode(mode);
  loginScreen.style.display = "flex";
}

function closeAuthScreen() {
  loginScreen.style.display = "none";
}

function updateActiveUserUI(user) {
  if (userSwitcherBtn) {
    userSwitcherBtn.textContent = user?.name
      ? user.name.substring(0, 2).toUpperCase()
      : "GU";
  }

  if (activeUserLabel) {
    activeUserLabel.textContent = user
      ? `${user.name} (${user.role})`
      : "Guest";
  }
}

authSwitchBtn.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

userSwitcherBtn.addEventListener("click", () => {
  currentUser = null;
  updateActiveUserUI(null);
  openAuthScreen("login");
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  authMessage.style.display = "none";
  authMessage.textContent = "";

  try {
    if (authMode === "login") {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: authEmail.value.trim(),
          password: authPassword.value.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        currentUser = data.user;
        updateActiveUserUI(data.user);
        closeAuthScreen();

        const transactionUserIdInput = document.getElementById("transactionUserId");
        if (transactionUserIdInput && data.user?.id) {
          transactionUserIdInput.value = data.user.id;
        }

        showView("dashboard");
        await loadDashboard();
        await loadReports();
      } else {
        authMessage.style.display = "block";
        authMessage.textContent = data.message || "Invalid credentials";
        authMessage.style.color = "var(--color-error)";
      }
    } else {
      const response = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: authName.value.trim(),
          email: authEmail.value.trim(),
          password: authPassword.value.trim(),
          role: authRole.value
        })
      });

      const data = await response.json();

      authMessage.style.display = "block";
      authMessage.textContent = data.message || "Signup completed";
      authMessage.style.color = data.success
        ? "var(--color-success)"
        : "var(--color-error)";

      if (data.success) {
        const savedEmail = authEmail.value.trim();
        const savedPassword = authPassword.value.trim();

        authForm.reset();
        setAuthMode("login");

        authEmail.value = savedEmail;
        authPassword.value = savedPassword;
      }
    }
  } catch (error) {
    console.error("Auth error", error);
    authMessage.style.display = "block";
    authMessage.textContent = "Unable to connect to server";
    authMessage.style.color = "var(--color-error)";
  }
});

/* Delete Product Logic */
async function deleteProduct(productId) {
  // 1. Ask for confirmation before deleting
  if (!confirm("Are you sure you want to remove this product?")) {
    return;
  }

  try {
    // 2. Send the DELETE request to your backend
    const response = await fetch(`${API_BASE}/products/${productId}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to delete product");
    }

    // 3. Show success message and refresh the UI
    alert(result.message);
    await loadDashboard(); 
    await loadProducts();
    await loadReports();
    
  } catch (error) {
    console.error("Error deleting product:", error);
    alert(error.message);
  }
}

// Make the function available globally so the inline HTML onclick="" can find it
window.deleteProduct = deleteProduct;

updateActiveUserUI(null);
openAuthScreen("login");