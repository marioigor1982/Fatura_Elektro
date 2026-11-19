import { useState } from 'react';
import type { InvoiceRecord } from '../types/invoice';
import { formatBRL, formatNumberBR } from '../utils/formatters';

interface BillBreakdownSectionProps {
  invoice: InvoiceRecord;
}

const CATEGORY_COLORS: Record<string, string> = {
  distribution: '#009E49',
  energy: '#00A3E0',
  municipal: '#64748B',
  flag: '#F37021',
};

const CATEGORY_LABELS: Record<string, string> = {
  distribution: 'Uso da Rede (TUSD)',
  energy: 'Energia (TE)',
  municipal: 'Iluminação Pública',
  flag: 'Bandeira Tarifária',
};

export function BillBreakdownSection({ invoice }: BillBreakdownSectionProps) {
  const [viewMode, setViewMode] = useState<'smart' | 'fiscal'>('smart');

  const totalTaxes = invoice.taxes.reduce((sum, t) => sum + t.value, 0);
  const taxShare = invoice.amount > 0 ? (totalTaxes / invoice.amount) * 100 : 0;

  return (
    <section id="composicao" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Detalhamento de Valores · {invoice.referenceLabel} · NF-e {invoice.nfNumber}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Para Onde Vai o Valor da Sua Fatura
          </h2>
        </div>

        <div
          className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto"
          role="tablist"
          aria-label="Modo de visualização dos itens da fatura"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'smart'}
            onClick={() => setViewMode('smart')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'smart'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visão Inteligente
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'fiscal'}
            onClick={() => setViewMode('fiscal')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'fiscal'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tabela Fiscal NF3-e
          </button>
        </div>
      </div>

      {/* Stacked Proportion Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-slate-900">
            Distribuição dos {formatBRL(invoice.amount)}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Tributos inclusos (ICMS, PIS e COFINS):{' '}
            <strong className="text-slate-800">
              {formatBRL(totalTaxes)} ({formatNumberBR(taxShare, 1)}%)
            </strong>
          </p>
        </div>

        <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-slate-100">
          {invoice.items.map((item) => {
            const pct = (item.amount / invoice.amount) * 100;
            return (
              <div
                key={item.id}
                style={{
                  width: `${pct}%`,
                  backgroundColor: CATEGORY_COLORS[item.category] || '#94A3B8',
                }}
                title={`${item.friendlyTitle}: ${formatBRL(item.amount)} (${formatNumberBR(pct, 1)}%)`}
                className="h-full border-r border-white last:border-r-0 transition-all duration-200"
              />
            );
          })}
        </div>

        {/* Legend without pills */}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
          {invoice.items.map((item) => {
            const pct = (item.amount / invoice.amount) * 100;
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[item.category] || '#94A3B8' }}
                />
                <span>{CATEGORY_LABELS[item.category] || item.friendlyTitle}</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatNumberBR(pct, 1)}%
                </span>
              </div>
            );
          })}
        </div>

        {viewMode === 'smart' ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 border-t border-slate-100">
            {invoice.items.map((item) => {
              const pct = (item.amount / invoice.amount) * 100;
              return (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between bg-slate-50/40"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {item.friendlyTitle}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {item.description}
                          {item.quantity !== null
                            ? ` · ${formatNumberBR(item.quantity, item.quantity % 1 === 0 ? 0 : 2)} ${item.unit}`
                            : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold font-mono text-slate-900 tabular-nums">
                          {formatBRL(item.amount)}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {formatNumberBR(pct, 1)}% do total
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mt-2.5">
                      {item.friendlyDescription}
                    </p>
                  </div>

                  {item.unitPriceWithTax !== null && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>Tarifa c/ tributos: R$ {formatNumberBR(item.unitPriceWithTax, 6)}</span>
                      <span>ICMS {item.icmsRate}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto pt-4 border-t border-slate-100">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#EAF6EE] text-[#007A38] border-y border-[#BBE2C8]">
                  <th className="py-2.5 px-3 font-semibold">Itens de Fatura</th>
                  <th className="py-2.5 px-2 font-semibold">Unid.</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Quant.</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Preço Unit. c/ Trib.</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Valor (R$)</th>
                  <th className="py-2.5 px-2 font-semibold text-right">PIS/COFINS</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Base ICMS</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Alíq.</th>
                  <th className="py-2.5 px-2 font-semibold text-right">ICMS (R$)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Tarifa Unit.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {invoice.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                      {item.description}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600">{item.unit || '—'}</td>
                    <td className="py-2.5 px-2 text-right text-slate-700">
                      {item.quantity !== null
                        ? formatNumberBR(item.quantity, item.quantity % 1 === 0 ? 0 : 6)
                        : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700">
                      {item.unitPriceWithTax !== null
                        ? formatNumberBR(item.unitPriceWithTax, 6)
                        : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-slate-900">
                      {formatNumberBR(item.amount, 2)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {item.pisCofins !== null ? formatNumberBR(item.pisCofins, 2) : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {item.icmsBase !== null ? formatNumberBR(item.icmsBase, 2) : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{item.icmsRate}%</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {item.icmsValue !== null ? formatNumberBR(item.icmsValue, 2) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {item.tariffUnit !== null ? formatNumberBR(item.tariffUnit, 6) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Taxes + Tariff Flag Footer Row */}
        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Demonstrativo de Tributos
            </p>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-semibold">Tributo</th>
                    <th className="py-2 px-3 font-semibold text-right">Base de Cálculo (R$)</th>
                    <th className="py-2 px-3 font-semibold text-right">Alíquota (%)</th>
                    <th className="py-2 px-3 font-semibold text-right">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {invoice.taxes.map((tax) => (
                    <tr key={tax.name}>
                      <td className="py-2 px-3 font-sans font-medium text-slate-800">
                        {tax.name}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {formatNumberBR(tax.base, 2)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {formatNumberBR(tax.rate, tax.rate % 1 === 0 ? 0 : 2)}%
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">
                        {formatNumberBR(tax.value, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div>
              <p className="text-xs font-semibold text-slate-700">
                Bandeiras Tarifárias Aplicadas no Ciclo
              </p>
              <div className="mt-2.5 space-y-2">
                {invoice.flags.map((f) => (
                  <div
                    key={`${f.flag}-${f.period}`}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/70 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-xs ${
                          f.flag === 'Amarela'
                            ? 'bg-amber-500'
                            : f.flag === 'Verde'
                              ? 'bg-[#009E49]'
                              : 'bg-red-600'
                        }`}
                      />
                      <span className="font-semibold text-slate-800">
                        Bandeira {f.flag}
                      </span>
                    </div>
                    <span className="font-mono text-slate-600 tabular-nums">{f.period}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              Chave NF3-e: <span className="font-mono text-slate-700">{invoice.accessKey}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
