# syntax=docker/dockerfile:1
# LiteLLM proxy "worker" — a self-contained container, deployed SEPARATELY from
# the web app. In Dokploy, create a second Application in the same project with:
#   Build Path/context : ./litellm      (or root, with Dockerfile Path ./litellm/Dockerfile)
#   Container Port      : 4000
# Runtime env (Dokploy → Environment): GEMINI_API_KEY, LITELLM_MASTER_KEY.
#
# Uses LiteLLM's official proxy image. `main-stable` is a moving stable tag —
# pin a specific version (e.g. ghcr.io/berriai/litellm:v1.90.2-stable) for prod.
FROM ghcr.io/berriai/litellm:main-stable

# Bake the proxy config (model routing, caching, master-key ref) into the image.
COPY config.yaml /app/config.yaml

EXPOSE 4000

# The image's entrypoint is the litellm proxy; these are its CLI args.
CMD ["--config", "/app/config.yaml", "--port", "4000"]
