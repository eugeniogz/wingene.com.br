// Impede o menu de contexto e teclas de sistema (Modo Kiosk)
document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function (e) {
    // Bloqueia as teclas de função (F1-F12) usando a propriedade 'key' em vez da obsoleta 'keyCode'.
    if (/^F([1-9]|1[0-2])$/.test(e.key)) return false;

    // Bloqueia Alt+P para impedir impressão ou outras ações do navegador no modo quiosque.
    if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        return false;
    }
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const btnLimpar = document.getElementById('btn-limpar');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let isDrawing = false;
let startX = 0, startY = 0;
let lastX = 0, lastY = 0, mouseX = 0, mouseY = 0;
let snapshot = null;
let currentTool = 'freehand'; // 'freehand' | 'rectangle' | 'circle'
let isTyping = false, textCursorX = 0, textCursorY = 0, lineStartX = 0;
let savedCursorData = null, savedCursorX = 0, savedCursorY = 0, cursorInterval = null;
let textHistory = [];
let savedFeedbackData = null, savedFeedbackX = 0, savedFeedbackY = 0, feedbackTimeout = null;

const colors = ['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080'];
let currentColorIndex = 0;
let currentColor = colors[currentColorIndex];

const toolButtons = document.querySelectorAll('.tool-btn');
const colorSwatches = document.querySelectorAll('.color-swatch');
const customColorInput = document.getElementById('custom-color-input');
const customColorBtn = document.getElementById('custom-color-btn');

function setTool(newTool) {
    currentTool = newTool;
    toolButtons.forEach(btn => {
        const isMatch = btn.dataset.tool === newTool;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    canvas.classList.toggle('cursor-bucket', newTool === 'bucket');

    if (isTyping) {
        stopBlinking();
        isTyping = false;
        if (hiddenInput) hiddenInput.blur();
    }
}

toolButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setTool(btn.dataset.tool);
    });
});

function setColor(newColor, isCustom = false) {
    currentColor = newColor;
    const index = colors.findIndex(c => c.toLowerCase() === newColor.toLowerCase());
    currentColorIndex = index !== -1 ? index : 0;

    // Atualiza estado ativo e acessibilidade dos botões de cor
    colorSwatches.forEach(swatch => {
        const isMatch = swatch.dataset.color.toLowerCase() === newColor.toLowerCase();
        swatch.classList.toggle('active', isMatch);
        swatch.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    if (customColorBtn) {
        const isCustomActive = isCustom || index === -1;
        customColorBtn.classList.toggle('active', isCustomActive);
        if (customColorInput && !isCustom) {
            customColorInput.value = newColor;
        }
    }

    if (isTyping) {
        startBlinking();
        if (hiddenInput) hiddenInput.focus();
    }
}

// Clique simples nas cores da paleta no topo da página
colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        setColor(swatch.dataset.color, false);
    });
});

// Suporte ao seletor nativo de cor personalizada
if (customColorInput) {
    const handleCustomColor = (e) => {
        setColor(e.target.value, true);
    };
    customColorInput.addEventListener('input', handleCustomColor);
    customColorInput.addEventListener('change', handleCustomColor);
}

function limparTela() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    textHistory = [];
    snapshot = null;
}
window.limparTela = limparTela;

if (btnLimpar) {
    btnLimpar.addEventListener('click', (e) => {
        e.preventDefault();
        limparTela();
    });
}

// --- INPUT E TEXTO (MAIÚSCULAS) ---
const hiddenInput = document.createElement('input');
hiddenInput.type = 'text';
hiddenInput.style.position = 'absolute';
hiddenInput.style.opacity = '0';
hiddenInput.style.pointerEvents = 'none';
document.body.appendChild(hiddenInput);

function showColorFeedback(x, y) {
    clearTimeout(feedbackTimeout);
    if (savedFeedbackData) {
        ctx.putImageData(savedFeedbackData, savedFeedbackX, savedFeedbackY);
    }

    const text = `COR `;
    ctx.font = '16px Roboto, sans-serif';
    const textMetrics = ctx.measureText(text);
    const feedbackWidth = textMetrics.width + 40;
    const feedbackHeight = 30;

    // Posiciona a caixa de feedback acima do cursor, evitando as bordas da tela
    let feedbackX = x;
    let feedbackY = y - feedbackHeight - 10;
    if (feedbackY < 0) feedbackY = y + 10;
    if (feedbackX + feedbackWidth > canvas.width) feedbackX = canvas.width - feedbackWidth;

    // Salva uma área um pouco maior para garantir que a borda (stroke) seja completamente apagada.
    const savePadding = 2;
    savedFeedbackX = feedbackX - savePadding;
    savedFeedbackY = feedbackY - savePadding;
    const saveWidth = feedbackWidth + savePadding * 2;
    const saveHeight = feedbackHeight + savePadding * 2;
    savedFeedbackData = ctx.getImageData(savedFeedbackX, savedFeedbackY, saveWidth, saveHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(feedbackX, feedbackY, feedbackWidth, feedbackHeight);
    ctx.strokeStyle = '#AAA';
    ctx.strokeRect(feedbackX, feedbackY, feedbackWidth, feedbackHeight);

    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, feedbackX + 10, feedbackY + feedbackHeight / 2);

    const swatchX = feedbackX + 10 + ctx.measureText('COR ').width;
    ctx.fillStyle = currentColor;
    ctx.fillRect(swatchX, feedbackY + (feedbackHeight / 2) - 7, 14, 14);

    feedbackTimeout = setTimeout(() => {
        if (savedFeedbackData) {
            ctx.putImageData(savedFeedbackData, savedFeedbackX, savedFeedbackY);
            savedFeedbackData = null;
        }
    }, 2000);
}


function handleInput() {
    if (!isTyping) return;
    const text = hiddenInput.value.toUpperCase(); // FORÇA MAIÚSCULAS
    if (text.length > 0) {
        stopBlinking();
        ctx.fillStyle = currentColor;
        ctx.font = '20px Roboto, sans-serif';
        ctx.textBaseline = 'alphabetic';
        for (const char of text) {
            const charWidth = ctx.measureText(char).width;
            textHistory.push({ char, width: charWidth, x: textCursorX, y: textCursorY, color: currentColor });
            ctx.fillText(char, textCursorX, textCursorY);
            textCursorX += charWidth;
        }
        startBlinking();
        hiddenInput.value = '';
    }
}

// ... (Aqui você mantém suas funções auxiliares: drawCursor, startBlinking, removeCursor, stopBlinking) ...

function removeCursor() {
    if (savedCursorData) {
        ctx.putImageData(savedCursorData, savedCursorX, savedCursorY);
        savedCursorData = null;
    }
}

function drawCursor() {
    const cursorHeight = 20;
    savedCursorX = Math.floor(textCursorX - 2);
    savedCursorY = Math.floor(textCursorY - 20);
    savedCursorData = ctx.getImageData(savedCursorX, savedCursorY, 4, cursorHeight + 4);
    ctx.beginPath();
    ctx.moveTo(textCursorX, textCursorY - 18);
    ctx.lineTo(textCursorX, textCursorY + 2);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2;
    ctx.stroke();
}

function stopBlinking() {
    clearInterval(cursorInterval);
    cursorInterval = null;
    removeCursor();
}

function startBlinking() {
    stopBlinking();
    let visible = true;
    drawCursor();
    cursorInterval = setInterval(() => {
        if (visible) removeCursor(); else drawCursor();
        visible = !visible;
    }, 500);
}

function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function drawShapePreview(currentX, currentY, isShift) {
    if (snapshot) {
        ctx.putImageData(snapshot, 0, 0);
    }
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'rectangle') {
        let width = currentX - startX;
        let height = currentY - startY;

        if (isShift) {
            const size = Math.max(Math.abs(width), Math.abs(height));
            width = width < 0 ? -size : size;
            height = height < 0 ? -size : size;
        }

        ctx.beginPath();
        ctx.strokeRect(startX, startY, width, height);
    } else if (currentTool === 'circle') {
        let w = Math.abs(currentX - startX);
        let h = Math.abs(currentY - startY);

        if (isShift) {
            const r = Math.max(w, h);
            w = r;
            h = r;
        }

        const rx = w / 2;
        const ry = h / 2;
        const cx = Math.min(startX, currentX) + rx;
        const cy = Math.min(startY, currentY) + ry;

        if (rx > 0 && ry > 0) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

// Algoritmo de Preenchimento (Flood Fill / Balde de Tinta) de alta performance
function floodFill(startX, startY, fillHex) {
    const width = canvas.width;
    const height = canvas.height;
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data32 = new Uint32Array(imgData.data.buffer);

    // Obtém o valor em Uint32 nativo da cor de preenchimento
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = 1;
    dummyCanvas.height = 1;
    const dummyCtx = dummyCanvas.getContext('2d');
    dummyCtx.fillStyle = fillHex;
    dummyCtx.fillRect(0, 0, 1, 1);
    const rgba = dummyCtx.getImageData(0, 0, 1, 1).data;

    const buf = new ArrayBuffer(4);
    const u8 = new Uint8ClampedArray(buf);
    const u32 = new Uint32Array(buf);
    u8[0] = rgba[0];
    u8[1] = rgba[1];
    u8[2] = rgba[2];
    u8[3] = 255;
    const fillColor = u32[0];

    const startIndex = startY * width + startX;
    const targetColor = data32[startIndex];

    if (targetColor === fillColor) return;

    const targetR = targetColor & 0xFF;
    const targetG = (targetColor >> 8) & 0xFF;
    const targetB = (targetColor >> 16) & 0xFF;
    const targetA = (targetColor >> 24) & 0xFF;

    function match(idx) {
        const c = data32[idx];
        if (c === targetColor) return true;
        const r = c & 0xFF;
        const g = (c >> 8) & 0xFF;
        const b = (c >> 16) & 0xFF;
        const a = (c >> 24) & 0xFF;
        return Math.abs(r - targetR) <= 15 &&
               Math.abs(g - targetG) <= 15 &&
               Math.abs(b - targetB) <= 15 &&
               Math.abs(a - targetA) <= 15;
    }

    const queue = [startX, startY];
    const visited = new Uint8Array(width * height);
    visited[startIndex] = 1;

    let head = 0;
    while (head < queue.length) {
        const cx = queue[head++];
        const cy = queue[head++];

        let leftX = cx;
        let rightX = cx;
        let rowOffset = cy * width;

        while (leftX > 0 && match(rowOffset + leftX - 1) && !visited[rowOffset + leftX - 1]) {
            leftX--;
            visited[rowOffset + leftX] = 1;
        }
        while (rightX < width - 1 && match(rowOffset + rightX + 1) && !visited[rowOffset + rightX + 1]) {
            rightX++;
            visited[rowOffset + rightX] = 1;
        }

        for (let x = leftX; x <= rightX; x++) {
            data32[rowOffset + x] = fillColor;
            visited[rowOffset + x] = 1;
        }

        for (let ny of [cy - 1, cy + 1]) {
            if (ny >= 0 && ny < height) {
                let nOffset = ny * width;
                let inSpan = false;
                for (let x = leftX; x <= rightX; x++) {
                    const idx = nOffset + x;
                    if (match(idx) && !visited[idx]) {
                        if (!inSpan) {
                            queue.push(x, ny);
                            visited[idx] = 1;
                            inSpan = true;
                        }
                    } else {
                        inSpan = false;
                    }
                }
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

// Eventos de Mouse e Teclado
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== undefined) return;
    if (isTyping) {
        stopBlinking();
        isTyping = false;
        hiddenInput.blur();
    }
    if (savedFeedbackData) {
        clearTimeout(feedbackTimeout);
        ctx.putImageData(savedFeedbackData, savedFeedbackX, savedFeedbackY);
        savedFeedbackData = null;
    }

    const coords = getCanvasCoords(e);

    if (currentTool === 'bucket') {
        floodFill(Math.floor(coords.x), Math.floor(coords.y), currentColor);
        return;
    }

    isDrawing = true;
    startX = coords.x;
    startY = coords.y;
    lastX = coords.x;
    lastY = coords.y;

    if (currentTool === 'rectangle' || currentTool === 'circle') {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
});

canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!isDrawing || currentTool === 'bucket') return;

    const coords = getCanvasCoords(e);

    if (currentTool === 'freehand') {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        lastX = coords.x;
        lastY = coords.y;
    } else if (currentTool === 'rectangle' || currentTool === 'circle') {
        drawShapePreview(coords.x, coords.y, e.shiftKey);
    }
});

window.addEventListener('mouseup', (e) => {
    if (!isDrawing || currentTool === 'bucket') return;

    if (currentTool === 'rectangle' || currentTool === 'circle') {
        const coords = getCanvasCoords(e);
        drawShapePreview(coords.x, coords.y, e.shiftKey);
    }

    isDrawing = false;
    snapshot = null;
});

// Suporte a dispositivos de toque (Touch)
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true
        });
        canvas.dispatchEvent(mouseEvent);
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true
        });
        canvas.dispatchEvent(mouseEvent);
        e.preventDefault();
    }
}, { passive: false });

window.addEventListener('touchend', (e) => {
    if (isDrawing) {
        const touch = e.changedTouches ? e.changedTouches[0] : null;
        const mouseEvent = new MouseEvent('mouseup', {
            clientX: touch ? touch.clientX : mouseX,
            clientY: touch ? touch.clientY : mouseY,
            bubbles: true
        });
        window.dispatchEvent(mouseEvent);
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && isTyping) {
        textHistory.push({ isNewLine: true, prevX: textCursorX, prevY: textCursorY, lineStartX: lineStartX });
        textCursorY += 25; textCursorX = lineStartX;
        startBlinking();
    } else if (e.key === 'Backspace' && isTyping && textHistory.length > 0) {
        stopBlinking();
        const last = textHistory.pop();
        if (last.isNewLine) {
            textCursorX = last.prevX; textCursorY = last.prevY;
        } else {
            textCursorX = last.x;
            ctx.fillStyle = 'white';
            ctx.fillRect(last.x - 1, last.y - 20, last.width + 2, 28);
        }
        startBlinking();
    } else if (!isTyping && e.key.length === 1) {
        isTyping = true;
        lineStartX = mouseX; textCursorX = mouseX; textCursorY = mouseY;
        hiddenInput.focus();
    }
});

canvas.addEventListener('dblclick', (e) => {
    isDrawing = false;
    currentColorIndex = (currentColorIndex + 1) % colors.length;
    setColor(colors[currentColorIndex], false);
    showColorFeedback(e.offsetX, e.offsetY);
});

hiddenInput.addEventListener('input', handleInput);

// Preserva o desenho ao redimensionar a janela
window.addEventListener('resize', () => {
    const tempImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(tempImage, 0, 0);
});

ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);