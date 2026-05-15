/**
 * PostProcessing.js — Cinematic post-process stack
 *
 * Layers (in order):
 *   1. RenderPass          — renders the 3-D scene
 *   2. UnrealBloomPass     — HDR bloom (intensifies with warp)
 *   3. ChromaticAberration — radial RGB split (intensifies with warp)
 *   4. Vignette            — edge darkening + blue edge tint during warp
 *   5. OutputPass          — tone-mapping & SRGB encode to canvas
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js'

// ── Chromatic Aberration Shader ───────────────────────────────────────────────

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAmount:  { value: 0.001 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float     uAmount;
    varying vec2      vUv;

    void main() {
      // Offset grows from centre outward — classic lens fringing
      vec2 offset = (vUv - 0.5) * uAmount * 3.0;

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv        ).g;
      float b = texture2D(tDiffuse, vUv - offset).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
}

// ── Vignette Shader ───────────────────────────────────────────────────────────

const VignetteShader = {
  uniforms: {
    tDiffuse:  { value: null },
    uStrength: { value: 0.45 },
    uWarp:     { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float     uStrength;
    uniform float     uWarp;
    varying vec2      vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Vignette — darkens toward edges; deepens during warp
      vec2  c        = vUv - 0.5;
      float vignette = 1.0 - dot(c, c) * (uStrength + uWarp * 0.9) * 3.2;
      vignette = clamp(vignette, 0.0, 1.0);

      // Edge tint — subtle blue atmospheric fringe during warp
      vec3 edgeTint = vec3(0.04, 0.10, 0.28) * (1.0 - vignette) * uWarp;

      color.rgb = color.rgb * vignette + edgeTint;
      gl_FragColor = color;
    }
  `,
}

// ── PostProcessing Class ──────────────────────────────────────────────────────

export default class PostProcessing {
  constructor(experience) {
    this.experience = experience
    this.renderer   = experience.renderer.instance
    this.scene      = experience.scene
    this.camera     = experience.camera.instance
    this.sizes      = experience.sizes

    this._setup()
  }

  _setup() {
    const { width, height } = this.sizes

    this.composer = new EffectComposer(this.renderer)
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.composer.setSize(width, height)

    // 1 — Render the 3-D scene
    this.composer.addPass(new RenderPass(this.scene, this.camera))

    // 2 — Bloom: selective HDR glow on bright geometry
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.55,   // strength  — baseline; ramps to ~3 during warp
      0.50,   // radius    — softness of bloom halo
      0.22,   // threshold — only pixels brighter than this bloom
    )
    this.composer.addPass(this._bloomPass)

    // 3 — Chromatic aberration
    this._chromaPass = new ShaderPass(ChromaticAberrationShader)
    this.composer.addPass(this._chromaPass)

    // 4 — Vignette
    this._vignettePass = new ShaderPass(VignetteShader)
    this.composer.addPass(this._vignettePass)

    // 5 — Output: applies tone mapping + encodes to SRGB for display
    this.composer.addPass(new OutputPass())
  }

  resize() {
    const { width, height } = this.sizes
    this.composer.setSize(width, height)
    this._bloomPass.setSize(width, height)
  }

  update(delta, elapsed) {
    const warp = this.experience.warpIntensity

    // Bloom explodes during warp — the primary visual "payoff"
    this._bloomPass.strength  = 0.55 + warp * 2.8
    this._bloomPass.threshold = Math.max(0.0, 0.22 - warp * 0.22)
    this._bloomPass.radius    = 0.45 + warp * 0.45

    // Chromatic aberration creeps in as speed increases
    this._chromaPass.uniforms.uAmount.value = 0.001 + warp * 0.007

    // Vignette and edge tint
    this._vignettePass.uniforms.uWarp.value = warp
  }

  render() {
    this.composer.render()
  }
}
