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
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
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

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userNameDisplay = document.getElementById("user-name");
const userEmailDisplay = document.getElementById("user-email");
const transactionsList = document.getElementById("transactions-list");
const bulkModal = document.getElementById("bulk-modal");
const openModalBtn = document.getElementById("open-modal-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelModalBtn = document.getElementById("cancel-modal-btn");
const processBtn = document.getElementById("process-btn");
const bulkInput = document.getElementById("bulk-input");

// --- AUTHENTICATION ---
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed", error);
    alert("Login failed: " + error.message);
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userNameDisplay.textContent = user.displayName;
    userEmailDisplay.textContent = user.email;
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadTransactions();
  } else {
    currentUser = null;
    loginScreen.classList.remove("hidden");
    dashboard.classList.add("hidden");
    // Clear data from memory
    transactions = [];
  }
});

// --- DATABASE LISTENER ---
let unsubscribe = null;

function loadTransactions() {
  if (unsubscribe) unsubscribe(); // Unsubscribe from previous listener if exists

  const q = query(
    collection(db, "transactions"),
    where("uid", "==", currentUser.uid),
    orderBy("date", "desc"),
  );

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      transactions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        jsDate: doc.data().date.toDate(), // Convert Firestore Timestamp to JS Date
      }));

      updateUI();
    },
    (error) => {
      console.error("Error fetching transactions:", error);
    },
  );
}

// --- UI UPDATES ---
function updateUI() {
  renderTable();
  renderStats();
  renderCharts();
}

function renderTable() {
  transactionsList.innerHTML = "";

  if (transactions.length === 0) {
    transactionsList.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-400">No transactions found. Add some!</td></tr>`;
    return;
  }

  // Show top 50
  transactions.slice(0, 50).forEach((t) => {
    const dateStr = t.jsDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const isIncome = t.type === "income";
    const amountClass = isIncome ? "text-green-600" : "text-red-600";
    const sign = isIncome ? "+" : "-";

    const row = document.createElement("tr");
    row.className =
      "hover:bg-slate-50 transition border-b border-slate-100 last:border-0";
    row.innerHTML = `
            <td class="px-6 py-3 whitespace-nowrap">${dateStr}</td>
            <td class="px-6 py-3 font-medium text-slate-800">${t.description}</td>
            <td class="px-6 py-3">
                <span class="px-2 py-1 rounded text-xs font-semibold ${isIncome ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}">
                    ${t.type.toUpperCase()}
                </span>
            </td>
            <td class="px-6 py-3 font-bold ${amountClass}">${sign}$${t.amount.toLocaleString()}</td>
            <td class="px-6 py-3 text-right">
                <button class="delete-btn text-slate-400 hover:text-red-500 transition p-1" data-id="${t.id}" title="Delete">
                    <i class="ph ph-trash text-lg"></i>
                </button>
            </td>
        `;
    transactionsList.appendChild(row);
  });

  // Attach delete listeners
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      if (confirm("Are you sure you want to delete this transaction?")) {
        const id = e.currentTarget.getAttribute("data-id");
        await deleteDoc(doc(db, "transactions", id));
      }
    });
  });
}

function renderStats() {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;

  document.getElementById("total-balance").textContent =
    `$${balance.toLocaleString()}`;
  document.getElementById("total-income").textContent =
    `$${income.toLocaleString()}`;
  document.getElementById("total-expense").textContent =
    `$${expense.toLocaleString()}`;
}

// --- CHARTS (Chart.js) ---
function renderCharts() {
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

  // 2. Prepare Category Data (Top Expenses)
  const categoryData = {};
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const cat = t.description; // Using description as category for now
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
          label: "Income",
          data: incomeData,
          backgroundColor: "#4ade80",
          borderRadius: 4,
        },
        {
          label: "Expense",
          data: expenseData,
          backgroundColor: "#f87171",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
        x: { grid: { display: false } },
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
      plugins: { legend: { position: "right", labels: { boxWidth: 12 } } },
    },
  });
}

// --- BULK PARSER LOGIC ---
function parseBulkText(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const results = [];
  let currentDate = new Date();

  // Regex: DD/MM/YYYY
  const dateRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  // Regex: Number$ Description (e.g., "600$ income")
  const transRegex = /^(\d+)\$\s+(.*)$/;
  // Regex: Number$ Description (e.g., "600$ income" or "10.50$ lunch")
  const transRegex = /^(\d+(?:\.\d+)?)\$\s+(.*)$/;

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Check Date
    const dateMatch = trimmed.match(dateRegex);
    if (dateMatch) {
      // Create date object (Month is 0-indexed in JS)
      currentDate = new Date(dateMatch[3], dateMatch[2] - 1, dateMatch[1]);
      return;
    }

    // Check Transaction
    const transMatch = trimmed.match(transRegex);
    if (transMatch) {
      const amount = parseFloat(transMatch[1]);
      const desc = transMatch[2].trim();
      const isIncome =
        desc.toLowerCase().includes("income") ||
        desc.toLowerCase().includes("salary");

      results.push({
        amount: amount,
        description: desc,
        type: isIncome ? "income" : "expense",
        date: Timestamp.fromDate(currentDate), // Convert to Firestore Timestamp
        uid: currentUser.uid,
        createdAt: Timestamp.now(),
      });
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

processBtn.addEventListener("click", async () => {
  const text = bulkInput.value;
  if (!text) return;

  processBtn.disabled = true;
  processBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...';

  try {
    const data = parseBulkText(text);

    if (data.length === 0) {
      alert("No valid transactions found. Please check the format.");
      processBtn.disabled = false;
      processBtn.innerHTML = '<i class="ph ph-check"></i> Process & Save';
      return;
    }

    // Batch write using Promise.all
    const promises = data.map((item) =>
      addDoc(collection(db, "transactions"), item),
    );
    await Promise.all(promises);

    bulkInput.value = "";
    closeModal();
  } catch (error) {
    console.error("Error adding documents: ", error);
    alert("Error saving data: " + error.message);
  } finally {
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="ph ph-check"></i> Process & Save';
  }
});
