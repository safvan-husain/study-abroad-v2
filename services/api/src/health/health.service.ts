import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  getStatus() {
    return {
      status: "ok",
      service: "api",
      coordinator: process.env.USE_LIVE_COORDINATOR === "true" ? "live" : "fake",
    };
  }
}
