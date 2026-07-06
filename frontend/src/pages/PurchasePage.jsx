import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { exportPurchasesToExcel, downloadBlob } from '../lib/excelUtils';
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

const PurchasePage = () => {
  const { currentUser, currentWarehouse, canEditData } = useAuth();
  const canEdit = canEditData();
  const fileInputRef = useRef(null);

  const [purchases, setPurchases] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [billData, setBillData] = useState({ billNumber: '', date: new Date().toISOString().split('T')[0], supplierName: '' });
  const [currentItem, setCurrentItem] = useState({ itemData: null, sheets: 0, uMolding: 0, lMolding: 0, price_per_sheet: 0, price_per_u_molding: 0, price_per_l_molding: 0 });
  const [billItems, setBillItems] = useState([]);
  const [savingBill, setSavingBill] = useState(false);
  const [billSearch, setBillSearch] = useState('');

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [deleteBill, setDeleteBill] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      setLoading(true);
      const [p, i] = await Promise.all([
        api.get('/purchases', { params: { warehouse_id: currentWarehouse.id } }).then((r) => r.data),
        api.get('/inventory', { params: { warehouse_id: currentWarehouse.id } }).then((r) => r.data),
      ]);
      setPurchases(p);
      setItems(i);
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  }, [currentWarehouse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const groupedBills = useMemo(() => {
    const map = {};
    purchases.forEach((s) => {
      if (!map[s.bill_number]) map[s.bill_number] = { id: s.id, billNumber: s.bill_number, date: s.date, supplierName: s.supplier_name, totalAmount: 0, items: [] };
      map[s.bill_number].totalAmount += s.total_price || 0;
      map[s.bill_number].items.push({
        id: s.id, name: s.item_name || 'Unknown', itemId: s.itemId,
        sheets: Math.round(s.sheets_purchase), uMolding: Math.round(s.u_molding_purchase), lMolding: Math.round(s.l_molding_purchase),
        pricePerSheet: s.price_per_sheet, pricePerU: s.price_per_u_molding, pricePerL: s.price_per_l_molding,
        itemTotal: s.total_price || 0,
      });
    });
    return Object.values(map).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [purchases]);

  const handleAddItem = () => {
    if (!currentItem.itemData) return toast.error('Select an item first');
    const sheets = parseInt(currentItem.sheets) || 0;
    const uMolding = parseInt(currentItem.uMolding) || 0;
    const lMolding = parseInt(currentItem.lMolding) || 0;
    if (!sheets && !uMolding && !lMolding) return toast.error('Enter quantity > 0');
    const stock = currentItem.itemData;
    const pS = parseFloat(currentItem.price_per_sheet) || 0;
    const pU = parseFloat(currentItem.price_per_u_molding) || 0;
    const pL = parseFloat(currentItem.price_per_l_molding) || 0;
    const itemTotal = sheets * pS + uMolding * pU + lMolding * pL;
    setBillItems([...billItems, { id: crypto.randomUUID(), itemId: stock.id, name: stock.name, sheets, uMolding, lMolding, pricePerSheet: pS, pricePerU: pU, pricePerL: pL, itemTotal }]);
    setCurrentItem({ itemData: null, sheets: 0, uMolding: 0, lMolding: 0, price_per_sheet: 0, price_per_u_molding: 0, price_per_l_molding: 0 });
  };

  const handleSaveBill = async () => {
    if (!billData.billNumber.trim()) return toast.error('Bill Number required');
    if (!billData.supplierName.trim()) return toast.error('Supplier Name required');
    if (!billItems.length) return toast.error('Add an item');
    setSavingBill(true);
    try {
      await api.post('/purchases', {
        bill_number: billData.billNumber,
        date: billData.date,
        supplier_name: billData.supplierName,
        warehouse_id: currentWarehouse.id,
        items: billItems.map((it) => ({ itemId: it.itemId, sheets: it.sheets, uMolding: it.uMolding, lMolding: it.lMolding, pricePerSheet: it.pricePerSheet, pricePerU: it.pricePerU, pricePerL: it.pricePerL })),
      });
      toast.success('Purchase saved');
      const subtotal = billItems.reduce((a, b) => a + b.itemTotal, 0);
      setSelectedInvoice({ billNumber: billData.billNumber, date: billData.date, supplierName: billData.supplierName, items: [...billItems], grandTotal: subtotal });
      setInvoiceOpen(true);
      setBillData({ billNumber: '', date: new Date().toISOString().split('T')[0], supplierName: '' });
      setBillItems([]);
      fetchData();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to save'); }
    finally { setSavingBill(false); }
  };

  const handlePrint = (bill) => { setSelectedInvoice({ ...bill, grandTotal: bill.totalAmount }); setInvoiceOpen(true); };

  const handleSaveEditedBill = async (updated) => {
    await api.put(`/purchases/bill/${encodeURIComponent(updated.billNumber)}`, {
      bill_number: updated.billNumber,
      date: updated.date,
      supplier_name: updated.partyName,
      warehouse_id: currentWarehouse.id,
      items: updated.items.map((it) => ({ itemId: it.itemId, sheets: it.sheets, uMolding: it.uMolding, lMolding: it.lMolding, pricePerSheet: it.pricePerSheet, pricePerU: it.pricePerU, pricePerL: it.pricePerL })),
    });
    fetchData();
  };

  const confirmDeleteBill = async () => {
    if (!deleteBill) return;
    setIsDeleting(true);
    try {
      await api.delete(`/purchases/bill/${encodeURIComponent(deleteBill.billNumber)}`, { params: { warehouse_id: currentWarehouse.id } });
      toast.success('Bill deleted');
      setDeleteBill(null);
      fetchData();
    } catch { toast.error('Delete failed'); }
    finally { setIsDeleting(false); }
  };

  const handleExport = () => {
    const blob = exportPurchasesToExcel(purchases);
    downloadBlob(blob, `purchases_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported');
  };

  const billGrandTotal = billItems.reduce((a, b) => a + b.itemTotal, 0);
  const filteredBills = groupedBills.filter((b) => {
    if (!billSearch) return true;
    const s = billSearch.toLowerCase();
    return b.billNumber.toLowerCase().includes(s) || (b.supplierName || '').toLowerCase().includes(s);
  });

  return (
    <>
      <Helmet><title>Purchases - StockFlow System</title></Helmet>
      <Header />
      <InvoicePrintModal isOpen={invoiceOpen} onClose={() => setInvoiceOpen(false)} saleData={selectedInvoice} warehouseName={currentWarehouse?.name} docType="PURCHASE ORDER" />
      <BillEditModal isOpen={editOpen} onClose={() => setEditOpen(false)} bill={editingBill} onSave={handleSaveEditedBill} isSales={false} />

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
            <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
            <p className="text-muted-foreground mt-1">Log incoming inventory for {currentWarehouse?.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Export</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {canEdit && (
            <div className="xl:col-span-5 flex flex-col gap-6">
              <Card className="shadow-sm border-border/50">
                <CardHeader className="bg-primary/5 pb-4 border-b"><CardTitle className="text-lg">Purchase Details</CardTitle></CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Bill No. *</Label><Input value={billData.billNumber} onChange={(e) => setBillData({ ...billData, billNumber: e.target.value })} placeholder="e.g. PO-1001" /></div>
                    <div className="space-y-2"><Label>Date *</Label><Input type="date" value={billData.date} onChange={(e) => setBillData({ ...billData, date: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Supplier Name *</Label><Input value={billData.supplierName} onChange={(e) => setBillData({ ...billData, supplierName: e.target.value })} placeholder="Supplier or Vendor" /></div>
                  <div className="h-px bg-border/50" />

                  <div className="space-y-4">
                    <ItemCodeSearchInput items={items} onSelect={(it) => setCurrentItem({ itemData: it, sheets: 0, uMolding: 0, lMolding: 0, price_per_sheet: 0, price_per_u_molding: 0, price_per_l_molding: 0 })} />
                    {currentItem.itemData && (
                      <div className="bg-muted/20 rounded-xl p-5 border space-y-4">
                        <p className="font-semibold border-b pb-2">{currentItem.itemData.name}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                          <div className="space-y-1"><Label className="text-xs font-semibold">Sheets to add</Label><Input type="number" min="0" value={currentItem.sheets || ''} onChange={(e) => setCurrentItem({ ...currentItem, sheets: parseInt(e.target.value) || 0 })} placeholder="Qty" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold text-primary">Cost / Sheet (₹)</Label><Input type="number" min="0" step="0.01" value={currentItem.price_per_sheet || ''} onChange={(e) => setCurrentItem({ ...currentItem, price_per_sheet: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold">U Mold to add</Label><Input type="number" min="0" value={currentItem.uMolding || ''} onChange={(e) => setCurrentItem({ ...currentItem, uMolding: parseInt(e.target.value) || 0 })} placeholder="Qty" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold text-primary">Cost / U Mold (₹)</Label><Input type="number" min="0" step="0.01" value={currentItem.price_per_u_molding || ''} onChange={(e) => setCurrentItem({ ...currentItem, price_per_u_molding: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold">L Mold to add</Label><Input type="number" min="0" value={currentItem.lMolding || ''} onChange={(e) => setCurrentItem({ ...currentItem, lMolding: parseInt(e.target.value) || 0 })} placeholder="Qty" /></div>
                          <div className="space-y-1"><Label className="text-xs font-semibold text-primary">Cost / L Mold (₹)</Label><Input type="number" min="0" step="0.01" value={currentItem.price_per_l_molding || ''} onChange={(e) => setCurrentItem({ ...currentItem, price_per_l_molding: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                        </div>
                        <div className="flex justify-between items-center bg-background p-3 rounded-lg border shadow-sm">
                          <span className="text-sm font-medium">Item Total:</span>
                          <span className="font-bold text-lg text-primary">₹{((currentItem.sheets * currentItem.price_per_sheet) + (currentItem.uMolding * currentItem.price_per_u_molding) + (currentItem.lMolding * currentItem.price_per_l_molding)).toFixed(2)}</span>
                        </div>
                        <Button onClick={handleAddItem} className="w-full"><Plus className="w-4 h-4 mr-2" /> Add to Order</Button>
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
                <CardHeader className="bg-muted/30 pb-4 border-b"><CardTitle className="text-lg">Current Order Items</CardTitle></CardHeader>
                <CardContent className="pt-6">
                  {billItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 opacity-60">
                      <FileText className="h-10 w-10 mb-3 text-muted-foreground" />
                      <p className="text-sm font-medium">Order is currently empty.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="overflow-x-auto border rounded-lg">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>Item Name</TableHead>
                              <TableHead className="text-right">Total Qty</TableHead>
                              <TableHead className="text-right">Total Cost</TableHead>
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
                        <span className="font-medium">Total Cost</span>
                        <span className="text-2xl font-bold text-primary">₹{billGrandTotal.toFixed(2)}</span>
                      </div>
                      <Button onClick={handleSaveBill} disabled={savingBill} className="w-full h-12 text-base font-semibold">
                        {savingBill ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</>) : (<><Save className="w-5 h-5 mr-2" /> Submit Purchase</>)}
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
                    <CardTitle className="text-lg">Recent Purchases</CardTitle>
                    <CardDescription>Click print to view existing purchase orders</CardDescription>
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
                    <p className="text-muted-foreground font-medium">{billSearch ? 'No bills match your search' : 'No purchases recorded'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead className="pl-6">Bill No.</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBills.map((bill) => (
                          <TableRow key={bill.billNumber}>
                            <TableCell className="font-medium pl-6">{bill.billNumber}</TableCell>
                            <TableCell>{bill.supplierName}</TableCell>
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

export default PurchasePage;
