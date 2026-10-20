```typescript
import { env } from '@/utils/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export type ErrorCategory =
  | 'validation'
  | 'business_logic'
  | 'external_service'
  | 'database'
  | 'authentication'
  | 'authorization'
  | 'rate_limit'
  | 'configuration'
  | 'unknown';

export interface ErrorEvent {
  id: string;
  timestamp: string;
  category: ErrorCategory;
  message: string;
  error: Error;
  context: LogContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

export interface MetricEvent {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'bytes' | 'percent';
  tags: Record<string, string>;
  timestamp: string;
}

export interface TimerHandle {
  end: (tags?: Record<string, string>) => number;
}

class Logger {
  private minLevel: LogLevel;
  private defaultContext: LogContext;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = env.NODE_ENV === 'development';
    this.minLevel = this.parseLogLevel(env.LOG_LEVEL || 'info');
    this.defaultContext = {
      service: env.NEXT_PUBLIC_APP_NAME || 'app',
      environment: env.NODE_ENV,
      version: env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    };
  }

  private parseLogLevel(level: string): LogLevel {
    const levels: Record<string, LogLevel> = {
      debug: 'debug',
      info: 'info',
      warn: 'warn',
      error: 'error',
    };
    return levels[level.toLowerCase()] || 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levelOrder: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levelOrder.indexOf(level) >= levelOrder.indexOf(this.minLevel);
  }

  private formatEntry(level: LogLevel, message: string, context: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.defaultContext, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as NodeJS.ErrnoException).code,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    const logLine = JSON.stringify(entry);

    if (this.isDevelopment) {
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m',
        info: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
      };
      const reset = '\x1b[0m';
      const color = colors[entry.level] || '';
      console[entry.level === 'debug' ? 'log' : entry.level](`${color}${logLine}${reset}`);
    } else {
      console[entry.level === 'debug' ? 'log' : entry.level](logLine);
    }
  }

  setCorrelationId(correlationId: string): void {
    this.defaultContext.correlationId = correlationId;
  }

  setDefaultContext(context: Partial<LogContext>): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  debug(message: string, context: LogContext = {}): void {
    if (!this.shouldLog('debug')) return;
    this.output(this.formatEntry('debug', message, context));
  }

  info(message: string, context: LogContext = {}): void {
    if (!this.shouldLog('info')) return;
    this.output(this.formatEntry('info', message, context));
  }

  warn(message: string, context: LogContext = {}): void {
    if (!this.shouldLog('warn')) return;
    this.output(this.formatEntry('warn', message, context));
  }

  error(message: string, error: Error, context: LogContext = {}): void {
    if (!this.shouldLog('error')) return;
    this.output(this.formatEntry('error', message, context, error));
  }

  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    childLogger.minLevel = this.minLevel;
    childLogger.isDevelopment = this.isDevelopment;
    return childLogger;
  }
}

class ErrorTracker {
  private logger: Logger;
  private errorHandlers: Array<(event: ErrorEvent) => void> = [];
  private maxErrorsInMemory = 1000;
  private recentErrors: ErrorEvent[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  onError(handler: (event: ErrorEvent) => void): () => void {
    this.errorHandlers.push(handler);
    return () => {
      const index = this.errorHandlers.indexOf(handler);
      if (index !== -1) this.errorHandlers.splice(index, 1);
    };
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('validation') || message.includes('validation') || message.includes('invalid input')) {
      return 'validation';
    }
    if (name.includes('unauthorized') || message.includes('unauthorized') || message.includes('401')) {
      return 'authentication';
    }
    if (name.includes('forbidden') || message.includes('forbidden') || message.includes('403')) {
      return 'authorization';
    }
    if (name.includes('rate') || message.includes('rate limit') || message.includes('429')) {
      return 'rate_limit';
    }
    if (name.includes('timeout') || name.includes('network') || name.includes('econnrefused') || name.includes('etimedout')) {
      return 'external_service';
    }
    if (name.includes('database') || name.includes('prisma') || name.includes('sql') || message.includes('connection')) {
      return 'database';
    }
    if (name.includes('config') || message.includes('configuration') || message.includes('env')) {
      return 'configuration';
    }
    if (message.includes('business') || message.includes('rule') || message.includes('policy')) {
      return 'business_logic';
    }

    return 'unknown';
  }

  private determineSeverity(category: ErrorCategory, error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (category === 'configuration' || category === 'database') return 'critical';
    if (category === 'authentication' || category === 'authorization' || category === 'external_service') return 'high';
    if (category === 'validation' || category === 'rate_limit') return 'medium';
    if (category === 'business_logic') return 'medium';
    return 'low';
  }

  capture(error: Error, context: LogContext =