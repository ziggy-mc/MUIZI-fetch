# MUIZI fetch

Minecraft public-info fetcher web app (Express + frontend form) with Discord webhook delivery and an interactive Minecraft skin viewer.

## Warnings:

Currently entering your UUID in the text box will crash the website.

## Setup

```bash
npm install
cp .env.example .env
```

This is a Node and Express website. It can be ran locally and serverless. It is also built to run cli.

Environment variables:

- `DISCORD_WEBHOOK_URL` (required)
- `DISCORD_WEBHOOK_USERNAME` (optional, used as webhook display name)
- `DISCORD_WEBHOOK_AVATAR_URL` (optional, used as webhook avatar URL)
- `REDIRECT_URI` (optional, defaults to `https://example.com`)
- `PORT` (optional, defaults to `3000`)

If you want the webhook avatar preview to resolve to your deployed site, set `REDIRECT_URI` to the public website URL.

If there is no DISCORD_WEBHOOK_USERNAME || DISCORD_WEBHOOK_AVATAR_URL environment variable present, it will default to the minecraft skin for profile picture and minecraft username for the username of the webhook.

## Run web app

```bash
npm start
```

Open `http://localhost:3000`.

## Viewer routes

- `GET /render/skin/2d/:uuid` redirects to the player's Mojang skin texture.
- `GET /render/skin/3d/:uuid` opens the interactive `skinview3d` viewer.
- `GET /render/skin/preview/:uuid` returns a static PNG render used as the Discord webhook avatar.
- `GET /render/cape/2d/:uuid` redirects to the player's cape texture when present.

## CLI usage

```bash
npm run cli -- <username-or-uuid>
```

Example Output:
```bash
{
  "success": true,
  "account": {
    "uuid": "{uuid}",
    "createdAt": null,
    "legacy": false,
    "demo": false
  },
  "textures": {
    "skin": null,
    "cape": null
  },
  "render": {
    "dddrender": "https://demo.muizi.ziggymc.me/render/skin/3d/{uuid}",
    "ddrender": "https://demo.muizi.ziggymc.me/render/skin/2d/{uuid}",
    "cape": "https://demo.muizi.ziggymc.me/render/cape/2d/{uuid}",
    "preview": "https://demo.muizi.ziggymc.me/render/skin/preview/{uuid}"
  },
  "services": {},
  "raw": {
    "uuid": "{uuid}",
    "currentName": "{username}",
    "nameHistory": [],
    "character": {
      "model": "classic",
      "skinURL": "http://textures.minecraft.net/texture/{skinid}",
      "capeURL": "http://textures.minecraft.net/texture/{capeid}"
    },
    "errors": []
  }
}
```

## Behavior

- Frontend has a username/UUID form with local fake autocomplete (no Mojang calls while typing).
- On submit, frontend disables the form, shows loading spinner, posts to backend, then redirects.
- Backend resolves username to UUID when needed, fetches public Mojang/session data, optionally looks up a Discord user by ID when one is provided, builds sanitized character metadata, sends it to Discord webhook, and returns success/failure + redirect URL.
- The Discord webhook uses the 3D preview render as its avatar when no custom avatar URL is configured, links the Skin field to the interactive 3D viewer.

## Data sources

- `https://api.mojang.com/users/profiles/minecraft/{username}`
- `https://sessionserver.mojang.com/session/minecraft/profile/{uuid}`
- `http://textures.minecraft.net/texture/{uuid}`
