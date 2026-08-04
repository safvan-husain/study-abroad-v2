import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller.js';
import { SpacetimeUploadService } from './spacetime-upload.service.js';
import { DocumentCleanupService } from './document-cleanup.service.js';

@Module({ controllers: [DocumentsController], providers: [SpacetimeUploadService, DocumentCleanupService] })
export class DocumentsModule {}
