const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const pacmanRadius = 40;
let pacmanX = 300;
let pacmanY = 300;
let pacmanAngle = 0;
let currentRadius = pacmanRadius;
const speed = 5;

let keys = {};
let mouthOpen = true;
let mouthTimer = 0;

let powerMode = false;
let powerTimer = 0;

const pellets = [
  { x: 200, y: 200, r: 10 },
  { x: 600, y: 400, r: 10 },
  { x: 350, y: 800, r: 10 },
  { x: 1300, y: 300, r: 10 },
  { x: 800, y: 900, r: 10 },
  { x: 1300, y: 1300, r: 10 },
];

const eatenCanvas = document.createElement("canvas");
const eatenCtx = eatenCanvas.getContext("2d");

const img = new Image();
img.src = "webpage.png";
img.onload = () => {
  canvas.width = img.width;
  canvas.height = img.height;

  eatenCanvas.width = img.width;
  eatenCanvas.height = img.height;

  gameLoop();
};


function drawPacman() {
  // Wipe out trail *underneath* Pac-Man only (circular region)
  ctx.save();
  ctx.beginPath();
  ctx.arc(pacmanX, pacmanY, currentRadius + 1, 0, 2 * Math.PI);
  ctx.fillStyle = "yellow";
  ctx.fill();
  ctx.strokeStyle = "black";
  ctx.linewidth = 10;
  ctx.stroke();

  mouthTimer++;
  if (mouthTimer % 10 === 0) mouthOpen = !mouthOpen;
  const mouthAngle = mouthOpen ? 0.3 : 0.05;

  ctx.save();
  ctx.translate(pacmanX, pacmanY);
  ctx.rotate(pacmanAngle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, currentRadius, -mouthAngle, mouthAngle, false);
  ctx.closePath();

  ctx.fillStyle = "black";
  ctx.fill();
  ctx.restore();
}



function updatePacmanPosition() {
  if (keys["w"] && !keys["a"] && !keys["d"]) {
    pacmanY -= speed;
    pacmanAngle = -Math.PI / 2;
  }
  if (keys["s"] && !keys["a"] && !keys["d"]) {
    pacmanY += speed;
    pacmanAngle = Math.PI / 2;
  }
  if (keys["a"] && !keys["w"] && !keys["s"]) {
    pacmanX -= speed;
    pacmanAngle = Math.PI;
  }
  if (keys["d"] && !keys["w"] && !keys["s"]) {
    pacmanX += speed;
    pacmanAngle = 0;
  }
  if (keys["w"] && keys["a"]) {
    pacmanY -= speed;
    pacmanX -= speed;
    pacmanAngle = -3*Math.PI / 4;
  } 
  if (keys["w"] && keys["d"]) {
    pacmanY -= speed;
    pacmanX += speed;
    pacmanAngle = -Math.PI / 4;
  }
  if (keys["s"] && keys["a"]) {
    pacmanY += speed;
    pacmanX -= speed;
    pacmanAngle = 3*Math.PI / 4;
  }
  if (keys["s"] && keys["d"]) {
    pacmanY += speed;
    pacmanX += speed;
    pacmanAngle = Math.PI / 4;
  }

  eatenCtx.beginPath();
  eatenCtx.arc(pacmanX, pacmanY, currentRadius, 0, 2 * Math.PI);
  eatenCtx.fillStyle = "black";

  eatenCtx.fill();
}

function drawPellets() {
  for (const p of pellets) {
    ctx.beginPath();
    ctx.fillStyle = "steelblue";
    ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function checkPelletCollision() {
  for (let i = pellets.length - 1; i >= 0; i--) {
    const p = pellets[i];
    const dist = Math.hypot(pacmanX - p.x, pacmanY - p.y);
    if (dist < currentRadius + p.r) {
      pellets.splice(i, 1);
      currentRadius *= 1.5;
    }
  }
}

function gameLoop() {
  ctx.drawImage(img, 0, 0);
  ctx.drawImage(eatenCanvas, 0, 0);

  updatePacmanPosition();

  mouthTimer++;
  if (mouthTimer % 10 === 0) mouthOpen = !mouthOpen;

  checkPelletCollision();

  drawPellets();
  drawPacman();

  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});
