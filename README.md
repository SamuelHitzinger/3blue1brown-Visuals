# Aha!

Turn course material into short, interactive visual lessons. Built for the VISCon
Hackathon with React, Vite, a Bun backend, and the shared animlib animation engine.

## Key features

- **Learn from your material:** upload documents, slides, images, or recordings,
  or paste notes.
- **Organize your studies:** AI groups material into course topics and short lessons.
- **Watch interactive explanations:** generated animations pair with ElevenLabs
  narration and become playable as scenes are ready.
- **Keep a lesson library:** search, bookmark, replay, and archive saved videos.
- **Make it yours:** light and dark themes, fullscreen playback, and seeking.

## Run locally

Requires **Node.js 22.19+** and npm. The pinned Bun runtime is installed by `npm ci`.
Run these commands from the repository root:

```sh
npm ci
npm run backend:dev
```

Open <http://localhost:8080>. The backend serves the checked-in frontend build,
so you can explore the app and sample lessons immediately.

**Enable AI generation:** copy `backend/.env.example` to `backend/.env.local`,
set `ELEVENLABS_API_KEY`, and run `npm run agents:login`. Follow the
[agent setup guide](docs/agents.md#local-setup) for model authentication and local
rendering requirements. AI course planning requires model credentials; narrated
lesson generation also requires ElevenLabs. For a test generator with a test tone,
start with `VIDEO_GENERATOR=simulated npm run backend:dev` (AI planning is unavailable).

**Develop the frontend:** keep the backend running and use a second terminal:

```sh
npm ci --prefix frontend/app
npm run app:dev
```

Open the URL printed by Vite. Run `npm run app:build` to update the frontend served
by the backend.

## Deployment

GitHub Actions tests pull requests and deploys successful updates to `main` over
SSH using Docker Compose. Deployments retain lesson data, narration, and agent
state, with rollback if activation fails.

See the [deployment guide](docs/deployment.md) for server requirements, GitHub
secrets, manual deployment, and recovery. Production sign-in is handled by the
[VISCon reverse proxy](docs/authentication.md).

To run the app directly without watch mode:

```sh
npm run backend:start
```

The server defaults to `0.0.0.0:8080`; configure `HOST` and `PORT` as needed.
