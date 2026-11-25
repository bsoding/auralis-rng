import * as THREE from 'three';
import { islandRadius, randomStream, rim, surface, trailDistance, trails } from './terrain.js';

const stoneColors = ['#697d72', '#849183', '#59716a', '#a0a286'];
const pineColors = ['#27524a', '#356451', '#4e7354', '#55795a', '#306756'];
const grassColors = ['#9fa75f', '#738c54', '#c2ad64', '#587d50', '#c3bb73', '#8ca25f'];
const woody = '#54453a';
const neutral = new THREE.MeshStandardMaterial({ roughness: .89, flatShading: true });
const ember = new THREE.MeshBasicMaterial({ color: '#ffdf8a' });
const shadowCube = new THREE.BoxGeometry(1, 1, 1);

function batch(scene, geometry, items, shadows = true) {
  if (!items.length) return;
  const mesh = new THREE.InstancedMesh(geometry, neutral, items.length);
  const pose = new THREE.Object3D();
  const tint = new THREE.Color();
  items.forEach(({ position, size, angles, color }, i) => {
    pose.position.set(...position);
    pose.scale.set(...size);
    pose.rotation.set(...angles);
    pose.updateMatrix();
    mesh.setMatrixAt(i, pose.matrix);
    mesh.setColorAt(i, tint.set(color));
  });
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function makeGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const spread = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  spread.addColorStop(0, '#fff3ae');
  spread.addColorStop(.15, '#ffbb61ba');
  spread.addColorStop(.45, '#f799363f');
  spread.addColorStop(1, '#ed7d2400');
  ctx.fillStyle = spread;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .77 });
}

export function buildScenery(scene, world, RAPIER) {
  const blocks = [];
  const trunks = [];
  const leaves = [];
  const grasses = [];
  const boulders = [];
  const flowers = [];
  const random = randomStream(655931);
  const pick = (colors) => colors[Math.floor(random() * colors.length)];
  const yaw = () => random() * Math.PI * 2;
  const glow = makeGlow();
  function block(x, y, z, w, h, d, color, angle = 0, solid = false, tilt = 0) {
    blocks.push({ position: [x, y, z], size: [w, h, d], angles: [0, angle, tilt], color });
    if (solid) {
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, tilt));
      world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
        .setTranslation(x, y, z).setRotation(rotation));
    }
  }
  function lantern(x, z, tall = 2.55) {
    const y = surface(x, z);
    block(x, y + tall * .47, z, .23, tall, .23, woody, .24, true);
    block(x, y + tall - .35, z, .65, .13, .65, '#5e5342', .24);
    block(x, y + tall + .49, z, .64, .14, .64, '#887453', .24);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(.37), ember);
    core.position.set(x, y + tall + .07, z);
    core.scale.y = 1.28;
    const aura = new THREE.Sprite(glow);
    aura.position.copy(core.position);
    aura.scale.setScalar(3.8);
    scene.add(core, aura);
  }
  function tree(x, z, height, spread = 1) {
    const y = surface(x, z);
    const width = height * (.22 + random() * .05) * spread;
    const lean = (random() - .5) * .09;
    const angle = yaw();
    const radius = height * .035;
    trunks.push({ position: [x, y + height * .42, z], size: [radius * 1.45, height * .88, radius * 1.45], angles: [0, angle, lean], color: woody });
    world.createCollider(RAPIER.ColliderDesc.cylinder(height * .28, radius)
      .setTranslation(x, y + height * .28, z));
    for (let tier = 0; tier < 4; tier++) {
      const diameter = width * (1.26 - tier * .212) * 1.65;
      const canopy = height * (.45 - tier * .047);
      leaves.push({
        position: [x - lean * 3 * tier, y + height * (.49 + tier * .145), z],
        size: [diameter, canopy, diameter], angles: [lean / 2, angle + tier * .56, lean],
        color: pick(pineColors),
      });
    }
  }
  function rock(x, z, size) {
    const y = surface(x, z);
    boulders.push({ position: [x, y + size * .21, z], size: [size, size * .58, size * .76], angles: [.04, yaw(), random() * .3], color: pick(stoneColors) });
    if (size > 1.25) {
      world.createCollider(RAPIER.ColliderDesc.ball(size * .49).setTranslation(x, y - size * .13, z));
    }
  }

  const trees = [
    [-13.8, 36, 12], [-17, 37, 9.7], [-17, 27, 11.3], [15, 33, 10.4], [21, 30, 12.7], [24, 33, 8],
    [-19, 21, 9.3], [-26, 21, 12], [24, 18, 11.8], [29, 13, 14], [31, 5, 15], [29, 1, 10],
    [21, -3, 12], [30, -11, 11], [26, -19, 11.4], [34, -18, 10], [-28, 8, 10],
    [-32, -2, 12], [-34, -15, 13], [-32, -27, 11], [-22, -32, 12], [-27, -41, 12],
    [20, -29, 11], [24, -37, 10], [19, -49, 10], [-19, -49, 8], [-12, -55, 8.5],
    [17, 20, 8.6], [-13, 21, 7.6], [36, -6, 13.8], [-38, -25, 11], [36, -25, 8],
  ];
  for (const [x, z, height] of trees) tree(x, z, height);
  for (let i = 0; i < 175; i++) {
    const [x, z] = rim(yaw(), .15 + Math.sqrt(random()) * .78);
    if (trailDistance(x, z) > 3.6 && z > -53 && random() > .35) rock(x, z, .38 + random() ** 2 * 2.4);
  }
  for (const [x, z, size] of [[-6, 41, 2.6], [6, 37, 2.4], [7, 46, 3.2], [-8, 57, 3.6], [13, 44, 2.3], [-12, -42, 2.1]]) rock(x, z, size);

  for (let i = 0; i < 14600; i++) {
    const [x, z] = rim(yaw(), Math.sqrt(random()) * .986);
    const distance = trailDistance(x, z);
    if (distance < 1.95 || (z < -52 && Math.abs(x - 2) < 8)) continue;
    const onEdge = distance < 4;
    if (!onEdge && random() > .63 + .22 * Math.sin(x * .51 + z * .23)) continue;
    const y = surface(x, z);
    const tall = .18 + random() ** 1.5 * (onEdge ? 1.1 : .84);
    const width = .08 + random() * .12;
    grasses.push({ position: [x, y + tall * .22, z], size: [width, tall, width], angles: [random() * .24, yaw(), random() * .48 - .24], color: pick(grassColors) });
    if (onEdge && random() > .91) {
      flowers.push({ position: [x, y + tall * .60, z], size: [.15, .1, .15], angles: [.2, yaw(), .2], color: random() > .3 ? '#ffd49a' : '#bfcac4' });
    }
  }

  for (const [x, z, size] of [[-4.5, 38, 2.4], [4.5, 38, 2.4], [-5.2, 29, 2.9], [2, 20, 2.65], [3, 10, 2.6],
    [8.9, -2, 2.3], [8, -11, 2.4], [-2, -21, 2.45], [-9.1, -31, 2.8],
    [-1.5, -40, 2.55], [2.9, -50, 2.7], [-24, -10, 2.15], [18, 14, 2.45], [28.8, 7, 2.2]]) lantern(x, z, size);

  // Separate blocks leave the old cloister arches open and physically walkable.
  for (const x of [-31, -23]) {
    for (const z of [-16, -21, -26]) {
      const y = surface(x, z);
      block(x, y + .12, z, 2.5, .56, 2.5, stoneColors[1], .02, true);
      for (let layer = 0; layer < 5; layer++) {
        block(x, y + .74 + layer * .92, z, 1.65, .88, 1.68, pick(stoneColors), (random() - .5) * .055, true);
      }
      block(x, y + 5.3, z, 2.08, .44, 1.95, stoneColors[3], 0, true);
    }
  }
  for (const z of [-16, -21]) {
    const y = (surface(-31, z) + surface(-23, z)) / 2;
    for (let beam = 0; beam < 9; beam++) {
      const angle = Math.PI * (beam + .5) / 9;
      block(-27 + 4 * Math.cos(angle), y + 5.25 + 2.9 * Math.sin(angle), z,
        1.32, 1.19, 1.6, pick(stoneColors), 0, false, angle - Math.PI / 2);
    }
  }
  for (let i = 0; i < 19; i++) {
    const x = -35 + random() * 4.5;
    const z = -28 + random() * 16;
    if (islandRadius(x, z) < .95) rock(x, z, .85 + random() * 1.55);
  }

  // Timber benches face the valleys on either side of the grove.
  for (const [x, z, angle] of [[27, 10, -.52], [25, 1, .91], [-16, 3, -.2]]) {
    const y = surface(x, z);
    block(x, y + .8, z, 3.7, .23, 1.35, '#74523a', angle, true);
    for (const side of [-1, 1]) {
      block(x + Math.cos(angle) * side * 1.35, y + .31, z - Math.sin(angle) * side * 1.35,
        .45, .74, 1.1, '#65513e', angle);
    }
  }

  batch(scene, shadowCube, blocks);
  batch(scene, new THREE.CylinderGeometry(.62, 1, 1, 7), trunks);
  batch(scene, new THREE.ConeGeometry(.5, 1, 6), leaves);
  batch(scene, new THREE.DodecahedronGeometry(1), boulders);
  batch(scene, new THREE.ConeGeometry(1, 1, 3), grasses, false);
  batch(scene, new THREE.IcosahedronGeometry(1), flowers, false);
  return buildBeacon(scene, world, RAPIER, glow);
}

function buildBeacon(scene, world, RAPIER, glow) {
  const x = 2;
  const z = -63;
  const y = surface(x, z) - .34;
  const monument = new THREE.Group();
  monument.position.set(x, y, z);
  scene.add(monument);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: '#748d79', flatShading: true, roughness: .91 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#ccad6b', metalness: .27, roughness: .61 });
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#385951', flatShading: true, roughness: .82 });
  function plinth(radius, height, top, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + .09, height, 8, 1), material);
    mesh.position.y = top - height / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    monument.add(mesh);
    world.createCollider(RAPIER.ColliderDesc.cylinder(height / 2, radius)
      .setTranslation(x, y + mesh.position.y, z));
  }
  plinth(5.7, .66, .44, baseMaterial);
  plinth(4.85, .48, .92, baseMaterial);
  plinth(3.91, .47, 1.39, baseMaterial);
  plinth(1.96, .34, 1.73, trimMaterial);
  plinth(1.3, 5.25, 6.98, stoneMaterial);
  plinth(1.79, .45, 7.43, trimMaterial);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.81, .6, 8), stoneMaterial);
  top.position.y = 12.5;
  top.castShadow = true;
  monument.add(top);
  for (let i = 0; i < 4; i++) {
    const angle = (i + .5) * Math.PI / 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(.28, 5.2, .28), trimMaterial);
    post.position.set(Math.cos(angle) * 1.65, 9.8, Math.sin(angle) * 1.65);
    post.rotation.y = angle;
    post.castShadow = true;
    monument.add(post);
  }
  const halo = new THREE.Sprite(glow.clone());
  halo.position.y = 10.25;
  halo.scale.setScalar(8);
  halo.material.opacity = .58;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.02), ember.clone());
  core.position.y = 10.25;
  core.scale.y = 1.6;
  core.material.color.set('#ffbd5e');
  monument.add(halo, core);
  const ringGroup = new THREE.Group();
  ringGroup.position.y = 10.25;
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3 + i * .62, .054, 7, 64), trimMaterial);
    ring.rotation.set(.93 + i * .62, .25, i * .8);
    ringGroup.add(ring);
  }
  monument.add(ringGroup);
  const rayMaterial = new THREE.MeshBasicMaterial({ color: '#ffe4a6', transparent: true, opacity: .17,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ray = new THREE.Mesh(new THREE.CylinderGeometry(.54, .17, 64, 12, 1, true), rayMaterial);
  ray.position.y = 42.2;
  ray.visible = false;
  monument.add(ray);
  const light = new THREE.PointLight('#ffd07b', 30, 18);
  light.position.y = 10.25;
  monument.add(light);
  return {
    get lit() { return ray.visible; },
    ignite() {
      ray.visible = true;
      core.material.color.set('#fff2ab');
      halo.material.opacity = 1;
      halo.scale.setScalar(15);
      light.intensity = 170;
    },
    animate(time) {
      core.rotation.y = time * .62;
      core.position.y = 10.25 + Math.sin(time * 1.65) * .19;
      ringGroup.rotation.y = time * .14;
      rayMaterial.opacity = .145 + .04 * Math.sin(time * 2);
    },
  };
}

export function addFireflies(scene) {
  const random = randomStream(714);
  const count = 125;
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = random();
    const point = trails[0].getPointAt(t);
    const x = point.x + (random() - .5) * 33;
    const z = point.y + (random() - .5) * 12;
    points.set([x, surface(x, z) + .65 + random() ** 1.65 * 7, z], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      uniform float time;
      varying float blink;
      void main() {
        vec3 p = position + vec3(sin(time*.9 + position.z*.45)*.65,
          sin(time*1.44 + position.x*.33)*.43, cos(time*.55 + position.x)*.49);
        vec4 eye = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * eye;
        gl_PointSize = clamp(109. / max(-eye.z, 1.), 1., 7.);
        blink = .48 + .43 * sin(position.z*6. + time*2.);
      }`,
    fragmentShader: `
      varying float blink;
      void main() {
        float glow = max(0., 1. - length(gl_PointCoord - .5) * 2.);
        gl_FragColor = vec4(1., .73, .3, glow * glow * blink);
      }`,
  });
  scene.add(new THREE.Points(geometry, material));
  return (time) => { material.uniforms.time.value = time; };
}
