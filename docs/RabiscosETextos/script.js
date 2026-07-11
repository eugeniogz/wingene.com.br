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
const progressCircle = document.querySelector('.ring-circle');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let isDrawing = false;
let lastX = 0, lastY = 0, mouseX = 0, mouseY = 0;
let isTyping = false, textCursorX = 0, textCursorY = 0, lineStartX = 0;
let savedCursorData = null, savedCursorX = 0, savedCursorY = 0, cursorInterval = null;
let textHistory = [];
let savedFeedbackData = null, savedFeedbackX = 0, savedFeedbackY = 0, feedbackTimeout = null;

const colors = ['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080'];
let currentColorIndex = 0;
let currentColor = colors[currentColorIndex];

// --- LÓGICA DO BOTÃO "SEGURE PARA LIMPAR" ---
let holdTimer;
const holdDuration = 1500; 

function startHold(e) {
    e.preventDefault();
    const startTime = Date.now();
    holdTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / holdDuration, 1);
        progressCircle.style.strokeDashoffset = 251.2 - (progress * 251.2);
        if (progress >= 1) {
            limparTela();
            stopHold();
        }
    }, 50);
}

function stopHold() {
    clearInterval(holdTimer);
    progressCircle.style.strokeDashoffset = 251.2;
}

function limparTela() {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    textHistory = [];
}

btnLimpar.addEventListener('mousedown', startHold);
btnLimpar.addEventListener('mouseup', stopHold);
btnLimpar.addEventListener('mouseleave', stopHold);
btnLimpar.addEventListener('touchstart', startHold);
btnLimpar.addEventListener('touchend', stopHold);

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

// Eventos de Mouse e Teclado
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (!isDrawing) return;
    if (isTyping) { stopBlinking(); isTyping = false; hiddenInput.blur(); }
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

canvas.addEventListener('mouseup', () => isDrawing = false);

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
    currentColor = colors[currentColorIndex];
    showColorFeedback(e.offsetX, e.offsetY);
});
hiddenInput.addEventListener('input', handleInput);
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);