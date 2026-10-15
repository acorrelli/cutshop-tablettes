import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/** QR code généré dans l'application (aucun service externe). */
export function QrCode({ value, size = 280, className = '' }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState<string>('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(value || ' ', { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0A2219', light: '#FCF9F3' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div
      className={`rounded-3xl bg-cream-50 p-4 shadow-tile ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="QR code"
      data-testid="qrcode"
      data-value={value}
    >
      <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
