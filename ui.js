import { state } from "./state.js";
import { extractPersonName } from "./utils.js";

export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

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
  requestAnimationFrame(() =>
    toast.classList.remove("translate-y-10", "opacity-0"),
  );
  setTimeout(() => {
    toast.classList.add("translate-y-10", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function applyTheme() {
  if (state.isDarkMode) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function updateSortIcons() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const icon = th.querySelector("i");
    const column = th.getAttribute("data-sort");

    if (column === state.currentSort.column) {
      icon.className =
        state.currentSort.direction === "asc"
          ? "ph ph-caret-up"
          : "ph ph-caret-down";
      icon.classList.add("text-blue-600", "dark:text-blue-400");
      icon.classList.remove("text-slate-400");
    } else {
      icon.className = "ph ph-caret-up-down";
      icon.classList.remove("text-blue-600", "dark:text-blue-400");
      icon.classList.add("text-slate-400");
    }
  });
}

// --- HELPER: Centralized Debt Logic ---
function calculateDebts(transactions) {
  const debtKeywords = [
    "debt",
    "loan",
    "borrow",
    "lend",
    "lent",
    "repay",
    "owe",
    "owed",
    "paid back",
    "reimburse",
    "settle",
    "repaid",
    "paid me back",
  ];

  const debtTransactions = transactions.filter((t) => {
    const d = t.description.toLowerCase();
    const c = t.category || "General";

    // 1. Exclude explicit non-debts
    if (d.includes("gift") || d.includes("allowence") || d.includes("donation"))
      return false;

    // 2. Include if Category is Personal OR Description contains a keyword
    const isPersonal = c === "Personal";
    // Use regex for word boundaries to avoid partial matches (e.g. "spot" in "spotify")
    const hasKeyword = debtKeywords.some((k) =>
      new RegExp(`\\b${k}\\b`, "i").test(d),
    );

    return isPersonal || hasKeyword;
  });

  let iOweTotal = 0;
  let owedToMeTotal = 0;
  const peopleStats = {};
  const processedTransactions = [];

  debtTransactions.forEach((t) => {
    const d = t.description.toLowerCase();
    let isLiability = false;

    const person = extractPersonName(t.description);
    const amount = t.amount;

    // Heuristic: Determine if this is a Liability (I owe) or Asset (Owed to me)
    if (t.type === "income") {
      // Income usually means I borrowed (Liability), unless it's a repayment to me
      if (
        d.includes("repay") ||
        d.includes("repaid") ||
        d.includes("back") ||
        d.includes("return") ||
        d.includes("reimburse") ||
        d.includes("settle")
      ) {
        isLiability = false; // Asset Repayment (They paid me back)
      } else {
        isLiability = true; // Liability Creation (I borrowed)
      }
    } else {
      // Expense usually means I lent (Asset), unless I am repaying a debt
      if (
        d.includes("repay") ||
        d.includes("repaid") ||
        d.includes("return") ||
        d.includes("settle") ||
        d.includes("debt") ||
        (d.includes("paid") && d.includes("back"))
      ) {
        isLiability = true; // Liability Repayment (I paid back)
      } else {
        isLiability = false; // Asset Creation (I lent/gave)
      }
    }

    // Calculate Totals & People Stats
    if (isLiability) {
      if (t.type === "income") {
        iOweTotal += amount;
        peopleStats[person] = (peopleStats[person] || 0) - amount;
      } else {
        iOweTotal -= amount;
        peopleStats[person] = (peopleStats[person] || 0) + amount;
      }
    } else {
      if (t.type === "expense") {
        owedToMeTotal += amount;
        peopleStats[person] = (peopleStats[person] || 0) + amount;
      } else {
        owedToMeTotal -= amount;
        peopleStats[person] = (peopleStats[person] || 0) - amount;
      }
    }

    processedTransactions.push({ ...t, isLiability, person });
  });

  return {
    iOweTotal: Math.max(0, iOweTotal),
    owedToMeTotal: Math.max(0, owedToMeTotal),
    peopleStats,
    debtTransactions: processedTransactions,
  };
}

export function renderStats() {
  const { transactions, currencySymbol } = state;
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

  // Use centralized logic for Dashboard Debt Stats
  const { iOweTotal, owedToMeTotal } = calculateDebts(transactions);

  document.getElementById("dashboard-i-owe").textContent =
    `${currencySymbol}${iOweTotal.toLocaleString()}`;
  document.getElementById("dashboard-owed-to-me").textContent =
    `${currencySymbol}${owedToMeTotal.toLocaleString()}`;
}

export function renderTable() {
  const { transactions, activeMonthFilter, currentSort, currencySymbol } =
    state;
  const transactionsList = document.getElementById("transactions-list");
  const categoryFilter = document.getElementById("category-filter");
  const searchInput = document.getElementById("search-input");
  const activeFiltersContainer = document.getElementById("active-filters");

  transactionsList.innerHTML = "";

  // Create a shallow copy to avoid mutating state during sort
  let filteredTransactions = [...transactions];
  const filterVal = categoryFilter.value;
  if (filterVal !== "all") {
    filteredTransactions = filteredTransactions.filter(
      (t) => (t.category || "General") === filterVal,
    );
  }

  const searchTerm = searchInput.value.toLowerCase();
  if (searchTerm) {
    filteredTransactions = filteredTransactions.filter((t) =>
      t.description.toLowerCase().includes(searchTerm),
    );
  }

  if (activeMonthFilter) {
    filteredTransactions = filteredTransactions.filter((t) => {
      const monthKey = t.jsDate.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      return monthKey === activeMonthFilter;
    });

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
        document.dispatchEvent(new CustomEvent("clear-month-filter"));
      });
    document
      .getElementById("delete-month-btn")
      .addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("delete-month"));
      });
  } else {
    activeFiltersContainer.classList.add("hidden");
    activeFiltersContainer.innerHTML = "";
  }

  const totalVisibleAmount = filteredTransactions.reduce((sum, t) => {
    const val = parseFloat(t.amount) || 0;
    return sum + (t.type === "income" ? val : -val);
  }, 0);

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
            <td class="px-6 py-3"><span class="px-2 py-1 rounded text-xs font-semibold ${isIncome ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}">${t.type.toUpperCase()}</span></td>
            <td class="px-6 py-3 font-bold ${amountClass} privacy-target">${sign}${currencySymbol}${t.amount.toLocaleString()}</td>
            <td class="px-6 py-3 text-right">
                <button class="edit-btn text-slate-400 hover:text-blue-500 transition p-1 mr-2" data-id="${t.id}" title="Edit"><i class="ph ph-pencil-simple text-lg"></i></button>
                <button class="delete-btn text-slate-400 hover:text-red-500 transition p-1" data-id="${t.id}" title="Delete"><i class="ph ph-trash text-lg"></i></button>
            </td>
        `;
    transactionsList.appendChild(row);
  });

  const footer = document.getElementById("transactions-footer");
  const totalEl = document.getElementById("transactions-total-amount");
  if (footer && totalEl) {
    footer.classList.remove("hidden");
    const isPositive = totalVisibleAmount >= 0;
    totalEl.textContent = `${isPositive ? "+" : "-"}${currencySymbol}${Math.abs(totalVisibleAmount).toLocaleString()}`;
    totalEl.className = `px-6 py-3 font-bold privacy-target ${isPositive ? "text-green-600" : "text-red-600"}`;
  }

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      document.dispatchEvent(
        new CustomEvent("edit-transaction", {
          detail: e.currentTarget.getAttribute("data-id"),
        }),
      ),
    );
  });
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      document.dispatchEvent(
        new CustomEvent("delete-transaction", {
          detail: e.currentTarget.getAttribute("data-id"),
        }),
      ),
    );
  });
}

export function renderDebts() {
  const { transactions, currencySymbol } = state;
  const debtsIOweList = document.getElementById("debts-i-owe-list");
  const debtsOwedToMeList = document.getElementById("debts-owed-to-me-list");
  const debtsPeopleList = document.getElementById("debts-people-list");

  // Use centralized logic
  const { iOweTotal, owedToMeTotal, peopleStats, debtTransactions } =
    calculateDebts(transactions);

  debtsIOweList.innerHTML = "";
  debtsOwedToMeList.innerHTML = "";
  if (debtsPeopleList) debtsPeopleList.innerHTML = "";

  // Empty State Handling
  if (debtTransactions.length === 0) {
    const emptyRow = (msg) =>
      `<tr><td colspan="3" class="text-center py-6 text-slate-400 text-sm italic">${msg}</td></tr>`;
    debtsIOweList.innerHTML = emptyRow("No active debts found.");
    debtsOwedToMeList.innerHTML = emptyRow("No assets found.");
    if (debtsPeopleList)
      debtsPeopleList.innerHTML = emptyRow("No people records found.");
    // Totals are already 0 from calculateDebts
  }

  debtTransactions.forEach((t) => {
    const dateStr = `${t.jsDate.getDate()}/${t.jsDate.getMonth() + 1}/${t.jsDate.getFullYear()}`;
    const row = document.createElement("tr");
    row.className =
      "border-b border-white/20 dark:border-white/10 last:border-0";
    row.innerHTML = `<td class="px-6 py-3 whitespace-nowrap">${dateStr}</td><td class="px-6 py-3 font-medium text-slate-800 dark:text-white">${t.description}</td><td class="px-6 py-3 text-right font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"} privacy-target">${t.type === "income" ? "+" : "-"}${currencySymbol}${t.amount.toLocaleString()}</td>`;

    if (t.isLiability) {
      debtsIOweList.appendChild(row);
    } else {
      debtsOwedToMeList.appendChild(row);
    }
  });

  document.getElementById("total-i-owe").textContent =
    `${currencySymbol}${iOweTotal.toLocaleString()}`;
  document.getElementById("total-owed-to-me").textContent =
    `${currencySymbol}${owedToMeTotal.toLocaleString()}`;

  Object.entries(peopleStats)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .forEach(([person, balance]) => {
      if (Math.abs(balance) < 0.01) return;
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
      row.innerHTML = `<td class="px-6 py-3 font-medium text-slate-800 dark:text-white">${person}</td><td class="px-6 py-3 text-right font-bold ${colorClass} privacy-target">${currencySymbol}${Math.abs(balance).toLocaleString()}</td><td class="px-6 py-3 text-right text-xs font-bold uppercase tracking-wider ${colorClass}"><div class="flex items-center justify-end gap-1">${statusText} ${icon}</div></td>`;
      debtsPeopleList.appendChild(row);
    });
}
