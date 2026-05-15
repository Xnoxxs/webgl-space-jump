/**
 * WarpEffect.js — Hyperspace tunnel + speed burst particles
 *
 * Two layered effects that activate during warp:
 *
 *   1. Warp Tunnel — a large open-ended cylinder viewed from inside.
 *      A custom fragment shader draws animated energy rings and
 *      glowing lines rushing toward the vanishing point.
 *
 *   2. Speed Burst — screen-plane particles that radiate outward from
 *      the ship center, reinforcing the feeling of extreme acceleration.
 */

import * as THREE from 'three'

// ── Warp Tunnel Shaders ───────────────────────────────────────────────────────

const TUNNEL_VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const TUNNEL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;

  varying vec2 vUv;

  // Fast 2-D hash used for slight noise variation
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  void main() {
    if (uIntensity < 0.01) discard;

    // vUv.x = normalised angle around the cylinder (0..1)
    // vUv.y = position along the cylinder length (0=back, 1=front)

    float speed = uTime * 6.0;

    // ─ Primary rushing rings ─
    float ringFreq = 22.0;
    float ring = fract(vUv.y * ringFreq + speed);
    ring = smoothstep(0.0, 0.03, ring) - smoothstep(0.09, 0.14, ring);

    // ─ Secondary thinner rings ─
    float ring2 = fract(vUv.y * ringFreq * 2.5 + speed * 1.6);
    ring2 = (smoothstep(0.0, 0.02, ring2) - smoothstep(0.04, 0.07, ring2)) * 0.35;

    // ─ Longitudinal energy lines along the tunnel wall ─
    float lineCount = 12.0;
    float line = sin(vUv.x * lineCount * 3.14159 * 2.0) * 0.5 + 0.5;
    line = pow(line, 8.0) * 0.4;

    // ─ Flicker noise on rings ─
    float noise = hash21(vec2(vUv.x * 8.0, floor(vUv.y * ringFreq + speed))) * 0.25 + 0.75;

    // ─ Colour palette — shifts from electric blue to violet ─
    vec3 blue   = vec3(0.10, 0.40, 1.00);
    vec3 violet = vec3(0.65, 0.10, 1.00);
    vec3 white  = vec3(0.90, 0.96, 1.00);

    float colorT = sin(vUv.y * 4.0 + uTime * 0.6) * 0.5 + 0.5;
    vec3 color   = mix(blue, violet, colorT);
    // Hot-white peaks on the ring crest
    color = mix(color, white, (ring + ring2) * 0.45);

    float glow = (ring + ring2 + line) * noise;

    // Fade smoothly at both ends so the tunnel doesn't hard-clip
    float depthFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);

    float alpha = clamp(glow * uIntensity * depthFade, 0.0, 1.0);
    gl_FragColor = vec4(color * (glow * 1.8 + 0.2), alpha);
  }
`

// ── Speed Burst Shaders (radial screen-plane particles) ───────────────────────

const BURST_VERT = /* glsl */ `
  attribute float aAngle;   // angle in radians around the centre
  attribute float aRadius;  // maximum expansion radius in world units
  attribute float aSpeed;   // normalised speed 0..1

  uniform float uTime;
  uniform float uIntensity;

  varying float vAlpha;

  void main() {
    // Each particle cycles 0→1, bursting outward from centre
    float t = fract(uTime * (aSpeed * 0.4 + 0.2) + aAngle * 0.05);

    float r  = mix(0.05, aRadius, t);
    float px = cos(aAngle) * r;
    float py = sin(aAngle) * r;

    // Fade in fast, fade out slow → bright burst with trailing fade
    vAlpha = (1.0 - t) * (1.0 - t) * uIntensity;

    // Shrink point as it flies outward
    gl_PointSize = mix(4.0, 0.5, t);
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(px, py, position.z, 1.0);
  }
`

const BURST_FRAG = /* glsl */ `
  varying float vAlpha;

  void main() {
    float d     = length(gl_PointCoord - 0.5);
    float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * vAlpha;
    gl_FragColor = vec4(0.65, 0.85, 1.0, alpha);
  }
`

// ── WarpEffect Class ──────────────────────────────────────────────────────────

export default class WarpEffect {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this._buildTunnel()
    this._buildBurst()
  }

  // ── Warp Tunnel ───────────────────────────────────────────

  _buildTunnel() {
    // Open-ended cylinder — large enough to surround the whole scene.
    // BackSide rendering makes it visible from the inside.
    // The geometry is rotated so its long axis aligns with Z (the flight path).
    const geo = new THREE.CylinderGeometry(20, 20, 500, 36, 48, true)
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2))

    this._tunnelMat = new THREE.ShaderMaterial({
      vertexShader:   TUNNEL_VERT,
      fragmentShader: TUNNEL_FRAG,
      uniforms: {
        uTime:      { value: 0 },
        uIntensity: { value: 0 },
      },
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      side:        THREE.BackSide,
    })

    const tunnel = new THREE.Mesh(geo, this._tunnelMat)
    // Centred in the camera's forward corridor
    tunnel.position.set(0, 0, -240)
    this.scene.add(tunnel)
  }

  // ── Speed Burst Particles ─────────────────────────────────

  _buildBurst() {
    const COUNT = 350

    const positions = new Float32Array(COUNT * 3) // z-plane position
    const aAngle    = new Float32Array(COUNT)
    const aRadius   = new Float32Array(COUNT)
    const aSpeed    = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      // Particles live on a plane slightly in front of the ship
      positions[i * 3 + 2] = 0

      aAngle[i]  = Math.random() * Math.PI * 2
      aRadius[i] = 2.5 + Math.random() * 14
      aSpeed[i]  = Math.random()
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aAngle',   new THREE.BufferAttribute(aAngle, 1))
    geo.setAttribute('aRadius',  new THREE.BufferAttribute(aRadius, 1))
    geo.setAttribute('aSpeed',   new THREE.BufferAttribute(aSpeed, 1))

    this._burstMat = new THREE.ShaderMaterial({
      vertexShader:   BURST_VERT,
      fragmentShader: BURST_FRAG,
      uniforms: {
        uTime:      { value: 0 },
        uIntensity: { value: 0 },
      },
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    })

    const burst = new THREE.Points(geo, this._burstMat)
    // Float it just in front of the ship so it overlaps the camera field-of-view
    burst.position.set(0, 0, -3)
    this.scene.add(burst)
  }

  // ── Update Loop ───────────────────────────────────────────

  update(delta, elapsed) {
    const warp = this.experience.warpIntensity

    this._tunnelMat.uniforms.uTime.value = elapsed
    this._tunnelMat.uniforms.uIntensity.value = warp

    this._burstMat.uniforms.uTime.value      = elapsed
    this._burstMat.uniforms.uIntensity.value = warp
  }
}
