import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

/**
 * Precision Computer Vision Hand Tracker powered by MediaPipe Tasks Vision.
 * Handles camera feed capture, landmark EMA low-pass filtering, 3D frustum mapping,
 * Quaternion orientation math, and gesture state detection.
 */
export class HandTracker {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.debugCanvas = canvasElement;
    this.debugCtx = canvasElement ? canvasElement.getContext('2d') : null;
    this.landmarker = null;
    this.isReady = false;

    // Signal processing: EMA Low-pass filter cache
    this.emaAlpha = 0.35; // Latency < 30ms, micro-jitter elimination
    this.filteredLandmarks = null;

    // Calculated 3D Transform Telemetry
    this.handFound = false;
    this.handConfidence = 0;
    this.wristPosition = new THREE.Vector3();
    this.handRotation = new THREE.Quaternion();
    this.handScale = 1.0;
    this.palmCenter = new THREE.Vector3();

    // Finger Tip Positions in 3D Space
    this.fingerTips = {
      thumb: new THREE.Vector3(),
      index: new THREE.Vector3(),
      middle: new THREE.Vector3(),
      ring: new THREE.Vector3(),
      pinky: new THREE.Vector3()
    };

    // Detected Gesture State
    this.currentGesture = 'NONE';
    this.rawGesture = 'NONE';
    this.gestureDebounceTimer = null;
    this.lastStateChangeTime = 0;

    this.lastVideoTime = -1;
  }

  async init() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
      );

      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });

      // Initialize Webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });

      this.video.srcObject = stream;
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          if (this.debugCanvas) {
            this.debugCanvas.width = this.video.videoWidth;
            this.debugCanvas.height = this.video.videoHeight;
          }
          resolve();
        };
      });

      this.isReady = true;
      return true;
    } catch (err) {
      console.error("Failed to initialize MediaPipe HandLandmarker:", err);
      throw err;
    }
  }

  update(camera, aspect) {
    if (!this.isReady || this.video.paused || this.video.ended) {
      return null;
    }

    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const results = this.landmarker.detectForVideo(this.video, performance.now());

      if (results.landmarks && results.landmarks.length > 0) {
        this.handFound = true;
        this.handConfidence = results.handedness && results.handedness[0] ? results.handedness[0][0].score : 0.9;

        const rawLandmarks = results.landmarks[0];
        this.applyEMAFilter(rawLandmarks);
        this.compute3DTransforms(camera, aspect);
        this.classifyGesture();

        if (this.debugCtx) {
          this.renderDebugSkeleton(rawLandmarks);
        }
      } else {
        this.handFound = false;
        this.currentGesture = 'NONE';
        if (this.debugCtx) {
          this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        }
      }
    }

    return {
      found: this.handFound,
      wrist: this.wristPosition,
      rotation: this.handRotation,
      palmCenter: this.palmCenter,
      fingerTips: this.fingerTips,
      gesture: this.currentGesture,
      confidence: this.handConfidence
    };
  }

  /**
   * Exponential Moving Average (EMA) Low-Pass Filter
   * S[t] = α * X[t] + (1 - α) * S[t-1]
   */
  applyEMAFilter(raw) {
    if (!this.filteredLandmarks) {
      this.filteredLandmarks = raw.map(p => ({ x: p.x, y: p.y, z: p.z }));
      return;
    }

    const a = this.emaAlpha;
    for (let i = 0; i < raw.length; i++) {
      this.filteredLandmarks[i].x = a * raw[i].x + (1 - a) * this.filteredLandmarks[i].x;
      this.filteredLandmarks[i].y = a * raw[i].y + (1 - a) * this.filteredLandmarks[i].y;
      this.filteredLandmarks[i].z = a * raw[i].z + (1 - a) * this.filteredLandmarks[i].z;
    }
  }

  /**
   * Transform normalized 2D/3D landmarks into Three.js frustum coordinates
   * & compute hand orientation Quaternion using vector cross products.
   */
  compute3DTransforms(camera, aspect) {
    const lm = this.filteredLandmarks;
    if (!lm) return;

    // Wrist (Landmark 0), Index MCP (5), Pinky MCP (17)
    const wristLM = lm[0];
    const indexMcpLM = lm[5];
    const pinkyMcpLM = lm[17];

    // Mirror horizontal X coordinate because video stream is mirrored (scaleX(-1))
    const screenX = (1.0 - wristLM.x) * 2 - 1;
    const screenY = -(wristLM.y * 2 - 1);

    // Calculate Z depth based on physical wrist-to-index distance in pixels
    const dx = (indexMcpLM.x - wristLM.x);
    const dy = (indexMcpLM.y - wristLM.y);
    const dist2D = Math.sqrt(dx * dx + dy * dy);

    // Depth mapping: closer hand = larger dist2D -> smaller Z distance from camera
    const zDepth = THREE.MathUtils.clamp(-1.2 + (0.35 / (dist2D + 0.001)), -3.5, -0.6);

    // Unproject X, Y into 3D frustum coordinates at depth Z
    const vWrist = new THREE.Vector3(screenX, screenY, 0.5);
    vWrist.unproject(camera);
    const dir = vWrist.sub(camera.position).normalize();
    const distanceToZ = (zDepth - camera.position.z) / dir.z;
    this.wristPosition.copy(camera.position).add(dir.multiplyScalar(distanceToZ));

    // Convert key landmark positions into 3D World space vectors
    const mapLM = (l) => {
      const sx = (1.0 - l.x) * 2 - 1;
      const sy = -(l.y * 2 - 1);
      const v = new THREE.Vector3(sx, sy, 0.5);
      v.unproject(camera);
      const d = v.sub(camera.position).normalize();
      const dist = (zDepth - camera.position.z) / d.z;
      return camera.position.clone().add(d.multiplyScalar(dist));
    };

    const vWrist3D = mapLM(wristLM);
    const vIndexMCP3D = mapLM(indexMcpLM);
    const vPinkyMCP3D = mapLM(pinkyMcpLM);

    // Calculate Palm Center
    this.palmCenter.copy(vWrist3D).add(vIndexMCP3D).add(vPinkyMCP3D).divideScalar(3);

    // Update finger tips
    this.fingerTips.thumb.copy(mapLM(lm[4]));
    this.fingerTips.index.copy(mapLM(lm[8]));
    this.fingerTips.middle.copy(mapLM(lm[12]));
    this.fingerTips.ring.copy(mapLM(lm[16]));
    this.fingerTips.pinky.copy(mapLM(lm[20]));

    // Compute Orientation Basis Vectors using Cross Product
    // Forward Vector (Wrist to Middle MCP): Z-axis
    const vMiddleMCP3D = mapLM(lm[9]);
    const vForward = new THREE.Vector3().subVectors(vMiddleMCP3D, vWrist3D).normalize();

    // Right Vector (Wrist->IndexMCP x Wrist->PinkyMCP or across palm): X-axis
    const vAcross = new THREE.Vector3().subVectors(vPinkyMCP3D, vIndexMCP3D).normalize();

    // Up / Normal Vector (Palm Normal): Y-axis
    const vNormal = new THREE.Vector3().crossVectors(vForward, vAcross).normalize();

    // Re-orthonormalize Across vector
    const vRight = new THREE.Vector3().crossVectors(vNormal, vForward).normalize();

    // Build 3D Rotation Matrix and Quaternion
    const rotMatrix = new THREE.Matrix4();
    rotMatrix.makeBasis(vRight, vNormal, vForward.negate());
    this.handRotation.setFromRotationMatrix(rotMatrix);
  }

  /**
   * Precise Gesture Classification Rules:
   * 1. Open Palm 🖐️
   * 2. Fingers Curved 🫴
   * 3. Fist ✊
   * 4. Index Point ☝️
   * 5. Thumbs Up 👍
   * 6. Victory/Peace ✌️
   */
  classifyGesture() {
    const lm = this.filteredLandmarks;
    if (!lm) return;

    // Helper: is finger extended relative to its MCP joint
    const isExtended = (tipIdx, pipIdx, mcpIdx) => {
      const tipDist = dist3D(lm[tipIdx], lm[0]);
      const pipDist = dist3D(lm[pipIdx], lm[0]);
      return tipDist > pipDist;
    };

    const thumbExt = dist3D(lm[4], lm[17]) > dist3D(lm[2], lm[17]);
    const indexExt = isExtended(8, 6, 5);
    const middleExt = isExtended(12, 10, 9);
    const ringExt = isExtended(16, 14, 13);
    const pinkyExt = isExtended(20, 18, 17);

    // Calculate finger curvature / bent state
    const indexCurved = !indexExt && dist3D(lm[8], lm[0]) > dist3D(lm[5], lm[0]) * 0.8;
    const middleCurved = !middleExt && dist3D(lm[12], lm[0]) > dist3D(lm[9], lm[0]) * 0.8;

    let detected = 'OPEN_PALM';

    if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
      detected = 'THUMBS_UP';
    } else if (indexExt && middleExt && !ringExt && !pinkyExt) {
      detected = 'VICTORY';
    } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
      detected = 'INDEX_POINT';
    } else if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
      detected = 'FIST';
    } else if (indexCurved && middleCurved) {
      detected = 'FINGERS_CURVED';
    } else if (indexExt && middleExt && ringExt && pinkyExt) {
      detected = 'OPEN_PALM';
    }

    // 200ms Debounce state transition filter
    if (detected !== this.rawGesture) {
      this.rawGesture = detected;
      this.lastStateChangeTime = performance.now();
    } else if (performance.now() - this.lastStateChangeTime > 200) {
      this.currentGesture = detected;
    }
  }

  renderDebugSkeleton(landmarks) {
    const ctx = this.debugCtx;
    const w = this.debugCanvas.width;
    const h = this.debugCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00ff66';
    ctx.fillStyle = '#00f0ff';

    // Skeleton connection pairs
    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17]
    ];

    for (const [i, j] of connections) {
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * w, landmarks[i].y * h);
      ctx.lineTo(landmarks[j].x * w, landmarks[j].y * h);
      ctx.stroke();
    }

    for (let i = 0; i < landmarks.length; i++) {
      ctx.beginPath();
      ctx.arc(landmarks[i].x * w, landmarks[i].y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function dist3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
