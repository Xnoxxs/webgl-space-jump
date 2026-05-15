/**
 * Starfield.js — Deep space star field + warp streak system
 *
 * Two co-located particle systems share the same 3D positions:
 *   1. Points  → circular star dots, fade out as warp begins
 *   2. LineSegments → warp streaks, each line stretches from the star
 *      position toward the camera along +Z to simulate hyperspace speed.
 *
 * The "aEnd" per-vertex attribute marks which end of each line segment
 * receives the Z-offset: 0 = tail (stays at star), 1 = head (stretches).
 */

import * as THREE from 'three'

// ── Star dot vertex shader ────────────────────────────────────────────────────
const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;

  uniform float uWarpIntensity;

  varying float vBrightness;

  void main() {
    vBrightness = aBrightness;

    // Stars shrink as streaks take over
    float sizeScale = 1.0 - uWarpIntensity * 0.75;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * sizeScale * (280.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`
const STAR_FRAG = /* glsl */ `
  uniform float uWarpIntensity;

  varying float vBrightness;

  void main() {
    // Circular soft dot using point coord
    float d = length(gl_PointCoord - 0.5);
    float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * vBrightness;
    alpha *= 1.0 - uWarpIntensity * 0.8;

    // Slight warm/cool tint variation per star brightness
    vec3 color = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.96, 0.82), 1.0 - vBrightness);
    gl_FragColor = vec4(color, alpha);
  }
`

// ── Warp streak vertex shader ─────────────────────────────────────────────────
const STREAK_VERT = /* glsl */ `
  attribute float aEnd;         // 0 = tail (stays at star), 1 = head (stretches toward camera)
  attribute float aBrightness;

  uniform float uWarpIntensity;

  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Extend head vertex along +Z (toward camera) — length grows with warp intensity
    float streakLen = uWarpIntensity * 140.0;
    pos.z += aEnd * streakLen;

    // Tail is bright, head fades to transparent → natural light-trail look
    vAlpha = (1.0 - aEnd) * uWarpIntensity * aBrightness;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`
const STREAK_FRAG = /* glsl */ `
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(0.72, 0.88, 1.0, vAlpha);
  }
`

// ── Starfield Class ───────────────────────────────────────────────────────────

export default class Starfield {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this.STAR_COUNT = 6000
    this.RADIUS = 1800

    this._buildStarDots()
    this._buildWarpStreaks()
  }

  // ── Star Dots (Points) ────────────────────────────────────

  _buildStarDots() {
    const N = this.STAR_COUNT
    const positions   = new Float32Array(N * 3)
    const sizes       = new Float32Array(N)
    const brightnesses = new Float32Array(N)

    for (let i = 0; i < N; i++) {
      // Spherical distribution so stars wrap all around the scene
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 80 + Math.random() * this.RADIUS

      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Random size distribution: most are tiny, a few are large
      sizes[i]        = Math.pow(Math.random(), 2) * 3.0 + 0.4
      brightnesses[i] = 0.25 + Math.random() * 0.75
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize',       new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(brightnesses, 1))

    this._starMat = new THREE.ShaderMaterial({
      vertexShader:   STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uWarpIntensity: { value: 0 },
      },
      transparent: true,
      depthWrite:  false,
    })

    this.stars = new THREE.Points(geo, this._starMat)
    this.scene.add(this.stars)

    // Store positions for streak reuse
    this._starPositions   = positions
    this._starBrightnesses = brightnesses
  }

  // ── Warp Streaks (LineSegments) ───────────────────────────

  _buildWarpStreaks() {
    const N = this.STAR_COUNT

    // 2 vertices per line → arrays are 2× star count
    const positions   = new Float32Array(N * 6)
    const aEnd        = new Float32Array(N * 2)
    const aBrightness = new Float32Array(N * 2)

    for (let i = 0; i < N; i++) {
      const x = this._starPositions[i * 3 + 0]
      const y = this._starPositions[i * 3 + 1]
      const z = this._starPositions[i * 3 + 2]
      const b = this._starBrightnesses[i]

      // Tail vertex — stays at star position, full alpha
      positions[i * 6 + 0] = x
      positions[i * 6 + 1] = y
      positions[i * 6 + 2] = z
      aEnd[i * 2 + 0]        = 0
      aBrightness[i * 2 + 0] = b

      // Head vertex — same position, shader stretches it along +Z
      positions[i * 6 + 3] = x
      positions[i * 6 + 4] = y
      positions[i * 6 + 5] = z
      aEnd[i * 2 + 1]        = 1
      aBrightness[i * 2 + 1] = b
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aEnd',        new THREE.BufferAttribute(aEnd, 1))
    geo.setAttribute('aBrightness', new THREE.BufferAttribute(aBrightness, 1))

    this._streakMat = new THREE.ShaderMaterial({
      vertexShader:   STREAK_VERT,
      fragmentShader: STREAK_FRAG,
      uniforms: {
        uWarpIntensity: { value: 0 },
      },
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    })

    this.streaks = new THREE.LineSegments(geo, this._streakMat)
    this.scene.add(this.streaks)
  }

  // ── Update Loop ───────────────────────────────────────────

  update(delta, elapsed) {
    const warp = this.experience.warpIntensity

    this._starMat.uniforms.uWarpIntensity.value   = warp
    this._streakMat.uniforms.uWarpIntensity.value = warp

    // Slow counter-rotation gives the sense that the star field has true 3-D depth
    this.stars.rotation.y   = elapsed * 0.004
    this.streaks.rotation.y = elapsed * 0.004
  }
}
