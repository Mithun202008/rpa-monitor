import { formatCurrency, formatNumber } from '../utils/format.js';

export function createKPIDisplay(engine) {
  const el = document.getElementById('kpi-dashboard');
  el.innerHTML = `
    <div class="kpi-card">
      <span class="kpi-label">Total Streamed Rows Processed</span>
      <span class="kpi-value" id="kpi-rows">0</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Active Robots Deployed</span>
      <span class="kpi-value" id="kpi-robots">0</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Global Cumulative Savings</span>
      <span class="kpi-value" id="kpi-savings">$0.00</span>
    </div>
  `;

  const rowsEl = document.getElementById('kpi-rows');
  const robotsEl = document.getElementById('kpi-robots');
  const savingsEl = document.getElementById('kpi-savings');

  function onKpi(kpis) {
    rowsEl.textContent = formatNumber(kpis.totalProcessed);
    robotsEl.textContent = formatNumber(kpis.activeRobots);
    savingsEl.textContent = formatCurrency(kpis.globalSavings);
  }

  engine.onKpiChange(onKpi);

  const destroy = () => {
    engine.removeListener(onKpi);
  };

  return { destroy };
}
