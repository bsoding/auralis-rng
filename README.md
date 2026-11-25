# Auralis RNG

Explore the Lantern Reach, an original 3D island with a coastal trail, the Broken Cloister, Windglass Grove, and the Meridian Beacon.

## Run locally

Use Node.js 22.12+ and a browser with WebGL 2.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Run `npm run build` to create the static site in `dist/`. The build uses relative asset URLs, so it can be served at a domain root or a repository subpath.

## Controls

| Action | Input |
| --- | --- |
| Move | WASD, arrow keys, or the touch joystick |
| Jump | Space or the touch jump button |
| Orbit and zoom | Drag on the scene and scroll to zoom |
| Open the map | M or the Map button |
| Light the beacon | E near the summit, or the on-screen prompt |
| Return to Wayfarer’s Landing | R or the Settings button |

## Avatars and physics

The default wayfarer is an original animated block character. To use your own asset, open Settings and choose a self-contained `.glb` or `.gltf` with its buffers and textures embedded. [Roblox Studio’s glTF exporter](https://create.roblox.com/docs/art/modeling/gltf-export) exports eligible assets. Models with named idle, walk, and jump clips can play those animations. Avatar imports are read in the browser and last for the current session.

The web version uses [Three.js](https://threejs.org/) for rendering and [Rapier](https://rapier.rs/docs/user_guides/javascript/character_controller/) for collisions. Movement uses the documented Roblox defaults of [16 studs per second and a 7.2-stud jump height](https://create.roblox.com/docs/reference/engine/classes/Humanoid) with [196.2 studs per second squared of gravity](https://create.roblox.com/docs/reference/engine/classes/Workspace#Gravity). Roblox’s platform engine runs in the separately installed [Roblox Player](https://en.help.roblox.com/hc/en-us/articles/204473560-How-to-Install-and-Play-Roblox).
