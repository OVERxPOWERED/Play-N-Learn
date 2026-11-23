import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from '@/services/configure-system-healthService';
import { performanceProfilerService } from '@/services/performanceProfilerService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latencyMs: number;
    details?: Record<string, unknown>;
    error?: string;
  }>;
  timestamp: string;
  version: string;
  uptimeMs: number;
}

function createHealthResponse(
  result: Awaited<ReturnType<typeof healthCheckService.runFullHealthCheck>>
): HealthCheckResponse {
  const checks: Record<string, HealthCheckResponse['checks'][string]> = {};
  
  for (const check of result.checks) {
    checks[check.name] = {
      status: check.status,
      latencyMs: check.latencyMs,
      details: check.details,
      error: check.error,
    };
  }

  return {
    status: result.status,
    checks,
    timestamp: result.timestamp,
    version: result.version,
    uptimeMs: result.uptimeMs,
  };
}

function getStatusCode(status: 'healthy' | 'degraded' | 'unhealthy'): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 200;
    case 'unhealthy':
      return 503;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now();
  
  try {
    const healthResult = await healthCheckService.runFullHealthCheck();
    const response = createHealthResponse(healthResult);
    
    const totalLatency = performance.now() - startTime;
    
    performanceProfilerService.recordMetric({
      name: 'health_check_duration_ms',
      value: totalLatency,
      tags: { endpoint: 'full', status: healthResult.status },
      timestamp: Date.now(),
    });

    return NextResponse.json(response, {
      status: getStatusCode(response.status),
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Health-Check-Duration': `${totalLatency.toFixed(2)}ms`,
      },
    });
  } catch (error) {
    const totalLatency = performance.now() - startTime;
    
    performanceProfilerService.recordMetric({
      name: 'health_check_error',
      value: 1,
      tags: { endpoint: 'full', error: error instanceof Error ? error.name : 'unknown' },
      timestamp: Date.now(),
    });

    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      checks: {
        system: {
          status: 'unhealthy',
          latencyMs: totalLatency,
          error: error instanceof Error ? error.message : 'Health check failed',
        },
      },
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptimeMs: Date.now() - healthCheckService.getStartTime(),
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}