import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { X, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

const BillEditModal = ({ isOpen, onClose, bill, onSave, isSales = true }) => {
  const [billData, setBillData] = useState({ billNumber: '', date: '', partyName: '' });
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bill) {
      setBillData({
        billNumber: bill.billNumber,
        date: bill.date?.split('T')[0] || bill.date,
        partyName: isSales ? (bill.customerName || '') : (bill.supplierName || ''),
      });
      setItems(bill.items?.map((it) => ({ ...it })) || []);
    }
  }, [bill, isSales]);

  const updateItem = (idx, field, val) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: field.startsWith('price') ? parseFloat(val) || 0 : parseInt(val) || 0 };
    next[idx].itemTotal = (next[idx].sheets * next[idx].pricePerSheet) + (next[idx].uMolding * next[idx].pricePerU) + (next[idx].lMolding * next[idx].pricePerL);
    setItems(next);
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!billData.billNumber.trim()) return toast.error('Bill number required');
    if (items.length === 0) return toast.error('At least one item required');
    setSaving(true);
    try {
      await onSave({ ...billData, items });
      toast.success('Bill updated');
      onClose();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const grandTotal = items.reduce((s, i) => s + i.itemTotal, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bill {bill?.billNumber}</DialogTitle>
          <DialogDescription>Modify bill details and item quantities/prices</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Bill Number</Label>
              <Input value={billData.billNumber} onChange={(e) => setBillData({ ...billData, billNumber: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={billData.date} onChange={(e) => setBillData({ ...billData, date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{isSales ? 'Customer' : 'Supplier'}</Label>
              <Input value={billData.partyName} onChange={(e) => setBillData({ ...billData, partyName: e.target.value })} />
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Sheets</TableHead>
                  <TableHead className="text-right">P/Sheet</TableHead>
                  <TableHead className="text-right">U</TableHead>
                  <TableHead className="text-right">P/U</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell><Input type="number" min="0" value={it.sheets} onChange={(e) => updateItem(i, 'sheets', e.target.value)} className="w-16 text-right" /></TableCell>
                    <TableCell><Input type="number" min="0" step="0.01" value={it.pricePerSheet} onChange={(e) => updateItem(i, 'pricePerSheet', e.target.value)} className="w-20 text-right" /></TableCell>
                    <TableCell><Input type="number" min="0" value={it.uMolding} onChange={(e) => updateItem(i, 'uMolding', e.target.value)} className="w-16 text-right" /></TableCell>
                    <TableCell><Input type="number" min="0" step="0.01" value={it.pricePerU} onChange={(e) => updateItem(i, 'pricePerU', e.target.value)} className="w-20 text-right" /></TableCell>
                    <TableCell><Input type="number" min="0" value={it.lMolding} onChange={(e) => updateItem(i, 'lMolding', e.target.value)} className="w-16 text-right" /></TableCell>
                    <TableCell><Input type="number" min="0" step="0.01" value={it.pricePerL} onChange={(e) => updateItem(i, 'pricePerL', e.target.value)} className="w-20 text-right" /></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">₹{it.itemTotal.toFixed(2)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeItem(i)} className="text-destructive hover:bg-destructive/10"><X className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center px-4 py-3 bg-muted/30 rounded-lg border">
            <span className="font-medium">Grand Total</span>
            <span className="text-xl font-bold text-primary">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4 mr-2" />Save Changes</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BillEditModal;
