const CONFIG = {
  targetAmount: 8100000,
  monthlySaving: 500000,
  supabaseUrl: "https://ggjmxzeuzcrkobfzkhgy.supabase.co",
  supabaseAnonKey: "sb_publishable_-j4pRJs6YWWFfNG7shEeEg_zb5wGzZX",
  vaultKey: "djiosmopocket4"
};

const categoryOptions = [
  "Uang Bulanan",
  "Tabungan",
  "Makan & Jajan",
  "Transportasi",
  "Kebutuhan Sekolah",
  "Pulsa & Internet",
  "Topup e-Wallet",
  "Langganan Aplikasi",
  "Hiburan",
  "Kesehatan",
  "Skincare",
  "Tarik Tunai",
  "Lainnya"
];

const el = {
  syncBadge: document.querySelector("#syncBadge"),
  logoutBtn: document.querySelector("#logoutBtn"),
  themeToggle: document.querySelector("#themeToggle"),

  totalSavings: document.querySelector("#totalSavings"),
  savingStatus: document.querySelector("#savingStatus"),
  totalIncome: document.querySelector("#totalIncome"),
  totalExpense: document.querySelector("#totalExpense"),
  finishEstimate: document.querySelector("#finishEstimate"),
  monthsLeftText: document.querySelector("#monthsLeftText"),
  progressTitle: document.querySelector("#progressTitle"),
  remainingText: document.querySelector("#remainingText"),
  progressFill: document.querySelector("#progressFill"),
  heroTargetAmount: document.querySelector("#heroTargetAmount"),
  progressTargetAmount: document.querySelector("#progressTargetAmount"),

  transactionForm: document.querySelector("#transactionForm"),
  formTitle: document.querySelector("#formTitle"),
  trxDate: document.querySelector("#trxDate"),
  trxTitle: document.querySelector("#trxTitle"),
  trxCategory: document.querySelector("#trxCategory"),
  trxCategorySelect: document.querySelector("#trxCategorySelect"),
  trxCategoryTrigger: document.querySelector("#trxCategoryTrigger"),
  trxCategoryLabel: document.querySelector("#trxCategoryLabel"),
  trxCategoryMenu: document.querySelector("#trxCategoryMenu"),
  trxAmount: document.querySelector("#trxAmount"),
  submitBtn: document.querySelector("#submitBtn"),
  formMessage: document.querySelector("#formMessage"),
  typeToggle: document.querySelector(".type-toggle"),
  typeButtons: document.querySelectorAll(".type-toggle button"),

  monthFilter: document.querySelector("#monthFilter"),
  monthTitle: document.querySelector("#monthTitle"),
  monthIncome: document.querySelector("#monthIncome"),
  monthExpense: document.querySelector("#monthExpense"),
  monthBalance: document.querySelector("#monthBalance"),
  monthGoalFill: document.querySelector("#monthGoalFill"),
  monthGoalText: document.querySelector("#monthGoalText"),

  incomeList: document.querySelector("#incomeList"),
  expenseList: document.querySelector("#expenseList"),
  incomeCount: document.querySelector("#incomeCount"),
  expenseCount: document.querySelector("#expenseCount"),

  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),

  confirmModal: document.querySelector("#confirmModal"),
  confirmText: document.querySelector("#confirmText"),
  confirmOk: document.querySelector("#confirmOk"),
  confirmCancel: document.querySelector("#confirmCancel")
};

let supabaseClient = null;
let transactions = [];
let selectedType = "income";
let confirmResolver = null;
const storageKey = "dji-pocket-savings-transactions-v1";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

function formatRupiah(value) {
  return rupiahFormatter.format(Number(value || 0)).replace(/\s/g, "");
}

function parseRupiahValue(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatAmountInput() {
  const amount = parseRupiahValue(el.trxAmount.value);
  el.trxAmount.value = amount ? formatRupiah(amount) : "";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

function monthName(monthString) {
  if (!monthString) return "Semua bulan";
  const [year, month] = monthString.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function isCloudConfigured() {
  return (
    CONFIG.supabaseUrl &&
    CONFIG.supabaseAnonKey &&
    CONFIG.vaultKey &&
    !CONFIG.supabaseUrl.includes("PASTE_") &&
    !CONFIG.supabaseAnonKey.includes("PASTE_") &&
    !CONFIG.vaultKey.includes("GANTI_") &&
    CONFIG.supabaseUrl.startsWith("https://") &&
    CONFIG.supabaseUrl.includes(".supabase.co")
  );
}

function setMessage(target, message, isError = false) {
  target.textContent = message || "";
  target.style.color = isError ? "#ff9bb0" : "";
}

function renderConfigText() {
  const targetText = formatRupiah(CONFIG.targetAmount);

  if (el.heroTargetAmount) {
    el.heroTargetAmount.textContent = targetText;
  }

  if (el.progressTargetAmount) {
    el.progressTargetAmount.textContent = targetText;
  }
}

function normalizeTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    category: row.category || "Lainnya",
    amount: Number(row.amount),
    trx_date: row.trx_date,
    created_at: row.created_at || new Date().toISOString()
  };
}

async function init() {
  renderConfigText();
  el.trxDate.value = todayISO();
  el.monthFilter.value = currentMonthISO();
  if (el.logoutBtn) el.logoutBtn.classList.add("hidden");

  setupCategorySelect();
  setSelectedType("income");
  bindEvents();

  if (isCloudConfigured()) {
    await initCloudMode();
  } else {
    activateLocalMode();
  }
}

function bindEvents() {
  el.typeButtons.forEach((button) => {
    button.addEventListener("click", () => setSelectedType(button.dataset.type));
  });

  el.trxAmount.addEventListener("input", formatAmountInput);
  el.transactionForm.addEventListener("submit", saveTransaction);
  el.monthFilter.addEventListener("change", renderAll);
  el.exportBtn.addEventListener("click", exportData);
  el.importInput.addEventListener("change", importData);

  el.trxCategoryTrigger.addEventListener("click", () => {
    el.trxCategorySelect.classList.toggle("open");
    syncDropdownLayer();
    el.trxCategoryTrigger.setAttribute("aria-expanded", String(el.trxCategorySelect.classList.contains("open")));
  });

  document.addEventListener("click", (event) => {
    if (!el.trxCategorySelect.contains(event.target)) closeCategorySelect();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCategorySelect();
      hideConfirm(false);
    }
  });

  el.confirmCancel.addEventListener("click", () => hideConfirm(false));
  el.confirmOk.addEventListener("click", () => hideConfirm(true));
  el.confirmModal.addEventListener("click", (event) => {
    if (event.target === el.confirmModal) hideConfirm(false);
  });
}

function setupCategorySelect() {
  el.trxCategoryMenu.innerHTML = categoryOptions.map((category) => `
    <button class="custom-option" type="button" data-category="${escapeHTML(category)}" role="option">
      <span>${escapeHTML(category)}</span>
      <i class="fa-solid fa-check check"></i>
    </button>
  `).join("");

  el.trxCategoryMenu.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      setCategoryValue(button.dataset.category);
      closeCategorySelect();
    });
  });

  setCategoryValue(categoryOptions[0]);
}

function closeCategorySelect() {
  el.trxCategorySelect.classList.remove("open");
  syncDropdownLayer();
  el.trxCategoryTrigger.setAttribute("aria-expanded", "false");
}

function syncDropdownLayer() {
  el.transactionForm.classList.toggle("dropdown-active", el.trxCategorySelect.classList.contains("open"));
}

function setCategoryValue(category) {
  const selected = categoryOptions.includes(category) ? category : categoryOptions[0];
  el.trxCategory.value = selected;
  el.trxCategoryLabel.textContent = selected;

  el.trxCategoryMenu.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === selected);
    button.setAttribute("aria-selected", String(button.dataset.category === selected));
  });
}

function setSelectedType(type) {
  selectedType = type === "expense" ? "expense" : "income";
  el.typeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.type === selectedType));
  el.typeToggle.classList.toggle("income-selected", selectedType === "income");
  el.typeToggle.classList.toggle("expense-selected", selectedType === "expense");
  updateCategoryState();
}

function updateCategoryState() {
  el.formTitle.textContent = selectedType === "income" ? "Pemasukan baru" : "Pengeluaran baru";
  el.submitBtn.innerHTML = selectedType === "income"
    ? `<i class="fa-solid fa-floppy-disk"></i> Simpan pemasukan`
    : `<i class="fa-solid fa-floppy-disk"></i> Simpan pengeluaran`;
  if (!el.trxCategory.value) setCategoryValue(categoryOptions[0]);
}

async function initCloudMode() {
  supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  updateSyncBadge(true);
  await loadCloudTransactions();
}

function activateLocalMode() {
  updateSyncBadge(false);
  transactions = JSON.parse(localStorage.getItem(storageKey) || "[]").map(normalizeTransaction);
  renderAll();
}

function updateSyncBadge(isCloud) {
  if (isCloud) {
    el.syncBadge.className = "sync-badge cloud";
    el.syncBadge.innerHTML = `<i class="fa-solid fa-cloud"></i> Cloud sync aktif`;
  } else {
    el.syncBadge.className = "sync-badge local";
    el.syncBadge.innerHTML = `<i class="fa-solid fa-database"></i> Mode lokal`;
    setMessage(el.formMessage, "Mode lokal aktif. Isi supabaseUrl, supabaseAnonKey, dan vaultKey di script.js untuk cloud tanpa login.");
  }
}

async function loadCloudTransactions() {
  const { data, error } = await supabaseClient.rpc("get_savings_transactions", {
    p_vault_key: CONFIG.vaultKey
  });

  if (error) {
    setMessage(el.formMessage, `Gagal memuat cloud: ${error.message}`, true);
    transactions = [];
    renderAll();
    return;
  }

  transactions = (data || []).map(normalizeTransaction);
  renderAll();
}

async function saveTransaction(event) {
  event.preventDefault();
  setMessage(el.formMessage, "");

  const amount = parseRupiahValue(el.trxAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setMessage(el.formMessage, "Nominal harus lebih dari 0.", true);
    return;
  }

  const payload = {
    type: selectedType,
    title: el.trxTitle.value.trim(),
    category: el.trxCategory.value,
    amount,
    trx_date: el.trxDate.value,
    created_at: new Date().toISOString()
  };

  if (!payload.title || !payload.trx_date) {
    setMessage(el.formMessage, "Tanggal dan judul wajib diisi.", true);
    return;
  }

  if (supabaseClient) {
    const { error } = await supabaseClient.rpc("add_savings_transaction", {
      p_vault_key: CONFIG.vaultKey,
      p_type: payload.type,
      p_title: payload.title,
      p_category: payload.category,
      p_amount: payload.amount,
      p_trx_date: payload.trx_date
    });

    if (error) {
      setMessage(el.formMessage, `Gagal simpan cloud: ${error.message}`, true);
      return;
    }
    await loadCloudTransactions();
  } else {
    transactions.unshift({ id: crypto.randomUUID(), ...payload });
    persistLocal();
    renderAll();
  }

  el.transactionForm.reset();
  el.trxDate.value = todayISO();
  el.trxAmount.value = "";
  setCategoryValue(categoryOptions[0]);
  updateCategoryState();
  setMessage(el.formMessage, `${selectedType === "income" ? "Pemasukan" : "Pengeluaran"} tersimpan.`);
}

function persistLocal() {
  localStorage.setItem(storageKey, JSON.stringify(transactions));
}

async function deleteTransaction(id) {
  const item = transactions.find((trx) => trx.id === id);
  if (!item) return;

  const ok = await showConfirmModal(`Catatan "${item.title}" akan dihapus permanen. Lanjut hapus?`);
  if (!ok) return;

  if (supabaseClient) {
    const { error } = await supabaseClient.rpc("delete_savings_transaction", {
      p_vault_key: CONFIG.vaultKey,
      p_id: id
    });

    if (error) {
      setMessage(el.formMessage, `Gagal hapus cloud: ${error.message}`, true);
      return;
    }
    await loadCloudTransactions();
  } else {
    transactions = transactions.filter((trx) => trx.id !== id);
    persistLocal();
    renderAll();
  }
}

function showConfirmModal(message) {
  el.confirmText.textContent = message;
  el.confirmModal.classList.remove("hidden");
  el.confirmModal.setAttribute("aria-hidden", "false");
  setTimeout(() => el.confirmCancel.focus(), 30);

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function hideConfirm(result) {
  if (el.confirmModal.classList.contains("hidden")) return;
  el.confirmModal.classList.add("hidden");
  el.confirmModal.setAttribute("aria-hidden", "true");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

function sumByType(items, type) {
  return items
    .filter((trx) => trx.type === type)
    .reduce((sum, trx) => sum + Number(trx.amount || 0), 0);
}

function renderAll() {
  const totalIncome = sumByType(transactions, "income");
  const totalExpense = sumByType(transactions, "expense");
  const totalSavings = totalIncome - totalExpense;
  const remaining = Math.max(CONFIG.targetAmount - totalSavings, 0);
  const progress = Math.max(0, Math.min(100, (totalSavings / CONFIG.targetAmount) * 100));
  const monthsLeft = remaining <= 0 ? 0 : Math.ceil(remaining / CONFIG.monthlySaving);
  const finishDate = addMonths(new Date(), monthsLeft);

  el.totalIncome.textContent = formatRupiah(totalIncome);
  el.totalExpense.textContent = formatRupiah(totalExpense);
  el.totalSavings.textContent = formatRupiah(totalSavings);
  el.progressFill.style.width = `${progress}%`;
  el.progressFill.classList.toggle("has-progress", progress > 0);
  el.progressTitle.textContent = `${progress.toFixed(1)}% menuju DJI Osmo Pocket 4`;
  el.remainingText.textContent = remaining <= 0 ? "Target tercapai!" : `Sisa ${formatRupiah(remaining)}`;
  el.finishEstimate.textContent = remaining <= 0
    ? "Selesai!"
    : finishDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  el.monthsLeftText.textContent = remaining <= 0
    ? "Saatnya siap-siap unboxing"
    : `${monthsLeft} bulan lagi jika Rp500.000/bulan`;

  el.savingStatus.textContent = totalSavings <= 0
    ? "Mulai dari Rp0 juga gapapa"
    : totalSavings >= CONFIG.targetAmount
      ? "Ciee, Wishlistnya kebeli nih"
      : `${formatRupiah(remaining)} lagi menuju target`;

  renderMonthSummary();
  renderLists();
}

function getSelectedMonthTransactions() {
  const selectedMonth = el.monthFilter.value;
  if (!selectedMonth) return transactions;
  return transactions.filter((trx) => trx.trx_date?.startsWith(selectedMonth));
}

function renderMonthSummary() {
  const month = el.monthFilter.value;
  const items = getSelectedMonthTransactions();
  const income = sumByType(items, "income");
  const expense = sumByType(items, "expense");
  const balance = income - expense;
  const goalPercent = Math.max(0, Math.min(100, (balance / CONFIG.monthlySaving) * 100));

  el.monthTitle.textContent = monthName(month);
  el.monthIncome.textContent = formatRupiah(income);
  el.monthExpense.textContent = formatRupiah(expense);
  el.monthBalance.textContent = formatRupiah(balance);
  el.monthGoalFill.style.width = `${goalPercent}%`;
  el.monthGoalFill.classList.toggle("has-progress", goalPercent > 0);

  if (balance >= CONFIG.monthlySaving) {
    el.monthGoalText.textContent = `Mantap. Bulan ini sudah lewat target nabung ${formatRupiah(CONFIG.monthlySaving)}.`;
  } else {
    const lack = CONFIG.monthlySaving - Math.max(balance, 0);
    el.monthGoalText.textContent = `Kurang ${formatRupiah(lack)} lagi biar bulan ini tembus target.`;
  }
}

function renderLists() {
  const items = getSelectedMonthTransactions().sort((a, b) => {
    return new Date(b.trx_date + "T00:00:00") - new Date(a.trx_date + "T00:00:00") || new Date(b.created_at) - new Date(a.created_at);
  });

  const incomeItems = items.filter((trx) => trx.type === "income");
  const expenseItems = items.filter((trx) => trx.type === "expense");

  el.incomeCount.textContent = `${incomeItems.length} catatan`;
  el.expenseCount.textContent = `${expenseItems.length} catatan`;
  el.incomeList.innerHTML = incomeItems.length ? incomeItems.map(renderTransactionItem).join("") : emptyState("Belum ada pemasukan di bulan ini.");
  el.expenseList.innerHTML = expenseItems.length ? expenseItems.map(renderTransactionItem).join("") : emptyState("Belum ada pengeluaran di bulan ini.");

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.delete));
  });
}

function renderTransactionItem(trx) {
  const sign = trx.type === "income" ? "+" : "-";
  return `
    <div class="transaction-item">
      <div>
        <h3>${escapeHTML(trx.title)}</h3>
        <p>${escapeHTML(trx.category)} • ${formatDate(trx.trx_date)}</p>
      </div>
      <div class="amount-box ${trx.type}">
        ${sign}${formatRupiah(trx.amount)}
        <br>
        <button class="delete-btn" type="button" data-delete="${trx.id}" aria-label="Hapus catatan">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

function emptyState(message) {
  return `<div class="empty-state"><i class="fa-solid fa-mug-hot"></i><br>${message}</div>`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString + "T00:00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function exportData() {
  const payload = {
    app: "dji-pocket-savings",
    exported_at: new Date().toISOString(),
    transactions
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dji-pocket-savings-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const imported = Array.isArray(json) ? json : json.transactions;
    if (!Array.isArray(imported)) throw new Error("Format JSON tidak valid.");

    const cleaned = imported.map((trx) => normalizeTransaction({
      ...trx,
      id: trx.id || crypto.randomUUID(),
      created_at: trx.created_at || new Date().toISOString()
    })).filter((trx) => trx.title && trx.type && trx.amount && trx.trx_date);

    if (supabaseClient) {
      for (const trx of cleaned) {
        const { error } = await supabaseClient.rpc("add_savings_transaction", {
          p_vault_key: CONFIG.vaultKey,
          p_type: trx.type,
          p_title: trx.title,
          p_category: trx.category,
          p_amount: trx.amount,
          p_trx_date: trx.trx_date
        });
        if (error) throw error;
      }
      await loadCloudTransactions();
    } else {
      transactions = [...cleaned, ...transactions];
      persistLocal();
      renderAll();
    }

    setMessage(el.formMessage, `${cleaned.length} catatan berhasil di-import.`);
  } catch (error) {
    setMessage(el.formMessage, `Import gagal: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
}

const themeStorageKey = "tabungan-theme";

function getDeviceTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function clearSavedThemePreference() {
  try {
    localStorage.removeItem(themeStorageKey);
  } catch (error) {
  }
}

function updateThemeButton(theme) {
  if (!el.themeToggle) return;

  const nextTheme = theme === "dark" ? "light" : "dark";
  el.themeToggle.setAttribute("aria-label", `Ganti ke ${nextTheme === "dark" ? "dark mode" : "light mode"}`);
  el.themeToggle.title = `Ganti ke ${nextTheme === "dark" ? "dark mode" : "light mode"}`;
}

let themeChangeTimer = null;

function getThemeBaseColor(theme) {
  return theme === "light" ? "#f7f3ea" : "#101018";
}

function runThemeFade(fromTheme) {
  const oldLayer = document.querySelector(".theme-fade-layer");
  if (oldLayer) oldLayer.remove();

  const layer = document.createElement("div");
  layer.className = "theme-fade-layer";
  layer.style.background = getThemeBaseColor(fromTheme);
  document.body.appendChild(layer);

  requestAnimationFrame(() => {
    layer.classList.add("is-leaving");
  });

  window.setTimeout(() => {
    layer.remove();
  }, 360);
}

function applyTheme(theme, shouldSave = false, withFade = false) {
  const nextTheme = theme === "light" ? "light" : "dark";
  const root = document.documentElement;
  const currentTheme = root.dataset.theme === "light" ? "light" : "dark";

  if (withFade && currentTheme !== nextTheme) {
    runThemeFade(currentTheme);
  }

  root.classList.add("theme-changing");
  root.dataset.theme = nextTheme;

  clearTimeout(themeChangeTimer);
  themeChangeTimer = setTimeout(() => {
    root.classList.remove("theme-changing");
  }, 90);

  updateThemeButton(nextTheme);
}

function initTheme() {
  clearSavedThemePreference();

  const initialTheme = getDeviceTheme();
  applyTheme(initialTheme, false);

  if (el.themeToggle) {
    el.themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";

      applyTheme(currentTheme === "dark" ? "light" : "dark", false, true);
    });
  }

  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener?.("change", (event) => {
    applyTheme(event.matches ? "light" : "dark", false, true);
  });
}

function updateTimeCounter() {
  const timeCounter = document.querySelector("#timeCounter");
  if (!timeCounter) return;

  const startDate = new Date("2026-06-01T00:00:00+07:00");
  const now = new Date();

  const totalHours = Math.max(
    0,
    Math.floor((now - startDate) / (1000 * 60 * 60))
  );

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  timeCounter.textContent = `${days} hari ${hours} jam`;
}

initTheme();
init();
updateTimeCounter();
setInterval(updateTimeCounter, 1000 * 60);
