import { state } from "./state.js";

let monthlyChartInstance = null;
let categoryChartInstance = null;

export function renderCharts() {
  const { transactions, isDarkMode, currencySymbol, activeMonthFilter } = state;

  const textColor = isDarkMode ? "#cbd5e1" : "#64748b";
  const gridColor = isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";

  // 1. Prepare Monthly Data
  const monthlyData = {};
  [...transactions].reverse().forEach((t) => {
    const monthKey = t.jsDate.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
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

  // 2. Prepare Category Data
  const categoryData = {};
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
          borderColor: "#3b82f6",
          backgroundColor: "#3b82f6",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 0,
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
      plugins: { legend: { position: "bottom", labels: { color: textColor } } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
        x: { grid: { display: false }, ticks: { color: textColor } },
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          document.dispatchEvent(
            new CustomEvent("filter-month", { detail: labels[index] }),
          );
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
          document.dispatchEvent(
            new CustomEvent("filter-category", { detail: catLabels[index] }),
          );
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
