const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#startButton");
const continueButton = document.querySelector("#continueButton");
const controls = document.querySelector(".controls");
const controlButtons = [...document.querySelectorAll("[data-control]")];

const bg = new Image();
bg.src = "assets/talent-driver-bg.svg";
const finalBg = new Image();
finalBg.src = "assets/talent-driver-final.svg";

const base = { w: 390, h: 844 };
const colors = {
  deep: "#050a1c",
  road: "#081126",
  text: "#f3f6ff",
  muted: "rgba(243, 246, 255, 0.68)",
  blue: "#1d6bff",
  blueSoft: "#8eb8ff",
  cyan: "#48caff",
  warning: "#ff6b6b",
};

const blockNames = [
  "Leadership Behaviors",
  "Career tracks",
  "PDP",
  "Talent Review",
  "Internal Talent Marketplace",
  "NextUp list",
  "Rotations",
];

const lanes = [108, 195, 282];
const road = { left: 64, right: 326, top: 104, bottom: 724 };

const world = {
  started: false,
  won: false,
  crashed: false,
  lastTime: 0,
  distance: 0,
  speed: 142,
  targetLane: 1,
  found: new Set(),
  lives: 3,
  score: 0,
  combo: 1,
  invincible: 0,
  label: "",
  labelTimer: 0,
  pausedForBlock: false,
  blockAwaitingContinue: false,
  blockPauseTimer: 0,
  blockPauseName: "",
  blockPauseIndex: 0,
  blockFlyProgress: 0,
  hitShake: 0,
  hazardTimer: 0,
  blockTimer: 0,
  nextBlock: 0,
  blockQueue: [],
  scroll: 0,
};

const car = {
  x: lanes[1],
  y: 640,
  w: 42,
  h: 70,
};

let objects = [];

function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(canvas.width / base.w, 0, 0, canvas.height / base.h, 0, 0);
}

function resetGame() {
  world.started = true;
  world.won = false;
  world.crashed = false;
  world.lastTime = performance.now();
  world.distance = 0;
  world.speed = 142;
  world.targetLane = 1;
  world.found = new Set();
  world.lives = 3;
  world.score = 0;
  world.combo = 1;
  world.invincible = 0;
  world.label = "";
  world.labelTimer = 0;
  world.pausedForBlock = false;
  world.blockAwaitingContinue = false;
  world.blockPauseTimer = 0;
  world.blockPauseName = "";
  world.blockPauseIndex = 0;
  world.blockFlyProgress = 0;
  world.hitShake = 0;
  world.hazardTimer = 1.05;
  world.blockTimer = 5.2;
  world.nextBlock = 0;
  world.blockQueue = blockNames.map((_, index) => index);
  world.scroll = 0;
  car.x = lanes[1];
  objects = [];
  startButton.classList.add("hidden");
  continueButton.classList.add("hidden");
  controls.classList.remove("hidden");
}

function spawnBlock() {
  if (world.blockQueue.length === 0) return;
  const blockIndex = world.blockQueue.shift();
  const safeLane = Math.floor(Math.random() * lanes.length);
  objects.push({
    type: "block",
    index: blockIndex,
    lane: safeLane,
    x: lanes[safeLane],
    y: -64,
    w: 48,
    h: 48,
  });

  if (world.found.size > 0) {
    const obstacleLane = (safeLane + 1 + Math.floor(Math.random() * 2)) % lanes.length;
    objects.push({
      type: "wall",
      lane: obstacleLane,
      x: lanes[obstacleLane],
      y: -260,
      w: 68,
      h: 58,
    });
  }

  world.nextBlock = Math.max(world.nextBlock, blockIndex + 1);
  world.blockTimer = 7.4 + Math.random() * 3.2;
}

function spawnHazard() {
  const openLane = Math.floor(Math.random() * lanes.length);
  const isGate = world.found.size > 1 && Math.random() < 0.58;
  const blockedLanes = isGate
    ? lanes.map((_, index) => index).filter((index) => index !== openLane)
    : [Math.floor(Math.random() * lanes.length)];

  blockedLanes.forEach((lane, index) => {
    objects.push({
      type: "wall",
      lane,
      x: lanes[lane],
      y: -92 - index * 34,
      w: 68,
      h: 58,
      scored: false,
    });
  });

  const pace = Math.max(1.05, 1.85 - world.found.size * 0.09 - world.score / 9000);
  world.hazardTimer = pace + Math.random() * 0.7;
}

function update(dt) {
  if (!world.started || world.won || world.crashed) return;

  if (world.pausedForBlock) {
    if (world.blockAwaitingContinue) return;
    world.blockPauseTimer = Math.max(0, world.blockPauseTimer - dt);
    const flyStart = 0.8;
    if (world.blockPauseTimer < flyStart) {
      world.blockFlyProgress = Math.min(1, (flyStart - world.blockPauseTimer) / flyStart);
    }
    if (world.blockPauseTimer <= 0) {
      world.pausedForBlock = false;
      world.blockAwaitingContinue = false;
      world.blockFlyProgress = 0;
      continueButton.classList.add("hidden");
    }
    return;
  }

  world.distance += world.speed * dt;
  world.scroll = (world.scroll + world.speed * dt) % 92;
  world.speed = Math.min(236, world.speed + dt * (3.1 + world.found.size * 0.25));
  world.labelTimer = Math.max(0, world.labelTimer - dt);
  world.hitShake = Math.max(0, world.hitShake - dt);
  world.invincible = Math.max(0, world.invincible - dt);
  world.hazardTimer -= dt;
  world.blockTimer -= dt;

  if (world.hazardTimer <= 0) spawnHazard();
  if (world.blockTimer <= 0) spawnBlock();

  const targetX = lanes[world.targetLane];
  car.x += (targetX - car.x) * Math.min(1, dt * 12);

  for (const object of objects) object.y += world.speed * dt;
  for (const object of objects) {
    if (
      object.type === "block" &&
      !object.taken &&
      object.y > base.h + 48 &&
      !world.found.has(object.index) &&
      !world.blockQueue.includes(object.index)
    ) {
      world.blockQueue.unshift(object.index);
      world.blockTimer = Math.min(world.blockTimer, 4.8);
    }
  }
  objects = objects.filter((object) => object.y < base.h + 70);

  for (const object of objects) {
    if (object.type !== "wall" || object.scored || object.taken) continue;
    if (object.y > car.y + car.h / 2) {
      object.scored = true;
      world.score += 8 * world.combo;
    }
  }

  const carBox = { x: car.x - car.w / 2, y: car.y - car.h / 2, w: car.w, h: car.h };
  for (const object of objects) {
    if (object.taken) continue;
    const box = { x: object.x - object.w / 2, y: object.y - object.h / 2, w: object.w, h: object.h };
    if (!rectsOverlap(carBox, box)) continue;

    object.taken = true;
    if (object.type === "block") {
      world.found.add(object.index);
      world.score += 120 + world.combo * 30;
      world.combo = Math.min(9, world.combo + 1);
      world.label = blockNames[object.index];
      world.labelTimer = 0;
      world.pausedForBlock = true;
      world.blockAwaitingContinue = true;
      world.blockPauseTimer = 0;
      world.blockPauseName = blockNames[object.index];
      world.blockPauseIndex = object.index;
      world.blockFlyProgress = 0;
      continueButton.classList.remove("hidden");
      if (world.found.size === blockNames.length) {
      }
    } else {
      if (world.invincible > 0) continue;
      world.lives -= 1;
      world.combo = 1;
      world.invincible = 1.1;
      world.speed = Math.max(128, world.speed - 34);
      world.label = "\u0423\u0414\u0410\u0420 \u041E \u0421\u0422\u0415\u041D\u0423";
      world.labelTimer = 0.8;
      world.hitShake = 0.38;
      car.x = lanes[world.targetLane] + (Math.random() > 0.5 ? 8 : -8);
      if (world.lives <= 0) {
        world.crashed = true;
        startButton.textContent = "\u0415\u0429\u0401 \u0420\u0410\u0417";
        startButton.classList.remove("hidden");
      }
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function draw() {
  ctx.save();
  if (world.hitShake > 0) {
    const shake = Math.sin(performance.now() / 24) * world.hitShake * 14;
    ctx.translate(shake, 0);
  }
  if (!world.started) {
    drawIntro();
  } else {
    drawBackground();
    drawRoad();
    drawObjects();
    drawCar();
    drawHud();
    drawLabel();
    drawEndState();
    drawBlockPause();
  }
  ctx.restore();
}

function drawBackground() {
  ctx.fillStyle = colors.deep;
  ctx.fillRect(0, 0, base.w, base.h);
  if (bg.complete && bg.naturalWidth) {
    const h = base.h;
    const w = h * (bg.naturalWidth / bg.naturalHeight);
    ctx.save();
    ctx.globalAlpha = world.pausedForBlock ? 0 : 0.34;
    ctx.drawImage(bg, -210, 0, w, h);
    ctx.restore();
  }
  const gradient = ctx.createRadialGradient(310, 130, 20, 310, 130, 360);
  gradient.addColorStop(0, "rgba(72, 202, 255, 0.18)");
  gradient.addColorStop(1, "rgba(5, 10, 28, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, base.w, base.h);
}

function drawRoad() {
  ctx.save();
  ctx.fillStyle = "rgba(8, 17, 38, 0.8)";
  roundRect(road.left, road.top, road.right - road.left, road.bottom - road.top, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(206, 222, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(72, 202, 255, 0.36)";
  ctx.lineWidth = 2;
  for (let i = 1; i < lanes.length; i += 1) {
    const x = (lanes[i - 1] + lanes[i]) / 2;
    for (let y = road.top - 90 + world.scroll; y < road.bottom; y += 92) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 40);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = "rgba(72, 202, 255, 0.42)";
  ctx.beginPath();
  ctx.moveTo(road.left + 18, road.top);
  ctx.lineTo(road.left + 18, road.bottom);
  ctx.moveTo(road.right - 18, road.top);
  ctx.lineTo(road.right - 18, road.bottom);
  ctx.stroke();
  ctx.restore();
}

function drawObjects() {
  for (const object of objects) {
    if (object.taken) continue;
    if (object.type === "block") drawBlock(object);
    else drawWall(object);
  }
}

function drawBlock(block) {
  const pulse = 1 + Math.sin(performance.now() / 180 + block.index) * 0.06;
  ctx.save();
  ctx.translate(block.x, block.y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = colors.blue;
  ctx.shadowBlur = 28;
  const glow = ctx.createRadialGradient(-8, -8, 3, 0, 0, 26);
  glow.addColorStop(0, "#dff7ff");
  glow.addColorStop(0.28, colors.cyan);
  glow.addColorStop(0.72, colors.blue);
  glow.addColorStop(1, "rgba(29, 107, 255, 0.28)");
  ctx.fillStyle = glow;
  ctx.strokeStyle = "rgba(184, 232, 255, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(243, 246, 255, 0.95)";
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(4, -3);
  ctx.lineTo(14, 0);
  ctx.lineTo(4, 3);
  ctx.lineTo(0, 13);
  ctx.lineTo(-4, 3);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-4, -3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWall(object) {
  ctx.save();
  ctx.translate(object.x, object.y);
  ctx.shadowColor = "rgba(255, 107, 107, 0.45)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgba(68, 80, 96, 0.96)";
  ctx.strokeStyle = "rgba(243, 246, 255, 0.55)";
  ctx.lineWidth = 3;
  roundRect(-object.w / 2, -object.h / 2, object.w, object.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(5, 10, 28, 0.28)";
  for (let y = -object.h / 2 + 12; y < object.h / 2; y += 16) {
    ctx.fillRect(-object.w / 2 + 8, y, object.w - 16, 4);
  }
  ctx.fillStyle = "rgba(255, 107, 107, 0.9)";
  ctx.beginPath();
  ctx.moveTo(-22, -8);
  ctx.lineTo(0, -28);
  ctx.lineTo(22, -8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCar() {
  ctx.save();
  ctx.translate(car.x, car.y);
  if (world.invincible > 0 && Math.floor(performance.now() / 90) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.shadowColor = "rgba(72, 202, 255, 0.45)";
  ctx.shadowBlur = 20;

  ctx.fillStyle = "#a8c7ff";
  roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 13);
  ctx.fill();
  ctx.fillStyle = "#061027";
  roundRect(-12, -23, 24, 22, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(243, 246, 255, 0.88)";
  ctx.fillRect(-15, -35, 30, 7);
  ctx.fillStyle = colors.cyan;
  ctx.fillRect(-17, 24, 10, 9);
  ctx.fillRect(7, 24, 10, 9);
  ctx.fillStyle = "rgba(5, 10, 28, 0.78)";
  ctx.fillRect(-27, -22, 5, 16);
  ctx.fillRect(22, -22, 5, 16);
  ctx.fillRect(-27, 11, 5, 16);
  ctx.fillRect(22, 11, 5, 16);

  const beam = ctx.createLinearGradient(0, -36, 0, -175);
  beam.addColorStop(0, "rgba(72, 202, 255, 0.25)");
  beam.addColorStop(1, "rgba(72, 202, 255, 0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(-23, -34);
  ctx.lineTo(0, -190);
  ctx.lineTo(23, -34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(5, 10, 28, 0.72)";
  roundRect(16, 18, 358, 74, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(206, 222, 255, 0.16)";
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = "700 18px Inter, Arial, sans-serif";
  ctx.fillText("Talent Driver", 32, 46);
  ctx.fillStyle = colors.muted;
  ctx.font = "500 12px Inter, Arial, sans-serif";
  ctx.fillText(`SCORE ${String(world.score).padStart(4, "0")}`, 32, 68);
  drawHearts(174, 37);
  if (world.combo > 1) {
    ctx.fillStyle = colors.cyan;
    ctx.font = "800 10px Inter, Arial, sans-serif";
    ctx.fillText(`x${world.combo}`, 238, 68);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = colors.blueSoft;
  ctx.font = "800 24px Inter, Arial, sans-serif";
  ctx.fillText(`${world.found.size}/7`, 354, 53);
  ctx.fillStyle = colors.muted;
  ctx.font = "700 10px Inter, Arial, sans-serif";
  ctx.fillText("BLOCKS", 354, 72);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawHearts(x, y) {
  for (let i = 0; i < 3; i += 1) drawHeart(x + i * 22, y, i < world.lives);
}

function drawHeart(x, y, full) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = full ? colors.cyan : "rgba(243, 246, 255, 0.12)";
  ctx.strokeStyle = full ? "#b8e8ff" : "rgba(243, 246, 255, 0.38)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(9, 16);
  ctx.lineTo(2, 9);
  ctx.quadraticCurveTo(-2, 3, 5, 1);
  ctx.quadraticCurveTo(8, 0, 9, 4);
  ctx.quadraticCurveTo(10, 0, 13, 1);
  ctx.quadraticCurveTo(20, 3, 16, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLabel() {
  if (world.labelTimer <= 0) return;
  const alpha = Math.min(1, world.labelTimer / 0.25);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(5, 10, 28, 0.82)";
  roundRect(28, 108, 334, 58, 18);
  ctx.fill();
  ctx.strokeStyle = world.label === "\u0423\u0414\u0410\u0420 \u041E \u0421\u0422\u0415\u041D\u0423" ? "rgba(255, 107, 107, 0.7)" : "rgba(72, 202, 255, 0.48)";
  ctx.stroke();
  ctx.fillStyle = world.label === "\u0423\u0414\u0410\u0420 \u041E \u0421\u0422\u0415\u041D\u0423" ? colors.warning : colors.cyan;
  ctx.font = "800 11px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(world.label === "\u0423\u0414\u0410\u0420 \u041E \u0421\u0422\u0415\u041D\u0423" ? "CRASH" : "BLOCK FOUND", base.w / 2, 130);
  ctx.fillStyle = colors.text;
  ctx.font = "700 15px Inter, Arial, sans-serif";
  ctx.fillText(world.label, base.w / 2, 153);
  ctx.restore();
}

function drawBlockPause() {
  if (!world.pausedForBlock) return;
  const fly = world.blockAwaitingContinue ? 0 : easeOutCubic(world.blockFlyProgress);
  const cardX = lerp(base.w / 2, car.x, fly);
  const cardY = lerp(306, car.y - 36, fly);
  const cardW = lerp(314, 62, fly);
  const cardH = lerp(156, 34, fly);
  const alpha = 1 - Math.max(0, fly - 0.72) / 0.28;

  ctx.save();
  ctx.fillStyle = `rgba(5, 10, 28, ${0.72 * (1 - fly)})`;
  ctx.fillRect(0, 0, base.w, base.h);

  ctx.translate(cardX, cardY);
  ctx.globalAlpha = Math.max(0.08, alpha);
  ctx.fillStyle = "rgba(8, 17, 38, 0.96)";
  ctx.strokeStyle = "rgba(72, 202, 255, 0.72)";
  ctx.lineWidth = 2;
  roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 22);
  ctx.fill();
  ctx.stroke();

  drawPauseBlockIcon(0, -34 * (1 - fly), world.blockPauseIndex, 1 - fly * 0.5);

  ctx.fillStyle = colors.cyan;
  ctx.font = "800 12px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`TDM BLOCK ${world.blockPauseIndex + 1}/7`, 0, 16);
  ctx.fillStyle = colors.text;
  ctx.font = "800 20px Inter, Arial, sans-serif";
  wrapText(world.blockPauseName, 0, 46, 260, 24);

  ctx.restore();
}

function drawPauseBlockIcon(x, y, index, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.shadowColor = colors.blue;
  ctx.shadowBlur = 28;
  const glow = ctx.createRadialGradient(-10, -10, 4, 0, 0, 30);
  glow.addColorStop(0, "#dff7ff");
  glow.addColorStop(0.3, colors.cyan);
  glow.addColorStop(0.72, colors.blue);
  glow.addColorStop(1, "rgba(29, 107, 255, 0.28)");
  ctx.fillStyle = glow;
  ctx.strokeStyle = "rgba(184, 232, 255, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(243, 246, 255, 0.95)";
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(5, -4);
  ctx.lineTo(18, 0);
  ctx.lineTo(5, 4);
  ctx.lineTo(0, 17);
  ctx.lineTo(-5, 4);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-5, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((item, index) => ctx.fillText(item, x, startY + index * lineHeight));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

function drawIntro() {
  if (world.started) return;
  ctx.save();
  ctx.fillStyle = colors.deep;
  ctx.fillRect(0, 0, base.w, base.h);
  const introGlow = ctx.createRadialGradient(290, 214, 20, 290, 214, 340);
  introGlow.addColorStop(0, "rgba(72, 202, 255, 0.18)");
  introGlow.addColorStop(0.44, "rgba(29, 107, 255, 0.06)");
  introGlow.addColorStop(1, "rgba(5, 10, 28, 0)");
  ctx.fillStyle = introGlow;
  ctx.fillRect(0, 0, base.w, base.h);

  if (finalBg.complete && finalBg.naturalWidth) {
    const x = 0;
    const y = 190;
    const w = base.w;
    const h = 154;
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(finalBg, 0, 160, 1280, 250, x, y, w, h);
    const fade = ctx.createLinearGradient(0, y, 0, y + h);
    fade.addColorStop(0, "rgba(5, 10, 28, 0.38)");
    fade.addColorStop(0.42, "rgba(5, 10, 28, 0)");
    fade.addColorStop(1, "rgba(5, 10, 28, 0.5)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  ctx.fillStyle = colors.text;
  ctx.font = "700 42px Inter, Arial, sans-serif";
  ctx.fillText("Talent", 38, 86);
  ctx.font = "700 42px Inter, Arial, sans-serif";
  ctx.fillText("Driver", 38, 138);
  ctx.fillStyle = colors.muted;
  ctx.font = "500 13px Inter, Arial, sans-serif";
  ctx.fillText("\u041F\u043E\u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0439 \u0441\u0435\u0431\u044F \u0437\u0430 \u0440\u0443\u043B\u0451\u043C", 40, 164);
  ctx.fillText("Talent Development Machine", 40, 183);

  ctx.fillStyle = "rgba(8, 17, 38, 0.9)";
  roundRect(28, 390, 334, 224, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(72, 202, 255, 0.24)";
  ctx.stroke();

  ctx.fillStyle = colors.cyan;
  ctx.font = "800 12px Inter, Arial, sans-serif";
  ctx.fillText("MISSION", 52, 424);
  ctx.fillStyle = colors.text;
  ctx.font = "800 27px Inter, Arial, sans-serif";
  ctx.fillText("\u0421\u043E\u0431\u0435\u0440\u0438 7", 52, 462);
  ctx.fillText("TDM-\u0431\u043B\u043E\u043A\u043E\u0432", 52, 496);

  ctx.fillStyle = colors.muted;
  ctx.font = "500 14px Inter, Arial, sans-serif";
  drawRule("\u2190 \u2192", "\u043C\u0435\u043D\u044F\u0439 \u043F\u043E\u043B\u043E\u0441\u0443", 52, 536);
  drawRule("\u25CF", "\u043B\u043E\u0432\u0438 \u0431\u043B\u043E\u043A\u0438 \u0438 \u0441\u0435\u0440\u0438\u044E", 52, 565);
  drawRule("\u25A3", "\u043F\u0440\u043E\u0441\u043A\u0430\u043A\u0438\u0432\u0430\u0439 \u0432 \u0432\u043E\u0440\u043E\u0442\u0430", 52, 594);

  drawMiniRoad(268, 438);
  ctx.restore();
}

function drawRule(mark, text, x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(72, 202, 255, 0.16)";
  roundRect(x, y - 17, 42, 22, 11);
  ctx.fill();
  ctx.fillStyle = mark === "\u25A3" ? colors.warning : colors.cyan;
  ctx.font = "800 12px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(mark, x + 21, y - 2);
  ctx.textAlign = "left";
  ctx.fillStyle = colors.muted;
  ctx.font = "500 14px Inter, Arial, sans-serif";
  ctx.fillText(text, x + 52, y);
  ctx.restore();
}

function drawMiniRoad(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(5, 10, 28, 0.5)";
  roundRect(0, 0, 58, 132, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(72, 202, 255, 0.38)";
  ctx.stroke();
  ctx.strokeStyle = "rgba(72, 202, 255, 0.24)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 16);
  ctx.lineTo(20, 116);
  ctx.moveTo(38, 16);
  ctx.lineTo(38, 116);
  ctx.stroke();
  ctx.fillStyle = colors.blue;
  roundRect(18, 78, 22, 36, 8);
  ctx.fill();
  ctx.fillStyle = colors.cyan;
  ctx.shadowColor = colors.cyan;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(29, 34, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(243, 246, 255, 0.95)";
  ctx.beginPath();
  ctx.moveTo(29, 24);
  ctx.lineTo(33, 33);
  ctx.lineTo(42, 34);
  ctx.lineTo(33, 37);
  ctx.lineTo(29, 46);
  ctx.lineTo(25, 37);
  ctx.lineTo(16, 34);
  ctx.lineTo(25, 31);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEndState() {
  if (!world.won && !world.crashed) return;
  ctx.save();
  ctx.fillStyle = "rgba(5, 10, 28, 0.9)";
  ctx.fillRect(0, 0, base.w, base.h);

  if (world.crashed) {
    ctx.fillStyle = colors.text;
    ctx.font = "800 34px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("\u0415\u0429\u0401 \u0420\u0410\u0417", base.w / 2, 318);
    ctx.fillStyle = colors.muted;
    ctx.font = "400 15px Inter, Arial, sans-serif";
    ctx.fillText("\u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u043C \u0444\u043E\u043A\u0443\u0441 \u0438 \u0435\u0434\u0435\u043C \u0434\u0430\u043B\u044C\u0448\u0435", base.w / 2, 350);
    ctx.restore();
    return;
  }

  drawFinalSlide();
  ctx.textAlign = "center";
  ctx.fillStyle = colors.cyan;
  ctx.font = "800 22px Inter, Arial, sans-serif";
  ctx.fillText("TALENT DRIVER", base.w / 2, 402);
  ctx.fillStyle = colors.text;
  ctx.font = "700 20px Inter, Arial, sans-serif";
  ctx.fillText("activated", base.w / 2, 428);
  ctx.fillStyle = colors.muted;
  ctx.font = "400 14px Inter, Arial, sans-serif";
  ctx.fillText(`score ${world.score}`, base.w / 2, 456);
  drawFoundList();
  ctx.restore();
}

function drawFinalSlide() {
  if (!finalBg.complete || !finalBg.naturalWidth) return;
  const h = 252;
  const w = h * (finalBg.naturalWidth / finalBg.naturalHeight);
  const x = (base.w - w) / 2;
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.drawImage(finalBg, x, 116, w, h);
  const fade = ctx.createLinearGradient(0, 116, 0, 368);
  fade.addColorStop(0, "rgba(5, 10, 28, 0)");
  fade.addColorStop(0.74, "rgba(5, 10, 28, 0.1)");
  fade.addColorStop(1, "rgba(5, 10, 28, 0.86)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 116, base.w, h);
  ctx.restore();
}

function drawFoundList() {
  ctx.textAlign = "left";
  ctx.font = "500 12px Inter, Arial, sans-serif";
  const left = 54;
  const top = 492;
  blockNames.forEach((name, index) => {
    const y = top + index * 21;
    ctx.fillStyle = colors.blue;
    ctx.shadowColor = colors.blue;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(left, y - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.text;
    ctx.fillText(name, left + 18, y);
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loop(time) {
  const dt = Math.min(0.033, (time - world.lastTime) / 1000 || 0);
  world.lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function setControl(control, pressed) {
  if (!pressed) return;
  if (control === "left") world.targetLane = Math.max(0, world.targetLane - 1);
  if (control === "right") world.targetLane = Math.min(lanes.length - 1, world.targetLane + 1);
  document.querySelector(`[data-control="${control}"]`)?.classList.add("pressed");
  window.setTimeout(() => {
    document.querySelector(`[data-control="${control}"]`)?.classList.remove("pressed");
  }, 110);
}

window.addEventListener("resize", fitCanvas);
window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA") setControl("left", true);
  if (event.code === "ArrowRight" || event.code === "KeyD") setControl("right", true);
});

controlButtons.forEach((button) => {
  const control = button.dataset.control;
  button.addEventListener("selectstart", (event) => event.preventDefault());
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("dragstart", (event) => event.preventDefault());
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setControl(control, true);
  });
});

startButton.textContent = "\u041F\u041E\u0415\u0425\u0410\u041B\u0418";
continueButton.textContent = "\u041F\u041E\u0415\u0425\u0410\u041B\u0418 \u0414\u0410\u041B\u042C\u0428\u0415";
startButton.addEventListener("click", resetGame);
continueButton.addEventListener("click", () => {
  if (!world.pausedForBlock) return;
  world.blockAwaitingContinue = false;
  world.blockPauseTimer = 0.8;
  world.blockFlyProgress = 0;
  continueButton.classList.add("hidden");
  if (world.found.size === blockNames.length) {
    window.setTimeout(() => {
      if (world.started && !world.crashed) {
        world.won = true;
        world.pausedForBlock = false;
        startButton.textContent = "\u0415\u0429\u0401 \u0420\u0410\u0417";
        startButton.classList.remove("hidden");
      }
    }, 760);
  }
});

fitCanvas();
world.started = false;
world.lastTime = performance.now();
startButton.textContent = "\u041F\u041E\u0415\u0425\u0410\u041B\u0418";
startButton.classList.remove("hidden");
controls.classList.add("hidden");

if (new URLSearchParams(window.location.search).get("final") === "1") {
  world.started = true;
  world.won = true;
  world.found = new Set(blockNames.map((_, index) => index));
  startButton.textContent = "\u0415\u0429\u0401 \u0420\u0410\u0417";
  startButton.classList.remove("hidden");
  controls.classList.remove("hidden");
}

requestAnimationFrame(loop);
