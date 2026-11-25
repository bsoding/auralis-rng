import * as THREE from 'three';
import { randomStream } from './terrain.js';

const horizon = '#adb89b';

export function paintSky(scene) {
  scene.fog = new THREE.FogExp2(horizon, .0048);
  const daylight = new THREE.HemisphereLight('#fef1ce', '#4f8272', 2.05);
  const sun = new THREE.DirectionalLight('#ffd69a', 2.45);
  sun.position.set(-63, 76, -40);
  sun.target.position.set(0, 0, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -66, right: 66, top: 74, bottom: -74, near: 12, far: 210 });
  sun.shadow.bias = -.00015;
  sun.shadow.normalBias = .18;
  scene.add(daylight, sun, sun.target);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 direction;
        void main() {
          direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }`,
      fragmentShader: `
        uniform float time;
        varying vec3 direction;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 cell = floor(p), f = fract(p);
          vec2 w = f * f * (3. - 2. * f);
          return mix(mix(hash(cell), hash(cell + vec2(1.,0.)), w.x),
            mix(hash(cell + vec2(0.,1.)), hash(cell + 1.), w.x), w.y);
        }
        float cloud(vec2 p) {
          return .57 * noise(p) + .27 * noise(p * 2.08) + .11 * noise(p * 4.38) + .05 * noise(p * 8.5);
        }
        void main() {
          vec3 d = normalize(direction);
          vec3 sunDir = normalize(vec3(-.27, .166, -.95));
          float angle = acos(clamp(dot(d, sunDir), -1., 1.));
          vec3 top = vec3(.038, .138, .148);
          vec3 dusk = vec3(.18, .36, .34);
          vec3 gold = vec3(.73, .52, .27);
          vec3 wash = mix(vec3(.32, .48, .43), gold, pow(max(0., dot(d, sunDir)), 9.) * .8);
          vec3 color = mix(wash, dusk, smoothstep(-.015, .27, d.y));
          color = mix(color, top, smoothstep(.11, .78, d.y));
          color += vec3(.58, .335, .115) * exp(-angle * 5.) * .62;
          color += vec3(1., .69, .27) * (1. - smoothstep(.038, .041, angle)) * 1.46;
          float band = exp(-abs(d.y - .075) * 10.5);
          vec2 coord = vec2(atan(d.x, -d.z) * 7. + time * .013, d.y * 30.);
          float wisps = smoothstep(.46, .73, cloud(coord + vec2(3., 2.)));
          color = mix(color, mix(vec3(.43,.55,.48), vec3(.99,.68,.35), exp(-angle * 2.)), wisps * band * .73);
          float lower = 1. - smoothstep(-.33, .015, d.y);
          float sea = cloud(coord + vec2(time * -.008, 18.));
          color = mix(color, mix(vec3(.38,.50,.45), vec3(.69,.73,.56), sea), lower * .87);
          gl_FragColor = vec4(color, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.scale.setScalar(460);
  sky.frustumCulled = false;
  sky.renderOrder = -5;
  scene.add(sky);
  buildDistantIsles(scene);
  return (time, camera) => {
    sky.position.copy(camera.position);
    sky.material.uniforms.time.value = time;
  };
}

function buildDistantIsles(scene) {
  const random = randomStream(3435);
  const islands = [
    [-96, 1, -106, 26, 24, 35], [76, 1, -124, 29, 21, 33],
    [-121, 10, -193, 36, 45, 28], [129, 2, -220, 39, 22, 33],
    [43, 3, -171, 18, 17, 20], [-157, -31, 12, 50, 38, 40],
    [95, -37, 40, 48, 30, 27], [-22, -29, 155, 55, 35, 35],
    [-42, -12, -218, 18, 20, 18], [157, -20, -80, 33, 29, 16],
  ];
  const shade = new THREE.Color('#48645a');
  const cap = new THREE.Color('#5f7659');
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide });
  for (const [x, y, z, width, depth, height] of islands) {
    const points = [];
    const colors = [];
    const indices = [];
    const sides = 11;
    const widths = [.28, 1, .68, .19];
    const heights = [height * .33, 0, -height * .48, -height];
    for (let layer = 0; layer < widths.length; layer++) {
      for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2;
        const radius = widths[layer] * (.72 + random() * .28);
        points.push(x + Math.cos(angle) * width * radius, y + heights[layer] + (random() - .5) * 5, z + Math.sin(angle) * depth * radius);
        const color = (layer === 0 ? cap : shade).clone().multiplyScalar(.69 + random() * .32);
        colors.push(color.r, color.g, color.b);
        const here = layer * sides + side;
        const next = layer * sides + (side + 1) % sides;
        if (layer) indices.push(here, next, here - sides, next, next - sides, here - sides);
        else if (side > 1) indices.push(0, side, side - 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    scene.add(new THREE.Mesh(geometry, material));
  }
}
