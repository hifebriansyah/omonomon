// The shared 3D kit (three.js, pinned in assets/vendor/three/). Every 3D feature uses it and has a 2D fallback:
//
//   if (!canUse3D()) { /* show the 2D version */ return; }
//   const kit = await createKit(root, { accent, fogColor, background });
//   kit.add((dt, t) => { ... });          // called every frame with seconds since the last frame and total seconds
//   const ghost = kit.ghost(url, 1.6);     // a camera-facing sprite with a soft glow (height in world units)
//   kit.particles("fireflies");            // "fireflies" | "dust" | "mist": returns the Points object
//   kit.start(); ... kit.destroy();
//
// What it does for you: a renderer capped at pixel ratio 2 that pauses when the tab is hidden or the canvas is off screen,
// fog, a moonlight + lantern light rig, resize handling, and a clean destroy() that frees GPU memory.
// The module is imported lazily (dynamic import) so pages that do not use 3D never download three.js.

let threePromise = null;
export const loadThree = () => (threePromise ||= import("../../vendor/three/three.module.min.js"));

// True when this device can show the 3D version: WebGL works, the player has not asked to save data or reduce motion, and the
// device is not a very low-end one. Games fall back to their 2D version otherwise.
export function canUse3D() {
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (navigator.connection?.saveData) return false;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export async function createKit(root, { accent = "#a47fd0", fogColor = "#15142b", background = fogColor, fog = 0.06 } = {}) {
  const THREE = await loadThree();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(background);
  if (getComputedStyle(root).position === "static") root.style.position = "relative";
  renderer.domElement.style.cssText = "position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;"; // fills the root even when the root only has a min-height
  root.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(fogColor, fog);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 1.6, 5);

  // light rig: cool moonlight from above, a warm lantern near the camera (no shadows: they cost too much on phones)
  const moon = new THREE.DirectionalLight(0xb8c8ff, 1.5);
  moon.position.set(-3, 6, 2);
  const sky = new THREE.HemisphereLight(0xa0a8f0, 0x2a2850, 1.2);
  const lantern = new THREE.PointLight(0xffc27a, 1.6, 9, 1.6);
  lantern.position.set(0, 1.8, 3);
  scene.add(moon, sky, lantern);

  const updaters = [];
  const disposables = [];
  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;
  let visible = true;

  function resize() {
    const w = Math.max(1, root.clientWidth);
    const h = Math.max(1, root.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) { clock.getDelta(); return; } // paused: no work, and no big jump when it comes back
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    for (const fn of updaters) fn(dt, t);
    renderer.render(scene, camera);
  }
  const io = new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting !== false; });
  io.observe(root);

  // A soft round glow (a radial gradient drawn once), so a glow sprite is not a flat square.
  let glowTex = null;
  function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
    disposables.push(glowTex);
    return glowTex;
  }

  // A character picture standing in the scene, always facing the camera, with a faint glow behind it.
  function ghost(url, height = 1.6) {
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, fog: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(height, height, 1);
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(accent), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(height * 1.5, height * 1.5, 1);
    const group = new THREE.Group();
    group.add(glow, sprite);
    scene.add(group);
    disposables.push(tex, mat, glowMat);
    return group;
  }

  // Small drifting points: fireflies (warm, blinking), dust (pale, slow) or mist (large, faint, very slow).
  function particles(kind = "fireflies", { count = 60, area = [10, 4, 10] } = {}) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * area[0];
      pos[i * 3 + 1] = Math.random() * area[1];
      pos[i * 3 + 2] = (Math.random() - 0.5) * area[2] - 2;
      seed[i] = Math.random() * 6.28;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const look = { fireflies: [0xffe08a, 0.09, 0.9], dust: [0xdfe6ff, 0.04, 0.45], mist: [0xb9bfe8, 0.5, 0.08] }[kind] || [0xffffff, 0.05, 0.5];
    const mat = new THREE.PointsMaterial({ color: look[0], size: look[1], transparent: true, opacity: look[2], depthWrite: false, blending: kind === "fireflies" ? THREE.AdditiveBlending : THREE.NormalBlending });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    disposables.push(geo, mat);
    const speed = kind === "mist" ? 0.05 : kind === "dust" ? 0.12 : 0.3;
    updaters.push((dt, t) => {
      for (let i = 0; i < count; i++) {
        pos[i * 3] += Math.sin(t * 0.4 + seed[i]) * speed * dt;
        pos[i * 3 + 1] += Math.cos(t * 0.5 + seed[i]) * speed * 0.5 * dt;
      }
      geo.attributes.position.needsUpdate = true;
      if (kind === "fireflies") mat.opacity = 0.55 + 0.4 * Math.sin(t * 2.2);
    });
    return points;
  }

  return {
    THREE, scene, camera, renderer, lights: { moon, sky, lantern },
    add: (fn) => updaters.push(fn),
    ghost, particles, resize,
    start() { if (!running) { running = true; clock.start(); frame(); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    track: (obj) => disposables.push(obj), // anything with dispose() that destroy() should free
    destroy() {
      this.stop();
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); }); });
      for (const d of disposables) d.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
