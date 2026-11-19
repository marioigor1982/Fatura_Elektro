import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { CustomerProfile, InvoiceRecord } from '../types/invoice';
import { formatNumberBR } from './formatters';

const NEO_LOGO_SVG = `<svg viewBox="0 0 68 62" width="240" height="220" xmlns="http://www.w3.org/2000/svg">
  <path d="M19.5 6.5C15.5 14 5.5 23.5 5.5 34.5C5.5 41.8 10.6 46.8 17.5 46.8C16.2 42 16.5 35.8 18.8 29.8C21.1 23.8 23.6 18 22.8 10.8C22.5 8.2 21.1 6.7 19.5 6.5Z" fill="#009E49"/>
  <path d="M12.5 45.2C10.8 49 10.5 52.8 11.4 56.2C11.8 57.2 13.1 56.8 13.1 55.6C13.1 52.6 13.7 49.4 15.2 46.2" stroke="#009E49" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M35.5 4C31.5 12.2 20.8 22.8 20.8 34.6C20.8 42.2 26.2 47.4 33.4 47.4C31.8 42.5 32.1 35.4 35.1 28.4C37.6 22.5 40.3 15.5 38.8 8.3C38.3 5.8 36.9 4.2 35.5 4Z" fill="#00A3E0"/>
  <path d="M52.8 8.8C49.2 16.2 35.8 26.8 35.8 37.8C35.8 44.6 41.2 49.2 48.2 49.2C54.6 49.2 60.2 43.8 60.2 35.2C60.2 25.4 55.6 15.6 54.4 10.6C54.1 9.4 53.4 8.7 52.8 8.8Z" fill="#F37021"/>
</svg>`;

async function svgToPngDataUrl(svgString: string, width: number, height: number): Promise<string | null> {
  try {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No 2d context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return dataUrl;
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(
  customer: CustomerProfile,
  invoice: InvoiceRecord,
  allInvoices: InvoiceRecord[],
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const green: [number, number, number] = [0, 158, 73];
  const borderGreen: [number, number, number] = [40, 180, 99];
  const softGreen: [number, number, number] = [217, 239, 225];
  const paleGreen: [number, number, number] = [237, 248, 241];
  const darkText: [number, number, number] = [17, 24, 39];
  const mutedText: [number, number, number] = [63, 63, 70];

  const logoPng = await svgToPngDataUrl(NEO_LOGO_SVG, 240, 220);
  const qrValue = `${invoice.consultationUrl}?chNF3e=${invoice.accessKey.replace(/\s+/g, '')}`;
  const qrPng = await QRCode.toDataURL(qrValue, {
    width: 240,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  // =========================================================================
  // PAGE 1: OFFICIAL DANFE NF3-e
  // =========================================================================
  // Header container with rounded bottom border
  doc.setDrawColor(...borderGreen);
  doc.setLineWidth(0.45);
  doc.roundedRect(8, 5, 194, 29, 3.5, 3.5, 'S');
  // Cover top border so only bottom + side curves appear just like the official header
  doc.setFillColor(255, 255, 255);
  doc.rect(7.5, 4.5, 195, 5, 'F');

  if (logoPng) {
    doc.addImage(logoPng, 'PNG', 18, 7.5, 14, 12.8);
  }
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Neoenergia', 33.5, 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  doc.text('Elektro', 33.5, 19.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('neoenergia.com/sp | Ligue grátis 0800 701 01 02', 13.5, 29.5);

  // Header Right Block
  doc.setTextColor(...mutedText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text('DANFE- DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA', 78, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text('Elektro Redes S.A.', 78, 14);

  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text('R Ary Antenor de Souza, 321 - Jd Nova America', 78, 20.5);
  doc.text('CEP: 13053-024 - Campinas - SP', 78, 23.8);
  doc.text('CNPJ 02.328.280/0001-97', 78, 27.1);
  doc.text('INSC. ESTADUAL 244868522118', 78, 30.4);

  // Customer + UC + QR Code + Fiscal Key
  let y = 39;
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('NOME DO CLIENTE:', 10, y);

  doc.setTextColor(...darkText);
  doc.setFontSize(8);
  doc.text(customer.name, 10, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(`CPF - ${customer.cpfMasked}   IE: ${customer.ie}`, 10, y + 7.5);

  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('ENDEREÇO:', 10, y + 12);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(customer.addressLine1, 10, y + 15.5);
  doc.text(customer.addressLine2, 10, y + 18.8);
  doc.text(customer.cityStateZip, 10, y + 22.1);

  // UC Box
  doc.setDrawColor(...borderGreen);
  doc.setLineWidth(0.4);
  doc.roundedRect(62, y - 2, 41, 17, 1.5, 1.5, 'S');
  doc.setFillColor(74, 181, 99);
  doc.rect(62, y - 2, 41, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('NÚMERO DA UNIDADE', 82.5, y + 1.2, { align: 'center' });
  doc.text('CONSUMIDORA', 82.5, y + 4.2, { align: 'center' });
  doc.setTextColor(...darkText);
  doc.setFontSize(9.5);
  doc.text(customer.consumerUnit, 82.5, y + 11.5, { align: 'center' });

  // QR Code
  doc.addImage(qrPng, 'PNG', 107, y - 2.5, 22, 22);

  // NF3-e Details
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.text(`NOTA FISCAL No. ${invoice.nfNumber} - SÉRIE ${invoice.nfSeries}`, 132, y);
  doc.text(`DATA DE EMISSÃO: ${invoice.issueDate}`, 132, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.text('Consulte Chave de Acesso em:', 132, y + 6.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.7);
  doc.text(invoice.consultationUrl, 132, y + 9.5, { maxWidth: 69 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('Chave de Acesso:', 132, y + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.accessKey, 132, y + 17.5, { maxWidth: 69 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text(`Protocolo: ${invoice.protocol}`, 132, y + 21.5, { maxWidth: 69 });

  // REF / TOTAL / VENCIMENTO Box
  y = 67;
  doc.setDrawColor(...borderGreen);
  doc.roundedRect(10, y, 100, 14, 1.5, 1.5, 'S');
  doc.setFillColor(...paleGreen);
  doc.rect(10, y, 100, 5.5, 'F');
  doc.line(10, y + 5.5, 110, y + 5.5);
  doc.line(43.3, y, 43.3, y + 14);
  doc.line(76.6, y, 76.6, y + 14);

  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text('REF: MÊS / ANO', 26.6, y + 3.8, { align: 'center' });
  doc.text('TOTAL A PAGAR', 60, y + 3.8, { align: 'center' });
  doc.text('VENCIMENTO', 93.3, y + 3.8, { align: 'center' });

  doc.setTextColor(...darkText);
  doc.setFontSize(9.5);
  doc.text(invoice.referenceLabel, 26.6, y + 11, { align: 'center' });
  doc.text(`R$${formatNumberBR(invoice.amount, 2)}`, 60, y + 11, { align: 'center' });
  doc.text(invoice.dueDate, 93.3, y + 11, { align: 'center' });

  // Classification + Supply Type
  y = 84;
  doc.roundedRect(10, y, 110, 8, 1.2, 1.2, 'S');
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('CLASSIFICAÇÃO', 12, y + 5.2);
  doc.setTextColor(...darkText);
  doc.setFontSize(7);
  doc.text(customer.classification, 36, y + 5.2);

  doc.roundedRect(123, y, 78, 8, 1.2, 1.2, 'S');
  doc.setTextColor(...green);
  doc.setFontSize(6.5);
  doc.text('TIPO DE FORNECIMENTO', 125, y + 5.2);
  doc.setTextColor(...darkText);
  doc.setFontSize(7);
  doc.text(customer.supplyType, 160, y + 5.2);

  // Reading Dates Bar
  y = 96;
  doc.setFillColor(246, 252, 248);
  doc.roundedRect(10, y, 191, 8, 1.2, 1.2, 'FD');
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('DATAS DE LEITURAS', 12, y + 5.2);
  doc.text('LEITURA ANTERIOR', 45, y + 5.2);
  doc.setTextColor(...darkText);
  doc.text(invoice.readingPrevDate, 72, y + 5.2);
  doc.setTextColor(...green);
  doc.text('LEITURA ATUAL', 92, y + 5.2);
  doc.setTextColor(...darkText);
  doc.text(invoice.readingCurrDate, 115, y + 5.2);
  doc.setTextColor(...green);
  doc.text('Nº DE DIAS', 135, y + 5.2);
  doc.setTextColor(...darkText);
  doc.text(String(invoice.days), 153, y + 5.2);
  doc.setTextColor(...green);
  doc.text('PRÓXIMA LEITURA', 162, y + 5.2);
  doc.setTextColor(...darkText);
  doc.text(invoice.nextReadingDate, 187, y + 5.2);

  // Items Table (Left 138mm) + Taxes & Consumption (Right 50mm)
  y = 107;
  const itemsHeight = Math.max(42, 12 + invoice.items.length * 6);
  doc.roundedRect(10, y, 138, itemsHeight, 1.2, 1.2, 'S');
  doc.setFillColor(...softGreen);
  doc.rect(10, y, 138, 7, 'F');
  doc.line(10, y + 7, 148, y + 7);

  doc.setTextColor(0, 122, 56);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.4);
  doc.text('ITENS DE FATURA', 12, y + 4.5);
  doc.text('UNID.', 49, y + 4.5);
  doc.text('QUANT.', 64, y + 4.5, { align: 'right' });
  doc.text('PREÇO UNIT.', 81, y + 4.5, { align: 'right' });
  doc.text('VALOR (R$)', 96, y + 4.5, { align: 'right' });
  doc.text('PIS/COF', 110, y + 4.5, { align: 'right' });
  doc.text('BASE ICMS', 124, y + 4.5, { align: 'right' });
  doc.text('ALÍQ.', 133, y + 4.5, { align: 'right' });
  doc.text('ICMS', 146, y + 4.5, { align: 'right' });

  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  invoice.items.forEach((item, idx) => {
    const ry = y + 11.5 + idx * 5.8;
    doc.text(item.description.slice(0, 26), 12, ry);
    doc.text(item.unit || '', 50, ry);
    doc.text(
      item.quantity !== null
        ? formatNumberBR(item.quantity, item.quantity % 1 === 0 ? 0 : 4)
        : '',
      64,
      ry,
      { align: 'right' },
    );
    doc.text(
      item.unitPriceWithTax !== null ? formatNumberBR(item.unitPriceWithTax, 6) : '',
      81,
      ry,
      { align: 'right' },
    );
    doc.setFont('helvetica', 'bold');
    doc.text(formatNumberBR(item.amount, 2), 96, ry, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(item.pisCofins !== null ? formatNumberBR(item.pisCofins, 2) : '', 110, ry, {
      align: 'right',
    });
    doc.text(item.icmsBase !== null ? formatNumberBR(item.icmsBase, 2) : '', 124, ry, {
      align: 'right',
    });
    doc.text(`${item.icmsRate}%`, 133, ry, { align: 'right' });
    doc.text(item.icmsValue !== null ? formatNumberBR(item.icmsValue, 2) : '', 146, ry, {
      align: 'right',
    });
  });

  // Taxes Table (Top Right)
  doc.roundedRect(151, y, 50, 25, 1.2, 1.2, 'S');
  doc.setFillColor(...softGreen);
  doc.rect(151, y, 50, 6, 'F');
  doc.line(151, y + 6, 201, y + 6);
  doc.setTextColor(0, 122, 56);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.4);
  doc.text('TRIBUTO', 153, y + 4);
  doc.text('BASE', 173, y + 4, { align: 'right' });
  doc.text('ALÍQ.', 185, y + 4, { align: 'right' });
  doc.text('VALOR', 199, y + 4, { align: 'right' });

  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  invoice.taxes.forEach((tax, idx) => {
    const ty = y + 10.5 + idx * 5;
    doc.text(tax.name, 153, ty);
    doc.text(formatNumberBR(tax.base, 2), 173, ty, { align: 'right' });
    doc.text(`${formatNumberBR(tax.rate, tax.rate % 1 === 0 ? 0 : 2)}%`, 185, ty, {
      align: 'right',
    });
    doc.text(formatNumberBR(tax.value, 2), 199, ty, { align: 'right' });
  });

  // Consumption / kWh Chart (Bottom Right)
  const chartY = y + 28;
  doc.roundedRect(151, chartY, 50, 48, 1.2, 1.2, 'S');
  doc.setFillColor(...softGreen);
  doc.rect(151, chartY, 50, 5.5, 'F');
  doc.line(151, chartY + 5.5, 201, chartY + 5.5);
  doc.setTextColor(0, 122, 56);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.text('CONSUMO / kWh', 176, chartY + 3.8, { align: 'center' });

  const maxKwh = Math.max(...allInvoices.map((i) => i.kwh), 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  allInvoices.slice(0, 10).forEach((hist, idx) => {
    const cy = chartY + 10 + idx * 3.7;
    doc.setTextColor(...mutedText);
    doc.text(hist.monthCode, 153, cy);
    doc.setFillColor(120, 125, 132);
    const barW = Math.max(2, (hist.kwh / maxKwh) * 23);
    doc.rect(164, cy - 2.3, barW, 2.3, 'F');
    doc.setTextColor(...darkText);
    doc.text(`${hist.kwh}  ${hist.days}`, 199, cy, { align: 'right' });
  });

  // Meter Table
  const meterY = y + itemsHeight + 4;
  doc.setDrawColor(...borderGreen);
  doc.roundedRect(10, meterY, 94, 20, 1.2, 1.2, 'S');
  doc.setFillColor(...softGreen);
  doc.rect(10, meterY, 94, 6, 'F');
  doc.line(10, meterY + 6, 104, meterY + 6);
  doc.setTextColor(0, 122, 56);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.3);
  doc.text('MEDIDOR', 12, meterY + 4);
  doc.text('GRANDEZA', 31, meterY + 4);
  doc.text('ANT.', 55, meterY + 4, { align: 'right' });
  doc.text('ATUAL', 70, meterY + 4, { align: 'right' });
  doc.text('CONST.', 82, meterY + 4, { align: 'right' });
  doc.text('CONS. kWh', 102, meterY + 4, { align: 'right' });

  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text('B21075119', 12, meterY + 13);
  doc.text('CONSUMO kWh', 31, meterY + 13);
  doc.text(String(invoice.meterPrevReading), 55, meterY + 13, { align: 'right' });
  doc.text(String(invoice.meterCurrReading), 70, meterY + 13, { align: 'right' });
  doc.text(String(invoice.meterConstant), 82, meterY + 13, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(String(invoice.kwh), 102, meterY + 13, { align: 'right' });

  // Reservado ao Fisco
  doc.roundedRect(107, meterY, 41, 20, 1.2, 1.2, 'S');
  doc.setFillColor(...softGreen);
  doc.rect(107, meterY, 41, 6, 'F');
  doc.line(107, meterY + 6, 148, meterY + 6);
  doc.setTextColor(0, 122, 56);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('RESERVADO AO FISCO', 127.5, meterY + 4, { align: 'center' });
  doc.setTextColor(...mutedText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  doc.text('Ajuste SINIEF 01/19 (NF3-e)', 109, meterY + 10.5);
  doc.text(`Ref: ${invoice.billingRef}`, 109, meterY + 14.5);

  // Bandeira & Auto Debit Notice
  const msgY = Math.max(meterY + 25, chartY + 52);
  doc.setDrawColor(180, 185, 190);
  doc.line(10, msgY, 201, msgY);
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    `BandeiraTarifaria ${invoice.flags.map((f) => `${f.flag}:${f.period}`).join(' ')}`,
    10,
    msgY + 4.5,
  );
  doc.text(
    'Conheça o termo de adesão, direitos e deveres e mais em www.neoenergia.com/sp',
    10,
    msgY + 8,
  );
  doc.setFont('helvetica', 'bold');
  doc.text(`CODIGO DEBITO EM CONTA ${invoice.autoDebitCode}`, 10, msgY + 11.5);

  // Canhoto Box
  const canhotoY = msgY + 16;
  doc.setDrawColor(...borderGreen);
  doc.roundedRect(10, canhotoY, 191, 16, 2, 2, 'S');
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(invoice.referenceLabel, 14, canhotoY + 9.5);

  doc.setTextColor(...green);
  doc.setFontSize(6.5);
  doc.text('CÓDIGO DÉBITO EM CONTA', 55, canhotoY + 9.5);
  doc.setTextColor(...darkText);
  doc.setFontSize(9.5);
  doc.text(invoice.autoDebitCode, 88, canhotoY + 9.5);

  doc.setTextColor(...green);
  doc.setFontSize(6.5);
  doc.text('VENCIMENTO', 112, canhotoY + 9.5);
  doc.setTextColor(...darkText);
  doc.setFontSize(9.5);
  doc.text(invoice.dueDate, 130, canhotoY + 9.5);

  doc.setTextColor(...green);
  doc.setFontSize(6.5);
  doc.text('TOTAL A PAGAR', 153, canhotoY + 9.5);
  doc.setTextColor(...darkText);
  doc.setFontSize(10.5);
  doc.text(`R$${formatNumberBR(invoice.amount, 2)}`, 197, canhotoY + 9.5, { align: 'right' });

  // Bank Slip / Fatura Arrecadada
  const slipY = canhotoY + 23;
  doc.setDrawColor(160, 165, 170);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(10, slipY - 3, 201, slipY - 3);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(invoice.bankName, 40, slipY + 2);
  doc.text('PAGÁVEL EM QUALQUER BANCO.', 140, slipY + 2);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(invoice.barcode, 40, slipY + 7.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(customer.name, 40, slipY + 13);
  doc.text(`${customer.addressLine1} ${customer.addressLine2}`, 40, slipY + 16.5);
  doc.text(customer.cityStateZip, 40, slipY + 20);

  doc.setFontSize(6.5);
  doc.text(
    `${invoice.billingRef}    ${invoice.fatId}    ${invoice.dueDate}    R$ ${formatNumberBR(invoice.amount, 2)}`,
    40,
    slipY + 26,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  if (invoice.status === 'paid') {
    doc.setTextColor(...green);
    doc.text(
      `NÃO RECEBER - FATURA ARRECADADA (${invoice.paidMethod || 'Pago'})`,
      105,
      slipY + 35,
      { align: 'center' },
    );
  } else {
    doc.setTextColor(...darkText);
    doc.text('ELEKTRO REDES S.A. · FATURA DISPONÍVEL PARA PAGAMENTO', 105, slipY + 35, {
      align: 'center',
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...mutedText);
  doc.text('DANFELEKB (V1.00)', 198, 292, { align: 'right' });

  // =========================================================================
  // PAGE 2: CANAIS DE ATENDIMENTO E INFORMAÇÕES IMPORTANTES
  // =========================================================================
  doc.addPage();
  doc.setDrawColor(...borderGreen);
  doc.roundedRect(12, 10, 92, 16, 2, 2, 'S');
  doc.setFillColor(...green);
  doc.rect(12, 17, 92, 9, 'F');
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Canais de atendimento', 58, 14.5, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('TELEFONE LIGAÇÃO GRATUITA: 0800 701 01 02', 58, 23, { align: 'center' });

  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('WHATSAPP: (19) 2122-1696   ·   APP: Google Play / Apple Store   ·   SITE: neoenergia.com', 12, 34);

  // Info boxes
  doc.setDrawColor(...borderGreen);
  doc.roundedRect(108, 10, 44, 42, 1.5, 1.5, 'S');
  doc.setFillColor(...green);
  doc.rect(108, 10, 44, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.2);
  doc.text('INFORMAÇÕES IMPORTANTES', 130, 14, { align: 'center' });
  doc.setTextColor(...mutedText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text(
    'Indicadores de continuidade (DIC, FIC, DMIC e DICRI) disponíveis na agência virtual em neoenergia.com/sp.',
    110,
    21,
    { maxWidth: 40 },
  );

  doc.setDrawColor(243, 112, 33);
  doc.roundedRect(155, 10, 44, 42, 1.5, 1.5, 'S');
  doc.setFillColor(243, 112, 33);
  doc.rect(155, 10, 44, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.text('INFORMAÇÕES IMPORTANTES', 177, 14, { align: 'center' });
  doc.setTextColor(...mutedText);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text(
    'Pagamento em atraso gera multa 2% (RES 1000/ANEEL), juros 1% a.m. e atualização monetária no próximo mês.',
    157,
    21,
    { maxWidth: 40 },
  );

  // Green Banner
  doc.setDrawColor(...borderGreen);
  doc.roundedRect(12, 62, 187, 36, 2, 2, 'S');
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('TELEFONE LIGAÇÃO GRATUITA: 0800 701 01 02', 105.5, 71, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Atendimento a pessoa com deficiência auditiva e de fala: 0800 701 0155', 105.5, 78, {
    align: 'center',
  });
  doc.text('Site: neoenergia.com/sp   |   Ouvidoria: 0800 012 40 50', 105.5, 85, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Agência Reguladora ARSESP: 0800 727 01 67 · AGEMS: 0800 727 01 67', 105.5, 92, {
    align: 'center',
  });

  if (logoPng) {
    doc.addImage(logoPng, 'PNG', 18, 108, 14, 12.8);
  }
  doc.setTextColor(...green);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Neoenergia', 33.5, 115);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  doc.text('Elektro', 33.5, 120.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA', 18, 130);

  // Recipient block (synchronized with edits!)
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(customer.name, 18, 168);
  doc.setFont('helvetica', 'normal');
  doc.text(`${customer.addressLine1} ${customer.addressLine2}`, 18, 173);
  doc.text(customer.cityStateZip, 18, 178);

  const safeUc = customer.consumerUnit.replace(/[^0-9]/g, '');
  doc.save(`Fatura_Neoenergia_${invoice.monthCode}_${safeUc}.pdf`);
}
