const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const style = document.createElement('style');
style.innerHTML = `
@keyframes requiemAnimation {
    0% {
        transform: scale(0.8);
        opacity: 0.5;
    }
    50% {
        transform: scale(1.2);
        opacity: 1;
    }
    100% {
        transform: scale(1);
        opacity: 0;
    }
}

.requiem-effect {
    animation: requiemAnimation 1s ease-out forwards;
}
`;
document.head.appendChild(style);

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// General configurations
const LANE_COUNT = 3;
const LANE_WIDTH = 200;
const TOTAL_LANES_WIDTH = LANE_COUNT * LANE_WIDTH;
const PLAYER_SIZE = 150; // Increased player size
const OBSTACLE_WIDTH = 130; // Increased obstacle size
const OBSTACLE_HEIGHT = 130; // Increased obstacle size
const BASE_OBSTACLE_SPEED = 5;
const PLAYER_SPEED = 5;

// Game state
let score = 0;
let souls = 0;
let gameOver = false;
let gamePaused = false;
let currentSpeed = BASE_OBSTACLE_SPEED;
let lastSpeedIncrease = 0;
let gameStarted = false;

// Update the ASSETS object to point to your new SVG files
const ASSETS = {
    player: 'images/shadowfiend.png',
    background: 'images/background.svg',
    obstacles: [
        'images/creep.png',
        'images/tinker.png',
        'images/pudge.png'
    ],
    collectibles: [
        'images/soul.png',
        'images/rune.png'
    ],
    sounds: {
        // You can add sounds later
        background: '',
        collect: '',
        collision: '',
        requiem: 'images/requiem.mp3',
        razeClose:  'images/raze.mp3',
        razeMedium: 'images/raze.mp3', 
        razeFar:    'images/raze.mp3' 
    }
};

// Player object
const player = {
    x: (canvas.width - TOTAL_LANES_WIDTH) / 2 + LANE_WIDTH,
    y: canvas.height - 200,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    lane: 1,
    isJumping: false,
    jumpHeight: 0,
    maxJumpHeight: 150,
    jumpSpeed: 7,
    isUltimate: false,
    ultimateDuration: 0,
    ultimateMaxDuration: 300, // 5 seconds at 60fps
    image: new Image()
};

// Create arrays for game elements
const obstacles = [];
const collectibles = [];
const particles = [];
const effects = [];

// Load background image
const backgroundImage = new Image();

// Load obstacle images
const obstacleImages = ASSETS.obstacles.map(src => {
    const img = new Image();
    return img;
});

// Load collectible images
const collectibleImages = ASSETS.collectibles.map(src => {
    const img = new Image();
    return img;
});

// Audio elements
const sounds = {};
Object.entries(ASSETS.sounds).forEach(([key, src]) => {
    // Create empty Audio objects or with src if available
    sounds[key] = src ? new Audio(src) : { play: () => { }, pause: () => { } };
    if (key === 'background' && src) {
        sounds[key].loop = true;
    }
});

// Modified preloadImages function with fallback for missing assets
function preloadImages(callback) {
    let totalImages = 2 + ASSETS.obstacles.length + ASSETS.collectibles.length;
    let loadedImages = 0;
    let failedImages = 0;

    function imageLoaded() {
        loadedImages++;
        checkAllLoaded();
    }

    function imageFailed() {
        failedImages++;
        checkAllLoaded();
    }

    function checkAllLoaded() {
        if (loadedImages + failedImages >= totalImages) {
            console.log(`Images loaded: ${loadedImages}, Failed: ${failedImages}`);
            callback();
        }
    }

    
    // Load player image with fallback
    player.image.onload = imageLoaded;
    player.image.onerror = () => {
        console.log("Failed to load player image. Using fallback.");
        imageFailed();
    };
    player.image.src = ASSETS.player;

    // Load background with fallback
    backgroundImage.onload = imageLoaded;
    backgroundImage.onerror = () => {
        console.log("Failed to load background image. Using fallback.");
        imageFailed();
    };
    backgroundImage.src = ASSETS.background;

    // Load obstacles with fallback
    obstacleImages.forEach((img, index) => {
        img.onload = imageLoaded;
        img.onerror = () => {
            console.log(`Failed to load obstacle image ${index}. Using fallback.`);
            imageFailed();
        };
        img.src = ASSETS.obstacles[index];
    });

    // Load collectibles with fallback
    collectibleImages.forEach((img, index) => {
        img.onload = imageLoaded;
        img.onerror = () => {
            console.log(`Failed to load collectible image ${index}. Using fallback.`);
            imageFailed();
        };
        img.src = ASSETS.collectibles[index];
    });

    // In case no images load at all, ensure the game still starts
    setTimeout(() => {
        if (loadedImages + failedImages === 0) {
            console.log("No images loaded or failed within timeout. Starting game anyway.");
            callback();
        }
    }, 3000);
}

// Drawing functions
function drawBackground() {
    // Create a parallax scrolling effect
    const scrollSpeed = currentSpeed * 0.5;
    const backgroundY = (Date.now() * scrollSpeed * 0.01) % canvas.height;

    // Check if background image is loaded
    if (backgroundImage.complete && backgroundImage.naturalHeight !== 0) {
        ctx.drawImage(backgroundImage, 0, -backgroundY, canvas.width, canvas.height);
        ctx.drawImage(backgroundImage, 0, -backgroundY + canvas.height, canvas.width, canvas.height);
    } else {
        // Fallback background
        ctx.fillStyle = '#333366';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawLanes() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    const startX = (canvas.width - TOTAL_LANES_WIDTH) / 2;

    for (let i = 0; i <= LANE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(startX + i * LANE_WIDTH, 0);
        ctx.lineTo(startX + i * LANE_WIDTH, canvas.height);
        ctx.stroke();
    }
}

function drawPlayer() {
    // Apply jump effect
    let yPos = player.y;
    if (player.isJumping) {
        yPos -= player.jumpHeight;
    }

    // Draw shadow under player
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(
        player.x + player.width / 2,
        player.y + player.height - 5,
        player.width / 2,
        10,
        0, 0, Math.PI * 2
    );
    ctx.fill();

    // Draw player with glow effect if ultimate is active
    if (player.isUltimate) {
        ctx.save();
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 20;

        // Check if player image is loaded
        if (player.image.complete && player.image.naturalHeight !== 0) {
            ctx.drawImage(player.image, player.x, yPos, player.width, player.height);
        } else {
            // Fallback player shape
            ctx.fillStyle = '#ff5500';
            ctx.fillRect(player.x, yPos, player.width, player.height);
        }

        ctx.restore();

        // Draw ultimate particles
        for (let i = 0; i < 2; i++) {
            particles.push({
                x: player.x + Math.random() * player.width,
                y: yPos + Math.random() * player.height,
                size: Math.random() * 5 + 3,
                color: `rgba(255, ${Math.floor(Math.random() * 100)}, 0, ${Math.random() * 0.7 + 0.3})`,
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * 3 + 1,
                life: Math.random() * 30 + 10
            });
        }
    } else {
        // Check if player image is loaded
        if (player.image.complete && player.image.naturalHeight !== 0) {
            ctx.drawImage(player.image, player.x, yPos, player.width, player.height);
        } else {
            // Fallback player shape
            ctx.fillStyle = '#aa3300';
            ctx.fillRect(player.x, yPos, player.width, player.height);
        }
    }
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        const img = obstacleImages[obstacle.type];

        // Check if obstacle image is loaded
        if (img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(img, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        } else {
            // Fallback obstacle shape
            ctx.fillStyle = '#cc0000';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
    });
}

function drawCollectibles() {
    collectibles.forEach(item => {
        const img = collectibleImages[item.type];
        const floatOffset = Math.sin(Date.now() * 0.005 + item.id) * 5;

        ctx.save();
        if (item.type === 0) { // Soul
            ctx.shadowColor = '#44aaff';
            ctx.shadowBlur = 15;
        } else { // Power rune
            ctx.shadowColor = '#ff44aa';
            ctx.shadowBlur = 20;
        }

        // Check if collectible image is loaded
        if (img.complete && img.naturalHeight !== 0) {
            ctx.drawImage(
                img,
                item.x,
                item.y + floatOffset,
                item.width,
                item.height
            );
        } else {
            // Fallback collectible shape
            ctx.fillStyle = item.type === 0 ? '#44aaff' : '#ff44aa';
            ctx.beginPath();
            ctx.arc(
                item.x + item.width / 2,
                item.y + floatOffset + item.height / 2,
                item.width / 2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.restore();
    });
}

function drawParticles() {
    particles.forEach((p, index) => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Update particle
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

function drawEffects() {
    effects.forEach((effect, index) => {
        if (effect.type === 'soulCollect') {
            ctx.fillStyle = `rgba(68, 170, 255, ${effect.life / effect.maxLife})`;
            ctx.font = `${effect.size}px Arial`;
            ctx.fillText('+1', effect.x, effect.y);

            effect.y -= 1;
            effect.life--;

            if (effect.life <= 0) {
                effects.splice(index, 1);
            }
        } else if (effect.type === 'ultimateReady') {
            ctx.fillStyle = `rgba(255, 68, 68, ${effect.life / effect.maxLife})`;
            ctx.font = 'bold 24px Arial';
            ctx.fillText('REQUIEM READY! Press SPACE', canvas.width / 2 - 150, 100);

            effect.life--;

            if (effect.life <= 0) {
                effects.splice(index, 1);
            }
        }
    });
}

function drawHUD() {
    // Score
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 30);

    // Souls collected
    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Souls: ${souls}`, 20, 60);

    // Ultimate meter
    const ultimateMeterWidth = 200;
    const ultimateMeterHeight = 20;
    const ultimateProgress = Math.min(souls / 10, 1); // Require 10 souls for ultimate

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(20, 70, ultimateMeterWidth, ultimateMeterHeight);

    ctx.fillStyle = souls >= 10 ? '#ff4444' : '#aa4444';
    ctx.fillRect(20, 70, ultimateMeterWidth * ultimateProgress, ultimateMeterHeight);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 70, ultimateMeterWidth, ultimateMeterHeight);

    // Ultimate active indicator
    if (player.isUltimate) {
        const ultimateTimeLeft = (player.ultimateDuration / player.ultimateMaxDuration) * 100;
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(20, 100, ultimateTimeLeft * 2, 10);
        ctx.strokeRect(20, 100, 200, 10);
    }
    // Mana bar
    const manaBarWidth = 200;
    const manaBarHeight = 20;
    const manaPercentage = mana / MAX_MANA;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(20, 90, manaBarWidth, manaBarHeight);

    ctx.fillStyle = 'rgba(80, 130, 255, 0.8)';
    ctx.fillRect(20, 90, manaBarWidth * manaPercentage, manaBarHeight);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 90, manaBarWidth, manaBarHeight);

    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.fillText(`Mana: ${Math.floor(mana)}/${MAX_MANA}`, 25, 105);
    // Coil cooldowns
    const cooldownY = 170;
    const cooldownSpacing = 70;

    // Close range coil (Z)
    drawCooldown('Z', cooldowns.close, COIL_COOLDOWNS.close, 20, cooldownY, COIL_COSTS.close, '#5599ff');

    // Medium range coil (X)
    drawCooldown('X', cooldowns.medium, COIL_COOLDOWNS.medium, 20 + cooldownSpacing, cooldownY, COIL_COSTS.medium, '#55aaff');

    // Far range coil (C)
    drawCooldown('C', cooldowns.far, COIL_COOLDOWNS.far, 20 + cooldownSpacing * 2, cooldownY, COIL_COSTS.far, '#55ccff');
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px Arial';
    ctx.fillText('SHADOWFIEND RUNNER', canvas.width / 2 - 250, canvas.height / 2 - 50);

    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText('Press ENTER to start', canvas.width / 2 - 100, canvas.height / 2 + 20);

    ctx.fillText('Controls:', canvas.width / 2 - 200, canvas.height / 2 + 70);
    ctx.fillText('← → : Move between lanes', canvas.width / 2 - 200, canvas.height / 2 + 100);
    ctx.fillText('↑ : Jump', canvas.width / 2 - 200, canvas.height / 2 + 130);
    ctx.fillText('SPACE : Use Requiem (when meter is full)', canvas.width / 2 - 200, canvas.height / 2 + 160);
}

function drawGameOverScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px Arial';
    ctx.fillText('GAME OVER', canvas.width / 2 - 150, canvas.height / 2 - 50);

    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${score}`, canvas.width / 2 - 80, canvas.height / 2 + 20);
    ctx.fillText(`Souls Collected: ${souls}`, canvas.width / 2 - 90, canvas.height / 2 + 60);

    ctx.fillStyle = '#aaffaa';
    ctx.fillText('Press ENTER to play again', canvas.width / 2 - 120, canvas.height / 2 + 120);
}

// Game mechanics functions
function updatePlayer() {
    const startX = (canvas.width - TOTAL_LANES_WIDTH) / 2;
    player.x = startX + player.lane * LANE_WIDTH + (LANE_WIDTH - player.width) / 2;

    // Update cooldowns
    if (cooldowns.close > 0) cooldowns.close--;
    if (cooldowns.medium > 0) cooldowns.medium--;
    if (cooldowns.far > 0) cooldowns.far--;

    // Regenerate mana
    if (mana < MAX_MANA) {
        mana = Math.min(mana + MANA_REGEN_RATE, MAX_MANA);
    }
    // Handle jumping
    if (player.isJumping) {
        if (player.jumpHeight < player.maxJumpHeight && !player.isDescending) {
            player.jumpHeight += player.jumpSpeed;
        } else {
            player.isDescending = true;
            player.jumpHeight -= player.jumpSpeed;

            if (player.jumpHeight <= 0) {
                player.isJumping = false;
                player.isDescending = false;
                player.jumpHeight = 0;
            }
        }
    }

    // Handle ultimate ability
    if (player.isUltimate) {
        player.ultimateDuration--;

        // Add ultimate effect particles
        if (Math.random() < 0.3) {
            const radius = 50 + Math.random() * 50;
            const angle = Math.random() * Math.PI * 2;

            particles.push({
                x: player.x + player.width / 2 + Math.cos(angle) * radius,
                y: player.y - player.jumpHeight + player.height / 2 + Math.sin(angle) * radius,
                size: Math.random() * 4 + 2,
                color: `rgba(255, ${Math.floor(Math.random() * 100)}, 0, ${Math.random() * 0.7 + 0.3})`,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 2 - 1,
                life: Math.random() * 20 + 10
            });
        }

        if (player.ultimateDuration <= 0) {
            player.isUltimate = false;
        }
    }
}
// Mana system
let mana = 250; // Current mana
const MAX_MANA = 291; // Maximum mana
const MANA_REGEN_RATE = 0.2; // Mana regeneration per frame
const COIL_COSTS = {
    close: 50,  // Z - close range
    medium: 50, // X - medium range
    far: 50     // C - far range
};
const COIL_RANGES = {
    close: 50,  // Z - close range in front
    medium: 180, // X - medium range in front
    far: 320     // C - far range in front
};
const COIL_COOLDOWNS = {
    close: 120,  // 2 seconds at 60fps
    medium: 180, // 3 seconds at 60fps
    far: 240     // 4 seconds at 60fps
};
let cooldowns = {
    close: 0,
    medium: 0,
    far: 0
};
const coils = []; // New array for active coils
window.addEventListener('keydown', (e) => {
    if (e.key === 'z' || e.key === 'Z') castCoil('close');
    if (e.key === 'x' || e.key === 'X') castCoil('medium');
    if (e.key === 'c' || e.key === 'C') castCoil('far');
});
function castCoil(range) {
    if (gamePaused || gameOver || !gameStarted) return;

    let type, manaCost, razeDistance, color, sound;

    switch (range) {
        case 'close':
            if (cooldowns.close > 0 || mana < COIL_COSTS.close) return;
            manaCost = COIL_COSTS.close;
            razeDistance = COIL_RANGES.close;
            color = 'hsla(0, 88.80%, 38.40%, 0.80)';
            cooldowns.close = COIL_COOLDOWNS.close;
            type = 'close';
            sound = sounds.razeClose; // Use close Raze sound
            break;
        case 'medium':
            if (cooldowns.medium > 0 || mana < COIL_COSTS.medium) return;
            manaCost = COIL_COSTS.medium;
            razeDistance = COIL_RANGES.medium;
            color = 'hsla(0, 88.80%, 38.40%, 0.80)';
            cooldowns.medium = COIL_COOLDOWNS.medium;
            type = 'medium';
            sound = sounds.razeMedium; // Use medium Raze sound
            break;
        case 'far':
            if (cooldowns.far > 0 || mana < COIL_COSTS.far) return;
            manaCost = COIL_COSTS.far;
            razeDistance = COIL_RANGES.far;
            color = 'hsla(0, 88.80%, 38.40%, 0.80)';
            cooldowns.far = COIL_COOLDOWNS.far;
            type = 'far';
            sound = sounds.razeFar; // Use far Raze sound
            break;
        default:
            return;
    }

    // Deduct mana
    mana -= manaCost;

    // Calculate raze position (in front of player)
    const razeX = player.x + player.width / 2;
    const razeY = player.y - player.jumpHeight - razeDistance;

    // Create the raze effect
    coils.push({
        x: razeX,
        y: razeY,
        currentRadius: 0,
        maxRadius: LANE_WIDTH / 4, // Reduced size (originally LANE_WIDTH / 2)
        alpha: 1.0,
        color: color,
        expansionSpeed: 15,
        type: type,
        lifetime: 30 // Frames the raze stays visible
    });

    // Play the Raze sound with acceleration
    try {
        sound.currentTime = 0; // Reset sound to start
        sound.playbackRate = 1.5; // Speed up the sound (1.5x speed)
        sound.play();
    } catch (e) {
        console.log("Could not play Raze sound");
    }

    // Check for obstacle hits
    checkRazeHits(razeX, razeY, LANE_WIDTH / 4, type);
}
function spawnObstacle() {
    if (gamePaused || gameOver || !gameStarted) return;

    const laneIndices = [0, 1, 2];

    // Create a pattern with 1-2 obstacles in different lanes
    const obstacleCount = Math.random() < 0.3 ? 2 : 1;

    for (let i = 0; i < obstacleCount; i++) {
        if (laneIndices.length === 0) break;

        const laneIndex = Math.floor(Math.random() * laneIndices.length);
        const lane = laneIndices[laneIndex];
        laneIndices.splice(laneIndex, 1); // Remove this lane from available lanes

        const startX = (canvas.width - TOTAL_LANES_WIDTH) / 2;
        const obstacleType = Math.floor(Math.random() * obstacleImages.length);

        // Calculate the exact position in the lane
        const xPosition = startX + lane * LANE_WIDTH + (LANE_WIDTH - OBSTACLE_WIDTH) / 2;

        // Check if there's already an obstacle at a similar position
        const obstacleTooClose = obstacles.some(obs =>
            Math.abs(obs.y) < OBSTACLE_HEIGHT * 2 && obs.lane === lane
        );

        // Only spawn if there's no obstacle too close in the same lane
        if (!obstacleTooClose) {
            obstacles.push({
                x: xPosition,
                y: -OBSTACLE_HEIGHT,
                width: OBSTACLE_WIDTH,
                height: OBSTACLE_HEIGHT,
                lane: lane,
                type: obstacleType
            });
        }
    }
}
function checkRazeHits(razeX, razeY, radius, type) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];

        // Calculate the center of the obstacle
        const obstacleX = obstacle.x + obstacle.width / 2;
        const obstacleY = obstacle.y + obstacle.height / 2;

        // Calculate distance between raze center and obstacle center
        const dx = obstacleX - razeX;
        const dy = obstacleY - razeY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If obstacle is within raze radius, destroy it
        if (distance < radius + obstacle.width / 2) {
            // Create hit particles
            for (let j = 0; j < 10; j++) {
                particles.push({
                    x: obstacle.x + Math.random() * obstacle.width,
                    y: obstacle.y + Math.random() * obstacle.height,
                    size: Math.random() * 4 + 2,
                    color: `rgba(255, ${100 + Math.floor(Math.random() * 155)}, ${Math.floor(Math.random() * 100)}, ${Math.random() * 0.7 + 0.3})`,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: Math.random() * 20 + 10
                });
            }

            // Add soul for defeated obstacle
            souls++;

            // Remove the obstacle
            obstacles.splice(i, 1);

            // Add to score
            score++;
        }
    }
}
function drawCooldown(key, currentCooldown, maxCooldown, x, y, manaCost, color) {
    const size = 40;
    const cooldownPercentage = currentCooldown / maxCooldown;

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, size, size);

    // Draw cooldown overlay
    if (currentCooldown > 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
        ctx.fillRect(x, y, size, size * cooldownPercentage);
    }

    // Draw border
    ctx.strokeStyle = mana >= manaCost ? 'white' : 'gray';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    // Draw key
    ctx.fillStyle = mana >= manaCost ? 'white' : 'gray';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(key, x + size / 2 - 6, y + size / 2 + 7);

    // Draw cooldown time
    if (currentCooldown > 0) {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(Math.ceil(currentCooldown / 60), x + size / 2 - 4, y + size - 5);
    }

    // Draw mana cost below
    ctx.fillStyle = color;
    ctx.font = '12px Arial';
    ctx.fillText(`${manaCost}`, x + size / 2 - 6, y + size + 15);
}
function drawCoils() {
    coils.forEach((coil, index) => {
        // Draw the Shadow Raze effect
        ctx.beginPath();
        ctx.arc(coil.x, coil.y, coil.currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = coil.color;
        ctx.globalAlpha = coil.alpha;
        ctx.fill();

        // Draw the ripple effect
        ctx.beginPath();
        ctx.arc(coil.x, coil.y, coil.currentRadius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Update raze properties
        if (coil.currentRadius < coil.maxRadius) {
            coil.currentRadius += coil.expansionSpeed;
        }

        // Decrease lifetime
        coil.lifetime--;

        // Start fading after reaching max size
        if (coil.currentRadius >= coil.maxRadius) {
            coil.alpha -= 0.05;
        }

        // Remove raze when animation is complete
        if (coil.alpha <= 0 || coil.lifetime <= 0) {
            coils.splice(index, 1);
        }

        // Reset alpha for other drawings
        ctx.globalAlpha = 1.0;
    });
}
function spawnCollectible() {
    if (gamePaused || gameOver || !gameStarted) return;

    // Try all lanes to find a safe spot
    const availableLanes = [0, 1, 2];
    let safeSpotFound = false;
    let collectibleData = null;

    // Shuffle the lanes for random selection
    for (let i = availableLanes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableLanes[i], availableLanes[j]] = [availableLanes[j], availableLanes[i]];
    }

    // Try each lane until we find a safe spot
    for (let i = 0; i < availableLanes.length; i++) {
        const lane = availableLanes[i];
        const startX = (canvas.width - TOTAL_LANES_WIDTH) / 2;
        const type = Math.random() < 0.8 ? 0 : 1; // 80% chance for soul, 20% chance for power rune
        const collectibleSize = 60; // Collectible size

        // Calculate the exact position in the lane
        const xPosition = startX + lane * LANE_WIDTH + (LANE_WIDTH - collectibleSize) / 2;

        // Check if there's an obstacle in this lane that would collide with our collectible
        const obstacleTooClose = obstacles.some(obs =>
            obs.lane === lane &&
            Math.abs(obs.y + OBSTACLE_HEIGHT / 2 - (-collectibleSize / 2)) < OBSTACLE_HEIGHT + collectibleSize
        );

        // Also check if there's already another collectible too close
        const collectibleTooClose = collectibles.some(col =>
            col.lane === lane &&
            Math.abs(col.y - (-collectibleSize)) < collectibleSize * 2
        );

        // If this lane is safe, use it
        if (!obstacleTooClose && !collectibleTooClose) {
            collectibleData = {
                x: xPosition,
                y: -collectibleSize,
                width: collectibleSize,
                height: collectibleSize,
                lane: lane,
                type: type,
                id: Math.random() // Used for floating animation
            };
            safeSpotFound = true;
            break;
        }
    }

    // Only add the collectible if we found a safe spot
    if (safeSpotFound && collectibleData) {
        collectibles.push(collectibleData);
    }
}

function updateObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].y += currentSpeed;

        // Check collision with player
        if (!player.isUltimate && // Invulnerable during ultimate
            player.lane === obstacles[i].lane &&
            player.y - player.jumpHeight < obstacles[i].y + obstacles[i].height &&
            player.y - player.jumpHeight + player.height > obstacles[i].y) {

            // Check if player is jumping over
            const playerBottom = player.y - player.jumpHeight + player.height;
            const playerTop = player.y - player.jumpHeight;
            const obstacleBottom = obstacles[i].y + obstacles[i].height;
            const obstacleTop = obstacles[i].y;

            // Allow jumping over obstacles
            if (!(playerBottom > obstacleTop && playerTop < obstacleBottom)) {
                continue;
            }

            gameOver = true;
            // Try to play collision sound with fallback
            try {
                sounds.collision.play();
            } catch (e) {
                console.log("Could not play collision sound");
            }
        }

        // Remove obstacles that are off-screen
        if (obstacles[i].y > canvas.height) {
            obstacles.splice(i, 1);
            score++;
        }
    }
}

function updateCollectibles() {
    for (let i = collectibles.length - 1; i >= 0; i--) {
        collectibles[i].y += currentSpeed;

        // Check collision with player
        if (player.lane === collectibles[i].lane &&
            player.y - player.jumpHeight < collectibles[i].y + collectibles[i].height &&
            player.y - player.jumpHeight + player.height > collectibles[i].y) {

            if (collectibles[i].type === 0) { // Soul
                souls++;
                // Try to play collect sound with fallback
                try {
                    sounds.collect.play();
                } catch (e) {
                    console.log("Could not play collect sound");
                }

                // Create a +1 effect
                effects.push({
                    type: 'soulCollect',
                    x: collectibles[i].x + collectibles[i].width / 2,
                    y: collectibles[i].y,
                    size: 20,
                    life: 30,
                    maxLife: 30
                });

                // Check if ultimate is ready
                if (souls === 10 && !player.isUltimate) {
                    effects.push({
                        type: 'ultimateReady',
                        life: 180,
                        maxLife: 180
                    });
                }
            } else { // Power rune
                // Different power-ups based on random selection
                const powerType = Math.floor(Math.random() * 3);

                switch (powerType) {
                    case 0: // Temporary speed decrease
                        currentSpeed = BASE_OBSTACLE_SPEED * 0.7;
                        setTimeout(() => {
                            currentSpeed = BASE_OBSTACLE_SPEED + lastSpeedIncrease;
                        }, 5000);
                        break;
                    case 1: // Clear all obstacles
                        // Only clear obstacles, not collectibles
                        obstacles.length = 0;
                        break;
                    case 2: // Extra souls
                        souls += 3;
                        for (let j = 0; j < 3; j++) {
                            effects.push({
                                type: 'soulCollect',
                                x: collectibles[i].x + collectibles[i].width / 2 + (j - 1) * 20,
                                y: collectibles[i].y,
                                size: 20,
                                life: 30,
                                maxLife: 30
                            });
                        }
                        break;
                }
            }

            // Remove only the collected item, not all collectibles
            collectibles.splice(i, 1);
        } else if (collectibles[i].y > canvas.height) {
            // Remove collectibles that are off-screen
            collectibles.splice(i, 1);
        }
    }
}
const requiemGif = document.createElement('img');
const ULTIMATE_CAST_DURATION = 95; // 2 second at 60 FPS
requiemGif.src = 'images/requiem.gif'; // Path to your GIF
requiemGif.alt = 'Requiem Effect';
requiemGif.style.display = 'none';
requiemGif.style.position = 'absolute'; // Use absolute positioning
requiemGif.style.width = '300px'; // Set a fixed width (adjust as needed)
requiemGif.style.height = '300px'; // Set a fixed height (adjust as needed)
requiemGif.style.zIndex = '1000';
requiemGif.style.pointerEvents = 'none'; // Ensure it doesn't block clicks
document.body.appendChild(requiemGif);

function createRequiemExplosion() {
    // Create a burst of particles for the explosion
    for (let i = 0; i < 200; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 300 + 100; // Explosion radius

        particles.push({
            x: player.x + player.width / 2 + Math.cos(angle) * distance,
            y: player.y + player.height / 2 + Math.sin(angle) * distance,
            size: Math.random() * 10 + 5,
            color: `rgba(255, ${Math.floor(Math.random() * 100)}, 0, ${Math.random() * 0.5 + 0.5})`,
            vx: Math.cos(angle) * (Math.random() * 5 + 3),
            vy: Math.sin(angle) * (Math.random() * 5 + 3),
            life: Math.random() * 50 + 30
        });
    }

    // Optional: Add a screen shake effect for more impact
    screenShake(20); // Call a screen shake function if you have one
}
function triggerRequiemAnimation() {
    requiemGif.classList.add('requiem-effect');
    
    // Elimină clasa după animație pentru a o putea reaplica ulterior
    requiemGif.addEventListener('animationend', () => {
        requiemGif.classList.remove('requiem-effect');
    }, { once: true });
}function activateUltimate() {
    if (souls >= 10 && !player.isUltimate) {
        player.isUltimate = true;
        player.ultimateDuration = player.ultimateMaxDuration;
        souls = 0;

        const gifSize = 300;
        requiemGif.style.left = `${player.x + player.width / 2 - gifSize / 2}px`;
        requiemGif.style.top = `${player.y + player.height / 2 - gifSize / 2}px`;
        requiemGif.style.display = 'block';
        
        triggerRequiemAnimation(); // Adaugă animația

        setTimeout(() => {
            obstacles.length = 0;
            requiemGif.style.display = 'none';
            createRequiemExplosion();
        }, ULTIMATE_CAST_DURATION * (1000 / 60));
    }
}
function increaseSpeed() {
    if (gameStarted && !gamePaused && !gameOver) {
        currentSpeed += 0.5;
        lastSpeedIncrease += 0.5;
    }
}

// Main game functions
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function checkGameOver() {
    if (gameOver) {
        drawGameOverScreen();
    }
}

function resetGame() {
    score = 0;
    souls = 0;
    gameOver = false;
    obstacles.length = 0;
    collectibles.length = 0;
    particles.length = 0;
    effects.length = 0;
    player.lane = 1;
    player.isJumping = false;
    player.jumpHeight = 0;
    player.isUltimate = false;
    player.ultimateDuration = 0;
    currentSpeed = BASE_OBSTACLE_SPEED;
    lastSpeedIncrease = 0;
}

function gameLoop() {
    clearCanvas();

    drawBackground();
    drawLanes();

    if (!gameStarted) {
        drawStartScreen();
    } else if (gameOver) {
        drawBackground();
        drawLanes();
        drawPlayer();
        drawObstacles();
        drawCollectibles();
        drawParticles();
        drawEffects();
        drawHUD();
        drawCoils();
        checkGameOver();
    } else {
        if (!gamePaused) {
            updatePlayer();
            updateObstacles();
            updateCollectibles();
        }

        drawPlayer();
        drawObstacles();
        drawCollectibles();
        drawParticles();
        drawEffects();
        drawCoils();
        drawHUD();

        if (gamePaused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'white';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('PAUSED', canvas.width / 2 - 70, canvas.height / 2);
            ctx.font = '20px Arial';
            ctx.fillText('Press P to continue', canvas.width / 2 - 80, canvas.height / 2 + 40);
        }
    }

    requestAnimationFrame(gameLoop);
}

// Event listeners
window.addEventListener('keydown', (e) => {
    if (!gameStarted) {
        if (e.key === 'Enter') {
            gameStarted = true;
            // Try to play background sound with fallback
            try {
                sounds.background.play();
            } catch (e) {
                console.log("Could not play background sound");
            }
        }
        return;
    }

    if (gameOver) {
        if (e.key === 'Enter') {
            resetGame();
            gameStarted = true;
        }
        return;
    }

    if (e.key === 'p' || e.key === 'P') {
        gamePaused = !gamePaused;
        if (gamePaused) {
            try {
                sounds.background.pause();
            } catch (e) {
                console.log("Could not pause background sound");
            }
        } else {
            try {
                sounds.background.play();
            } catch (e) {
                console.log("Could not play background sound");
            }
        }
        return;
    }

    if (gamePaused) return;

    switch (e.key) {
        case 'ArrowLeft':
            if (player.lane > 0) {
                player.lane--;
            }
            break;
        case 'ArrowRight':
            if (player.lane < LANE_COUNT - 1) {
                player.lane++;
            }
            break;
        case 'ArrowUp':
            if (!player.isJumping) {
                player.isJumping = true;
                player.isDescending = false;
            }
            break;
        case ' ': // Spacebar
            activateUltimate();
            break;
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Spawn game elements
setInterval(spawnObstacle, 1500);
setInterval(spawnCollectible, 3000);
setInterval(increaseSpeed, 30000); // Increase speed every 30 seconds

// Start the game safely
preloadImages(() => {
    console.log("Starting game loop");
    gameLoop();
});
