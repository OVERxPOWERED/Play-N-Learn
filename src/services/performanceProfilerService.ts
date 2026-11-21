import { PerformanceMetrics, GameLoopMetrics, ComponentRenderMetrics, WebVitalsMetrics } from '@/domain/models';
import { telemetryService } from './telemetryService';
import { gsap } from 'gsap';

interface ProfilerConfig {
  enabled: boolean;
  sampleRate: number;
  reportInterval: number;
  trackWebVitals: boolean;
  trackGameLoop: boolean;
  trackGSAP: boolean;
  trackComponents: boolean;
}

interface FrameData {
  timestamp: number;
  frameTime: number;
  renderTime: number;
  updateTime: number;
  drawCalls: number;
  memoryUsed?: number;
}

interface GSAPFrameData {
  timestamp: number;
  frameTime: number;
  lag: number;
  activeTweens: number;
  activeTimelines: number;
}

interface ComponentRenderData {
  componentName: string;
  mountTime: number;
  updateTime: number;
  renderCount: number;
  lastRenderDuration: number;
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private config: ProfilerConfig;
  private isRunning = false;
  private observers: PerformanceObserver[] = [];
  private frameData: FrameData[] = [];
  private gsapFrameData: GSAPFrameData[] = [];
  private componentData: Map<string, ComponentRenderData> = new Map();
  private webVitalsData: Partial<WebVitalsMetrics> = {};
  private gameLoopCallback: ((metrics: GameLoopMetrics) => void) | null = null;
  private gsapTickerId: number | null = null;
  private reportTimer: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;
  private frameCount = 0;
  private lastFrameTime = 0;

  private constructor() {
    this.config = {
      enabled: process.env.NODE_ENV === 'development',
      sampleRate: 1.0,
      reportInterval: 30000,
      trackWebVitals: true,
      trackGameLoop: true,
      trackGSAP: true,
      trackComponents: true,
    };
  }

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  configure(config: Partial<ProfilerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  start(): void {
    if (this.isRunning || !this.config.enabled) return;

    this.isRunning = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.lastFrameTime = this.startTime;

    if (this.config.trackWebVitals) {
      this.observeWebVitals();
    }

    if (this.config.trackGameLoop) {
      this.startGameLoopTracking();
    }

    if (this.config.trackGSAP) {
      this.startGSAPTracking();
    }

    this.reportTimer = setInterval(() => this.emitPeriodicReport(), this.config.reportInterval);

    telemetryService.emitMetric('profiler_started', { timestamp: this.startTime });
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    if (this.gsapTickerId !== null) {
      gsap.ticker.remove(this.gsapTickerId);
      this.gsapTickerId = null;
    }

    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    if (this.gameLoopCallback) {
      cancelAnimationFrame(this.gameLoopCallback as unknown as number);
      this.gameLoopCallback = null;
    }

    telemetryService.emitMetric('profiler_stopped', { 
      duration: performance.now() - this.startTime,
      framesCollected: this.frameData.length 
    });
  }

  private observeWebVitals(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    const observeEntry = (entryType: string, callback: (entries: PerformanceEntryList) => void) => {
      try {
        const observer = new PerformanceObserver((list) => callback(list.getEntries()));
        observer.observe({ type: entryType, buffered: true });
        this.observers.push(observer);
      } catch (e) {
        console.warn(`PerformanceObserver for ${entryType} not supported`);
      }
    };

    observeEntry('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1];
      this.webVitalsData.lcp = lastEntry.startTime;
      telemetryService.emitMetric('web_vital_lcp', { value: lastEntry.startTime, rating: this.rateLCP(lastEntry.startTime) });
    });

    observeEntry('first-input', (entries) => {
      const firstInput = entries[0] as PerformanceEventTiming;
      this.webVitalsData.fid = firstInput.processingStart - firstInput.startTime;
      telemetryService.emitMetric('web_vital_fid', { value: this.webVitalsData.fid, rating: this.rateFID(this.webVitalsData.fid!) });
    });

    observeEntry('layout-shift', (entries) => {
      let clsValue = 0;
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.webVitalsData.cls = clsValue;
      telemetryService.emitMetric('web_vital_cls', { value: clsValue, rating: this.rateCLS(clsValue) });
    });

    observeEntry('navigation', (entries) => {
      const nav = entries[0] as PerformanceNavigationTiming;
      this.webVitalsData.ttfb = nav.responseStart - nav.requestStart;
      telemetryService.emitMetric('web_vital_ttfb', { value: this.webVitalsData.ttfb, rating: this.rateTTFB(this.webVitalsData.ttfb) });
    });

    observeEntry('paint', (entries) => {
      entries.forEach(entry => {
        if (entry.name === 'first-contentful-paint') {
          this.webVitalsData.fcp = entry.startTime;
          telemetryService.emitMetric('web_vital_fcp', { value: entry.startTime, rating: this.rateFCP(entry.startTime) });
        }
      });
    });
  }

  private rateLCP(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private rateFID(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  private rateCLS(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  private rateTTFB(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 800) return 'good';
    if (value <= 1800) return 'needs-improvement';
    return 'poor';
  }

  private rateFCP(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 1800) return 'good';
    if (value <= 3000) return 'needs-improvement';
    return 'poor';
  }

  private startGameLoopTracking(): void {
    let lastTime = performance.now();
    let frameStartTime = 0;

    const tick = (currentTime: number) => {
      if (!this.isRunning) return;

      const frameTime = currentTime - lastTime;
      lastTime = currentTime;

      frameStartTime = performance.now();

      this.frameCount++;

      const frameData: FrameData = {
        timestamp: currentTime,
        frameTime,
        renderTime: 0,
        updateTime: 0,
        drawCalls: 0,
      };

      if (typeof performance.memory !== 'undefined') {
        frameData.memoryUsed = (performance.memory as any).usedJSHeapSize;
      }

      this.frameData.push(frameData);

      if (this.frameData.length > 1000) {
        this.frameData.shift();
      }

      this.gameLoopCallback = requestAnimationFrame(tick);
    };

    this.gameLoopCallback = requestAnimationFrame(tick);
  }

  recordGameLoopFrame(renderTime: number, updateTime: number, drawCalls: number): void {
    if (!this.isRunning || this.frameData.length === 0) return;

    const lastFrame = this.frameData[this.frameData.length - 1];
    lastFrame.renderTime = renderTime;
    lastFrame.updateTime = updateTime;
    lastFrame.drawCalls = drawCalls;
  }

  private startGSAPTracking(): void {
    let lastTickTime = gsap.ticker.time;

    this.gsapTickerId = gsap.ticker.add(() => {
      if (!this.isRunning) return;

      const currentTime = gsap.ticker.time * 1000;
      const frameTime = (gsap.ticker.time - lastTickTime) * 1000;
      lastTickTime = gsap.ticker.time;

      const gsapData: GSAPFrameData = {
        timestamp: currentTime,
        frameTime,
        lag: gsap.ticker.lagSmoothing ? gsap.ticker.lag : 0,
        activeTweens: gsap.globalTimeline?.getChildren?.()?.filter((t: any) => t.isActive?.())?.length || 0,
        activeTimelines: 0,
      };

      this.gsapFrameData.push(gsapData);

      if (this.gsapFrameData.length > 1000) {
        this.gsapFrameData.shift();
      }

      if (frameTime > 16.67 * 2) {
        telemetryService.emitMetric('gsap_frame_drop', { frameTime, lag: gsapData.lag });
      }
    });
  }

  trackComponentRender(componentName: string, renderDuration: number): void {
    if (!this.config.enabled || !this.config.trackComponents) return;

    const existing = this.componentData.get(componentName) || {
      componentName,
      mountTime: 0,
      updateTime: 0,
      renderCount: 0,
      lastRenderDuration: 0,
    };

    if (existing.renderCount === 0) {
      existing.mountTime = renderDuration;
    } else {
      existing.updateTime = (existing.updateTime * existing.renderCount + renderDuration) / (existing.renderCount + 1);
    }

    existing.renderCount++;
    existing.lastRenderDuration = renderDuration;

    this.componentData.set(componentName, existing);

    if (renderDuration > 16.67) {
      telemetryService.emitMetric('component_slow_render', { componentName, renderDuration });
    }
  }

  measureComponentRender<T extends (...args: any[]) => any>(
    componentName: string,
    renderFn: T
  ): T {
    return ((...args: any[]) => {
      const markName = `${componentName}_render_start`;
      const measureName = `${componentName}_render`;

      performance.mark(markName);
      try {
        return renderFn(...args);
      } finally {
        performance.mark(`${componentName}_render_end`);
        performance.measure(measureName, markName, `${componentName}_render_end`);
        const measure = performance.getEntriesByName(measureName)[0];
        this.trackComponentRender(componentName, measure.duration);
        performance.clearMarks(markName);
        performance.clearMarks(`${componentName}_render_end`);
        performance.clearMeasures(measureName);
      }
    }) as T;
  }

  private emitPeriodicReport(): void {
    const report = this.generateReport();
    telemetryService.emitMetric('performance_report', report);
  }

  generateReport(): PerformanceMetrics {
    const now = performance.now();
    const duration = now - this.startTime;

    const avgFrameTime = this.frameData.length > 0
      ? this.frameData.reduce((sum, f) => sum + f.frameTime, 0) / this.frameData.length
      : 0;

    const avgRenderTime = this.frameData.length > 0
      ? this.frameData.reduce((sum, f) => sum + f.renderTime, 0) / this.frameData.length
      : 0;

    const avgUpdateTime = this.frameData.length > 0
      ? this.frameData.reduce((sum, f) => sum + f.updateTime, 0) / this.frameData.length
      : 0;

    const totalDrawCalls = this.frameData.reduce((sum, f) => sum + f.drawCalls, 0);
    const avgDrawCalls = this.frameData.length > 0 ? totalDrawCalls / this.frameData.length : 0;

    const frameDrops = this.frameData.filter(f => f.frameTime > 33.33).length;
    const frameDropRate = this.frameData.length > 0 ? frameDrops / this.frameData.length : 0;

    const gsapAvgFrameTime = this.gsapFrameData.length > 0
      ? this.gsapFrameData.reduce((sum, f) => sum + f.frameTime, 0) / this.gsapFrameData.length
      : 0;

    const gsapFrameDrops = this.gsapFrameData.filter(f => f.frameTime > 33.33).length;

    const componentMetrics: ComponentRenderMetrics[] = Array.from(this.componentData.values()).map(c => ({
      componentName: c.componentName,
      mountTime: c.mountTime,
      averageUpdateTime: c.updateTime,
      renderCount: c.renderCount,
      lastRenderDuration: c.lastRenderDuration,
    }));

    const gameLoopMetrics: GameLoopMetrics = {
      averageFrameTime: avgFrameTime,
      averageRenderTime: avgRenderTime,
      averageUpdateTime: avgUpdateTime,
      averageDrawCalls: avgDrawCalls,
      frameDropRate,
      totalFrames: this.frameCount,
      memoryUsage: this.frameData[this.frameData.length - 1]?.memoryUsed,
    };

    return {
      timestamp: now,
      sessionDuration: duration,
      webVitals: this.webVitalsData as WebVitalsMetrics,
      gameLoop: gameLoopMetrics,
      gsap: {
        averageFrameTime: gsapAvgFrameTime,
        frameDrops: gsapFrameDrops,
        averageLag: this.gsapFrameData.length > 0
          ? this.gsapFrameData.reduce((sum, f) => sum + f.lag, 0) / this.gsapFrameData.length
          : 0,
        peakActiveTweens: Math.max(...this.gsapFrameData.map(f => f.activeTweens), 0),
      },
      components: componentMetrics,
      sampleCount: this.frameData.length,
    };
  }

  exportJSON(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  exportCSV(): string {
    const headers = ['timestamp', 'frameTime', 'renderTime', 'updateTime', 'drawCalls', 'memoryUsed'];
    const rows = this.frameData.map(f => [
      f.timestamp.toFixed(2),
      f.frameTime.toFixed(4),
      f.renderTime.toFixed(4),
      f.updateTime.toFixed(4),
      f.drawCalls.toString(),
      (f.memoryUsed || 0).toString(),
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  getWebVitals(): Partial<WebVitalsMetrics> {
    return { ...this.webVitalsData };
  }

  getGameLoopMetrics(): GameLoopMetrics | null {
    if (this.frameData.length === 0) return null;

    const avgFrameTime = this.frameData.reduce((sum, f) => sum + f.frameTime, 0) / this.frameData.length;
    const avgRenderTime = this.frameData.reduce((sum, f) => sum + f.renderTime, 0) / this.frameData.length;
    const avgUpdateTime = this.frameData.reduce((sum, f) => sum + f.updateTime, 0) / this.frameData.length;
    const avgDrawCalls = this.frameData.reduce((sum, f) => sum + f.drawCalls, 0) / this.frameData.length;
    const frameDrops = this.frameData.filter(f => f.frameTime > 33.33).length;

    return {
      averageFrameTime: avgFrameTime,
      averageRenderTime: avgRenderTime,
      averageUpdateTime: avgUpdateTime,
      averageDrawCalls: avgDrawCalls,
      frameDropRate: frameDrops / this.frameData.length,
      totalFrames: this.frameCount,
      memoryUsage: this.frameData[this.frameData.length - 1]?.memoryUsed,
    };
  }

  getComponentMetrics(): ComponentRenderMetrics[] {