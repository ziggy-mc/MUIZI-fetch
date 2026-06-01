class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? null;
    this.source = options.source ?? "local";
    this.code = options.code ?? "UNKNOWN";
  }
}

const UUID_COMPACT_REGEX = /^[0-9a-fA-F]{32}$/;
const UUID_DASHED_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,16}$/;
const ALLOWED_API_HOSTS = new Set([
  "api.mojang.com",
  "sessionserver.mojang.com",
]);

function isUuid(input) {
  return UUID_COMPACT_REGEX.test(input) || UUID_DASHED_REGEX.test(input);
}

function toCompactUuid(uuid) {
  return uuid.replace(/-/g, "").toLowerCase();
}

function toDashedUuid(uuid) {
  const compact = toCompactUuid(uuid);
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

async function fetchJson(url, source) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new ApiError("Invalid remote URL", {
      source,
      code: "INVALID_REMOTE_URL",
      status: null,
    });
  }

  if (parsedUrl.protocol !== "https:" || !ALLOWED_API_HOSTS.has(parsedUrl.hostname)) {
    throw new ApiError("Blocked remote host", {
      source,
      code: "BLOCKED_REMOTE_HOST",
      status: null,
    });
  }

  let response;
  try {
    response = await fetch(parsedUrl.toString(), {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new ApiError("Unable to reach remote API", {
      source,
      code: "NETWORK_ERROR",
      status: null,
    });
  }

  if (response.status === 404 || response.status === 204) {
    throw new ApiError("Resource not found", {
      status: response.status,
      source,
      code: "NOT_FOUND",
    });
  }

  if (response.status === 429) {
    throw new ApiError("Rate limited by remote API", {
      status: response.status,
      source,
      code: "RATE_LIMITED",
    });
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, {
      status: response.status,
      source,
      code: "REQUEST_FAILED",
    });
  }

  return response.json();
}

async function resolveUuidAndName(input) {
  if (!input || !input.trim()) {
    throw new ApiError("Missing UUID or username", {
      code: "MISSING_UUID",
      source: "local.validation",
      status: 400,
    });
  }

  const trimmed = input.trim();
  if (isUuid(trimmed)) {
    return {
      uuid: toCompactUuid(trimmed),
      currentName: null,
      resolvedFrom: "uuid",
    };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    throw new ApiError("Invalid username", {
      code: "INVALID_USERNAME",
      source: "local.validation",
      status: 400,
    });
  }

  const profile = await fetchJson(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(trimmed)}`,
    "mojang.username_to_uuid",
  );

  if (!profile?.id) {
    throw new ApiError("Invalid username", {
      code: "INVALID_USERNAME",
      source: "mojang.username_to_uuid",
      status: 404,
    });
  }

  return {
    uuid: toCompactUuid(profile.id),
    currentName: profile.name ?? null,
    resolvedFrom: "username",
  };
}

function extractCharacterData(properties = []) {
  const texturesProperty = properties.find((item) => item?.name === "textures");
  if (!texturesProperty?.value) {
    return { model: "classic", skinURL: null, capeURL: null };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(texturesProperty.value, "base64").toString("utf8"),
    );
    const textures = decoded?.textures ?? {};
    return {
      model: textures.SKIN?.metadata?.model === "slim" ? "slim" : "classic",
      skinURL: textures.SKIN?.url ?? null,
      capeURL: textures.CAPE?.url ?? null,
    };
  } catch {
    return { model: "classic", skinURL: null, capeURL: null };
  }
}

async function fetchAllPublicData(input) {
  const resolved = await resolveUuidAndName(input);
  const uuid = resolved.uuid;

  const historyPromise = fetchJson(
    `https://api.mojang.com/user/profiles/${uuid}/names`,
    "mojang.uuid_to_name_history",
  ).catch((error) => {
    // Mojang returns 404 when no previous names exist
    if (
      error instanceof ApiError &&
      error.source === "mojang.uuid_to_name_history" &&
      error.status === 404
    ) {
      return [];
    }

    throw error;
  });

  const [historyResult, sessionResult] = await Promise.allSettled([
    historyPromise,
    fetchJson(
      `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`,
      "mojang.session_server",
    ),
  ]);

  const errors = [];

  if (historyResult.status === "rejected") {
    errors.push({
      source: historyResult.reason?.source ?? "mojang.uuid_to_name_history",
      code: historyResult.reason?.code ?? "UNKNOWN",
      status: historyResult.reason?.status ?? null,
      message: historyResult.reason?.message ?? "Failed to fetch name history",
    });
  }

  if (sessionResult.status === "rejected") {
    errors.push({
      source: sessionResult.reason?.source ?? "mojang.session_server",
      code: sessionResult.reason?.code ?? "UNKNOWN",
      status: sessionResult.reason?.status ?? null,
      message: sessionResult.reason?.message ?? "Failed to fetch session profile",
    });
  }

  const nameHistory =
    historyResult.status === "fulfilled"
      ? historyResult.value
      : [];

  const sessionProfile =
    sessionResult.status === "fulfilled"
      ? sessionResult.value
      : { id: uuid, name: null, properties: [] };

  const characterData = extractCharacterData(sessionProfile.properties);

  const currentNameFromHistory =
    nameHistory.length > 0
      ? nameHistory[nameHistory.length - 1]?.name ?? null
      : null;

  return {
    uuid: toDashedUuid(uuid),
    currentName:
      resolved.currentName ??
      sessionProfile.name ??
      currentNameFromHistory,

    nameHistory,
    character: {
      model: characterData.model,
      skinURL: characterData.skinURL,
      capeURL: characterData.capeURL,
    },
    errors,
  };
}

module.exports = {
  ApiError,
  extractCharacterData,
  fetchAllPublicData,
  isUuid,
  toCompactUuid,
  toDashedUuid,
};
