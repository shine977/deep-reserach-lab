import { LoggerService } from "@nestjs/common";

type ComplexMessage = string | undefined | unknown;
export class Logger implements LoggerService {
  private name?: ComplexMessage;
  constructor(name?: ComplexMessage) {
    this.name = name;
  }
  private getColorByLogLevel(level: string): string {
    switch (level) {
      case "error":
        return "\x1b[31m";
      case "warn":
        return "\x1b[33m";
      case "info":
        return "\x1b[90m";
      case "debug":
        return "\x1b[35m";
      case "verbose":
        return "\x1b[35m";
      default:
        return "\x1b[37m";
    }
  }

  log(message: any, context?: string) {
    this.customLog(message, "info", context);
  }

  error(message: any, trace?: string, context?: string) {
    this.customLog(message, "error", context);
    if (trace) {
      console.error(
        `${this.getColorByLogLevel("error")}[ERROR] ${trace}\x1b[0m`,
      );
    }
  }

  warn(message: any, context?: string) {
    this.customLog(message, "warn", context);
  }

  debug(message: any, context?: string) {
    this.customLog(message, "debug", context);
  }

  verbose(message: any, context?: string) {
    this.customLog(message, "verbose", context);
  }
  info(message: any, context?: string) {
    this.customLog(message, "info", context);
  }

  private customLog(message: any, level: string, context?: string) {
    const color = this.getColorByLogLevel(level);
    const timestamp = new Date().toLocaleTimeString();
    // custom log
    console.log(
      `${color}[ DeepResearchLab ] ${timestamp} [${level.toUpperCase()}]${context ? ` [${context}]` : ""}: ${this.name ? ` [${this.name}]` : "LOG"} ${message}\x1b[0m`,
    );
  }
}
