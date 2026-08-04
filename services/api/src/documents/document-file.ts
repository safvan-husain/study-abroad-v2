export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const matches = (buffer: Buffer, bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);

export function detectDocumentMime(buffer: Buffer): string | undefined {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && matches(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (buffer.length >= 8 && matches(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return undefined;
}

export function validatedDocumentMime(buffer: Buffer, declaredMime: string): string | undefined {
  const detected = detectDocumentMime(buffer);
  return detected === declaredMime ? detected : undefined;
}

export const extensionForMime = (mime: string) => ({
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
}[mime] ?? '');
