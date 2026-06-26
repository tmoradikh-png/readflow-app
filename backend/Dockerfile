# ReadFlow backend — production image
# Debian-based (not Alpine) so native deps build/run cleanly:
#   sharp, @napi-rs/canvas, tesseract.js, pdfjs-dist
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install deps first (better layer caching). Need build tools for native modules.
COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm ci

# Build TypeScript -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime image ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime libs for @napi-rs/canvas (font/image rendering).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     libfontconfig1 libfreetype6 fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

# Production node_modules only.
COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci --omit=dev \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/dist ./dist

# Render/most hosts inject PORT; the app reads process.env.PORT.
EXPOSE 4000
CMD ["node", "dist/index.js"]
