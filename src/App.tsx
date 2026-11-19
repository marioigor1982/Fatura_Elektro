import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileDown,
  Pencil,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import type {
  CustomerProfile,
  InvoiceRecord,
  PaymentMethod,
  PaymentTransaction,
  ServerWsEvent,
  SmartInvoiceState,
} from './types/invoice';
import { formatBRL, formatNumberBR } from './utils/formatters';
import { generateInvoicePdf } from './utils/generateInvoicePdf';
import { NeoenergiaHeader } from './components/NeoenergiaHeader';
import { ConsumptionHistorySection } from './components/ConsumptionHistorySection';
import { BillBreakdownSection } from './components/BillBreakdownSection';
import { PaymentCenterSection } from './components/PaymentCenterSection';
import { OfficialDanfeView } from './components/OfficialDanfeView';
import { ReceiptModal } from './components/ReceiptModal';
import { InvoiceEditorDrawer } from './components/InvoiceEditorDrawer';

export default function App() {
  const [data, setData] = useState<SmartInvoiceState | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('2026-10');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<boolean>(false);
  const [receiptTx, setReceiptTx] = useState<PaymentTransaction | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const customerSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invoiceSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInitialState = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Falha ao carregar dados da fatura.');
      const payload = (await res.json()) as SmartInvoiceState;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de conexão com o servidor.');
    }
  }, []);

  useEffect(() => {
    void loadInitialState();

    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerWsEvent;
          if (msg.type === 'state:init' || msg.type === 'state:sync') {
            setData(msg.payload);
          } else if (msg.type === 'meter:telemetry') {
            setData((prev) => (prev ? { ...prev, smartMeter: msg.payload } : prev));
          } else if (msg.type === 'invoice:updated') {
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                invoices: prev.invoices.map((inv) =>
                  inv.id === msg.payload.invoice.id ? msg.payload.invoice : inv,
                ),
                payments: msg.payload.payments,
                activePix: msg.payload.activePix,
              };
            });
          } else if (msg.type === 'autodebit:updated') {
            setData((prev) =>
              prev ? { ...prev, autoDebitEnabled: msg.payload.autoDebitEnabled } : prev,
            );
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (customerSaveTimer.current) clearTimeout(customerSaveTimer.current);
      if (invoiceSaveTimer.current) clearTimeout(invoiceSaveTimer.current);
      wsRef.current?.close();
    };
  }, [loadInitialState]);

  const selectedInvoice = useMemo(() => {
    if (!data) return null;
    return data.invoices.find((inv) => inv.id === selectedInvoiceId) || data.invoices[0];
  }, [data, selectedInvoiceId]);

  const handleCustomerChange = (nextCustomer: CustomerProfile) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customer: nextCustomer,
        invoices: prev.invoices.map((inv) => ({
          ...inv,
          autoDebitCode: nextCustomer.autoDebitCode,
          bankName: nextCustomer.autoDebitBank,
        })),
        payments: prev.payments.map((tx) =>
          tx.method === 'Débito Automático'
            ? {
                ...tx,
                bankOrChannel: `Débito em Conta ${nextCustomer.autoDebitCode} · ${nextCustomer.autoDebitBank}`,
              }
            : tx,
        ),
      };
    });

    if (customerSaveTimer.current) clearTimeout(customerSaveTimer.current);
    customerSaveTimer.current = setTimeout(() => {
      void fetch('/api/customer', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextCustomer),
      });
    }, 250);
  };

  const handleInvoiceChange = (nextInvoice: InvoiceRecord) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customer: {
          ...prev.customer,
          autoDebitCode: nextInvoice.autoDebitCode,
          autoDebitBank: nextInvoice.bankName,
        },
        invoices: prev.invoices.map((inv) =>
          inv.id === nextInvoice.id ? nextInvoice : inv,
        ),
        payments: prev.payments.map((tx) =>
          tx.invoiceId === nextInvoice.id
            ? {
                ...tx,
                referenceLabel: nextInvoice.referenceLabel,
                amount: nextInvoice.amount,
              }
            : tx,
        ),
      };
    });

    if (invoiceSaveTimer.current) clearTimeout(invoiceSaveTimer.current);
    invoiceSaveTimer.current = setTimeout(() => {
      void fetch(`/api/invoices/${nextInvoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextInvoice),
      });
    }, 250);
  };

  const handleResetAll = async () => {
    const res = await fetch('/api/state/reset', { method: 'POST' });
    if (res.ok) {
      const restored = (await res.json()) as SmartInvoiceState;
      setData(restored);
    }
  };

  const handleGeneratePdf = async () => {
    if (!data || !selectedInvoice) return;
    setExportingPdf(true);
    try {
      await generateInvoicePdf(data.customer, selectedInvoice, data.invoices);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleInitiatePix = async (invoiceId: string) => {
    const res = await fetch('/api/payments/pix/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    });
    if (res.ok) {
      const result = (await res.json()) as {
        invoice: SmartInvoiceState['invoices'][number];
        activePix: SmartInvoiceState['activePix'];
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              invoices: prev.invoices.map((inv) =>
                inv.id === result.invoice.id ? result.invoice : inv,
              ),
              activePix: result.activePix,
            }
          : prev,
      );
    }
  };

  const handleConfirmPayment = async (invoiceId: string, method: PaymentMethod) => {
    const res = await fetch('/api/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, method }),
    });
    if (res.ok) {
      const result = (await res.json()) as {
        invoice: SmartInvoiceState['invoices'][number];
        payments: PaymentTransaction[];
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              invoices: prev.invoices.map((inv) =>
                inv.id === result.invoice.id ? result.invoice : inv,
              ),
              payments: result.payments,
              activePix: prev.activePix?.invoiceId === invoiceId ? null : prev.activePix,
            }
          : prev,
      );
    }
  };

  const handleReopenInvoice = async (invoiceId: string) => {
    const res = await fetch(`/api/invoices/${invoiceId}/reopen`, {
      method: 'POST',
    });
    if (res.ok) {
      const result = (await res.json()) as {
        invoice: SmartInvoiceState['invoices'][number];
        payments: PaymentTransaction[];
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              invoices: prev.invoices.map((inv) =>
                inv.id === result.invoice.id ? result.invoice : inv,
              ),
              payments: result.payments,
            }
          : prev,
      );
    }
  };

  const handleToggleAutoDebit = async (enabled: boolean) => {
    const res = await fetch('/api/payments/auto-debit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const result = (await res.json()) as { autoDebitEnabled: boolean };
      setData((prev) =>
        prev ? { ...prev, autoDebitEnabled: result.autoDebitEnabled } : prev,
      );
    }
  };

  const handleCopyBarcode = async () => {
    if (!selectedInvoice) return;
    try {
      await navigator.clipboard.writeText(selectedInvoice.barcode);
      setCopiedBarcode(true);
      setTimeout(() => setCopiedBarcode(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full text-center space-y-4">
          <p className="text-base font-bold text-slate-900">Não foi possível carregar a fatura</p>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadInitialState()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data || !selectedInvoice) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-32 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-56 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const dailyAverage = selectedInvoice.kwh / Math.max(1, selectedInvoice.days);
  const effectiveUnitCost =
    selectedInvoice.kwh > 0 ? selectedInvoice.amount / selectedInvoice.kwh : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones (Wordmark — 5 Nav Links — 1 Primary Action) */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="#resumo"
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Fatura Inteligente
          </a>

          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
            aria-label="Navegação principal"
          >
            <a
              href="#resumo"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Resumo
            </a>
            <a
              href="#consumo"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Consumo
            </a>
            <a
              href="#composicao"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Composição
            </a>
            <a
              href="#pagamentos"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Pagamentos
            </a>
            <a
              href="#danfe"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              DANFE Oficial
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              disabled={exportingPdf}
              onClick={() => void handleGeneratePdf()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {exportingPdf ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
        {/* Section 1: Exact Neoenergia Elektro Header + Smart Invoice Hero */}
        <section id="resumo" className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            {/* Exact Neoenergia Elektro Header from Reference Image */}
            <div className="p-3 sm:p-5 bg-white">
              <NeoenergiaHeader />
            </div>

            {/* Customer & Consumer Unit Strip (Unboxed clean metadata) */}
            <div className="px-5 sm:px-8 py-4 bg-slate-50/70 border-y border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                  <span className="font-bold text-slate-900 text-sm">{data.customer.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">CPF {data.customer.cpfMasked}</span>
                  <span aria-hidden="true">·</span>
                  <span>{data.customer.classification}</span>
                  <span aria-hidden="true">·</span>
                  <span>{data.customer.supplyType}</span>
                </div>
                <p className="text-xs text-slate-600">
                  {data.customer.addressLine1} {data.customer.addressLine2} ·{' '}
                  {data.customer.cityStateZip}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6 shrink-0">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">Unidade Consumidora</p>
                  <p className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                    {data.customer.consumerUnit}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="month-select"
                    className="block text-[11px] font-medium text-slate-500"
                  >
                    Mês de Referência
                  </label>
                  <select
                    id="month-select"
                    value={selectedInvoice.id}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="mt-0.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#009E49] cursor-pointer"
                  >
                    {data.invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.referenceLabel} — {formatBRL(inv.amount)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Hero Summary Focal Area */}
            <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Fatura {selectedInvoice.referenceLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>NF-e {selectedInvoice.nfNumber}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      selectedInvoice.status === 'paid'
                        ? 'text-[#009E49]'
                        : selectedInvoice.status === 'processing'
                          ? 'text-sky-700'
                          : 'text-amber-700'
                    }`}
                  >
                    {selectedInvoice.status === 'paid'
                      ? `Paga em ${selectedInvoice.paidAt}`
                      : selectedInvoice.status === 'processing'
                        ? 'Aguardando Confirmação PIX'
                        : 'Em Aberto'}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 tabular-nums tracking-tight">
                    {formatBRL(selectedInvoice.amount)}
                  </h1>
                  <div className="text-sm text-slate-600">
                    Vencimento em{' '}
                    <strong className="font-mono text-slate-900 tabular-nums">
                      {selectedInvoice.dueDate}
                    </strong>
                  </div>
                </div>

                <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                  Consumo faturado de{' '}
                  <strong className="text-slate-900 font-mono tabular-nums">
                    {selectedInvoice.kwh} kWh
                  </strong>{' '}
                  referente a {selectedInvoice.days} dias ({selectedInvoice.readingPrevDate} a{' '}
                  {selectedInvoice.readingCurrDate}). Bandeira aplicada:{' '}
                  {selectedInvoice.flags.map((f) => `${f.flag} (${f.period})`).join(' · ')}.
                </p>
              </div>

              <div className="lg:col-span-5 flex flex-wrap lg:justify-end gap-2.5">
                {selectedInvoice.status !== 'paid' && (
                  <a
                    href="#pagamentos"
                    onClick={() => void handleInitiatePix(selectedInvoice.id)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <QrCode className="w-4 h-4" />
                    Pagar via PIX
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setIsEditorOpen((v) => !v)}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer border ${
                    isEditorOpen
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {isEditorOpen ? 'Editando Fatura' : 'Editar Fatura'}
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyBarcode()}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  {copiedBarcode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#009E49]" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Código de Barras
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={() => void handleGeneratePdf()}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {exportingPdf ? 'Gerando...' : 'Baixar PDF'}
                </button>
              </div>
            </div>

            {/* 4-Column KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-slate-200 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/40">
              <div className="p-4 sm:px-6">
                <p className="text-xs text-slate-500">Consumo Faturado</p>
                <p className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                  {selectedInvoice.kwh} kWh
                </p>
              </div>
              <div className="p-4 sm:px-6">
                <p className="text-xs text-slate-500">Média Diária</p>
                <p className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                  {formatNumberBR(dailyAverage, 2)} kWh/dia
                </p>
              </div>
              <div className="p-4 sm:px-6">
                <p className="text-xs text-slate-500">Custo Efetivo por kWh</p>
                <p className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                  R$ {formatNumberBR(effectiveUnitCost, 2)}/kWh
                </p>
              </div>
              <div className="p-4 sm:px-6">
                <p className="text-xs text-slate-500">Próxima Leitura Prevista</p>
                <p className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                  {selectedInvoice.nextReadingDate}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Consumption History & Real-Time Smart Meter */}
        <ConsumptionHistorySection
          invoices={data.invoices}
          selectedInvoiceId={selectedInvoice.id}
          onSelectInvoice={setSelectedInvoiceId}
          smartMeter={data.smartMeter}
          wsConnected={wsConnected}
        />

        {/* Section 3: Bill Breakdown (CPFL/Vivo style) */}
        <BillBreakdownSection invoice={selectedInvoice} />

        {/* Section 4: Real-Time Payment Center & Ledger */}
        <PaymentCenterSection
          invoice={selectedInvoice}
          payments={data.payments}
          autoDebitEnabled={data.autoDebitEnabled}
          activePix={data.activePix}
          wsConnected={wsConnected}
          onInitiatePix={handleInitiatePix}
          onConfirmPayment={handleConfirmPayment}
          onReopenInvoice={handleReopenInvoice}
          onToggleAutoDebit={handleToggleAutoDebit}
          onSelectReceipt={setReceiptTx}
        />

        {/* Section 5: Official DANFE NF3-e View */}
        <OfficialDanfeView
          customer={data.customer}
          invoice={selectedInvoice}
          allInvoices={data.invoices}
          isEditing={isEditorOpen}
          onOpenEditor={() => setIsEditorOpen(true)}
          onGeneratePdf={handleGeneratePdf}
          onCustomerChange={handleCustomerChange}
          onInvoiceChange={handleInvoiceChange}
        />
      </main>

      {/* Official Neoenergia Elektro Customer Service Footer (Page 2 of PDF) */}
      <footer className="no-print border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
          <div className="space-y-1.5">
            <p className="font-bold text-slate-900">Canais de Atendimento Neoenergia Elektro</p>
            <p>Ligação Gratuita: 0800 701 01 02</p>
            <p>WhatsApp: (19) 2122-1696 · Deficiência auditiva: 0800 701 0155</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-bold text-slate-900">Ouvidoria e Regulação</p>
            <p>Ouvidoria Neoenergia: 0800 012 40 50</p>
            <p>Agência Reguladora ARSESP: 0800 727 01 67</p>
          </div>
          <div className="space-y-1.5 md:text-right">
            <p className="font-bold text-slate-900">Elektro Redes S.A.</p>
            <p>CNPJ 02.328.280/0001-97 · Campinas - SP</p>
            <p>neoenergia.com/sp · Resolução ANEEL 1.000/2021</p>
          </div>
        </div>
      </footer>

      <ReceiptModal
        transaction={receiptTx}
        customer={data.customer}
        onClose={() => setReceiptTx(null)}
      />

      <InvoiceEditorDrawer
        open={isEditorOpen}
        customer={data.customer}
        invoice={selectedInvoice}
        onClose={() => setIsEditorOpen(false)}
        onCustomerChange={handleCustomerChange}
        onInvoiceChange={handleInvoiceChange}
        onGeneratePdf={handleGeneratePdf}
        onResetAll={handleResetAll}
      />
    </div>
  );
}
