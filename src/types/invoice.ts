export type PaymentStatus = 'paid' | 'pending' | 'processing' | 'scheduled';

export type PaymentMethod = 'PIX' | 'Débito Automático' | 'Boleto Bancário';

export interface InvoiceItem {
  id: string;
  description: string;
  friendlyTitle: string;
  friendlyDescription: string;
  unit: string;
  quantity: number | null;
  unitPriceWithTax: number | null;
  amount: number;
  pisCofins: number | null;
  icmsBase: number | null;
  icmsRate: number;
  icmsValue: number | null;
  tariffUnit: number | null;
  category: 'energy' | 'distribution' | 'flag' | 'municipal';
}

export interface TaxDetail {
  name: string;
  base: number;
  rate: number;
  value: number;
}

export interface TariffFlagPeriod {
  flag: 'Verde' | 'Amarela' | 'Vermelha P1' | 'Vermelha P2';
  period: string;
  extraPer100kWh: number;
}

export interface InvoiceRecord {
  id: string;
  monthCode: string;
  referenceLabel: string;
  dueDate: string;
  issueDate: string;
  amount: number;
  kwh: number;
  days: number;
  status: PaymentStatus;
  paidAt?: string;
  paidMethod?: PaymentMethod;
  nfNumber: string;
  nfSeries: string;
  accessKey: string;
  protocol: string;
  consultationUrl: string;
  readingPrevDate: string;
  readingCurrDate: string;
  nextReadingDate: string;
  meterPrevReading: number;
  meterCurrReading: number;
  meterConstant: number;
  barcode: string;
  billingRef: string;
  fatId: string;
  autoDebitCode: string;
  bankName: string;
  flags: TariffFlagPeriod[];
  items: InvoiceItem[];
  taxes: TaxDetail[];
}

export interface PaymentTransaction {
  id: string;
  invoiceId: string;
  referenceLabel: string;
  amount: number;
  method: PaymentMethod;
  status: 'Confirmado' | 'Processando' | 'Agendado';
  timestamp: string;
  authenticationCode: string;
  bankOrChannel: string;
}

export interface DailySmartMeterPoint {
  dayLabel: string;
  kwh: number;
  projected?: boolean;
}

export interface SmartMeterTelemetry {
  meterId: string;
  registerKwh: number;
  cycleAccumulatedKwh: number;
  cycleProjectedKwh: number;
  cycleProjectedAmount: number;
  activePowerKw: number;
  voltagePhaseA: number;
  voltagePhaseB: number;
  powerFactor: number;
  currentFlag: 'Verde' | 'Amarela';
  lastUpdated: string;
  dailySeries: DailySmartMeterPoint[];
}

export interface CustomerProfile {
  name: string;
  cpfMasked: string;
  ie: string;
  addressLine1: string;
  addressLine2: string;
  cityStateZip: string;
  consumerUnit: string;
  classification: string;
  supplyType: string;
  autoDebitCode: string;
  autoDebitBank: string;
}

export interface SmartInvoiceState {
  customer: CustomerProfile;
  invoices: InvoiceRecord[];
  payments: PaymentTransaction[];
  smartMeter: SmartMeterTelemetry;
  autoDebitEnabled: boolean;
  activePix: {
    invoiceId: string;
    copyPasteCode: string;
    txId: string;
    expiresAt: string;
  } | null;
}

export type ServerWsEvent =
  | { type: 'state:init'; payload: SmartInvoiceState }
  | { type: 'state:sync'; payload: SmartInvoiceState }
  | { type: 'meter:telemetry'; payload: SmartMeterTelemetry }
  | { type: 'invoice:updated'; payload: { invoice: InvoiceRecord; payments: PaymentTransaction[]; activePix: SmartInvoiceState['activePix'] } }
  | { type: 'autodebit:updated'; payload: { autoDebitEnabled: boolean } };
