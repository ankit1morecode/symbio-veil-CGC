# Deploy VEIL with Vercel, Render, and MongoDB Atlas

This guide explains how to publish the React interface on Vercel and run the simulation service as a long-lived Node.js process on Render. MongoDB Atlas stores the run state and checkpoints. The project can still be run locally without any cloud services. Deployment and account setup must be completed in your own dashboards.

**Current scope:** this is a shared research demonstration, not a private multi-user service. The server has no user authentication or per-user ownership: anyone with access to its API can create, inspect, change, and export runs. CORS and WebSocket origin checks restrict browsers; they are not authentication. Use only synthetic, non-sensitive data until authentication, authorization, isolation, and operational safeguards have been added and tested.

A Vercel-only static deployment of the repository will not run the simulation. The backend maintains an in-memory world, a scheduler, and WebSocket connections. It needs the separate running service described below.

## What you need

- The prepared project changes committed and pushed to your GitHub repository: <https://github.com/ankit1morecode/symbio-veil-CGC>.
- Accounts for [Vercel](https://vercel.com), [Render](https://render.com), and [MongoDB Atlas](https://www.mongodb.com/atlas/database). Sign in and link your GitHub account in the dashboards when prompted.
- A current browser that supports WebGL2 to view the 3D scene.

The hosted architecture is:

```text
Browser → Vercel React site
             ↓ HTTPS API + WSS WebSocket
          Render Node.js simulation → MongoDB Atlas
```

## 1. Create the MongoDB Atlas database

1. Create an Atlas project and cluster and create a database user with a strong password and only the privileges needed by this application.
2. Choose **Connect → Drivers**, copy the Node.js connection URI, replace the username/password placeholders, and specify a database such as `veil`. URL-encode special characters in credentials when required.
3. Keep the completed URI private. You will enter it directly into Render in the next step; do not commit it, put it in a screenshot, or add it to Vercel. You will configure network access after creating the Render service and seeing its outbound ranges.

## 2. Create the Render service

1. In the Render dashboard choose **New → Web Service**. Connect GitHub and select `ankit1morecode/symbio-veil-CGC` and the branch containing the prepared changes.
2. Use these settings:

   | Setting | Value |
   | --- | --- |
   | Runtime | Node |
   | Root directory | Repository root; leave empty if the dashboard treats that as root |
   | Build command | `npm ci` |
   | Start command | `npm start` |
   | Node version | Node `22.22.0`; set `NODE_VERSION` to that value if required. The repository includes `.node-version`. |
   | Health check path | `/api/health` |

3. In **Environment**, add these server-side variables before deploying:

   | Variable | Value | Purpose |
   | --- | --- | --- |
   | `MONGODB_URI` | Your private Atlas connection string, for example `mongodb+srv://…/veil` | Persists saved run state. Enter the real value directly into Render's environment settings. |
   | `REQUIRE_MONGODB` | `true` | Fails startup if the database is missing or unreachable instead of silently using temporary files. |
   | `ALLOWED_ORIGINS` | Your exact Vercel site origin, for example `https://your-project.vercel.app` | Permits the browser site to use the API and WebSocket. Update it after Vercel provides the final domain. |

   A temporary placeholder origin is fine for the first Render deploy because Vercel's final origin is not known yet. Use the real origin in step 4 and redeploy. Separate multiple exact origins with commas; do not add a trailing slash or a URL path. `PORT` is supplied by Render.

4. Select the service plan appropriate for the demo, then create and deploy the service. Save its `https://…onrender.com` URL; do not add a trailing slash.
5. The initial deployment may fail until Atlas permits the service's outbound ranges. Complete step 3 and redeploy, then open `https://YOUR-RENDER-SERVICE.onrender.com/api/health`. A healthy deployment returns JSON containing `status: "ok"` and a MongoDB-connected storage label.

Alternatively, choose **New → Blueprint** in Render and connect the same repository. Its `render.yaml` declares the free web service, Node `22.22.0`, build/start commands, health check and `REQUIRE_MONGODB=true`. Render prompts for the `MONGODB_URI` and `ALLOWED_ORIGINS` values because they are marked `sync: false`; use the values described above, then update the origin after the Vercel deployment. Review the plan and settings in Render before creating the service. See [Render Blueprints](https://render.com/docs/blueprint-spec).

Render's free plan is useful for a demo, but it can spin down after inactivity and its local filesystem is ephemeral. Startup after sleep can take time. Simulations do not continue while the server is stopped, and the app reloads saved runs paused after a restart. MongoDB provides durability for saved state, not a continuously running simulation. See [Render free-service limits](https://render.com/docs/free), [Render WebSockets](https://render.com/docs/websocket), and [Render environment variables](https://render.com/docs/configure-environment-variables).

## 3. Allow Render to connect to MongoDB Atlas

1. Under Atlas **Network Access**, allow the Render service's outbound IP ranges. Find them in the Render service's **Connect → Outbound** panel. Atlas accepts only connections from its IP access list; Render's ranges are generally shared by services in the same region. See [Render outbound IPs](https://render.com/docs/outbound-ip-addresses) and [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/).
2. Redeploy the Render service after Atlas has accepted the access-list change. Check the Render logs and `/api/health` to confirm the service starts with MongoDB connected. If it does not, check the database user, Atlas network access, the connection string, and Render's outbound ranges.

See [Render's Atlas connection guide](https://render.com/docs/connect-to-mongodb-atlas) and [MongoDB troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

## 4. Import the frontend into Vercel

1. In Vercel, select **Add New → Project**, import `ankit1morecode/symbio-veil-CGC`, and select the branch containing the prepared changes.
2. Set the project root to the repository root and use the **Vite** framework preset. The included `vercel.json` declares the preset and build settings. Verify these values:

   | Setting | Value |
   | --- | --- |
   | Install command | `npm ci` |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Node version | Node 22.x (the repository includes `.node-version` with `22.22.0`) |

3. Before deployment, add the frontend environment variable:

   ```text
   VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com
   ```

   Use the Render service's actual HTTPS origin, without `/api`, a path, or a trailing slash. The client constructs `/api/v1/...` and uses a corresponding secure `wss://` WebSocket URL. This value is deliberately public in the frontend bundle: it must never contain a password or other secret. To run locally with the Vite proxy, leave `VITE_API_BASE_URL` unset.
4. Click **Deploy**. Vercel supplies an HTTPS `*.vercel.app` domain. See [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite) and [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build).
5. Return to Render and set `ALLOWED_ORIGINS` to the exact production Vercel origin, for example `https://your-project.vercel.app`. Save and redeploy the Render service. Add exact preview-deployment origins if you intend to use them; a production domain does not automatically allow arbitrary preview domains.
6. If you change `VITE_API_BASE_URL` in Vercel later, trigger a new frontend deployment. Vite substitutes this variable at build time; changing it does not alter existing deployments. [Vercel environment variables](https://vercel.com/docs/environment-variables)

The `VITE_API_BASE_URL` variable only works once the prepared frontend changes are committed, pushed, and included in the deployed branch. Setting it on an older build will not add support by itself.

## 5. Verify the deployment

1. Visit the Render `/api/health` endpoint and verify `status: "ok"` and MongoDB storage.
2. Open your Vercel URL. The dashboard should finish initializing and display two spacecraft. A sleeping free service may take time to wake.
3. Play and pause the simulation, open a spacecraft twin, and inject a compatible fault. Check the event timeline and decision inspector.
4. Run the E1 scenario, inspect the pair and mission outcome, and save/export a checkpoint. Refresh the site and confirm the app reconnects to the backend.
5. In browser developer tools, check that API requests go to the HTTPS Render host and the stream uses WSS. If requests fail, check the actual Vercel origin in `ALLOWED_ORIGINS`, the frontend build's `VITE_API_BASE_URL`, the backend health/logs, and whether the database is reachable.

Keep the backend at **one running instance** for this version. Its active state is held in one Node process. Multiple independent instances do not coordinate active runs or WebSocket clients, even if they connect to the same database.

## Local behavior

When `VITE_API_BASE_URL` is unset, the browser keeps using the same-origin API; `npm run dev` uses Vite's local proxy. Local development can use JSON journals without MongoDB unless `REQUIRE_MONGODB=true` is explicitly set. See the main [README](../README.md) for setup.
