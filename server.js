require("dotenv").config();

const express = require("express");
const path = require("path");

const { ApiError, fetchAllPublicData } = require("./src/minecraft-service");
const { renderSkinPreviewPng } = require("./src/preview-renderer");
const { sendToDiscordWebhook } = require("./src/discord-webhook");

const app = express();
const port = process.env.PORT || 3000;
const redirectUri =
  process.env.REDIRECT_URI || process.env.REDIRECT_URL || "https://example.com";
const webhookUrl = process.env.DISCORD_WEBHOOK_URL || "";
const webhookUsername = process.env.DISCORD_WEBHOOK_USERNAME || "";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getSiteBaseUrl(req) {
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0].trim() || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function buildSkinViewerPage({ uuid, currentName, model, skinURL, capeURL }) {
  const viewerConfig = {
    model: model === "slim" ? "slim" : "default",
    skinURL,
    capeURL,
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(currentName || uuid)} - 3D Skin Viewer</title>
    <style>
      :root {
        color-scheme: dark;
        --text: #f5f7fa;
        --muted: #9fb0c2;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: radial-gradient(circle at top, #263238 0%, #101418 55%, #07090b 100%);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
      }

      #skin_container {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        display: block;
      }

      .viewer-chrome {
        position: fixed;
        inset: 0;
        pointer-events: none;
      }

      .viewer-title {
        position: absolute;
        top: 20px;
        left: 20px;
        max-width: min(92vw, 680px);
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(10, 14, 18, 0.48);
        backdrop-filter: blur(12px);
        font-size: clamp(0.92rem, 2vw, 1.06rem);
      }

      .viewer-hint {
        position: absolute;
        left: 50%;
        bottom: 20px;
        transform: translateX(-50%);
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(10, 14, 18, 0.42);
        color: var(--muted);
        font-size: clamp(0.8rem, 1.7vw, 0.92rem);
        white-space: nowrap;
      }
    </style>
    <script src="https://unpkg.com/skinview3d@3.4.2/bundles/skinview3d.bundle.js"></script>
  </head>
  <body>
    <canvas id="skin_container"></canvas>
    <div class="viewer-chrome">
      <div class="viewer-title">${escapeHtml(currentName || uuid)}</div>
      <div class="viewer-hint">Drag to rotate, scroll to zoom</div>
    </div>
    <script>
      const viewerConfig = ${JSON.stringify(viewerConfig)};
      const viewer = new skinview3d.SkinViewer({
        canvas: document.getElementById("skin_container"),
        width: window.innerWidth,
        height: window.innerHeight,
        model: viewerConfig.model,
        zoom: 0.95,
        enableControls: true,
        renderPaused: false,
      });

      viewer.controls.enableZoom = true;
      viewer.controls.enablePan = false;
      viewer.globalLight.intensity = 2.8;
      viewer.cameraLight.intensity = 0.9;
      viewer.playerObject.rotation.y = Math.PI / 12;

      function resizeViewer() {
        viewer.width = window.innerWidth;
        viewer.height = window.innerHeight;
      }

      async function initializeViewer() {
        await viewer.loadSkin(viewerConfig.skinURL, {
          model: viewerConfig.model,
        });

        if (viewerConfig.capeURL) {
          await viewer.loadCape(viewerConfig.capeURL);
        }

        viewer.animation = new skinview3d.IdleAnimation();
        resizeViewer();
        window.addEventListener("resize", resizeViewer);
      }

      initializeViewer().catch((error) => {
        console.error(error);
      });
    </script>
  </body>
</html>`;
}

app.get("/api/config", (req, res) => {
  res.json({
    redirectUri,
  });
});

app.get("/render/skin/2d/:uuid", async (req, res) => {
  try {
    const data = await fetchAllPublicData(req.params.uuid);
    const skinURL = data.character?.skinURL;

    if (!skinURL) {
      return res.sendStatus(404);
    }

    return res.redirect(skinURL);
  } catch {
    return res.sendStatus(404);
  }
});

app.get("/render/skin/3d/:uuid", async (req, res) => {
  try {
    const data = await fetchAllPublicData(req.params.uuid);
    const skinURL = data.character?.skinURL;
    const capeURL = data.character?.capeURL;

    if (!skinURL) {
      return res.sendStatus(404);
    }

    return res
      .type("html")
      .send(
        buildSkinViewerPage({
          uuid: data.uuid,
          currentName: data.currentName,
          model: data.character?.model,
          skinURL,
          capeURL,
        }),
      );
  } catch {
    return res.sendStatus(404);
  }
});

app.get("/render/skin/preview/:uuid", async (req, res) => {
  try {
    const data = await fetchAllPublicData(req.params.uuid);
    const skinURL = data.character?.skinURL;
    const transparent = String(req.query.transparent ?? "").toLowerCase() === "true";

    if (!skinURL) {
      return res.status(404).json({
        error: "Missing skin texture",
        message: "This account does not have a public skin texture to render.",
      });
    }

    const previewBuffer = await renderSkinPreviewPng({
      skinURL,
      model: data.character?.model,
      transparent,
    });

    return res.type("image/png").send(previewBuffer);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.code === "NOT_FOUND" ||
        error.code === "INVALID_USERNAME" ||
        error.code === "MISSING_UUID")
    ) {
      return res.sendStatus(404);
    }

    console.error("Preview render failed", error);
    return res.status(500).json({
      error: "Preview render failed",
      message: error?.message ?? "Unknown render failure",
    });
  }
});

app.get("/render/cape/2d/:uuid", async (req, res) => {
  try {
    const data = await fetchAllPublicData(req.params.uuid);
    const capeURL = data.character?.capeURL;

    if (!capeURL) {
      return res.sendStatus(404);
    }

    return res.redirect(capeURL);
  } catch {
    return res.sendStatus(404);
  }
});

app.post("/api/fetch", async (req, res) => {
  const input = (req.body?.input ?? req.body?.username ?? "").trim();

  if (!input) {
    return res.status(400).json({
      success: false,
      redirectUri,
      error: {
        code: "MISSING_UUID",
        source: "local.validation",
        status: 400,
        message: "Missing username or UUID",
      },
    });
  }

  try {
    const data = await fetchAllPublicData(input);
    const baseUrl = getSiteBaseUrl(req);

    await sendToDiscordWebhook(webhookUrl, data, {
      username: webhookUsername,
      baseUrl,
    });

    return res.json({
      success: true,
      redirectUri,
      data,
    });
  } catch (error) {
    const mappedError =
      error instanceof ApiError
        ? {
            code: error.code,
            source: error.source,
            status: error.status,
            message: error.message,
          }
        : {
            code: "UNEXPECTED",
            source: "local",
            status: null,
            message: error?.message ?? "Unexpected server error",
          };

    const statusCode =
      mappedError.code === "INVALID_USERNAME" ||
      mappedError.code === "NOT_FOUND" ||
      mappedError.code === "MISSING_UUID"
        ? 400
        : mappedError.code === "RATE_LIMITED"
          ? 429
          : 502;

    return res.status(statusCode).json({
      success: false,
      redirectUri,
      error: mappedError,
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});