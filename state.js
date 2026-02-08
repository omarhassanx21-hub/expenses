export const state = {
  currentUser: null,
  transactions: [],
  currencySymbol: localStorage.getItem("currency") || "$",
  isDarkMode: localStorage.getItem("theme") === "dark",
  currentSort: { column: "date", direction: "desc" },
  activeMonthFilter: null,
  lastBulkBatchIds: [],
  editingTransactionId: null,
};
