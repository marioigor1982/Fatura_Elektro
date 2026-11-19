import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import type {
  CustomerProfile,
  InvoiceRecord,
  PaymentMethod,
  PaymentTransaction,
  ServerWsEvent,
  SmartInvoiceState,
  SmartMeterTelemetry,
} from './src/types/invoice.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const customer: CustomerProfile = {
  name: 'LUMA BORTOLOTTI GOIS',
  cpfMasked: '*******0885',
  ie: '',
  addressLine1: 'R LEONEL AZEVEDO, 221 -',
  addressLine2: 'JD SOLEMAR',
  cityStateZip: 'PRAIA GRANDE - SP - CEP 11709-050',
  consumerUnit: '3.513.310.045-07',
  classification: 'B1 RESIDENCIAL / RESIDENCIAL NORMAL',
  supplyType: 'CONVENCIONAL / BIFASICO',
  autoDebitCode: '44682239',
  autoDebitBank: 'BANCO ITAU S A 341-7',
};

function buildHistoricalInvoice(params: {
  id: string;
  monthCode: string;
  referenceLabel: string;
  dueDate: string;
  issueDate: string;
  amount: number;
  kwh: number;
  days: number;
  prevRead: number;
  currRead: number;
  readingPrevDate: string;
  readingCurrDate: string;
  nextReadingDate: string;
  nfNumber: string;
  paidAt: string;
  paidMethod: PaymentMethod;
  flag: 'Verde' | 'Amarela';
}): InvoiceRecord {
  const ilumPublica = 18.0;
  const flagExtra = params.flag === 'Amarela' ? Number(((params.kwh * 0.01885)).toFixed(2)) : 0;
  const energyPool = Number((params.amount - ilumPublica - flagExtra).toFixed(2));
  const teAmount = Number((energyPool * 0.366).toFixed(2));
  const tusdAmount = Number((energyPool - teAmount).toFixed(2));
  const icmsBase = Number((teAmount + tusdAmount + flagExtra).toFixed(2));
  const icmsVal = Number((icmsBase * 0.12).toFixed(2));
  const pisCofinsBase = Number((icmsBase - icmsVal).toFixed(2));

  return {
    id: params.id,
    monthCode: params.monthCode,
    referenceLabel: params.referenceLabel,
    dueDate: params.dueDate,
    issueDate: params.issueDate,
    amount: params.amount,
    kwh: params.kwh,
    days: params.days,
    status: 'paid',
    paidAt: params.paidAt,
    paidMethod: params.paidMethod,
    nfNumber: params.nfNumber,
    nfSeries: '0',
    accessKey: `3526 0902 3282 8000 0197 6600 00${params.nfNumber.slice(0, 2)} ${params.nfNumber.slice(2, 6)} ${params.nfNumber.slice(6)}20 6292 3410`,
    protocol: `33526002100${params.nfNumber.slice(0, 5)} ${params.issueDate} 11:18:22`,
    consultationUrl: 'https://nf3e.svrs.rs.gov.br/ws/nf3eConsulta/nf3eConsulta.asmx',
    readingPrevDate: params.readingPrevDate,
    readingCurrDate: params.readingCurrDate,
    nextReadingDate: params.nextReadingDate,
    meterPrevReading: params.prevRead,
    meterCurrReading: params.currRead,
    meterConstant: 1,
    barcode: `34191.09040 68735.162932 80253.640009 6 161900000${String(Math.round(params.amount * 100)).padStart(5, '0')}`,
    billingRef: '109/04687351-6',
    fatId: `FAT-01-2026${params.nfNumber}33`,
    autoDebitCode: '44682239',
    bankName: 'BANCO ITAU S A 341-7',
    flags: [{ flag: params.flag, period: `${params.readingPrevDate.slice(0, 5)}-${params.readingCurrDate.slice(0, 5)}`, extraPer100kWh: params.flag === 'Amarela' ? 1.885 : 0 }],
    items: [
      {
        id: `${params.id}-te`,
        description: 'CONSUMO TE',
        friendlyTitle: 'Energia Consumida (TE)',
        friendlyDescription: 'Custo da energia elétrica efetivamente gerada e consumida no imóvel.',
        unit: 'kWh',
        quantity: params.kwh,
        unitPriceWithTax: Number((teAmount / params.kwh).toFixed(6)),
        amount: teAmount,
        pisCofins: Number((teAmount * 0.0485).toFixed(2)),
        icmsBase: teAmount,
        icmsRate: 12,
        icmsValue: Number((teAmount * 0.12).toFixed(2)),
        tariffUnit: 0.32636,
        category: 'energy',
      },
      {
        id: `${params.id}-tusd`,
        description: 'CONSUMO TUSD',
        friendlyTitle: 'Uso da Rede e Distribuição (TUSD)',
        friendlyDescription: 'Transporte da energia pelas linhas de transmissão até a sua residência + encargos setoriais.',
        unit: 'kWh',
        quantity: params.kwh,
        unitPriceWithTax: Number((tusdAmount / params.kwh).toFixed(6)),
        amount: tusdAmount,
        pisCofins: Number((tusdAmount * 0.0485).toFixed(2)),
        icmsBase: tusdAmount,
        icmsRate: 12,
        icmsValue: Number((tusdAmount * 0.12).toFixed(2)),
        tariffUnit: 0.56527,
        category: 'distribution',
      },
      ...(flagExtra > 0
        ? [
            {
              id: `${params.id}-flag`,
              description: 'AD.B.AMAR.',
              friendlyTitle: 'Adicional Bandeira Amarela',
              friendlyDescription: 'Acréscimo tarifário definido pela ANEEL devido às condições de geração hídrica.',
              unit: 'kWh',
              quantity: params.kwh,
              unitPriceWithTax: 0.022588,
              amount: flagExtra,
              pisCofins: Number((flagExtra * 0.048).toFixed(2)),
              icmsBase: flagExtra,
              icmsRate: 12,
              icmsValue: Number((flagExtra * 0.12).toFixed(2)),
              tariffUnit: 0.01885,
              category: 'flag' as const,
            },
          ]
        : []),
      {
        id: `${params.id}-cip`,
        description: 'COBRANCA ILUM PUBLICA PARA A PREFEITURA',
        friendlyTitle: 'Iluminação Pública (COSIP)',
        friendlyDescription: 'Contribuição municipal repassada integralmente à Prefeitura de Praia Grande.',
        unit: '',
        quantity: null,
        unitPriceWithTax: null,
        amount: ilumPublica,
        pisCofins: null,
        icmsBase: null,
        icmsRate: 0,
        icmsValue: null,
        tariffUnit: null,
        category: 'municipal',
      },
    ],
    taxes: [
      { name: 'ICMS', base: icmsBase, rate: 12, value: icmsVal },
      { name: 'COFINS', base: pisCofinsBase, rate: 4.53, value: Number((pisCofinsBase * 0.0453).toFixed(2)) },
      { name: 'PIS', base: pisCofinsBase, rate: 0.98, value: Number((pisCofinsBase * 0.0098).toFixed(2)) },
    ],
  };
}

// Exact October 2026 invoice from attached PDF CE-LUMA_E_RODRIGO_61e40448.pdf
const october2026Invoice: InvoiceRecord = {
  id: '2026-10',
  monthCode: 'OCT26',
  referenceLabel: 'Outubro/2026',
  dueDate: '03/11/2026',
  issueDate: '14/10/2026',
  amount: 230.43,
  kwh: 196,
  days: 29,
  status: 'pending',
  nfNumber: '87434779',
  nfSeries: '0',
  accessKey: '3526 1002 3282 8000 0197 6600 0087 4347 7920 6292 3493',
  protocol: '3352600210043163 14/10/2026 14:23:04',
  consultationUrl: 'https://nf3e.svrs.rs.gov.br/ws/nf3eConsulta/nf3eConsulta.asmx',
  readingPrevDate: '15/09/2026',
  readingCurrDate: '14/10/2026',
  nextReadingDate: '12/11/2026',
  meterPrevReading: 13222,
  meterCurrReading: 13418,
  meterConstant: 1,
  barcode: '34191.09040 68735.162932 80253.640009 6 16190000023043',
  billingRef: '109/04687351-6',
  fatId: 'FAT-01-202610666292349.33',
  autoDebitCode: '44682239',
  bankName: 'BANCO ITAU S A 341-7',
  flags: [
    { flag: 'Amarela', period: '16/09-30/09', extraPer100kWh: 1.885 },
    { flag: 'Verde', period: '01/10-14/10', extraPer100kWh: 0 },
  ],
  items: [
    {
      id: '2026-10-te',
      description: 'CONSUMO TE',
      friendlyTitle: 'Energia Consumida (TE)',
      friendlyDescription: 'Valor referente aos 196 kWh de energia elétrica efetivamente consumidos no período.',
      unit: 'kWh',
      quantity: 196,
      unitPriceWithTax: 0.392398,
      amount: 76.91,
      pisCofins: 3.73,
      icmsBase: 76.91,
      icmsRate: 12,
      icmsValue: 9.22,
      tariffUnit: 0.32636,
      category: 'energy',
    },
    {
      id: '2026-10-tusd',
      description: 'CONSUMO TUSD',
      friendlyTitle: 'Uso da Rede e Distribuição (TUSD)',
      friendlyDescription: 'Custo de transporte da energia pela rede Elektro, perdas técnicas e encargos do setor elétrico.',
      unit: 'kWh',
      quantity: 196,
      unitPriceWithTax: 0.679745,
      amount: 133.23,
      pisCofins: 6.46,
      icmsBase: 133.23,
      icmsRate: 12,
      icmsValue: 15.98,
      tariffUnit: 0.56527,
      category: 'distribution',
    },
    {
      id: '2026-10-flag',
      description: 'AD.B.AMAR.',
      friendlyTitle: 'Adicional Bandeira Amarela',
      friendlyDescription: 'Proporcional aos dias 16/09 a 30/09 em Bandeira Amarela (101,38 kWh). Verde de 01/10 a 14/10.',
      unit: 'kWh',
      quantity: 101.37931,
      unitPriceWithTax: 0.022588,
      amount: 2.29,
      pisCofins: 0.11,
      icmsBase: 2.29,
      icmsRate: 12,
      icmsValue: 0.27,
      tariffUnit: 0.01885,
      category: 'flag',
    },
    {
      id: '2026-10-cip',
      description: 'COBRANCA ILUM PUBLICA PARA A F',
      friendlyTitle: 'Iluminação Pública (COSIP)',
      friendlyDescription: 'Contribuição para custeio da iluminação pública municipal repassada à Prefeitura.',
      unit: '',
      quantity: null,
      unitPriceWithTax: null,
      amount: 18.0,
      pisCofins: null,
      icmsBase: null,
      icmsRate: 0,
      icmsValue: null,
      tariffUnit: null,
      category: 'municipal',
    },
  ],
  taxes: [
    { name: 'ICMS', base: 212.43, rate: 12, value: 25.47 },
    { name: 'COFINS', base: 186.95, rate: 4.53, value: 8.47 },
    { name: 'PIS', base: 186.95, rate: 0.98, value: 1.83 },
  ],
};

const invoices: InvoiceRecord[] = [
  october2026Invoice,
  buildHistoricalInvoice({
    id: '2026-09',
    monthCode: 'SEP26',
    referenceLabel: 'Setembro/2026',
    dueDate: '05/10/2026',
    issueDate: '15/09/2026',
    amount: 284.12,
    kwh: 248,
    days: 33,
    prevRead: 12974,
    currRead: 13222,
    readingPrevDate: '14/08/2026',
    readingCurrDate: '15/09/2026',
    nextReadingDate: '14/10/2026',
    nfNumber: '86104215',
    paidAt: '05/10/2026 07:12:08',
    paidMethod: 'Débito Automático',
    flag: 'Amarela',
  }),
  buildHistoricalInvoice({
    id: '2026-08',
    monthCode: 'AUG26',
    referenceLabel: 'Agosto/2026',
    dueDate: '03/09/2026',
    issueDate: '14/08/2026',
    amount: 261.85,
    kwh: 227,
    days: 29,
    prevRead: 12747,
    currRead: 12974,
    readingPrevDate: '16/07/2026',
    readingCurrDate: '14/08/2026',
    nextReadingDate: '15/09/2026',
    nfNumber: '84921034',
    paidAt: '02/09/2026 19:44:51',
    paidMethod: 'PIX',
    flag: 'Verde',
  }),
  buildHistoricalInvoice({
    id: '2026-07',
    monthCode: 'JUL26',
    referenceLabel: 'Julho/2026',
    dueDate: '03/08/2026',
    issueDate: '16/07/2026',
    amount: 275.60,
    kwh: 240,
    days: 30,
    prevRead: 12507,
    currRead: 12747,
    readingPrevDate: '16/06/2026',
    readingCurrDate: '16/07/2026',
    nextReadingDate: '14/08/2026',
    nfNumber: '83718802',
    paidAt: '03/08/2026 06:58:14',
    paidMethod: 'Débito Automático',
    flag: 'Verde',
  }),
  buildHistoricalInvoice({
    id: '2026-06',
    monthCode: 'JUN26',
    referenceLabel: 'Junho/2026',
    dueDate: '03/07/2026',
    issueDate: '16/06/2026',
    amount: 286.40,
    kwh: 250,
    days: 32,
    prevRead: 12257,
    currRead: 12507,
    readingPrevDate: '15/05/2026',
    readingCurrDate: '16/06/2026',
    nextReadingDate: '16/07/2026',
    nfNumber: '82501419',
    paidAt: '03/07/2026 07:05:39',
    paidMethod: 'Débito Automático',
    flag: 'Verde',
  }),
  buildHistoricalInvoice({
    id: '2026-05',
    monthCode: 'MAY26',
    referenceLabel: 'Maio/2026',
    dueDate: '03/06/2026',
    issueDate: '15/05/2026',
    amount: 307.90,
    kwh: 270,
    days: 31,
    prevRead: 11987,
    currRead: 12257,
    readingPrevDate: '14/04/2026',
    readingCurrDate: '15/05/2026',
    nextReadingDate: '16/06/2026',
    nfNumber: '81349022',
    paidAt: '01/06/2026 14:22:10',
    paidMethod: 'PIX',
    flag: 'Verde',
  }),
  buildHistoricalInvoice({
    id: '2026-04',
    monthCode: 'APR26',
    referenceLabel: 'Abril/2026',
    dueDate: '04/05/2026',
    issueDate: '14/04/2026',
    amount: 289.65,
    kwh: 253,
    days: 28,
    prevRead: 11734,
    currRead: 11987,
    readingPrevDate: '17/03/2026',
    readingCurrDate: '14/04/2026',
    nextReadingDate: '15/05/2026',
    nfNumber: '80192844',
    paidAt: '04/05/2026 07:01:47',
    paidMethod: 'Débito Automático',
    flag: 'Verde',
  }),
  buildHistoricalInvoice({
    id: '2026-03',
    monthCode: 'MAR26',
    referenceLabel: 'Março/2026',
    dueDate: '03/04/2026',
    issueDate: '17/03/2026',
    amount: 334.80,
    kwh: 295,
    days: 32,
    prevRead: 11439,
    currRead: 11734,
    readingPrevDate: '13/02/2026',
    readingCurrDate: '17/03/2026',
    nextReadingDate: '14/04/2026',
    nfNumber: '79024115',
    paidAt: '03/04/2026 07:08:19',
    paidMethod: 'Débito Automático',
    flag: 'Verde',
  }),
  buildHistoricalInvoice({
    id: '2026-02',
    monthCode: 'FEB26',
    referenceLabel: 'Fevereiro/2026',
    dueDate: '03/03/2026',
    issueDate: '13/02/2026',
    amount: 303.60,
    kwh: 266,
    days: 29,
    prevRead: 11173,
    currRead: 11439,
    readingPrevDate: '15/01/2026',
    readingCurrDate: '13/02/2026',
    nextReadingDate: '17/03/2026',
    nfNumber: '77910283',
    paidAt: '02/03/2026 16:35:04',
    paidMethod: 'Boleto Bancário',
    flag: 'Verde',
  }),
  buildHistoricalInvoice({
    id: '2026-01',
    monthCode: 'JAN26',
    referenceLabel: 'Janeiro/2026',
    dueDate: '03/02/2026',
    issueDate: '15/01/2026',
    amount: 426.95,
    kwh: 380,
    days: 41,
    prevRead: 10793,
    currRead: 11173,
    readingPrevDate: '05/12/2025',
    readingCurrDate: '15/01/2026',
    nextReadingDate: '13/02/2026',
    nfNumber: '76640912',
    paidAt: '01/02/2026 10:15:40',
    paidMethod: 'PIX',
    flag: 'Verde',
  }),
];

const payments: PaymentTransaction[] = invoices
  .filter((inv) => inv.status === 'paid')
  .map((inv, idx) => ({
    id: `TX-${inv.id.replace('-', '')}`,
    invoiceId: inv.id,
    referenceLabel: inv.referenceLabel,
    amount: inv.amount,
    method: inv.paidMethod || 'Débito Automático',
    status: 'Confirmado',
    timestamp: inv.paidAt || inv.dueDate,
    authenticationCode: `E341909042026${String(10 - idx).padStart(2, '0')}${inv.nfNumber.slice(0, 6)}`,
    bankOrChannel:
      inv.paidMethod === 'PIX'
        ? 'PIX Instantâneo · Itaú Unibanco'
        : inv.paidMethod === 'Boleto Bancário'
          ? 'Compensação Bancária · 341-7'
          : 'Débito em Conta 44682239 · Itaú',
  }));

const smartMeter: SmartMeterTelemetry = {
  meterId: 'B21075119',
  registerKwh: 13492.42,
  cycleAccumulatedKwh: 74.42,
  cycleProjectedKwh: 192,
  cycleProjectedAmount: 224.8,
  activePowerKw: 0.84,
  voltagePhaseA: 127.4,
  voltagePhaseB: 126.9,
  powerFactor: 0.96,
  currentFlag: 'Verde',
  lastUpdated: new Date().toISOString(),
  dailySeries: [
    { dayLabel: '15/10', kwh: 6.1 },
    { dayLabel: '18/10', kwh: 6.8 },
    { dayLabel: '21/10', kwh: 5.9 },
    { dayLabel: '24/10', kwh: 7.4 },
    { dayLabel: '27/10', kwh: 6.5 },
    { dayLabel: '30/10', kwh: 6.2 },
    { dayLabel: '02/11', kwh: 6.7 },
    { dayLabel: '05/11', kwh: 6.3 },
    { dayLabel: '08/11', kwh: 5.8 },
    { dayLabel: '12/11', kwh: 6.4, projected: true },
  ],
};

const state: SmartInvoiceState = {
  customer,
  invoices,
  payments,
  smartMeter,
  autoDebitEnabled: true,
  activePix: null,
};

const initialSnapshotJson = JSON.stringify({
  customer: state.customer,
  invoices: state.invoices,
  payments: state.payments,
  autoDebitEnabled: state.autoDebitEnabled,
});

function generatePixEmvPayload(invoice: InvoiceRecord, txId: string): string {
  const amountStr = invoice.amount.toFixed(2);
  return `00020126580014BR.GOV.BCB.PIX0136neoenergia-elektro@pix.com.br5204000053039865406${amountStr}5802BR5924ELEKTRO REDES S.A. SP   6008CAMPINAS62190515${txId}6304A9F2`;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const broadcast = (event: ServerWsEvent) => {
    const raw = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  };

  wss.on('connection', (ws) => {
    const initEvent: ServerWsEvent = { type: 'state:init', payload: state };
    ws.send(JSON.stringify(initEvent));
  });

  // Authoritative smart meter telemetry stream pushed over WebSocket
  setInterval(() => {
    const loadDelta = (Math.random() - 0.48) * 0.14;
    state.smartMeter.activePowerKw = Number(
      Math.max(0.32, Math.min(2.85, state.smartMeter.activePowerKw + loadDelta)).toFixed(2),
    );
    state.smartMeter.voltagePhaseA = Number((126.8 + Math.random() * 1.3).toFixed(1));
    state.smartMeter.voltagePhaseB = Number((126.5 + Math.random() * 1.4).toFixed(1));
    const kwhStep = Number(((state.smartMeter.activePowerKw * 3) / 3600).toFixed(4));
    state.smartMeter.registerKwh = Number((state.smartMeter.registerKwh + kwhStep).toFixed(4));
    state.smartMeter.cycleAccumulatedKwh = Number((state.smartMeter.cycleAccumulatedKwh + kwhStep).toFixed(3));
    state.smartMeter.lastUpdated = new Date().toISOString();

    broadcast({ type: 'meter:telemetry', payload: state.smartMeter });
  }, 3000);

  // REST Endpoints
  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  app.put('/api/customer', (req, res) => {
    const updatedCustomer = req.body as CustomerProfile;
    if (!updatedCustomer || typeof updatedCustomer.name !== 'string') {
      res.status(400).json({ error: 'Dados do cliente inválidos.' });
      return;
    }
    state.customer = { ...state.customer, ...updatedCustomer };

    // Propagate repeated auto-debit code & bank across all invoices and payment ledger
    state.invoices = state.invoices.map((inv) => ({
      ...inv,
      autoDebitCode: state.customer.autoDebitCode,
      bankName: state.customer.autoDebitBank,
    }));
    state.payments = state.payments.map((tx) =>
      tx.method === 'Débito Automático'
        ? {
            ...tx,
            bankOrChannel: `Débito em Conta ${state.customer.autoDebitCode} · ${state.customer.autoDebitBank}`,
          }
        : tx,
    );

    broadcast({ type: 'state:sync', payload: state });
    res.json(state);
  });

  app.put('/api/invoices/:id', (req, res) => {
    const idx = state.invoices.findIndex((inv) => inv.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Fatura não encontrada.' });
      return;
    }
    const updated = req.body as InvoiceRecord;
    state.invoices[idx] = { ...state.invoices[idx], ...updated, id: req.params.id };

    // Propagate autoDebitCode & bankName back to customer profile if modified on invoice
    if (updated.autoDebitCode) {
      state.customer.autoDebitCode = updated.autoDebitCode;
    }
    if (updated.bankName) {
      state.customer.autoDebitBank = updated.bankName;
    }

    // Keep matching payment ledger row synchronized if invoice was already paid
    state.payments = state.payments.map((tx) =>
      tx.invoiceId === req.params.id
        ? {
            ...tx,
            referenceLabel: state.invoices[idx].referenceLabel,
            amount: state.invoices[idx].amount,
          }
        : tx,
    );

    // Refresh active PIX payload if open for this invoice
    if (state.activePix && state.activePix.invoiceId === req.params.id) {
      state.activePix = {
        ...state.activePix,
        copyPasteCode: generatePixEmvPayload(state.invoices[idx], state.activePix.txId),
      };
    }

    broadcast({ type: 'state:sync', payload: state });
    res.json(state);
  });

  app.post('/api/state/reset', (_req, res) => {
    const restored = JSON.parse(initialSnapshotJson) as {
      customer: CustomerProfile;
      invoices: InvoiceRecord[];
      payments: PaymentTransaction[];
      autoDebitEnabled: boolean;
    };
    state.customer = restored.customer;
    state.invoices = restored.invoices;
    state.payments = restored.payments;
    state.autoDebitEnabled = restored.autoDebitEnabled;
    state.activePix = null;

    broadcast({ type: 'state:sync', payload: state });
    res.json(state);
  });

  app.post('/api/payments/pix/initiate', (req, res) => {
    const { invoiceId } = req.body as { invoiceId?: string };
    const invoice = state.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      res.status(404).json({ error: 'Fatura não encontrada.' });
      return;
    }
    if (invoice.status === 'paid') {
      res.status(400).json({ error: 'Esta fatura já foi quitada.' });
      return;
    }

    const txId = `ELK${invoice.nfNumber}${Date.now().toString().slice(-4)}`;
    invoice.status = 'processing';
    state.activePix = {
      invoiceId: invoice.id,
      copyPasteCode: generatePixEmvPayload(invoice, txId),
      txId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    broadcast({
      type: 'invoice:updated',
      payload: {
        invoice,
        payments: state.payments,
        activePix: state.activePix,
      },
    });

    res.json({ invoice, activePix: state.activePix });
  });

  app.post('/api/payments/confirm', (req, res) => {
    const { invoiceId, method } = req.body as { invoiceId?: string; method?: PaymentMethod };
    const invoice = state.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) {
      res.status(404).json({ error: 'Fatura não encontrada.' });
      return;
    }
    if (invoice.status === 'paid') {
      res.status(400).json({ error: 'Esta fatura já consta como paga.' });
      return;
    }

    const paymentMethod: PaymentMethod = method || 'PIX';
    const now = new Date();
    const formattedNow = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;

    invoice.status = 'paid';
    invoice.paidAt = formattedNow;
    invoice.paidMethod = paymentMethod;

    const existingTx = state.payments.find((p) => p.invoiceId === invoice.id);
    if (!existingTx) {
      const tx: PaymentTransaction = {
        id: `TX-${invoice.id.replace('-', '')}-${Date.now().toString().slice(-4)}`,
        invoiceId: invoice.id,
        referenceLabel: invoice.referenceLabel,
        amount: invoice.amount,
        method: paymentMethod,
        status: 'Confirmado',
        timestamp: formattedNow,
        authenticationCode: `E34190904${now.getTime().toString().slice(-10)}`,
        bankOrChannel:
          paymentMethod === 'PIX'
            ? 'PIX Instantâneo · Itaú Unibanco'
            : paymentMethod === 'Boleto Bancário'
              ? 'Compensação Bancária · 341-7'
              : `Débito em Conta ${invoice.autoDebitCode} · Itaú`,
      };
      state.payments.unshift(tx);
    }

    if (state.activePix?.invoiceId === invoice.id) {
      state.activePix = null;
    }

    broadcast({
      type: 'invoice:updated',
      payload: {
        invoice,
        payments: state.payments,
        activePix: state.activePix,
      },
    });

    res.json({ invoice, payments: state.payments });
  });

  app.post('/api/invoices/:id/reopen', (req, res) => {
    const invoice = state.invoices.find((inv) => inv.id === req.params.id);
    if (!invoice) {
      res.status(404).json({ error: 'Fatura não encontrada.' });
      return;
    }
    invoice.status = 'pending';
    delete invoice.paidAt;
    delete invoice.paidMethod;
    state.payments = state.payments.filter((p) => p.invoiceId !== invoice.id);
    if (state.activePix?.invoiceId === invoice.id) {
      state.activePix = null;
    }

    broadcast({
      type: 'invoice:updated',
      payload: {
        invoice,
        payments: state.payments,
        activePix: state.activePix,
      },
    });

    res.json({ invoice, payments: state.payments });
  });

  app.post('/api/payments/auto-debit', (req, res) => {
    const { enabled } = req.body as { enabled?: boolean };
    state.autoDebitEnabled = Boolean(enabled);
    broadcast({
      type: 'autodebit:updated',
      payload: { autoDebitEnabled: state.autoDebitEnabled },
    });
    res.json({ autoDebitEnabled: state.autoDebitEnabled });
  });

  // Static or Vite dev middleware
  const distDir = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.use('/assets', express.static(path.resolve(__dirname, 'public/assets')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Invoice server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
