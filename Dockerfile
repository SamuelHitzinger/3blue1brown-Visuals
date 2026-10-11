# Build independently of the host's Node/Bun installation.
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY shared/animlib/package.json shared/animlib/package.json
RUN npm ci --no-audit --no-fund
COPY shared/ shared/
COPY backend/ backend/
COPY frontend/app/ frontend/app/
COPY scripts/smoke-release.ts scripts/smoke-release.ts
COPY scripts/container-health.ts scripts/container-health.ts
COPY scripts/smoke-scene-preview.ts scripts/smoke-scene-preview.ts
RUN npm ci --prefix frontend/app --no-audit --no-fund \
    && npm run build && npm run app:build
ARG APP_REVISION
RUN echo "$APP_REVISION" | grep -Eq '^[0-9a-f]{40}$' \
    && printf '%s\n' "$APP_REVISION" > REVISION \
    && mkdir bin && cp -L node_modules/.bin/bun bin/bun \
    && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587 AS runtime
# Bookworm's Mesa 22 lacks Vulkan dynamic indexing required by native WebGPU.
RUN printf '%s\n' 'deb http://deb.debian.org/debian bookworm-backports main' > /etc/apt/sources.list.d/backports.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libstdc++6 libvulkan1 chromium \
    && apt-get install -y --no-install-recommends -t bookworm-backports mesa-vulkan-drivers \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 1001 --create-home app \
    && mkdir -p /data/videos /data/narration /data/agents && chown -R app:app /data
WORKDIR /app
COPY --from=build /app/bin/bun /usr/local/bin/bun
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=build /app/package.json /app/REVISION ./
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/src/ backend/src/
COPY --from=build /app/backend/dist/ backend/dist/
COPY --from=build /app/backend/prompts/ backend/prompts/
COPY --from=build /app/shared/animlib/package.json shared/animlib/package.json
COPY --from=build /app/shared/animlib/dist/ shared/animlib/dist/
COPY --from=build /app/shared/animlib/tools/ shared/animlib/tools/
COPY --from=build /app/shared/animlib/docs/reference.md shared/animlib/docs/reference.md
COPY --from=build /app/shared/animlib/docs/capabilities.md shared/animlib/docs/capabilities.md
COPY --from=build /app/shared/video/ shared/video/
COPY --from=build /app/frontend/site/ frontend/site/
COPY --from=build /app/scripts/ scripts/
ARG APP_REVISION
LABEL org.opencontainers.image.revision=$APP_REVISION
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 APP_REVISION=$APP_REVISION \
    VIDEO_DB_PATH=/data/videos/videos.sqlite NARRATION_DATA_DIR=/data/narration MODEL_ASSET_DIR=/data/videos/models \
    SCENE_PREVIEW_CHROMIUM=/usr/bin/chromium SCENE_PREVIEW_NO_SANDBOX=1
USER app
RUN node shared/animlib/tools/smoke-frames.mjs
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=6 \
    CMD ["bun", "scripts/container-health.ts"]
ENTRYPOINT ["bun"]
CMD ["backend/src/index.ts"]
