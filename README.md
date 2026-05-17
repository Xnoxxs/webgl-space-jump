Space Jump
==========

A cinematic sci-fi scene built with Three.js and WebGL. You're sitting behind a spaceship in deep space, and pressing SPACE launches you into hyperspace.

No 3D models, no heavy textures — everything is built with code.

---

Project Idea
------------

The idea was to create a stylized sci-fi experience where the user controls a warp effect. Moving the mouse slightly steers the ship, and holding SPACE (or clicking) triggers a full hyperspace jump with glowing tunnels, bloom, and screen distortion.

It was mostly a project to learn shaders, post-processing, and how to structure a Three.js scene properly.

---

Features
--------

- Animated spaceship — built entirely from Three.js primitives (boxes, cones, cylinders). No external model file needed.
- Warp tunnel — a large cylinder viewed from the inside, with a custom GLSL shader drawing animated energy rings and light streaks.
- Glowing engines — custom shader per engine that animates plasma rings and a Fresnel rim glow.
- Mouse interaction — moving the mouse gently tilts and shifts the ship in that direction.
- SPACE / click / tap — activates warp mode. Releasing it drops you back out.
- Camera movement — the camera subtly follows the mouse and pushes forward during warp.
- Post-processing — bloom, chromatic aberration, and a vignette that all intensify during warp.
- Floating animation — the ship bobs up and down gently when idle so it feels alive.
- HUD text — small status messages appear on screen when you enter or exit hyperspace.

---

Lighting
--------

No HDRI was used. Instead, the scene uses manual point lights and directional lights placed by hand.

Why:
- The scene is stylized, so realistic environment reflections would look out of place
- Manual lights give full control over where the glow and shadows fall
- No HDR texture file means a smaller download and faster load
- Better performance, especially on lower-end devices

The engine lights are actual `PointLight` objects that flicker and brighten during warp, which is what makes nearby geometry look like it's being lit by the engines.

---

Shaders
-------

Three custom GLSL shaders were written for this project:

Engine glow — runs on each engine disc. Uses Fresnel to make the rim glow brighter at grazing angles, and animates plasma rings across the surface using sine waves and UV coordinates.

Warp tunnel — a cylinder with `BackSide` rendering so you see the inside. The fragment shader draws rushing rings, thin secondary rings, and longitudinal light lines along the tunnel wall. Colors shift between electric blue and violet over time.

Speed burst — 350 particles that explode outward from the center of the screen during warp. Each one has a random angle, radius, and speed. They fade in fast and trail off slowly.

Post-processing shaders handle chromatic aberration (RGB split toward edges) and a vignette that darkens and adds a blue tint at the screen edges during warp.

---

Interaction
-----------

| Input         | Effect                                                        |
|---------------|---------------------------------------------------------------|
| Mouse move    | Ship tilts and drifts toward the cursor                       |
| Hold SPACE    | Activates warp — tunnel appears, bloom explodes, ship lurches |
| Release SPACE | Drops out of warp smoothly                                    |
| Click / tap   | Same as SPACE — works on mobile too                           |

Mouse coordinates are normalized to `-1 → 1` and smoothed with lerp so the motion feels floaty rather than snappy.

---

Performance
-----------

- The spaceship is made entirely from primitive geometry — no `.glb` or `.obj` file to load
- No HDR textures — the background is just a black scene with a custom starfield
- Post-processing passes are kept minimal (bloom, chromatic aberration, vignette)
- The warp tunnel uses `discard` in the fragment shader when intensity is near zero, so it costs almost nothing when warp is off
- `devicePixelRatio` is capped at `2` to avoid unnecessary overdraw on high-DPI screens

---

What I Learned
--------------

- GLSL shaders — writing vertex and fragment shaders from scratch, using uniforms to pass data from JS to the GPU, and using `smoothstep`, `fract`, and `sin` to create animated effects
- Animation loop — using `THREE.Timer` for frame-independent animation so things move at the same speed regardless of frame rate
- Lerp — using linear interpolation to smooth out position, rotation, and intensity values so nothing jumps abruptly
- Lighting — how point lights interact with `MeshStandardMaterial` and how to fake engine glow with a combination of a shader disc + a halo sphere + an actual point light
- Post-processing — stacking passes with `EffectComposer` and writing custom `ShaderPass` effects
- Interaction systems — normalizing mouse coordinates, handling keyboard and touch events, and driving multiple systems from a single `warpIntensity` value that goes from `0` to `1`

---

Running the Project
-------------------

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

Technologies Used
-----------------

- [Three.js](https://threejs.org/) — 3D rendering
- GLSL — custom shaders for engines, tunnel, burst particles, and post-processing effects
- [Vite](https://vite.dev/) — dev server and bundler
