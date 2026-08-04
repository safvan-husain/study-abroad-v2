import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { DocumentsModule } from "./documents/documents.module.js";

@Module({ imports: [HealthModule, DocumentsModule] })
export class AppModule {}
