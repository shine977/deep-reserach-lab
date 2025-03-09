import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("/");
  await app.listen(3000);
  console.log("Server is running on: http://localhost:3000");
}

bootstrap();
