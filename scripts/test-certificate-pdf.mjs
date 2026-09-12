import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { createCertificatePdf } from '../src/features/certification/pdf.ts';

test('demo certificate PDF contains a page and embedded verification QR', async () => {
  const bytes = await createCertificatePdf({
    serial: 'DEMO-0123456789ABCDEF01234567', title: 'MareSalvo — percorso dimostrativo',
    holder: 'Giulia D’Amico', issuedAt: '2026-09-12T10:00:00Z', expiresAt: '2027-09-12T10:00:00Z',
    status: 'issued', verificationUrl: 'http://localhost:3000/verifica?code=' + 'a'.repeat(64),
  });
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.match(pdf.getTitle(), /DEMO/);
  assert.ok(pdf.getPage(0).node.Resources().toString().includes('/XObject'));
  await mkdir(new URL('../output/certification/', import.meta.url), { recursive: true });
  await writeFile(new URL('../output/certification/demo-certificate.pdf', import.meta.url), bytes);
});

test('non-Latin and long holder names do not break PDF generation', async () => {
  for (const holder of ['李明', 'A'.repeat(250)]) {
    const bytes = await createCertificatePdf({ serial: 'DEMO-TEST', title: 'Demo', holder,
      issuedAt: '2026-09-12', expiresAt: null, status: 'revoked', verificationUrl: 'https://example.test/verifica?code=12345678' });
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
  }
});
