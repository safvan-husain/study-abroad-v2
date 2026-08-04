import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { extensionForMime, MAX_DOCUMENT_BYTES, validatedDocumentMime } from './document-file.js';
import { SpacetimeUploadService } from './spacetime-upload.service.js';

type UploadedDocument = { buffer: Buffer; size: number; mimetype: string; originalname: string };

@Controller('documents')
export class DocumentsController {
  constructor(private readonly spacetime: SpacetimeUploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } }))
  async upload(@UploadedFile() file: UploadedDocument | undefined, @Body('ticketId') ticketId?: string) {
    if (!file) throw new BadRequestException('A document file is required.');
    if (!ticketId || !/^[a-zA-Z0-9-]{1,128}$/.test(ticketId)) throw new BadRequestException('A valid upload ticket is required.');
    if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) throw new BadRequestException('Document must be no larger than 20 MB.');
    const detectedMime = validatedDocumentMime(file.buffer, file.mimetype);
    if (!detectedMime) throw new BadRequestException('Document content does not match its declared JPEG, PNG, WebP, or PDF type.');
    const root = process.env.UPLOAD_ROOT ?? '/tmp/study-abroad-uploads';
    await mkdir(root, { recursive: true, mode: 0o700 });
    const storageKey = `${ticketId}${extensionForMime(detectedMime)}`;
    const path = join(root, storageKey);
    try {
      await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
      await this.spacetime.consumeTicket({
        ticketId, originalName: basename(file.originalname).slice(0, 256), mimeType: detectedMime,
        byteSize: file.size, storageKey,
      });
      return { status: 'collected', documentType: detectedMime, expiresInDays: 7, reviewed: false };
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw new BadRequestException(error instanceof Error ? error.message : 'Upload ticket could not be consumed.');
    }
  }
}
