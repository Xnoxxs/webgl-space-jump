/**
 * Experience.js — Central orchestrator (singleton)
 *
 * Owns the scene, clock, and warp state.
 * Instantiates and coordinates all sub-modules.
 * Runs the animation loop via requestAnimationFrame.
 */

import * as THREE from 'three'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World.js'
import PostProcessing from './PostProcessing.js'

let instance = null

export default class Experience {
  
  constructor(canvas) {
    // Enforce singleton — safe to call new Experience() multiple times
    if (instance) return instance
    instance = this

    this.canvas = canvas
    // Create 3D scene
    this.scene = new THREE.Scene() 
    // Move per second, rather than per frame
    this.timer = new THREE.Timer()

    // Warp state: 0.0 = idle deep space, 1.0 = full hyperspace
    this.warpIntensity = 0
    this.isWarping = false

    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    // Use smooth to make mouse move slower creating a more cinematic effect
    this.mouse = { x: 0, y: 0, smoothX: 0, smoothY: 0 }

    this._initModules()
    this._bindEvents()
    this._tick()
  }

  // ── Module Initialization ─────────────────────────────────

  _initModules() {
    this.camera = new Camera(this)
    this.renderer = new Renderer(this)
    this.world = new World(this)
    this.postProcessing = new PostProcessing(this)
  }

  // ── Event Binding ─────────────────────────────────────────

  _bindEvents() {
    // The browser may get resized: window resized / phone rotated / fullscreen changed / split-screen changed
    // Therefore, if that happens, activate _onResize() to make all the elements in the scene use the new browser dimensions
    window.addEventListener('resize', () => this._onResize())

    // This listens for key presses
    // If you press Space, then activate the warp
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        this._activateWarp()
      }
    })
    // When you stop pressing 'Space' key, de-activate the warp
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this._deactivateWarp()
    })

    // Same behaviour on mouse activates and de-activates the warp
    this.canvas.addEventListener('mousedown', () => this._activateWarp())
    this.canvas.addEventListener('mouseup', () => this._deactivateWarp())
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this._activateWarp() }, { passive: false })
    this.canvas.addEventListener('touchend', () => this._deactivateWarp())

    // When mouse moves, normalize the coordinates to make it moe properly nomatter what the screen is
    window.addEventListener('mousemove', (e) => {
      this.mouse.x =  (e.clientX / this.sizes.width  - 0.5) * 2
      this.mouse.y = -(e.clientY / this.sizes.height - 0.5) * 2
    })
  }

  // ── Warp Control ──────────────────────────────────────────

  _activateWarp() {
    if (this.isWarping) return
    this.isWarping = true
    this._updateHUD('engaging')
  }

  _deactivateWarp() {
    if (!this.isWarping) return
    this.isWarping = false
    this._updateHUD('dropping')
  }

  _updateHUD(state) {
    /*
      This function controls the text shown on screen during warp.
      WARP DRIVE ENGAGED
      HYPERSPACE JUMP IN PROGRESS
      DROPPING OUT OF WARP...
    */
    const prompt = document.getElementById('prompt')
    const status = document.getElementById('status')

    if (state === 'engaging') {
      if (prompt) prompt.classList.add('hidden')
      if (status) {
        status.textContent = 'WARP DRIVE ENGAGED'
        clearTimeout(this._hudTimer)
        this._hudTimer = setTimeout(() => {
          if (status && this.isWarping) status.textContent = 'HYPERSPACE JUMP IN PROGRESS'
        }, 1200)
      }
    } else {
      if (status) {
        status.textContent = 'HYPERSPACE JUMP IN PROGRESS...'
        clearTimeout(this._hudTimer)
        this._hudTimer = setTimeout(() => {
          if (status) status.textContent = ''
          if (prompt) prompt.classList.remove('hidden')
        }, 2200)
      }
    }
  }

  // ── Resize ────────────────────────────────────────────────

  _onResize() {
    this.sizes.width = window.innerWidth
    this.sizes.height = window.innerHeight
    this.camera.resize()
    this.renderer.resize()
    this.postProcessing.resize()
  }

  // ── Animation Loop ────────────────────────────────────────

  _tick(timestamp) {


    this.timer.update(timestamp)
    const delta   = Math.min(this.timer.getDelta(), 0.05)
    const elapsed = this.timer.getElapsed()

    const target = this.isWarping ? 1 : 0
    const speed  = this.isWarping ? 1.8 : 1.0
    this.warpIntensity += (target - this.warpIntensity) * Math.min(delta * speed, 1)

    const mouseLerp = Math.min(delta * 1.0, 1)
    this.mouse.smoothX += (this.mouse.x - this.mouse.smoothX) * mouseLerp
    this.mouse.smoothY += (this.mouse.y - this.mouse.smoothY) * mouseLerp

    this.world.update(delta, elapsed)
    this.camera.update(delta, elapsed)
    this.postProcessing.update(delta, elapsed)

    this.postProcessing.render()

    window.requestAnimationFrame((ts) => this._tick(ts))
  }
}
