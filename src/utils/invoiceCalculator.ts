import type { InvoiceItem, InvoiceRecord, TaxDetail } from '../types/invoice';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseBrDate(dateStr: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateStr.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

export function diffDaysBr(startStr: string, endStr: string): number | null {
  const start = parseBrDate(startStr);
  const end = parseBrDate(endStr);
  if (!start || !end) return null;
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

const MONTH_MAP: Record<string, string> = {
  janeiro: 'JAN',
  jan: 'JAN',
  fevereiro: 'FEB',
  fev: 'FEB',
  março: 'MAR',
  marco: 'MAR',
  mar: 'MAR',
  abril: 'APR',
  abr: 'APR',
  maio: 'MAY',
  mai: 'MAY',
  junho: 'JUN',
  jun: 'JUN',
  julho: 'JUL',
  jul: 'JUL',
  agosto: 'AUG',
  ago: 'AUG',
  setembro: 'SEP',
  set: 'SEP',
  outubro: 'OCT',
  out: 'OCT',
  novembro: 'NOV',
  nov: 'NOV',
  dezembro: 'DEC',
  dez: 'DEC',
};

export function deriveMonthCode(referenceLabel: string, fallback: string): string {
  const parts = referenceLabel.trim().split('/');
  if (parts.length !== 2) return fallback;
  const monthPart = parts[0].trim().toLowerCase();
  const yearPart = parts[1].trim();
  const code = MONTH_MAP[monthPart];
  if (!code || yearPart.length < 2) return fallback;
  return `${code}${yearPart.slice(-2)}`;
}

export function updateBarcodeWithAmount(barcode: string, amount: number): string {
  const cents = String(Math.max(0, Math.round(amount * 100))).padStart(10, '0');
  const trimmed = barcode.trim();
  // Replace last 10 digits of the boleto line if formatted like standard FEBRABAN 14-digit tail
  const match = /^(.*\s\d{4})(\d{10})$/.exec(trimmed);
  if (match) {
    return `${match[1]}${cents}`;
  }
  if (trimmed.length >= 10 && /\d{10}$/.test(trimmed)) {
    return trimmed.slice(0, -10) + cents;
  }
  return trimmed;
}

function recalculateItem(item: InvoiceItem, source: 'qtyOrPrice' | 'amount'): InvoiceItem {
  const next = { ...item };
  if (source === 'qtyOrPrice' && next.quantity !== null && next.unitPriceWithTax !== null) {
    next.amount = round2(next.quantity * next.unitPriceWithTax);
  }
  if (next.icmsRate > 0) {
    next.icmsBase = next.amount;
    next.icmsValue = round2(next.amount * (next.icmsRate / 100));
    next.pisCofins = round2(next.amount * 0.0485);
  } else {
    next.icmsBase = null;
    next.icmsValue = null;
    next.pisCofins = null;
  }
  return next;
}

export function recalculateInvoiceTotals(invoice: InvoiceRecord): InvoiceRecord {
  const items = invoice.items.map((item) => ({ ...item }));
  const totalAmount = round2(items.reduce((sum, item) => sum + item.amount, 0));

  const taxableItems = items.filter((item) => item.icmsRate > 0);
  const icmsBase = round2(taxableItems.reduce((sum, item) => sum + (item.icmsBase ?? item.amount), 0));
  const icmsValue = round2(taxableItems.reduce((sum, item) => sum + (item.icmsValue ?? 0), 0));
  const avgIcmsRate = icmsBase > 0 ? round2((icmsValue / icmsBase) * 100) : 12;

  const pisCofinsBase = round2(Math.max(0, icmsBase - icmsValue));
  const existingCofins = invoice.taxes.find((t) => t.name === 'COFINS');
  const existingPis = invoice.taxes.find((t) => t.name === 'PIS');
  const cofinsRate = existingCofins?.rate ?? 4.53;
  const pisRate = existingPis?.rate ?? 0.98;

  const taxes: TaxDetail[] = [
    { name: 'ICMS', base: icmsBase, rate: avgIcmsRate, value: icmsValue },
    {
      name: 'COFINS',
      base: pisCofinsBase,
      rate: cofinsRate,
      value: round2(pisCofinsBase * (cofinsRate / 100)),
    },
    {
      name: 'PIS',
      base: pisCofinsBase,
      rate: pisRate,
      value: round2(pisCofinsBase * (pisRate / 100)),
    },
  ];

  return {
    ...invoice,
    items,
    amount: totalAmount,
    taxes,
    barcode: updateBarcodeWithAmount(invoice.barcode, totalAmount),
  };
}

export function applyMeterAndKwhChange(
  invoice: InvoiceRecord,
  mode: 'readings' | 'kwh',
  updates: {
    meterPrevReading?: number;
    meterCurrReading?: number;
    meterConstant?: number;
    kwh?: number;
  },
): InvoiceRecord {
  const prevRead = updates.meterPrevReading ?? invoice.meterPrevReading;
  const constant = Math.max(1, updates.meterConstant ?? invoice.meterConstant);
  let currRead = updates.meterCurrReading ?? invoice.meterCurrReading;
  let kwh = updates.kwh ?? invoice.kwh;

  if (mode === 'readings') {
    kwh = Math.max(0, Math.round((currRead - prevRead) * constant));
  } else {
    kwh = Math.max(0, Math.round(kwh));
    currRead = prevRead + Math.round(kwh / constant);
  }

  const prevKwh = Math.max(1, invoice.kwh);
  const items = invoice.items.map((item) => {
    if (item.category === 'energy' || item.category === 'distribution') {
      const updated = { ...item, quantity: kwh };
      return recalculateItem(updated, 'qtyOrPrice');
    }
    if (item.category === 'flag' && item.quantity !== null) {
      const ratio = item.quantity / prevKwh;
      const updated = { ...item, quantity: Number((kwh * ratio).toFixed(6)) };
      return recalculateItem(updated, 'qtyOrPrice');
    }
    return item;
  });

  return recalculateInvoiceTotals({
    ...invoice,
    meterPrevReading: prevRead,
    meterCurrReading: currRead,
    meterConstant: constant,
    kwh,
    items,
  });
}

export function applyItemEdit(
  invoice: InvoiceRecord,
  itemId: string,
  patch: Partial<InvoiceItem>,
): InvoiceRecord {
  const items = invoice.items.map((item) => {
    if (item.id !== itemId) return item;
    const merged = { ...item, ...patch };
    const source: 'qtyOrPrice' | 'amount' =
      'amount' in patch && !('quantity' in patch) && !('unitPriceWithTax' in patch)
        ? 'amount'
        : 'qtyOrPrice';
    return recalculateItem(merged, source);
  });

  return recalculateInvoiceTotals({ ...invoice, items });
}
