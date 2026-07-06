import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Printer, X } from 'lucide-react';

const InvoicePrintModal = ({ isOpen, onClose, saleData, warehouseName, docType = 'INVOICE' }) => {
  if (!saleData) return null;

  const handlePrint = () => window.print();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="no-print flex flex-row items-center justify-between">
          <DialogTitle>{docType} Preview</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </DialogHeader>

        <div id="printable-invoice" className="bg-white text-black rounded-lg p-8">
          <div className="flex justify-between items-start pb-6 border-b-2 border-black/10">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">StockFlow</h2>
              <p className="text-sm text-black/60 mt-1">Inventory Management System</p>
              {warehouseName && <p className="text-sm mt-1"><strong>Warehouse:</strong> {warehouseName}</p>}
            </div>
            <div className="text-right">
              <h3 className="text-2xl font-bold">{docType}</h3>
              <p className="text-sm mt-1"><strong>Bill No:</strong> {saleData.billNumber}</p>
              <p className="text-sm"><strong>Date:</strong> {new Date(saleData.date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="py-6">
            <p className="text-sm font-semibold text-black/60">Bill To</p>
            <p className="text-lg font-semibold mt-1">{saleData.customerName || saleData.supplierName || 'Walk-in Customer'}</p>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-black/5">
                <th className="text-left p-3 border">Item</th>
                <th className="text-right p-3 border">Sheets</th>
                <th className="text-right p-3 border">U Mold</th>
                <th className="text-right p-3 border">L Mold</th>
                <th className="text-right p-3 border">Total</th>
              </tr>
            </thead>
            <tbody>
              {saleData.items?.map((it, i) => (
                <tr key={i}>
                  <td className="p-3 border">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-black/50">{it.categoryName || ''}</div>
                  </td>
                  <td className="text-right p-3 border tabular-nums">{it.sheets}</td>
                  <td className="text-right p-3 border tabular-nums">{it.uMolding}</td>
                  <td className="text-right p-3 border tabular-nums">{it.lMolding}</td>
                  <td className="text-right p-3 border tabular-nums font-medium">₹{Number(it.itemTotal || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right p-3 border font-semibold">Grand Total</td>
                <td className="text-right p-3 border font-bold text-lg tabular-nums">₹{Number(saleData.grandTotal || 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <p className="text-xs text-center text-black/50 mt-8">Thank you for your business.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoicePrintModal;
