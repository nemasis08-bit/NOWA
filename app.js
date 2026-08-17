import * as THREE from 'three';
import { RenderPipeline } from './pipeline.js';
import { HandTracker } from './vision.js';
import { AudioSynthesizer } from './audio.js';
import { GestureStateMachine } from './state.js';

/**
 * Main Application Orchestrator for Mark VII JARVIS HUD
 */
class App {
  constructor() {
    this.video = document.getElementById('webcam');
    this.canvas = document.getElementById('three-canvas');
    this.debugCanvas = document.getElementById('debug-skeleton-canvas');

    // UI Overlay elements
    this.btnStart = document.getElementById('btn-start');
    this.btnAudio = document.getElementById('btn-audio');
    this.btnDebug = document.getElementById('btn-debug');
    this.btnErrorRetry = document.getElementById('btn-error-retry');

    this.startModal = document.getElementById('start-modal');
    this.errorModal = document.getElementById('error-modal');
    this.errorMessage = document.getElementById('error-message');

    this.hudSysStatus = document.getElementById('hud-sys-status');
    this.hudSyncStatus = document.getElementById('hud-sync-status');

    this.debugOverlay = document.getElementById('debug-overlay');
    this.debugFps = document.getElementById('debug-fps');
    this.debugState = document.getElementById('debug-state');
    this.debugWrist = document.getElementById('debug-wrist');
    this.debugQuat = document.getElementById('debug-quat');
    this.debugHandFound = document.getElementById('debug-hand-found');
    this.debugConfidence = document.getElementById('debug-confidence');

    // Subsystem instances
    this.pipeline = null;
    this.tracker = null;
    this.audio = new AudioSynthesizer();
    this.stateMachine = null;

    this.axesHelper = null;
    this.debugMode = false;

    // Performance telemetry
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fps = 60;
    this.clock = new THREE.Clock();

    this.bindEvents();
  }

  bindEvents() {
    this.btnStart.addEventListener('click', () => this.startSystem());
    this.btnAudio.addEventListener('click', () => {
      const enabled = this.audio.toggleAudio();
      this.btnAudio.textContent = enabled ? '🔊 AUDIO: ON' : '🔇 AUDIO: OFF';
    });

    this.btnDebug.addEventListener('click', () => this.toggleDebugMode());
    this.btnErrorRetry.addEventListener('click', () => {
      this.errorModal.style.display = 'none';
      this.startSystem();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') {
        this.toggleDebugMode();
      }
    });
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    this.debugOverlay.style.display = this.debugMode ? 'block' : 'none';
    if (this.axesHelper) {
      this.axesHelper.visible = this.debugMode;
    }
  }

  showError(msg) {
    this.errorMessage.textContent = msg;
    this.errorModal.style.display = 'flex';
  }

  async startSystem() {
    this.startModal.style.display = 'none';
    if (this.hudSysStatus) this.hudSysStatus.textContent = "ONLINE";
    if (this.hudSyncStatus) this.hudSyncStatus.textContent = "100%";

    try {
      // 1. Initialize WebGL 2.0 Render Pipeline
      this.pipeline = new RenderPipeline(this.canvas);

      // Add AxesHelper to palm center for Debug mode
      this.axesHelper = new THREE.AxesHelper(0.15);
      this.axesHelper.visible = false;
      this.pipeline.gauntlet.group.add(this.axesHelper);

      // 2. Initialize Audio Synthesizer
      this.audio.init();

      // 3. Initialize Computer Vision Tracker
      this.tracker = new HandTracker(this.video, this.debugCanvas);
      await this.tracker.init();

      // 4. Initialize Gesture State Machine
      this.stateMachine = new GestureStateMachine(this.pipeline.gauntlet, this.audio);

      // Play start sound
      this.audio.playMechanicalClank();

      // 5. Start main animation loop
      this.clock.start();
      requestAnimationFrame((t) => this.animate(t));
    } catch (err) {
      console.error("System startup failed:", err);
      this.showError(err.message || "Failed to initialize WebGL or Camera stream.");
    }
  }

  animate(now) {
    requestAnimationFrame((t) => this.animate(t));

    // Calculate delta time
    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Calculate FPS telemetry
    this.frameCount++;
    if (now - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = now;
      if (this.debugFps) this.debugFps.textContent = this.fps;
    }

    // 1. Update Hand Computer Vision
    const telemetry = this.tracker.update(this.pipeline.camera, this.pipeline.camera.aspect);

    if (telemetry && telemetry.found) {
      // Update spring physics kinematics
      this.pipeline.gauntlet.updatePhysics(dt, telemetry.wrist, telemetry.rotation, true);

      // Update gesture state machine
      this.stateMachine.update(dt, telemetry);

      // Update telemetry panel in Debug mode
      if (this.debugMode) {
        this.debugHandFound.textContent = "YES";
        this.debugConfidence.textContent = telemetry.confidence.toFixed(2);
        this.debugState.textContent = telemetry.gesture;
        this.debugWrist.textContent = `X:${telemetry.wrist.x.toFixed(2)} Y:${telemetry.wrist.y.toFixed(2)} Z:${telemetry.wrist.z.toFixed(2)}`;
        this.debugQuat.textContent = `X:${telemetry.rotation.x.toFixed(2)} Y:${telemetry.rotation.y.toFixed(2)} Z:${telemetry.rotation.z.toFixed(2)} W:${telemetry.rotation.w.toFixed(2)}`;
      }
    } else {
      this.pipeline.gauntlet.updatePhysics(dt, null, null, false);
      if (this.stateMachine) this.stateMachine.update(dt, null);

      if (this.debugMode) {
        this.debugHandFound.textContent = "NO";
        this.debugState.textContent = "IDLE";
      }
    }

    // 2. Render Three.js Scene & Selective Bloom Composer
    this.pipeline.render();
  }
}

// Initialize Application once DOM content is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
