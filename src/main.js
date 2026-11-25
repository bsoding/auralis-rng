import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildTerrain, landmarks, surface } from './terrain.js';
import { paintSky } from './sky.js';
import { addFireflies, buildScenery } from './scenery.js';
import { addPlayer, gravity, tick } from './player.js';
import { announce, bindControls, initialOrbit, updateLocation } from './ui.js';
import './styles.css';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const interactHUD = document.getElementById('interact-hud');

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(54, 1, .28, 525);
  const animateSky = paintSky(scene);

  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -gravity, z: 0 });
  world.timestep = tick;
  world.lengthUnit = 3.5;
  buildTerrain(scene, world, RAPIER);
  const beacon = buildScenery(scene, world, RAPIER);
  const fireflies = addFireflies(scene);
  const player = addPlayer(scene, world, RAPIER);
  world.step();

  const summit = landmarks[3];
  const target = new THREE.Vector3();
  const lookFrom = new THREE.Vector3();
  const cameraHeight = new THREE.Vector3(0, 3.3, 0);
  let settledCamera = false;
  let currentLocation = landmarks[0];
  let canInteract = false;
  let accumulator = 0;
  let last = null;
  const { orbit, read } = bindControls(canvas, player, () => reset(false), interact);

  function reset(fell) {
    player.reset();
    Object.assign(orbit, initialOrbit);
    settledCamera = false;
    if (fell) announce('Returned to Wayfarer’s Landing.');
  }

  function interact() {
    if (!canInteract || beacon.lit) return;
    beacon.ignite();
    summit.note = 'The lantern is shining over the Reach.';
    updateLocation(summit);
    interactHUD.hidden = true;
    announce('The Meridian Beacon is lit.');
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, width < 760 ? 1.35 : 1.65));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = Math.min(72, 54 + Math.max(0, 1.3 - camera.aspect) * 24);
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  function updateCamera(delta) {
    const feet = player.feet;
    const blend = settledCamera ? 1 - Math.exp(-delta * 16) : 1;
    target.lerp(lookFrom.copy(feet).add(cameraHeight), blend);
    const direction = {
      x: Math.sin(orbit.yaw) * Math.cos(orbit.pitch),
      y: Math.sin(orbit.pitch),
      z: Math.cos(orbit.yaw) * Math.cos(orbit.pitch),
    };
    const ray = new RAPIER.Ray(target, direction);
    const hit = world.castRay(ray, orbit.distance, true, undefined, undefined, player.collider);
    const distance = hit ? Math.max(1.25, hit.timeOfImpact - .36) : orbit.distance;
    camera.position.set(target.x + direction.x * distance, target.y + direction.y * distance, target.z + direction.z * distance);
    camera.lookAt(target);
    settledCamera = true;
  }

  function updateHUD() {
    const { x, y, z } = player.feet;
    const distanceTo = (landmark) => Math.hypot(x - landmark.x, z - landmark.z);
    const location = landmarks.find((landmark) => distanceTo(landmark) < (landmark === summit ? 16 : 12)) ?? null;
    if (location !== currentLocation) {
      currentLocation = location;
      updateLocation(location);
    }
    const nearby = !beacon.lit && distanceTo(summit) < 8 && Math.abs(y - surface(x, z)) < 4;
    if (nearby !== canInteract) {
      canInteract = nearby;
      interactHUD.hidden = !nearby;
    }
  }

  renderer.setAnimationLoop((now) => {
    const elapsed = last === null ? tick : Math.min(.083, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= tick) {
      const { x, z, jump } = read();
      const sin = Math.sin(orbit.yaw);
      const cos = Math.cos(orbit.yaw);
      player.move(x * cos + z * sin, z * cos - x * sin, jump);
      world.step();
      player.syncPosition();
      if (player.feet.y < -38) reset(true);
      accumulator -= tick;
    }
    const time = now / 1000;
    player.draw(time, elapsed);
    updateCamera(elapsed);
    animateSky(time, camera);
    fireflies(time);
    beacon.animate(time);
    updateHUD();
    renderer.render(scene, camera);
    if (!loading.hidden) loading.hidden = true;
  });
}

start().catch((error) => {
  console.error(error);
  document.getElementById('loading-message').textContent =
    'The island could not start. Make sure WebGL 2 is available, then reload the page.';
});
