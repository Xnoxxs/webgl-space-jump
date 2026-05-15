/**
 * Renderer.js — WebGL renderer configuration
 *
 * Sets up the WebGLRenderer with correct colour space, tone mapping,
 * and DPR handling. The actual draw call lives in PostProcessing.js
 * (the EffectComposer calls renderer.render internally).
 */

import * as THREE from 'three'

export default class Renderer {
  constructor(experience) {
    this.experience = experience
    this.canvas = experience.canvas
    this.scene = experience.scene
    this.camera = experience.camera
    this.sizes = experience.sizes

    this._setup()
  }

  _setup() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    })

    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // SRGB output — correct perceptual colour
    this.instance.outputColorSpace = THREE.SRGBColorSpace

    // ACESFilmic tone mapping — cinematic, film-like contrast
    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = 1.1

    // Shadow map for ship self-shadowing
    this.instance.shadowMap.enabled = true
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }
}
