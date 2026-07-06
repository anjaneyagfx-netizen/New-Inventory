import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Printer, X } from 'lucide-react';

/**
 * Renders a printable stock sheet grouped by category in the classic side-by-side layout.
 * Each category becomes a vertical block of columns. Categories with any U/L stock get
 * 4 columns (ITEM, QTY, U, L); otherwise they render as 2 columns (ITEM, QTY).
 */
const StockPrintModal = ({ isOpen, onClose, items = [], warehouseName = '' }) => {
  const groups = useMemo(() => {
    const byCat = new Map();
    items.forEach((it) => {
      const key = it.category_name || 'Uncategorized';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(it);
    });
    // Sort items alphabetically inside each group and sort category names
    const arr = Array.from(byCat.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, list]) => {
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        const hasUL = sorted.some((i) => (i.uMolding || 0) > 0 || (i.lMolding || 0) > 0);
        return { name, items: sorted, hasUL };
      });
    return arr;
  }, [items]);

  const totalCols = groups.reduce((s, g) => s + (g.hasUL ? 4 : 2), 0);
  const handlePrint = () => window.print();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] overflow-y-auto">
        <DialogHeader className="no-print flex flex-row items-center justify-between">
          <DialogTitle>Print Stock Sheet {warehouseName ? `— ${warehouseName}` : ''}</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div id="printable-invoice" className="bg-white text-black p-6">
          <div className="text-center font-bold text-lg mb-2 tracking-widest">STOCK</div>
          {warehouseName && (
            <div className="text-center text-xs text-black/60 mb-3 no-print">{warehouseName}</div>
          )}

          {groups.length === 0 ? (
            <div className="text-center text-sm text-black/50 py-10">No items in stock.</div>
          ) : (
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {groups.map((g, gi) =>
                    g.hasUL ? (
                      <React.Fragment key={`h-${gi}`}>
                        <th className="border border-black/70 px-1.5 py-1 font-bold text-center bg-white">ITEM</th>
                        <th className="border border-black/70 px-1.5 py-1 font-bold text-center bg-white w-[7%]">QTY.</th>
                        <th className="border border-black/70 px-1.5 py-1 font-bold text-center bg-white w-[5%]">U</th>
                        <th className="border border-black/70 px-1.5 py-1 font-bold text-center bg-white w-[5%]">L</th>
                      </React.Fragment>
                    ) : (
                      <React.Fragment key={`h-${gi}`}>
                        <th className="border border-black/70 px-1.5 py-1 font-bold text-center bg-white">ITEM</th>
                        <th className="border border-black/70 px-1.5 py-1 font-bold text-center bg-white w-[7%]">QTY.</th>
                      </React.Fragment>
                    )
                  )}
                </tr>
                {/* Category name row (subtle, muted) */}
                <tr className="no-print-hide">
                  {groups.map((g, gi) => (
                    <th
                      key={`cat-${gi}`}
                      colSpan={g.hasUL ? 4 : 2}
                      className="border border-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-center bg-black/[0.04] text-black/70"
                    >
                      {g.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const maxRows = Math.max(...groups.map((g) => g.items.length), 0);
                  const rows = [];
                  for (let r = 0; r < maxRows; r++) {
                    rows.push(
                      <tr key={`r-${r}`}>
                        {groups.map((g, gi) => {
                          const it = g.items[r];
                          if (!it) {
                            return g.hasUL ? (
                              <React.Fragment key={`c-${gi}-${r}`}>
                                <td className="border border-black/70 px-1.5 py-1">&nbsp;</td>
                                <td className="border border-black/70 px-1.5 py-1">&nbsp;</td>
                                <td className="border border-black/70 px-1.5 py-1">&nbsp;</td>
                                <td className="border border-black/70 px-1.5 py-1">&nbsp;</td>
                              </React.Fragment>
                            ) : (
                              <React.Fragment key={`c-${gi}-${r}`}>
                                <td className="border border-black/70 px-1.5 py-1">&nbsp;</td>
                                <td className="border border-black/70 px-1.5 py-1">&nbsp;</td>
                              </React.Fragment>
                            );
                          }
                          return g.hasUL ? (
                            <React.Fragment key={`c-${gi}-${r}`}>
                              <td className="border border-black/70 px-1.5 py-1 font-medium text-[#3b6dbf] truncate">
                                {it.name}
                              </td>
                              <td className="border border-black/70 px-1.5 py-1 text-center tabular-nums">
                                {Math.round(it.sheets || 0)}
                              </td>
                              <td className="border border-black/70 px-1.5 py-1 text-center tabular-nums">
                                {Math.round(it.uMolding || 0)}
                              </td>
                              <td className="border border-black/70 px-1.5 py-1 text-center tabular-nums">
                                {Math.round(it.lMolding || 0)}
                              </td>
                            </React.Fragment>
                          ) : (
                            <React.Fragment key={`c-${gi}-${r}`}>
                              <td className="border border-black/70 px-1.5 py-1 font-medium text-[#3b6dbf] truncate">
                                {it.name}
                              </td>
                              <td className="border border-black/70 px-1.5 py-1 text-center tabular-nums">
                                {Math.round(it.sheets || 0)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          )}

          <div className="text-[10px] text-black/50 mt-3 text-right no-print">
            {items.length} items across {groups.length} categories \u00b7 {totalCols} columns
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StockPrintModal;
