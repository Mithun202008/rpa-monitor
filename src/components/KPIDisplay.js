import { formatCurrency, formatNumber } from '../utils/format.js';

export function createKPIDisplay(engine) {
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
