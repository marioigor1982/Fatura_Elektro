import { useState } from 'react';
import { FileDown, Pencil, Printer } from 'lucide-react';
import type { CustomerProfile, InvoiceRecord } from '../types/invoice';
import { formatBRL, formatNumberBR } from '../utils/formatters';
import {
  applyMeterAndKwhChange,
  deriveMonthCode,
} from '../utils/invoiceCalculator';
import { NeoenergiaHeader } from './NeoenergiaHeader';
import { QrCodeSvg } from './QrCodeSvg';

interface OfficialDanfeViewProps {
  customer: CustomerProfile;
  invoice: InvoiceRecord;
  allInvoices: InvoiceRecord[];
  isEditing: boolean;
  onOpenEditor: () => void;
  onGeneratePdf: () => Promise<void>;
  onCustomerChange: (next: CustomerProfile) => void;
  onInvoiceChange: (next: InvoiceRecord) => void;
}

export function OfficialDanfeView({
  customer,
  invoice,
  allInvoices,
  isEditing,
  onOpenEditor,
  onGeneratePdf,
  onCustomerChange,
  onInvoiceChange,
}: OfficialDanfeViewProps) {
  const [exporting, setExporting] = useState(false);
  const maxKwh = Math.max(...allInvoices.map((i) => i.kwh), 1);

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      await onGeneratePdf();
    } finally {
      setExporting(false);
    }
  };

  return (
    <section id="danfe" className="space-y-4">
      <div className="no-print flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Espelho Oficial · Modelo DANFELEKB (V1.00) · NF3-e {invoice.nfNumber}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            DANFE — Documento Auxiliar da Nota Fiscal Eletrônica
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenEditor}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5 text-[#009E49]" />
            Editar Dados
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleDownloadPdf()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <FileDown className="w-4 h-4" />
            {exporting ? 'Gerando PDF...' : 'Gerar PDF'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Faithful A4-proportioned DANFE Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs print-container overflow-x-auto">
        <div className="min-w-[820px] max-w-[980px] mx-auto space-y-2.5 text-[11px] text-slate-900">
          {/* Exact Neoenergia Elektro Header */}
          <NeoenergiaHeader />

          {/* Customer + UC + QR Code + NF3-e Key */}
          <div className="grid grid-cols-12 gap-3 items-stretch pt-1">
            <div className="col-span-4 space-y-2">
              <div>
                <p className="text-[10px] font-bold text-[#009E49] uppercase">
                  Nome do Cliente:
                </p>
                {isEditing ? (
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) => onCustomerChange({ ...customer, name: e.target.value })}
                    className="w-full mt-0.5 px-1.5 py-0.5 border border-[#009E49] bg-[#F6FCF8] rounded-xs font-bold text-[12px] text-slate-900"
                  />
                ) : (
                  <p className="font-bold text-[12px] text-slate-900 mt-0.5">{customer.name}</p>
                )}
                <p className="text-[10px] text-slate-700 mt-0.5">
                  CPF - <span className="font-mono">{customer.cpfMasked}</span> &nbsp; IE: {customer.ie}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#009E49] uppercase">Endereço:</p>
                <p className="text-[10px] leading-tight text-slate-800">
                  {customer.addressLine1}
                  <br />
                  {customer.addressLine2}
                  <br />
                  {customer.cityStateZip}
                </p>
              </div>
            </div>

            <div className="col-span-3 flex flex-col justify-start">
              <div className="border-[1.5px] border-[#28B463] rounded-md overflow-hidden">
                <div className="bg-[#4AB563] text-white text-center font-bold text-[10px] py-1 px-2 leading-tight uppercase">
                  Número da Unidade Consumidora
                </div>
                <div className="py-2 px-2 text-center font-mono font-bold text-[14px] text-slate-900 tabular-nums">
                  {isEditing ? (
                    <input
                      type="text"
                      value={customer.consumerUnit}
                      onChange={(e) =>
                        onCustomerChange({ ...customer, consumerUnit: e.target.value })
                      }
                      className="w-full text-center px-1 py-0.5 border border-[#009E49] bg-[#F6FCF8] rounded-xs font-mono font-bold text-[13px]"
                    />
                  ) : (
                    customer.consumerUnit
                  )}
                </div>
              </div>
            </div>

            <div className="col-span-2 flex items-start justify-center">
              <div className="p-1 border border-slate-200 bg-white">
                <QrCodeSvg
                  value={`${invoice.consultationUrl}?chNF3e=${invoice.accessKey.replace(/\s+/g, '')}`}
                  size={84}
                  label="QR Code NF3-e"
                />
              </div>
            </div>

            <div className="col-span-3 text-[9.5px] leading-snug text-slate-800 space-y-1">
              <p className="font-bold">
                NOTA FISCAL No. {invoice.nfNumber} - SÉRIE {invoice.nfSeries} DATA DE EMISSÃO:{' '}
                {invoice.issueDate}
              </p>
              <p>Consulte Chave de Acesso em:</p>
              <p className="font-semibold break-all text-[9px]">{invoice.consultationUrl}</p>
              <p className="font-semibold">Chave de Acesso</p>
              <p className="font-mono font-bold text-[9.5px] tracking-tight tabular-nums">
                {invoice.accessKey}
              </p>
              <p>Protocolo de Autorização: {invoice.protocol}</p>
              <p className="text-slate-600">America/Sao_Paulo</p>
            </div>
          </div>

          {/* REF / TOTAL / VENCIMENTO + CLASSIFICAÇÃO */}
          <div className="grid grid-cols-12 gap-3 items-stretch">
            <div className="col-span-6 border-[1.5px] border-[#28B463] rounded-md overflow-hidden">
              <div className="grid grid-cols-3 bg-[#EDF8F1] border-b border-[#28B463] text-[10px] font-bold text-[#009E49] text-center">
                <div className="py-1 border-r border-[#28B463]">REF: MÊS / ANO</div>
                <div className="py-1 border-r border-[#28B463]">TOTAL A PAGAR</div>
                <div className="py-1">VENCIMENTO</div>
              </div>
              <div className="grid grid-cols-3 text-center font-bold text-[13px] py-2 tabular-nums">
                <div className="border-r border-[#28B463] px-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={invoice.referenceLabel}
                      onChange={(e) =>
                        onInvoiceChange({
                          ...invoice,
                          referenceLabel: e.target.value,
                          monthCode: deriveMonthCode(e.target.value, invoice.monthCode),
                        })
                      }
                      className="w-full text-center px-1 border border-[#009E49] bg-[#F6FCF8] rounded-xs text-[12px]"
                    />
                  ) : (
                    invoice.referenceLabel
                  )}
                </div>
                <div className="border-r border-[#28B463]">
                  R${formatNumberBR(invoice.amount, 2)}
                </div>
                <div className="px-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={invoice.dueDate}
                      onChange={(e) =>
                        onInvoiceChange({ ...invoice, dueDate: e.target.value })
                      }
                      className="w-full text-center px-1 border border-[#009E49] bg-[#F6FCF8] rounded-xs font-mono text-[12px]"
                    />
                  ) : (
                    invoice.dueDate
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-7 border-[1.5px] border-[#28B463] rounded-md px-3 py-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#009E49]">CLASSIFICAÇÃO</span>
              <span className="font-semibold text-[11px]">{customer.classification}</span>
            </div>
            <div className="col-span-5 border-[1.5px] border-[#28B463] rounded-md px-3 py-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#009E49]">TIPO DE FORNECIMENTO</span>
              <span className="font-semibold text-[11px]">{customer.supplyType}</span>
            </div>
          </div>

          {/* DATAS DE LEITURAS */}
          <div className="border-[1.5px] border-[#28B463] rounded-md px-3 py-1.5 bg-[#F6FCF8] grid grid-cols-5 items-center text-[10.5px]">
            <span className="font-bold text-[#009E49]">DATAS DE LEITURAS</span>
            <span>
              <strong className="text-[#009E49]">LEITURA ANTERIOR</strong>{' '}
              <span className="font-mono tabular-nums">{invoice.readingPrevDate}</span>
            </span>
            <span>
              <strong className="text-[#009E49]">LEITURA ATUAL</strong>{' '}
              <span className="font-mono tabular-nums">{invoice.readingCurrDate}</span>
            </span>
            <span>
              <strong className="text-[#009E49]">Nº DE DIAS</strong>{' '}
              <span className="font-mono tabular-nums">{invoice.days}</span>
            </span>
            <span>
              <strong className="text-[#009E49]">PRÓXIMA LEITURA</strong>{' '}
              <span className="font-mono tabular-nums">{invoice.nextReadingDate}</span>
            </span>
          </div>

          {/* ITENS DE FATURA + TRIBUTOS + CONSUMO */}
          <div className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-9 border-[1.5px] border-[#28B463] rounded-md overflow-hidden">
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="bg-[#D9EFE1] text-[#007A38] border-b border-[#28B463] text-center font-bold">
                    <th className="py-1 px-1.5 text-left border-r border-[#28B463]">
                      ITENS DE FATURA
                    </th>
                    <th className="py-1 px-1 border-r border-[#28B463]">UNID.</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">QUANT.</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">PREÇO UNIT.</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">VALOR (R$)</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">PIS/COFINS</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">BASE ICMS</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">ALÍQ.</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">ICMS</th>
                    <th className="py-1 px-1">TARIFA UNIT.</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums divide-y divide-slate-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 px-1.5 font-sans border-r border-slate-200">
                        {item.description}
                      </td>
                      <td className="py-1 px-1 text-center border-r border-slate-200">
                        {item.unit}
                      </td>
                      <td className="py-1 px-1 text-right border-r border-slate-200">
                        {item.quantity !== null
                          ? formatNumberBR(item.quantity, item.quantity % 1 === 0 ? 0 : 6)
                          : ''}
                      </td>
                      <td className="py-1 px-1 text-right border-r border-slate-200">
                        {item.unitPriceWithTax !== null
                          ? formatNumberBR(item.unitPriceWithTax, 6)
                          : ''}
                      </td>
                      <td className="py-1 px-1 text-right font-semibold border-r border-slate-200">
                        {formatNumberBR(item.amount, 2)}
                      </td>
                      <td className="py-1 px-1 text-right border-r border-slate-200">
                        {item.pisCofins !== null ? formatNumberBR(item.pisCofins, 2) : ''}
                      </td>
                      <td className="py-1 px-1 text-right border-r border-slate-200">
                        {item.icmsBase !== null ? formatNumberBR(item.icmsBase, 2) : ''}
                      </td>
                      <td className="py-1 px-1 text-right border-r border-slate-200">
                        {item.icmsRate}%
                      </td>
                      <td className="py-1 px-1 text-right border-r border-slate-200">
                        {item.icmsValue !== null ? formatNumberBR(item.icmsValue, 2) : ''}
                      </td>
                      <td className="py-1 px-1 text-right">
                        {item.tariffUnit !== null ? formatNumberBR(item.tariffUnit, 6) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="col-span-3 space-y-2">
              <div className="border-[1.5px] border-[#28B463] rounded-md overflow-hidden">
                <table className="w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="bg-[#D9EFE1] text-[#007A38] border-b border-[#28B463] font-bold">
                      <th className="py-1 px-1.5 text-left border-r border-[#28B463]">TRIBUTO</th>
                      <th className="py-1 px-1 text-right border-r border-[#28B463]">BASE</th>
                      <th className="py-1 px-1 text-right border-r border-[#28B463]">ALÍQ.</th>
                      <th className="py-1 px-1 text-right">VALOR</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums divide-y divide-slate-100">
                    {invoice.taxes.map((t) => (
                      <tr key={t.name}>
                        <td className="py-1 px-1.5 font-sans border-r border-slate-200">
                          {t.name}
                        </td>
                        <td className="py-1 px-1 text-right border-r border-slate-200">
                          {formatNumberBR(t.base, 2)}
                        </td>
                        <td className="py-1 px-1 text-right border-r border-slate-200">
                          {formatNumberBR(t.rate, t.rate % 1 === 0 ? 0 : 2)}%
                        </td>
                        <td className="py-1 px-1 text-right">{formatNumberBR(t.value, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-[1.5px] border-[#28B463] rounded-md overflow-hidden">
                <div className="bg-[#D9EFE1] text-[#007A38] text-center font-bold text-[9.5px] py-1 border-b border-[#28B463]">
                  CONSUMO / kWh
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex justify-between text-[8.5px] font-bold text-slate-600 pb-0.5">
                    <span>CONSUMO FATURADO</span>
                    <span>Fat / Dias</span>
                  </div>
                  {allInvoices.map((hist) => (
                    <div
                      key={hist.id}
                      className="grid grid-cols-12 items-center gap-1 text-[8.5px] font-mono tabular-nums"
                    >
                      <span className="col-span-3 text-slate-600">{hist.monthCode}</span>
                      <div className="col-span-6 h-2 bg-slate-100">
                        <div
                          className="h-full bg-slate-500"
                          style={{ width: `${(hist.kwh / maxKwh) * 100}%` }}
                        />
                      </div>
                      <span className="col-span-3 text-right text-slate-700">
                        {hist.kwh} {hist.days}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* MEDIDOR + RESERVADO AO FISCO */}
          <div className="grid grid-cols-12 gap-2 items-stretch">
            <div className="col-span-6 border-[1.5px] border-[#28B463] rounded-md overflow-hidden">
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="bg-[#D9EFE1] text-[#007A38] border-b border-[#28B463] font-bold">
                    <th className="py-1 px-1.5 text-left border-r border-[#28B463]">MEDIDOR</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">GRANDEZAS</th>
                    <th className="py-1 px-1 border-r border-[#28B463]">POSTOS</th>
                    <th className="py-1 px-1 text-right border-r border-[#28B463]">ANT.</th>
                    <th className="py-1 px-1 text-right border-r border-[#28B463]">ATUAL</th>
                    <th className="py-1 px-1 text-right border-r border-[#28B463]">CONST.</th>
                    <th className="py-1 px-1 text-right">CONS. kWh</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  <tr>
                    <td className="py-2 px-1.5 border-r border-slate-200">B21075119</td>
                    <td className="py-2 px-1 text-center border-r border-slate-200">
                      CONSUMO kWh
                    </td>
                    <td className="py-2 px-1 text-center border-r border-slate-200">TP</td>
                    <td className="py-2 px-1 text-right border-r border-slate-200">
                      {invoice.meterPrevReading}
                    </td>
                    <td className="py-2 px-1 text-right border-r border-slate-200">
                      {isEditing ? (
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
                          className="w-16 text-right px-1 border border-[#009E49] bg-[#F6FCF8] rounded-xs"
                        />
                      ) : (
                        invoice.meterCurrReading
                      )}
                    </td>
                    <td className="py-2 px-1 text-right border-r border-slate-200">
                      {invoice.meterConstant}
                    </td>
                    <td className="py-2 px-1 text-right font-bold">
                      {isEditing ? (
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
                          className="w-14 text-right px-1 border border-[#009E49] bg-[#F6FCF8] rounded-xs font-bold"
                        />
                      ) : (
                        invoice.kwh
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="col-span-6 border-[1.5px] border-[#28B463] rounded-md overflow-hidden">
              <div className="bg-[#D9EFE1] text-[#007A38] text-center font-bold text-[9.5px] py-1 border-b border-[#28B463]">
                RESERVADO AO FISCO
              </div>
              <div className="p-2 text-[9px] text-slate-600">
                Documento emitido conforme Ajuste SINIEF 01/19 (NF3-e). Protocolo:{' '}
                <span className="font-mono">{invoice.protocol}</span>
              </div>
            </div>
          </div>

          {/* Bandeira & Débito em Conta Strip */}
          <div className="border-t border-b border-slate-300 py-2 text-[9.5px] text-slate-800 space-y-0.5">
            <p>
              BandeiraTarifaria{' '}
              {invoice.flags.map((f) => `${f.flag}:${f.period}`).join(' ')}
            </p>
            <p>
              Conheça o termo de adesão, direitos e deveres e mais em www.neoenergia.com/sp
            </p>
            <p className="font-semibold">
              CODIGO DEBITO EM CONTA {customer.autoDebitCode}
            </p>
          </div>

          {/* Canhoto / Ficha de Compensação */}
          <div className="border-[1.5px] border-[#28B463] rounded-xl p-3 flex items-center justify-between gap-4">
            <div className="font-bold text-[15px] text-slate-900">{invoice.referenceLabel}</div>
            <div className="flex items-center gap-4 text-[11px] tabular-nums">
              <div>
                <span className="text-[#009E49] font-bold text-[9.5px] mr-1">
                  CÓDIGO DÉBITO EM CONTA
                </span>
                <span className="font-mono font-bold text-[13px]">{customer.autoDebitCode}</span>
              </div>
              <div>
                <span className="text-[#009E49] font-bold text-[9.5px] mr-1">VENCIMENTO</span>
                <span className="font-mono font-bold text-[13px]">{invoice.dueDate}</span>
              </div>
              <div>
                <span className="text-[#009E49] font-bold text-[9.5px] mr-1">TOTAL A PAGAR</span>
                <span className="font-mono font-bold text-[14px]">
                  {formatBRL(invoice.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Strip */}
          <div className="pt-2 border-t border-dashed border-slate-400 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span>{customer.autoDebitBank}</span>
              <span>PAGÁVEL EM QUALQUER BANCO.</span>
            </div>
            <p className="font-mono font-bold text-[12px] tracking-wide tabular-nums">
              {invoice.barcode}
            </p>
            <div className="flex items-center justify-between text-[10px]">
              <span>
                {customer.name} · {customer.cityStateZip}
              </span>
              <span className="font-mono">
                {invoice.billingRef} · {invoice.fatId} · {formatBRL(invoice.amount)}
              </span>
            </div>
            <div className="text-center pt-2">
              {invoice.status === 'paid' ? (
                <p className="font-bold text-[14px] tracking-wide text-[#007A38]">
                  NÃO RECEBER - FATURA ARRECADADA ({invoice.paidMethod} · {invoice.paidAt})
                </p>
              ) : (
                <p className="font-mono text-[10px] text-slate-500">
                  FATURA DISPONÍVEL PARA PAGAMENTO VIA PIX, DÉBITO OU CÓDIGO DE BARRAS · DANFELEKB (V1.00)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
