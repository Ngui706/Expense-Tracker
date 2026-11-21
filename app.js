const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxexiB6g3bcaaXgsuTSaX-hB8jLxp2L7a1XVuquHn6VVnUKycKTQHaQkRLC09CeKyBE5A/exec";
const STORAGE_KEY = "comrade_pocket_session";

let authMode = "login"; // "login" | "register"

const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const authForm = document.getElementById("auth-form");
const nameInput = document.getElementById("auth-name");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const logoutBtn = document.getElementById("logout-btn");

const expenseForm = document.getElementById("expense-form");
const submitBtn = document.getElementById("submit-btn");
const listEl = document.getElementById("transaction-list");
const loaderEl = document.getElementById("loader");

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function setSession(session) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function setAuthMode(mode) {
  authMode = mode;
  authError.textContent = "";
  if (mode === "login") {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    nameInput.classList.add("hidden");
    nameInput.required = false;
    authSubmit.textContent = "Sign In";
  } else {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    nameInput.classList.remove("hidden");
    nameInput.required = true;
    authSubmit.textContent = "Create Account";
  }
}

tabLogin.addEventListener("click", () => setAuthMode("login"));
tabRegister.addEventListener("click", () => setAuthMode("register"));

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  authSubmit.disabled = true;

  const payload = {
    action: authMode,
    userId: document.getElementById("auth-userid").value,
    name: nameInput.value,
    pin: document.getElementById("auth-pin").value
  };

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status !== "success") {
      authError.textContent = data.message || "Authentication failed.";
      return;
    }

    setSession(data.session);
    authForm.reset();
    showApp(data.session);
  } catch (err) {
    authError.textContent = "Network error connecting to backend.";
    console.error(err);
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
});

function showApp(session) {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  document.getElementById("active-user").textContent = `${session.name} (@${session.userId})`;
  loadTransactions(session.token);
}

async function loadTransactions(token) {
  loaderEl.style.display = "block";
  loaderEl.textContent = "Loading records...";
  listEl.innerHTML = "";

  try {
    const url = `${SCRIPT_URL}?action=transactions&token=${encodeURIComponent(token)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "unauthorized") {
      clearSession();
      appView.classList.add("hidden");
      authView.classList.remove("hidden");
      authError.textContent = data.message;
      return;
    }

    renderDashboard(data.transactions || []);
  } catch (err) {
    loaderEl.textContent = "Failed to load transactions.";
    console.error(err);
  }
}

function renderDashboard(transactions) {
  loaderEl.style.display = "none";
  let totalIn = 0;
  let totalOut = 0;

  transactions.forEach(tx => {
    const amount = Number(tx.Amount) || 0;
    if (tx.Type === "Income") totalIn += amount;
    else totalOut += amount;

    const li = document.createElement("li");
    li.className = `tx-item ${tx.Type}`;
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(tx.Description)}</strong>
        <div class="tx-meta">${escapeHtml(tx.Category)} • ${escapeHtml(tx.PaymentMethod)} • ${escapeHtml(tx.Timestamp)}</div>
      </div>
      <div class="tx-amount">
        ${tx.Type === "Income" ? "+" : "-"} KES ${amount.toLocaleString()}
      </div>
    `;
    listEl.appendChild(li);
  });

  document.getElementById("total-in").textContent = `KES ${totalIn.toLocaleString()}`;
  document.getElementById("total-out").textContent = `KES ${totalOut.toLocaleString()}`;
  document.getElementById("balance").textContent = `KES ${(totalIn - totalOut).toLocaleString()}`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const session = getSession();
  if (!session) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  const payload = {
    action: "addTransaction",
    token: session.token,
    type: document.getElementById("type").value,
    category: document.getElementById("category").value,
    description: document.getElementById("description").value,
    amount: document.getElementById("amount").value,
    paymentMethod: document.getElementById("paymentMethod").value
  };

  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    expenseForm.reset();
    await loadTransactions(session.token);
  } catch (err) {
    alert("Error saving transaction.");
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Record Transaction";
  }
});

// Boot
const existingSession = getSession();
if (existingSession?.token) {
  showApp(existingSession);
}