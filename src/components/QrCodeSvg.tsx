import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}

export function QrCodeSvg({ value, size = 112, label = 'QR Code', className = '' }: QrCodeSvgProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-mono ${className}`}
        aria-label={label}
      >
        QR
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={label}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`block select-none ${className}`}
      referrerPolicy="no-referrer"
    />
  );
}
