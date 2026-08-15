# syntax=docker/dockerfile:1
# LiteLLM proxy "worker" — a self-contained container. It ships as the `litellm`
# service of the root docker-compose.yml (see DEPLOY-DOKPLOY.md), stays private,
# and the web app reaches it in-stack at http://litellm:4000 on port 4000.
# Runtime env (Dokploy → the Compose app's Environment tab):
#   GEMINI_API_KEY, LITELLM_MASTER_KEY.
#
# Uses LiteLLM's official proxy image. `main-stable` is a moving stable tag —
# pin a specific version (e.g. ghcr.io/berriai/litellm:v1.90.2-stable) for prod.
FROM ghcr.io/berriai/litellm:main-stable

# Bake the proxy config (model routing, caching, master-key ref) into the image.
COPY config.yaml /app/config.yaml

EXPOSE 4000

# The image's entrypoint is the litellm proxy; these are its CLI args.
CMD ["--config", "/app/config.yaml", "--port", "4000"]
