import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createProceduralHDRI } from './textures.js';
import { MarkVIIGauntlet } from './gauntlet.js';

/**
 * Main WebGL 2.0 Render Pipeline & EffectComposer Selective Bloom Manager
 */
export class RenderPipeline {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // 1. WebGL Renderer Initialization
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // Transparent black background
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 0);

    // 3. Scene & Lighting Setup
    this.scene = new THREE.Scene();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x111122, 1.2);
    this.scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xfff5e6, 2.0);
    mainLight.position.set(2, 4, 3);
    this.scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 1.8);
    rimLight.position.set(-3, -2, -2);
    this.scene.add(rimLight);

    // Procedural HDRI Environment Map
    this.envMap = createProceduralHDRI(this.renderer);
    this.scene.environment = this.envMap;

    // 4. Selective Bloom Post-Processing Pipeline Setup
    this.BLOOM_LAYER = 1;
    this.bloomLayer = new THREE.Layers();
    this.bloomLayer.set(this.BLOOM_LAYER);

    this.darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.materialsCache = {};

    this.setupPostProcessing();

    // 5. Gauntlet Assembly
    this.gauntlet = new MarkVIIGauntlet(this.scene);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  setupPostProcessing() {
    const renderScene = new RenderPass(this.scene, this.camera);

    // Advanced UnrealBloomPass (resolution: full screen, strength: 2.0, radius: 0.5, threshold: 0.2)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      2.0,  // strength
      0.5,  // radius
      0.2   // threshold
    );

    // Bloom Composer (renders bloom layer only)
    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(renderScene);
    this.bloomComposer.addPass(this.bloomPass);

    // Additive Bloom Composite Shader
    const mixPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: this.bloomComposer.renderTarget2.texture }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D baseTexture;
          uniform sampler2D bloomTexture;
          varying vec2 vUv;
          void main() {
            vec4 base = texture2D(baseTexture, vUv);
            vec4 bloom = texture2D(bloomTexture, vUv);
            gl_FragColor = base + bloom;
          }
        `
      }),
      'baseTexture'
    );
    mixPass.needsSwap = true;

    // Final Output Composer
    const outputPass = new OutputPass();
    this.finalComposer = new EffectComposer(this.renderer);
    this.finalComposer.addPass(renderScene);
    this.finalComposer.addPass(mixPass);
    this.finalComposer.addPass(outputPass);
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.bloomComposer.setSize(this.width, this.height);
    this.finalComposer.setSize(this.width, this.height);
  }

  /**
   * Selective Bloom Render Strategy:
   * 1. Darken non-bloomed materials (Layer 0)
   * 2. Render bloom pass into texture
   * 3. Restore original materials
   * 4. Composite bloom texture additively onto base scene
   */
  render() {
    // 1. Darken non-bloom elements
    this.scene.traverse((obj) => {
      if (obj.isMesh && !this.bloomLayer.test(obj.layers)) {
        this.materialsCache[obj.uuid] = obj.material;
        obj.material = this.darkMaterial;
      }
    });

    // 2. Render bloom composer to buffer
    this.bloomComposer.render();

    // 3. Restore original materials
    this.scene.traverse((obj) => {
      if (this.materialsCache[obj.uuid]) {
        obj.material = this.materialsCache[obj.uuid];
        delete this.materialsCache[obj.uuid];
      }
    });

    // 4. Render final composite scene
    this.finalComposer.render();
  }
}
