// Gera caminhos determinísticos (sempre iguais para o mesmo ID)
function generateFixedMap(id) {
    let attempt = 0;
    let path = [];

    while (attempt < 5000) {
        path = [];
        let leftCount = 0;
        let rightCount = 0;

        // Define um ponto de início fixo para cada um dos 12 mapas
        let startX = [0, 2, 4, 6, 1, 3, 5, 7, 0, 3, 6, 2][(id - 1) % 12];
        let curr = { x: startX, y: 7 };
        path.push(`${curr.x},${curr.y}`);

        // Gerador pseudo-aleatório com semente fixa (o ID do mapa + tentativa)
        let seed = id + (attempt * 100);
        function seededRandom() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        }

        // Verifica se a célula é válida e não toca em partes anteriores do caminho (exceto a imediatamente anterior)
        function isSafe(x, y) {
            if (x < 0 || x > 7 || y < 0 || y > 7) return false;
            if (path.includes(`${x},${y}`)) return false;
            
            const neighbors = [
                {nx: x, ny: y-1}, {nx: x, ny: y+1},
                {nx: x-1, ny: y}, {nx: x+1, ny: y}
            ];
            
            const lastKey = path[path.length - 1];

            for (let n of neighbors) {
                const key = `${n.nx},${n.ny}`;
                if (path.includes(key) && key !== lastKey) {
                    return false; 
                }
            }
            return true;
        }

        let stuck = false;
        while (true) {
            let r = seededRandom();
            let moved = false;

            if (r < 0.35) { // 35% Esquerda
                if (isSafe(curr.x - 1, curr.y)) {
                    curr.x--; leftCount++; moved = true;
                }
            } else if (r < 0.7) { // 35% Direita
                if (isSafe(curr.x + 1, curr.y)) {
                    curr.x++; rightCount++; moved = true;
                }
            } else if (r < 1) { // 30% Baixo
                if (isSafe(curr.x, curr.y + 1)) {
                    curr.y++; moved = true;
                }
            }
            
            if (!moved) {
                if (curr.y > 0 && isSafe(curr.x, curr.y - 1)) {
                    curr.y--;
                } else if (curr.y === 0) {
                    // Se já estamos na linha de chegada e não movemos para os lados, paramos.
                    break;
                } else {
                    stuck = true;
                    break;
                }
            }
            
            path.push(`${curr.x},${curr.y}`);

            // Se chegou na linha 0, decide se continua andando ou para (40% de chance de parar a cada passo)
            if (curr.y === 0 && seededRandom() > 0.6) break;
        }

        if (!stuck && leftCount >= 5 && rightCount >= 5) return path;
        attempt++;
    }
    return path;
}
