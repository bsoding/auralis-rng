import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { landmarks, surface } from './terrain.js';

export const walkingSpeed = 16;
export const gravity = 196.2;
export const jumpHeight = 7.2;
export const tick = 1 / 60;
const launchSpeed = Math.sqrt(2 * gravity * jumpHeight) + gravity * tick / 2;
const radius = .92;
const halfSegment = 1.37;
const footOffset = radius + halfSegment;
const characterHeight = 5.02;
const spawn = landmarks[0];
const spawnPosition = { x: spawn.x, y: surface(spawn.x, spawn.z) + footOffset + .12, z: spawn.z };

function makeWayfarer() {
  const model = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const colors = ['#406c61', '#31594d', '#efb65f', '#b47753', '#243c40', '#564436', '#e6a879', '#e6c98a', '#233632'];
  const materials = colors.map((color) => new THREE.MeshStandardMaterial({ color, roughness: .88 }));
  function piece(parent, size, position, material) {
    const mesh = new THREE.Mesh(box, materials[material]);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  piece(model, [1.74, 1.7, .92], [0, 2.7, 0], 0);
  piece(model, [1.78, .19, .98], [0, 2.18, 0], 5);
  piece(model, [.3, .26, .06], [0, 2.18, .51], 7);
  piece(model, [1.59, .31, 1], [0, 3.49, 0], 2);
  piece(model, [.23, .66, .09], [.25, 3.14, .49], 2).rotation.z = -.1;
  piece(model, [1.12, 1.22, .46], [0, 2.81, -.64], 5);
  piece(model, [1.17, .38, .53], [0, 3.31, -.67], 3);
  piece(model, [.14, .90, .08], [-.36, 2.92, -.91], 7);
  piece(model, [.14, .90, .08], [.36, 2.92, -.91], 7);
  piece(model, [.29, .29, .06], [0, 3, -.906], 2).rotation.z = Math.PI / 4;
  piece(model, [1.19, 1.15, 1.12], [0, 4.1, 0], 6);
  piece(model, [1.42, .16, 1.55], [0, 4.55, .11], 1);
  piece(model, [1.29, .56, 1.23], [0, 4.75, -.08], 0);
  piece(model, [1.31, .12, 1.26], [0, 4.53, -.08], 2);
  for (const sign of [-1, 1]) piece(model, [.10, .14, .035], [sign * .25, 4.13, .57], 8);
  piece(model, [.23, .045, .036], [0, 3.91, .57], 5);

  const arms = [];
  const legs = [];
  for (const sign of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(1.23 * sign, 3.45, 0);
    piece(shoulder, [.68, 1.21, .73], [0, -.56, 0], 1);
    piece(shoulder, [.63, .4, .66], [0, -1.32, 0], 6);
    piece(shoulder, [.69, .12, .74], [0, -1.09, 0], 2);
    const hip = new THREE.Group();
    hip.position.x = .44 * sign;
    hip.position.y = 1.93;
    piece(hip, [.76, 1.57, .8], [0, -.68, 0], 4);
    piece(hip, [.78, .47, 1.05], [0, -1.70, .07], 5);
    model.add(shoulder, hip);
    arms.push(shoulder);
    legs.push(hip);
  }
  return { model, arms, legs };
}

function disposeAvatar(model) {
  const disposable = new Set();
  model.traverse((node) => {
    if (!node.isMesh) return;
    disposable.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      disposable.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) disposable.add(value);
    }
  });
  for (const resource of disposable) resource.dispose();
}

export function addPlayer(scene, world, RAPIER) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(spawnPosition.x, spawnPosition.y, spawnPosition.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(halfSegment, radius), body);
  const controller = world.createCharacterController(.055);
  controller.enableAutostep(.61, .33, false);
  controller.enableSnapToGround(.45);
  controller.setMaxSlopeClimbAngle(Math.PI / 4);
  controller.setMinSlopeSlideAngle(Math.PI / 3);

  const root = new THREE.Group();
  const wayfarer = makeWayfarer();
  const feet = new THREE.Vector3();
  root.rotation.y = Math.PI;
  root.add(wayfarer.model);
  scene.add(root);

  let vertical = 0;
  let grounded = false;
  let cadence = 0;
  let intensity = 0;
  let jumpBuffer = 0;
  let heading = Math.PI;
  let imported = null;
  let mixer = null;
  let actions = {};
  let activeAction = null;

  function reset() {
    body.setTranslation(spawnPosition, true);
    body.setNextKinematicTranslation(spawnPosition);
    vertical = 0;
    grounded = false;
    jumpBuffer = 0;
    cadence = 0;
    heading = root.rotation.y = Math.PI;
    syncPosition();
  }

  function syncPosition() {
    const position = body.translation();
    feet.set(position.x, position.y - footOffset, position.z);
    root.position.copy(feet);
  }

  function move(x, z, jump) {
    jumpBuffer = jump ? .12 : Math.max(0, jumpBuffer - tick);
    if (grounded && jumpBuffer > 0) {
      vertical = launchSpeed;
      grounded = false;
      jumpBuffer = 0;
    }
    vertical = grounded ? -4 : vertical - gravity * tick;
    const dy = vertical * tick;
    controller.computeColliderMovement(collider, { x: x * walkingSpeed * tick, y: dy, z: z * walkingSpeed * tick });
    const delta = controller.computedMovement();
    grounded = controller.computedGrounded();
    if (grounded || (dy > 0 && delta.y < dy - .07)) vertical = 0;
    const position = body.translation();
    body.setNextKinematicTranslation({ x: position.x + delta.x, y: position.y + delta.y, z: position.z + delta.z });
    const speed = Math.hypot(delta.x, delta.z) / tick;
    if (Math.hypot(x, z) > .05) heading = Math.atan2(x, z);
    intensity = THREE.MathUtils.damp(intensity, THREE.MathUtils.clamp(speed / walkingSpeed, 0, 1), 15, tick);
    cadence += speed * tick * .66;
  }

  function draw(time, delta) {
    const offset = heading - root.rotation.y;
    root.rotation.y += Math.atan2(Math.sin(offset), Math.cos(offset)) * (1 - Math.exp(-delta * 17));
    if (imported) {
      const action = (!grounded && actions.jump) || (intensity > .12 && actions.walk) || actions.idle || actions.walk;
      if (action && action !== activeAction) {
        activeAction?.fadeOut(.14);
        action.reset().fadeIn(.14).play();
        activeAction = action;
      }
      mixer?.update(delta);
      return;
    }
    wayfarer.model.position.y = grounded ? Math.abs(Math.sin(cadence)) * .095 * intensity : 0;
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      const swing = Math.sin(cadence) * intensity * sign;
      wayfarer.legs[i].rotation.x = grounded ? swing * .62 : .24 + sign * .25;
      wayfarer.arms[i].rotation.x = grounded ? -swing * .56 + Math.sin(time * 2.8) * .027 : -.55 + sign * .16;
      wayfarer.arms[i].rotation.z = sign * (.09 + (grounded ? 0 : .13));
    }
  }

  function restoreAvatar() {
    if (!imported) return;
    mixer?.stopAllAction();
    root.remove(imported);
    disposeAvatar(imported);
    imported = mixer = activeAction = null;
    actions = {};
    wayfarer.model.visible = true;
  }

  async function loadAvatar(file) {
    if (file.size > 30 * 1024 * 1024) throw new Error('Choose an avatar under 30 MB.');
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (/^(data:|blob:)/i.test(url)) return url;
      throw new Error('Choose a self-contained avatar with its textures embedded.');
    });
    const loader = new GLTFLoader(manager);
    const data = /\.gltf$/i.test(file.name) ? await file.text() : await file.arrayBuffer();
    const gltf = await loader.parseAsync(data, '');
    const model = gltf.scene;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    if (bounds.isEmpty() || !Number.isFinite(height) || height < .001) {
      disposeAvatar(model);
      throw new Error('The file needs a visible avatar mesh.');
    }
    const scale = characterHeight / height;
    const center = bounds.getCenter(new THREE.Vector3());
    const container = new THREE.Group();
    container.scale.setScalar(scale);
    container.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    model.traverse((node) => {
      if (node.isMesh) node.castShadow = node.receiveShadow = true;
      if (node.isLight) node.visible = false;
    });
    container.add(model);
    restoreAvatar();
    imported = container;
    root.add(container);
    wayfarer.model.visible = false;
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      for (const [key, name] of Object.entries({ idle: /idle/i, walk: /walk|run/i, jump: /jump/i })) {
        const clip = gltf.animations.find((item) => name.test(item.name));
        if (clip) actions[key] = mixer.clipAction(clip);
      }
    }
  }

  reset();
  return { collider, feet, move, syncPosition, draw, reset, loadAvatar, restoreAvatar };
}
