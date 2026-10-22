```typescript
import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type ErrorClassification = 'validation' | 'business' | 'system' | 'external';

export interface TelemetryContext {
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryEvent {
  name: string;
  properties?: Record<string, unknown>;
  context?: TelemetryContext;
  timestamp: string;
  level: LogLevel;
}

export interface TelemetryError extends TelemetryEvent {
  error: {
    name: string;
    message: string;
    stack?: string;
    classification: ErrorClassification;
    code?: string;
    statusCode?: number;
  };
}

export interface PerformanceMetric {
  operation: string;
  durationMs: number;
  context?: TelemetryContext;
  timestamp: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  traceId: string;
  spanId: string;
  message: string;
  context?: TelemetryContext;
  error?: TelemetryError['error'];
  metric?: PerformanceMetric;
  event?: TelemetryEvent;
}

const SERVICE_NAME = process.env.SERVICE_NAME || 'nextjs-app';
const DEFAULT_SAMPLE_RATE = parseFloat(process.env.TELEMETRY_SAMPLE_RATE || '1.0');

function generateTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

function generateSpanId(): string {
  return randomUUID().replace(/-/g, '').substring(0, 16);
}

function createStructuredLogEntry(
  level: LogLevel,
  message: string,
  context?: TelemetryContext,
  error?: TelemetryError['error'],
  metric?: PerformanceMetric,
  event?: TelemetryEvent
): StructuredLogEntry {
  const traceId = context?.traceId || generateTraceId();
  const spanId = context?.spanId || generateSpanId();

  return {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    traceId,
    spanId,
    message,
    context,
    error,
    metric,
    event,
  };
}

function shouldSample(sampleRate: number = DEFAULT_SAMPLE_RATE): boolean {
  return Math.random() < sampleRate;
}

function writeLog(entry: StructuredLogEntry): void {
  const logLine = JSON.stringify(entry);
  
  switch (entry.level) {
    case 'debug':
      console.debug(logLine);
      break;
    case 'info':
      console.info(logLine);
      break;
    case 'warn':
      console.warn(logLine);
      break;
    case 'error':
    case 'fatal':
      console.error(logLine);
      break;
  }
}

function classifyError(error: unknown): ErrorClassification {
  if (error instanceof TypeError || error instanceof RangeError || error instanceof SyntaxError) {
    return 'validation';
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    if (
      name.includes('validation') ||
      name.includes('unauthorized') ||
      name.includes('forbidden') ||
      message.includes('invalid') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found')
    ) {
      return 'validation';
    }
    
    if (
      name.includes('business') ||
      name.includes('domain') ||
      message.includes('business rule') ||
      message.includes('insufficient') ||
      message.includes('exceeded') ||
      message.includes('conflict')
    ) {
      return 'business';
    }
    
    if (
      name.includes('network') ||
      name.includes('timeout') ||
      name.includes('connection') ||
      name.includes('econnrefused') ||
      name.includes('etimedout') ||
      name.includes('external') ||
      name.includes('upstream') ||
      name.includes('downstream') ||
      message.includes('external service') ||
      message.includes('third party')
    ) {
      return 'external';
    }
  }
  
  return 'system';
}

function extractErrorDetails(error: unknown): TelemetryError['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      classification: classifyError(error),
      code: (error as NodeJS.ErrnoException).code,
      statusCode: (error as { statusCode?: number }).statusCode,
    };
  }
  
  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
      classification: 'system',
    };
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as { message: string; name?: string; stack?: string; code?: string; statusCode?: number };
    return {
      name: err.name || 'Error',
      message: err.message,
      stack: err.stack,
      classification: classifyError(error),
      code: err.code,
      statusCode: err.statusCode,
    };
  }
  
  return {
    name: 'UnknownError',
    message: String(error),
    classification: 'system',
  };
}

class TelemetryService {
  private static instance: TelemetryService;
  private sampleRate: number;
  private enabled: boolean;
  private customTags: Record<string, string>;

  private constructor() {
    this.sampleRate = DEFAULT_SAMPLE_RATE;
    this.enabled = process.env.TELEMETRY_ENABLED !== 'false';
    this.customTags = {};
  }

  static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  configure(options: { sampleRate?: number; enabled?: boolean; customTags?: Record<string, string> } = {}): void {
    if (options.sampleRate !== undefined) {
      this.sampleRate = Math.max(0, Math.min(1, options.sampleRate));
    }
    if (options.enabled !== undefined) {
      this.enabled = options.enabled;
    }
    if (options.customTags) {
      this.customTags = { ...this.customTags, ...options.customTags };
    }
  }

  private getContextFromHeaders(headers: Headers | Record<string, string | undefined>): TelemetryContext {
    const headerObj = headers instanceof Headers 
      ? Object.fromEntries(headers.entries()) 
      : headers;

    return {
      traceId: headerObj['x-trace-id'] || headerObj['trace-id'] || headerObj['x-request-id'],
      spanId: headerObj['x-span-id'] || headerObj['span-id'],
      userId: headerObj['x-user-id'] || headerObj['user-id'],
      sessionId: headerObj['x-session-id'] || headerObj['session-id'],
      requestId: headerObj['x-request-id'] || headerObj['request-id'],
    };
  }

  trackEvent(eventName: string, properties?: Record<string, unknown>, context?: TelemetryContext): void {
    if (!this.enabled || !shouldSample(this.sampleRate)) {
      return;
    }

    const enrichedContext: TelemetryContext = {
      ...context,
      ...