const gridContainer = document.getElementById('grid-container');
const mapNumDisplay = document.getElementById('map-number');
const msgDisplay = document.getElementById('message');
const scoreValueDisplay = document.getElementById('score-value');
const flashlightDisplay = document.getElementById('flashlight-value');

let currentPath = [];
let playerPos = { x: 0, y: 7 };
let gameActive = true;
let mapID = Math.floor(Math.random() * 12) + 1;
let score = 0;
let visitedPathCells = new Set();
let permanentTrees = new Set();
let flashlightUsedCells = new Set();
const maxFlashlightUses = 5;

function updateScoreUI() {
    if (scoreValueDisplay) scoreValueDisplay.innerText = score;
}

function updateFlashlightUI() {
    if (flashlightDisplay) {
        const remaining = Math.max(0, maxFlashlightUses - flashlightUsedCells.size);
        let html = "";
        for (let i = 0; i < maxFlashlightUses; i++) {
            if (i < remaining) {
                html += '<span>🔦</span> ';
            } else {
                html += '<span style="opacity: 0.25; filter: grayscale(100%);">🔦</span> ';
            }
        }
        flashlightDisplay.innerHTML = html.trim();
    }
}

function initGame(newMap = false, start = true) {
    if (newMap) {
        mapID++;
        if (mapID > 12) mapID = 1;
    } else if (start) {
        mapID = Math.floor(Math.random() * 12) + 1;
    }
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    currentPath = generateFixedMap(mapID);
    mapNumDisplay.innerText = mapID;
    playerPos = { x: parseInt(currentPath[0].split(',')[0]), y: 7 };
    visitedPathCells = new Set();
    visitedPathCells.add(`${playerPos.x},${playerPos.y}`);
    permanentTrees = new Set();
    flashlightUsedCells = new Set();
    gameActive = true;
    msgDisplay.innerText = '';
    score = 0;
    updateScoreUI();
    updateFlashlightUI();
    
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const cell = document.createElement('div');
            cell.id = `c-${x}-${y}`;
            cell.classList.add('cell');
            if (currentPath.includes(`${x},${y}`)) cell.classList.add('path-true');
            if (y === 7 && x === playerPos.x) cell.classList.add('start');
            const lastPathPos = currentPath[currentPath.length - 1];
            if (`${x},${y}` === lastPathPos) {
                cell.classList.add('end');
                cell.innerText = '🏡';
            }
            cell.addEventListener('mouseenter', () => handleCellHover(x, y));
            cell.addEventListener('mouseleave', () => handleCellLeave(x, y));
            gridContainer.appendChild(cell);
        }
    }
    updatePlayerUI();
}

function handleCellHover(x, y) {
    if (!gameActive) return;
    
    // Check adjacency (8 directions)
    const dx = Math.abs(x - playerPos.x);
    const dy = Math.abs(y - playerPos.y);
    const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);
    
    if (!isAdjacent) return;
    
    const cellKey = `${x},${y}`;
    const cell = document.getElementById(`c-${x}-${y}`);
    if (!cell) return;
    
    // Skip if it's already permanently revealed or start/end
    if (permanentTrees.has(cellKey) || cell.classList.contains('start') || cell.classList.contains('end') || cell.innerText === '🏡') return;
    
    // Check if it's not path (meaning it is a hidden tree)
    const isTree = !currentPath.includes(cellKey);
    
    if (flashlightUsedCells.has(cellKey) || flashlightUsedCells.size < maxFlashlightUses) {
        if (!flashlightUsedCells.has(cellKey)) {
            flashlightUsedCells.add(cellKey);
            updateFlashlightUI();
        }
        cell.style.backgroundColor = '#fef08a'; // glow color
        if (isTree) {
            cell.innerText = '🌳';
        }
    } else {
        msgDisplay.innerText = "LANTERNA SEM BATERIA! 🔋";
        msgDisplay.style.color = "orange";
        setTimeout(() => {
            if (msgDisplay.innerText === "LANTERNA SEM BATERIA! 🔋") {
                msgDisplay.innerText = "";
            }
        }, 2000);
    }
}

function handleCellLeave(x, y) {
    if (x === playerPos.x && y === playerPos.y) return;
    const cellKey = `${x},${y}`;
    const cell = document.getElementById(`c-${x}-${y}`);
    if (!cell) return;
    
    // Only hide if it was a temporary flashlight tree or highlight
    if (!permanentTrees.has(cellKey) && !cell.classList.contains('start') && !cell.classList.contains('end') && cell.innerText !== '🏡') {
        cell.innerText = '';
        cell.style.backgroundColor = '';
    }
}

function updatePlayerUI() {
    document.querySelectorAll('.cell').forEach(c => { if (c.innerText === '🐶') c.innerText = ''; });
    const pCell = document.getElementById(`c-${playerPos.x}-${playerPos.y}`);
    if (pCell) pCell.innerText = '🐶';
}

// Configuração do Clique Longo (Mesma lógica do seu quadro branco)
function setupLongPress(btnId, ringId, callback) {
    const btn = document.getElementById(btnId);
    const ring = document.getElementById(ringId);
    let timer;
    const duration = 1200;

    if (!btn || !ring) return;

    const start = (e) => {
        e.preventDefault();
        const startTime = Date.now();
        timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            ring.style.strokeDashoffset = 219.9 - (progress * 219.9);
            if (progress >= 1) { clearInterval(timer); ring.style.strokeDashoffset = 219.9; callback(); }
        }, 50);
    };

    const stop = () => { clearInterval(timer); ring.style.strokeDashoffset = 219.9; };

    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchstart', start);
    btn.addEventListener('touchend', stop);
}

setupLongPress('btn-reiniciar', 'ring-reiniciar', () => initGame(false, false));
setupLongPress('btn-novo', 'ring-novo', () => initGame(true, false));
document.onkeydown = function (e) {
    // Bloqueia as teclas de função (F1-F12) usando a propriedade 'key' em vez da obsoleta 'keyCode'.
    if (/^F([1-9]|1[0-2])$/.test(e.key)) return false;

    // Bloqueia Alt+P para impedir impressão ou outras ações do navegador no modo quiosque.
    if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        return false;
    }
};

window.addEventListener('keydown', (e) => {
    if (!gameActive) return;

    // Atalho: Ctrl+Alt+S -> Mostra o caminho colorido em verde
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 's') {
        document.querySelectorAll('.path-true').forEach(el => el.style.backgroundColor = 'lightgreen');
        return;
    }


    let next = { ...playerPos };
    if (e.key === 'ArrowUp') next.y--;
    else if (e.key === 'ArrowDown') next.y++;
    else if (e.key === 'ArrowLeft') next.x--;
    else if (e.key === 'ArrowRight') next.x++;
    else return;

    if (next.x >= 0 && next.x < 8 && next.y >= 0 && next.y < 8) {
        const nextCell = document.getElementById(`c-${next.x}-${next.y}`);
        if (nextCell && nextCell.innerText === '🌳') {
            return; // Se já tiver árvore, ignora a tecla (não penaliza de novo)
        }

        if (currentPath.includes(`${next.x},${next.y}`)) {
            // Preenche com árvores as células da linha atual que não são do caminho (apenas se mudar de linha)
            if (next.y < playerPos.y) {
                for (let x = 0; x < 8; x++) {
                    if (!currentPath.includes(`${x},${playerPos.y}`)) {
                        const cell = document.getElementById(`c-${x}-${playerPos.y}`);
                        if (cell) {
                            cell.innerText = '🌳';
                            permanentTrees.add(`${x},${playerPos.y}`);
                        }
                    }
                }
            }
            // Limpa a célula atual
            const prevCell = document.getElementById(`c-${playerPos.x}-${playerPos.y}`);
            if (prevCell) prevCell.innerText = '';

            playerPos = next;
            updatePlayerUI();
            const nextKey = `${next.x},${next.y}`;
            if (!visitedPathCells.has(nextKey)) {
                visitedPathCells.add(nextKey);
                if (score < 10) {
                    score++;
                    updateScoreUI();
                }
            }
            const lastPathPos = currentPath[currentPath.length - 1];
            if (playerPos.x === parseInt(lastPathPos.split(',')[0]) && playerPos.y === parseInt(lastPathPos.split(',')[1])) { 
                // Preenche a linha de chegada com árvores nas células que não são do caminho
                for (let x = 0; x < 8; x++) {
                    if (!currentPath.includes(`${x},0`)) {
                        const cell = document.getElementById(`c-${x}-0`);
                        if (cell) {
                            cell.innerText = '🌳';
                            permanentTrees.add(`${x},0`);
                        }
                    }
                }

                msgDisplay.innerText = "VITÓRIA! VOCÊ CONSEGUIU! 🎉"; 
                msgDisplay.style.color = "green";
                gameActive = false; 
                new Audio('tada.mp3').play();
            }
        } else {
            // Marca a célula errada com uma árvore
            if (nextCell) {
                nextCell.innerText = '🌳';
                nextCell.style.backgroundColor = ''; // clear glow
                permanentTrees.add(`${next.x},${next.y}`);
            }

            if (score > 0) {
                score--;
                updateScoreUI();
            }

            msgDisplay.innerText = "CAMINHO ERRADO! -1 PONTO. ❌"; 
            msgDisplay.style.color = "red";
        }
    }
});

initGame();