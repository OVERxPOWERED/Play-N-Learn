"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Renderer, Camera, Orbit, Transform, Geometry, Mesh, Program, Texture, Vec2, Vec3 } from "ogl";
import gsap from "gsap";
import { useGameStateSync } from "@/hooks/useGameStateSync";

interface SpriteSheetConfig {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  totalFrames: number;
  frameRate: number;
}

interface GameCanvasProps {
  sessionId: string;
}

const SPRITE_CONFIGS: Record<string, SpriteSheetConfig> = {
  idle: { frameWidth: 64, frameHeight: 64, columns: 4, rows: 1, totalFrames: 4, frameRate: 8 },
  run: { frameWidth: 64, frameHeight: 64, columns: 6, rows: 1, totalFrames: 6, frameRate: 12 },
  jump: { frameWidth: 64, frameHeight: 64, columns: 4, rows: 1, totalFrames: 4, frameRate: 10 },
};

const VERTEX_SHADER = `
  attribute vec2 uv;
  attribute vec3 position;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D tMap;
  uniform vec2 uFrameOffset;
  uniform vec2 uFrameSize;
  varying vec2 vUv;
  void main() {
    vec2 frameUv = uFrameOffset + vUv * uFrameSize;
    gl_FragColor = texture2D(tMap, frameUv);
  }
`;

export function GameCanvas({ sessionId }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const sceneRef = useRef<Transform | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const texturesRef = useRef<Record<string, Texture>>({});
  const animationRef = useRef<gsap.core.Timeline | null>(null);
  const currentStateRef = useRef<string>("idle");
  const frameIndexRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { gameState, connectionStatus } = useGameStateSync(sessionId);

  const loadTexture = useCallback((src: string): Promise<Texture> => {
    return new Promise((resolve, reject) => {
      if (!rendererRef.current) {
        reject(new Error("Renderer not initialized"));
        return;
      }
      const texture = new Texture(rendererRef.current.gl);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        texture.image = img;
        texture.needsUpdate = true;
        resolve(texture);
      };
      img.onerror = () => reject(new Error(`Failed to load texture: ${src}`));
      img.src = src;
    });
  }, []);

  const initializeRenderer = useCallback(() => {
    if (!canvasRef.current) return;

    const renderer = new Renderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio, 2),
    });
    renderer.setSize(canvasRef.current.width, canvasRef.current.height);
    rendererRef.current = renderer;

    const camera = new Camera(renderer.gl, { fov: 45, near: 0.1, far: 100 });
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const scene = new Transform();
    sceneRef.current = scene;

    const geometry = new Geometry(renderer.gl, {
      position: { size: 3, data: new Float32Array([
        -0.5, -0.5, 0,
         0.5, -0.5, 0,
         0.5,  0.5, 0,
        -0.5,  0.5, 0,
      ]) },
      uv: { size: 2, data: new Float32Array([
        0, 1,
        1, 1,
        1, 0,
        0, 0,
      ]) },
      index: { data: new Uint16Array([0, 1, 2, 0, 2, 3]) },
    });

    const program = new Program(renderer.gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        tMap: { value: null },
        uFrameOffset: { value: new Vec2(0, 0) },
        uFrameSize: { value: new Vec2(1, 1) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new Mesh(renderer.gl, { geometry, program });
    mesh.setParent(scene);
    meshRef.current = mesh;

    return { renderer, camera, scene, mesh };
  }, []);

  const loadAllTextures = useCallback(async () => {
    try {
      const [idleTex, runTex, jumpTex] = await Promise.all([
        loadTexture("/spriteIdle.png"),
        loadTexture("/spriteRun.png"),
        loadTexture("/spriteJump.png"),
      ]);
      texturesRef.current = { idle: idleTex, run: runTex, jump: jumpTex };
      setIsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load textures");
    }
  }, [loadTexture]);

  const updateSpriteFrame = useCallback((state: string, frame: number) => {
    const mesh = meshRef.current;
    const textures = texturesRef.current;
    const config = SPRITE_CONFIGS[state];
    if (!mesh || !textures[state] || !config) return;

    const col = frame % config.columns;
    const row = Math.floor(frame / config.columns);
    const uFrameSize = new Vec2(1 / config.columns, 1 / config.rows);
    const uFrameOffset = new Vec2(col / config.columns, 1 - (row + 1) / config.rows);

    mesh.program.uniforms.tMap.value = textures[state];
    mesh.program.uniforms.uFrameSize.value = uFrameSize;
    mesh.program.uniforms.uFrameOffset.value = uFrameOffset;
  }, []);

  const playAnimation = useCallback((state: string, loop = true) => {
    if (currentStateRef.current === state) return;
    currentStateRef.current = state;

    const config = SPRITE_CONFIGS[state];
    if (!config) return;

    if (animationRef.current) {
      animationRef.current.kill();
    }

    frameIndexRef.current = 0;
    const timeline = gsap.timeline({ repeat: loop ? -1 : 0, onRepeat: () => { frameIndexRef.current = 0; } });

    for (let i = 0; i < config.totalFrames; i++) {
      timeline.to(
        { frame: i },
        {
          duration: 1 / config.frameRate,
          frame: i + 1,
          ease: "none",
          onUpdate: