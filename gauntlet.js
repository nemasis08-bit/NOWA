import * as THREE from 'three';
import { createGauntletNormalMap } from './textures.js';
import { createHexShieldMaterial, createVolumetricPlasmaMaterial } from './shaders.js';

/**
 * Photorealistic Mark VII Gauntlet 3D Assembly, Custom Shaders, Instanced Particle Engine, Lightning, and Holographic Reticle.
 */
export class MarkVIIGauntlet {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Spring physics kinematic state
    this.targetPos = new THREE.Vector3();
    this.currentPos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.targetRot = new THREE.Quaternion();
    this.currentRot = new THREE.Quaternion();

    // Spring constants: realistic heavy mechanical bounce
    this.stiffness = 180.0;
    this.damping = 14.0;

    // Layer selection: Layer 0 = Standard PBR Metal, Layer 1 = Bloom Glow Energy
    this.BLOOM_LAYER = 1;

    // Normal Map
    this.normalMap = createGauntletNormalMap();

    // Assembly mesh groups
    this.armorParts = [];
    this.buildGauntletGeometry();
    this.buildShadersAndVFX();
    this.buildParticleSystem();
    this.buildLightningSystem();
    this.buildHolographicReticle();
  }

  buildGauntletGeometry() {
    // Materials
    // Red Armor Physical Material
    this.redArmorMat = new THREE.MeshPhysicalMaterial({
      color: 0xaa0d0d,
      metalness: 1.0,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
      normalMap: this.normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5)
    });

    // Gold Titanium Joints Material
    this.goldArmorMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0a100,
      metalness: 1.0,
      roughness: 0.18,
      clearcoat: 0.9,
      normalMap: this.normalMap,
      normalScale: new THREE.Vector2(0.4, 0.4)
    });

    // Silver Mechanical Inner Frame
    this.silverMetalMat = new THREE.MeshStandardMaterial({
      color: 0x8899a6,
      metalness: 0.9,
      roughness: 0.35
    });

    // Arc Reactor Core Glow Material (Layer 1 Bloom)
    this.arcCoreMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95
    });

    // Forearm Armor Shell
    const forearmGeo = new THREE.CylinderGeometry(0.08, 0.065, 0.22, 16);
    const forearmMesh = new THREE.Mesh(forearmGeo, this.redArmorMat);
    forearmMesh.position.set(0, -0.11, -0.02);
    this.group.add(forearmMesh);

    // Gold Wrist Plate Collar
    const wristPlateGeo = new THREE.CylinderGeometry(0.068, 0.07, 0.06, 16);
    const wristPlateMesh = new THREE.Mesh(wristPlateGeo, this.goldArmorMat);
    wristPlateMesh.position.set(0, -0.01, -0.01);
    this.group.add(wristPlateMesh);

    // Palm Core Base
    const palmBaseGeo = new THREE.BoxGeometry(0.09, 0.09, 0.035);
    const palmBaseMesh = new THREE.Mesh(palmBaseGeo, this.redArmorMat);
    palmBaseMesh.position.set(0, 0.03, 0);
    this.group.add(palmBaseMesh);

    // Arc Reactor Palm Core Torus
    const arcRingGeo = new THREE.TorusGeometry(0.025, 0.006, 16, 32);
    const arcRingMesh = new THREE.Mesh(arcRingGeo, this.goldArmorMat);
    arcRingMesh.position.set(0, 0.03, 0.018);
    this.group.add(arcRingMesh);

    const arcCoreGeo = new THREE.CircleGeometry(0.022, 32);
    this.arcCoreMesh = new THREE.Mesh(arcCoreGeo, this.arcCoreMat);
    this.arcCoreMesh.position.set(0, 0.03, 0.019);
    this.arcCoreMesh.layers.enable(this.BLOOM_LAYER); // Enable selective bloom
    this.group.add(this.arcCoreMesh);

    // Dynamic Point Light attached to Palm Arc Reactor
    this.arcPointLight = new THREE.PointLight(0x00f0ff, 2.5, 1.5);
    this.arcPointLight.position.set(0, 0.03, 0.05);
    this.group.add(this.arcPointLight);

    // Finger Segment Articulated Plates
    this.fingerPlates = [];
    const fingerPositions = [
      { name: 'thumb', pos: [0.055, 0.02, 0.01], scale: [0.015, 0.04, 0.015] },
      { name: 'index', pos: [0.035, 0.08, 0.005], scale: [0.014, 0.05, 0.014] },
      { name: 'middle', pos: [0.012, 0.09, 0.005], scale: [0.014, 0.055, 0.014] },
      { name: 'ring', pos: [-0.012, 0.085, 0.005], scale: [0.014, 0.05, 0.014] },
      { name: 'pinky', pos: [-0.035, 0.075, 0.005], scale: [0.012, 0.042, 0.012] }
    ];

    fingerPositions.forEach(f => {
      const segGeo = new THREE.BoxGeometry(f.scale[0], f.scale[1], f.scale[2]);
      const segMesh = new THREE.Mesh(segGeo, this.goldArmorMat);
      segMesh.position.set(...f.pos);
      this.group.add(segMesh);
      this.fingerPlates.push(segMesh);
    });

    // Dual Back-of-Hand Thruster Nozzles (Peace / Victory Gesture)
    this.thrustersGroup = new THREE.Group();
    const thrusterGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.04, 12);
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });

    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.position.set(-0.03, 0.01, -0.03);
    leftThruster.rotation.x = Math.PI * 0.5;

    const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightThruster.position.set(0.03, 0.01, -0.03);
    rightThruster.rotation.x = Math.PI * 0.5;

    this.thrustersGroup.add(leftThruster);
    this.thrustersGroup.add(rightThruster);
    this.thrustersGroup.visible = false;
    this.group.add(this.thrustersGroup);
  }

  buildShadersAndVFX() {
    // 1. Hexagonal Energy Shield Mesh (Thumbs Up)
    const shieldGeo = new THREE.IcosahedronGeometry(0.35, 3);
    this.shieldMat = createHexShieldMaterial();
    this.shieldMesh = new THREE.Mesh(shieldGeo, this.shieldMat);
    this.shieldMesh.position.set(0, 0.05, 0.1);
    this.shieldMesh.layers.enable(this.BLOOM_LAYER);
    this.shieldMesh.scale.set(0.001, 0.001, 0.001);
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // 2. Volumetric Plasma Beam Cylinder (Fingers Curved Repulsor)
    const plasmaGeo = new THREE.CylinderGeometry(0.01, 0.12, 2.5, 32, 1, true);
    plasmaGeo.translate(0, 1.25, 0); // Point forward along Y axis
    plasmaGeo.rotateX(Math.PI * 0.5); // Align along forward Z axis
    this.plasmaMat = createVolumetricPlasmaMaterial();
    this.plasmaMesh = new THREE.Mesh(plasmaGeo, this.plasmaMat);
    this.plasmaMesh.position.set(0, 0.03, 0.02);
    this.plasmaMesh.layers.enable(this.BLOOM_LAYER);
    this.plasmaMesh.visible = false;
    this.group.add(this.plasmaMesh);

    // 3. Index Precision Laser Cylinder (Index Point)
    const laserGeo = new THREE.CylinderGeometry(0.004, 0.004, 5.0, 8);
    laserGeo.translate(0, 2.5, 0);
    laserGeo.rotateX(Math.PI * 0.5);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    this.laserMesh = new THREE.Mesh(laserGeo, this.laserMat);
    this.laserMesh.position.set(0.035, 0.1, 0);
    this.laserMesh.layers.enable(this.BLOOM_LAYER);
    this.laserMesh.visible = false;
    this.group.add(this.laserMesh);
  }

  /**
   * High-Performance Instanced Particle Engine (1,000 instances) for Sparks & Exhaust
   */
  buildParticleSystem() {
    this.particleCount = 1000;
    const particleGeo = new THREE.TetrahedronGeometry(0.008, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    this.particleInstancedMesh = new THREE.InstancedMesh(particleGeo, particleMat, this.particleCount);
    this.particleInstancedMesh.layers.enable(this.BLOOM_LAYER);
    this.particleInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.particleData = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.particleCount; i++) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      this.particleInstancedMesh.setMatrixAt(i, dummy.matrix);

      this.particleData.push({
        position: new THREE.Vector3(0, -9999, 0),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1.0,
        size: 1.0
      });
    }

    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.particleInstancedMesh);
  }

  emitSparks(origin, count = 20, speed = 1.5, colorHex = 0x00f0ff) {
    let emitted = 0;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.particleCount && emitted < count; i++) {
      const p = this.particleData[i];
      if (p.life <= 0) {
        p.position.copy(origin);
        p.velocity.set(
          (Math.random() - 0.5) * speed,
          (Math.random() - 0.5) * speed,
          (Math.random() - 0.5) * speed
        );
        p.life = 0.4 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.size = 0.8 + Math.random() * 0.6;
        emitted++;
      }
    }
  }

  updateParticles(dt) {
    const dummy = new THREE.Object3D();
    const gravity = new THREE.Vector3(0, -0.8, 0);

    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particleData[i];
      if (p.life > 0) {
        p.life -= dt;
        p.velocity.addScaledVector(gravity, dt);
        p.position.addScaledVector(p.velocity, dt);

        const lifeRatio = Math.max(0, p.life / p.maxLife);
        const currentSize = p.size * lifeRatio;

        dummy.position.copy(p.position);
        dummy.scale.set(currentSize, currentSize, currentSize);
        dummy.updateMatrix();
        this.particleInstancedMesh.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.particleInstancedMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Knuckle Lightning Arc Manager (Fist Overload Mode)
   */
  buildLightningSystem() {
    this.lightningSegmentCount = 30;
    const positions = new Float32Array(this.lightningSegmentCount * 3 * 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0xff3333,
      linewidth: 3
    });

    this.lightningLines = new THREE.LineSegments(geometry, material);
    this.lightningLines.layers.enable(this.BLOOM_LAYER);
    this.lightningLines.visible = false;
    this.group.add(this.lightningLines);
    this.lightningFrameCount = 0;
  }

  updateLightning() {
    if (!this.lightningLines.visible) return;
    this.lightningFrameCount++;
    if (this.lightningFrameCount % 2 !== 0) return; // Update every 2 frames

    const positions = this.lightningLines.geometry.attributes.position.array;
    let idx = 0;

    const knucklePoints = [
      new THREE.Vector3(0.035, 0.08, 0.01),
      new THREE.Vector3(0.012, 0.09, 0.01),
      new THREE.Vector3(-0.012, 0.085, 0.01),
      new THREE.Vector3(-0.035, 0.075, 0.01)
    ];

    for (let i = 0; i < knucklePoints.length - 1; i++) {
      const start = knucklePoints[i];
      const end = knucklePoints[i + 1];
      const segments = 6;

      let prev = start.clone();
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const curr = new THREE.Vector3().lerpVectors(start, end, t);
        if (j < segments) {
          curr.add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
          ));
        }

        positions[idx++] = prev.x;
        positions[idx++] = prev.y;
        positions[idx++] = prev.z;

        positions[idx++] = curr.x;
        positions[idx++] = curr.y;
        positions[idx++] = curr.z;

        prev.copy(curr);
      }
    }

    this.lightningLines.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * 3D Holographic Target Reticle (1 Meter Ahead - Index Point)
   */
  buildHolographicReticle() {
    this.reticleGroup = new THREE.Group();

    const ring1Mat = new THREE.LineBasicMaterial({ color: 0x00f0ff });
    const ring1Geo = new THREE.RingGeometry(0.12, 0.125, 32);
    this.ring1 = new THREE.LineLoop(ring1Geo, ring1Mat);

    const ring2Mat = new THREE.LineBasicMaterial({ color: 0xffb700 });
    const ring2Geo = new THREE.RingGeometry(0.08, 0.083, 16);
    this.ring2 = new THREE.LineLoop(ring2Geo, ring2Mat);

    this.reticleGroup.add(this.ring1);
    this.reticleGroup.add(this.ring2);
    this.reticleGroup.layers.enable(this.BLOOM_LAYER);
    this.reticleGroup.visible = false;
    this.scene.add(this.reticleGroup);
  }

  updateReticle(dt) {
    if (this.reticleGroup.visible) {
      this.ring1.rotation.z += dt * 2.0;
      this.ring2.rotation.z -= dt * 3.5;
    }
  }

  /**
   * Kinematic Spring Physics Update Loop
   */
  updatePhysics(dt, targetPos, targetRot, handFound) {
    if (!handFound) {
      this.group.visible = false;
      return;
    }

    this.group.visible = true;

    // Second-order Spring-Damper kinematic integration
    // F = -k * (x - target) - c * v
    const forceX = -this.stiffness * (this.currentPos.x - targetPos.x) - this.damping * this.velocity.x;
    const forceY = -this.stiffness * (this.currentPos.y - targetPos.y) - this.damping * this.velocity.y;
    const forceZ = -this.stiffness * (this.currentPos.z - targetPos.z) - this.damping * this.velocity.z;

    this.velocity.x += forceX * dt;
    this.velocity.y += forceY * dt;
    this.velocity.z += forceZ * dt;

    this.currentPos.addScaledVector(this.velocity, dt);
    this.group.position.copy(this.currentPos);

    // Smooth Slerp Quaternion Orientation
    this.currentRot.slerp(targetRot, Math.min(1.0, dt * 25.0));
    this.group.quaternion.copy(this.currentRot);

    // Update uniform timers
    this.shieldMat.uniforms.uTime.value += dt;
    this.plasmaMat.uniforms.uTime.value += dt;

    this.updateParticles(dt);
    this.updateLightning();
    this.updateReticle(dt);
  }
}
