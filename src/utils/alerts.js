export function applyAlertClass(rowEl, row) {
  if (row._flashRed && row.project_status === 'Failed') {
    rowEl.classList.remove('row-alert-amber', 'row-failed');
    rowEl.classList.add('row-alert');
    row._flashRed = false;
    return;
  }
  if (row._flashRed) {
    row._flashRed = false;
  }

  if (row._flashAmber && Number(row.roi_percent) < 0) {
    rowEl.classList.remove('row-alert', 'row-failed');
    rowEl.classList.add('row-alert-amber');
    row._flashAmber = false;
    return;
  }
  if (row._flashAmber) {
    row._flashAmber = false;
  }

  if (row.project_status === 'Failed') {
    rowEl.classList.remove('row-alert', 'row-alert-amber');
    rowEl.classList.add('row-failed');
    return;
  }

  if (Number(row.roi_percent) < 0) {
    rowEl.classList.remove('row-alert', 'row-alert-amber', 'row-failed');
    rowEl.classList.add('row-negative-roi');
    return;
  }

  rowEl.classList.remove('row-alert', 'row-alert-amber', 'row-failed', 'row-negative-roi');
}
