import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
dotenv.config({ path: path.join(repositoryRoot, ".env") });

async function bootstrap() { const app = await NestFactory.create(AppModule); app.enableCors(); await app.listen(process.env.API_PORT ?? 3001); }
void bootstrap();
