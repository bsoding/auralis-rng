import * as THREE from 'three';

const tau = Math.PI * 2;
const centerZ = -10;
const sectors = 108;
const rings = 38;

export const landmarks = [
  { name: 'Wayfarer’s Landing', short: 'Landing', x: 0, z: 44,
    note: 'Follow the amber trail to the Meridian Beacon.' },
  { name: 'The Broken Cloister', short: 'Cloister', x: -27, z: -18,
    note: 'Stone arches mark the old western crossing.' },
  { name: 'Windglass Grove', short: 'Grove', x: 25, z: 5,
    note: 'The eastern trail runs beneath the windglass pines.' },
  { name: 'Meridian Beacon', short: 'Beacon', x: 2, z: -63,
    note: 'Climb to the lantern and light the summit.' },
];

export const trails = [
  [[0, 49], [0, 35], [-3, 22], [3, 7], [6, -6], [0, -17], [-6, -29], [-5, -41], [1, -51], [2, -63]],
  [[3, 7], [14, 12], [22, 9], [25, 5]],
  [[-3, 22], [-14, 13], [-22, 2], [-27, -10], [-27, -18], [-19, -27], [-6, -29]],
].map((points) => new THREE.SplineCurve(points.map(([x, z]) => new THREE.Vector2(x, z))));

export function randomStream(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function radii(angle) {
  return 1 + .075 * Math.cos(angle * 3 + 1) + .046 * Math.sin(angle * 7 - .5) + .023 * Math.cos(angle * 11);
}

export function rim(angle, scale = 1) {
  const r = radii(angle) * scale;
  return [46 * r * Math.cos(angle), centerZ + 74 * r * Math.sin(angle)];
}

export function islandRadius(x, z) {
  const u = x / 46;
  const v = (z - centerZ) / 74;
  return Math.hypot(u, v) / radii(Math.atan2(v, u));
}

function hill(x, z, cx, cz, width, depth, height) {
  return height * Math.exp(-(((x - cx) / width) ** 2 + ((z - cz) / depth) ** 2));
}

export function surface(x, z) {
  const edge = Math.max(0, (islandRadius(x, z) - .83) / .17);
  return .54 * Math.sin(x * .17 + z * .095) + .35 * Math.sin(z * .21 - x * .075)
    + hill(x, z, 2, -60, 25, 23, 16.5)
    + hill(x, z, -28, -20, 17, 25, 6)
    + hill(x, z, 26, 0, 16, 25, 4.4)
    - 1.75 * edge ** 2;
}

export const trailSamples = trails.flatMap((curve) => curve.getSpacedPoints(Math.ceil(curve.getLength() / 1.15)));

export function trailDistance(x, z) {
  let nearest = Infinity;
  for (const point of trailSamples) nearest = Math.min(nearest, (point.x - x) ** 2 + (point.y - z) ** 2);
  return Math.sqrt(nearest);
}

const landMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98, flatShading: true });

function coloredMesh(vertices, indices, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, landMaterial);
  mesh.receiveShadow = true;
  return mesh;
}

function islandTop(scene, world, RAPIER) {
  const vertices = [0, surface(0, centerZ), centerZ];
  const colors = [];
  const indices = [];
  const random = randomStream(671);
  const meadow = new THREE.Color('#648c4b');
  const heath = new THREE.Color('#395f40');
  const edge = new THREE.Color('#7b7e49');
  const color = new THREE.Color();
  function tint(x, z, radius) {
    const patch = .52 + .23 * Math.sin(x * .12 + z * .075) + .19 * Math.cos(z * .18 - x * .19);
    color.copy(heath).lerp(meadow, THREE.MathUtils.clamp(patch, 0, 1));
    color.lerp(edge, Math.max(0, (radius - .87) * 3.5)).multiplyScalar(.9 + random() * .19);
    colors.push(color.r, color.g, color.b);
  }
  tint(0, centerZ, 0);
  for (let ring = 1; ring <= rings; ring++) {
    for (let side = 0; side < sectors; side++) {
      const radius = ring / rings;
      const [x, z] = rim(side * tau / sectors, radius);
      vertices.push(x, surface(x, z), z);
      tint(x, z, radius);
      const current = 1 + (ring - 1) * sectors + side;
      const next = 1 + (ring - 1) * sectors + (side + 1) % sectors;
      if (ring === 1) indices.push(0, next, current);
      else indices.push(current - sectors, next, current, current - sectors, next - sectors, next);
    }
  }
  scene.add(coloredMesh(vertices, indices, colors));
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices)));
}

function islandCliffs(scene) {
  const random = randomStream(551);
  const vertices = [];
  const indices = [];
  const colors = [];
  const palette = ['#626443', '#546355', '#354b48', '#384741', '#304542', '#233936'].map((hex) => new THREE.Color(hex));
  const widths = [1, 1.035, .975, .91, .82, .57];
  const depths = [0, -2.6, -8.5, -12.1, -19, -30];
  for (let side = 0; side < sectors; side++) {
    const angle = side * tau / sectors;
    for (let layer = 0; layer < widths.length; layer++) {
      const width = widths[layer] + (layer ? .026 * Math.sin(angle * 13) + .026 * Math.cos(angle * 18 + layer * .5) : 0);
      const [x, z] = rim(angle, width);
      const fall = depths[layer] + (layer ? 1.1 * Math.sin(angle * 7) + 1.12 * Math.cos(angle * 15) : 0);
      vertices.push(x, surface(x, z) + fall - .035, z);
      const color = palette[layer].clone().multiplyScalar(.85 + .32 * random());
      colors.push(color.r, color.g, color.b);
      if (layer > 0) {
        const vertex = side * widths.length + layer;
        const next = ((side + 1) % sectors) * widths.length + layer;
        indices.push(vertex - 1, next - 1, vertex, next - 1, next, vertex);
      }
    }
  }
  const rocks = coloredMesh(vertices, indices, colors);
  rocks.material = landMaterial.clone();
  rocks.material.side = THREE.DoubleSide;
  scene.add(rocks);
}

function islandPaths(scene) {
  const random = randomStream(186);
  const width = 1.9;
  const pathColors = ['#88784e', '#a28c5f', '#c2a373', '#baa072', '#9c8657', '#776c48'].map((hex) => new THREE.Color(hex));
  for (const curve of trails) {
    const vertices = [];
    const colors = [];
    const indices = [];
    const count = Math.ceil(curve.getLength());
    const columns = pathColors.length;
    for (let segment = 0; segment <= count; segment++) {
      const t = segment / count;
      const point = curve.getPointAt(t);
      const direction = curve.getTangentAt(t);
      for (let column = 0; column < columns; column++) {
        const offset = (column / (columns - 1) * 2 - 1) * (width + Math.sin(t * 26) * .23 + random() * .31);
        const x = point.x - direction.y * offset;
        const z = point.y + direction.x * offset;
        vertices.push(x, surface(x, z) + .16, z);
        const color = pathColors[column].clone().multiplyScalar(.87 + .24 * random());
        colors.push(color.r, color.g, color.b);
        if (segment && column) {
          const i = segment * columns + column;
          indices.push(i - columns - 1, i, i - 1, i - columns - 1, i - columns, i);
        }
      }
    }
    scene.add(coloredMesh(vertices, indices, colors));
  }
}

export function buildTerrain(scene, world, RAPIER) {
  islandTop(scene, world, RAPIER);
  islandCliffs(scene);
  islandPaths(scene);
}
