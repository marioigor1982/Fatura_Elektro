import { CheckCircle2, Printer, X } from 'lucide-react';
import type { CustomerProfile, PaymentTransaction } from '../types/invoice';
import { formatBRL } from '../utils/formatters';

interface ReceiptModalProps {
  transaction: PaymentTransaction | null;
  customer: CustomerProfile;
  onClose: () => void;
}

export function ReceiptModal({ transaction, customer, onClose }: ReceiptModalProps) {
  if (!transaction) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-lg space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#009E49] shrink-0" />
            <div>
              <h3 id="receipt-title" className="text-base font-bold text-slate-900">
                Comprovante de Pagamento
              </h3>
              <p className="text-xs text-slate-500">Neoenergia Elektro · Elektro Redes S.A.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar comprovante"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Titular</span>
            <span className="font-semibold text-slate-900 text-right">{customer.name}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Unidade Consumidora</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {customer.consumerUnit}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Referência</span>
            <span className="font-semibold text-slate-900">{transaction.referenceLabel}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Valor Liquidado</span>
            <span className="font-mono font-bold text-sm text-[#009E49] tabular-nums">
              {formatBRL(transaction.amount)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Meio de Pagamento</span>
            <span className="font-semibold text-slate-900">{transaction.method}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Canal</span>
            <span className="text-slate-800 text-right">{transaction.bankOrChannel}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-100">
            <span className="text-slate-500">Data e Hora</span>
            <span className="font-mono text-slate-800 tabular-nums">{transaction.timestamp}</span>
          </div>
          <div className="pt-1">
            <p className="text-slate-500 mb-1">Código de Autenticação</p>
            <p className="font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-800 break-all">
              {transaction.authenticationCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#009E49] hover:bg-[#007A38] rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Comprovante
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
