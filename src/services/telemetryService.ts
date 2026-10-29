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
  correlationId?: string;
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

export interface SessionCreatedEvent {
  sessionId: string;
  playerId: string;
  gameType: string;
  correlationId?: string;
}

export interface SessionStartedEvent {
  sessionId: string;
  correlationId?: string;
}

export interface SessionPausedEvent {
  sessionId: string;
  duration: number;
  correlationId?: string;
}

export interface SessionResumedEvent {
  sessionId: string;
  correlationId?: string;
}

export interface SessionCompletedEvent {
  sessionId: string;
  score: number;
  duration: number;
  correlationId?: string;
}

export interface SessionAbandonedEvent {
  sessionId: string;
  reason: string;
  correlationId?: string;
}

export interface SessionErrorEvent {
  sessionId: string;
  errorCode: string;
  errorMessage: string;
  correlationId?: string;
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
    default:
      console.log(logLine);
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

class TelemetryService {
  private sampleRate: number;
  private enabled: boolean;

  constructor() {
    this.sampleRate = DEFAULT_SAMPLE_RATE;
    this.enabled = process.env.TELEMETRY_ENABLED !== 'false';
  }

  setSampleRate(rate: number): void {
    this.sampleRate = Math.max(0, Math.min(1, rate));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: TelemetryContext,
    error?: TelemetryError['error'],
    metric?: PerformanceMetric,
    event?: TelemetryEvent
  ): void {
    if (!this.enabled || !shouldSample(this.sampleRate)) {
      return;
    }

    const entry = createStructuredLogEntry(level, message, context, error, metric, event);
    writeLog(entry);
  }

  debug(message: string, context?: TelemetryContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: TelemetryContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: TelemetryContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: TelemetryContext, error?: Error): void {
    const classifiedError = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      classification: classifyError(error),
    } : undefined;
    this.log('error', message, context, classifiedError);
  }

  fatal(message: string, context?: TelemetryContext, error?: Error): void {
    const classifiedError = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      classification: classifyError(error),
    } : undefined;
    this.log('fatal', message, context, classifiedError);
  }

  trackEvent(event: TelemetryEvent): void {
    this.log(event.level, `Event: ${event.name}`, event.context, undefined, undefined, event);
  }

  trackError(error: TelemetryError): void {
    this.log(error.level, `Error: ${error.name}`, error.context, error.error);
  }

  trackMetric(metric: PerformanceMetric): void {
    this.log('info', `Metric: ${metric.operation}`, metric.context, undefined, metric);
  }

  trackSessionCreated(data: SessionCreatedEvent): void {
    const context: TelemetryContext = {
      sessionId: data.sessionId,
      userId: data.playerId,
      operation: 'session.created',
      component: 'game-session',
      correlationId: data.correlationId,
      metadata: {
        gameType: data.gameType,
      },
    };

    const event: TelemetryEvent = {
      name: 'session.created',
      properties: {
        sessionId: data.sessionId,
        playerId: data.playerId,
        gameType: data.gameType,
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'info',
    };

    this.trackEvent(event);
  }

  trackSessionStarted(data: SessionStartedEvent): void {
    const context: TelemetryContext = {
      sessionId: data.sessionId,
      operation: 'session.started',
      component: 'game-session',
      correlationId: data.correlationId,
    };

    const event: TelemetryEvent = {
      name: 'session.started',
      properties: {
        sessionId: data.sessionId,
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'info',
    };

    this.trackEvent(event);
  }

  trackSessionPaused(data: SessionPausedEvent): void {
    const context: TelemetryContext = {
      sessionId: data.sessionId,
      operation: 'session.paused',
      component: 'game-session',
      correlationId: data.correlationId,
      metadata: {
        duration: data.duration,
      },
    };

    const event: TelemetryEvent = {
      name: 'session.paused',
      properties: {
        sessionId: data.sessionId,
        duration: data.duration,
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'info',
    };

    this.trackEvent(event);
  }

  trackSessionResumed(data: SessionResumedEvent): void {
    const context: TelemetryContext = {
      sessionId: data.sessionId,
      operation: 'session.resumed',
      component: 'game-session',
      correlationId: data.correlationId,
    };

    const event: TelemetryEvent = {
      name: 'session.resumed',
      properties: {
        sessionId: data.sessionId,
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'info',
    };

    this.trackEvent(event);
  }

  trackSessionCompleted(data: SessionCompletedEvent): void {
    const context: TelemetryContext = {
      sessionId: data.sessionId,
      operation: 'session.completed',
      component: 'game-session',
      correlationId: data.correlationId,
      metadata: {
        score: data.score,
        duration: data.duration,
      },
    };

    const event: TelemetryEvent = {
      name: 'session.completed',
      properties: {
        sessionId: data.sessionId,
        score: data.score,
        duration: data.duration,
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'info',
    };

    this.trackEvent(event);
  }

  trackSessionAbandoned(data: SessionAbandonedEvent): void {
    const context: TelemetryContext = {
      sessionId: data.sessionId,
      operation: 'session.abandoned',
      component: 'game-session',
      correlationId: data.correlationId,
      metadata: {
        reason: data.reason,
      },
    };

    const event: TelemetryEvent = {
      name: 'session.abandoned',
      properties: {
        sessionId: data.sessionId,
        reason: data.reason,
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'warn',
    };

    this.trackEvent(event);
  }

  trackSessionError(data: SessionErrorEvent): void {
    const context: TelemetryContext = {
      sessionId: data.sessionId,
      operation: 'session.error',
      component: 'game-session',
      correlationId: data.correlationId,
      metadata: {
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      },
    };

    const error: TelemetryError = {
      name: 'session.error',
      properties: {
        sessionId: data.sessionId,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      },
      context,
      timestamp: new Date().toISOString(),
      level: 'error',
      error: {
        name: 'SessionError',
        message: data.errorMessage,
        classification: 'system',
        code: data.errorCode,
      },
    };

    this.trackError(error);
  }
}

export const telemetryService = new TelemetryService();
export default telemetryService;