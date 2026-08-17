import * as THREE from 'three';

/**
 * Generates dynamic normal maps using an off-screen HTML5 canvas to simulate metal panel lines, seams, and micro-scratches.
 */
export function createGauntletNormalMap(width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Neutral normal map color: RGB (128, 128, 255) -> Vector (0, 0, 1)
  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, width, height);

  // Panel seam lines
  ctx.strokeStyle = 'rgb(200, 128, 255)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  ctx.beginPath();
  ctx.moveTo(width * 0.5, 20);
  ctx.lineTo(width * 0.5, height - 20);
  ctx.moveTo(20, height * 0.5);
  ctx.lineTo(width - 20, height * 0.5);
  ctx.stroke();

  // Micro scratches & mechanical detail lines
  ctx.strokeStyle = 'rgb(160, 100, 255)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = x1 + (Math.random() - 0.5) * 60;
    const y2 = y1 + (Math.random() - 0.5) * 60;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Generates a procedural HDRI CubeTexture / Environment map with dark gradients and subtle neon rim lights.
 */
export function createProceduralHDRI(renderer) {
  const size = 256;
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileCubemapShader();

  const scene = new THREE.Scene();

  // Dynamic ambient sphere skybox geometry
  const sphereGeo = new THREE.SphereGeometry(100, 32, 32);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Dark studio gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#020b14');
  grad.addColorStop(0.5, '#01050a');
  grad.addColorStop(1, '#000204');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Neon Cyan and Gold rim lighting bands in environment
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(40, 40, 120, 30);
  ctx.fillStyle = '#ffb700';
  ctx.fillRect(320, 180, 140, 20);

  const envTex = new THREE.CanvasTexture(canvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;

  const envMat = new THREE.MeshBasicMaterial({
    map: envTex,
    side: THREE.BackSide
  });
  const envMesh = new THREE.Mesh(sphereGeo, envMat);
  scene.add(envMesh);

  // Generate CubeTexture environment map from PMREMGenerator
  const envMap = pmremGenerator.fromScene(scene).texture;
  pmremGenerator.dispose();
  envGeoDispose(sphereGeo, envMat, envTex);

  return envMap;
}

function envGeoDispose(geo, mat, tex) {
  geo.dispose();
  mat.dispose();
  tex.dispose();
}
