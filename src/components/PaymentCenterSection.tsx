import { useMemo, useState } from 'react';
import {
  Barcode,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  QrCode,
  RotateCcw,
  Search,
} from 'lucide-react';
import type {
  InvoiceRecord,
  PaymentMethod,
  PaymentTransaction,
  SmartInvoiceState,
} from '../types/invoice';
import { formatBRL } from '../utils/formatters';
import { QrCodeSvg } from './QrCodeSvg';

interface PaymentCenterSectionProps {
  invoice: InvoiceRecord;
  payments: PaymentTransaction[];
  autoDebitEnabled: boolean;
  activePix: SmartInvoiceState['activePix'];
  wsConnected: boolean;
  onInitiatePix: (invoiceId: string) => Promise<void>;
  onConfirmPayment: (invoiceId: string, method: PaymentMethod) => Promise<void>;
  onReopenInvoice: (invoiceId: string) => Promise<void>;
  onToggleAutoDebit: (enabled: boolean) => Promise<void>;
  onSelectReceipt: (tx: PaymentTransaction) => void;
}

export function PaymentCenterSection({
  invoice,
  payments,
  autoDebitEnabled,
  activePix,
  wsConnected,
  onInitiatePix,
  onConfirmPayment,
  onReopenInvoice,
  onToggleAutoDebit,
  onSelectReceipt,
}: PaymentCenterSectionProps) {
  const [selectedMethodTab, setSelectedMethodTab] = useState<'pix' | 'boleto' | 'debito'>('pix');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [methodFilter, setMethodFilter] = useState<'Todos' | PaymentMethod>('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const runAction = async (fn: () => Promise<void>) => {
    setBusyAction(true);
    try {
      await fn();
    } finally {
      setBusyAction(false);
    }
  };

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((tx) => {
      if (methodFilter !== 'Todos' && tx.method !== methodFilter) return false;
      if (!q) return true;
      return (
        tx.referenceLabel.toLowerCase().includes(q) ||
        tx.authenticationCode.toLowerCase().includes(q) ||
        tx.method.toLowerCase().includes(q)
      );
    });
  }, [payments, methodFilter, searchQuery]);

  const pixForThisInvoice =
    activePix && activePix.invoiceId === invoice.id ? activePix : null;

  return (
    <section id="pagamentos" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Pagamentos em Tempo Real · Código Débito em Conta {invoice.autoDebitCode}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Central de Pagamentos e Histórico Liquidado
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span
            className={`w-2 h-2 rounded-full ${
              wsConnected ? 'bg-[#009E49] animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span>
            {wsConnected
              ? 'Sincronização em tempo real ativa'
              : 'Conectando ao servidor de pagamentos...'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 cols: Interactive Payment Settlement */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs text-slate-500">Fatura Selecionada · Vencimento {invoice.dueDate}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{invoice.referenceLabel}</p>
              <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
                {formatBRL(invoice.amount)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">Situação Atual</p>
              <p
                className={`mt-1 text-sm font-bold ${
                  invoice.status === 'paid'
                    ? 'text-[#009E49]'
                    : invoice.status === 'processing'
                      ? 'text-sky-700'
                      : 'text-amber-700'
                }`}
              >
                {invoice.status === 'paid'
                  ? 'Paga / Arrecadada'
                  : invoice.status === 'processing'
                    ? 'Aguardando PIX'
                    : 'Em Aberto'}
              </p>
            </div>
          </div>

          {invoice.status === 'paid' ? (
            <div className="space-y-4">
              <div className="bg-[#ECF8F1] border border-[#BBE2C8] rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-[#007A38] font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Fatura Quitada e Compensada</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Pagamento confirmado via <strong>{invoice.paidMethod}</strong> em{' '}
                  <span className="font-mono tabular-nums">{invoice.paidAt}</span>. Não é necessário
                  efetuar novo pagamento.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {(() => {
                  const tx = payments.find((p) => p.invoiceId === invoice.id);
                  if (!tx) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => onSelectReceipt(tx)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      Ver Comprovante Oficial
                    </button>
                  );
                })()}

                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => runAction(() => onReopenInvoice(invoice.id))}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reabrir para Teste
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Payment Method Tabs */}
              <div
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200"
                role="tablist"
              >
                {[
                  { id: 'pix' as const, label: 'PIX', icon: QrCode },
                  { id: 'boleto' as const, label: 'Boleto', icon: Barcode },
                  { id: 'debito' as const, label: 'Débito Conta', icon: Building2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedMethodTab === tab.id}
                      onClick={() => setSelectedMethodTab(tab.id)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        selectedMethodTab === tab.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {selectedMethodTab === 'pix' && (
                <div className="space-y-4">
                  {!pixForThisInvoice ? (
                    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Pague com compensação imediata em segundos via PIX Neoenergia Elektro. O
                        status desta fatura e o histórico serão atualizados em tempo real.
                      </p>
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => runAction(() => onInitiatePix(invoice.id))}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <QrCode className="w-4 h-4" />
                        Gerar QR Code PIX ({formatBRL(invoice.amount)})
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
                          <QrCodeSvg
                            value={pixForThisInvoice.copyPasteCode}
                            size={120}
                            label="QR Code PIX Fatura Neoenergia"
                          />
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <p className="font-bold text-slate-900">
                            QR Code PIX Gerado · {invoice.referenceLabel}
                          </p>
                          <p className="text-slate-600">
                            Identificador:{' '}
                            <span className="font-mono text-slate-800">
                              {pixForThisInvoice.txId}
                            </span>
                          </p>
                          <p className="text-slate-500">
                            Escaneie no app do seu banco ou utilize o código Copia e Cola abaixo.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={pixForThisInvoice.copyPasteCode}
                            aria-label="Código PIX Copia e Cola"
                            className="flex-1 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2 text-slate-700 truncate"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopy(pixForThisInvoice.copyPasteCode, 'pix')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {copiedKey === 'pix' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#009E49]" />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copiar PIX
                              </>
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() =>
                            runAction(() => onConfirmPayment(invoice.id, 'PIX'))
                          }
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Confirmar Pagamento PIX em Tempo Real
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedMethodTab === 'boleto' && (
                <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Linha Digitável · {invoice.bankName}
                    </p>
                    <p className="mt-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-md font-mono text-xs text-slate-900 break-all tabular-nums">
                      {invoice.barcode}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(invoice.barcode, 'barcode')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {copiedKey === 'barcode' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#009E49]" />
                          Código Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar Código de Barras
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() =>
                        runAction(() => onConfirmPayment(invoice.id, 'Boleto Bancário'))
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Registrar Pagamento Boleto
                    </button>
                  </div>
                </div>
              )}

              {selectedMethodTab === 'debito' && (
                <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Débito Automático em Conta
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Código: <span className="font-mono font-semibold">{invoice.autoDebitCode}</span>{' '}
                        · {invoice.bankName}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoDebitEnabled}
                      onClick={() => runAction(() => onToggleAutoDebit(!autoDebitEnabled))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        autoDebitEnabled ? 'bg-[#009E49]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                          autoDebitEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {autoDebitEnabled
                      ? `Débito automático ativo para o vencimento ${invoice.dueDate}. Você também pode liquidar imediatamente abaixo.`
                      : 'Débito automático pausado. Ative o interruptor acima para agendar o débito nos próximos vencimentos.'}
                  </p>

                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() =>
                      runAction(() => onConfirmPayment(invoice.id, 'Débito Automático'))
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Efetivar Débito em Conta Agora
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 7 cols: Real-Time Payment History Ledger */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
              {(['Todos', 'PIX', 'Débito Automático', 'Boleto Bancário'] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMethodFilter(tab)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      methodFilter === tab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ),
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar mês ou autenticação..."
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#009E49]"
              />
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg">
              <p className="text-sm font-medium text-slate-700">
                Nenhum pagamento encontrado para este filtro.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMethodFilter('Todos');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs font-semibold text-[#009E49] hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3 font-semibold">Referência</th>
                    <th className="py-2.5 px-3 font-semibold">Meio / Canal</th>
                    <th className="py-2.5 px-3 font-semibold">Data e Hora</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Valor</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-900">{tx.referenceLabel}</p>
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {tx.authenticationCode}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-800">{tx.method}</p>
                        <p className="text-[11px] text-slate-500">{tx.status}</p>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {tx.timestamp}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatBRL(tx.amount)}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectReceipt(tx)}
                          className="text-xs font-semibold text-[#009E49] hover:text-[#007A38] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Comprovante
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
