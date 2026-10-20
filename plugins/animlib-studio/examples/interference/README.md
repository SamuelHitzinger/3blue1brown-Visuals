# Live wave interference

Native animlib demo: two radial waves deform a 1,053-vertex mesh (1,976 triangles), with animated grid curves, source markers, and an equal-distance section. The scene contains 45 objects.

Changing source B's phase from zero to π flattens the white section through destructive interference. The surrounding surface keeps moving. Changing B's amplitude breaks cancellation.

## Run the installed plugin

From the repository root, after installing `animlib-studio@animlib-local`:

```powershell
$env:ANIMLIB_STUDIO_HOME = Join-Path (Get-Location) 'data/animlib-studio-demo'
$env:ANIMLIB_STUDIO_PORT = '47839'
$studioServer = Join-Path $env:USERPROFILE '.codex/plugins/cache/animlib-local/animlib-studio/0.1.0/src/server.mjs'
New-Item -ItemType Directory -Force $env:ANIMLIB_STUDIO_HOME | Out-Null
Start-Process -FilePath 'node' -ArgumentList @($studioServer, '--serve') -WindowStyle Hidden
node plugins/animlib-studio/examples/interference/control.mjs create
```

Open the returned `viewerUrl` and wait for the renderer to connect. Keep that server and viewer running. Then:

```powershell
node plugins/animlib-studio/examples/interference/control.mjs build
node plugins/animlib-studio/examples/interference/control.mjs phase 3.141592653589793
node plugins/animlib-studio/examples/interference/control.mjs emphasis
node plugins/animlib-studio/examples/interference/control.mjs clarity
node plugins/animlib-studio/examples/interference/control.mjs proof
```

Additional commands: `amplitude 0.55`, `amplitude 1`, `wavelength 3`, `preview`, `pause`, `resume`, and `status`. `emphasis` switches the displayed equation to A − B for the π-phase demonstration; it is not an automatic phase-dependent label. Rebuild restores the original scene.

Set `ANIMLIB_STUDIO_SERVER` to use another installed server path. Captures, timings, and session data are written under `data/animlib-studio-demo/`. The session URL contains a local access capability; do not publish it.

## Observed timings

Measured on 2026-10-20 through the installed plugin, persistent local server, and native WebGPU viewer:

| Operation | Full MCP round trip | Viewer application |
| --- | ---: | ---: |
| Create native program, preview, and save | 260.8 ms | 163.1 ms |
| Change phase, preview, and save | 66.0 ms | 9.3 ms |
| Change marker and equation properties, save | 53.6 ms | 14.7 ms |
| Change transparency and label positions, save | 54.2 ms | 14.8 ms |

These are individual observed operations, not latency percentiles. They exclude writing the scene source, model generation, MCP startup, and initial connection. They include render submission, not measurement of physical display presentation. No frame-rate claim is made.

Six native verification samples across 5.438 seconds confirmed the equal-distance probe stayed at `[0, 0.07, 2.15]` within `0.00001` while surrounding wave geometry changed.
