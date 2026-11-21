/**
 * Service Module: System Health Checks and Diagnostics
 * Milestone: Milestone 3: Endpoints & Application Integration
 * Provides comprehensive health checking for production readiness.
 */

import { PrismaClient } from '@prisma/client';

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface HealthCheckResult {
  status: HealthStatus;
  latencyMs: number;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  cpu: {
    user: number;
    system: number;
  };
  platform: string;
  nodeVersion: string;
}

export interface AggregatedHealthStatus {
  status: HealthStatus;
  checks: Record<string, HealthCheckResult>;
  metrics: SystemMetrics;
  timestamp: string;
}

interface CheckDatabaseOptions {
  prisma?: PrismaClient;
}

interface CheckExternalApisOptions {
  endpoints?: Array<{ name: string; url: string; timeoutMs?: number }>;
}

const prisma = new PrismaClient();

export class SystemHealthService {
  private readonly authSecret: string;
  private readonly externalApiEndpoints: Array<{ name: string; url: string; timeoutMs: number }>;

  constructor() {
    this.authSecret = process.env.NEXTAUTH_SECRET ?? '';
    this.externalApiEndpoints = [
      { name: 'github', url: 'https://api.github.com', timeoutMs: 5000 },
      { name: 'vercel', url: 'https://api.vercel.com', timeoutMs: 5000 },
    ];
  }

  async checkDatabase(options: CheckDatabaseOptions = {}): Promise<HealthCheckResult> {
    const start = Date.now();
    const client = options.prisma ?? prisma;

    try {
      await client.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      return {
        status: latencyMs < 100 ? 'healthy' : 'degraded',
        latencyMs,
        details: { message: 'Database connection successful', query: 'SELECT 1' },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return {
        status: 'down',
        latencyMs,
        details: { message: 'Database connection failed', error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async checkAuth(): Promise<HealthCheckResult> {
    const start = Date.now();

    if (!this.authSecret) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        details: { message: 'NEXTAUTH_SECRET is not configured' },
        timestamp: new Date().toISOString(),
      };
    }

    if (this.authSecret.length < 32) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: { message: 'NEXTAUTH_SECRET is shorter than recommended 32 characters' },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
      details: { message: 'Authentication secret is properly configured' },
      timestamp: new Date().toISOString(),
    };
  }

  async checkExternalApis(options: CheckExternalApisOptions = {}): Promise<HealthCheckResult> {
    const start = Date.now();
    const endpoints = options.endpoints ?? this.externalApiEndpoints;
    const results: Record<string, { status: HealthStatus; latencyMs: number; error?: string }> = {};

    await Promise.all(
      endpoints.map(async (endpoint) => {
        const endpointStart = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), endpoint.timeoutMs);
          const response = await fetch(endpoint.url, { signal: controller.signal, method: 'HEAD' });
          clearTimeout(timeoutId);
          const latencyMs = Date.now() - endpointStart;
          results[endpoint.name] = {
            status: response.ok ? 'healthy' : 'degraded',
            latencyMs,
          };
        } catch (error) {
          results[endpoint.name] = {
            status: 'down',
            latencyMs: Date.now() - endpointStart,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const allHealthy = Object.values(results).every((r) => r.status === 'healthy');
    const anyDown = Object.values(results).some((r) => r.status === 'down');

    return {
      status: allHealthy ? 'healthy' : anyDown ? 'down' : 'degraded',
      latencyMs: Date.now() - start,
      details: { endpoints: results },
      timestamp: new Date().toISOString(),
    };
  }

  async checkCache(): Promise<HealthCheckResult> {
    const start = Date.now();
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        details: { message: 'REDIS_URL not configured, cache check skipped' },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${redisUrl.replace('redis://', 'http://')}/ping`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return {
        status: response.ok ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        details: { message: response.ok ? 'Cache (Redis) reachable' : 'Cache responded with error' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        details: { message: 'Cache (Redis) unreachable' },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async checkStorage(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      const fs = await import('fs/promises');
      const testPath = '/tmp/health-check-test';
      await fs.writeFile(testPath, 'test');
      await fs.unlink(testPath);

      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        details: { message: 'File system read/write operational' },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        details: { message: 'File system check failed', error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date().toISOString(),
      };
    }
  }

  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal + memoryUsage.external;
    const usedMemory = memoryUsage.heapUsed;
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100),
      },
      uptime: process.uptime(),
      cpu: {
        user: cpuUsage.user / 1000,
        system: cpuUsage.system / 1000,
      },
      platform: process.platform,
      nodeVersion: process.version,
    };
  }

  async getAggregatedHealth(): Promise<AggregatedHealthStatus> {
    const [database, auth, externalApis, cache, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkAuth(),
      this.checkExternalApis(),
      this.checkCache(),
      this.checkStorage(),
    ]);

    const checks = { database, auth, externalApis, cache, storage };
    const statuses = Object.values(checks).map((c) => c.status);

    let overallStatus: HealthStatus = 'healthy';
    if (statuses.includes('down')) overallStatus = 'down';
    else if (statuses.includes('degraded')) overallStatus = 'degraded';

    return {
      status: overallStatus,
      checks,
      metrics: this.getSystemMetrics(),
      timestamp: new Date().toISOString(),
    };
  }
}

export const systemHealthService = new SystemHealthService();