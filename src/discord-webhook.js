require("dotenv").config();
const { ApiError } = require("./minecraft-service");

function toJson(value) {
  return JSON.stringify(value, null, 2);
}

function truncate(value, max = 1000) {
  if (!value) return "N/A";
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function toInlineJson(value) {
  return `\`\`\`json\n${truncate(toJson(value))}\n\`\`\``;
}

function toAbsoluteUrl(baseUrl, path) {
  if (!baseUrl || !path) {
    return null;
  }

  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}

function formatLink(baseUrl, path) {
  const url = toAbsoluteUrl(baseUrl, path);
  if (!url) {
    return "N/A";
  }
  return `[Open](${url})`;
}

function formatNameHistory(nameHistory = []) {
  if (!Array.isArray(nameHistory) || nameHistory.length === 0) {
    return "No previous names";
  }

  return truncate(
    nameHistory
      .map((entry, index) => `${index + 1}. ${entry?.name ?? "Unknown"}`)
      .join("\n")
  );
}

function formatCharacter(character, baseUrl) {
  if (!character) {
    return "N/A";
  }

  return truncate(
    [
      `Model: ${character.model ?? "classic"}`,
      `Skin: ${formatLink(baseUrl, character.skin?.view)}`,
    ].join("\n"),
  );
}

function formatErrors(errors = []) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return "None";
  }

  return truncate(
    errors
      .map(
        (error, index) =>
          `${index + 1}. [${error?.source ?? "unknown"}] ${error?.code ?? "UNKNOWN"} (${error?.status ?? "N/A"}) - ${error?.message ?? "Unknown error"}`
      )
      .join("\n")
  );
}

function buildDiscordPayload(data, options = {}) {
  const baseUrl = options.baseUrl || process.env.REDIRECT_URI || "https://example.com";
  const avatarUrl =
    process.env.DISCORD_WEBHOOK_AVATAR_URL &&
    process.env.DISCORD_WEBHOOK_AVATAR_URL.trim() !== ""
      ? process.env.DISCORD_WEBHOOK_AVATAR_URL
      : `${baseUrl}/render/skin/preview/${data.uuid}?transparent=true`;
  const embeds = [
    {
      title: "Minecraft Lookup Result",
      url: "https://github.com/ziggy-mc/MUIZI",
      color: 0x00aaee,
      fields: [
        {
          name: "UUID",
          value: data.uuid ?? "N/A",
          inline: false,
        },
        {
          name: "Current name",
          value: data.currentName ?? "N/A",
          inline: false,
        },
        {
          name: "Name history",
          value: formatNameHistory(data.nameHistory),
          inline: false,
        },
        {
          name: "Model",
          value: data.character?.model ?? "classic",
          inline: false,
        },
        {
          name: "Skin",
          value: formatLink(baseUrl, `/render/skin/3d/${data.uuid}`),
          inline: false,
        },
      ],
      footer: {
        text: "a MUIZI project.",
      },
    },
  ];

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    embeds.push({
      title: "Mojang API Errors",
      color: 0xff5533,
      fields: [
        {
          name: "Errors",
          value: formatErrors(data.errors),
          inline: false,
        },
      ],
    });
  }

  return {
    content: `Minecraft account lookup completed.`,
    username:
      process.env.DISCORD_WEBHOOK_USERNAME &&
      process.env.DISCORD_WEBHOOK_USERNAME.trim() !== ""
        ? process.env.DISCORD_WEBHOOK_USERNAME.trim()
        : data.currentName,
    avatar_url: avatarUrl,
    embeds,
  };
}

async function sendToDiscordWebhook(webhookUrl, data, options = {}) {
  if (!webhookUrl) {
    throw new ApiError("Missing Discord webhook URL", {
      code: "MISSING_WEBHOOK",
      source: "discord.webhook",
      status: 500,
    });
  }

  let response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDiscordPayload(data, options)),
    });
  } catch {
    throw new ApiError("Failed to send payload to Discord", {
      code: "WEBHOOK_NETWORK_ERROR",
      source: "discord.webhook",
      status: null,
    });
  }

  if (response.status === 429) {
    throw new ApiError("Discord webhook rate limited", {
      code: "RATE_LIMITED",
      source: "discord.webhook",
      status: 429,
    });
  }

  if (!response.ok) {
    throw new ApiError(`Discord webhook failed (${response.status})`, {
      code: "WEBHOOK_FAILED",
      source: "discord.webhook",
      status: response.status,
    });
  }
}

module.exports = {
  sendToDiscordWebhook,
};
