import * as XLSX from 'xlsx';

export const exportInventoryToExcel = (items) => {
  const rows = items.map((it) => ({
    'Item Name': it.name,
    'Category': it.category_name || 'Uncategorized',
    'Quantity (Sheets)': it.sheets,
    'U Molding': it.uMolding,
    'L Molding': it.lMolding,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/octet-stream' });
};

export const exportSalesToExcel = (sales) => {
  const rows = sales.map((s) => ({
    'Bill Number': s.bill_number,
    'Date': s.date,
    'Customer': s.customer_name,
    'Item': s.item_name,
    'Sheets': s.sheets_sale,
    'U Molding': s.u_molding_sale,
    'L Molding': s.l_molding_sale,
    'Price/Sheet': s.price_per_sheet,
    'Price/U': s.price_per_u_molding,
    'Price/L': s.price_per_l_molding,
    'Total': s.total_price,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/octet-stream' });
};

export const exportPurchasesToExcel = (rows_) => {
  const rows = rows_.map((s) => ({
    'Bill Number': s.bill_number,
    'Date': s.date,
    'Supplier': s.supplier_name,
    'Item': s.item_name,
    'Sheets': s.sheets_purchase,
    'U Molding': s.u_molding_purchase,
    'L Molding': s.l_molding_purchase,
    'Price/Sheet': s.price_per_sheet,
    'Price/U': s.price_per_u_molding,
    'Price/L': s.price_per_l_molding,
    'Total': s.total_price,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/octet-stream' });
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const validateInventoryData = (rows, existingItems, categories) => {
  const errors = [];
  const data = [];
  const missingCategories = [];
  const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const seenMissing = new Set();

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const name = String(row['Item Name'] || row.name || '').trim();
    if (!name) { errors.push({ row: rowNum, message: 'Missing Item Name' }); return; }
    const catName = String(row['Category'] || row.category || '').trim();
    let categoryId = null;
    if (catName) {
      categoryId = catMap.get(catName.toLowerCase()) || null;
      if (!categoryId && !seenMissing.has(catName.toLowerCase())) {
        seenMissing.add(catName.toLowerCase());
        missingCategories.push({ name: catName });
      }
    }
    const sheets = Number(row['Quantity (Sheets)'] ?? row.sheets ?? 0) || 0;
    const uMolding = Number(row['U Molding'] ?? row.uMolding ?? 0) || 0;
    const lMolding = Number(row['L Molding'] ?? row.lMolding ?? 0) || 0;
    if (sheets < 0 || uMolding < 0 || lMolding < 0) {
      errors.push({ row: rowNum, message: 'Negative quantity not allowed' }); return;
    }
    data.push({ name, categoryName: catName, category_id: categoryId, sheets, uMolding, lMolding });
  });
  return { valid: errors.length === 0, errors, data, missingCategories };
};

export const validateSalesData = (rows, items) => {
  const errors = [];
  const data = [];
  const itemMap = new Map(items.map((i) => [i.name.toLowerCase(), i]));
  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const bill = String(row['Bill Number'] || '').trim();
    if (!bill) { errors.push({ row: rowNum, message: 'Missing Bill Number' }); return; }
    const itName = String(row['Item'] || '').trim();
    const it = itemMap.get(itName.toLowerCase());
    if (!it) { errors.push({ row: rowNum, message: `Unknown item: ${itName}` }); return; }
    data.push({
      bill_number: bill,
      date: String(row['Date'] || new Date().toISOString().split('T')[0]),
      customer_name: String(row['Customer'] || ''),
      itemId: it.id,
      sheets_sale: Number(row['Sheets'] || 0) || 0,
      u_molding_sale: Number(row['U Molding'] || 0) || 0,
      l_molding_sale: Number(row['L Molding'] || 0) || 0,
      price_per_sheet: Number(row['Price/Sheet'] || 0) || 0,
      price_per_u_molding: Number(row['Price/U'] || 0) || 0,
      price_per_l_molding: Number(row['Price/L'] || 0) || 0,
      total_price: Number(row['Total'] || 0) || 0,
    });
  });
  return { valid: errors.length === 0, errors, data };
};
