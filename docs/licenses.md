# Third-party dependencies and asset credits

This inventory identifies the direct dependencies and bundled artwork used by VEIL. Preserve the license notices shipped with installed packages when redistributing the application. Transitive dependencies have their own licenses; the lockfile and installed package notices are the authoritative dependency inventory for a particular build.

## Direct dependencies

| Package | Use | Upstream license |
|---|---|---|
| React / React DOM | Interface components and rendering | MIT |
| Three.js | WebGL scene rendering and geometry | MIT |
| @react-three/fiber | React renderer for Three.js | MIT |
| @react-three/drei | Scene helpers and controls | MIT |
| Framer Motion | Interface transitions | MIT |
| Recharts | Resource/telemetry charts | MIT |
| Lucide React | Interface icons | ISC |
| clsx | Conditional class names | MIT |
| Express | Local HTTP API | MIT |
| cors | Local API origin policy middleware | MIT |
| Mongoose | Optional MongoDB persistence | MIT |
| ws | Local WebSocket state stream | MIT |
| Zod | Runtime data validation | MIT |
| Vite / @vitejs/plugin-react | Development server and frontend build | MIT |
| concurrently | Combined local development startup | MIT |

The package lockfile pins the dependency graph. This document does not grant rights beyond the upstream licenses or replace their notices.

## Bundled assets

Earth day, night and normal textures are stored locally in `src/assets/` for offline runtime. They were sourced from the official Three.js examples asset collection:

| Local file | Upstream source |
|---|---|
| `earth-day.jpg` | [earth_atmos_2048.jpg](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg) |
| `earth-night.png` | [earth_lights_2048.png](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png) |
| `earth-normal.jpg` | [earth_normal_2048.jpg](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg) |

The Three.js project uses the [MIT license](https://github.com/mrdoob/three.js/blob/dev/LICENSE) for its code; this alone is not a claim that every third-party artwork in its examples has identical provenance. The underlying map artwork's provenance has not been independently verified, and no NASA attribution is asserted. Review the original artwork rights before a public or commercial redistribution requiring additional rights clearance. The linked `dev` branch can change; the bundled local files are the assets used by this build.

The spacecraft models, board layouts, selection indicators, orbit traces, atmosphere shader, starfield and VEIL icon are procedural/code-authored schematic visuals in this project. They do not reproduce a flight-certified hardware CAD model. No external spacecraft mesh is required.

## Source documents

The two supplied VEIL dossiers are user-provided project references. They are not bundled as public third-party artwork or claimed as externally licensed code. Their NASA/NIST/SciPy/SPICE source register supports method context and does not convert synthetic parameter choices into calibrated measurements.
