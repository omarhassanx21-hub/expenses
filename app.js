// --- IMPORTS ---
import {
  auth,
  db,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
  setDoc,
  writeBatch,
  updateDoc,
} from "./firebase.js";
import { state } from "./state.js";
import { detectCategory, parseBulkText } from "./utils.js";
import { renderCharts } from "./charts.js";
import {
  renderTable,
  renderStats,
  renderDebts,
  showToast,
  applyTheme,
  updateSortIcons,
} from "./ui.js";

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
    state.currentUser = user;
    userNameDisplay.textContent = user.displayName;
    userEmailDisplay.textContent = user.email;
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");

    // Fetch user settings from DB
    const userDocRef = doc(db, "users", state.currentUser.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.currency) state.currencySymbol = data.currency;
        if (data.theme) state.isDarkMode = data.theme === "dark";

        // Sync local storage
        localStorage.setItem("currency", state.currencySymbol);
        localStorage.setItem("theme", state.isDarkMode ? "dark" : "light");
      }
    } catch (e) {
      console.error("Error fetching user settings:", e);
    }

    // Apply settings to UI controls
    currencySelect.value = state.currencySymbol;
    applyTheme();

    // Create or update user document in Firestore (for settings)
    await setDoc(
      userDocRef,
      {
        email: user.email,
        displayName: user.displayName,
        lastLogin: Timestamp.now(),
        currency: state.currencySymbol,
        theme: state.isDarkMode ? "dark" : "light",
      },
      { merge: true },
    );

    loadTransactions();
  } else {
    state.currentUser = null;
    loginScreen.classList.remove("hidden");
    dashboard.classList.add("hidden");
    // Clear data from memory
    state.transactions = [];
    state.lastBulkBatchIds = [];
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
  currencySelect.value = state.currencySymbol;
});

closeSettingsBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

currencySelect.addEventListener("change", async (e) => {
  state.currencySymbol = e.target.value;
  localStorage.setItem("currency", state.currencySymbol);
  updateUI();

  if (state.currentUser) {
    await setDoc(
      doc(db, "users", state.currentUser.uid),
      { currency: state.currencySymbol },
      { merge: true },
    );
  }
});

themeToggle.addEventListener("click", async () => {
  state.isDarkMode = !state.isDarkMode;
  localStorage.setItem("theme", state.isDarkMode ? "dark" : "light");
  applyTheme();
  renderCharts();

  if (state.currentUser) {
    await setDoc(
      doc(db, "users", state.currentUser.uid),
      { theme: state.isDarkMode ? "dark" : "light" },
      { merge: true },
    );
  }
});

// --- SORTING LOGIC ---
document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const column = th.getAttribute("data-sort");
    if (state.currentSort.column === column) {
      state.currentSort.direction =
        state.currentSort.direction === "asc" ? "desc" : "asc";
    } else {
      state.currentSort.column = column;
      // Default sort direction based on column type
      state.currentSort.direction = ["date", "amount"].includes(column)
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
    collection(db, "users", state.currentUser.uid, "transactions"),
    orderBy("date", "desc"),
  );

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      state.transactions = snapshot.docs.map((doc) => {
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

// Re-render table when filter changes
categoryFilter.addEventListener("change", renderTable);

// --- CUSTOM EVENT LISTENERS (From UI) ---
document.addEventListener("delete-transaction", (e) => {
  const id = e.detail;
  requestConfirmation(
    "Are you sure you want to delete this transaction?",
    async () => {
      await deleteDoc(
        doc(db, "users", state.currentUser.uid, "transactions", id),
      );
      showToast("Transaction deleted", "success");
    },
  );
});

document.addEventListener("edit-transaction", (e) => {
  openEditModal(e.detail);
});

document.addEventListener("filter-month", (e) => {
  state.activeMonthFilter = e.detail;
  renderTable();
  updateUI();
  document
    .getElementById("transactions-section")
    .scrollIntoView({ behavior: "smooth" });
});

document.addEventListener("filter-category", (e) => {
  categoryFilter.value = e.detail;
  categoryFilter.dispatchEvent(new Event("change"));
  document
    .getElementById("transactions-section")
    .scrollIntoView({ behavior: "smooth" });
});

document.addEventListener("clear-month-filter", () => {
  state.activeMonthFilter = null;
  renderTable();
  updateUI();
});

document.addEventListener("delete-month", () => {
  const monthTrans = state.transactions.filter((t) => {
    const monthKey = t.jsDate.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
    return monthKey === state.activeMonthFilter;
  });

  if (monthTrans.length === 0) return;

  requestConfirmation(
    `Delete all ${monthTrans.length} transactions for ${state.activeMonthFilter}?`,
    async () => {
      await deleteBatchTransactions(monthTrans);
      state.activeMonthFilter = null;
      showToast("Month deleted successfully", "success");
    },
  );
});

// --- EDIT MODAL LOGIC ---
function openEditModal(id) {
  const transaction = state.transactions.find((t) => t.id === id);
  if (!transaction) return;

  state.editingTransactionId = id;
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
  if (!state.currentUser || !state.editingTransactionId) return;

  const dateVal = document.getElementById("edit-date").value;
  const desc = document.getElementById("edit-desc").value;
  const amount = parseFloat(document.getElementById("edit-amount").value);
  const type = document.getElementById("edit-type").value;
  const category = document.getElementById("edit-category").value;

  const [year, month, day] = dateVal.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);

  try {
    await updateDoc(
      doc(
        db,
        "users",
        state.currentUser.uid,
        "transactions",
        state.editingTransactionId,
      ),
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
  if (!state.currentUser) {
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
      collection(db, "users", state.currentUser.uid, "transactions"),
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
    state.lastBulkBatchIds = [docRef.id];
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
  if (!state.currentUser) {
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
        collection(db, "users", state.currentUser.uid, "transactions"),
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
    state.lastBulkBatchIds = currentBatchIds;
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
  if (!state.lastBulkBatchIds.length) return;

  const isSingle = state.lastBulkBatchIds.length === 1;
  const message = isSingle
    ? "Undo last transaction?"
    : `Undo import of ${state.lastBulkBatchIds.length} transactions?`;

  requestConfirmation(message, async () => {
    revertBtn.disabled = true;
    revertBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Reverting...';

    try {
      const batch = writeBatch(db);
      state.lastBulkBatchIds.forEach((id) => {
        batch.delete(
          doc(db, "users", state.currentUser.uid, "transactions", id),
        );
      });
      await batch.commit();

      state.lastBulkBatchIds = [];
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
        state.lastBulkBatchIds.length === 1
          ? "Undo Transaction"
          : "Undo Import";
      revertBtn.innerHTML = `<i class="ph ph-arrow-counter-clockwise text-lg"></i> ${label}`;
    }
  });
});

// --- DELETE ALL LOGIC ---
deleteAllBtn.addEventListener("click", () => {
  if (state.transactions.length === 0) {
    showToast("No data to delete", "info");
    return;
  }
  requestConfirmation(
    `Permanently delete ALL ${state.transactions.length} transactions? This cannot be undone.`,
    async () => {
      await deleteBatchTransactions(state.transactions);
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
      batch.delete(
        doc(db, "users", state.currentUser.uid, "transactions", t.id),
      );
    });
    await batch.commit();
  }
}

// Initialize theme on load
applyTheme();
updateSortIcons();
