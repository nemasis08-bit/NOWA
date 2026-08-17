import * as THREE from 'three';

/**
 * GLSL Shaders for Iron Man Gauntlet
 */

// Simplex noise GLSL helper for vertex displacement & plasma movement
const NOISE_GLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

/**
 * 1. Hexagonal Energy Shield Shader
 */
export function createHexShieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00f0ff) },
      uOpacity: { value: 0.85 }
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      ${NOISE_GLSL}

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);

        // Simplex noise rippling / vertex displacement across energy shield
        vec3 pos = position;
        float noise = snoise(vec3(pos.xy * 3.0, uTime * 1.5));
        pos += normal * noise * 0.06;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;

      // Procedural Hexagonal Grid Generator
      float hexGrid(vec2 st, float scale) {
        st *= scale;
        vec2 q = vec2(st.x * 2.0/3.0, (-st.x/3.0 + sqrt(3.0)/3.0 * st.y));
        vec2 p = floor(q);
        vec2 f = fract(q);
        float v = step(0.08, min(min(f.x, f.y), 1.0 - max(f.x, f.y)));
        return 1.0 - v;
      }

      void main() {
        // Hexagonal pattern
        float hex = hexGrid(vUv, 16.0);

        // Fresnel edge-glow
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.5);

        // Energy pulse wave
        float pulse = sin(vUv.y * 20.0 - uTime * 4.0) * 0.5 + 0.5;

        vec3 finalColor = mix(uColor, vec3(1.0), fresnel * 0.6);
        float alpha = (hex * 0.6 + fresnel * 0.8 + pulse * 0.2) * uOpacity;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });
}

/**
 * 2. Volumetric Repulsor Beam Shader (Raymarching Plasma Cylinder)
 */
export function createVolumetricPlasmaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00f0ff) },
      uCoreColor: { value: new THREE.Color(0xffffff) }
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;

      void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uCoreColor;
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;

      ${NOISE_GLSL}

      void main() {
        // Flowing plasma noise along beam axis (vUv.y)
        vec3 noiseCoord = vec3(vPosition.xz * 12.0, vUv.y * 8.0 - uTime * 6.0);
        float noise = snoise(noiseCoord) * 0.5 + 0.5;

        // Core glow concentration along center axis
        float centerDist = abs(vUv.x - 0.5) * 2.0;
        float coreGlow = pow(1.0 - centerDist, 3.0);

        // Beam attenuation along length
        float fade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.8, vUv.y);

        vec3 plasmaColor = mix(uColor, uCoreColor, coreGlow * noise);
        float alpha = (coreGlow + noise * 0.5) * fade * 0.9;

        gl_FragColor = vec4(plasmaColor, alpha);
      }
    `
  });
}
