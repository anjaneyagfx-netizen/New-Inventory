import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { exportSalesToExcel, downloadBlob, validateSalesData } from '../lib/excelUtils';
import Header from '../components/Header';
import InvoicePrintModal from '../components/InvoicePrintModal';
import ItemCodeSearchInput from '../components/ItemCodeSearchInput';
import BillEditModal from '../components/BillEditModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Search, Plus, FileText, X, Printer, Loader2, Download, Upload, Pencil, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const SalesPage = () => {
  const { currentUser, currentWarehouse, canEditData } = useAuth();
  const canEdit = canEditData();
  const fileInputRef = useRef(null);

  const [sales, setSales] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const [billData, setBillData] = useState({ billNumber: '', date: new Date().toISOString().split('T')[0], customerName: '' });
  const [currentItem, setCurrentItem] = useState({ itemData: null, sheets: 0, uMolding: 0, lMolding: 0, price_per_sheet: 0, price_per_u_molding: 0, price_per_l_molding: 0 });
  const [billItems, setBillItems] = useState([]);
  const [savingBill, setSavingBill] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [billSearch, setBillSearch] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [deleteBill, setDeleteBill] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingBill, setEditingBill] = useState(null);

  const fetchData = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      setLoading(true);
      const [s, i] = await Promise.all([
        api.get('/sales', { params: { warehouse_id: currentWarehouse.id } }).then((r) => r.data),
        api.get('/inventory', { params: { warehouse_id: currentWarehouse.id } }).then((r) => r.data),
      ]);
      setSales(s);
      setItems(i);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  }, [currentWarehouse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupedBills = useMemo(() => {
    const map = {};
    sales.forEach((s) => {
      if (!map[s.bill_number]) {
        map[s.bill_number] = {
          id: s.id, billNumber: s.bill_number, date: s.date, customerName: s.customer_name,
          totalAmount: 0, items: [],
        };
      }
      map[s.bill_number].totalAmount += s.total_price || 0;
      map[s.bill_number].items.push({
        id: s.id, name: s.item_name || 'Unknown', itemId: s.itemId,
        categoryName: s.category_name || 'Uncategorized',
        sheets: Math.round(s.sheets_sale), uMolding: Math.round(s.u_molding_sale), lMolding: Math.round(s.l_molding_sale),
        pricePerSheet: s.price_per_sheet, pricePerU: s.price_per_u_molding, pricePerL: s.price_per_l_molding,
        itemTotal: s.total_price || 0,
      });
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [sales]);

  const handleAddItem = () => {
    if (!currentItem.itemData) return toast.error('Select an item first');
    const sheets = parseInt(currentItem.sheets) || 0;
    const uMolding = parseInt(currentItem.uMolding) || 0;
    const lMolding = parseInt(currentItem.lMolding) || 0;
    if (!sheets && !uMolding && !lMolding) return toast.error('Enter quantity > 0');
    const stock = currentItem.itemData;
    const inBill = billItems.filter((b) => b.itemId === stock.id).reduce((a, b) => ({ sheets: a.sheets + b.sheets, uMolding: a.uMolding + b.uMolding, lMolding: a.lMolding + b.lMolding }), { sheets: 0, uMolding: 0, lMolding: 0 });
    if (sheets + inBill.sheets > Math.round(stock.sheets)) return toast.error('Insufficient sheets');
    if (uMolding + inBill.uMolding > Math.round(stock.uMolding)) return toast.error('Insufficient U molding');
    if (lMolding + inBill.lMolding > Math.round(stock.lMolding)) return toast.error('Insufficient L molding');
    const pS = parseFloat(currentItem.price_per_sheet) || 0;
    const pU = parseFloat(currentItem.price_per_u_molding) || 0;
    const pL = parseFloat(currentItem.price_per_l_molding) || 0;
    const itemTotal = sheets * pS + uMolding * pU + lMolding * pL;
    setBillItems([...billItems, {
      id: crypto.randomUUID(), itemId: stock.id, name: stock.name, categoryName: stock.category_name,
      sheets, uMolding, lMolding, pricePerSheet: pS, pricePerU: pU, pricePerL: pL, itemTotal,
    }]);
    setCurrentItem({ itemData: null, sheets: 0, uMolding: 0, lMolding: 0, price_per_sheet: 0, price_per_u_molding: 0, price_per_l_molding: 0 });
  };

  const handleSaveBill = async () => {
    if (!billData.billNumber.trim()) return toast.error('Bill Number required');
    if (!billData.customerName.trim()) return toast.error('Customer Name required');
    if (!billItems.length) return toast.error('Add an item');
    setSavingBill(true);
    try {
      await api.post('/sales', {
        bill_number: billData.billNumber,
        date: billData.date,
        customer_name: billData.customerName,
        warehouse_id: currentWarehouse.id,
        items: billItems.map((it) => ({
          itemId: it.itemId, sheets: it.sheets, uMolding: it.uMolding, lMolding: it.lMolding,
          pricePerSheet: it.pricePerSheet, pricePerU: it.pricePerU, pricePerL: it.pricePerL,
        })),
      });
      toast.success('Sale saved');
      const subtotal = billItems.reduce((a, b) => a + b.itemTotal, 0);
      setSelectedInvoice({ billNumber: billData.billNumber, date: billData.date, customerName: billData.customerName, items: [...billItems], grandTotal: subtotal });
      setInvoiceOpen(true);
      setBillData({ billNumber: '', date: new Date().toISOString().split('T')[0], customerName: '' });
      setBillItems([]);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save');
    } finally { setSavingBill(false); }
  };

  const handlePrint = (bill) => {
    setSelectedInvoice({ ...bill, grandTotal: bill.totalAmount });
    setInvoiceOpen(true);
  };

  const handleSaveEditedBill = async (updated) => {
    await api.put(`/sales/bill/${encodeURIComponent(updated.billNumber)}`, {
      bill_number: updated.billNumber,
      date: updated.date,
      customer_name: updated.partyName,
      warehouse_id: currentWarehouse.id,
      items: updated.items.map((it) => ({
        itemId: it.itemId, sheets: it.sheets, uMolding: it.uMolding, lMolding: it.lMolding,
        pricePerSheet: it.pricePerSheet, pricePerU: it.pricePerU, pricePerL: it.pricePerL,
      })),
    });
    fetchData();
  };

  const confirmDeleteBill = async () => {
    if (!deleteBill) return;
    setIsDeleting(true);
    try {
      await api.delete(`/sales/bill/${encodeURIComponent(deleteBill.billNumber)}`, { params: { warehouse_id: currentWarehouse.id } });
      toast.success('Bill deleted');
      setDeleteBill(null);
      fetchData();
    } catch { toast.error('Delete failed'); }
    finally { setIsDeleting(false); }
  };

  const handleExport = () => {
    const blob = exportSalesToExcel(sales);
    downloadBlob(blob, `sales_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported');
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const { data, errors } = validateSalesData(rows, items);
        if (errors.length) toast.error(`${errors.length} row errors skipped`);
        // Group by bill_number then post per bill
        const byBill = {};
        for (const r of data) {
          if (!byBill[r.bill_number]) byBill[r.bill_number] = { bill: r, items: [] };
          byBill[r.bill_number].items.push(r);
        }
        let ok = 0;
        for (const key of Object.keys(byBill)) {
          const b = byBill[key];
          try {
            await api.post('/sales', {
              bill_number: key,
              date: b.bill.date,
              customer_name: b.bill.customer_name,
              warehouse_id: currentWarehouse.id,
              items: b.items.map((it) => ({
                itemId: it.itemId, sheets: it.sheets_sale, uMolding: it.u_molding_sale, lMolding: it.l_molding_sale,
                pricePerSheet: it.price_per_sheet, pricePerU: it.price_per_u_molding, pricePerL: it.price_per_l_molding,
              })),
            });
            ok++;
          } catch (err) { /* skip */ }
        }
        toast.success(`Imported ${ok} bills`);
        fetchData();
      } catch { toast.error('Import failed'); }
      finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const billGrandTotal = billItems.reduce((a, b) => a + b.itemTotal, 0);
  const filteredBills = groupedBills.filter((b) => {
    if (!billSearch) return true;
    const s = billSearch.toLowerCase();
    return b.billNumber.toLowerCase().includes(s) || (b.customerName || '').toLowerCase().includes(s);
  });

  return (
    <>
      <Helmet><title>Sales & Invoicing - StockFlow System</title></Helmet>
      <Header />

      <InvoicePrintModal isOpen={invoiceOpen} onClose={() => setInvoiceOpen(false)} saleData={selectedInvoice} warehouseName={currentWarehouse?.name} docType="INVOICE" />
      <BillEditModal isOpen={editOpen} onClose={() => setEditOpen(false)} bill={editingBill} onSave={handleSaveEditedBill} isSales />

      <AlertDialog open={!!deleteBill} onOpenChange={(o) => { if (!o && !isDeleting) setDeleteBill(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
            <AlertDialogDescription>This will reverse inventory changes and delete bill <strong>{deleteBill?.billNumber}</strong>.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDeleteBill(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales & Invoicing</h1>
            <p className="text-muted-foreground mt-1">Process transactions for {currentWarehouse?.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Export</Button>
            {canEdit && (
              <>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                  <Upload className="w-4 h-4 mr-2" /> {importing ? 'Importing...' : 'Import'}
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx" />
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {canEdit && (
            <div className="xl:col-span-5 flex flex-col gap-6">
              <Card className="shadow-sm border-border/50">
                <CardHeader className="bg-primary/5 pb-4 border-b"><CardTitle className="text-lg">Sale Details</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bill No. *</Label>
                      <Input value={billData.billNumber} onChange={(e) => setBillData({ ...billData, billNumber: e.target.value })} placeholder="e.g. INV-1001" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input type="date" value={billData.date} onChange={(e) => setBillData({ ...billData, date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Name *</Label>
                    <Input value={billData.customerName} onChange={(e) => setBillData({ ...billData, customerName: e.target.value })} placeholder="Customer or Walk-in" />
                  </div>

                  <div className="h-px bg-border/50" />

                  <div className="space-y-4">
                    <ItemCodeSearchInput items={items} onSelect={(it) => setCurrentItem({ itemData: it, sheets: 0, uMolding: 0, lMolding: 0, price_per_sheet: 0, price_per_u_molding: 0, price_per_l_molding: 0 })} />
                    {currentItem.itemData && (
                      <div className="bg-muted/20 rounded-xl p-5 border space-y-4">
                        {currentItem.itemData.image && (
                          <div className="aspect-video w-full rounded-md overflow-hidden bg-background border flex items-center justify-center">
                            <img src={currentItem.itemData.image} alt={currentItem.itemData.name} className="w-full h-full object-contain" />
                          </div>
                        )}
                        <p className="font-semibold border-b pb-2">{currentItem.itemData.name}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                          <div className="space-y-1"><Label className="text-xs font-semibold">Sheets (Avail: {Math.round(currentItem.itemData.sheets)})</Label><Input type="number" min="0" value={currentItem.sheets || ''} onChange={(e) => setCurrentItem({ ...currentItem, sheets: parseInt(e.target.value) || 0 })} placeholder="Qty" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold text-primary">Price / Sheet (₹)</Label><Input type="number" min="0" step="0.01" value={currentItem.price_per_sheet || ''} onChange={(e) => setCurrentItem({ ...currentItem, price_per_sheet: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold">U Mold (Avail: {Math.round(currentItem.itemData.uMolding)})</Label><Input type="number" min="0" value={currentItem.uMolding || ''} onChange={(e) => setCurrentItem({ ...currentItem, uMolding: parseInt(e.target.value) || 0 })} placeholder="Qty" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold text-primary">Price / U Mold (₹)</Label><Input type="number" min="0" step="0.01" value={currentItem.price_per_u_molding || ''} onChange={(e) => setCurrentItem({ ...currentItem, price_per_u_molding: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold">L Mold (Avail: {Math.round(currentItem.itemData.lMolding)})</Label><Input type="number" min="0" value={currentItem.lMolding || ''} onChange={(e) => setCurrentItem({ ...currentItem, lMolding: parseInt(e.target.value) || 0 })} placeholder="Qty" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold text-primary">Price / L Mold (₹)</Label><Input type="number" min="0" step="0.01" value={currentItem.price_per_l_molding || ''} onChange={(e) => setCurrentItem({ ...currentItem, price_per_l_molding: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                        </div>
                        <div className="flex justify-between items-center bg-background p-3 rounded-lg border shadow-sm">
                          <span className="text-sm font-medium">Calculated Item Total:</span>
                          <span className="font-bold text-lg text-primary">₹{((currentItem.sheets * currentItem.price_per_sheet) + (currentItem.uMolding * currentItem.price_per_u_molding) + (currentItem.lMolding * currentItem.price_per_l_molding)).toFixed(2)}</span>
                        </div>
                        <Button onClick={handleAddItem} className="w-full"><Plus className="w-4 h-4 mr-2" /> Add to Invoice</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className={`${canEdit ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col gap-6`}>
            {canEdit && (
              <Card className="shadow-sm border-border/50">
                <CardHeader className="bg-muted/30 pb-4 border-b"><CardTitle className="text-lg">Current Invoice Items</CardTitle></CardHeader>
                <CardContent className="pt-6">
                  {billItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 opacity-60">
                      <FileText className="h-10 w-10 mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium">Invoice is currently empty.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="overflow-x-auto border rounded-lg">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>Item Name</TableHead>
                              <TableHead className="text-right">Total Qty</TableHead>
                              <TableHead className="text-right">Total Price</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {billItems.map((it) => (
                              <TableRow key={it.id}>
                                <TableCell className="font-medium text-sm">{it.name}</TableCell>
                                <TableCell className="text-right tabular-nums">{it.sheets + it.uMolding + it.lMolding}</TableCell>
                                <TableCell className="text-right tabular-nums font-medium">₹{it.itemTotal.toFixed(2)}</TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => setBillItems(billItems.filter((b) => b.id !== it.id))} className="text-destructive hover:bg-destructive/10"><X className="w-4 h-4" /></Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-between items-center px-5 py-4 bg-muted/30 rounded-xl border">
                        <span className="font-medium">Total Amount Due</span>
                        <span className="text-2xl font-bold text-primary">₹{billGrandTotal.toFixed(2)}</span>
                      </div>
                      <Button onClick={handleSaveBill} disabled={savingBill} className="w-full h-12 text-base font-semibold">
                        {savingBill ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>) : (<><Save className="w-5 h-5 mr-2" /> Submit Sale & Generate Invoice</>)}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm border-border/50 flex-grow">
              <CardHeader className="bg-muted/10 border-b pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-lg">Recent Sales</CardTitle>
                    <CardDescription>Click print to view existing invoices</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-auto sm:min-w-[280px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={billSearch} onChange={(e) => setBillSearch(e.target.value)} placeholder="Search bills..." className="pl-9 pr-9" />
                    {billSearch && (
                      <Button variant="ghost" size="icon" onClick={() => setBillSearch('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-4 p-6">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />)}</div>
                ) : filteredBills.length === 0 ? (
                  <div className="text-center py-10 m-6 border border-dashed rounded-lg bg-muted/20">
                    <p className="text-muted-foreground font-medium">{billSearch ? 'No bills match your search' : 'No completed sales recorded'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead className="pl-6">Bill No.</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBills.map((bill) => (
                          <TableRow key={bill.billNumber}>
                            <TableCell className="font-medium pl-6">{bill.billNumber}</TableCell>
                            <TableCell>{bill.customerName}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground text-sm">{new Date(bill.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right font-bold text-primary">₹{bill.totalAmount.toFixed(2)}</TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handlePrint(bill)} className="h-8 w-8"><Printer className="w-4 h-4" /></Button>
                                {canEdit && (<>
                                  <Button variant="ghost" size="icon" onClick={() => { setEditingBill(bill); setEditOpen(true); }} className="h-8 w-8"><Pencil className="w-4 h-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => setDeleteBill(bill)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                                </>)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalesPage;
