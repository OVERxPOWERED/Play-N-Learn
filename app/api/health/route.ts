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
          sessionValid: !!session,
          provider: 'next-auth',
        },
      };
    } catch (error) {
      return {
        name: 'auth',
        status: 'degraded',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Auth service check failed',
      };
    }
  }

  private async checkExternalAPIs(): Promise<HealthCheckResult> {
    const start = Date.now();
    const results: Record<string, { status: string; latencyMs: number }> = {};
    let overallHealthy = true;

    const apiChecks = [
      { name: 'redis', url: process.env.REDIS_HEALTH_URL || 'http://localhost:6379/health' },
      { name: 'email', url: process.env.EMAIL_SERVICE_HEALTH_URL },
      { name: 'storage', url: process.env.STORAGE_SERVICE_HEALTH_URL },
    ].filter(Boolean);

    await Promise.all(
      apiChecks.map(async (api) => {
        const apiStart = Date.now();
        try {
          if (!api.url) {
            results[api.name] = { status: 'skipped', latencyMs: 0 };
            return;
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const response = await fetch(api.url!, { signal: controller.signal });
          clearTimeout(timeout);
          
          const latency = Date.now() - apiStart;
          const healthy = response.ok;
          results[api.name] = { status: healthy ? 'healthy' : 'unhealthy', latencyMs: latency };
          if (!healthy) overallHealthy = false;
        } catch {
          const latency = Date.now() - apiStart;
          results[api.name] = { status: 'unhealthy', latencyMs: latency };
          overallHealthy = false;
        }
      })
    );

    return {
      name: 'external_apis',
      status: overallHealthy ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
      details: results,
    };
  }

  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const externalMB = Math.round(usage.external / 1024 / 1024);
      const rssMB = Math.round(usage.rss / 1024 / 1024);
      
      const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;
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
          externalMB,
          rssMB,
          heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
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
      const userCPU = cpuUsage.user / 1000;
      const systemCPU = cpuUsage.system / 1000;
      const totalCPU = userCPU + systemCPU;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (totalCPU > 80) status = 'unhealthy';
      else if (totalCPU > 60) status = 'degraded';

      return {
        name: 'cpu',
        status,
        latencyMs: Date.now() - start,
        details: {
          userCPUTimeMs: Math.round(userCPU),
          systemCPUTimeMs: Math.round(systemCPU),
          totalCPUTimeMs: Math.round(totalCPU),
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
      const fs = await import('fs');
      const stats = fs.statSync(process.cwd());
      
      return {
        name: 'disk',
        status: 'healthy',
        latencyMs: Date.now() - start,
        details: {
          path: process.cwd(),
          accessible: true,
        },
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Disk space check failed',
      };
    }
  }

  private async checkSSEConnectionPool(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const maxConnections = parseInt(process.env.MAX_SSE_CONNECTIONS || '1000', 10);
      const usagePercent = (this.sseConnectionCount / maxConnections) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (usagePercent > 90) status = 'unhealthy';
      else if (usagePercent > 75) status = 'degraded';

      return {
        name: 'sse_pool',
        status,
        latencyMs: Date.now() - start,
        details: {
          activeConnections: this.sseConnectionCount,
          maxConnections,
          usagePercent: Math.round(usagePercent * 100) / 100,
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
    if (checks.length === 0) return 'healthy';
    
    const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');
    const hasDegraded = checks.some((c) => c.status === 'degraded');
    
    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }
}

const healthCheckService = HealthCheckService.getInstance();

function verifyInternalAccess(request: NextRequest): boolean {
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (!secret) return true;
  
  const providedSecret = request.headers.get('x-health-check-secret');
  return providedSecret === secret;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyInternalAccess(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'readiness';
  
  let response: HealthResponse;
  
  switch (type) {
    case 'liveness':
      response = await healthCheckService.runLivenessCheck();
      break;
    case 'readiness':
      response = await healthCheckService.runReadinessCheck();
      break;
    case 'full':
      response = await healthCheckService.runFullHealthCheck();
      break;
    default:
      response = await healthCheckService.runReadinessCheck();
  }

  const statusCode = response.status === 'healthy' ? 200 : response.status === 'degraded' ? 200 : 503;
  
  await telemetry.recordMetric('health_check', {
    type,
    status: response.status,
    checkCount: response.checks.length,
    unhealthyCount: response.checks.filter(c => c.status === 'unhealthy').length,
  });

  return NextResponse.json(response, { status: statusCode });
}