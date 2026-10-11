# Docker deployment

The app repository owns `.github/workflows/ci.yml`, `Dockerfile`, `compose.yaml`,
and `scripts/*release*`. GitHub Actions builds and tests a Linux x86_64 Docker
image, then uploads that exact image over SSH. No container registry, GitHub
credentials on the VM, or infrastructure repository is required.

## After merging to main

Pull requests run the library, frontend, backend, and deployment configuration
checks. They also build the image and run the container lifecycle test. A push to
`main` runs those checks and deploys the tested image. **Run workflow** on `main`
redeploys it. Other branches do not deploy. Superseded main revisions are skipped;
only one production deployment runs at a time.

The multistage Dockerfile builds the frontend/shared library with Node, then ships
only the backend, built assets, production dependencies, and the lockfile's Bun
runtime in a Debian image. Base images are pinned by digest. Runtime secrets and
local databases are excluded from the Docker build context.

Newly generated scenes pass a mandatory image review before publication. The
runtime also ships Node, native `webgpu`, and Mesa Vulkan drivers for headless
rendering. Vulkan drivers come from Debian's signed `bookworm-backports` repository
([package](https://packages.debian.org/bookworm-backports/mesa-vulkan-drivers));
Bookworm's original Mesa 22 driver lacks dynamic indexing required by native WebGPU.
The image build runs `node shared/animlib/tools/smoke-frames.mjs` as the
application user: both 16:9 and 4:3 must contain real rendered pixels. A missing
adapter or incompatible native dependency fails the build rather than deploying
a server that cannot review scenes. Local development needs Node and a compatible
WebGPU adapter; the same smoke command checks it without model calls.

The lifecycle test uses a unique Compose project, temporary data directories, and
an automatically allocated **loopback-only** port. It checks compilation, routes,
built assets, identity headers, owner isolation, stored video/WAV audio, literal
environment values, a non-root process, a read-only app filesystem, clean shutdown,
stop/start with an unfinished job, crash recovery, and removal/recreation with
persistent SQLite, narration, and agent files. It imports Pi under Bun without
external inference, ElevenLabs calls, or production data.

The VM must have Docker Engine running and enabled at boot, **Docker Compose
2.30.0 or newer**, SSH, Bash, tar, curl, Python 3, and flock. The existing `deploy`
user needs passwordless sudo; it does not need Docker group membership or Node.
On the inspected `team-11` VM (Ubuntu 26.04), Docker Engine 29.9.0 and Compose
5.6.0 were already installed, and Docker was enabled at boot.

## Activation and rollback

SSH uploads `release.tar.gz`, its checksum, and `scripts/deploy-release.sh`. The
archive contains the saved Docker image, Compose file, revision, and validation
scripts. The VM loads the image, verifies its revision label, and repeats the
isolated container lifecycle test **before stopping production**.

The first Docker activation stops the old `3yellow3white` systemd service, starts
the `3yellow3white` Compose project on `0.0.0.0:8080`, waits for Docker health, and
verifies `/healthz` reports the expected commit. Only after that does it disable
the old app unit at boot and atomically update
`/srv/apps/3yellow3white-actions/docker-current`. Docker's `unless-stopped`
restart policy handles crashes and reboot recovery. The old systemd unit and its
release are retained for recovery.

Later deployments replace the Compose container after the candidate passes.
If activation fails, the script removes the failed container and starts the
previous Docker release; during first migration it restarts the old systemd
service instead. This switch has a short interruption. There is only one writer
for each database/narration directory. Rollback restores application code and
configuration; it does not undo database changes.
If the failed container cannot be removed, rollback retains its recovery files
and leaves the previous application stopped (and legacy systemd disabled at boot)
to prevent competing database writers.

The public address remains <https://11.hackathon.ethz.ch>. VISCon handles TLS and
access control and forwards to VM port 8080. Deployment does not install a new
reverse proxy or change SSH settings. Docker publishes the same application port.

## GitHub configuration

The existing repository configuration is reused:

- Secret `VM_SSH_PRIVATE_KEY`: dedicated deployment private key.
- Secret `VM_SSH_KNOWN_HOSTS`: verified VM host-key line.
- Secret `ELEVENLABS_API_KEY`: demo account key with text-to-speech access.
- Variable `VM_HOST`: `11-direct.viscon-hackathon.ch`.
- Variable `VM_SSH_USER`: `deploy`.

The matching public key belongs in `/home/deploy/.ssh/authorized_keys` with the
`restrict` prefix. The workflow uses the GitHub `production` environment and is
limited to `main`. No new registry credentials are needed.

## Runtime configuration and storage

Settings are read from `/srv/apps/3yellow3white/.env`, then
`/etc/3yellow3white/environment` (later values win). GitHub Actions supplies a
private `deployment.env` beside the uploaded archive; its values take precedence
over both VM files. It contains the GitHub ElevenLabs key and the workflow's public
voice, model, and origin settings. Secrets are supplied during deployment, outside
the Docker image and uploaded build artifact. Missing secrets stop deployment
before production is replaced. Temporary runner/upload copies are removed by
workflow cleanup; each release retains its mode-600 runtime file for restart and rollback.
Use one `KEY=value` per line;
whole values can be single/double quoted. Root-owned files are read through sudo
without logging their values. Shell commands and `$` references are
never executed/interpolated; single-line backslash escapes follow systemd's
EnvironmentFile rules. Multiline values are rejected before activation. Each release
stores a translated `runtime.env` with mode 600 in its mode-700 directory.
Compose uses `format: raw` so literal dollars and quotes survive. Managed
`NODE_ENV`, `HOST`, `PORT`, `APP_REVISION`, storage paths, and
`NARRATION_ALLOW_LOCAL=0` override runtime-file values.

The container runs as the host `deploy` UID/GID with its application filesystem
read-only, capabilities dropped, and a small writable `/tmp`. Bind mounts retain
host ownership and persist across replacement:

- SQLite: `/srv/apps/3yellow3white-actions/data/videos.sqlite` by default, mounted
  with its whole directory (including WAL/SHM files). An existing absolute
  `VIDEO_DB_PATH` in the runtime files is honored by mounting its parent.
- Model GLBs: `/data/videos/models` inside the container, using the same video
  bind mount. `MODEL_ASSET_DIR` is set by Compose; no additional host directory
  or mount is needed. Model files remain shared when individual videos are deleted.
- Narration: `/var/lib/3yellow3white/narration` by default, or the existing absolute
  `NARRATION_DATA_DIR`. Mounted at `/data/narration` inside the container.
- Pi: `/srv/apps/3yellow3white-actions/agents` by default, or absolute
  `AGENT_STATE_DIR`. Mounted at `/data/agents`, holding private credentials in
  `pi/` and generated scripts/scenes in `jobs/`. New directories use mode 700.
  See [agent login, API-key switching, and remote disconnect](agents.md).

The three data directories must be separate, without nesting. Paths must be outside release directories and use letters, numbers, `/`, `_`,
`.`, or `-`. Missing data directories are created for `deploy`; existing directory
ownership is not changed. Configured paths should match those used by the old
service before migration.

The workflow sets `NARRATION_PUBLIC_ORIGIN=https://11.hackathon.ethz.ch` for both
video and narration origin validation behind the gateway, and supplies
`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`. Manual deployments can supply
`deployment.env` beside the archive or configure these values in the VM files.
Never run a second writer
or the narration CLI against the active data directory. See [narration](narration.md).

## Build and verify without activating production

On a machine with Docker, Compose >=2.30, and Python 3:

```sh
bash scripts/package-release.sh "$(git rev-parse HEAD)" /tmp/aha-release
```

This builds the image and runs the isolated lifecycle test. Transfer
`release.tar.gz`, `release.sha256`, and `scripts/deploy-release.sh` to a temporary
VM directory using the deployment key. From that directory, as `deploy`:

```sh
sha256sum --check release.sha256
bash deploy-release.sh release.tar.gz COMMIT_SHA --check
```

`--check` loads/tests the image and removes its candidate release directory. It
never stops production or mounts production data. The loaded image is retained.
Omitting `--check` activates production; only do that when ready to switch.

## Start, stop, inspect, and recover

After Docker migration, run on the VM:

```sh
cd /srv/apps/3yellow3white-actions/docker-current
sudo docker compose -p 3yellow3white --env-file compose.env ps
sudo docker compose -p 3yellow3white --env-file compose.env logs --tail 100
sudo docker compose -p 3yellow3white --env-file compose.env stop
sudo docker compose -p 3yellow3white --env-file compose.env up -d --wait
curl --fail http://127.0.0.1:8080/healthz
```

`stop` leaves the container and data in place and keeps it stopped across reboots.
`down` removes the container/network; the bind-mounted data remains. `up -d --wait`
recreates it. Logs rotate at 10 MB, keeping three files per container.

For a manual Docker rollback, stop the current project, follow its
`previous-docker` link, then run the same `up -d --wait` command with that release's
`compose.env` and update `docker-current` to that release. Verify `/healthz`.

To return to systemd after the first migration, stop/down the Compose project,
then `sudo systemctl enable --now 3yellow3white` and check health. Move
`docker-current` aside before a future migration, because it identifies the
active Docker deployment. Never start both services on port 8080 or against the
same data directories.

The legacy `/srv/apps/3yellow3white-actions/current` pointer is retained. Docker
release directories, previous-release links, and images are retained for recovery;
remove unused ones only after checking current/rollback references. Do not use
`docker system prune` as part of deployment.

## Verification performed

On 2026-10-10, the image and saved-image release passed lifecycle tests on the
actual VM, both as `viscon` with Docker access and as `deploy` through sudo.
The production deployment script passed `--check`. Isolated integration tests
also verified failed first migration → systemd recovery, successful migration,
and failed Docker upgrade → previous healthy container. Test services, containers,
networks, and data were removed. These validation runs did not activate production.
Independent review also checked environment translation against actual systemd
using synthetic escaped values and a private root-owned file, and verified that
failed candidate removal prevents a competing writer and retains recovery files.

The repeatable migration/rollback test is `scripts/test-docker-deployment.py`.
Run it as `deploy`, supplying the archive, its SHA, and an existing legacy Bun
release directory. It creates its own loopback port, temporary unit/project,
and data directories. It uses modified copies of deployment paths/configuration
and injects a container crash after candidate validation; it never stops the
production unit. It requires the legacy Bun release to remain available.
