import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, X, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// A4 Landscape @ 96dpi ~ 1123 x 794. We render at 2x for higher quality.
const A4_W_MM = 297;
const A4_H_MM = 210;
const RENDER_W = 1400; // px, ~118 dpi -> good quality when rasterized at scale 2
const RENDER_H = Math.round((RENDER_W * A4_H_MM) / A4_W_MM); // maintain A4 ratio

const StockPrintModal = ({ isOpen, onClose, items = [], warehouseName = '' }) => {
  const sheetRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const byCat = new Map();
    items.forEach((it) => {
      const key = it.category_name || 'Uncategorized';
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(it);
    });
    return Array.from(byCat.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, list]) => {
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        const hasUL = sorted.some((i) => (i.uMolding || 0) > 0 || (i.lMolding || 0) > 0);
        return { name, items: sorted, hasUL };
      });
  }, [items]);

  const totalCols = groups.reduce((s, g) => s + (g.hasUL ? 4 : 2), 0);
  const maxRows = groups.reduce((m, g) => Math.max(m, g.items.length), 0);

  // Base font size shrinks as rows/cols grow so single-page fit works even before scale-adjust
  const baseFont = (() => {
    if (maxRows <= 20 && totalCols <= 12) return 11;
    if (maxRows <= 30 && totalCols <= 16) return 10;
    if (maxRows <= 45 && totalCols <= 20) return 9;
    if (maxRows <= 60) return 8;
    return 7;
  })();

  // After render, measure and scale-down if content overflows the A4 area
  useLayoutEffect(() => {
    if (!isOpen) return;
    // Slight delay so table has laid out
    const id = requestAnimationFrame(() => {
      const outer = sheetRef.current;
      const inner = contentRef.current;
      if (!outer || !inner) return;
      const availW = outer.clientWidth - 2; // account for border
      const availH = outer.clientHeight - 2;
      // reset scale to measure natural size
      inner.style.transform = 'none';
      inner.style.transformOrigin = 'top left';
      const naturalW = inner.scrollWidth;
      const naturalH = inner.scrollHeight;
      const s = Math.min(1, availW / naturalW, availH / naturalH);
      setScale(s);
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, items, baseFont]);

  const handleDownload = async () => {
    if (!sheetRef.current) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(sheetRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: RENDER_W,
        windowHeight: RENDER_H,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(imgData, 'JPEG', 0, 0, A4_W_MM, A4_H_MM, undefined, 'FAST');
      const wh = (warehouseName || 'stock').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`stock_${wh}_${date}.pdf`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('PDF export failed', e);
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (r) => (
    <tr key={`r-${r}`}>
      {groups.map((g, gi) => {
        const it = g.items[r];
        const empty = !it;
        const cellStyle = { padding: '2px 4px', verticalAlign: 'middle' };
        if (g.hasUL) {
          return (
            <React.Fragment key={`c-${gi}-${r}`}>
              <td className="border border-black font-medium text-[#3b6dbf]" style={{ ...cellStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {empty ? '\u00a0' : it.name}
              </td>
              <td className="border border-black text-center tabular-nums" style={cellStyle}>
                {empty ? '' : Math.round(it.sheets || 0)}
              </td>
              <td className="border border-black text-center tabular-nums" style={cellStyle}>
                {empty ? '' : Math.round(it.uMolding || 0)}
              </td>
              <td className="border border-black text-center tabular-nums" style={cellStyle}>
                {empty ? '' : Math.round(it.lMolding || 0)}
              </td>
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={`c-${gi}-${r}`}>
            <td className="border border-black font-medium text-[#3b6dbf]" style={{ ...cellStyle, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {empty ? '\u00a0' : it.name}
            </td>
            <td className="border border-black text-center tabular-nums" style={cellStyle}>
              {empty ? '' : Math.round(it.sheets || 0)}
            </td>
          </React.Fragment>
        );
      })}
    </tr>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1240px] max-h-[95vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Print Stock Sheet {warehouseName ? `— ${warehouseName}` : ''}</DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleDownload} disabled={saving || items.length === 0}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Download PDF</>
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </DialogHeader>

        {/* Preview: shown at fixed A4 landscape aspect ratio, scaled to viewport width */}
        <div className="w-full overflow-auto bg-neutral-100 p-3 rounded-md flex justify-center">
          <div
            style={{
              width: `${RENDER_W}px`,
              height: `${RENDER_H}px`,
              transform: `scale(${Math.min(1, (window.innerWidth * 0.85) / RENDER_W)})`,
              transformOrigin: 'top center',
              flex: 'none',
            }}
          >
            <div
              ref={sheetRef}
              className="bg-white text-black shadow relative"
              style={{ width: `${RENDER_W}px`, height: `${RENDER_H}px`, padding: '18px 22px', boxSizing: 'border-box' }}
            >
              <div
                ref={contentRef}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  width: `${100 / scale}%`,
                }}
              >
                <div className="text-center font-bold tracking-widest" style={{ fontSize: `${baseFont + 4}px`, marginBottom: 4 }}>STOCK</div>
                {warehouseName && (
                  <div className="text-center text-black/60" style={{ fontSize: `${baseFont - 1}px`, marginBottom: 6 }}>
                    {warehouseName}
                  </div>
                )}

                {groups.length === 0 ? (
                  <div className="text-center text-black/50 py-10" style={{ fontSize: `${baseFont}px` }}>
                    No items in stock.
                  </div>
                ) : (
                  <table
                    className="w-full border-collapse"
                    style={{ tableLayout: 'fixed', fontSize: `${baseFont}px`, lineHeight: 1.15 }}
                  >
                    <thead>
                      <tr>
                        {groups.map((g, gi) =>
                          g.hasUL ? (
                            <React.Fragment key={`h-${gi}`}>
                              <th className="border border-black px-1 font-bold text-center bg-white" style={{ padding: '3px 4px', verticalAlign: 'middle' }}>ITEM</th>
                              <th className="border border-black px-1 font-bold text-center bg-white" style={{ width: '5%', padding: '3px 4px', verticalAlign: 'middle' }}>QTY.</th>
                              <th className="border border-black px-1 font-bold text-center bg-white" style={{ width: '4%', padding: '3px 4px', verticalAlign: 'middle' }}>U</th>
                              <th className="border border-black px-1 font-bold text-center bg-white" style={{ width: '4%', padding: '3px 4px', verticalAlign: 'middle' }}>L</th>
                            </React.Fragment>
                          ) : (
                            <React.Fragment key={`h-${gi}`}>
                              <th className="border border-black px-1 font-bold text-center bg-white" style={{ padding: '3px 4px', verticalAlign: 'middle' }}>ITEM</th>
                              <th className="border border-black px-1 font-bold text-center bg-white" style={{ width: '5%', padding: '3px 4px', verticalAlign: 'middle' }}>QTY.</th>
                            </React.Fragment>
                          )
                        )}
                      </tr>
                      <tr>
                        {groups.map((g, gi) => (
                          <th
                            key={`cat-${gi}`}
                            colSpan={g.hasUL ? 4 : 2}
                            className="border border-black/60 font-semibold text-center bg-black/[0.04] text-black/70"
                            style={{ fontSize: `${Math.max(6, baseFont - 2)}px`, padding: '2px 4px', verticalAlign: 'middle' }}
                          >
                            {g.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: maxRows }, (_, r) => renderRow(r))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Auto-fitted to a single A4 landscape page. Click <strong>Download PDF</strong> to save.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default StockPrintModal;
