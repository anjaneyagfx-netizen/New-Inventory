import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, X, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';

// A4 landscape in mm
const PAGE_W = 297;
const PAGE_H = 210;

/**
 * Group items by category. Categories that have any U/L stock get 4 sub-columns
 * (ITEM, QTY, U, L). Otherwise they get 2 (ITEM, QTY).
 */
const buildGroups = (items) => {
  const byCat = new Map();
  items.forEach((it) => {
    const key = it.category_name || 'Uncategorized';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key).push(it);
  });
  return Array.from(byCat.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, list]) => ({
      name,
      items: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      hasUL: list.some((i) => (i.uMolding || 0) > 0 || (i.lMolding || 0) > 0),
    }));
};

/**
 * Draw the single-page stock PDF using pure jsPDF vector primitives.
 * Auto-sizes fonts and column widths so all items fit on one A4 landscape page.
 */
const drawStockPdf = (items, warehouseName) => {
  const groups = buildGroups(items);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Layout constants
  const MARGIN_X = 8;
  const MARGIN_Y = 8;
  const TITLE_H = 7;
  const SUB_H = 4.2;
  const HDR_H = 5;
  const CAT_H = 4;

  // Page title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(0, 0, 0);
  pdf.text('STOCK', PAGE_W / 2, MARGIN_Y + TITLE_H - 1, { align: 'center' });

  if (warehouseName) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(90, 90, 90);
    pdf.text(warehouseName, PAGE_W / 2, MARGIN_Y + TITLE_H + SUB_H - 1, { align: 'center' });
  }

  if (groups.length === 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text('No items in stock.', PAGE_W / 2, PAGE_H / 2, { align: 'center' });
    return pdf;
  }

  // Table body area
  const bodyTop = MARGIN_Y + TITLE_H + (warehouseName ? SUB_H : 0) + 1;
  const bodyBottom = PAGE_H - MARGIN_Y;
  const bodyHeight = bodyBottom - bodyTop;
  const tableWidth = PAGE_W - MARGIN_X * 2;

  // Compute column widths per group. In each group the ITEM col takes most of the width;
  // QTY/U/L cols are compact fixed-mm.
  const numericColW = 6.5; // mm per numeric column (QTY, U, L)
  const groupGap = 0; // no gap between groups (borders touch)

  // Total width used by numeric columns across all groups
  const numericW = groups.reduce((s, g) => s + (g.hasUL ? 3 : 1) * numericColW, 0);
  const remainingForItems = tableWidth - numericW - groupGap * Math.max(0, groups.length - 1);

  // Distribute the remaining width across all ITEM columns (one per group), weighted by item-name length
  const groupWeights = groups.map((g) => {
    const avgLen = g.items.length
      ? g.items.reduce((s, it) => s + (it.name || '').length, 0) / g.items.length
      : 8;
    return Math.max(6, Math.min(18, avgLen));
  });
  const weightSum = groupWeights.reduce((a, b) => a + b, 0) || 1;
  const itemColWidths = groupWeights.map((w) => (w / weightSum) * remainingForItems);

  // Compute row height and font size to fit maxRows on one page
  const maxRows = groups.reduce((m, g) => Math.max(m, g.items.length), 0);
  const availableRowsHeight = bodyHeight - HDR_H - CAT_H;
  const rowH = Math.max(2.6, availableRowsHeight / Math.max(1, maxRows));
  // Pick a font size roughly 60% of row height, capped for readability
  let fontSize = Math.max(4.5, Math.min(9, rowH * 2.05));

  // Group X positions
  const groupXs = [];
  const groupWidths = [];
  let curX = MARGIN_X;
  groups.forEach((g, gi) => {
    const cols = g.hasUL ? 4 : 2;
    const gw = itemColWidths[gi] + (cols === 4 ? 3 : 1) * numericColW;
    groupXs.push(curX);
    groupWidths.push(gw);
    curX += gw;
  });

  const drawLine = (x1, y1, x2, y2) => {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(x1, y1, x2, y2);
  };

  // Draw header row (ITEM / QTY / U / L)
  const headerY = bodyTop;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  groups.forEach((g, gi) => {
    const x = groupXs[gi];
    const itemW = itemColWidths[gi];
    // ITEM col
    pdf.rect(x, headerY, itemW, HDR_H);
    pdf.text('ITEM', x + itemW / 2, headerY + HDR_H / 2 + 1.2, { align: 'center' });
    let cx = x + itemW;
    // QTY
    pdf.rect(cx, headerY, numericColW, HDR_H);
    pdf.text('QTY.', cx + numericColW / 2, headerY + HDR_H / 2 + 1.2, { align: 'center' });
    cx += numericColW;
    if (g.hasUL) {
      pdf.rect(cx, headerY, numericColW, HDR_H);
      pdf.text('U', cx + numericColW / 2, headerY + HDR_H / 2 + 1.2, { align: 'center' });
      cx += numericColW;
      pdf.rect(cx, headerY, numericColW, HDR_H);
      pdf.text('L', cx + numericColW / 2, headerY + HDR_H / 2 + 1.2, { align: 'center' });
    }
  });

  // Draw category subheader row
  const catY = headerY + HDR_H;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setFillColor(240, 240, 240);
  pdf.setTextColor(60, 60, 60);
  groups.forEach((g, gi) => {
    const gw = groupWidths[gi];
    pdf.rect(groupXs[gi], catY, gw, CAT_H, 'FD');
    pdf.text(g.name, groupXs[gi] + gw / 2, catY + CAT_H / 2 + 1.1, { align: 'center', maxWidth: gw - 1 });
  });

  // Body rows: draw each group independently
  const bodyStartY = catY + CAT_H;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.15);

  groups.forEach((g, gi) => {
    const x = groupXs[gi];
    const itemW = itemColWidths[gi];
    const gw = groupWidths[gi];

    // Draw outer vertical lines (left and right of group) once, spanning all rows
    drawLine(x, bodyStartY, x, bodyStartY + rowH * maxRows);
    drawLine(x + gw, bodyStartY, x + gw, bodyStartY + rowH * maxRows);
    // Vertical dividers between ITEM/QTY/U/L
    let cx = x + itemW;
    drawLine(cx, bodyStartY, cx, bodyStartY + rowH * maxRows);
    cx += numericColW;
    drawLine(cx, bodyStartY, cx, bodyStartY + rowH * maxRows);
    if (g.hasUL) {
      cx += numericColW;
      drawLine(cx, bodyStartY, cx, bodyStartY + rowH * maxRows);
      cx += numericColW;
      drawLine(cx, bodyStartY, cx, bodyStartY + rowH * maxRows);
    }

    // Horizontal lines & content per row
    for (let r = 0; r < maxRows; r++) {
      const y = bodyStartY + r * rowH;
      // horizontal line at bottom of row
      drawLine(x, y + rowH, x + gw, y + rowH);
      if (r === 0) drawLine(x, y, x + gw, y);

      const it = g.items[r];
      if (!it) continue;

      const textY = y + rowH / 2 + fontSize * 0.11;

      // ITEM name (blue, left-aligned, clipped to column width)
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(59, 109, 191); // #3B6DBF
      const nameStr = String(it.name || '');
      const displayName = truncateToWidth(pdf, nameStr, itemW - 1.5);
      pdf.text(displayName, x + 1, textY);

      // QTY (black, centered)
      pdf.setTextColor(0, 0, 0);
      let cx2 = x + itemW;
      pdf.text(String(Math.round(it.sheets || 0)), cx2 + numericColW / 2, textY, { align: 'center' });
      cx2 += numericColW;
      if (g.hasUL) {
        pdf.text(String(Math.round(it.uMolding || 0)), cx2 + numericColW / 2, textY, { align: 'center' });
        cx2 += numericColW;
        pdf.text(String(Math.round(it.lMolding || 0)), cx2 + numericColW / 2, textY, { align: 'center' });
      }
    }
  });

  return pdf;
};

// Trim a string until it fits inside a given mm-width for the pdf's current font.
const truncateToWidth = (pdf, str, maxWidthMm) => {
  if (!str) return '';
  if (pdf.getTextWidth(str) <= maxWidthMm) return str;
  let s = str;
  while (s.length > 1 && pdf.getTextWidth(s + '…') > maxWidthMm) {
    s = s.slice(0, -1);
  }
  return s + '…';
};

const StockPrintModal = ({ isOpen, onClose, items = [], warehouseName = '' }) => {
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => buildGroups(items), [items]);
  const totalItems = items.length;
  const totalCategories = groups.length;

  const handleDownload = async () => {
    setSaving(true);
    try {
      const pdf = drawStockPdf(items, warehouseName);
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

  // Small on-screen preview: renders the same layout with plain HTML for user confirmation.
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[95vh] overflow-y-auto">
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

        <div className="bg-neutral-100 rounded-md p-4">
          <div
            className="bg-white shadow mx-auto"
            style={{
              width: '100%',
              maxWidth: '1100px',
              aspectRatio: `${PAGE_W} / ${PAGE_H}`,
              padding: '10px 14px',
              boxSizing: 'border-box',
              overflow: 'hidden',
              color: '#000',
            }}
          >
            <div className="text-center font-bold tracking-widest" style={{ fontSize: '14px', marginBottom: 2 }}>STOCK</div>
            {warehouseName && (
              <div className="text-center" style={{ fontSize: '9px', color: '#5a5a5a', marginBottom: 4 }}>{warehouseName}</div>
            )}

            {groups.length === 0 ? (
              <div className="text-center py-16 text-sm text-black/50">No items in stock.</div>
            ) : (
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed', fontSize: '9px', lineHeight: 1.15 }}>
                <thead>
                  <tr>
                    {groups.map((g, gi) =>
                      g.hasUL ? (
                        <React.Fragment key={`h-${gi}`}>
                          <th style={cellHeader}>ITEM</th>
                          <th style={{ ...cellHeader, width: '4.5%' }}>QTY.</th>
                          <th style={{ ...cellHeader, width: '3.5%' }}>U</th>
                          <th style={{ ...cellHeader, width: '3.5%' }}>L</th>
                        </React.Fragment>
                      ) : (
                        <React.Fragment key={`h-${gi}`}>
                          <th style={cellHeader}>ITEM</th>
                          <th style={{ ...cellHeader, width: '4.5%' }}>QTY.</th>
                        </React.Fragment>
                      )
                    )}
                  </tr>
                  <tr>
                    {groups.map((g, gi) => (
                      <th
                        key={`cat-${gi}`}
                        colSpan={g.hasUL ? 4 : 2}
                        style={{ ...cellCat }}
                      >
                        {g.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(...groups.map((g) => g.items.length), 0) }, (_, r) => (
                    <tr key={`r-${r}`}>
                      {groups.map((g, gi) => {
                        const it = g.items[r];
                        const empty = !it;
                        if (g.hasUL) {
                          return (
                            <React.Fragment key={`c-${gi}-${r}`}>
                              <td style={cellItem}>{empty ? '\u00a0' : it.name}</td>
                              <td style={cellNum}>{empty ? '' : Math.round(it.sheets || 0)}</td>
                              <td style={cellNum}>{empty ? '' : Math.round(it.uMolding || 0)}</td>
                              <td style={cellNum}>{empty ? '' : Math.round(it.lMolding || 0)}</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={`c-${gi}-${r}`}>
                            <td style={cellItem}>{empty ? '\u00a0' : it.name}</td>
                            <td style={cellNum}>{empty ? '' : Math.round(it.sheets || 0)}</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {totalItems} items across {totalCategories} categories — auto-fitted to a single A4 landscape page. Click <strong>Download PDF</strong> to save.
        </p>
      </DialogContent>
    </Dialog>
  );
};

const cellHeader = {
  border: '1px solid #000',
  padding: '3px 4px',
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: 'middle',
  background: '#fff',
};
const cellCat = {
  border: '1px solid #666',
  padding: '2px 4px',
  fontWeight: 600,
  textAlign: 'center',
  verticalAlign: 'middle',
  background: '#f2f2f2',
  color: '#555',
  fontSize: '7.5px',
};
const cellItem = {
  border: '1px solid #000',
  padding: '2px 4px',
  color: '#3b6dbf',
  fontWeight: 500,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const cellNum = {
  border: '1px solid #000',
  padding: '2px 4px',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontVariantNumeric: 'tabular-nums',
};

export default StockPrintModal;
