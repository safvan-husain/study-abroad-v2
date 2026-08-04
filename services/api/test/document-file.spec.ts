import { describe, expect, it } from 'vitest';
import { detectDocumentMime, MAX_DOCUMENT_BYTES, validatedDocumentMime } from '../src/documents/document-file.js';

describe('guest document validation', () => {
  it('detects allowed formats from magic bytes rather than a filename', () => {
    expect(detectDocumentMime(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(detectDocumentMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectDocumentMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectDocumentMime(Buffer.from('not really a PDF'))).toBeUndefined();
  });

  it('fixes the collection limit at 20 MB', () => {
    expect(MAX_DOCUMENT_BYTES).toBe(20 * 1024 * 1024);
  });

  it('rejects MIME spoofing even when the filename and declaration look allowed', () => {
    const pdf = Buffer.from('%PDF-1.7');
    expect(validatedDocumentMime(pdf, 'application/pdf')).toBe('application/pdf');
    expect(validatedDocumentMime(pdf, 'image/png')).toBeUndefined();
    expect(validatedDocumentMime(Buffer.from('fake'), 'application/pdf')).toBeUndefined();
  });
});
