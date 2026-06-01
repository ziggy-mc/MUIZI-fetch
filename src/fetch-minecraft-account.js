#!/usr/bin/env node

const { ApiError, fetchAllPublicData } = require("./minecraft-service");

function createRenderUrls(uuid, username) {
  const base = "https://demo.muizi.ziggymc.me";

  return {
    dddrender: `${base}/render/skin/3d/${uuid}`,
    ddrender: `${base}/render/skin/2d/${uuid}`,
    cape: `${base}/render/cape/2d/${uuid}`,
    preview: `${base}/render/skin/preview/${uuid}`,
  };
}

async function main() {
  const input = process.argv[2];

  if (!input) {
    throw new ApiError(
      "Missing input. Usage: node src/fetch-minecraft-account.js <username|uuid>",
      {
        code: "INVALID_INPUT",
        source: "local.validation",
        status: 400,
      }
    );
  }

  const data = await fetchAllPublicData(input.trim());

  const uuid =
    data?.profile?.uuid ||
    data?.uuid ||
    data?.id;

  const username =
    data?.profile?.username ||
    data?.username ||
    data?.name;

  const output = {
    success: true,

    account: {
      username,
      uuid,

      createdAt: data?.account?.createdAt ?? null,
      legacy: data?.account?.legacy ?? false,
      demo: data?.account?.demo ?? false,
    },

    textures: {
      skin: data?.textures?.skin ?? null,
      cape: data?.textures?.cape ?? null,
    },

    render: createRenderUrls(uuid, username),

    services: data?.services ?? {},

    raw: data,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  const payload =
    error instanceof ApiError
      ? {
          success: false,
          error: {
            code: error.code,
            source: error.source,
            status: error.status,
            message: error.message,
          },
        }
      : {
          success: false,
          error: {
            code: "UNEXPECTED",
            source: "local",
            status: null,
            message: error?.message ?? "Unexpected error",
          },
        };

  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});
