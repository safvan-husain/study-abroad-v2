import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { CoordinatorModule } from "./coordinator/coordinator.module.js";

@Module({ imports: [HealthModule, CoordinatorModule] })
export class AppModule {}
