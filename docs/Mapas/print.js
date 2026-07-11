 //Renderiza todos os 12 mapas na página de impressão.
function renderAllMaps() {
    const printContainer = document.getElementById('print-container');

    for (let mapId = 1; mapId <= 12; mapId++) {
        const path = generateFixedMap(mapId);
        if (!path || path.length === 0) {
            console.error(`Falha ao gerar o mapa com ID: ${mapId}`);
            continue;
        }

        const mapWrapper = document.createElement('div');
        mapWrapper.className = 'map-wrapper';

        const grid = document.createElement('div');
        grid.className = 'grid-container';

        const startPos = path[0];
        const endPos = path[path.length - 1];
        let mapNumberPlaced = false;

        // Preenche o grid 8x8
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const key = `${x},${y}`;

                if (path.includes(key)) {
                    cell.classList.add('path-true');
                    if (key === startPos) {
                        cell.innerText = '🐶';
                    } else if (key === endPos) {
                        cell.innerText = '🏡';
                    }
                } else {
                    if (y === 0 && !mapNumberPlaced) {
                        cell.style.fontSize = '14px';
                        cell.style.flexDirection = 'column';
                        cell.innerHTML = `<b>${mapId}</b><span style="line-height: 1;">🌳</span>`;
                        mapNumberPlaced = true;
                    } else {
                        cell.innerText = '🌳'; // Árvore fora do caminho
                    }
                }
                grid.appendChild(cell);
            }
        }
        mapWrapper.appendChild(grid);
        printContainer.appendChild(mapWrapper);
    }
}

// Inicia a renderização quando a página carregar
window.onload = () => {
    renderAllMaps();
    window.print(); 
}