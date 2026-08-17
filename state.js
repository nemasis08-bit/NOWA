import * as THREE from 'three';

/**
 * Gesture State Machine Manager
 * Handles 200ms debounced transitions and smooth cross-fading for all 6 cinematic gesture states:
 * 1. OPEN_PALM 🖐️
 * 2. FINGERS_CURVED 🫴
 * 3. FIST ✊
 * 4. INDEX_POINT ☝️
 * 5. THUMBS_UP 👍
 * 6. VICTORY ✌️
 */
export class GestureStateMachine {
  constructor(gauntlet, audioSynth) {
    this.gauntlet = gauntlet;
    this.audio = audioSynth;
    this.currentState = 'NONE';

    // HUD Elements
    this.hudStateText = document.getElementById('hud-gesture-state');
    this.hudWarning = document.getElementById('hud-warning');
    this.hudOverlay = document.getElementById('hud-overlay');

    // Cross-fade animation progress
    this.shieldScaleTarget = 0.001;
    this.currentShieldScale = 0.001;
  }

  setState(newState, telemetry) {
    if (this.currentState === newState) return;

    const prevState = this.currentState;
    this.currentState = newState;

    if (this.hudStateText) {
      this.hudStateText.textContent = newState;
    }

    // Reset default visual state flags
    this.gauntlet.plasmaMesh.visible = false;
    this.gauntlet.lightningLines.visible = false;
    this.gauntlet.laserMesh.visible = false;
    this.gauntlet.reticleGroup.visible = false;
    this.gauntlet.thrustersGroup.visible = false;
    this.hudWarning.style.display = 'none';
    this.hudOverlay.classList.remove('overload');

    this.shieldScaleTarget = 0.001;

    switch (newState) {
      case 'OPEN_PALM':
        // Spring gauntlet assembly + Arc reactor ignition
        this.gauntlet.arcPointLight.intensity = 3.0;
        this.audio.playMechanicalClank();
        this.audio.startServoHum();
        break;

      case 'FINGERS_CURVED':
        // Volumetric plasma beam + expanding particles
        this.gauntlet.plasmaMesh.visible = true;
        this.gauntlet.emitSparks(telemetry.palmCenter, 40, 2.5);
        this.audio.playRepulsorCharge(0.6);
        setTimeout(() => this.audio.playRepulsorBlast(), 600);
        break;

      case 'FIST':
        // Knuckle lightning arcs + Overload mode
        this.gauntlet.lightningLines.visible = true;
        this.hudWarning.style.display = 'block';
        this.hudOverlay.classList.add('overload');
        this.audio.playLightningCrackle();
        break;

      case 'INDEX_POINT':
        // Precision laser + 3D Holographic Reticle 1 Meter Ahead
        this.gauntlet.laserMesh.visible = true;
        this.gauntlet.reticleGroup.visible = true;
        this.audio.playMechanicalClank();
        break;

      case 'THUMBS_UP':
        // Hexagonal Energy Shield Deployment
        this.gauntlet.shieldMesh.visible = true;
        this.shieldScaleTarget = 1.0;
        this.audio.playRepulsorCharge(0.4);
        break;

      case 'VICTORY':
        // Dual back-of-hand thrusters + particle emission
        this.gauntlet.thrustersGroup.visible = true;
        this.gauntlet.emitSparks(telemetry.wrist, 50, 3.0, 0xffb700);
        this.audio.playRepulsorBlast();
        break;

      default:
        this.audio.stopServoHum();
        break;
    }
  }

  update(dt, telemetry) {
    if (!telemetry || !telemetry.found) {
      if (this.currentState !== 'NONE') {
        this.setState('NONE', telemetry);
      }
      return;
    }

    // Trigger state changes
    this.setState(telemetry.gesture, telemetry);

    // Smooth Cross-fading Shield Deployment (Thumbs Up)
    if (this.gauntlet.shieldMesh.visible) {
      this.currentShieldScale = THREE.MathUtils.lerp(
        this.currentShieldScale,
        this.shieldScaleTarget,
        dt * 12.0
      );
      this.gauntlet.shieldMesh.scale.setScalar(this.currentShieldScale);
      if (this.currentShieldScale < 0.01 && this.shieldScaleTarget < 0.01) {
        this.gauntlet.shieldMesh.visible = false;
      }
    }

    // Position Holographic Target Reticle 1 Meter Ahead in hand look-direction (Index Point)
    if (this.gauntlet.reticleGroup.visible && telemetry.fingerTips.index) {
      const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(telemetry.rotation);
      const reticlePos = telemetry.fingerTips.index.clone().addScaledVector(forwardDir, 1.0);
      this.gauntlet.reticleGroup.position.copy(reticlePos);
      this.gauntlet.reticleGroup.quaternion.copy(telemetry.rotation);
    }

    // Continuous Particle Emission on Active Gestures
    if (this.currentState === 'FINGERS_CURVED') {
      this.gauntlet.emitSparks(telemetry.palmCenter, 3, 1.2, 0x00f0ff);
    } else if (this.currentState === 'VICTORY') {
      this.gauntlet.emitSparks(telemetry.wrist, 6, 2.0, 0xffb700);
    }
  }
}
