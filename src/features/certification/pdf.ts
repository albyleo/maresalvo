import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

export interface CertificateDocument {
  serial: string;
  title: string;
  holder: string;
  issuedAt: string;
  expiresAt: string | null;
  status: string;
  verificationUrl: string;
}

export async function createCertificatePdf(certificate: CertificateDocument) {
  const doc = await PDFDocument.create();
  doc.setTitle(`MareSalvo DEMO - ${certificate.serial}`);
  doc.setAuthor('MareSalvo - ambiente pilota');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const ink = rgb(0.04, 0.12, 0.23);
  const supported = (value: string) => { try { font.encodeText(value); return true; } catch { return false; } };
  const text = (value: string, y: number, size = 12, emphasis = false) => {
    page.drawText(value, { x: 48, y, size, font: emphasis ? bold : font, color: ink, maxWidth: 495, lineHeight: size * 1.4 });
  };
  text('MARESALVO', 780, 24, true);
  text('CERTIFICATO DIMOSTRATIVO', 740, 19, true);
  text('Senza valore di qualifica o permesso', 711, 13, true);
  page.drawLine({ start: { x: 48, y: 690 }, end: { x: 547, y: 690 }, thickness: 1, color: ink });
  text('Percorso pilota completato e revisionato dallo staff.', 658);
  const holder = certificate.holder.trim();
  text(supported(holder) && font.widthOfTextAtSize(holder, 15) <= 495 ? holder : 'Intestatario: consultare la verifica online', 618, 15, true);
  text(supported(certificate.title) && font.widthOfTextAtSize(certificate.title, 12) <= 495 ? certificate.title : 'Percorso dimostrativo MareSalvo', 588);
  text(`Seriale: ${certificate.serial}`, 546, 11);
  const date = (value: string) => new Date(value).toISOString().slice(0, 10);
  text(`Emissione: ${date(certificate.issuedAt)}`, 519);
  text(`Scadenza: ${certificate.expiresAt ? date(certificate.expiresAt) : 'Non prevista'}`, 494);
  text(`Stato al momento del download: ${certificate.status}`, 469);
  text('Questo documento serve esclusivamente a verificare il funzionamento', 417, 11);
  text('della piattaforma. Non attesta una qualifica FIPSAS e non autorizza', 399, 11);
  text('la pesca, l\'immersione o altre attivita sportive.', 381, 11);
  const png = await QRCode.toBuffer(certificate.verificationUrl, { width: 240, margin: 2, errorCorrectionLevel: 'M' });
  const qr = await doc.embedPng(png);
  page.drawImage(qr, { x: 48, y: 166, width: 160, height: 160 });
  text('Scansiona il QR per lo stato aggiornato e i dati dell\'intestatario.', 142, 10);
  text('La validita va sempre verificata online, anche dopo il download.', 124, 10);
  text('MareSalvo | Progetto pilota non profit', 62, 10);
  return doc.save();
}
