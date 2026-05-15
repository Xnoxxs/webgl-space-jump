/**
 * World.js — Scene environment setup
 *
 * Handles fog, lighting, nebula background planes,
 * and owns the three main world entities:
 * Spaceship, Starfield, WarpEffect.
 */

import * as THREE from 'three'
import Spaceship from './Spaceship.js'
import Starfield from './Starfield.js'
import WarpEffect from './WarpEffect.js'

export default class World {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this._setupBackground()
    this._setupFog()
    this._setupLights()
    this._setupNebula()

    // Spawn world entities
    this.spaceship = new Spaceship(experience)
    this.starfield = new Starfield(experience)
    this.warpEffect = new WarpEffect(experience)
  }

  // ── Environment Setup ─────────────────────────────────────

  _setupBackground() {
    // The dark background to create the feeling os being in space
    this.scene.background = new THREE.Color(0x000008)
  }

  _setupFog() {
    // Exponential fog — gives atmospheric depth
    // distant stars fade softly
    // far areas disappear smoothly
    // space doesn’t feel infinite
    this.scene.fog = new THREE.FogExp2(0x000510, 0.0005)
  }

  _setupLights() {

    // Base light so the whole scene is not completely dark
    const ambient = new THREE.AmbientLight(0x0a1030, 3)
    this.scene.add(ambient)

    // Main blue space light that lights the spaceship from above
    const starLight = new THREE.DirectionalLight(0x8899ff, 4)
    starLight.position.set(6, 12, -8)
    starLight.castShadow = true
    starLight.shadow.mapSize.set(1024, 1024)
    this.scene.add(starLight)

    // Purple light that matches the nebula background glow
    this._nebulaLight = new THREE.PointLight(0x7722cc, 3, 100)
    this._nebulaLight.position.set(-12, -10, -30)
    this.scene.add(this._nebulaLight)

    // Extra blue light on the side to give the ship more cinematic contrast
    this._accentLight = new THREE.PointLight(0x2255ff, 2, 80)
    this._accentLight.position.set(18, 6, 4)
    this.scene.add(this._accentLight)

    // Orange light behind the ship to create a glowing back edge
    const backLight = new THREE.PointLight(0xff9944, 1, 30)
    backLight.position.set(0, 4, 20)
    this.scene.add(backLight)
  }

  _setupNebula() {
    // Responsible for:  BIG glowing purple-blue cloud behing the ship
    
    // Create the texture
    const makeNebulaTexture = (r, g, b, alpha) => {
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`)
      grad.addColorStop(0.45, `rgba(${r * 0.4 | 0},${g * 0.4 | 0},${b * 0.4 | 0},${alpha * 0.3})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)
      return new THREE.CanvasTexture(canvas)
    }

    // Create the nebula material
    const nebulaMat = (texture) => new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })

    // define positions /sizes / colors of the nebula layers.
    const clouds = [
      { pos: [-40, 15, -280], rot: 0.4, scale: 260, color: [80, 20, 140, 0.5] }, // purple glow
      { pos: [60, -25, -360], rot: 1.8, scale: 300, color: [20, 50, 160, 0.4] }, // blue glow
      { pos: [-80, 40, -240], rot: 2.9, scale: 220, color: [60, 10, 100, 0.35] },
      { pos: [30, 20, -450], rot: 0.9, scale: 340, color: [10, 30, 120, 0.3] },
    ]

    // Loop through every nebula cloud configuration and apply it to scene
    clouds.forEach(({ pos, rot, scale, color }) => {
      const tex = makeNebulaTexture(...color)
      const geo = new THREE.PlaneGeometry(scale, scale)
      const mesh = new THREE.Mesh(geo, nebulaMat(tex))
      mesh.position.set(...pos)
      mesh.rotation.z = rot
      this.scene.add(mesh)
    })
  }

  // ── Update ────────────────────────────────────────────────

  update(delta, elapsed) {
    const warp = this.experience.warpIntensity

    // Amplify nebula lights as warp begins — gives the scene an energy surge feel
    this._nebulaLight.intensity = 3 + warp * 8
    this._accentLight.intensity = 2 + warp * 5

    this.spaceship.update(delta, elapsed)
    this.starfield.update(delta, elapsed)
    this.warpEffect.update(delta, elapsed)
  }
}
