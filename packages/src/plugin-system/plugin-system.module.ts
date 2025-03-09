// packages/src/plugin-system/plugin-system.module.ts
import { Module } from "@nestjs/common";
import { PluginRegistry } from "./services/plugin-registry.service";

@Module({
  providers: [PluginRegistry],
  exports: [PluginRegistry],
})
export class PluginSystemModule {}
