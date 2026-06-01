const { createCanvas, loadImage } = require("@napi-rs/canvas");

const WIDTH = 1024;
const HEIGHT = 1024;

const YAW = Math.PI / 12;
const PITCH = -0.18;

const AMBIENT_LIGHT = 1.0;

const LIGHT_DIRECTION = {
  x: 0,
  y: 1,
  z: 0,
};

function normalize(v) {
  const len =
    Math.hypot(v.x, v.y, v.z) || 1;

  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

function clamp(v, min, max) {
  return Math.max(
    min,
    Math.min(max, v),
  );
}

async function loadSkinTexture(
  skinURL,
) {
  try {
    return await loadImage(skinURL);
  } catch {
    const canvas =
      createCanvas(64, 64);

    const ctx =
      canvas.getContext("2d");

    ctx.fillStyle = "#c99a74";

    ctx.fillRect(0, 0, 64, 64);

    return canvas;
  }
}

function rotateX(p, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);

  return {
    x: p.x,
    y:
      p.y * c -
      p.z * s,
    z:
      p.y * s +
      p.z * c,
  };
}

function rotateY(p, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);

  return {
    x:
      p.x * c +
      p.z * s,
    y: p.y,
    z:
      -p.x * s +
      p.z * c,
  };
}

function rotatePoint(p) {
  return rotateX(
    rotateY(p, YAW),
    PITCH,
  );
}

function projectPoint(
  p,
  cx,
  cy,
  scale,
) {
  const r = rotatePoint(p);

  return {
    x: cx + r.x * scale,
    y: cy - r.y * scale,
    z: r.z,
  };
}

function polygonDepth(points) {
  return (
    points.reduce(
      (s, p) => s + p.z,
      0,
    ) / points.length
  );
}

function faceNormal(points) {
  const a = points[0];
  const b = points[1];
  const c = points[2];

  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;

  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;

  return normalize({
    x:
      uy * vz - uz * vy,
    y:
      uz * vx - ux * vz,
    z:
      ux * vy - uy * vx,
  });
}

function getFaceLighting(face) {
  const n =
    faceNormal(face.points);

  const d = Math.max(
    0,
    n.x *
      LIGHT_DIRECTION.x +
      n.y *
        LIGHT_DIRECTION.y +
      n.z *
        LIGHT_DIRECTION.z,
  );

  return clamp(
    AMBIENT_LIGHT * 0.9 +
      d * 0.1,
    0.9,
    1.0,
  );
}

function drawFace(
  ctx,
  image,
  face,
  cx,
  cy,
  scale,
) {
  const p0 = projectPoint(
    face.points[0],
    cx,
    cy,
    scale,
  );

  const p1 = projectPoint(
    face.points[1],
    cx,
    cy,
    scale,
  );

  const p2 = projectPoint(
    face.points[2],
    cx,
    cy,
    scale,
  );

  const sw = face.source.w;
  const sh = face.source.h;

  ctx.save();

  ctx.imageSmoothingEnabled =
    false;

  ctx.transform(
    (p1.x - p0.x) / sw,
    (p1.y - p0.y) / sw,
    (p2.x - p0.x) / sh,
    (p2.y - p0.y) / sh,
    p0.x,
    p0.y,
  );

  ctx.drawImage(
    image,
    face.source.x,
    face.source.y,
    face.source.w,
    face.source.h,
    0,
    0,
    face.source.w,
    face.source.h,
  );

  const light =
    getFaceLighting(face);

  ctx.globalCompositeOperation =
    "source-atop";

  ctx.fillStyle = `rgba(255,255,255,${
    1 - light
  })`;

  ctx.fillRect(
    0,
    0,
    sw,
    sh,
  );

  ctx.restore();
}

function buildBodyBoxes(model) {
  const armHalf =
    model === "slim"
      ? 1.5
      : 2;

  return [
    {
      name: "head",
      x: [-4, 4],
      y: [24, 32],
      z: [-4, 4],
      overlay: 0.5,
    },

    {
      name: "body",
      x: [-4, 4],
      y: [12, 24],
      z: [-2, 2],
      overlay: 0.25,
    },

    {
      name: "rightArm",
      x: [
        -(4 + armHalf * 2),
        -4,
      ],
      y: [12, 24],
      z: [-2, 2],
      overlay: 0.25,
    },

    {
      name: "leftArm",
      x: [
        4,
        4 + armHalf * 2,
      ],
      y: [12, 24],
      z: [-2, 2],
      overlay: 0.25,
    },

    {
      name: "rightLeg",
      x: [-4, 0],
      y: [0, 12],
      z: [-2, 2],
      overlay: 0.25,
    },

    {
      name: "leftLeg",
      x: [0, 4],
      y: [0, 12],
      z: [-2, 2],
      overlay: 0.25,
    },
  ];
}

function getTextureRects(model) {
  const armWidth =
    model === "slim"
      ? 3
      : 4;

  return {
    head: {
      base: {
        front: {
          x: 8,
          y: 8,
          w: 8,
          h: 8,
        },
        back: {
          x: 24,
          y: 8,
          w: 8,
          h: 8,
        },
        right: {
          x: 0,
          y: 8,
          w: 8,
          h: 8,
        },
        left: {
          x: 16,
          y: 8,
          w: 8,
          h: 8,
        },
        top: {
          x: 8,
          y: 0,
          w: 8,
          h: 8,
        },
        bottom: {
          x: 16,
          y: 0,
          w: 8,
          h: 8,
        },
      },

      overlay: {
        front: {
          x: 40,
          y: 8,
          w: 8,
          h: 8,
        },
        back: {
          x: 56,
          y: 8,
          w: 8,
          h: 8,
        },
        right: {
          x: 32,
          y: 8,
          w: 8,
          h: 8,
        },
        left: {
          x: 48,
          y: 8,
          w: 8,
          h: 8,
        },
        top: {
          x: 40,
          y: 0,
          w: 8,
          h: 8,
        },
        bottom: {
          x: 48,
          y: 0,
          w: 8,
          h: 8,
        },
      },
    },

    body: {
      base: {
        front: {
          x: 20,
          y: 20,
          w: 8,
          h: 12,
        },
        back: {
          x: 32,
          y: 20,
          w: 8,
          h: 12,
        },
        right: {
          x: 16,
          y: 20,
          w: 4,
          h: 12,
        },
        left: {
          x: 28,
          y: 20,
          w: 4,
          h: 12,
        },
        top: {
          x: 20,
          y: 16,
          w: 8,
          h: 4,
        },
        bottom: {
          x: 28,
          y: 16,
          w: 8,
          h: 4,
        },
      },

      overlay: {
        front: {
          x: 20,
          y: 36,
          w: 8,
          h: 12,
        },
        back: {
          x: 32,
          y: 36,
          w: 8,
          h: 12,
        },
        right: {
          x: 16,
          y: 36,
          w: 4,
          h: 12,
        },
        left: {
          x: 28,
          y: 36,
          w: 4,
          h: 12,
        },
        top: {
          x: 20,
          y: 32,
          w: 8,
          h: 4,
        },
        bottom: {
          x: 28,
          y: 32,
          w: 8,
          h: 4,
        },
      },
    },

    rightArm: {
      base: {
        front: {
          x: 44,
          y: 20,
          w: armWidth,
          h: 12,
        },
        back: {
          x: 52,
          y: 20,
          w: armWidth,
          h: 12,
        },
        right: {
          x: 40,
          y: 20,
          w: 4,
          h: 12,
        },
        left: {
          x: 48,
          y: 20,
          w: 4,
          h: 12,
        },
        top: {
          x: 44,
          y: 16,
          w: armWidth,
          h: 4,
        },
        bottom: {
          x: 48,
          y: 16,
          w: armWidth,
          h: 4,
        },
      },

      overlay: {
        front: {
          x: 44,
          y: 36,
          w: armWidth,
          h: 12,
        },
        back: {
          x: 52,
          y: 36,
          w: armWidth,
          h: 12,
        },
        right: {
          x: 40,
          y: 36,
          w: 4,
          h: 12,
        },
        left: {
          x: 48,
          y: 36,
          w: 4,
          h: 12,
        },
        top: {
          x: 44,
          y: 32,
          w: armWidth,
          h: 4,
        },
        bottom: {
          x: 48,
          y: 32,
          w: armWidth,
          h: 4,
        },
      },
    },

    leftArm: {
      base: {
        front: {
          x: 36,
          y: 52,
          w: armWidth,
          h: 12,
        },
        back: {
          x: 44,
          y: 52,
          w: armWidth,
          h: 12,
        },
        right: {
          x: 32,
          y: 52,
          w: 4,
          h: 12,
        },
        left: {
          x: 40,
          y: 52,
          w: 4,
          h: 12,
        },
        top: {
          x: 36,
          y: 48,
          w: armWidth,
          h: 4,
        },
        bottom: {
          x: 40,
          y: 48,
          w: armWidth,
          h: 4,
        },
      },

      overlay: {
        front: {
          x: 52,
          y: 52,
          w: armWidth,
          h: 12,
        },
        back: {
          x: 60,
          y: 52,
          w: armWidth,
          h: 12,
        },
        right: {
          x: 48,
          y: 52,
          w: 4,
          h: 12,
        },
        left: {
          x: 56,
          y: 52,
          w: 4,
          h: 12,
        },
        top: {
          x: 52,
          y: 48,
          w: armWidth,
          h: 4,
        },
        bottom: {
          x: 56,
          y: 48,
          w: armWidth,
          h: 4,
        },
      },
    },

    rightLeg: {
      base: {
        front: {
          x: 4,
          y: 20,
          w: 4,
          h: 12,
        },
        back: {
          x: 12,
          y: 20,
          w: 4,
          h: 12,
        },
        right: {
          x: 0,
          y: 20,
          w: 4,
          h: 12,
        },
        left: {
          x: 8,
          y: 20,
          w: 4,
          h: 12,
        },
        top: {
          x: 4,
          y: 16,
          w: 4,
          h: 4,
        },
        bottom: {
          x: 8,
          y: 16,
          w: 4,
          h: 4,
        },
      },

      overlay: {
        front: {
          x: 4,
          y: 36,
          w: 4,
          h: 12,
        },
        back: {
          x: 12,
          y: 36,
          w: 4,
          h: 12,
        },
        right: {
          x: 0,
          y: 36,
          w: 4,
          h: 12,
        },
        left: {
          x: 8,
          y: 36,
          w: 4,
          h: 12,
        },
        top: {
          x: 4,
          y: 32,
          w: 4,
          h: 4,
        },
        bottom: {
          x: 8,
          y: 32,
          w: 4,
          h: 4,
        },
      },
    },

    leftLeg: {
      base: {
        front: {
          x: 20,
          y: 52,
          w: 4,
          h: 12,
        },
        back: {
          x: 28,
          y: 52,
          w: 4,
          h: 12,
        },
        right: {
          x: 16,
          y: 52,
          w: 4,
          h: 12,
        },
        left: {
          x: 24,
          y: 52,
          w: 4,
          h: 12,
        },
        top: {
          x: 20,
          y: 48,
          w: 4,
          h: 4,
        },
        bottom: {
          x: 24,
          y: 48,
          w: 4,
          h: 4,
        },
      },

      overlay: {
        front: {
          x: 4,
          y: 52,
          w: 4,
          h: 12,
        },
        back: {
          x: 12,
          y: 52,
          w: 4,
          h: 12,
        },
        right: {
          x: 0,
          y: 52,
          w: 4,
          h: 12,
        },
        left: {
          x: 8,
          y: 52,
          w: 4,
          h: 12,
        },
        top: {
          x: 4,
          y: 48,
          w: 4,
          h: 4,
        },
        bottom: {
          x: 8,
          y: 48,
          w: 4,
          h: 4,
        },
      },
    },
  };
}

function pushBoxFaces(
  faces,
  box,
  tex,
  expand = 0,
) {
  const [x0, x1] = box.x;
  const [y0, y1] = box.y;
  const [z0, z1] = box.z;

  const c = (x, y, z) => ({
    x,
    y,
    z,
  });

  const ex0 = x0 - expand;
  const ex1 = x1 + expand;

  const ey0 = y0 - expand;
  const ey1 = y1 + expand;

  const ez0 = z0 - expand;
  const ez1 = z1 + expand;

  const add = (
    name,
    pts,
    src,
  ) => {
    faces.push({
      boxName: box.name,
      faceName: name,
      points: pts,
      source: src,
    });
  };

  add(
    "front",
    [
      c(ex0, ey1, ez1),
      c(ex1, ey1, ez1),
      c(ex0, ey0, ez1),
      c(ex1, ey0, ez1),
    ],
    tex.front,
  );

  add(
    "back",
    [
      c(ex1, ey1, ez0),
      c(ex0, ey1, ez0),
      c(ex1, ey0, ez0),
      c(ex0, ey0, ez0),
    ],
    tex.back,
  );

  add(
    "right",
    [
      c(ex1, ey1, ez1),
      c(ex1, ey1, ez0),
      c(ex1, ey0, ez1),
      c(ex1, ey0, ez0),
    ],
    tex.right,
  );

  add(
    "left",
    [
      c(ex0, ey1, ez0),
      c(ex0, ey1, ez1),
      c(ex0, ey0, ez0),
      c(ex0, ey0, ez1),
    ],
    tex.left,
  );

  add(
    "top",
    [
      c(ex0, ey1, ez0),
      c(ex1, ey1, ez0),
      c(ex0, ey1, ez1),
      c(ex1, ey1, ez1),
    ],
    tex.top,
  );

  add(
    "bottom",
    [
      c(ex0, ey0, ez1),
      c(ex1, ey0, ez1),
      c(ex0, ey0, ez0),
      c(ex1, ey0, ez0),
    ],
    tex.bottom,
  );
}

async function renderSkinPreviewPng({
  skinURL,
  model = "classic",
}) {
  const image =
    await loadSkinTexture(
      skinURL,
    );

  const canvas = createCanvas(
    WIDTH,
    HEIGHT,
  );

  const ctx = canvas.getContext("2d");

  ctx.clearRect(
    0,
    0,
    WIDTH,
    HEIGHT,
  );

  const centerX =
    WIDTH / 2;

  const centerY =
    HEIGHT * 0.78;

  const scale = 22;

  const textures =
    getTextureRects(model);

  const faces = [];

  for (const box of buildBodyBoxes(
    model,
  )) {
    pushBoxFaces(
      faces,
      box,
      textures[box.name].base,
      0,
    );

    pushBoxFaces(
      faces,
      box,
      textures[box.name]
        .overlay,
      box.overlay,
    );
  }

  faces.sort(
    (a, b) =>
      polygonDepth(a.points) -
      polygonDepth(b.points),
  );

  for (const face of faces) {
    drawFace(
      ctx,
      image,
      face,
      centerX,
      centerY,
      scale,
    );
  }

  return canvas.encode("png");
}

module.exports = {
  renderSkinPreviewPng,
};
