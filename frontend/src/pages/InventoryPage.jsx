import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { exportInventoryToExcel, downloadBlob, validateInventoryData } from '../lib/excelUtils';
import Header from '../components/Header';
import ImagePreviewModal from '../components/ImagePreviewModal';
import StockPrintModal from '../components/StockPrintModal';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Pencil, Trash2, Search, X, Download, Upload, Image as ImageIcon, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const InventoryPage = () => {
  const { currentUser, currentWarehouse, canEditData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState({ data: [], errors: [], missingCategories: [] });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', sheets: 0, uMolding: 0, lMolding: 0, image: null });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const isLowStock = searchParams.get('filter') === 'lowStock';
  const canEdit = canEditData();

  const fetchData = useCallback(async () => {
    if (!currentWarehouse) return;
    try {
      setLoading(true);
      const [it, cats] = await Promise.all([
        api.get('/inventory', { params: { warehouse_id: currentWarehouse.id } }).then((r) => r.data),
        api.get('/categories', { params: { warehouse_id: currentWarehouse.id } }).then((r) => r.data),
      ]);
      setItems(it);
      setCategories(cats);
      setSelectedItems([]);
    } catch (e) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [currentWarehouse]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    if (!formData.name.trim() || !formData.category) return toast.error('Fill required fields');
    setSubmitting(true);
    try {
      let imageStr = undefined;
      if (formData.image instanceof File) {
        imageStr = await fileToDataUrl(formData.image);
      }
      if (editingId) {
        await api.put(`/inventory/${editingId}`, {
          name: formData.name,
          category: formData.category,
          sheets: Number(formData.sheets) || 0,
          uMolding: Number(formData.uMolding) || 0,
          lMolding: Number(formData.lMolding) || 0,
          ...(imageStr ? { image: imageStr } : {}),
        });
        toast.success('Item updated');
      } else {
        await api.post('/inventory', {
          name: formData.name,
          category: formData.category,
          warehouse_id: currentWarehouse.id,
          sheets: Number(formData.sheets) || 0,
          uMolding: Number(formData.uMolding) || 0,
          lMolding: Number(formData.lMolding) || 0,
          image: imageStr,
        });
        toast.success('Item created');
      }
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', category: '', sheets: 0, uMolding: 0, lMolding: 0, image: null });
    if (imageInputRef.current) imageInputRef.current.value = '';
    setEditingId(null);
  };

  const handleEdit = (item) => {
    if (!canEdit) return;
    setFormData({
      name: item.name, category: item.category || '',
      sheets: item.sheets || 0, uMolding: item.uMolding || 0, lMolding: item.lMolding || 0, image: null
    });
    if (imageInputRef.current) imageInputRef.current.value = '';
    setEditingId(item.id);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`/inventory/${itemToDelete.id}`);
      toast.success('Item deleted');
      setItemToDelete(null);
      fetchData();
    } catch (e) {
      toast.error('Failed to delete');
    } finally { setIsDeleting(false); }
  };

  const executeBulkDelete = async () => {
    setIsDeleting(true);
    try {
      for (const id of selectedItems) {
        await api.delete(`/inventory/${id}`);
      }
      toast.success(`Deleted ${selectedItems.length} items`);
      setSelectedItems([]);
      setIsBulkDeleteOpen(false);
      fetchData();
    } catch (e) {
      toast.error('Bulk delete failed');
    } finally { setIsDeleting(false); }
  };

  const handleExport = () => {
    const blob = exportInventoryToExcel(items);
    const date = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `inventory_export_${date}.xlsx`);
    toast.success('Exported');
  };

  const handleFileUpload = (e) => {
    if (!canEdit) return;
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.xlsx$/i)) {
      toast.error('Please upload a .xlsx file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);
        const result = validateInventoryData(rows, items, categories);
        setImportResult(result);
        setIsImportOpen(true);
      } catch (err) {
        toast.error('Failed to parse Excel file');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const executeImport = async () => {
    setImporting(true);
    try {
      const res = await api.post('/inventory/bulk', {
        warehouse_id: currentWarehouse.id,
        items: importResult.data.map((r) => ({ name: r.name, category_id: r.category_id, category_name: r.categoryName, sheets: r.sheets, uMolding: r.uMolding, lMolding: r.lMolding })),
        auto_categories: importResult.missingCategories.map((c) => c.name),
      });
      const d = res.data;
      toast.success(`Import: ${d.created} created, ${d.updated} updated (${d.auto_created_categories} new categories)`);
      setIsImportOpen(false);
      fetchData();
    } catch (e) {
      toast.error('Import failed');
    } finally { setImporting(false); }
  };

  let filtered = items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  if (isLowStock) filtered = filtered.filter((i) => i.sheets < 10 || i.uMolding < 10 || i.lMolding < 10);
  const isAllSelected = filtered.length > 0 && selectedItems.length === filtered.length;

  return (
    <>
      <Helmet><title>Inventory - StockFlow System</title></Helmet>
      <Header />

      <ImagePreviewModal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} imageUrl={previewImage?.image} altText={previewImage?.name || ''} />

      <StockPrintModal isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} items={items} warehouseName={currentWarehouse?.name} />

      <AlertDialog open={!!itemToDelete} onOpenChange={(o) => { if (!o && !isDeleting) setItemToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/80 mt-2">
              This will delete <strong className="text-foreground">"{itemToDelete?.name}"</strong> and all related sales/purchase records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); executeDelete(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-w-[100px]">
              {isDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={(o) => { if (!o && !isDeleting) setIsBulkDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedItems.length} items?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/80 mt-2">
              You are about to delete <strong className="text-foreground">{selectedItems.length} items</strong> and all their related sales/purchase records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); executeBulkDelete(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-w-[140px]">
              {isDeleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>) : `Delete ${selectedItems.length} Items`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportOpen} onOpenChange={(o) => { if (!o && !importing) setIsImportOpen(false); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Validation Results</DialogTitle>
            <DialogDescription>Review results before importing.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {importResult.errors?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-destructive flex items-center gap-2"><X className="w-4 h-4" /> Critical Errors ({importResult.errors.length})</h4>
                <ScrollArea className="h-40 border border-destructive/20 rounded-md p-3 bg-destructive/5 text-sm">
                  {importResult.errors.map((err, i) => (<div key={i} className="mb-1 text-destructive font-medium">Row {err.row}: {err.message}</div>))}
                </ScrollArea>
              </div>
            )}
            {importResult.missingCategories?.length > 0 && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <h4 className="font-semibold text-primary">Auto-Create Categories</h4>
                <p className="text-sm text-primary/80 mt-1">
                  <strong>{importResult.missingCategories.length}</strong> new categories will be created.
                </p>
              </div>
            )}
            <div className="p-4 bg-muted/30 border rounded-lg flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Ready to Import</h4>
                <p className="text-sm text-muted-foreground">Rows that passed validation</p>
              </div>
              <div className="text-3xl font-bold tabular-nums text-primary">{importResult.data?.length || 0}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={importing}>Cancel</Button>
            <Button onClick={executeImport} disabled={importing || !importResult.data?.length} className="min-w-[140px]">
              {importing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>) : 'Import Valid Rows'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">Manage stock items for {currentWarehouse?.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search items..." className="pl-9 w-full sm:w-64" />
            </div>
            <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Export to Excel</Button>
            <Button variant="outline" onClick={() => setIsPrintOpen(true)}><Printer className="w-4 h-4 mr-2" /> Print Stock</Button>
            {canEdit && (
              <>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                  <Upload className="w-4 h-4 mr-2" /> {importing ? 'Processing...' : 'Import from Excel'}
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx" />
              </>
            )}
          </div>
        </div>

        {isLowStock && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
            <span className="font-medium">Showing Low Stock Items</span>
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({})} className="text-destructive hover:text-destructive hover:bg-destructive/20">
              <X className="w-4 h-4 mr-1" /> Clear Filter
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className={`shadow-sm border-border/50 ${!canEdit ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
            <CardHeader className="bg-muted/30 pb-4 border-b flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Inventory Items</CardTitle>
              {selectedItems.length > 0 && canEdit && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{selectedItems.length} selected</span>
                  <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-2" /> Delete</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-4 p-6">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted/50 rounded animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 m-6 border border-dashed rounded-lg bg-muted/20">
                  <p className="text-muted-foreground font-medium">{items.length === 0 ? 'No items yet. Create a category then add an item.' : 'No items match your filter'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        {canEdit && (
                          <TableHead className="w-[40px] pl-4">
                            <Checkbox checked={isAllSelected} onCheckedChange={(c) => setSelectedItems(c ? filtered.map((i) => i.id) : [])} />
                          </TableHead>
                        )}
                        <TableHead className={!canEdit ? 'pl-6 w-[60px]' : 'w-[60px]'}>Image</TableHead>
                        <TableHead>Item Code / Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">U Mold</TableHead>
                        <TableHead className="text-right">L Mold</TableHead>
                        {canEdit && <TableHead className="text-right pr-6">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((item) => (
                        <TableRow key={item.id} className={selectedItems.includes(item.id) ? 'bg-muted/30' : ''}>
                          {canEdit && (
                            <TableCell className="pl-4">
                              <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={(c) => setSelectedItems((prev) => c ? [...prev, item.id] : prev.filter((x) => x !== item.id))} />
                            </TableCell>
                          )}
                          <TableCell className={`${!canEdit ? 'pl-6' : ''} py-3`}>
                            {item.image ? (
                              <button onClick={() => setPreviewImage(item)} className="focus:outline-none rounded-md transition-transform hover:scale-105">
                                <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-md border bg-muted" />
                              </button>
                            ) : (
                              <div className="w-10 h-10 bg-muted/50 rounded-md flex items-center justify-center border text-muted-foreground">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{item.category_name || 'Uncategorized'}</TableCell>
                          <TableCell className="text-right tabular-nums"><span className={item.sheets < 10 ? 'text-destructive font-semibold' : ''}>{Math.round(item.sheets)}</span></TableCell>
                          <TableCell className="text-right tabular-nums"><span className={item.uMolding < 10 ? 'text-destructive font-semibold' : ''}>{Math.round(item.uMolding)}</span></TableCell>
                          <TableCell className="text-right tabular-nums"><span className={item.lMolding < 10 ? 'text-destructive font-semibold' : ''}>{Math.round(item.lMolding)}</span></TableCell>
                          {canEdit && (
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="hover:bg-destructive/10 text-destructive" onClick={() => setItemToDelete(item)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {canEdit && (
            <Card className="shadow-sm h-fit sticky top-[88px] border-border/50">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <CardTitle>{editingId ? 'Edit Item' : 'Create Item'}</CardTitle>
                <CardDescription>Record inventory quantities</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="image">Product Image</Label>
                    <Input id="image" type="file" accept="image/*" ref={imageInputRef} onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Item Name *</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 bg-muted/20 border rounded-lg space-y-4">
                    <Label className="text-sm font-semibold mb-2 block">Starting Stock Quantities</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="sheets" className="text-xs text-muted-foreground uppercase">Quantity</Label>
                        <Input id="sheets" type="number" min="0" value={formData.sheets} onChange={(e) => setFormData({ ...formData, sheets: parseFloat(e.target.value) || 0 })} className="text-center" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="uMolding" className="text-xs text-muted-foreground uppercase">U Mold</Label>
                        <Input id="uMolding" type="number" min="0" value={formData.uMolding} onChange={(e) => setFormData({ ...formData, uMolding: parseFloat(e.target.value) || 0 })} className="text-center" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="lMolding" className="text-xs text-muted-foreground uppercase">L Mold</Label>
                        <Input id="lMolding" type="number" min="0" value={formData.lMolding} onChange={(e) => setFormData({ ...formData, lMolding: parseFloat(e.target.value) || 0 })} className="text-center" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? 'Saving...' : (editingId ? 'Update Item' : 'Create Item')}</Button>
                    {editingId && (<Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>)}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default InventoryPage;
