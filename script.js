"use strict";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 3D Projection settings
const ISO_ANGLE = Math.PI / 6;
const ISO_SCALE = 0.75;
const VIEW_Y = 300;
const WORLD_HEIGHT = 250;
const LANE_WIDTH = 120;
const LANES = 3; // Left, center, right like Temple Run

// Player 3D model (Temple Run style runner)
let player = {
    x: 1, // Lane 0=left,1=center,2=right
    y: 0, // Jump height
    rot: 0, // Run animation
    targetLane: 1,
    grounded: true,
    ability: null,
    abilityTimer: 0,
    width: 40, height: 80
};

// Chaser 3D
let chaser = {
    lane: 1,
    y: 0,
    rot: 0,
    pattern: []
};

// Other vars same...
let gameState = 'menu';
let score = 0;
let worldIndex = 0;
let shiftTimer = 0;
let gameTimer = 0;
let speed = 4;
let obstacles = [];
let particles = [];
let keys = {};
let roadSegments = []; // Infinite road

// Worlds same as before...
const WORLDS = [
    { name: "🌴 Jungle", bg: '#228B22', ground: '#8B4513', playerClr: '#FFD700' },
    { name: "🤖 Cyber City", bg: '#0a0a1a', ground: '#333', playerClr: '#00ffff' },
    { name: "🌋 Lava World", bg: '#8B0000', ground: '#FF4500', playerClr: '#FF1493' },
    { name: "🧊 Ice Planet", bg: '#4169E1', ground: '#ADD8E6', playerClr: '#FFFFFF' },
    { name: "👻 Haunted", bg: '#1a0033', ground: '#4B0082', playerClr: '#FF00FF' }
];

// 3D Projection functions
function project3D(x, y, z) {
    const cos = Math.cos(ISO_ANGLE);
    const sin = Math.sin(ISO_ANGLE);
    const px = (x - z) * cos * ISO_SCALE;
    const py = y + (x + z) * sin * ISO_SCALE * 0.5 - VIEW_Y;
    return { x: canvas.width / 2 + px * 50, y: canvas.height / 2 + py };
}

function draw3DBox(x, y, z, w, h, d, color, glowClr = null) {
    const p1 = project3D(x-w/2, y-h/2, z-d/2);
    const p2 = project3D(x+w/2, y-h/2, z-d/2);
    const p3 = project3D(x+w/2, y+h/2, z-d/2);
    const p4 = project3D(x-w/2, y+h/2, z-d/2);
    const p5 = project3D(x-w/2, y-h/2, z+d/2);
    const p6 = project3D(x+w/2, y-h/2, z+d/2);
    const p7 = project3D(x+w/2, y+h/2, z+d/2);
    const p8 = project3D(x-w/2, y+h/2, z+d/2);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p5.x, p5.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.lineTo(p7.x, p7.y);
    ctx.lineTo(p8.x, p8.y);
    ctx.closePath();
    ctx.fillStyle = color + '80';
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.lineTo(p8.x, p8.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p6.x, p6.y);
    ctx.lineTo(p7.x, p7.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

// Draw Temple Run style player
function drawPlayer() {
    const world = WORLDS[worldIndex];
    const px = (player.x - 1) * LANE_WIDTH; // Lane to world x
    const py = player.y;
    const glowClr = player.ability ? '#00ffff' : world.playerClr;

    ctx.shadowColor = glowClr;
    ctx.shadowBlur = player.ability ? 30 : 15;

    // Body
    draw3DBox(px, py + 20, 0, 25, 40, 15, world.playerClr);

    // Head
    draw3DBox(px, py + 55, 8, 20, 20, 18, '#f4d03f');

    // Arms (running animation)
    const armSwing = Math.sin(player.rot * 0.3) * 8;
    draw3DBox(px - 15 + armSwing, py + 25, 10, 12, 25, 8, world.playerClr);
    draw3DBox(px + 15 - armSwing, py + 25, 10, 12, 25, 8, world.playerClr);

    // Legs (running)
    const legSwing = Math.sin(player.rot * 0.4 + Math.PI) * 6;
    draw3DBox(px - 8 + legSwing, py, -5, 10, 25, 12, world.playerClr);
    draw3DBox(px + 8 - legSwing, py, -5, 10, 25, 12, world.playerClr);
}

// Draw Chaser (shadow hunter)
function drawChaser() {
    const cx = (chaser.lane - 1) * LANE_WIDTH;
    ctx.shadowColor = '#ff0040';
    ctx.shadowBlur = 25;
    draw3DBox(cx, chaser.y + 20, 0, 30, 50, 20, '#ff0000');
    // Eyes glow
    const eyeP = project3D(cx, chaser.y + 35, 15);
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(eyeP.x - 5, eyeP.y, 3, 0, Math.PI*2);
    ctx.arc(eyeP.x + 5, eyeP.y, 3, 0, Math.PI*2);
    ctx.fill();
}

// Draw Road (infinite procedural Temple Run style)
function drawRoad() {
    const world = WORLDS[worldIndex];
    const segHeight = 100;
    const segsVisible = 10;
    const baseY = canvas.height / 2 + 100;

    for (let i = 0; i < segsVisible; i++) {
        const segZ = i * 200;
        const proj = project3D(0, 0, segZ);
        const width = LANE_WIDTH * 3 * (1 - segZ / 2000);
        const y = baseY - proj.y * 0.3;

        // Road lines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(canvas.width/2 - width/2, y);
        ctx.lineTo(canvas.width/2 - width/2 + 20 * Math.sin(gameTimer * 0.1 + i), y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(canvas.width/2 + width/2, y);
        ctx.lineTo(canvas.width/2 + width/2 - 20 * Math.sin(gameTimer * 0.1 + i), y);
        ctx.stroke();

        // Ground
        ctx.fillStyle = world.ground;
        ctx.fillRect(canvas.width/2 - width/2, y, width, segHeight);
    }
}

// Update functions (modified for 3D/lanes)
function update() {
    if (gameState !== 'playing') return;

    gameTimer++;
    score = Math.floor(gameTimer * speed / 100);
    speed += 0.002;

    // Player lane movement (Temple Run style swipe)
    if (keys['ArrowLeft'] && player.targetLane > 0) player.targetLane--;
    if (keys['ArrowRight'] && player.targetLane < LANES-1) player.targetLane++;
    player.x = lerp(player.x, player.targetLane, 0.15);

    chaser.pattern.push(player.targetLane);
    if (chaser.pattern.length > 5) chaser.pattern.shift();
    // AI predict average lane
    const avgLane = chaser.pattern.reduce((a,b)=>a+b)/chaser.pattern.length;
    chaser.lane = lerp(chaser.lane, Math.round(avgLane), 0.05);

    // Jump
    if (keys['Space'] && player.grounded) {
        player.y = -30;
        player.grounded = false;
    }
    player.y += 1.5;
    if (player.y >= 0) {
        player.y = 0;
        player.grounded = true;
    }

    // Run animation
    player.rot += 0.4;

    // Ability same...
    if (keys['ShiftLeft'] && !player.ability) {
        player.ability = 'shadow';
        player.abilityTimer = 180;
    }
    if (player.ability) {
        player.abilityTimer--;
        if (player.abilityTimer <= 0) player.ability = null;
    }

    // Obstacles in lanes
    if (Math.random() < 0.015) {
        obstacles.push({
            lane: Math.floor(Math.random() * LANES),
            z: 1000,
            type: 'block'
        });
    }
    obstacles.forEach((obs, i) => {
        obs.z -= speed * 5;
        if (obs.z < 0) {
            obstacles.splice(i, 1);
            return;
        }
        if (Math.abs((obs.lane - player.x)*LANE_WIDTH) < 40 && obs.z < 50 && !player.ability) {
            gameOver();
        }
    });

    // Shift same...
    shiftTimer++;
    if (shiftTimer > 300) {
        worldIndex = (worldIndex + 1) % WORLDS.length;
        shiftTimer = 0;
        createShiftEffect();
    }

    updateUI();
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Draw function updated
function draw() {
    ctx.fillStyle = WORLDS[worldIndex].bg;
    ctx.shadowBlur = 0;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, WORLDS[worldIndex].bg);
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawRoad(); // Infinite 3D road
    obstacles.forEach(obs => {
        const ox = (obs.lane - 1) * LANE_WIDTH;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffaa00';
        draw3DBox(ox, 0, obs.z - 20, 60, 80, 60, '#cc5500');
    });

    drawChaser();
    drawPlayer();

    // Particles same...
    particles.forEach((p, i) => {
        ctx.save();
        ctx.globalAlpha = p.life / 60;
        const pp = project3D(p.x, p.y, p.z);
        ctx.fillStyle = '#0ff';
        ctx.fillRect(pp.x, pp.y, 6, 6);
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
        ctx.restore();
    });

    ctx.shadowBlur = 0;
}

// Rest functions same: init, resetGame, etc.
// Add to createShiftEffect:
function createShiftEffect() {
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: (Math.random()-0.5)*200, y: Math.random()*100-50, z: Math.random()*500,
            vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, vz: -20,
            life: 90
        });
    }
}

// Game loop, events same as before...

init();
