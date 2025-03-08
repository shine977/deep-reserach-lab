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
  
  /**
   * Custom application logger with colored terminal output
   * Independent implementation without NestJS dependency
   */

  const PREFIX = "[DeepRearchLab]";
  export class ApplicationLogger {
    private context?: string;
  
    constructor(context?: string) {
      this.context = context;
    }
  
    error(message: string, context?: string): void {
      const contextToUse = context || this.context;
      const timestamp = new Date().toLocaleString();
      console.error(
        `${colors.red}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.red}ERROR${colors.reset} ${
          contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
        }${colors.red}${message}${colors.reset}`
      );
    }
  
    log(message: string, context?: string): void {
      const contextToUse = context || this.context;
      const timestamp = new Date().toLocaleString();
      console.log(
        `${colors.green}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.green}INFO${colors.reset} ${
          contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
        }${message}`
      );
    }
  
    warn(message: string, context?: string): void {
      const contextToUse = context || this.context;
      const timestamp = new Date().toLocaleString();
      console.warn(
        `${colors.yellow}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.yellow}WARN${colors.reset} ${
          contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
        }${message}`
      );
    }
  
    debug(message: string, context?: string): void {
      const contextToUse = context || this.context;
      const timestamp = new Date().toLocaleString();
      console.debug(
        `${colors.blue}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.blue}DEBUG${colors.reset} ${
          contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
        }${message}`
      );
    }
  
    verbose(message: string, context?: string): void {
      const contextToUse = context || this.context;
      const timestamp = new Date().toLocaleString();
      console.log(
        `${colors.cyan}${colors.bright}${PREFIX}${colors.reset} - ${colors.dim}${timestamp}${colors.reset}   ${colors.cyan}VERBOSE${colors.reset} ${
          contextToUse ? `${colors.yellow}[${contextToUse}]${colors.reset} ` : ""
        }${message}`
      );
    }
  }