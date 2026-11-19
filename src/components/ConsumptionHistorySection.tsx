import { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Gauge, Zap } from 'lucide-react';
import type { InvoiceRecord, SmartMeterTelemetry } from '../types/invoice';
import { formatBRL, formatNumberBR } from '../utils/formatters';

interface ConsumptionHistorySectionProps {
  invoices: InvoiceRecord[];
  selectedInvoiceId: string;
  onSelectInvoice: (id: string) => void;
  smartMeter: SmartMeterTelemetry;
  wsConnected: boolean;
}

type ChartMetric = 'kwh' | 'amount' | 'daily';

export function ConsumptionHistorySection({
  invoices,
  selectedInvoiceId,
  onSelectInvoice,
  smartMeter,
  wsConnected,
}: ConsumptionHistorySectionProps) {
  const [metric, setMetric] = useState<ChartMetric>('kwh');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Order chronologically JAN26 -> OCT26 for chart readability
  const chronological = useMemo(() => [...invoices].reverse(), [invoices]);

  const selectedInvoice =
    invoices.find((i) => i.id === selectedInvoiceId) || invoices[0];

  const prevMonthInvoice = useMemo(() => {
    const idx = chronological.findIndex((i) => i.id === selectedInvoice.id);
    return idx > 0 ? chronological[idx - 1] : null;
  }, [chronological, selectedInvoice.id]);

  const deltaPct = useMemo(() => {
    if (!prevMonthInvoice || prevMonthInvoice.kwh === 0) return null;
    return ((selectedInvoice.kwh - prevMonthInvoice.kwh) / prevMonthInvoice.kwh) * 100;
  }, [selectedInvoice.kwh, prevMonthInvoice]);

  const avgKwh = useMemo(() => {
    const sum = chronological.reduce((acc, inv) => acc + inv.kwh, 0);
    return sum / chronological.length;
  }, [chronological]);

  const getValue = (inv: InvoiceRecord) => {
    if (metric === 'kwh') return inv.kwh;
    if (metric === 'amount') return inv.amount;
    return Number((inv.kwh / inv.days).toFixed(2));
  };

  const maxValue = useMemo(() => {
    return Math.max(...chronological.map(getValue), 1);
  }, [chronological, metric]);

  const activeHover =
    chronological.find((inv) => inv.id === hoveredId) || selectedInvoice;

  const dailyMax = useMemo(
    () => Math.max(...smartMeter.dailySeries.map((d) => d.kwh), 1),
    [smartMeter.dailySeries],
  );

  return (
    <section id="consumo" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Histórico de Consumo e Telemetria · Medidor {smartMeter.meterId}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Evolução de Consumo e Leitura em Tempo Real
          </h2>
        </div>

        {/* Segmented Metric Filter */}
        <div
          className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto"
          role="tablist"
          aria-label="Métrica do gráfico de consumo"
        >
          {(
            [
              { id: 'kwh', label: 'Consumo (kWh)' },
              { id: 'amount', label: 'Valor (R$)' },
              { id: 'daily', label: 'Média Diária' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={metric === tab.id}
              onClick={() => setMetric(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                metric === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 cols: 10-Month Interactive Chart (CPFL/Vivo style) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs text-slate-500">
                  Mês em análise · Clique em qualquer barra para abrir a fatura
                </p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {metric === 'kwh' && `${activeHover.kwh} kWh`}
                    {metric === 'amount' && formatBRL(activeHover.amount)}
                    {metric === 'daily' &&
                      `${formatNumberBR(activeHover.kwh / activeHover.days, 1)} kWh/dia`}
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    {activeHover.referenceLabel} · {activeHover.days} dias
                  </span>
                </div>
              </div>

              {deltaPct !== null && (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Comparativo vs. mês anterior</p>
                  <p
                    className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums mt-0.5 ${
                      deltaPct <= 0 ? 'text-[#009E49]' : 'text-amber-700'
                    }`}
                  >
                    {deltaPct <= 0 ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                    {deltaPct > 0 ? '+' : ''}
                    {formatNumberBR(deltaPct, 1)}% ({prevMonthInvoice?.monthCode} →{' '}
                    {selectedInvoice.monthCode})
                  </p>
                </div>
              )}
            </div>

            {/* Interactive Bar Chart */}
            <div className="relative pt-6 pb-2">
              {/* Average Reference Line */}
              {metric === 'kwh' && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-slate-300 pointer-events-none flex justify-end"
                  style={{
                    bottom: `${Math.min(92, (avgKwh / maxValue) * 168 + 34)}px`,
                  }}
                >
                  <span className="text-[11px] font-mono text-slate-500 bg-white px-1.5 -mt-2.5 tabular-nums">
                    Média {Math.round(avgKwh)} kWh
                  </span>
                </div>
              )}

              <div className="grid grid-cols-10 gap-1.5 sm:gap-2.5 items-end h-[200px]">
                {chronological.map((inv) => {
                  const val = getValue(inv);
                  const heightPx = Math.max(18, Math.round((val / maxValue) * 168));
                  const isSelected = inv.id === selectedInvoice.id;
                  const isHovered = inv.id === hoveredId;

                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => onSelectInvoice(inv.id)}
                      onMouseEnter={() => setHoveredId(inv.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="group flex flex-col items-center justify-end h-full focus:outline-none cursor-pointer"
                      aria-label={`Selecionar fatura ${inv.referenceLabel}: ${inv.kwh} kWh`}
                    >
                      <span
                        className={`text-[11px] font-mono tabular-nums mb-1.5 transition-colors ${
                          isSelected || isHovered
                            ? 'text-slate-900 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {metric === 'kwh'
                          ? inv.kwh
                          : metric === 'amount'
                            ? Math.round(inv.amount)
                            : formatNumberBR(val, 1)}
                      </span>
                      <div
                        style={{ height: `${heightPx}px` }}
                        className={`w-full max-w-[34px] rounded-t-md transition-all duration-150 ${
                          isSelected
                            ? 'bg-[#009E49] ring-2 ring-[#009E49]/25'
                            : isHovered
                              ? 'bg-[#009E49]/75'
                              : 'bg-slate-200 group-hover:bg-slate-300'
                        }`}
                      />
                      <span
                        className={`mt-2 text-[11px] font-mono tracking-tight ${
                          isSelected
                            ? 'font-bold text-[#009E49]'
                            : 'font-medium text-slate-500'
                        }`}
                      >
                        {inv.monthCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Summary Strip (Clean unboxed hairline metadata) */}
          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Leitura Anterior ({selectedInvoice.readingPrevDate})</p>
              <p className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {selectedInvoice.meterPrevReading.toLocaleString('pt-BR')} kWh
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Leitura Atual ({selectedInvoice.readingCurrDate})</p>
              <p className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {selectedInvoice.meterCurrReading.toLocaleString('pt-BR')} kWh
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Próxima Leitura Prevista</p>
              <p className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {selectedInvoice.nextReadingDate}
              </p>
            </div>
          </div>
        </div>

        {/* Right 5 cols: Real-Time Smart Meter Telemetry */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#009E49]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Medidor Inteligente {smartMeter.meterId}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-[#009E49] animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>{wsConnected ? 'Telemetria WebSocket' : 'Reconectando...'}</span>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100">
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Carga Instantânea</span>
                  <Zap className="w-3.5 h-3.5 text-[#009E49]" />
                </div>
                <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">
                  {formatNumberBR(smartMeter.activePowerKw, 2)} kW
                </p>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                  FP {formatNumberBR(smartMeter.powerFactor, 2)} · Bifásico
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Registro Atual</span>
                  <Activity className="w-3.5 h-3.5 text-sky-600" />
                </div>
                <p className="text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">
                  {formatNumberBR(smartMeter.registerKwh, 2)}
                </p>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                  {formatNumberBR(smartMeter.voltagePhaseA, 1)}V /{' '}
                  {formatNumberBR(smartMeter.voltagePhaseB, 1)}V
                </p>
              </div>
            </div>

            {/* Current Cycle Progress (Novembro/2026 forecast) */}
            <div className="py-4 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-600 font-medium">
                  Ciclo Aberto (15/10 → 12/11) · Previsão
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatNumberBR(smartMeter.cycleAccumulatedKwh, 1)} / {smartMeter.cycleProjectedKwh} kWh
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#009E49] rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (smartMeter.cycleAccumulatedKwh / smartMeter.cycleProjectedKwh) * 100,
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                <span>
                  Estimativa próxima fatura:{' '}
                  <strong className="text-slate-900 tabular-nums">
                    {formatBRL(smartMeter.cycleProjectedAmount)}
                  </strong>
                </span>
                <span>Bandeira {smartMeter.currentFlag}</span>
              </div>
            </div>

            {/* Mini Daily Profile */}
            <div className="pt-4">
              <p className="text-xs font-medium text-slate-600 mb-2.5">
                Perfil Diário do Ciclo Atual (kWh/dia)
              </p>
              <div className="grid grid-cols-10 gap-1 items-end h-[58px]">
                {smartMeter.dailySeries.map((pt) => {
                  const h = Math.max(8, Math.round((pt.kwh / dailyMax) * 44));
                  return (
                    <div
                      key={pt.dayLabel}
                      className="flex flex-col items-center justify-end h-full"
                      title={`${pt.dayLabel}: ${pt.kwh} kWh`}
                    >
                      <div
                        style={{ height: `${h}px` }}
                        className={`w-full rounded-t-xs ${
                          pt.projected
                            ? 'bg-slate-200 border border-dashed border-slate-400'
                            : 'bg-sky-500/80'
                        }`}
                      />
                      <span className="text-[10px] font-mono text-slate-400 mt-1">
                        {pt.dayLabel.slice(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-mono tabular-nums pt-3 border-t border-slate-100 mt-3">
            Última atualização: {new Date(smartMeter.lastUpdated).toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>
    </section>
  );
}
