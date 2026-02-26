"use strict";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const WORLD_HEIGHT = 200;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const CHASER_WIDTH = 35;
const CHASER_HEIGHT = 50;
const OBSTACLE_WIDTH = 30;
const OBSTACLE_HEIGHT = 80;
const SHIFT_INTERVAL = 180; // ~3s at 60fps

// Worlds config
const WORLDS = [
    { name: "🌴 Jungle", bg: '#228B22', ground: '#8B4513', player: '#FFD700' },
    { name: "🤖 Cyber City", bg: '#0a0a1a', ground: '#333', player: '#00ffff' },
    { name: "🌋 Lava World", bg: '#8B0000', ground: '#FF4500', player: '#FF1493' },
    { name: "🧊 Ice Planet", bg: '#4169E1', ground: '#ADD8E6', player: '#FFFFFF' },
    { name: "👻 Haunted", bg: '#1a0033', ground: '#4B0082', player: '#FF00FF' }
];

let gameState = 'menu';
let score = 0;
let worldIndex = 0;
let shiftTimer = 0;
let gameTimer = 0;
let speed = 3;
let player = {};
let chaser = {};
let obstacles = [];
let particles = [];
let keys = {};

// Initialize
function init() {
    resetGame();
    setupEvents();
    gameLoop();
}

function resetGame() {
    score = 0;
    worldIndex = 0;
    shiftTimer = 0;
    gameTimer = 0;
    speed = 3;
    player = {
        x: 100, y: canvas.height - WORLD_HEIGHT - PLAYER_HEIGHT,
        vx: 0, vy: 0, width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
        grounded: true, ability: null, abilityTimer: 0
    };
    chaser = {
        x: canvas.width, y: canvas.height - WORLD_HEIGHT - CHASER_HEIGHT,
        vx: -speed * 0.8, width: CHASER_WIDTH, height: CHASER_HEIGHT,
        pattern: [], lastDodge: 0, predict: false
    };
    obstacles = [];
    particles = [];
    updateUI();
}

function setupEvents() {
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (gameState === 'gameover') {
            if (e.code === 'Space') startGame();
        }
    });
    window.addEventListener('keyup', (e) => keys[e.code] = false);
    
    document.getElementById('startBtn').onclick = startGame;
    document.getElementById('restartBtn').onclick = startGame;
    document.getElementById('challengeBtn').onclick = () => {
        gameState = 'challenge';
        resetGame();
        document.getElementById('menu').style.display = 'none';
    };
}

function startGame() {
    gameState = 'playing';
    document.getElementById('menu').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    resetGame();
}

function update() {
    if (gameState !== 'playing') return;

    gameTimer++;
    score = Math.floor(gameTimer / 60 * speed);
    speed += 0.001;
    chaser.vx = -speed * 0.8;
    
    // Player physics
    if (keys['Space'] || keys['ArrowUp']) {
        if (player.grounded) {
            player.vy = -15;
            player.grounded = false;
        }
    }
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= 8;
        chaser.lastDodge = -1;
    }
    if (keys['ArrowRight'] && player.x < canvas.width/2 - player.width) {
        player.x += 8;
        chaser.lastDodge = 1;
    }
    
    // Ability system (Shift key)
    if (keys['ShiftLeft'] && !player.ability) {
        player.ability = 'shadow';
        player.abilityTimer = 180;
    }
    if (player.ability) {
        player.abilityTimer--;
        if (player.abilityTimer <= 0) player.ability = null;
    }
    
    // Gravity
    player.vy += 0.8;
    player.y += player.vy;
    if (player.y >= canvas.height - WORLD_HEIGHT - player.height) {
        player.y = canvas.height - WORLD_HEIGHT - player.height;
        player.vy = 0;
        player.grounded = true;
    }
    
    // Chaser AI - learns patterns
    chaser.pattern.push(player.x > canvas.width/4 ? 1 : -1);
    if (chaser.pattern.length > 10) chaser.pattern.shift();
    if (chaser.lastDodge !== 0 && Math.random() < 0.3) {
        chaser.x += chaser.lastDodge * 20; // Trap player
    }
    chaser.x += chaser.vx;
    if (chaser.x < -chaser.width) chaser.x = canvas.width;
    
    // Obstacles
    if (Math.random() < 0.02 + speed * 0.001) {
        obstacles.push({
            x: canvas.width, y: canvas.height - WORLD_HEIGHT - OBSTACLE_HEIGHT,
            width: OBSTACLE_WIDTH, height: OBSTACLE_HEIGHT, vx: -speed
        });
    }
    obstacles.forEach((obs, i) => {
        obs.x += obs.vx;
        if (obs.x < -obs.width) obstacles.splice(i, 1);
        
        // Collision
        if (rectCollide(player, obs) && !player.ability) gameOver();
    });
    
    // Dimension shift
    shiftTimer++;
    if (shiftTimer > SHIFT_INTERVAL) {
        worldIndex = (worldIndex + 1) % WORLDS.length;
        shiftTimer = 0;
        createShiftEffect();
    }
    
    // Challenge mode end
    if (gameState === 'challenge' && gameTimer > 1800) { // 30s
        gameOver(true);
    }
    
    updateUI();
}

function rectCollide(r1, r2) {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
}

function createShiftEffect() {
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            life: 60
        });
    }
}

function gameOver(won = false) {
    gameState = 'gameover';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'block';
}

function updateUI() {
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('worldName').textContent = WORLDS[worldIndex].name;
}

function draw() {
    ctx.fillStyle = WORLDS[worldIndex].bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Ground dissolve/shift effect
    ctx.fillStyle = WORLDS[worldIndex].ground;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#fff';
    ctx.fillRect(0, canvas.height - WORLD_HEIGHT, canvas.width, WORLD_HEIGHT);
    ctx.shadowBlur = 0;
    
    // Particles
    particles.forEach((p, i) => {
        ctx.save();
        ctx.globalAlpha = p.life / 60;
        ctx.fillStyle = '#0ff';
        ctx.fillRect(p.x, p.y, 4, 4);
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
        ctx.restore();
    });
    
    // Obstacles (low poly neon)
    ctx.shadowBlur = 10;
    obstacles.forEach(obs => {
        ctx.shadowColor = '#ff0';
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    });
    
    // Player (with ability glow)
    ctx.shadowColor = player.ability ? '#00f' : WORLDS[worldIndex].player;
    ctx.shadowBlur = player.ability ? 30 : 15;
    ctx.fillStyle = player.ability ? '#purple' : WORLDS[worldIndex].player;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Chaser (intelligent red glow)
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(chaser.x, chaser.y, chaser.width, chaser.height);
    
    // UI overlay
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Resize handler
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

init();
