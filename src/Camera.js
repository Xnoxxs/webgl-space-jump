/**
 * Camera.js — Cinematic follow camera
 *
 * Three layers working together:
 *   1. Smooth base follow — camera pulls back and lifts during warp
 *   2. Ship drift follow  — camera lazily mirrors the ship's X drift
 *   3. Two-layer shake    — micro-vibration (engine hum) + low-freq turbulence
 *
 * The look-at target shifts subtly with the mouse so the viewport
 * feels alive even when the ship is stationary.
 */

import * as THREE from 'three'

export default class Camera {
  constructor(experience) {
    this.experience = experience
    this.scene      = experience.scene
    this.sizes      = experience.sizes

    // Base follow target — lerped toward desired position each frame
    this._basePos = new THREE.Vector3(0, 1.5, 14)

    // Low-frequency turbulence accumulator (smoothed random)
    this._turbX = 0
    this._turbY = 0

    // Camera X offset that trails the ship's side drift
    this._camDriftX = 0

    // Smoothed look-at offset driven by mouse
    this._lookX = 0
    this._lookY = 0.6

    this._setup()
  }

  _setup() {
    this.instance = new THREE.PerspectiveCamera(
      60,
      this.sizes.width / this.sizes.height,
      0.1,
      20000,
    )
    this.instance.position.copy(this._basePos)
    this.scene.add(this.instance)
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  update(delta, elapsed) {
    const warp  = this.experience.warpIntensity
    const mouse = this.experience.mouse
    const ship  = this.experience.world?.spaceship

    // ── 1. Base follow ──────────────────────────────────────────
    // Camera eases back and up as the ship accelerates into hyperspace.
    const targetZ = 14 + warp * 10
    const targetY = 1.5 + warp * 1.3

    this._basePos.z = lerp(this._basePos.z, targetZ, delta * 3.2)
    this._basePos.y = lerp(this._basePos.y, targetY, delta * 3.2)

    // ── 2. Ship drift follow ────────────────────────────────────
    // Camera mimics the ship's X position with extra lag so it
    // always feels like it's catching up — giving mass to the ship.
    const shipX = ship ? (ship._posX ?? 0) : 0
    this._camDriftX = lerp(this._camDriftX, shipX * 0.4, delta * 0.55)

    // ── 3. Two-layer shake ──────────────────────────────────────
    // Layer A — engine micro-vibration: tiny random offset, present any time
    //           engines are firing, gives "idle engine hum" feel.
    const vibAmp = warp * 0.012
    const vibX   = (Math.random() - 0.5) * vibAmp
    const vibY   = (Math.random() - 0.5) * vibAmp

    // Layer B — turbulence: larger amplitude, smoothed so it drifts rather
    //           than flickering — reads as the ship buffeting through the warp.
    const turbAmp  = warp * 0.048
    const turbLerp = Math.min(delta * 7, 1)
    this._turbX = lerp(this._turbX, (Math.random() - 0.5) * turbAmp, turbLerp)
    this._turbY = lerp(this._turbY, (Math.random() - 0.5) * turbAmp, turbLerp)

    // ── 4. FOV breathing ───────────────────────────────────────
    const targetFov = 60 + warp * 24
    this.instance.fov = lerp(this.instance.fov, targetFov, delta * 3)
    this.instance.updateProjectionMatrix()

    // ── 5. Final position ───────────────────────────────────────
    this.instance.position.set(
      this._basePos.x + this._camDriftX + vibX + this._turbX,
      this._basePos.y + vibY + this._turbY,
      this._basePos.z,
    )

    // ── 6. Look-at — follows mouse with cinematic inertia ───────
    // Subtle pan: the framing shifts just enough to feel responsive
    // without feeling like player-controlled camera.
    const targetLookX = mouse.smoothX * 1.2
    const targetLookY = 0.6 + mouse.smoothY * 0.5
    this._lookX = lerp(this._lookX, targetLookX, delta * 1.5)
    this._lookY = lerp(this._lookY, targetLookY, delta * 1.5)

    this.instance.lookAt(this._lookX, this._lookY, -150)
  }
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(t, 1)
}
