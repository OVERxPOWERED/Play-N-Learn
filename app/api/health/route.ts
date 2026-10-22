```typescript
import { NextRequest, NextResponse } from 'next/server';
import { telemetry } from '@/lib/telemetry/TelemetryService';

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: string;
  version?: string;
  uptimeMs: number;
}

class HealthCheckService {
  private static instance: HealthCheckService;
  private startTime: number;
  private sseConnectionCount: number = 0;

  private constructor() {
    this.startTime = Date.now();
  }

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  setSSEConnectionCount(count: number): void {
    this.sseConnectionCount = count;
  }

  async runLivenessCheck(): Promise<HealthResponse> {
    const checks: HealthCheckResult[] = [];
    const overallStatus = this.evaluateOverallStatus(checks);
    
    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptimeMs: Date.now() - this.startTime,
    };
  }

  async runReadinessCheck(): Promise<HealthResponse> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkExternalAPIs(),
      this.checkMemoryUsage(),
      this.checkCPUUsage(),
      this.checkSSEConnectionPool(),
    ]);

    const overallStatus = this.evaluateOverallStatus(checks);
    
    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptimeMs: Date.now() - this.startTime,
    };
  }

  private async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Simulate database connectivity check
      // In production, replace with actual DB connection test
      const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      
      if (!dbUrl) {
        return {
          name: 'database',
          status: 'degraded',
          latencyMs: Date.now() - start,
          details: { message: 'Database URL not configured' },
        };
      }

      // Simulate connection test with timeout
      await this.simulateAsyncOperation(50);
      
      return {
        name: 'database',
        status: 'healthy',
        latencyMs: Date.now() - start,
        details: { 
          host: new URL(dbUrl).hostname,
          connected: true,
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheckResult> {
    const start = Date.now();
    const apis = [
      { name: 'auth', url: process.env.NEXTAUTH_URL },
      { name: 'storage', url: process.env.S3_ENDPOINT || process.env.BLOB_STORAGE_URL },
      { name: 'realtime', url: process.env.PUSHER_URL || process.env.ABLY_URL },
    ].filter(api => api.url);

    if (apis.length === 0) {
      return {
        name: 'external_apis',
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: { message: 'No external APIs configured' },
      };
    }

    try {
      const results = await Promise.allSettled(
        apis.map(async (api) => {
          const apiStart = Date.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${api.url}/health`, {
              method: 'GET',
              signal: controller.signal,
              headers: { 'User-Agent': 'HealthCheck/1.0' },
            });
            
            clearTimeout(timeout);
            
            return {
              name: api.name,
              status: response.ok ? 'healthy' : 'degraded',
              latencyMs: Date.now() - apiStart,
              statusCode: response.status,
            };
          } catch {
            return {
              name: api.name,
              status: 'unhealthy',
              latencyMs: Date.now() - apiStart,
              error: 'Connection failed or timeout',
            };
          }
        })
      );

      const apiChecks = results.map(r => r.status === 'fulfilled' ? r.value : { 
        name: 'unknown', 
        status: 'unhealthy' as const, 
        latencyMs: 0, 
        error: 'Check failed' 
      });

      const hasUnhealthy = apiChecks.some(c => c.status === 'unhealthy');
      const hasDegraded = apiChecks.some(c => c.status === 'degraded');

      return {
        name: 'external_apis',
        status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
        latencyMs: Date.now() - start,
        details: { apis: apiChecks },
      };
    } catch (error) {
      return {
        name: 'external_apis',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'External API check failed',
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(usage.rss / 1024 / 1024);
      const heapUsagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

      // Thresholds: warn at 70%, critical at 90%
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (heapUsagePercent >= 90) status = 'unhealthy';
      else if (heapUsagePercent >= 70) status = 'degraded';

      return {
        name: 'memory',
        status,
        latencyMs: Date.now() - start,
        details: {
          heapUsedMB,
          heapTotalMB,
          rssMB,
          heapUsagePercent,
          externalMB: Math.round(usage.external / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Memory check failed',
      };
    }