import { landmarks, rim, trails } from './terrain.js';

const icons = {
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="7"/>',
  mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
  compass: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
  up: '<path d="m5 13 7-7 7 7m-7-7v14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

const get = (id) => document.getElementById(id);
export const initialOrbit = { yaw: .075, pitch: .17, distance: 21.5 };
for (const icon of document.querySelectorAll('[data-icon]')) {
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">${icons[icon.dataset.icon]}</svg>`;
}

export function bindControls(canvas, player, onReset, onInteract) {
  const keys = new Set();
  const controlsDialog = get('controls-dialog');
  const mapDialog = get('map-dialog');
  const joystick = get('joystick');
  const marker = joystick.firstElementChild;
  const avatarInput = get('avatar-file');
  const avatarStatus = get('avatar-status');
  const chooseAvatar = get('choose-avatar');
  const restoreAvatar = get('reset-avatar');
  const playingKeys = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR', 'KeyM', 'KeyE']);
  const touch = { x: 0, z: 0 };
  const orbit = { ...initialOrbit };
  let jumps = false;
  let pointer = null;
  let stickPointer = null;
  let pointerX = 0;
  let pointerY = 0;

  const paused = () => controlsDialog.open || mapDialog.open;
  function clearInput() {
    keys.clear();
    jumps = false;
    resetStick();
  }
  function openMap() {
    if (controlsDialog.open) return;
    if (mapDialog.open) {
      mapDialog.close();
      return;
    }
    drawMap(get('island-map'), player.feet);
    clearInput();
    mapDialog.showModal();
  }
  function resetStick() {
    const captured = stickPointer;
    stickPointer = null;
    if (captured !== null && joystick.hasPointerCapture(captured)) joystick.releasePointerCapture(captured);
    marker.style.transform = '';
    touch.x = touch.z = 0;
  }
  function placeStick(event) {
    const rect = joystick.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const divisor = Math.max(29, Math.hypot(x, y));
    touch.x = x / divisor;
    touch.z = y / divisor;
    marker.style.transform = `translate(${touch.x * 26}px, ${touch.z * 26}px)`;
  }

  window.addEventListener('keydown', (event) => {
    if (!playingKeys.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    if ((paused() && event.code !== 'KeyM') || (event.target instanceof HTMLButtonElement && event.code === 'Space')) return;
    event.preventDefault();
    if (event.code === 'KeyM' && !event.repeat) openMap();
    if (paused()) return;
    if (event.code === 'Space' && !event.repeat) jumps = true;
    if (event.code === 'KeyR' && !event.repeat) onReset();
    if (event.code === 'KeyE' && !event.repeat) onInteract();
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 2) return;
    if (pointer !== null) return;
    canvas.focus({ preventScroll: true });
    pointer = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.setPointerCapture(pointer);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointer) return;
    orbit.yaw -= (event.clientX - pointerX) * .006;
    orbit.pitch = Math.max(-.2, Math.min(1.2, orbit.pitch + (event.clientY - pointerY) * .005));
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  canvas.addEventListener('lostpointercapture', (event) => { if (event.pointerId === pointer) pointer = null; });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const amount = event.deltaY * (event.deltaMode === 1 ? 15 : event.deltaMode === 2 ? 350 : 1);
    orbit.distance = Math.max(6, Math.min(38, orbit.distance + amount * .024));
  }, { passive: false });
  joystick.addEventListener('pointerdown', (event) => {
    if (stickPointer !== null) return;
    stickPointer = event.pointerId;
    joystick.setPointerCapture(stickPointer);
    placeStick(event);
  });
  joystick.addEventListener('pointermove', (event) => { if (event.pointerId === stickPointer) placeStick(event); });
  joystick.addEventListener('lostpointercapture', (event) => { if (event.pointerId === stickPointer) resetStick(); });
  get('touch-jump').addEventListener('pointerdown', (event) => {
    event.preventDefault();
    jumps = true;
  });
  get('open-map').addEventListener('click', openMap);
  get('open-controls').addEventListener('click', () => {
    clearInput();
    controlsDialog.showModal();
  });
  for (const dialog of [mapDialog, controlsDialog]) {
    dialog.addEventListener('close', () => canvas.focus({ preventScroll: true, focusVisible: false }));
  }
  get('reset-player').addEventListener('click', () => {
    controlsDialog.close();
    onReset();
  });
  get('interact').addEventListener('click', onInteract);
  chooseAvatar.addEventListener('click', () => avatarInput.click());
  restoreAvatar.addEventListener('click', () => {
    player.restoreAvatar();
    avatarStatus.textContent = 'Default avatar restored.';
    restoreAvatar.disabled = true;
  });
  avatarInput.addEventListener('change', async () => {
    const [file] = avatarInput.files;
    avatarInput.value = '';
    if (!file) return;
    const hadAvatar = !restoreAvatar.disabled;
    chooseAvatar.disabled = restoreAvatar.disabled = true;
    avatarStatus.textContent = 'Loading avatar…';
    try {
      await player.loadAvatar(file);
      avatarStatus.textContent = `Using ${file.name}.`;
      restoreAvatar.disabled = false;
    } catch (error) {
      avatarStatus.textContent = error?.message?.startsWith('Choose') ? error.message : 'This avatar could not be loaded. Choose a valid GLB or glTF.';
      restoreAvatar.disabled = !hadAvatar;
    } finally {
      chooseAvatar.disabled = false;
    }
  });

  return {
    orbit,
    read() {
      const has = (...codes) => Number(codes.some((code) => keys.has(code)));
      const x = paused() ? 0 : touch.x + has('KeyD', 'ArrowRight') - has('KeyA', 'ArrowLeft');
      const z = paused() ? 0 : touch.z + has('KeyS', 'ArrowDown') - has('KeyW', 'ArrowUp');
      const length = Math.max(1, Math.hypot(x, z));
      const jump = jumps && !paused();
      jumps = false;
      return { x: x / length, z: z / length, jump };
    },
  };
}

function drawMap(canvas, position) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const scale = 2.58;
  const view = (x, z) => [width * .5 + x * scale, height * .5 + (z + 8) * scale];
  ctx.fillStyle = '#0f2825';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#638c7440';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 16; x < width; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = 16; y < height; y += 24) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  function outline(size, wave = 0) {
    ctx.beginPath();
    for (let step = 0; step < 90; step++) {
      const angle = step / 90 * Math.PI * 2;
      const point = view(...rim(angle, size + Math.sin(angle * 4 + wave) * wave * .016));
      if (step) ctx.lineTo(...point);
      else ctx.moveTo(...point);
    }
    ctx.closePath();
  }
  outline(1.065);
  ctx.strokeStyle = '#80a29069';
  ctx.stroke();
  outline(1);
  const land = ctx.createLinearGradient(0, 35, width, height);
  land.addColorStop(0, '#53664e');
  land.addColorStop(1, '#2f5a49');
  ctx.fillStyle = land;
  ctx.fill();
  ctx.strokeStyle = '#c1b885';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = '#b9d1a827';
  ctx.lineWidth = 1;
  for (let i = 1; i < 9; i++) {
    outline(1 - i * .073, i * .65);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#efc781';
  ctx.setLineDash([2, 5]);
  ctx.lineWidth = 2.7;
  for (const curve of trails) {
    ctx.beginPath();
    for (const [i, point] of curve.getSpacedPoints(60).entries()) {
      if (i) ctx.lineTo(...view(point.x, point.y));
      else ctx.moveTo(...view(point.x, point.y));
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.textBaseline = 'middle';
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillStyle = '#fff0c9';
  ctx.strokeStyle = '#233c34';
  ctx.lineWidth = 3.5;
  for (const { x, z, short } of landmarks) {
    const [u, v] = view(x, z);
    ctx.beginPath();
    ctx.moveTo(u, v - 6);
    ctx.lineTo(u + 6, v);
    ctx.lineTo(u, v + 6);
    ctx.lineTo(u - 6, v);
    ctx.fill();
    const left = x < 0;
    ctx.textAlign = left ? 'right' : 'left';
    const labelX = u + (left ? -13 : 13);
    ctx.strokeText(short, labelX, v);
    ctx.fillText(short, labelX, v);
  }
  const [x, y] = view(position.x, position.z);
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#e4fff0';
  ctx.strokeStyle = '#133831';
  ctx.stroke();
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillText('N', 43, 32);
  ctx.beginPath();
  ctx.moveTo(43, 43);
  ctx.lineTo(49, 61);
  ctx.lineTo(43, 58);
  ctx.lineTo(37, 61);
  ctx.fill();
}

export function updateLocation(landmark) {
  get('location-name').textContent = landmark?.name ?? 'The Amber Trail';
  get('location-note').textContent = landmark?.note ?? 'Open the map to see the surrounding landmarks.';
}

export function announce(message) {
  const announcement = get('announcement');
  clearTimeout(announce.timer);
  announcement.textContent = message;
  announcement.hidden = false;
  announce.timer = setTimeout(() => { announcement.hidden = true; }, 3500);
}
