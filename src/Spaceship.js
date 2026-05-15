/**
 * Spaceship.js — Procedural sci-fi interceptor
 *
 * Builds the ship entirely from Three.js primitives — no external model needed.
 * Custom engine glow ShaderMaterial produces animated plasma exhaust.
 * Idle floating + warp tilt drive the feeling of a living machine.
 */

import * as THREE from 'three'

// ── Engine Glow Shader ────────────────────────────────────────────────────────

const ENGINE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`

const ENGINE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3  uColor;

  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vViewPosition;

  // Cheap hash for animated noise
  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  void main() {
    // Fresnel rim — brighter where surface grazes the view direction
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.5);

    // Plasma ring animation: radial waves along Y (disc face)
    float ring = sin(vUv.y * 14.0 - uTime * 10.0) * 0.5 + 0.5;
    ring *= sin(vUv.x * 3.14159 * 2.0 - uTime * 4.0) * 0.5 + 0.5;

    // Slow pulse for breathing feel
    float pulse = sin(uTime * 3.5) * 0.12 + 0.88;

    // Hot core in the centre of the disc
    float core = 1.0 - abs(vUv.x - 0.5) * 2.0;
    core = pow(core, 3.0);

    // Combine: fresnel + animated rings + hot core
    float glow = (fresnel * 0.6 + ring * 0.45 + core * 0.65) * pulse * uIntensity;

    vec3 finalColor = uColor * glow * 5.0;
    gl_FragColor = vec4(finalColor, clamp(glow, 0.0, 1.0));
  }
`

// ── Spaceship Class ───────────────────────────────────────────────────────────

export default class Spaceship {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene

    this._engineMaterials = []  // All ShaderMaterials that need uTime/uIntensity
    this._engineLights = []     // PointLights inside engine pods
    this._haloMeshes = []       // Soft glow spheres around engines

    this.group = new THREE.Group()
    this.scene.add(this.group)

    this._buildShip()
  }

  // ── Ship Assembly ─────────────────────────────────────────

  _buildShip() {
    // Shared standard materials
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x14182a,
      metalness: 0.88,
      roughness: 0.18,
    })
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d16,
      metalness: 0.95,
      roughness: 0.08,
    })
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x1c2840,
      metalness: 0.9,
      roughness: 0.12,
    })
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x3388cc,
      metalness: 0.05,
      roughness: 0.0,
      transparent: true,
      opacity: 0.75,
      emissive: new THREE.Color(0x1a4488),
      emissiveIntensity: 0.8,
    })

    this._buildFuselage(hullMat, darkMat, accentMat, glassMat)
    this._buildWing(1, hullMat, darkMat)    // right
    this._buildWing(-1, hullMat, darkMat)   // left (mirrored)
    this._buildEnginePod(0.52, darkMat, accentMat)
    this._buildEnginePod(-0.52, darkMat, accentMat)
    this._buildCentralEngine(darkMat)
  }

  // ── Fuselage ──────────────────────────────────────────────

  _buildFuselage(hullMat, darkMat, accentMat, glassMat) {
    // Main body slab
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.30, 3.9), hullMat)
    body.castShadow = true
    this.group.add(body)

    // Raised spine along the top
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.20, 3.4), accentMat)
    spine.position.set(0, 0.22, 0)
    this.group.add(spine)

    // Ventral keel — flat underside panel
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 3.2), darkMat)
    keel.position.set(0, -0.18, 0.1)
    this.group.add(keel)

    // Nose cone (6-sided for that angular sci-fi look)
    const noseGeo = new THREE.ConeGeometry(0.20, 1.3, 6)
    noseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    const nose = new THREE.Mesh(noseGeo, hullMat)
    nose.position.set(0, 0, -2.55)
    nose.castShadow = true
    this.group.add(nose)

    // Nose underside wedge — gives the ship that angular cockpit silhouette
    const noseKeel = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.85, 4), darkMat)
    noseKeel.geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    noseKeel.position.set(0, -0.10, -2.35)
    this.group.add(noseKeel)

    // Cockpit glass — flattened sphere
    const cockpitGeo = new THREE.SphereGeometry(0.24, 12, 8)
    cockpitGeo.applyMatrix4(new THREE.Matrix4().makeScale(1, 0.48, 1.7))
    const cockpit = new THREE.Mesh(cockpitGeo, glassMat)
    cockpit.position.set(0, 0.30, -0.85)
    this.group.add(cockpit)

    // Sensor/gun barrel below nose
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.020, 1.6, 6), darkMat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, -0.16, -2.85)
    this.group.add(barrel)
  }

  // ── Wings ─────────────────────────────────────────────────

  _buildWing(side, hullMat, darkMat) {
    // Wing shape: swept-back quadrilateral with vertical thickness
    // Vertices in model space (XZ plane, Y = thickness)
    const s = side

    const geo = new THREE.BufferGeometry()

    const verts = new Float32Array([
      // Top face (4 corners)
      s * 0.40,  0.055, -1.55,   // inner-front   v0
      s * 0.40,  0.050,  1.85,   // inner-back    v1
      s * 2.85,  0.018,  0.85,   // outer-back    v2
      s * 2.45,  0.035, -1.15,   // outer-front   v3
      // Bottom face
      s * 0.40, -0.055, -1.55,   // v4
      s * 0.40, -0.050,  1.85,   // v5
      s * 2.85, -0.018,  0.85,   // v6
      s * 2.45, -0.035, -1.15,   // v7
    ])

    // Winding: counter-clockwise when viewed from outside
    const idx = [
      // Top
      0, 1, 2,  0, 2, 3,
      // Bottom (reversed)
      4, 6, 5,  4, 7, 6,
      // Front edge
      0, 4, 7,  0, 7, 3,
      // Back edge
      1, 2, 6,  1, 6, 5,
      // Outer edge (wing tip)
      3, 7, 6,  3, 6, 2,
      // Inner edge (fuselage junction)
      0, 5, 4,  0, 1, 5,
    ]

    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()

    const wing = new THREE.Mesh(geo, hullMat)
    wing.castShadow = true
    this.group.add(wing)

    // Wing-tip vertical stabiliser fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.30, 0.85), darkMat)
    fin.position.set(s * 2.75, 0.12, 0.15)
    fin.rotation.z = -s * 0.12
    this.group.add(fin)

    // Underwing strake / thruster blister
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.70), darkMat)
    strake.position.set(s * 1.4, -0.07, 0.3)
    this.group.add(strake)
  }

  // ── Engine Pods ───────────────────────────────────────────

  _buildEnginePod(xOffset, darkMat, accentMat) {
    // Nacelle body — main cylindrical tube
    const nacelleGeo = new THREE.CylinderGeometry(0.19, 0.15, 1.65, 12)
    const nacelle = new THREE.Mesh(nacelleGeo, darkMat)
    nacelle.rotation.x = Math.PI / 2
    nacelle.position.set(xOffset, -0.13, 0.9)
    nacelle.castShadow = true
    this.group.add(nacelle)

    // Intake ring at the front of the nacelle
    const intakeGeo = new THREE.TorusGeometry(0.19, 0.028, 8, 20)
    const intakeMat = new THREE.MeshStandardMaterial({
      color: 0x223355,
      metalness: 1.0,
      roughness: 0.0,
      emissive: new THREE.Color(0x0a1a33),
      emissiveIntensity: 0.6,
    })
    const intake = new THREE.Mesh(intakeGeo, intakeMat)
    intake.position.set(xOffset, -0.13, 0.08)
    this.group.add(intake)

    // Bell-shaped exhaust nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.21, 0.14, 0.38, 12)
    const nozzle = new THREE.Mesh(nozzleGeo, accentMat)
    nozzle.rotation.x = Math.PI / 2
    nozzle.position.set(xOffset, -0.13, 1.83)
    this.group.add(nozzle)

    // ── Engine glow disc (custom shader) ──
    const glowGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 18)
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: ENGINE_VERT,
      fragmentShader: ENGINE_FRAG,
      uniforms: {
        uTime:      { value: 0 },
        uIntensity: { value: 0.7 },
        uColor:     { value: new THREE.Color(0x3377ff) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const glowDisc = new THREE.Mesh(glowGeo, glowMat)
    glowDisc.rotation.x = Math.PI / 2
    glowDisc.position.set(xOffset, -0.13, 2.0)
    this.group.add(glowDisc)
    this._engineMaterials.push(glowMat)

    // Soft halo sphere for bloom pick-up
    const haloGeo = new THREE.SphereGeometry(0.22, 8, 8)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x2255ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const halo = new THREE.Mesh(haloGeo, haloMat)
    halo.position.set(xOffset, -0.13, 2.05)
    this.group.add(halo)
    this._haloMeshes.push({ mesh: halo, mat: haloMat })

    // Point light — colours nearby geometry and creates volumetric-ish glow
    const light = new THREE.PointLight(0x3366ff, 2.5, 9)
    light.position.set(xOffset, -0.13, 2.15)
    this.group.add(light)
    this._engineLights.push(light)
  }

  // ── Central Engine ────────────────────────────────────────

  _buildCentralEngine(darkMat) {
    // Secondary thruster mounted on the spine
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.85, 10), darkMat)
    body.rotation.x = Math.PI / 2
    body.position.set(0, 0.12, 1.72)
    this.group.add(body)

    // Glowing exhaust face
    const glowGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 14)
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: ENGINE_VERT,
      fragmentShader: ENGINE_FRAG,
      uniforms: {
        uTime:      { value: 0 },
        uIntensity: { value: 1.0 },
        uColor:     { value: new THREE.Color(0x88aaff) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const glowDisc = new THREE.Mesh(glowGeo, glowMat)
    glowDisc.rotation.x = Math.PI / 2
    glowDisc.position.set(0, 0.12, 2.12)
    this.group.add(glowDisc)
    this._engineMaterials.push(glowMat)

    // Larger point light for the central engine (more important for bloom)
    const light = new THREE.PointLight(0x5577ff, 4, 14)
    light.position.set(0, 0.12, 2.25)
    this.group.add(light)
    this._engineLights.push(light)
  }

  // ── Update Loop ───────────────────────────────────────────

  update(delta, elapsed) {

    const warp  = this.experience.warpIntensity
    const mouse = this.experience.mouse

    // Calculates how fast warp changed between frames
    const warpDelta    = warp - (this._prevWarp ?? warp)
    // Save current warp for next frame
    this._prevWarp     = warp
    // Adds acceleration force when warp increases quickly
    this._accelImpulse = (this._accelImpulse ?? 0) + warpDelta * 0.6
    // Slowly removes acceleration force over time
    this._accelImpulse *= (1 - Math.min(delta * 3.5, 1))

    // ── Position ─────────────────────────────────────────────────

    // Calculate how far forward the ship should move during warp
    const targetZ = -warp * 1.8
    /*
    lerp() makes movement smoother

    It takes:
      current value
      target value
      interpolation amount

    interpolation amount controls how fast the movement happens
    */
    this._posZ = lerp(this._posZ ?? 0, targetZ, delta * 1.0)

    // Makes the ship gently float up and down
    const idleY  = Math.sin(elapsed * 0.65) * 0.14 * (1 - warp * 0.65)
    
    // Makes the ship follow the mouse vertically
    const mouseY = mouse.smoothY * 0.12
    // Smoothly move ship vertically
    this._posY   = lerp(this._posY ?? 0, idleY + mouseY, delta * 2.5)
    // Makes the ship follow the mouse horizontally
    const mouseX = mouse.smoothX * 0.22
    // Smoothly move ship horizontally
    this._posX   = lerp(this._posX ?? 0, mouseX, delta * 0.7)
    
    // Vibration becomes stronger during warp
    const vibAmp = 0.003 + warp * 0.009
    // Random horizontal vibration
    const vibX   = (Math.random() - 0.5) * vibAmp
    // Random vertical vibration
    const vibY   = (Math.random() - 0.5) * vibAmp

    // Apply final spaceship position
    this.group.position.set(
      this._posX + vibX,
      this._posY + vibY,
      this._posZ,
    )

    // ── Rotation ──────────────────────────────────────────────────

    // Small idle rotation to make ship feel alive
    const idlePitch = Math.sin(elapsed * 0.35) * 0.006
    // Tilts ship backward during warp acceleration
    const targetPitch = -warp * 0.16 + this._accelImpulse * 0.18 + idlePitch
    // Smoothly rotate the pitch
    this._pitch = lerp(this._pitch ?? 0, targetPitch, delta * 1.6)
    // Small idle side rotation
    const idleRoll = Math.sin(elapsed * 0.42) * 0.020
    // Tilts ship when moving mouse left/right
    const mouseRoll = -mouse.smoothX * 0.045
    // Smoothly rotate the roll
    this._roll = lerp(this._roll ?? 0, idleRoll + mouseRoll, delta * 1.2)
    // Slightly turns spaceship nose toward mouse
    const targetYaw = mouse.smoothX * 0.025
    // Smoothly rotate the yaw
    this._yaw = lerp(this._yaw ?? 0, targetYaw, delta * 0.8)
    // Apply final spaceship rotation
    this.group.rotation.set(this._pitch, this._yaw, this._roll)

    // ── Engine Shaders ────────────────────────────────────────────

    // Base engine glow intensity
    const engineBase = 0.45 + warp * 0.55
    // Creates animated pulsing effect in engines
    const enginePulse = Math.sin(elapsed * (5 + warp * 6)) * (0.08 + warp * 0.18)
    // Final engine intensity
    const engineIntensity = engineBase + enginePulse

    // Update shader uniforms every frame
    this._engineMaterials.forEach((mat) => {
      // Used to animate engine plasma movement
      mat.uniforms.uTime.value = elapsed

      // Controls engine brightness
      mat.uniforms.uIntensity.value = engineIntensity
    })

    // Engine lights become brighter during warp
    const baseLightIntensity = 2.5 + warp * 8

    // Makes engine flickering faster during warp
    const flickerFreq = 8 + warp * 6

    // Update engine lights
    this._engineLights.forEach((light) => {
      light.intensity =
        baseLightIntensity +
        Math.sin(elapsed * flickerFreq) * (0.3 + warp * 0.9)
    })

    // Update glowing engine halos
    this._haloMeshes.forEach(({ mesh, mat }) => {

      // Halos become larger during warp
      const s = 1 + warp * 1.8
      mesh.scale.setScalar(s)

      // Halos become brighter during warp
      mat.opacity = 0.10 + warp * 0.32
    })
  }
}

function lerp(a, b, t) {
  return a + (b - a) * Math.min(t, 1)
}
