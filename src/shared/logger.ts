// 终端颜色代码
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

type ComplexMessage = string | undefined | unknown;

/**
 * Custom application logger with colored terminal output
 * Independent implementation without NestJS dependency
 */

const PREFIX = "[DeepRearchLab]";
export class ApplicationLogger {
  private context?: ComplexMessage;

  constructor(context?: ComplexMessage) {
    this.context = context;
  }

  error(message: ComplexMessage, context?: ComplexMessage): void {
    const contextToUse = context || this.context;
    const timestamp = new Date().toLocaleString();
    console.error(
      `${colors.red}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.red}ERROR${colors.reset} ${
        contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
      }${colors.red}${message}${colors.reset}`,
    );
  }

  log(message: ComplexMessage, context?: ComplexMessage): void {
    const contextToUse = context || this.context;
    const timestamp = new Date().toLocaleString();
    console.log(
      `${colors.green}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.green}INFO${colors.reset} ${
        contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
      }${message}`,
    );
  }

  warn(message: ComplexMessage, context?: ComplexMessage): void {
    const contextToUse = context || this.context;
    const timestamp = new Date().toLocaleString();
    console.warn(
      `${colors.yellow}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.yellow}WARN${colors.reset} ${
        contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
      }${message}`,
    );
  }

  debug(message: ComplexMessage, context?: ComplexMessage): void {
    const contextToUse = context || this.context;
    const timestamp = new Date().toLocaleString();
    console.debug(
      `${colors.magenta}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.magenta}DEBUG${colors.reset} ${
        contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
      }${message}`,
    );
  }

  verbose(message: ComplexMessage, context?: ComplexMessage): void {
    const contextToUse = context || this.context;
    const timestamp = new Date().toLocaleString();
    console.log(
      `${colors.cyan}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.cyan}VERBOSE${colors.reset} ${
        contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
      }${message}`,
    );
  }
  info(message: ComplexMessage, context?: ComplexMessage): void {
    const contextToUse = context || this.context;
    const timestamp = new Date().toLocaleString();
    console.info(
      `${colors.blue}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}${contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""}${colors.blue}${message}${colors.reset}`,
    );
  }
}
export const appLogger = new ApplicationLogger();
