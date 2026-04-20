// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const INVENTORY_FILES = [
  { path: 'plushies.json', category: 'Plushies' },
  { path: 'flowers.json',  category: 'Flowers'  },
];
const PRICES_FILE = 'prices/LMN_OP.json';

const LABELS = {
  category:  'Category',
  name:      'Item',
  qty:       'Qty',
  unitPrice: 'Unit Price',
  total:     'Total Value',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let allRows    = [];   // { category, name, qty, unitPrice, total }
let activeFilter = 'all';
let activeSort   = 'total-desc';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function formatCurrency(n) {
  return '$' + Math.round(n).toLocaleString();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------
function getSortValue(row, key) {
  switch (key) {
    case 'total-desc':
    case 'total-asc':   return row.total ?? -Infinity;
    case 'name-asc':    return row.name.toLowerCase();
    case 'price-desc':  return row.unitPrice ?? -Infinity;
    case 'qty-desc':    return row.qty;
    default:            return 0;
  }
}

function sortedRows(rows) {
  return [...rows].sort((a, b) => {
    const av = getSortValue(a, activeSort);
    const bv = getSortValue(b, activeSort);
    const dir = activeSort.endsWith('asc') ? 1 : -1;
    if (av < bv) return dir;
    if (av > bv) return -dir;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function buildHeader() {
  const thead = document.getElementById('table-head');
  thead.innerHTML = '';
  const tr = document.createElement('tr');

  Object.entries(LABELS).forEach(([key, label]) => {
    const th = document.createElement('th');
    if (key === 'name') th.classList.add('col-left');
    th.textContent = label;
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

function renderRow(row) {
  const tr = document.createElement('tr');

  // Category badge
  const tdCat = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = `badge badge-${row.category.toLowerCase()}`;
  badge.textContent = row.category;
  tdCat.appendChild(badge);
  tr.appendChild(tdCat);

  // Item name
  const tdName = document.createElement('td');
  tdName.className = 'col-left';
  tdName.textContent = row.name;
  tr.appendChild(tdName);

  // Quantity
  const tdQty = document.createElement('td');
  tdQty.textContent = row.qty.toLocaleString();
  tr.appendChild(tdQty);

  // Unit price
  const tdPrice = document.createElement('td');
  if (row.unitPrice !== null) {
    tdPrice.className = 'value-unit';
    tdPrice.textContent = formatCurrency(row.unitPrice);
  } else {
    tdPrice.className = 'value-none';
    tdPrice.textContent = '—';
  }
  tr.appendChild(tdPrice);

  // Total value
  const tdTotal = document.createElement('td');
  if (row.total !== null) {
    tdTotal.className = 'value-total';
    tdTotal.textContent = formatCurrency(row.total);
  } else {
    tdTotal.className = 'value-none';
    tdTotal.textContent = '—';
  }
  tr.appendChild(tdTotal);

  return tr;
}

function buildRows() {
  const tbody = document.getElementById('table-body');
  const tfoot = document.getElementById('table-foot');
  tbody.innerHTML = '';
  tfoot.innerHTML = '';

  const filtered = activeFilter === 'all'
    ? allRows
    : allRows.filter(r => r.category === activeFilter);

  const rows = sortedRows(filtered);

  if (!rows.length) {
    tbody.innerHTML = `<tr class="error-row"><td colspan="5">No items match this filter.</td></tr>`;
    return;
  }

  rows.forEach(row => tbody.appendChild(renderRow(row)));

  // Grand total footer
  const grandTotal = rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const tfr = document.createElement('tr');
  tfr.innerHTML = `
    <td colspan="4">Grand Total</td>
    <td class="gt-value">${formatCurrency(grandTotal)}</td>
  `;
  tfoot.appendChild(tfr);
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function setupControls() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      buildRows();
    });
  });

  document.getElementById('sort-select').addEventListener('change', e => {
    activeSort = e.target.value;
    buildRows();
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  setupControls();

  try {
    const fetches = [
      fetch(PRICES_FILE).then(r => { if (!r.ok) throw new Error(PRICES_FILE); return r.json(); }),
      ...INVENTORY_FILES.map(f =>
        fetch(f.path).then(r => { if (!r.ok) throw new Error(f.path); return r.json(); })
      ),
    ];

    const [priceData, ...inventoryDataArr] = await Promise.all(fetches);

    // Build price lookup: item id → price
    const priceMap = {};
    if (priceData && Array.isArray(priceData.items)) {
      priceData.items.forEach(item => { priceMap[item.id] = item.price; });
    }

    // Update last-updated meta
    const updatedAt = priceData?.updated_at
      ? new Date(priceData.updated_at).toLocaleString()
      : 'Unknown';
    document.getElementById('last-updated').textContent = `Prices updated: ${updatedAt}`;

    // Merge inventory with prices
    allRows = [];
    inventoryDataArr.forEach((invData, idx) => {
      const category = INVENTORY_FILES[idx].category;
      if (!invData || !Array.isArray(invData.items)) return;

      invData.items.forEach(item => {
        const unitPrice = priceMap.hasOwnProperty(item.id) ? priceMap[item.id] : null;
        const total     = unitPrice !== null ? unitPrice * item.quantity : null;
        allRows.push({ category, name: item.name, qty: item.quantity, unitPrice, total });
      });
    });

    if (!allRows.length) throw new Error('No inventory items found');

    buildHeader();
    buildRows();

  } catch (e) {
    console.error('Init error:', e);
    document.getElementById('last-updated').textContent = 'Error loading data';
    document.getElementById('table-body').innerHTML =
      `<tr class="error-row"><td colspan="5">Failed to load data: ${escHtml(e.message)}</td></tr>`;
  }
}

init();
