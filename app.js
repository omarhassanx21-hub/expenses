// Import Firebase SDKs from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
  setDoc,
  writeBatch,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDw2tivlQ2K1yXsymitj3xYRZT3XPdrXq0",
  authDomain: "expenses-6705c.firebaseapp.com",
  projectId: "expenses-6705c",
  storageBucket: "expenses-6705c.firebasestorage.app",
  messagingSenderId: "259031265331",
  appId: "1:259031265331:web:cd475029220bc73cc17346",
  measurementId: "G-TJ6EV2TQGJ",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- STATE ---
let currentUser = null;
let transactions = [];
let monthlyChartInstance = null;
let categoryChartInstance = null;
let lastBulkBatchIds = [];
let activeMonthFilter = null;
let currencySymbol = localStorage.getItem("currency") || "$";
let isDarkMode = localStorage.getItem("theme") === "dark";
let currentSort = { column: "date", direction: "desc" };
let editingTransactionId = null;

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const deleteAllBtn = document.getElementById("delete-all-btn");
const userNameDisplay = document.getElementById("user-name");
const userEmailDisplay = document.getElementById("user-email");
const transactionsList = document.getElementById("transactions-list");
const bulkModal = document.getElementById("bulk-modal");
const openModalBtn = document.getElementById("open-modal-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelModalBtn = document.getElementById("cancel-modal-btn");
const processBtn = document.getElementById("process-btn");
const bulkInput = document.getElementById("bulk-input");
const openSingleModalBtn = document.getElementById("open-single-modal-btn");
const revertBtn = document.getElementById("revert-btn");
const singleModal = document.getElementById("single-modal");
const closeSingleModalBtn = document.getElementById("close-single-modal-btn");
const cancelSingleModalBtn = document.getElementById("cancel-single-modal-btn");
const singleForm = document.getElementById("single-transaction-form");
const confirmModal = document.getElementById("confirm-modal");
const confirmMessage = document.getElementById("confirm-message");
const cancelConfirmBtn = document.getElementById("cancel-confirm-btn");
const confirmActionBtn = document.getElementById("confirm-action-btn");
const categoryFilter = document.getElementById("category-filter");
const singleCategory = document.getElementById("single-category");
const singleDescInput = document.getElementById("single-desc");
const activeFiltersContainer = document.getElementById("active-filters");
const privacyBtn = document.getElementById("privacy-btn");
const openSettingsBtn = document.getElementById("open-settings-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const currencySelect = document.getElementById("currency-select");
const themeToggle = document.getElementById("theme-toggle");
const tabDashboard = document.getElementById("tab-dashboard");
const tabDebts = document.getElementById("tab-debts");
const dashboardView = document.getElementById("dashboard-view");
const debtsView = document.getElementById("debts-view");
const debtsIOweList = document.getElementById("debts-i-owe-list");
const debtsOwedToMeList = document.getElementById("debts-owed-to-me-list");
const debtsPeopleList = document.getElementById("debts-people-list");
const searchInput = document.getElementById("search-input");
const editModal = document.getElementById("edit-modal");
const closeEditModalBtn = document.getElementById("close-edit-modal-btn");
const cancelEditModalBtn = document.getElementById("cancel-edit-modal-btn");
const editForm = document.getElementById("edit-transaction-form");

// --- AUTHENTICATION ---
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed", error);
    if (error.code === "auth/configuration-not-found") {
      alert(
        "Login failed: Google Sign-In is not enabled in your Firebase Console. Please enable it in Authentication > Sign-in method.",
      );
    } else if (error.code === "auth/unauthorized-domain") {
      alert(
        "Login failed: This domain is not authorized. Please add it to 'Authorized domains' in Firebase Console > Authentication > Settings.",
      );
    } else {
      alert("Login failed: " + error.message);
    }
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    userNameDisplay.textContent = user.displayName;
    userEmailDisplay.textContent = user.email;
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");

    // Fetch user settings from DB
    const userDocRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.currency) currencySymbol = data.currency;
        if (data.theme) isDarkMode = data.theme === "dark";

        // Sync local storage
        localStorage.setItem("currency", currencySymbol);
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
      }
    } catch (e) {
      console.error("Error fetching user settings:", e);
    }

    // Apply settings to UI controls
    currencySelect.value = currencySymbol;
    applyTheme();

    // Create or update user document in Firestore (for settings)
    await setDoc(
      userDocRef,
      {
        email: user.email,
        displayName: user.displayName,
        lastLogin: Timestamp.now(),
        currency: currencySymbol,
        theme: isDarkMode ? "dark" : "light",
      },
      { merge: true },
    );

    loadTransactions();
  } else {
    currentUser = null;
    loginScreen.classList.remove("hidden");
    dashboard.classList.add("hidden");
    // Clear data from memory
    transactions = [];
    lastBulkBatchIds = [];
    revertBtn.classList.add("hidden");
  }
});

// --- PRIVACY MODE LOGIC ---
privacyBtn.addEventListener("click", () => {
  document.body.classList.toggle("is-privacy-mode");
  const icon = privacyBtn.querySelector("i");
  if (document.body.classList.contains("is-privacy-mode")) {
    icon.classList.replace("ph-eye", "ph-eye-slash");
  } else {
    icon.classList.replace("ph-eye-slash", "ph-eye");
  }
});

// --- SETTINGS LOGIC ---
openSettingsBtn.addEventListener("click", () => {
  settingsModal.classList.remove("hidden");
  currencySelect.value = currencySymbol;
});

closeSettingsBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

currencySelect.addEventListener("change", async (e) => {
  currencySymbol = e.target.value;
  localStorage.setItem("currency", currencySymbol);
  updateUI();

  if (currentUser) {
    await setDoc(
      doc(db, "users", currentUser.uid),
      { currency: currencySymbol },
      { merge: true },
    );
  }
});

themeToggle.addEventListener("click", async () => {
  isDarkMode = !isDarkMode;
  localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  applyTheme();
  renderCharts();

  if (currentUser) {
    await setDoc(
      doc(db, "users", currentUser.uid),
      { theme: isDarkMode ? "dark" : "light" },
      { merge: true },
    );
  }
});

function applyTheme() {
  if (isDarkMode) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// --- SORTING LOGIC ---
function updateSortIcons() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const icon = th.querySelector("i");
    const column = th.getAttribute("data-sort");

    if (column === currentSort.column) {
      icon.className =
        currentSort.direction === "asc" ? "ph ph-caret-up" : "ph ph-caret-down";
      icon.classList.add("text-blue-600", "dark:text-blue-400");
      icon.classList.remove("text-slate-400");
    } else {
      icon.className = "ph ph-caret-up-down";
      icon.classList.remove("text-blue-600", "dark:text-blue-400");
      icon.classList.add("text-slate-400");
    }
  });
}

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const column = th.getAttribute("data-sort");
    if (currentSort.column === column) {
      currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
    } else {
      currentSort.column = column;
      // Default sort direction based on column type
      currentSort.direction = ["date", "amount"].includes(column)
        ? "desc"
        : "asc";
    }
    updateSortIcons();
    renderTable();
  });
});

// --- SEARCH LOGIC ---
searchInput.addEventListener("input", renderTable);

// --- TAB NAVIGATION ---
function switchTab(tab) {
  if (tab === "dashboard") {
    dashboardView.classList.remove("hidden");
    debtsView.classList.add("hidden");
    tabDashboard.classList.add(
      "border-blue-500",
      "text-blue-600",
      "dark:text-blue-400",
    );
    tabDashboard.classList.remove(
      "border-transparent",
      "text-slate-500",
      "dark:text-slate-400",
    );
    tabDebts.classList.remove(
      "border-blue-500",
      "text-blue-600",
      "dark:text-blue-400",
    );
    tabDebts.classList.add(
      "border-transparent",
      "text-slate-500",
      "dark:text-slate-400",
    );
  } else if (tab === "debts") {
    dashboardView.classList.add("hidden");
    debtsView.classList.remove("hidden");
    tabDebts.classList.add(
      "border-blue-500",
      "text-blue-600",
      "dark:text-blue-400",
    );
    tabDebts.classList.remove(
      "border-transparent",
      "text-slate-500",
      "dark:text-slate-400",
    );
    tabDashboard.classList.remove(
      "border-blue-500",
      "text-blue-600",
      "dark:text-blue-400",
    );
    tabDashboard.classList.add(
      "border-transparent",
      "text-slate-500",
      "dark:text-slate-400",
    );
    renderDebts();
  }
}

tabDashboard.addEventListener("click", () => switchTab("dashboard"));
tabDebts.addEventListener("click", () => switchTab("debts"));

// --- DATABASE LISTENER ---
let unsubscribe = null;

function loadTransactions() {
  if (unsubscribe) unsubscribe(); // Unsubscribe from previous listener if exists

  const q = query(
    collection(db, "users", currentUser.uid, "transactions"),
    orderBy("date", "desc"),
  );

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      transactions = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          jsDate:
            data.date && data.date.toDate ? data.date.toDate() : new Date(),
        };
      });

      updateUI();
    },
    (error) => {
      console.error("Error fetching transactions:", error);
      if (error.code === "failed-precondition") {
        alert(
          "Action Required: Firestore needs an index to sort your transactions by date.\n\nPlease open your browser console (F12), look for the error link from Firebase, and click it to create the index.",
        );
      }
    },
  );
}

// --- UI UPDATES ---
function updateUI() {
  renderTable();
  renderStats();
  renderCharts();
  if (!debtsView.classList.contains("hidden")) renderDebts();
}

function renderTable() {
  transactionsList.innerHTML = "";

  // Filter transactions based on dropdown
  const filterVal = categoryFilter.value;
  let filteredTransactions = transactions;

  if (filterVal !== "all") {
    filteredTransactions = filteredTransactions.filter(
      (t) => (t.category || "General") === filterVal,
    );
  }

  // Filter by Search Term
  const searchTerm = searchInput.value.toLowerCase();
  if (searchTerm) {
    filteredTransactions = filteredTransactions.filter((t) =>
      t.description.toLowerCase().includes(searchTerm),
    );
  }

  // Filter by Month (Chart Click)
  if (activeMonthFilter) {
    filteredTransactions = filteredTransactions.filter((t) => {
      const monthKey = t.jsDate.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return monthKey === activeMonthFilter;
    });

    // Show active filter chip
    activeFiltersContainer.classList.remove("hidden");
    activeFiltersContainer.innerHTML = `
      <div class="flex flex-wrap items-center gap-3">
        <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 fade-in">
            Month: ${activeMonthFilter}
            <button id="clear-month-filter" class="hover:text-blue-900 ml-1"><i class="ph ph-x font-bold"></i></button>
        </span>
        <button id="delete-month-btn" class="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-full transition border border-red-100 fade-in">
            <i class="ph ph-trash"></i> Delete Month
        </button>
      </div>
    `;

    document
      .getElementById("clear-month-filter")
      .addEventListener("click", () => {
        activeMonthFilter = null;
        renderTable();
        updateUI();
      });

    document
      .getElementById("delete-month-btn")
      .addEventListener("click", () => {
        const monthTrans = transactions.filter((t) => {
          const monthKey = t.jsDate.toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
          });
          return monthKey === activeMonthFilter;
        });

        if (monthTrans.length === 0) return;

        requestConfirmation(
          `Delete all ${monthTrans.length} transactions for ${activeMonthFilter}?`,
          async () => {
            await deleteBatchTransactions(monthTrans);
            activeMonthFilter = null;
            showToast("Month deleted successfully", "success");
          },
        );
      });
  } else {
    activeFiltersContainer.classList.add("hidden");
    activeFiltersContainer.innerHTML = "";
  }

  // Calculate Total for visible rows
  const totalVisibleAmount = filteredTransactions.reduce((sum, t) => {
    return sum + (t.type === "income" ? t.amount : -t.amount);
  }, 0);

  // Sort transactions
  filteredTransactions.sort((a, b) => {
    let valA = a[currentSort.column];
    let valB = b[currentSort.column];

    if (currentSort.column === "date") {
      valA = a.jsDate.getTime();
      valB = b.jsDate.getTime();
    } else if (currentSort.column === "category") {
      valA = (valA || "General").toLowerCase();
      valB = (valB || "General").toLowerCase();
    } else if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return currentSort.direction === "asc" ? -1 : 1;
    if (valA > valB) return currentSort.direction === "asc" ? 1 : -1;
    return 0;
  });

  if (filteredTransactions.length === 0) {
    const footer = document.getElementById("transactions-footer");
    if (footer) footer.classList.add("hidden");
    transactionsList.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No transactions found. Add some!</td></tr>`;
    return;
  }

  // Show top 50
  filteredTransactions.slice(0, 50).forEach((t) => {
    const dateStr = `${t.jsDate.getDate()}/${t.jsDate.getMonth() + 1}/${t.jsDate.getFullYear()}`;
    const isIncome = t.type === "income";
    const amountClass = isIncome ? "text-green-600" : "text-red-600";
    const sign = isIncome ? "+" : "-";

    const row = document.createElement("tr");
    row.className =
      "hover:bg-white/30 dark:hover:bg-white/5 transition border-b border-white/20 dark:border-white/10 last:border-0";
    row.innerHTML = `
            <td class="px-6 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">${dateStr}</td>
            <td class="px-6 py-3 font-medium text-slate-800 dark:text-white">${t.description}</td>
            <td class="px-6 py-3 text-slate-500">${t.category || "General"}</td>
            <td class="px-6 py-3">
                <span class="px-2 py-1 rounded text-xs font-semibold ${isIncome ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}">
                    ${t.type.toUpperCase()}
                </span>
            </td>
            <td class="px-6 py-3 font-bold ${amountClass} privacy-target">${sign}${currencySymbol}${t.amount.toLocaleString()}</td>
            <td class="px-6 py-3 text-right">
                <button class="edit-btn text-slate-400 hover:text-blue-500 transition p-1 mr-2" data-id="${t.id}" title="Edit">
                    <i class="ph ph-pencil-simple text-lg"></i>
                </button>
                <button class="delete-btn text-slate-400 hover:text-red-500 transition p-1" data-id="${t.id}" title="Delete">
                    <i class="ph ph-trash text-lg"></i>
                </button>
            </td>
        `;
    transactionsList.appendChild(row);
  });

  // Update Footer Total
  const footer = document.getElementById("transactions-footer");
  const totalEl = document.getElementById("transactions-total-amount");
  if (footer && totalEl) {
    footer.classList.remove("hidden");
    const isPositive = totalVisibleAmount >= 0;
    totalEl.textContent = `${isPositive ? "+" : "-"}${currencySymbol}${Math.abs(totalVisibleAmount).toLocaleString()}`;
    totalEl.className = `px-6 py-3 font-bold privacy-target ${isPositive ? "text-green-600" : "text-red-600"}`;
  }

  // Attach edit listeners
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      openEditModal(id);
    });
  });

  // Attach delete listeners
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      requestConfirmation(
        "Are you sure you want to delete this transaction?",
        async () => {
          await deleteDoc(
            doc(db, "users", currentUser.uid, "transactions", id),
          );
          showToast("Transaction deleted", "success");
        },
      );
    });
  });
}

// Re-render table when filter changes
categoryFilter.addEventListener("change", renderTable);

// --- EDIT MODAL LOGIC ---
function openEditModal(id) {
  const transaction = transactions.find((t) => t.id === id);
  if (!transaction) return;

  editingTransactionId = id;
  document.getElementById("edit-desc").value = transaction.description;
  document.getElementById("edit-amount").value = transaction.amount;
  document.getElementById("edit-type").value = transaction.type;
  document.getElementById("edit-category").value =
    transaction.category || "General";

  // Format date for input
  const date = transaction.jsDate;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  document.getElementById("edit-date").value = `${year}-${month}-${day}`;

  editModal.classList.remove("hidden");
}

const closeEditModal = () => editModal.classList.add("hidden");
closeEditModalBtn.addEventListener("click", closeEditModal);
cancelEditModalBtn.addEventListener("click", closeEditModal);

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || !editingTransactionId) return;

  const dateVal = document.getElementById("edit-date").value;
  const desc = document.getElementById("edit-desc").value;
  const amount = parseFloat(document.getElementById("edit-amount").value);
  const type = document.getElementById("edit-type").value;
  const category = document.getElementById("edit-category").value;

  const [year, month, day] = dateVal.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);

  try {
    await updateDoc(
      doc(db, "users", currentUser.uid, "transactions", editingTransactionId),
      {
        description: desc,
        amount: amount,
        type: type,
        category: category,
        date: Timestamp.fromDate(dateObj),
      },
    );
    closeEditModal();
    showToast("Transaction updated successfully", "success");
  } catch (error) {
    console.error("Error updating transaction:", error);
    showToast("Error updating transaction: " + error.message, "error");
  }
});

function renderStats() {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;

  document.getElementById("total-balance").textContent =
    `${currencySymbol}${balance.toLocaleString()}`;
  document.getElementById("total-income").textContent =
    `${currencySymbol}${income.toLocaleString()}`;
  document.getElementById("total-expense").textContent =
    `${currencySymbol}${expense.toLocaleString()}`;

  // --- Calculate Debt Stats for Dashboard ---
  const personalTransactions = transactions.filter(
    (t) => (t.category || "General") === "Personal",
  );
  const debtKeywords = [
    "debt",
    "loan",
    "borrow",
    "lend",
    "lent",
    "repay",
    "return",
    "owe",
    "owed",
    "paid back",
    "reimburse",
    "settle",
    "advance",
    "cover",
    "spot",
    "repaid",
    "paid me back",
  ];

  let iOweTotal = 0;
  let owedToMeTotal = 0;

  personalTransactions.forEach((t) => {
    const d = t.description.toLowerCase();
    if (d.includes("gift") || d.includes("allowence") || d.includes("donation"))
      return;
    if (!debtKeywords.some((k) => d.includes(k))) return;

    let isLiability = false;

    if (t.type === "income") {
      // Income: Usually "Borrowed from" (Liability) unless "repay" or "back" (Asset repayment)
      if (
        d.includes("repay") ||
        d.includes("repaid") ||
        d.includes("back") ||
        d.includes("return") ||
        d.includes("reimburse") ||
        d.includes("settle")
      ) {
        isLiability = false;
      } else {
        isLiability = true;
      }
    } else {
      // Expense: Usually "Lent to" (Asset) unless "paid" or "debt" (Liability repayment)
      if (
        d.includes("repay") ||
        d.includes("repaid") ||
        d.includes("return") ||
        d.includes("settle") ||
        d.includes("debt") ||
        d.includes("paid back")
      ) {
        isLiability = true;
      } else {
        isLiability = false;
      }
    }

    if (isLiability) {
      if (t.type === "income") iOweTotal += t.amount;
      else iOweTotal -= t.amount;
    } else {
      if (t.type === "expense") owedToMeTotal += t.amount;
      else owedToMeTotal -= t.amount;
    }
  });

  document.getElementById("dashboard-i-owe").textContent =
    `${currencySymbol}${Math.max(0, iOweTotal).toLocaleString()}`;
  document.getElementById("dashboard-owed-to-me").textContent =
    `${currencySymbol}${Math.max(0, owedToMeTotal).toLocaleString()}`;
}

// --- CHARTS (Chart.js) ---
function renderCharts() {
  // Theme Colors
  const textColor = isDarkMode ? "#cbd5e1" : "#64748b"; // slate-300 : slate-500
  const gridColor = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";

  // 1. Prepare Monthly Data
  const monthlyData = {};
  // We iterate in reverse (oldest to newest) for chart logic if array is desc,
  // but transactions are desc (newest first). Let's reverse a copy for processing.
  [...transactions].reverse().forEach((t) => {
    const monthKey = t.jsDate.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    }); // e.g., "Dec 2025"
    if (!monthlyData[monthKey])
      monthlyData[monthKey] = { income: 0, expense: 0 };
    if (t.type === "income") monthlyData[monthKey].income += t.amount;
    else monthlyData[monthKey].expense += t.amount;
  });

  const labels = Object.keys(monthlyData);
  const incomeData = labels.map((l) => monthlyData[l].income);
  const expenseData = labels.map((l) => monthlyData[l].expense);
  const balanceData = labels.map(
    (l) => monthlyData[l].income - monthlyData[l].expense,
  );

  // 2. Prepare Category Data (Top Expenses)
  const categoryData = {};

  // Filter transactions for the pie chart if a month is selected
  let categoryTransactions = transactions;
  if (activeMonthFilter) {
    categoryTransactions = transactions.filter((t) => {
      const monthKey = t.jsDate.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return monthKey === activeMonthFilter;
    });
  }

  categoryTransactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const cat = t.category || "General";
      categoryData[cat] = (categoryData[cat] || 0) + t.amount;
    });

  // Sort by value and take top 6
  const sortedCats = Object.entries(categoryData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const catLabels = sortedCats.map((i) => i[0]);
  const catValues = sortedCats.map((i) => i[1]);

  // 3. Render Monthly Chart
  const ctx1 = document.getElementById("monthlyChart").getContext("2d");
  if (monthlyChartInstance) monthlyChartInstance.destroy();

  monthlyChartInstance = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          type: "line",
          label: "Net Balance",
          data: balanceData,
          borderColor: "#3b82f6", // Blue-500
          backgroundColor: "#3b82f6",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 0, // Render on top
        },
        {
          label: "Income",
          data: incomeData,
          backgroundColor: "#4ade80",
          borderRadius: 4,
          order: 1,
        },
        {
          label: "Expense",
          data: expenseData,
          backgroundColor: "#f87171",
          borderRadius: 4,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: textColor },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor },
        },
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          activeMonthFilter = labels[index];
          renderTable();
          updateUI();
          document
            .getElementById("transactions-section")
            .scrollIntoView({ behavior: "smooth" });
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0]
          ? "pointer"
          : "default";
      },
    },
  });

  // 4. Render Category Chart
  const ctx2 = document.getElementById("categoryChart").getContext("2d");
  if (categoryChartInstance) categoryChartInstance.destroy();

  categoryChartInstance = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: catLabels,
      datasets: [
        {
          data: catValues,
          backgroundColor: [
            "#3b82f6",
            "#8b5cf6",
            "#f59e0b",
            "#ef4444",
            "#10b981",
            "#6366f1",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, color: textColor },
        },
        title: {
          display: !!activeMonthFilter,
          text: activeMonthFilter ? `Breakdown: ${activeMonthFilter}` : "",
          color: textColor,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.raw;
              const total = context.chart.data.datasets[0].data.reduce(
                (a, b) => a + b,
                0,
              );
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) + "%" : "0%";
              return `${label}: ${currencySymbol}${value.toLocaleString()} (${percentage})`;
            },
          },
        },
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const selectedCat = catLabels[index];
          categoryFilter.value = selectedCat;
          categoryFilter.dispatchEvent(new Event("change"));
          document
            .getElementById("transactions-section")
            .scrollIntoView({ behavior: "smooth" });
        }
      },
      onHover: (event, chartElement) => {
        event.native.target.style.cursor = chartElement[0]
          ? "pointer"
          : "default";
      },
    },
  });
}

function renderDebts() {
  // Filter for Personal category (contains debt/loan keywords)
  const personalTransactions = transactions.filter(
    (t) => (t.category || "General") === "Personal",
  );

  // Strict keywords to identify actual debt/loan transactions
  const debtKeywords = [
    "debt",
    "loan",
    "borrow",
    "lend",
    "lent",
    "repay",
    "return",
    "owe",
    "owed",
    "paid back",
    "reimburse",
    "settle",
    "advance",
    "cover",
    "spot",
    "repaid",
    "paid me back",
  ];

  const debtTransactions = personalTransactions.filter((t) => {
    const d = t.description.toLowerCase();
    // Explicitly exclude non-debt personal items
    if (d.includes("gift") || d.includes("allowence") || d.includes("donation"))
      return false;

    // Must contain a debt keyword
    return debtKeywords.some((k) => d.includes(k));
  });

  let iOweTotal = 0;
  let owedToMeTotal = 0;

  debtsIOweList.innerHTML = "";
  debtsOwedToMeList.innerHTML = "";
  if (debtsPeopleList) debtsPeopleList.innerHTML = "";
  const peopleStats = {};

  debtTransactions.forEach((t) => {
    const desc = t.description.toLowerCase();
    const dateStr = `${t.jsDate.getDate()}/${t.jsDate.getMonth() + 1}/${t.jsDate.getFullYear()}`;

    // Heuristic Classification
    // Liability (I Owe): Income (Borrowed) OR Expense (Paid back debt)
    // Asset (Owed To Me): Expense (Lent) OR Income (Got paid back)

    let isLiability = false;

    if (t.type === "income") {
      // Income: Usually "Borrowed from" (Liability) unless "repay" or "back" (Asset repayment)
      if (
        desc.includes("repay") ||
        desc.includes("repaid") ||
        desc.includes("back") ||
        desc.includes("return") ||
        desc.includes("reimburse") ||
        desc.includes("settle")
      ) {
        isLiability = false; // Asset
      } else {
        isLiability = true; // Liability (Default for income in Personal: I got money)
      }
    } else {
      // Expense: Usually "Lent to" (Asset) unless "paid" or "debt" (Liability repayment)
      if (
        desc.includes("repay") ||
        desc.includes("repaid") ||
        desc.includes("return") ||
        desc.includes("settle") ||
        desc.includes("debt") ||
        (desc.includes("paid") && desc.includes("back"))
      ) {
        isLiability = true; // Liability
      } else {
        isLiability = false; // Asset (Default for expense in Personal: I gave money)
      }
    }

    // --- Person Grouping Logic ---
    const person = extractPersonName(t.description);
    if (!peopleStats[person]) peopleStats[person] = 0;

    // Calculate Net Impact on Balance
    // Positive = They owe me (Asset)
    // Negative = I owe them (Liability)
    if (isLiability) {
      // Liability Context:
      // Income (Borrowed) -> I owe more (Negative impact)
      // Expense (Repaid) -> I owe less (Positive impact)
      peopleStats[person] += t.type === "income" ? -t.amount : t.amount;
    } else {
      // Asset Context:
      // Expense (Lent) -> They owe more (Positive impact)
      // Income (Repaid) -> They owe less (Negative impact)
      peopleStats[person] += t.type === "expense" ? t.amount : -t.amount;
    }

    const row = document.createElement("tr");
    row.className =
      "border-b border-white/20 dark:border-white/10 last:border-0";
    row.innerHTML = `
      <td class="px-6 py-3 whitespace-nowrap">${dateStr}</td>
      <td class="px-6 py-3 font-medium text-slate-800 dark:text-white">${t.description}</td>
      <td class="px-6 py-3 text-right font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"} privacy-target">
        ${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toLocaleString()}
      </td>
    `;

    if (isLiability) {
      debtsIOweList.appendChild(row);
      // If income, I borrowed (+Debt). If expense, I paid (-Debt).
      // For the total "Outstanding", we might just sum the net.
      // But for a simple list, let's just sum the amounts to show activity.
      // To show "Current Debt", we need Income - Expense.
      if (t.type === "income") iOweTotal += t.amount;
      else iOweTotal -= t.amount;
    } else {
      debtsOwedToMeList.appendChild(row);
      // If expense, I lent (+Asset). If income, I got back (-Asset).
      if (t.type === "expense") owedToMeTotal += t.amount;
      else owedToMeTotal -= t.amount;
    }
  });

  document.getElementById("total-i-owe").textContent =
    `${currencySymbol}${Math.max(0, iOweTotal).toLocaleString()}`;
  document.getElementById("total-owed-to-me").textContent =
    `${currencySymbol}${Math.max(0, owedToMeTotal).toLocaleString()}`;

  // Render People Summary
  Object.entries(peopleStats)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])) // Sort by magnitude
    .forEach(([person, balance]) => {
      if (Math.abs(balance) < 0.01) return; // Hide settled/zero balances
      if (!debtsPeopleList) return;

      const isOwedToMe = balance > 0;
      const colorClass = isOwedToMe ? "text-green-600" : "text-red-600";
      const statusText = isOwedToMe ? "Owes You" : "You Owe";
      const icon = isOwedToMe
        ? '<i class="ph ph-arrow-right text-green-500"></i>'
        : '<i class="ph ph-arrow-left text-red-500"></i>';

      const row = document.createElement("tr");
      row.className =
        "border-b border-white/20 dark:border-white/10 last:border-0 hover:bg-white/5 transition";
      row.innerHTML = `
        <td class="px-6 py-3 font-medium text-slate-800 dark:text-white">${person}</td>
        <td class="px-6 py-3 text-right font-bold ${colorClass} privacy-target">
            ${currencySymbol}${Math.abs(balance).toLocaleString()}
        </td>
        <td class="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider ${colorClass}">
            <div class="flex items-center justify-end gap-1">
                ${statusText} ${icon}
            </div>
        </td>
    `;
      debtsPeopleList.appendChild(row);
    });
}

// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

  // Styles based on type
  const styles = {
    success: "glass text-slate-800 dark:text-white border-l-4 border-green-500",
    error: "glass text-slate-800 dark:text-white border-l-4 border-red-500",
    info: "glass text-slate-800 dark:text-white border-l-4 border-blue-500",
  };
  const icon =
    type === "success"
      ? '<i class="ph ph-check-circle text-xl text-green-400"></i>'
      : type === "error"
        ? '<i class="ph ph-warning-circle text-xl text-white"></i>'
        : '<i class="ph ph-info text-xl text-white"></i>';

  toast.className = `${styles[type]} px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transform transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto min-w-[300px]`;
  toast.innerHTML = `${icon}<p class="font-medium text-sm">${message}</p>`;

  container.appendChild(toast);

  // Animation
  requestAnimationFrame(() =>
    toast.classList.remove("translate-y-10", "opacity-0"),
  );
  setTimeout(() => {
    toast.classList.add("translate-y-10", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- CATEGORY DETECTION HELPER ---
function detectCategory(description) {
  const desc = description.toLowerCase();

  // Income
  if (
    desc.includes("salary") ||
    desc.includes("income") ||
    desc.includes("deposit") ||
    desc.includes("freelance") ||
    desc.includes("dividend") ||
    desc.includes("interest") ||
    desc.includes("refund")
  )
    return "Income";

  if (
  // Housing
  if (
    desc.includes("rent") ||
    desc.includes("mortgage") ||
    desc.includes("house") ||
    desc.includes("apartment") ||
    desc.includes("maintenance") ||
    desc.includes("furniture") ||
    desc.includes("decor") ||
    desc.includes("plumber") ||
    desc.includes("electrician")
  )
    return "Housing";

  // Transport
  if (
    desc.includes("uber") ||
    desc.includes("taxi") ||
    desc.includes("bolt") ||
    desc.includes("lyft") ||
    desc.includes("bus") ||
    desc.includes("train") ||
    desc.includes("metro") ||
    desc.includes("flight") ||
    desc.includes("plane") ||
    desc.includes("fuel") ||
    desc.includes("gas") ||
    desc.includes("parking") ||
    desc.includes("car") ||
    desc.includes("mechanic") ||
    desc.includes("service") ||
    desc.includes("motor") ||
    desc.includes("bike") ||
    desc.includes("oil") ||
    desc.includes("tire") ||
    desc.includes("dolab") ||
    desc.includes("brake") ||
    desc.includes("wheel") ||
    desc.includes("fix") ||
    desc.includes("airport") ||
    desc.includes("keys")
  )
    return "Transport";

  // Utilities
  if (
    desc.includes("bill") ||
    desc.includes("internet") ||
    desc.includes("electricity") ||
    desc.includes("water") ||
    desc.includes("phone") ||
    desc.includes("mobile") ||
    desc.includes("wifi") ||
    desc.includes("recharge") ||
    desc.includes("alfa") ||
    desc.includes("mtc") ||
    desc.includes("touch")
    desc.includes("ogero") ||
    desc.includes("subscription") ||
    desc.includes("sim")
  )
    return "Utilities";

  // Health
  if (
    desc.includes("doctor") ||
    desc.includes("pharmacy") ||
    desc.includes("gym") ||
    desc.includes("fitness") ||
    desc.includes("workout") ||
    desc.includes("protein") ||
    desc.includes("supplement") ||
    desc.includes("med") ||
    desc.includes("medicine") ||
    desc.includes("pill") ||
    desc.includes("hospital") ||
    desc.includes("dentist") ||
    desc.includes("clinic") ||
    desc.includes("test")
    desc.includes("blood") ||
    desc.includes("xray")
  )
    return "Health";

  // Education
  if (
    desc.includes("coursera") ||
    desc.includes("udemy") ||
    desc.includes("school") ||
    desc.includes("university") ||
    desc.includes("college") ||
    desc.includes("course") ||
    desc.includes("book") ||
    desc.includes("paper") ||
    desc.includes("pen") ||
    desc.includes("pencil") ||
    desc.includes("stationery") ||
    desc.includes("tuition")
  )
    return "Education";

  // Entertainment
  if (
    desc.includes("movie") ||
    desc.includes("cinema") ||
    desc.includes("game") ||
    desc.includes("steam") ||
    desc.includes("playstation") ||
    desc.includes("xbox") ||
    desc.includes("nintendo") ||
    desc.includes("netflix") ||
    desc.includes("spotify") ||
    desc.includes("music") ||
    desc.includes("concert") ||
    desc.includes("event") ||
    desc.includes("ticket") ||
    desc.includes("youtube") ||
    desc.includes("hulu") ||
    desc.includes("disney") ||
    desc.includes("argile") ||
    desc.includes("shisha") ||
    desc.includes("hookah") ||
    desc.includes("bowling") ||
    desc.includes("party") ||
    desc.includes("nightclub") ||
    desc.includes("club") ||
    desc.includes("bar") ||
    desc.includes("pub") ||
    desc.includes("billiard") ||
    desc.includes("vape") ||
    desc.includes("smoke") ||
    desc.includes("cigar") ||
    desc.includes("cigarette") ||
    desc.includes("iqus") ||
    desc.includes("m3sl") ||
    desc.includes("shahid") ||
    desc.includes("itunes") ||
    desc.includes("app") ||
    desc.includes("ps4")
    desc.includes("ps5")
  )
    return "Entertainment";

  // Food
  if (
    desc.includes("food") ||
    desc.includes("grocery") ||
    desc.includes("supermarket") ||
    desc.includes("market") ||
    desc.includes("spinneys") ||
    desc.includes("carrefour") ||
    desc.includes("lunch") ||
    desc.includes("dinner") ||
    desc.includes("coffee") ||
    desc.includes("burger") ||
    desc.includes("pizza") ||
    desc.includes("sushi") ||
    desc.includes("shawarma") ||
    desc.includes("taouk") ||
    desc.includes("sandwich") ||
    desc.includes("restaurant") ||
    desc.includes("delivery") ||
    desc.includes("toters") ||
    desc.includes("snack") ||
    desc.includes("drink") ||
    desc.includes("water") ||
    desc.includes("juice") ||
    desc.includes("soda") ||
    desc.includes("pepsi") ||
    desc.includes("coke") ||
    desc.includes("cocktail") ||
    desc.includes("starbucs") ||
    desc.includes("starbucks") ||
    desc.includes("breakfast") ||
    desc.includes("cake") ||
    desc.includes("dessert") ||
    desc.includes("chocolate") ||
    desc.includes("ice cream") ||
    desc.includes("donut") ||
    desc.includes("dkan") ||
    desc.includes("cafe")
  )
    return "Food";

  // Shopping
  if (
    desc.includes("amazon") ||
    desc.includes("aliexpress") ||
    desc.includes("shein") ||
    desc.includes("zara") ||
    desc.includes("h&m") ||
    desc.includes("nike") ||
    desc.includes("adidas") ||
    desc.includes("shop") ||
    desc.includes("store") ||
    desc.includes("mall") ||
    desc.includes("clothes") ||
    desc.includes("backpack") ||
    desc.includes("charger") ||
    desc.includes("macbook") ||
    desc.includes("iphone") ||
    desc.includes("samsung") ||
    desc.includes("phone") ||
    desc.includes("electronics") ||
    desc.includes("airtag") ||
    desc.includes("cap") ||
    desc.includes("wallet") ||
    desc.includes("shoe") ||
    desc.includes("tshirt") ||
    desc.includes("shirt") ||
    desc.includes("pants") ||
    desc.includes("jeans") ||
    desc.includes("suit") ||
    desc.includes("pajama") ||
    desc.includes("bag") ||
    desc.includes("hair") ||
    desc.includes("cut") ||
    desc.includes("barber") ||
    desc.includes("salon") ||
    desc.includes("shampoo") ||
    desc.includes("shave") ||
    desc.includes("tooth") ||
    desc.includes("soap") ||
    desc.includes("cream") ||
    desc.includes("perfume") ||
    desc.includes("cologne") ||
    desc.includes("makeup") ||
    desc.includes("deodorant")
  )
    return "Shopping";

  // Personal
  if (
    desc.includes("gift") ||
    desc.includes("donation") ||
    desc.includes("charity") ||
    desc.includes("family") ||
    desc.includes("mom") ||
    desc.includes("dad") ||
    desc.includes("brother") ||
    desc.includes("sister") ||
    desc.includes("friend") ||
    desc.includes("debt") ||
    desc.includes("loan") ||
    desc.includes("borrow") ||
    desc.includes("lend") ||
    desc.includes("lent") ||
    desc.includes("repay") ||
    desc.includes("owe") ||
    desc.includes("crypto") ||
    desc.includes("bitcoin") ||
    desc.includes("usdt") ||
    desc.includes("binance") ||
    desc.includes("trading") ||
    desc.includes("stock") ||
    desc.includes("invest") ||
    desc.includes("allowence") ||
    desc.includes("paid back") ||
    desc.includes("return") ||
    desc.includes("reimburse") ||
    desc.includes("settle") ||
    desc.includes("advance") ||
    desc.includes("cover") ||
    desc.includes("spot") ||
    desc.includes("repaid") ||
    desc.includes("paid me back")
  )
    return "Personal";

  return "General";
}

// --- HELPER: Extract Person Name ---
function extractPersonName(description) {
  const lower = description.toLowerCase();
  const ignore = [
    "lent",
    "lend",
    "loan",
    "borrow",
    "borrowed",
    "from",
    "to",
    "repay",
    "repaid",
    "paid",
    "pay",
    "back",
    "return",
    "returned",
    "debt",
    "settle",
    "settled",
    "advance",
    "cover",
    "spot",
    "money",
    "cash",
    "transfer",
    "sent",
    "received",
    "get",
    "got",
    "of",
    "for",
    "the",
    "a",
    "an",
    "in",
    "with",
    "via",
    "by",
    "me",
    "my",
    "i",
    "him",
    "her",
    "it",
    "them",
    "us",
    "we",
    "yesterday",
    "today",
    "tomorrow",
    "last",
    "week",
    "month",
    "year",
    "dollar",
    "usd",
    "lbp",
    "euro",
    "amount",
  ];

  // Remove numbers and currency symbols
  let clean = lower.replace(/[0-9$€£¥]/g, " ").trim();

  // Split and filter out keywords
  const words = clean
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ignore.includes(w));

  if (words.length === 0) return "Unknown";

  // Capitalize first letter of each word
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// --- BULK PARSER LOGIC ---
function parseTransactionString(text) {
  let desc = text.trim();
  let amount = 0;
  let date = new Date();

  // 1. Extract Date (DD/MM/YYYY or "Yesterday", "Today")
  const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/;
  const dateMatch = desc.match(dateRegex);

  if (dateMatch) {
    const year = dateMatch[3]
      ? dateMatch[3].length === 2
        ? "20" + dateMatch[3]
        : dateMatch[3]
      : new Date().getFullYear();
    date = new Date(year, dateMatch[2] - 1, dateMatch[1]);
    desc = desc.replace(dateMatch[0], "").trim();
  } else {
    const lower = desc.toLowerCase();
    if (lower.includes("yesterday")) {
      date.setDate(date.getDate() - 1);
      desc = desc.replace(/yesterday/i, "").trim();
    } else if (lower.includes("today")) {
      desc = desc.replace(/today/i, "").trim();
    }
  }

  // 2. Extract Amount
  // Look for numbers with currency or standalone numbers
  // Regex: Optional currency, Number (int or float), Optional currency
  const amountMatch = desc.match(/[\$€£¥]?\s*(\d+(?:\.\d{1,2})?)\s*[\$€£¥]?/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
    // Remove amount from description
    desc = desc.replace(amountMatch[0], "").trim();
  }

  // 3. Clean Description
  desc = desc.replace(/\s+/g, " ").trim();
  if (!desc) desc = "Unknown Transaction";

  // 4. Detect Type & Category
  const lowerDesc = desc.toLowerCase();
  let isIncome =
    lowerDesc.includes("income") ||
    lowerDesc.includes("salary") ||
    lowerDesc.includes("deposit");

  // Smart Debt/Personal Logic
  if (
    lowerDesc.includes("borrow") &&
    !lowerDesc.includes("repay") &&
    !lowerDesc.includes("paid")
  ) {
    isIncome = true;
  }

  if (
    lowerDesc.includes("paid me back") ||
    lowerDesc.includes("repaid me") ||
    (lowerDesc.includes("returned") && lowerDesc.includes("me"))
  ) {
    isIncome = true;
  }

  const category = detectCategory(desc);

  return {
    amount,
    description: desc,
    category: isIncome ? "Income" : category,
    type: isIncome ? "income" : "expense",
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.now(),
  };
}

function parseBulkText(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const results = [];

  lines.forEach((line) => {
    const parsed = parseTransactionString(line);
    if (parsed.amount > 0) {
      results.push(parsed);
    }
  });
  return results;
}

// --- MODAL HANDLERS ---
openModalBtn.addEventListener("click", () =>
  bulkModal.classList.remove("hidden"),
);
const closeModal = () => bulkModal.classList.add("hidden");
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

// --- SINGLE ENTRY MODAL HANDLERS ---
openSingleModalBtn.addEventListener("click", () => {
  singleModal.classList.remove("hidden");
  document.getElementById("single-date").valueAsDate = new Date();
});

const closeSingleModal = () => singleModal.classList.add("hidden");
closeSingleModalBtn.addEventListener("click", closeSingleModal);
cancelSingleModalBtn.addEventListener("click", closeSingleModal);

// Auto-detect category on input
singleDescInput.addEventListener("input", () => {
  const category = detectCategory(singleDescInput.value);
  singleCategory.value = category;

  // Auto-detect Type
  const desc = singleDescInput.value.toLowerCase();
  const typeSelect = document.getElementById("single-type");

  // "Borrow" usually means Income (receiving money), unless it's "repaying a borrow" (handled by repay check)
  if (desc.includes("borrow") && !desc.includes("repay")) {
    typeSelect.value = "income";
  } else if (
    desc.includes("lent") ||
    desc.includes("repay") ||
    desc.includes("paid")
  ) {
    typeSelect.value = "expense";
  } else if (desc.includes("paid me back") || desc.includes("repaid me")) {
    typeSelect.value = "income";
  }
});

// --- CONFIRMATION MODAL LOGIC ---
let pendingConfirmAction = null;

const closeConfirmModal = () => {
  confirmModal.classList.add("hidden");
  pendingConfirmAction = null;
};

cancelConfirmBtn.addEventListener("click", closeConfirmModal);

confirmActionBtn.addEventListener("click", () => {
  if (pendingConfirmAction) pendingConfirmAction();
  closeConfirmModal();
});

function requestConfirmation(message, action) {
  confirmMessage.textContent = message;
  pendingConfirmAction = action;
  confirmModal.classList.remove("hidden");
}

singleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) {
    alert("Please log in to add transactions.");
    return;
  }

  const dateVal = document.getElementById("single-date").value;
  const desc = document.getElementById("single-desc").value;
  const amount = parseFloat(document.getElementById("single-amount").value);
  const type = document.getElementById("single-type").value;
  const category = document.getElementById("single-category").value;

  if (!dateVal || !desc || isNaN(amount)) return;

  // Create local date object to match bulk parser behavior
  const [year, month, day] = dateVal.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);

  const submitBtn = singleForm.querySelector("button[type='submit']");
  const originalBtnContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';

  try {
    const docRef = await addDoc(
      collection(db, "users", currentUser.uid, "transactions"),
      {
        description: desc,
        amount: amount,
        category: category,
        type: type,
        date: Timestamp.fromDate(dateObj),
        createdAt: Timestamp.now(),
      },
    );

    // Enable undo for single transaction
    lastBulkBatchIds = [docRef.id];
    revertBtn.innerHTML =
      '<i class="ph ph-arrow-counter-clockwise text-lg"></i> Undo Transaction';
    revertBtn.classList.remove("hidden");

    singleForm.reset();
    closeSingleModal();
    showToast("Transaction added successfully", "success");
  } catch (error) {
    console.error("Error adding document: ", error);
    showToast("Error saving transaction: " + error.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnContent;
  }
});

processBtn.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Please log in to add transactions.");
    return;
  }

  const text = bulkInput.value;
  if (!text) return;

  processBtn.disabled = true;
  processBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...';

  try {
    const data = parseBulkText(text);

    if (data.length === 0) {
      showToast(
        "No valid transactions found. Please check the format.",
        "error",
      );
      processBtn.disabled = false;
      processBtn.innerHTML = '<i class="ph ph-check"></i> Process & Save';
      return;
    }

    // Use WriteBatch for atomic updates (better for bulk operations)
    const batch = writeBatch(db);
    const currentBatchIds = [];
    data.forEach((item) => {
      const newDocRef = doc(
        collection(db, "users", currentUser.uid, "transactions"),
      );
      batch.set(newDocRef, item);
      currentBatchIds.push(newDocRef.id);
    });

    // Add timeout to prevent hanging indefinitely
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Request timed out. Check your internet connection or Firestore Rules.",
            ),
          ),
        10000,
      ),
    );
    await Promise.race([batch.commit(), timeout]);

    // Store IDs for revert functionality
    lastBulkBatchIds = currentBatchIds;
    revertBtn.innerHTML =
      '<i class="ph ph-arrow-counter-clockwise text-lg"></i> Undo Import';
    revertBtn.classList.remove("hidden");

    bulkInput.value = "";
    closeModal();
    showToast(`${data.length} transactions imported successfully`, "success");
  } catch (error) {
    console.error("Error adding documents: ", error);
    showToast("Error saving data: " + error.message, "error");
  } finally {
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="ph ph-check"></i> Process & Save';
  }
});

// --- REVERT LOGIC ---
revertBtn.addEventListener("click", () => {
  if (!lastBulkBatchIds.length) return;

  const isSingle = lastBulkBatchIds.length === 1;
  const message = isSingle
    ? "Undo last transaction?"
    : `Undo import of ${lastBulkBatchIds.length} transactions?`;

  requestConfirmation(message, async () => {
    revertBtn.disabled = true;
    revertBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Reverting...';

    try {
      const batch = writeBatch(db);
      lastBulkBatchIds.forEach((id) => {
        batch.delete(doc(db, "users", currentUser.uid, "transactions", id));
      });
      await batch.commit();

      lastBulkBatchIds = [];
      revertBtn.classList.add("hidden");
      showToast(
        isSingle
          ? "Transaction reverted successfully"
          : "Bulk import reverted successfully",
        "success",
      );
    } catch (error) {
      console.error("Revert failed", error);
      showToast("Failed to revert: " + error.message, "error");
    } finally {
      revertBtn.disabled = false;
      const label =
        lastBulkBatchIds.length === 1 ? "Undo Transaction" : "Undo Import";
      revertBtn.innerHTML = `<i class="ph ph-arrow-counter-clockwise text-lg"></i> ${label}`;
    }
  });
});

// --- DELETE ALL LOGIC ---
deleteAllBtn.addEventListener("click", () => {
  if (transactions.length === 0) {
    showToast("No data to delete", "info");
    return;
  }
  requestConfirmation(
    `Permanently delete ALL ${transactions.length} transactions? This cannot be undone.`,
    async () => {
      await deleteBatchTransactions(transactions);
      showToast("All data deleted successfully", "success");
    },
  );
});

async function deleteBatchTransactions(list) {
  const batchSize = 500; // Firestore limit
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = list.slice(i, i + batchSize);
    chunk.forEach((t) => {
      batch.delete(doc(db, "users", currentUser.uid, "transactions", t.id));
    });
    await batch.commit();
  }
}

// Initialize theme on load
applyTheme();
updateSortIcons();
