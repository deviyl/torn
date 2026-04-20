// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const INVENTORY_FILES = [
  { path: 'plushies.json', category: 'Plushies' },
  { path: 'flowers.json',  category: 'Flowers'  },
];
const PRICES_FILE = 'prices/LMN_OP.json';

const COL_LABELS = ['Item', 'Qty', 'Unit Price', 'Total Value'];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
// category → { rows: [...], subtotal: number }
const categoryData = {};
// category → boolean (included in grand total)
const included = { Plushies: true, Flowers: true };

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
// Grand total
// ---------------------------------------------------------------------------
function updateGrandTotal() {
  let total = 0;
  for (const [cat, data] of Object.entries(categoryData)) {
    if (included[cat]) total += data.subtotal;
  }
  document.getElementById('grand-total').textContent = formatCurrency(total);
}

// ---------------------------------------------------------------------------
// Render one category table
// ---------------------------------------------------------------------------
function buildCategoryTable(category, rows) {
  // Header
  const thead = document.getElementById(`head-${category}`);
  thead.innerHTML = '';
  const tr = document.createElement('tr');
  COL_LABELS.forEach((label, i) => {
    const th = document.createElement('th');
    if (i === 0) th.classList.add('col-left');
    th.textContent = label;
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Body
  const tbody = document.getElementById(`body-${category}`);
  tbody.innerHTML = '';

  if (!rows.length) {
    tbody.innerHTML = `<tr class="error-row"><td colspan="4">No items found.</td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');

    // Item name
    const tdName = document.createElement('td');
    tdName.className = 'col-left';
    tdName.textContent = row.name;
    tr.appendChild(tdName);

    // Qty
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

    tbody.appendChild(tr);
  });

  // Subtotal display
  const subtotal = rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
  document.getElementById(`subtotal-${category}`).textContent = formatCurrency(subtotal);
  categoryData[category] = { rows, subtotal };
}

// ---------------------------------------------------------------------------
// Checkbox setup
// ---------------------------------------------------------------------------
function setupCheckboxes() {
  document.querySelectorAll('.include-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const cat = cb.dataset.category;
      included[cat] = cb.checked;
      // Toggle visual dim on the container
      document.getElementById(`section-${cat}`).classList.toggle('excluded', !cb.checked);
      updateGrandTotal();
    });
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  setupCheckboxes();

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

    // Build each category table
    inventoryDataArr.forEach((invData, idx) => {
      const category = INVENTORY_FILES[idx].category;
      if (!invData || !Array.isArray(invData.items)) {
        buildCategoryTable(category, []);
        return;
      }

      const rows = invData.items.map(item => {
        const unitPrice = priceMap.hasOwnProperty(item.id) ? priceMap[item.id] : null;
        const total     = unitPrice !== null ? unitPrice * item.quantity : null;
        return { name: item.name, qty: item.quantity, unitPrice, total };
      });

      // Sort by total descending by default
      rows.sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity));

      buildCategoryTable(category, rows);
    });

    updateGrandTotal();

  } catch (e) {
    console.error('Init error:', e);
    document.getElementById('last-updated').textContent = 'Error loading data';
    INVENTORY_FILES.forEach(({ category }) => {
      const tbody = document.getElementById(`body-${category}`);
      if (tbody) tbody.innerHTML =
        `<tr class="error-row"><td colspan="4">Failed to load: ${escHtml(e.message)}</td></tr>`;
    });
  }
}

init();
