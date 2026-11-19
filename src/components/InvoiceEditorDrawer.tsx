import { useState } from 'react';
import {
  Check,
  FileDown,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { CustomerProfile, InvoiceItem, InvoiceRecord } from '../types/invoice';
import { formatBRL, formatNumberBR } from '../utils/formatters';
import {
  applyItemEdit,
  applyMeterAndKwhChange,
  deriveMonthCode,
  diffDaysBr,
  recalculateInvoiceTotals,
} from '../utils/invoiceCalculator';

interface InvoiceEditorDrawerProps {
  open: boolean;
  customer: CustomerProfile;
  invoice: InvoiceRecord;
  onClose: () => void;
  onCustomerChange: (nextCustomer: CustomerProfile) => void;
  onInvoiceChange: (nextInvoice: InvoiceRecord) => void;
  onGeneratePdf: () => Promise<void>;
  onResetAll: () => Promise<void>;
}

type EditorTab = 'titular' | 'leituras' | 'itens' | 'fiscal';

export function InvoiceEditorDrawer({
  open,
  customer,
  invoice,
  onClose,
  onCustomerChange,
  onInvoiceChange,
  onGeneratePdf,
  onResetAll,
}: InvoiceEditorDrawerProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('titular');
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const updateCustomerField = <K extends keyof CustomerProfile>(
    key: K,
    value: CustomerProfile[K],
  ) => {
    const next = { ...customer, [key]: value };
    onCustomerChange(next);
  };

  const handleReferenceChange = (referenceLabel: string) => {
    const nextCode = deriveMonthCode(referenceLabel, invoice.monthCode);
    onInvoiceChange({
      ...invoice,
      referenceLabel,
      monthCode: nextCode,
    });
  };

  const handleDateChange = (
    field: 'readingPrevDate' | 'readingCurrDate' | 'nextReadingDate',
    value: string,
  ) => {
    const next = { ...invoice, [field]: value };
    if (field === 'readingPrevDate' || field === 'readingCurrDate') {
      const calcDays = diffDaysBr(
        field === 'readingPrevDate' ? value : next.readingPrevDate,
        field === 'readingCurrDate' ? value : next.readingCurrDate,
      );
      if (calcDays !== null && calcDays > 0) {
        next.days = calcDays;
      }
    }
    onInvoiceChange(next);
  };

  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `${invoice.id}-custom-${Date.now()}`,
      description: 'SERVIÇO / AJUSTE ADICIONAL',
      friendlyTitle: 'Lançamento Adicional',
      friendlyDescription: 'Item personalizado incluído na fatura.',
      unit: 'UN',
      quantity: 1,
      unitPriceWithTax: 10,
      amount: 10,
      pisCofins: 0.49,
      icmsBase: 10,
      icmsRate: 12,
      icmsValue: 1.2,
      tariffUnit: 8.8,
      category: 'municipal',
    };
    onInvoiceChange(
      recalculateInvoiceTotals({
        ...invoice,
        items: [...invoice.items, newItem],
      }),
    );
  };

  const handleRemoveItem = (itemId: string) => {
    onInvoiceChange(
      recalculateInvoiceTotals({
        ...invoice,
        items: invoice.items.filter((i) => i.id !== itemId),
      }),
    );
  };

  const handlePdfClick = async () => {
    setExporting(true);
    try {
      await onGeneratePdf();
    } finally {
      setExporting(false);
    }
  };

  return (
    <aside
      className="no-print fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col"
      aria-label="Editor Inteligente da Fatura"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Editor Inteligente com Propagação Automática
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Edite qualquer texto ou número — totais, leituras, gráficos e DANFE atualizam juntos.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar editor"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Live Calculated Preview Strip */}
      <div className="px-6 py-3 bg-[#ECF8F1] border-b border-[#BBE2C8] flex items-center justify-between gap-4 text-xs">
        <div>
          <span className="text-[#007A38] font-semibold">{invoice.referenceLabel}</span>
          <span className="mx-1.5 text-[#007A38]/50">·</span>
          <span className="font-mono font-bold text-slate-900 tabular-nums">
            {invoice.kwh} kWh
          </span>
          <span className="mx-1.5 text-[#007A38]/50">·</span>
          <span className="font-mono text-slate-700 tabular-nums">{invoice.days} dias</span>
        </div>
        <div className="text-right">
          <span className="text-slate-600 mr-1.5">Total Recalculado:</span>
          <span className="font-mono font-extrabold text-sm text-[#007A38] tabular-nums">
            {formatBRL(invoice.amount)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-3 border-b border-slate-200 flex gap-2 overflow-x-auto">
        {(
          [
            { id: 'titular', label: 'Titular e UC' },
            { id: 'leituras', label: 'Leituras e Consumo' },
            { id: 'itens', label: 'Itens e Tributos' },
            { id: 'fiscal', label: 'Fiscal e Pagamento' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#009E49] text-[#009E49]'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
        {activeTab === 'titular' && (
          <div className="space-y-4">
            <p className="text-slate-600 leading-relaxed">
              Alterações aqui alimentam automaticamente o cabeçalho do resumo, quadro do cliente na
              DANFE, canhoto do boleto, comprovantes de pagamento e página 2 do PDF.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="sm:col-span-2 block space-y-1">
                <span className="font-semibold text-slate-700">Nome do Titular</span>
                <input
                  type="text"
                  value={customer.name}
                  onChange={(e) => updateCustomerField('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Unidade Consumidora (UC)</span>
                <input
                  type="text"
                  value={customer.consumerUnit}
                  onChange={(e) => updateCustomerField('consumerUnit', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">CPF / Documento</span>
                <input
                  type="text"
                  value={customer.cpfMasked}
                  onChange={(e) => updateCustomerField('cpfMasked', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="sm:col-span-2 block space-y-1">
                <span className="font-semibold text-slate-700">Endereço (Rua e Número)</span>
                <input
                  type="text"
                  value={customer.addressLine1}
                  onChange={(e) => updateCustomerField('addressLine1', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Bairro</span>
                <input
                  type="text"
                  value={customer.addressLine2}
                  onChange={(e) => updateCustomerField('addressLine2', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Cidade / UF / CEP</span>
                <input
                  type="text"
                  value={customer.cityStateZip}
                  onChange={(e) => updateCustomerField('cityStateZip', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="sm:col-span-2 block space-y-1">
                <span className="font-semibold text-slate-700">Classificação</span>
                <input
                  type="text"
                  value={customer.classification}
                  onChange={(e) => updateCustomerField('classification', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="sm:col-span-2 block space-y-1">
                <span className="font-semibold text-slate-700">Tipo de Fornecimento</span>
                <input
                  type="text"
                  value={customer.supplyType}
                  onChange={(e) => updateCustomerField('supplyType', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'leituras' && (
          <div className="space-y-4">
            <p className="text-slate-600 leading-relaxed">
              Ao alterar <strong>Leitura Anterior</strong>, <strong>Leitura Atual</strong> ou{' '}
              <strong>Consumo (kWh)</strong>, os itens <strong>TE</strong> e <strong>TUSD</strong>,
              os tributos, o total da fatura e o código de barras são recalculados automaticamente.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Mês / Ano de Referência</span>
                <input
                  type="text"
                  value={invoice.referenceLabel}
                  onChange={(e) => handleReferenceChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Código no Gráfico (ex: OCT26)</span>
                <input
                  type="text"
                  value={invoice.monthCode}
                  onChange={(e) =>
                    onInvoiceChange({ ...invoice, monthCode: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Leitura Anterior (Medidor)</span>
                <input
                  type="number"
                  value={invoice.meterPrevReading}
                  onChange={(e) =>
                    onInvoiceChange(
                      applyMeterAndKwhChange(invoice, 'readings', {
                        meterPrevReading: Number(e.target.value) || 0,
                      }),
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Leitura Atual (Medidor)</span>
                <input
                  type="number"
                  value={invoice.meterCurrReading}
                  onChange={(e) =>
                    onInvoiceChange(
                      applyMeterAndKwhChange(invoice, 'readings', {
                        meterCurrReading: Number(e.target.value) || 0,
                      }),
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Consumo Direto (kWh)</span>
                <input
                  type="number"
                  value={invoice.kwh}
                  onChange={(e) =>
                    onInvoiceChange(
                      applyMeterAndKwhChange(invoice, 'kwh', {
                        kwh: Number(e.target.value) || 0,
                      }),
                    )
                  }
                  className="w-full px-3 py-2 border border-[#009E49] bg-[#F6FCF8] rounded-lg font-mono font-bold text-slate-900 tabular-nums focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Constante do Medidor</span>
                <input
                  type="number"
                  min={1}
                  value={invoice.meterConstant}
                  onChange={(e) =>
                    onInvoiceChange(
                      applyMeterAndKwhChange(invoice, 'readings', {
                        meterConstant: Math.max(1, Number(e.target.value) || 1),
                      }),
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Data Leitura Anterior</span>
                <input
                  type="text"
                  value={invoice.readingPrevDate}
                  onChange={(e) => handleDateChange('readingPrevDate', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Data Leitura Atual</span>
                <input
                  type="text"
                  value={invoice.readingCurrDate}
                  onChange={(e) => handleDateChange('readingCurrDate', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Nº de Dias (Auto por datas)</span>
                <input
                  type="number"
                  min={1}
                  value={invoice.days}
                  onChange={(e) =>
                    onInvoiceChange({
                      ...invoice,
                      days: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Próxima Leitura</span>
                <input
                  type="text"
                  value={invoice.nextReadingDate}
                  onChange={(e) => handleDateChange('nextReadingDate', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'itens' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-600">
                Edite quantidades, tarifas ou valores. O total e os tributos atualizam na hora.
              </p>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#007A38] bg-[#ECF8F1] hover:bg-[#D9EFE1] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Item
              </button>
            </div>

            <div className="space-y-3">
              {invoice.items.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-lg p-3.5 space-y-3 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        onInvoiceChange(
                          applyItemEdit(invoice, item.id, {
                            description: e.target.value,
                            friendlyTitle: e.target.value,
                          }),
                        )
                      }
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-900 bg-white focus:outline-none focus:border-[#009E49]"
                    />
                    {invoice.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        aria-label={`Remover ${item.description}`}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Quantidade</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.quantity ?? ''}
                        placeholder="—"
                        onChange={(e) => {
                          const raw = e.target.value;
                          onInvoiceChange(
                            applyItemEdit(invoice, item.id, {
                              quantity: raw === '' ? null : Number(raw),
                            }),
                          );
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono bg-white text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Preço Unit. (R$)</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={item.unitPriceWithTax ?? ''}
                        placeholder="—"
                        onChange={(e) => {
                          const raw = e.target.value;
                          onInvoiceChange(
                            applyItemEdit(invoice, item.id, {
                              unitPriceWithTax: raw === '' ? null : Number(raw),
                            }),
                          );
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono bg-white text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Valor Final (R$)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) =>
                          onInvoiceChange(
                            applyItemEdit(invoice, item.id, {
                              amount: Number(e.target.value) || 0,
                            }),
                          )
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono font-bold bg-white text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] text-slate-500">Alíquota ICMS (%)</span>
                      <input
                        type="number"
                        step="1"
                        value={item.icmsRate}
                        onChange={(e) =>
                          onInvoiceChange(
                            applyItemEdit(invoice, item.id, {
                              icmsRate: Number(e.target.value) || 0,
                            }),
                          )
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md font-mono bg-white text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs">
              <span className="text-slate-600">
                Tributos Calculados (ICMS + PIS + COFINS):
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatBRL(invoice.taxes.reduce((s, t) => s + t.value, 0))} (ICMS{' '}
                {formatNumberBR(invoice.taxes[0]?.value ?? 0, 2)})
              </span>
            </div>
          </div>
        )}

        {activeTab === 'fiscal' && (
          <div className="space-y-4">
            <p className="text-slate-600 leading-relaxed">
              Alterar a <strong>Chave de Acesso</strong> atualiza o QR Code da NF3-e na hora.
              Alterar o <strong>Código Débito em Conta</strong> ou <strong>Banco</strong> propaga
              automaticamente para toda a fatura e canais de pagamento.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Vencimento</span>
                <input
                  type="text"
                  value={invoice.dueDate}
                  onChange={(e) => onInvoiceChange({ ...invoice, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Data de Emissão</span>
                <input
                  type="text"
                  value={invoice.issueDate}
                  onChange={(e) => onInvoiceChange({ ...invoice, issueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Nota Fiscal Nº</span>
                <input
                  type="text"
                  value={invoice.nfNumber}
                  onChange={(e) => onInvoiceChange({ ...invoice, nfNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Série</span>
                <input
                  type="text"
                  value={invoice.nfSeries}
                  onChange={(e) => onInvoiceChange({ ...invoice, nfSeries: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="sm:col-span-2 block space-y-1">
                <span className="font-semibold text-slate-700">Chave de Acesso NF3-e</span>
                <input
                  type="text"
                  value={invoice.accessKey}
                  onChange={(e) => onInvoiceChange({ ...invoice, accessKey: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="sm:col-span-2 block space-y-1">
                <span className="font-semibold text-slate-700">Protocolo de Autorização</span>
                <input
                  type="text"
                  value={invoice.protocol}
                  onChange={(e) => onInvoiceChange({ ...invoice, protocol: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Código Débito em Conta</span>
                <input
                  type="text"
                  value={customer.autoDebitCode}
                  onChange={(e) => updateCustomerField('autoDebitCode', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Banco</span>
                <input
                  type="text"
                  value={customer.autoDebitBank}
                  onChange={(e) => updateCustomerField('autoDebitBank', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#009E49]"
                />
              </label>

              <label className="sm:col-span-2 block space-y-1">
                <span className="font-semibold text-slate-700">
                  Linha Digitável (atualiza centavos automaticamente)
                </span>
                <input
                  type="text"
                  value={invoice.barcode}
                  onChange={(e) => onInvoiceChange({ ...invoice, barcode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 tabular-nums focus:outline-none focus:border-[#009E49]"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void onResetAll()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar Original
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handlePdfClick()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-60"
          >
            <FileDown className="w-3.5 h-3.5 text-[#009E49]" />
            {exporting ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            Concluir Edição
          </button>
        </div>
      </div>
    </aside>
  );
}
