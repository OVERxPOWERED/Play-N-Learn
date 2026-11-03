import { NextRequest, NextResponse } from 'next/server';
import { telemetry } from '@/lib/telemetry/TelemetryService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

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
      this.checkTelemetry(),
      this.checkAuth(),
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

  async runFullHealthCheck(): Promise<HealthResponse> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkTelemetry(),
      this.checkAuth(),
      this.checkExternalAPIs(),
      this.checkMemoryUsage(),
      this.checkCPUUsage(),
      this.checkDiskSpace(),
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
      await prisma.$queryRaw`SELECT 1`;
      
      return {
        name: 'database',
        status: 'healthy',
        latencyMs: Date.now() - start,
        details: { 
          connected: true,
          provider: 'postgresql',
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkTelemetry(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const isHealthy = await telemetry.ping();
      
      return {
        name: 'telemetry',
        status: isHealthy ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        details: { 
          ping: isHealthy,
          service: 'telemetry',
        },
      };
    } catch (error) {
      return {
        name: 'telemetry',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Telemetry service unavailable',
      };
    }
  }

  private async checkAuth(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const session = await getServerSession(authOptions);
      
      return {
        name: 'auth',
        status: 'healthy',
        latencyMs: Date.now() - start,
        details: { 
          nextAuthConfigured: true,
          sessionAccessible: true,
          hasSession: !!session,
        },
      };
    } catch (error) {
      return {
        name: 'auth',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Auth service unavailable',
      };
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheckResult> {
    const start = Date.now();
    const apis = [
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
              details: { status: response.status },
            };
          } catch (fetchError) {
            return {
              name: api.name,
              status: 'unhealthy',
              latencyMs: Date.now() - apiStart,
              error: fetchError instanceof Error ? fetchError.message : 'API unreachable',
            };
          }
        })
      );

      const failedCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 'unhealthy').length;
      const degradedCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 'degraded').length;
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (failedCount > 0) overallStatus = 'unhealthy';
      else if (degradedCount > 0) overallStatus = 'degraded';

      return {
        name: 'external_apis',
        status: overallStatus,
        latencyMs: Date.now() - start,
        details: {
          apis: results.map(r => r.status === 'fulfilled' ? r.value : { name: 'unknown', status: 'unhealthy', error: r.reason }),
        },
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
      const heapUsagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);
      const rssMB = Math.round(usage.rss / 1024 / 1024);

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (heapUsagePercent > 90) status = 'unhealthy';
      else if (heapUsagePercent > 75) status = 'degraded';

      return {
        name: 'memory',
        status,
        latencyMs: Date.now() - start,
        details: {
          heapUsedMB,
          heapTotalMB,
          heapUsagePercent,
          rssMB,
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
  }

  private async checkCPUUsage(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (cpuPercent > 80) status = 'unhealthy';
      else if (cpuPercent > 60) status = 'degraded';

      return {
        name: 'cpu',
        status,
        latencyMs: Date.now() - start,
        details: {
          userMicroseconds: cpuUsage.user,
          systemMicroseconds: cpuUsage.system,
          totalPercent: Math.round(cpuPercent * 100) / 100,
        },
      };
    } catch (error) {
      return {
        name: 'cpu',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'CPU check failed',
      };
    }
  }

  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const { statfs } = await import('fs/promises');
      const stats = await statfs(process.cwd());
      
      const totalGB = (stats.blocks * stats.bsize) / 1024 / 1024 / 1024;
      const freeGB = (stats.bfree * stats.bsize) / 1024 / 1024 / 1024;
      const usedPercent = Math.round(((totalGB - freeGB) / totalGB) * 100);

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (usedPercent > 90) status = 'unhealthy';
      else if (usedPercent > 80) status = 'degraded';

      return {
        name: 'disk',
        status,
        latencyMs: Date.now() - start,
        details: {
          totalGB: Math.round(totalGB * 100) / 100,
          freeGB: Math.round(freeGB * 100) / 100,
          usedPercent,
        },
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: { message: 'Disk check not available in this environment' },
      };
    }
  }

  private async checkSSEConnectionPool(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const count = this.sseConnectionCount;
      const maxConnections = parseInt(process.env.MAX_SSE_CONNECTIONS || '1000', 10);
      const usagePercent = Math.round((count / maxConnections) * 100);

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (usagePercent > 90) status = 'unhealthy';
      else if (usagePercent > 75) status = 'degraded';

      return {
        name: 'sse_pool',
        status,
        latencyMs: Date.now() - start,
        details: {
          activeConnections: count,
          maxConnections,
          usagePercent,
        },
      };
    } catch (error) {
      return {
        name: 'sse_pool',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'SSE pool check failed',
      };
    }
  }

  private evaluateOverallStatus(checks: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (checks.some(c => c.status === 'unhealthy')) return 'unhealthy';
    if (checks.some(c => c.status === 'degraded')) return 'degraded';
    return 'healthy';
  }

  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const healthService = HealthCheckService.getInstance();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const probe = searchParams.get('probe');

  try {
    let response: HealthResponse;
    let statusCode = 200;

    switch (probe) {
      case 'ready':
        response = await healthService.runReadinessCheck();
        statusCode = response.status === 'unhealthy' ? 503 : 200;
        break;
      case 'live':
        response = await healthService.runLivenessCheck();
        statusCode = response.status === 'unhealthy' ? 503 : 200;
        break;
      default:
        response = await healthService.runFullHealthCheck();
        statusCode = response.status === 'unhealthy' ? 503 : response.status === 'degraded' ? 200 : 200;
    }

    return NextResponse.json(response, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': probe || 'full',
      },
    });
  } catch (error) {
    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      checks: [{
        name: 'health_check',
        status: 'unhealthy',
        latencyMs: 0,
        error: error instanceof Error ? error.message : 'Health check failed',
      }],
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptimeMs: Date.now() - (healthService as any).startTime,
    };

    return NextResponse.json(errorResponse, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const probe = searchParams.get('probe');

  try {
    let response: HealthResponse;

    switch (probe) {
      case 'ready':
        response = await healthService.runReadinessCheck();
        break;
      case 'live':
        response = await healthService.runLivenessCheck();
        break;
      default:
        response = await healthService.runFullHealthCheck();
    }

    const statusCode = response.status === 'unhealthy' ? 503 : 200;
    
    return new NextResponse(null, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': probe || 'full',
        'X-Health-Status': response.status,
      },
    });
  } catch {
    return new NextResponse(null, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': 'unhealthy',
      },
    });
  }
}