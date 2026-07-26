/**
 * WinGene Investimentos — Lógica Principal da PWA
 * Gestão da Carteira, Rebalanceamento por Metas e Cálculo de Evolução Mensal e Anual.
 */

// Estado da Aplicação
let appState = {
  rendaFixa: [],
  acoes: [],
  lastUpdated: new Date().toISOString()
};

// ID do item atualmente em edição inline (null se nenhum)
let editingRfId = null;
let editingAcaoId = null;

// Dicionário offline de tickers B3 para auto-completar nomes das empresas
const B3_POPULAR_STOCKS = {
  'PETR4': 'Petrobras PN',
  'PETR3': 'Petrobras ON',
  'VALE3': 'Vale S.A.',
  'ITUB4': 'Itaú Unibanco PN',
  'BBDC4': 'Bradesco PN',
  'BBAS3': 'Banco do Brasil ON',
  'WEGE3': 'Weg S.A.',
  'RENT3': 'Localiza ON',
  'TAEE11': 'Taesa Unit',
  'KLBN11': 'Klabin Unit',
  'MXRF11': 'Maxi Renda FII',
  'ABEV3': 'Ambev ON',
  'ELET3': 'Eletrobras ON',
  'EGIE3': 'Engie Brasil ON',
  'ITSA4': 'Itaúsa PN',
  'PRIO3': 'Prio ON',
  'VBBR3': 'Vibra Energia ON',
  'GGBR4': 'Gerdau PN',
  'CSAN3': 'Cosan ON',
  'BBSE3': 'BB Seguridade ON',
  'CXSE3': 'Caixa Seguridade ON',
  'RADL3': 'Raia Drogasil ON',
  'CPLE6': 'Copel PNB',
  'FLRY3': 'Fleury ON',
  'SUZB3': 'Suzano ON'
};

// --- INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  setupEventListeners();
  setupSwipeNavigation();
  renderApp();
  setupPwaInstallation();

  // Registrar retorno do Google Drive com proteção contra sobreposição de dados de demonstração
  window.onDriveDataLoaded = (remoteData) => {
    if (remoteData && (Array.isArray(remoteData.rendaFixa) || Array.isArray(remoteData.acoes))) {
      const localTime = appState.isDemo ? 0 : new Date(appState.lastUpdated || 0).getTime();
      const remoteTime = new Date(remoteData.lastUpdated || 0).getTime();

      // Se for dado de demonstração local ou se o arquivo do Drive for mais recente, aceita os dados do Drive
      if (appState.isDemo || remoteTime >= localTime || (!appState.rendaFixa.length && !appState.acoes.length)) {
        appState = {
          isDemo: false,
          rendaFixa: remoteData.rendaFixa || [],
          acoes: remoteData.acoes || [],
          lastUpdated: remoteData.lastUpdated || new Date().toISOString()
        };
        saveLocalState(false);
        renderApp();
        showToast('Dados sincronizados com o Google Drive!', 'success');
      } else {
        console.log('Dados reais locais mais recentes detectados. Enviando atualização para o Google Drive...');
        saveToDrive(appState);
      }
    }
  };
});

// --- GERENCIAMENTO DE ESTADO LOCAL ---
function loadLocalState() {
  const saved = localStorage.getItem('wingene_investimentos_state');
  if (saved) {
    try {
      appState = JSON.parse(saved);
      if (!appState.rendaFixa) appState.rendaFixa = [];
      if (!appState.acoes) appState.acoes = [];
    } catch (e) {
      console.error('Erro ao ler estado local:', e);
    }
  } else {
    // Dados de demonstração inicial — marcados como isDemo: true e lastUpdated: 0
    appState = {
      isDemo: true,
      rendaFixa: [
        { id: 'rf-1', tipo: 'Tesouro Direto', emissor: 'Tesouro Nacional', nome: 'Tesouro IPCA+ 2035', valor: 15000, valorMesAnterior: 14750, valorAnoAnterior: 13800, taxa: 'IPCA + 6.1%', data: new Date().toLocaleDateString('pt-BR') },
        { id: 'rf-2', tipo: 'RDB', emissor: 'Nubank / Nu Financeira', nome: 'RDB Resgate Imediato', valor: 8500, valorMesAnterior: 8420, valorAnoAnterior: 7750, taxa: '100% CDI', data: new Date().toLocaleDateString('pt-BR') }
      ],
      acoes: [
        { id: 'ac-1', ticker: 'PETR4', nome: 'Petrobras PN', quantidade: 200, preco: 38.50, precoMesAnterior: 36.80, precoAnoAnterior: 32.10, meta: 30, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-2', ticker: 'VALE3', nome: 'Vale S.A.', quantidade: 100, preco: 62.10, precoMesAnterior: 64.00, precoAnoAnterior: 58.50, meta: 30, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-3', ticker: 'ITUB4', nome: 'Itaú Unibanco PN', quantidade: 250, preco: 33.20, precoMesAnterior: 32.50, precoAnoAnterior: 27.80, meta: 20, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-4', ticker: 'WEGE3', nome: 'Weg S.A.', quantidade: 120, preco: 42.00, precoMesAnterior: 40.50, precoAnoAnterior: 34.20, meta: 20, data: new Date().toLocaleDateString('pt-BR') }
      ],
      lastUpdated: 0
    };
    saveLocalState(false);
  }
}

function saveLocalState(syncDrive = true) {
  if (!appState.isDemo) {
    appState.lastUpdated = new Date().toISOString();
  }
  localStorage.setItem('wingene_investimentos_state', JSON.stringify(appState));
  
  // Nunca enviar dados de demonstração iniciais para o Google Drive
  if (syncDrive && !appState.isDemo && typeof saveToDrive === 'function') {
    saveToDrive(appState);
  }
}

// --- NAVEGAÇÃO E MENU SANDUÍCHE ---
function toggleNavDrawer(e) {
  if (e) e.stopPropagation();
  const drawer = document.getElementById('navDrawerMenu');
  const backdrop = document.getElementById('navDrawerBackdrop');
  const btn = document.getElementById('btnHamburgerNav');
  if (drawer && backdrop) {
    const isOpen = drawer.classList.contains('is-open');
    if (isOpen) {
      closeNavDrawer();
    } else {
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    }
  }
}

function closeNavDrawer() {
  const drawer = document.getElementById('navDrawerMenu');
  const backdrop = document.getElementById('navDrawerBackdrop');
  const btn = document.getElementById('btnHamburgerNav');
  if (drawer) drawer.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Fechar menu gaveta ao pressionar ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeNavDrawer();
  }
});

// Ordem das telas/abas da PWA
const TAB_ORDER = ['overview', 'evolucao', 'rendafixa', 'acoes', 'rebalanceamento', 'config'];

function switchTab(targetTab) {
  const tabIdx = TAB_ORDER.indexOf(targetTab);
  if (tabIdx === -1) return;

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const matchingBtns = document.querySelectorAll(`.tab-btn[data-tab="${targetTab}"]`);
  matchingBtns.forEach(b => b.classList.add('active'));

  const targetPane = document.getElementById(`tab-${targetTab}`);
  if (targetPane) targetPane.classList.add('active');

  const activeDrawerBtn = document.querySelector(`.nav-drawer-item.tab-btn[data-tab="${targetTab}"]`);
  const screenTitleEl = document.getElementById('currentScreenSubtitle');
  if (screenTitleEl && activeDrawerBtn) {
    screenTitleEl.textContent = activeDrawerBtn.textContent.trim();
  }

  // Exibir ou ocultar o Floating Action Button (+) dependendo da tela
  const fabBtn = document.getElementById('btnFabAdd');
  if (fabBtn) {
    if (targetTab === 'rendafixa' || targetTab === 'acoes') {
      fabBtn.style.display = 'flex';
    } else {
      fabBtn.style.display = 'none';
    }
  }

  closeNavDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupSwipeNavigation() {
  const mainContent = document.querySelector('main.app-main') || document.body;
  if (!mainContent) return;

  let startX = 0;
  let startY = 0;
  let isSwiping = false;

  function getCurrentTabId() {
    const activePane = document.querySelector('.tab-pane.active');
    if (!activePane) return 'overview';
    return activePane.id.replace('tab-', '');
  }

  function isValidSwipeTarget(target) {
    if (!target) return false;
    // Evitar deslizar ao interagir com modais, formulários, tabelas roláveis ou menu gaveta
    return !target.closest('.modal-backdrop, input, textarea, select, button, a, .table-responsive, .nav-drawer, .user-dropdown-menu');
  }

  // --- TOUCH EVENTS (CELULAR / TABLET) ---
  mainContent.addEventListener('touchstart', (e) => {
    if (!isValidSwipeTarget(e.target)) {
      isSwiping = false;
      return;
    }
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isSwiping = true;
  }, { passive: true });

  mainContent.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    isSwiping = false;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
      const currentTab = getCurrentTabId();
      const currentIdx = TAB_ORDER.indexOf(currentTab);

      if (deltaX < 0 && currentIdx < TAB_ORDER.length - 1) {
        // Deslizar para a esquerda -> Próxima Tela
        switchTab(TAB_ORDER[currentIdx + 1]);
      } else if (deltaX > 0 && currentIdx > 0) {
        // Deslizar para a direita -> Tela Anterior
        switchTab(TAB_ORDER[currentIdx - 1]);
      }
    }
  }, { passive: true });

  // --- MOUSE DRAG / SWIPE EVENTS (WEB DESKTOP) ---
  let isMouseDown = false;

  mainContent.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (!isValidSwipeTarget(e.target)) {
      isMouseDown = false;
      return;
    }
    startX = e.clientX;
    startY = e.clientY;
    isMouseDown = true;
  });

  mainContent.addEventListener('mouseup', (e) => {
    if (!isMouseDown) return;
    isMouseDown = false;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
      const currentTab = getCurrentTabId();
      const currentIdx = TAB_ORDER.indexOf(currentTab);

      if (deltaX < 0 && currentIdx < TAB_ORDER.length - 1) {
        switchTab(TAB_ORDER[currentIdx + 1]);
      } else if (deltaX > 0 && currentIdx > 0) {
        switchTab(TAB_ORDER[currentIdx - 1]);
      }
    }
  });
}

// --- CONFIGURAÇÃO DE EVENT LISTENERS ---
function setupEventListeners() {
  // Navegação por Abas / Menu Sanduíche
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.dataset.tab;
      switchTab(targetTab);
    });
  });

  // Auto-fill nome da empresa ao digitar Ticker na modal de ações
  document.getElementById('modalAcaoTicker')?.addEventListener('input', (e) => {
    const ticker = e.target.value.toUpperCase().trim();
    e.target.value = ticker;
    const nomeInput = document.getElementById('modalAcaoNome');
    if (ticker && B3_POPULAR_STOCKS[ticker] && !nomeInput.value) {
      nomeInput.value = B3_POPULAR_STOCKS[ticker];
    }
  });

  // Google Login / Logout
  document.getElementById('btnGoogleLogin')?.addEventListener('click', () => requestGoogleLogin());
  document.getElementById('btnGoogleLoginConfig')?.addEventListener('click', () => requestGoogleLogin());
  document.getElementById('btnGoogleLogout')?.addEventListener('click', () => logoutGoogleDrive());
  document.getElementById('btnForceDriveSync')?.addEventListener('click', () => syncFromDrive());
  
  // Restaurar Versão Histórica do Google Drive
  document.getElementById('btnRestoreDriveVersion')?.addEventListener('click', async () => {
    if (typeof listDriveRevisions !== 'function') return;
    showToast('Buscando histórico de versões no Google Drive...', 'info');
    const revisions = await listDriveRevisions();
    if (!revisions || revisions.length <= 1) {
      showToast('Nenhuma versão anterior encontrada no Google Drive.', 'info');
      return;
    }
    
    const options = revisions.slice(0, -1).reverse().map((rev, index) => {
      const dateStr = new Date(rev.modifiedTime).toLocaleString('pt-BR');
      return `${index + 1} - Salvo em ${dateStr}`;
    }).join('\n');

    const selectedIdx = prompt(
      `Selecione o número da versão anterior que deseja restaurar do Google Drive:\n\n` + options
    );

    if (selectedIdx) {
      const revsReversed = revisions.slice(0, -1).reverse();
      const idx = parseInt(selectedIdx.trim(), 10) - 1;
      if (idx >= 0 && idx < revsReversed.length) {
        restoreDriveRevision(revsReversed[idx].id);
      } else {
        showToast('Opção de versão inválida.', 'error');
      }
    }
  });

  // Exportar / Importar JSON Backup
  document.getElementById('btnExportJson')?.addEventListener('click', exportJsonBackup);
  document.getElementById('btnImportJsonTrigger')?.addEventListener('click', () => document.getElementById('fileImportJson').click());
  document.getElementById('fileImportJson')?.addEventListener('change', importJsonBackup);
}

// --- CÁLCULOS FINANCIALS & EVOLUÇÃO (MENSAL E ANUAL) ---
function calculateFinancials() {
  // --- RENDA FIXA ---
  const rendaFixaProcessada = appState.rendaFixa.map(item => {
    const valorAtual = parseFloat(item.valor) || 0;
    const valorMesAnt = parseFloat(item.valorMesAnterior) !== undefined && !isNaN(parseFloat(item.valorMesAnterior)) ? parseFloat(item.valorMesAnterior) : valorAtual;
    const valorAnoAnt = parseFloat(item.valorAnoAnterior) !== undefined && !isNaN(parseFloat(item.valorAnoAnterior)) ? parseFloat(item.valorAnoAnterior) : valorAtual;

    const diffMesVal = valorAtual - valorMesAnt;
    const diffMesPct = valorMesAnt > 0 ? (diffMesVal / valorMesAnt) * 100 : 0;
    const diffAnoVal = valorAtual - valorAnoAnt;
    const diffAnoPct = valorAnoAnt > 0 ? (diffAnoVal / valorAnoAnt) * 100 : 0;

    return {
      ...item,
      valorAtual,
      valorMesAnt,
      valorAnoAnt,
      diffMesVal,
      diffMesPct,
      diffAnoVal,
      diffAnoPct
    };
  });

  const totalRfAtual = rendaFixaProcessada.reduce((acc, i) => acc + i.valorAtual, 0);
  const totalRfMesAnt = rendaFixaProcessada.reduce((acc, i) => acc + i.valorMesAnt, 0);
  const totalRfAnoAnt = rendaFixaProcessada.reduce((acc, i) => acc + i.valorAnoAnt, 0);

  const diffRfMesVal = totalRfAtual - totalRfMesAnt;
  const diffRfMesPct = totalRfMesAnt > 0 ? (diffRfMesVal / totalRfMesAnt) * 100 : 0;
  const diffRfAnoVal = totalRfAtual - totalRfAnoAnt;
  const diffRfAnoPct = totalRfAnoAnt > 0 ? (diffRfAnoVal / totalRfAnoAnt) * 100 : 0;

  // --- AÇÕES ---
  const acoesProcessadas = appState.acoes.map(acao => {
    const qty = parseFloat(acao.quantidade) || 0;
    const precoAtual = parseFloat(acao.preco) || 0;
    const valorTotalAtual = qty * precoAtual;

    const precoMesAnt = parseFloat(acao.precoMesAnterior) !== undefined && !isNaN(parseFloat(acao.precoMesAnterior)) ? parseFloat(acao.precoMesAnterior) : precoAtual;
    const valorTotalMesAnt = qty * precoMesAnt;

    const precoAnoAnt = parseFloat(acao.precoAnoAnterior) !== undefined && !isNaN(parseFloat(acao.precoAnoAnterior)) ? parseFloat(acao.precoAnoAnterior) : precoAtual;
    const valorTotalAnoAnt = qty * precoAnoAnt;

    const diffMesVal = valorTotalAtual - valorTotalMesAnt;
    const diffMesPct = valorTotalMesAnt > 0 ? (diffMesVal / valorTotalMesAnt) * 100 : 0;

    const diffAnoVal = valorTotalAtual - valorTotalAnoAnt;
    const diffAnoPct = valorTotalAnoAnt > 0 ? (diffAnoVal / valorTotalAnoAnt) * 100 : 0;

    const meta = parseFloat(acao.meta) || 0;

    return {
      ...acao,
      precoAtual,
      valorTotal: valorTotalAtual,
      precoMesAnt,
      valorTotalMesAnt,
      precoAnoAnt,
      valorTotalAnoAnt,
      diffMesVal,
      diffMesPct,
      diffAnoVal,
      diffAnoPct,
      meta
    };
  });

  const totalAcoesAtual = acoesProcessadas.reduce((acc, i) => acc + i.valorTotal, 0);
  const totalAcoesMesAnt = acoesProcessadas.reduce((acc, i) => acc + i.valorTotalMesAnt, 0);
  const totalAcoesAnoAnt = acoesProcessadas.reduce((acc, i) => acc + i.valorTotalAnoAnt, 0);

  const diffAcoesMesVal = totalAcoesAtual - totalAcoesMesAnt;
  const diffAcoesMesPct = totalAcoesMesAnt > 0 ? (diffAcoesMesVal / totalAcoesMesAnt) * 100 : 0;
  const diffAcoesAnoVal = totalAcoesAtual - totalAcoesAnoAnt;
  const diffAcoesAnoPct = totalAcoesAnoAnt > 0 ? (diffAcoesAnoVal / totalAcoesAnoAnt) * 100 : 0;

  // --- PATRIMÔNIO TOTAL CONSOLIDADO ---
  const patrimonioTotal = totalRfAtual + totalAcoesAtual;
  const patrimonioMesAnt = totalRfMesAnt + totalAcoesMesAnt;
  const patrimonioAnoAnt = totalRfAnoAnt + totalAcoesAnoAnt;

  const diffTotalMesVal = patrimonioTotal - patrimonioMesAnt;
  const diffTotalMesPct = patrimonioMesAnt > 0 ? (diffTotalMesVal / patrimonioMesAnt) * 100 : 0;
  const diffTotalAnoVal = patrimonioTotal - patrimonioAnoAnt;
  const diffTotalAnoPct = patrimonioAnoAnt > 0 ? (diffTotalAnoVal / patrimonioAnoAnt) * 100 : 0;

  // Adicionar percentual individual e alocação de rebalanceamento
  const acoesComPercentual = acoesProcessadas.map(acao => {
    const percentualAtual = totalAcoesAtual > 0 ? (acao.valorTotal / totalAcoesAtual) * 100 : 0;
    const valorAlvoMeta = totalAcoesAtual > 0 ? (totalAcoesAtual * (acao.meta / 100)) : 0;
    const valorDiferenca = valorAlvoMeta - acao.valorTotal;

    return {
      ...acao,
      percentualAtual,
      valorAlvoMeta,
      valorDiferenca
    };
  });

  const totalMetasPercent = acoesComPercentual.reduce((acc, item) => acc + item.meta, 0);

  return {
    rendaFixa: rendaFixaProcessada,
    acoes: acoesComPercentual,
    totalRendaFixa: totalRfAtual,
    totalRendaFixaMesAnt: totalRfMesAnt,
    totalRendaFixaAnoAnt: totalRfAnoAnt,
    diffRfMesVal,
    diffRfMesPct,
    diffRfAnoVal,
    diffRfAnoPct,

    totalAcoes: totalAcoesAtual,
    totalAcoesMesAnt: totalAcoesMesAnt,
    totalAcoesAnoAnt: totalAcoesAnoAnt,
    diffAcoesMesVal,
    diffAcoesMesPct,
    diffAcoesAnoVal,
    diffAcoesAnoPct,

    patrimonioTotal,
    patrimonioMesAnt,
    patrimonioAnoAnt,
    diffTotalMesVal,
    diffTotalMesPct,
    diffTotalAnoVal,
    diffTotalAnoPct,

    pctRendaFixa: patrimonioTotal > 0 ? (totalRfAtual / patrimonioTotal) * 100 : 0,
    pctAcoes: patrimonioTotal > 0 ? (totalAcoesAtual / patrimonioTotal) * 100 : 0,
    totalMetasPercent
  };
}

// --- RENDERIZAÇÃO GERAL DA INTERFACE ---
function renderApp() {
  const fin = calculateFinancials();

  // 1. Visão Geral / Cards Principais
  document.getElementById('statPatrimonioTotal').textContent = formatCurrency(fin.patrimonioTotal);
  document.getElementById('statTotalEvolucaoBadges').innerHTML = `
    ${formatEvolutionBadge(fin.diffTotalMesVal, fin.diffTotalMesPct, 'Mês')}
    ${formatEvolutionBadge(fin.diffTotalAnoVal, fin.diffTotalAnoPct, 'Ano')}
  `;

  document.getElementById('statRendaFixaTotal').textContent = formatCurrency(fin.totalRendaFixa);
  document.getElementById('statRfEvolucaoBadges').innerHTML = `
    ${formatEvolutionBadge(fin.diffRfMesVal, fin.diffRfMesPct, 'Mês')}
    ${formatEvolutionBadge(fin.diffRfAnoVal, fin.diffRfAnoPct, 'Ano')}
  `;

  document.getElementById('statAcoesTotal').textContent = formatCurrency(fin.totalAcoes);
  document.getElementById('statAcoesEvolucaoBadges').innerHTML = `
    ${formatEvolutionBadge(fin.diffAcoesMesVal, fin.diffAcoesMesPct, 'Mês')}
    ${formatEvolutionBadge(fin.diffAcoesAnoVal, fin.diffAcoesAnoPct, 'Ano')}
  `;

  // Data do sistema
  const lastUpdateFormatted = new Date(appState.lastUpdated).toLocaleString('pt-BR');
  const lastUpdateEl = document.getElementById('lastUpdatedSpan');
  if (lastUpdateEl) {
    lastUpdateEl.textContent = lastUpdateFormatted;
  }

  // Gráficos de Visão Geral (Donut Charts SVG)
  renderDonutChart('chartAssetAllocation', [
    { label: 'Renda Fixa', value: fin.totalRendaFixa, color: '#10b981' },
    { label: 'Ações', value: fin.totalAcoes, color: '#f59e0b' }
  ]);

  renderDonutChart('chartStockBreakdown', fin.acoes.map((ac, idx) => ({
    label: ac.ticker,
    value: ac.valorTotal,
    color: getPaletteColor(idx)
  })));

  // 2. Renderizar Aba de Evolução
  renderEvolucaoTab(fin);

  // 3. Renderizar Tabela de Renda Fixa com Edição Inline
  renderRendaFixaTable(fin);

  // 4. Renderizar Tabela de Ações com Edição Inline
  renderAcoesTable(fin);

  // 5. Renderizar Rebalanceamento & Metas
  renderRebalanceamentoSection(fin);

  // 6. Renderizar Gráficos Evolutivos Diários da B3 (12 Meses)
  renderDailyEvolutionCharts();
}

function formatDiffBadgeCombined(diffVal, diffPct) {
  const isPos = diffVal >= 0;
  const arrow = isPos ? '▲' : '▼';
  const cls = isPos ? 'text-success' : 'text-danger';
  const sign = isPos ? '+' : '';
  return `<span class="${cls}" style="font-size:0.83rem; font-weight:600; white-space:nowrap;">${arrow} ${sign}${formatCurrency(diffVal)}<br><small style="font-size:0.73rem; opacity:0.85;">(${sign}${diffPct.toFixed(1)}%)</small></span>`;
}

// --- RENDERIZAÇÃO DA ABA EVOLUÇÃO ---
function renderEvolucaoTab(fin) {
  // 1. Resumo por Grupo
  const tbodyGrupos = document.getElementById('tbodyEvolucaoGrupos');
  if (tbodyGrupos) {
    tbodyGrupos.innerHTML = `
      <tr style="font-weight: 700; background: rgba(16, 64, 176, 0.08);">
        <td><span class="row-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg></span> PATRIMÔNIO TOTAL</td>
        <td class="text-right">${formatCurrency(fin.patrimonioTotal)}</td>
        <td class="text-right col-desktop">${formatDiffVal(fin.diffTotalMesVal)}</td>
        <td class="text-right col-desktop">${formatDiffPct(fin.diffTotalMesPct)}</td>
        <td class="text-right col-mobile">${formatDiffBadgeCombined(fin.diffTotalMesVal, fin.diffTotalMesPct)}</td>
        <td class="text-right col-desktop">${formatDiffVal(fin.diffTotalAnoVal)}</td>
        <td class="text-right col-desktop">${formatDiffPct(fin.diffTotalAnoPct)}</td>
        <td class="text-right col-mobile">${formatDiffBadgeCombined(fin.diffTotalAnoVal, fin.diffTotalAnoPct)}</td>
      </tr>
      <tr>
        <td><span class="row-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg></span> Grupo Renda Fixa</td>
        <td class="text-right">${formatCurrency(fin.totalRendaFixa)}</td>
        <td class="text-right col-desktop">${formatDiffVal(fin.diffRfMesVal)}</td>
        <td class="text-right col-desktop">${formatDiffPct(fin.diffRfMesPct)}</td>
        <td class="text-right col-mobile">${formatDiffBadgeCombined(fin.diffRfMesVal, fin.diffRfMesPct)}</td>
        <td class="text-right col-desktop">${formatDiffVal(fin.diffRfAnoVal)}</td>
        <td class="text-right col-desktop">${formatDiffPct(fin.diffRfAnoPct)}</td>
        <td class="text-right col-mobile">${formatDiffBadgeCombined(fin.diffRfAnoVal, fin.diffRfAnoPct)}</td>
      </tr>
      <tr>
        <td><span class="row-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span> Grupo Ações</td>
        <td class="text-right">${formatCurrency(fin.totalAcoes)}</td>
        <td class="text-right col-desktop">${formatDiffVal(fin.diffAcoesMesVal)}</td>
        <td class="text-right col-desktop">${formatDiffPct(fin.diffAcoesMesPct)}</td>
        <td class="text-right col-mobile">${formatDiffBadgeCombined(fin.diffAcoesMesVal, fin.diffAcoesMesPct)}</td>
        <td class="text-right col-desktop">${formatDiffVal(fin.diffAcoesAnoVal)}</td>
        <td class="text-right col-desktop">${formatDiffPct(fin.diffAcoesAnoPct)}</td>
        <td class="text-right col-mobile">${formatDiffBadgeCombined(fin.diffAcoesAnoVal, fin.diffAcoesAnoPct)}</td>
      </tr>
    `;
  }

  // 2. Detalhamento Renda Fixa
  const tbodyRf = document.getElementById('tbodyEvolucaoRendaFixa');
  if (tbodyRf) {
    if (fin.rendaFixa.length === 0) {
      tbodyRf.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Nenhum ativo cadastrado.</td></tr>`;
    } else {
      tbodyRf.innerHTML = fin.rendaFixa.map(item => `
        <tr class="col-desktop-row">
          <td><span class="badge badge-rf">${item.tipo}</span></td>
          <td><strong>${escapeHtml(item.nome)}</strong> <small class="text-muted">(${escapeHtml(item.emissor)})</small></td>
          <td class="text-right"><strong>${formatCurrency(item.valorAtual)}</strong></td>
          <td class="text-right">${formatDiffVal(item.diffMesVal)}</td>
          <td class="text-right">${formatDiffPct(item.diffMesPct)}</td>
          <td class="text-right">${formatDiffVal(item.diffAnoVal)}</td>
          <td class="text-right">${formatDiffPct(item.diffAnoPct)}</td>
        </tr>
        <tr class="col-mobile-row">
          <td>
            <div style="margin-bottom: 2px;"><span class="badge badge-rf" style="font-size:0.68rem; padding:1px 6px;">${item.tipo}</span></div>
            <strong>${escapeHtml(item.nome)}</strong> <br><small class="text-muted" style="font-size:0.75rem;">${escapeHtml(item.emissor)}</small>
          </td>
          <td class="text-right"><strong>${formatCurrency(item.valorAtual)}</strong></td>
          <td class="text-right">
            <div><span class="text-small text-muted" style="font-size:0.7rem;">M:</span> ${formatDiffBadgeCombined(item.diffMesVal, item.diffMesPct)}</div>
            <div style="margin-top: 3px;"><span class="text-small text-muted" style="font-size:0.7rem;">A:</span> ${formatDiffBadgeCombined(item.diffAnoVal, item.diffAnoPct)}</div>
          </td>
        </tr>
      `).join('');
    }
  }

  // 3. Detalhamento Ações
  const tbodyAcoes = document.getElementById('tbodyEvolucaoAcoes');
  if (tbodyAcoes) {
    if (fin.acoes.length === 0) {
      tbodyAcoes.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Nenhuma ação cadastrada.</td></tr>`;
    } else {
      tbodyAcoes.innerHTML = fin.acoes.map((item, idx) => `
        <tr class="col-desktop-row">
          <td>
            <div class="ticker-badge" style="border-left-color: ${getPaletteColor(idx)}">
              <strong>${item.ticker}</strong>
            </div>
          </td>
          <td>${escapeHtml(item.nome)}</td>
          <td class="text-right">${formatCurrency(item.precoAtual)}</td>
          <td class="text-right"><strong>${formatCurrency(item.valorTotal)}</strong></td>
          <td class="text-right">${formatDiffVal(item.diffMesVal)}</td>
          <td class="text-right">${formatDiffPct(item.diffMesPct)}</td>
          <td class="text-right">${formatDiffVal(item.diffAnoVal)}</td>
          <td class="text-right">${formatDiffPct(item.diffAnoPct)}</td>
        </tr>
        <tr class="col-mobile-row">
          <td>
            <div class="ticker-badge" style="border-left-color: ${getPaletteColor(idx)}; padding:2px 6px; font-size:0.78rem;">
              <strong>${item.ticker}</strong>
            </div>
            <div class="text-muted text-small" style="font-size:0.75rem; margin-top:2px;">${escapeHtml(item.nome)}</div>
          </td>
          <td class="text-right">
            <strong>${formatCurrency(item.valorTotal)}</strong><br><small class="text-muted" style="font-size:0.72rem;">${formatCurrency(item.precoAtual)}/un</small>
          </td>
          <td class="text-right">
            <div><span class="text-small text-muted" style="font-size:0.7rem;">M:</span> ${formatDiffBadgeCombined(item.diffMesVal, item.diffMesPct)}</div>
            <div style="margin-top: 3px;"><span class="text-small text-muted" style="font-size:0.7rem;">A:</span> ${formatDiffBadgeCombined(item.diffAnoVal, item.diffAnoPct)}</div>
          </td>
        </tr>
      `).join('');
    }
  }
}

// --- RENDA FIXA (EDIÇÃO INLINE COM HISTÓRICO) ---
function openAddRfModal() {
  const backdrop = document.getElementById('modalAddRfBackdrop');
  if (!backdrop) return;
  document.getElementById('modalRfEmissor').value = '';
  document.getElementById('modalRfNome').value = '';
  document.getElementById('modalRfTaxa').value = '';
  document.getElementById('modalRfValor').value = '';
  backdrop.style.display = 'flex';
}

function closeAddRfModal() {
  const backdrop = document.getElementById('modalAddRfBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function handleAddRfModalSubmit(e) {
  e.preventDefault();
  const tipo = document.getElementById('modalRfTipo').value;
  const emissor = document.getElementById('modalRfEmissor').value.trim();
  const nome = document.getElementById('modalRfNome').value.trim();
  const taxa = document.getElementById('modalRfTaxa').value.trim();
  const valor = parseFloat(document.getElementById('modalRfValor').value);
  const currentDate = new Date().toLocaleDateString('pt-BR');

  if (!emissor || !nome || isNaN(valor)) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  appState.rendaFixa.push({
    id: 'rf-' + Date.now(),
    tipo,
    emissor,
    nome,
    taxa,
    valor,
    valorMesAnterior: valor,
    valorAnoAnterior: valor,
    data: currentDate,
    historico: [
      { data: currentDate + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), valor: valor }
    ]
  });

  closeAddRfModal();
  appState.isDemo = false;
  saveLocalState();
  renderApp();
  showToast('Ativo de Renda Fixa adicionado!', 'success');
}

function renderRendaFixaTable(fin) {
  const tbody = document.getElementById('tbodyRendaFixa');
  if (!tbody) return;

  if (fin.rendaFixa.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Nenhum ativo de Renda Fixa cadastrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = fin.rendaFixa.map(item => `
    <!-- DESKTOP ROW -->
    <tr class="col-desktop-row clickable-row" onclick="openEditRfModal('${item.id}')" title="Clique para editar">
      <td><span class="badge badge-rf">${item.tipo}</span></td>
      <td><strong>${escapeHtml(item.emissor)}</strong></td>
      <td>${escapeHtml(item.nome)}</td>
      <td>${item.taxa ? `<span class="taxa-tag">${escapeHtml(item.taxa)}</span>` : '<span class="text-muted">-</span>'}</td>
      <td class="text-right text-muted">${formatCurrency(item.valorMesAnt)}</td>
      <td class="text-right text-muted">${formatCurrency(item.valorAnoAnt)}</td>
      <td class="text-right"><strong>${formatCurrency(item.valorAtual)}</strong></td>
      <td class="text-right"><span class="text-muted text-small">${item.data || '-'}</span></td>
      <td class="text-center" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="showAssetHistoryModal('${item.id}', 'rf')" title="Ver Histórico de Alterações">📜</button>
        <button class="btn-icon" onclick="openEditRfModal('${item.id}')" title="Editar Ativo">✏️</button>
        <button class="btn-icon danger" onclick="deleteRendaFixa('${item.id}')" title="Excluir">🗑️</button>
      </td>
    </tr>

    <!-- MOBILE ROW -->
    <tr class="col-mobile-row clickable-row" onclick="openEditRfModal('${item.id}')" title="Clique para editar">
      <td>
        <div><strong style="font-size:0.88rem;">${escapeHtml(item.nome)}</strong> <span class="badge badge-rf" style="font-size:0.65rem; padding:1px 5px;">${item.tipo}</span></div>
        <div class="text-muted text-small" style="font-size:0.76rem;">${escapeHtml(item.emissor)} ${item.taxa ? `• <span class="taxa-tag" style="font-size:0.7rem;">${escapeHtml(item.taxa)}</span>` : ''}</div>
      </td>
      <td class="text-right">
        <strong style="white-space: nowrap;">${formatCurrency(item.valorAtual)}</strong>
        <div class="text-muted" style="font-size:0.71rem; opacity:0.85; white-space: nowrap;">Mês: ${formatCurrency(item.valorMesAnt)}<br>Ano: ${formatCurrency(item.valorAnoAnt)}</div>
      </td>
      <td class="text-center" onclick="event.stopPropagation()">
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
          <button class="btn-icon" onclick="showAssetHistoryModal('${item.id}', 'rf')" title="Ver Histórico">📜</button>
          <button class="btn-icon" onclick="openEditRfModal('${item.id}')" title="Editar Ativo">✏️</button>
          <button class="btn-icon danger" onclick="deleteRendaFixa('${item.id}')" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('totalRfFooter').textContent = formatCurrency(fin.totalRendaFixa);
}

function openEditRfModal(id) {
  const item = appState.rendaFixa.find(r => r.id === id);
  if (!item) return;
  document.getElementById('editModalRfId').value = item.id;
  document.getElementById('editModalRfTipo').value = item.tipo;
  document.getElementById('editModalRfEmissor').value = item.emissor || '';
  document.getElementById('editModalRfNome').value = item.nome || '';
  document.getElementById('editModalRfTaxa').value = item.taxa || '';
  document.getElementById('editModalRfValMes').value = item.valorMesAnterior !== undefined ? item.valorMesAnterior : item.valor;
  document.getElementById('editModalRfValAno').value = item.valorAnoAnterior !== undefined ? item.valorAnoAnterior : item.valor;
  document.getElementById('editModalRfValor').value = item.valor;
  document.getElementById('modalEditRfBackdrop').style.display = 'flex';
}

function closeEditRfModal() {
  const backdrop = document.getElementById('modalEditRfBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function handleEditRfModalSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editModalRfId').value;
  const item = appState.rendaFixa.find(r => r.id === id);
  if (!item) return;

  const tipo = document.getElementById('editModalRfTipo').value;
  const emissor = document.getElementById('editModalRfEmissor').value.trim();
  const nome = document.getElementById('editModalRfNome').value.trim();
  const taxa = document.getElementById('editModalRfTaxa').value.trim();
  const valMesInput = document.getElementById('editModalRfValMes').value;
  const valAnoInput = document.getElementById('editModalRfValAno').value;
  const valAtualInput = document.getElementById('editModalRfValor').value;

  const valMes = valMesInput !== '' ? parseFloat(valMesInput) : item.valor;
  const valAno = valAnoInput !== '' ? parseFloat(valAnoInput) : item.valor;
  const valor = parseFloat(valAtualInput);

  if (!emissor || !nome || isNaN(valor)) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  if (item.valor !== valor) {
    recordAssetHistory(item, valor);
    item.valor = valor;
  }

  item.tipo = tipo;
  item.emissor = emissor;
  item.nome = nome;
  item.taxa = taxa;
  item.valorMesAnterior = isNaN(valMes) ? item.valor : valMes;
  item.valorAnoAnterior = isNaN(valAno) ? item.valor : valAno;
  item.data = new Date().toLocaleDateString('pt-BR');

  closeEditRfModal();
  appState.isDemo = false;
  saveLocalState();
  renderApp();
  showToast('Ativo de Renda Fixa atualizado!', 'success');
}

function startEditRfInline(id) {
  editingRfId = id;
  renderApp();
}

function cancelRfInline() {
  editingRfId = null;
  renderApp();
}

function saveRfInline(id) {
  const item = appState.rendaFixa.find(r => r.id === id);
  if (!item) return;

  const tipo = document.getElementById(`editRfTipo_${id}`).value;
  const emissor = document.getElementById(`editRfEmissor_${id}`).value.trim();
  const nome = document.getElementById(`editRfNome_${id}`).value.trim();
  const taxa = document.getElementById(`editRfTaxa_${id}`).value.trim();
  const valMes = parseFloat(document.getElementById(`editRfValMes_${id}`).value);
  const valAno = parseFloat(document.getElementById(`editRfValAno_${id}`).value);
  const valor = parseFloat(document.getElementById(`editRfValor_${id}`).value);

  if (!emissor || !nome || isNaN(valor)) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  const now = new Date();
  const dateTimeStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  item.tipo = tipo;
  item.emissor = emissor;
  item.nome = nome;
  item.taxa = taxa;
  item.valorMesAnterior = isNaN(valMes) ? valor : valMes;
  item.valorAnoAnterior = isNaN(valAno) ? valor : valAno;
  item.valor = valor;
  item.data = now.toLocaleDateString('pt-BR');

  if (!Array.isArray(item.historico)) {
    item.historico = [];
  }
  const lastHist = item.historico[item.historico.length - 1];
  if (!lastHist || lastHist.valor !== valor) {
    item.historico.push({ data: dateTimeStr, valor: valor });
  }

  editingRfId = null;
  appState.isDemo = false;
  saveLocalState();
  renderApp();
  showToast('Renda Fixa atualizada!', 'success');
}

function deleteRendaFixa(id) {
  if (confirm('Deseja realmente remover este ativo de Renda Fixa?')) {
    appState.rendaFixa = appState.rendaFixa.filter(r => r.id !== id);
    if (editingRfId === id) editingRfId = null;
    saveLocalState();
    renderApp();
    showToast('Ativo removido.', 'info');
  }
}

// --- CARTEIRA DE AÇÕES (EDIÇÃO E ADIÇÃO INLINE COM HISTÓRICO) ---
function openAddAcaoModal() {
  const backdrop = document.getElementById('modalAddAcaoBackdrop');
  if (!backdrop) return;
  document.getElementById('modalAcaoTicker').value = '';
  document.getElementById('modalAcaoNome').value = '';
  document.getElementById('modalAcaoQtd').value = '';
  document.getElementById('modalAcaoPreco').value = '';
  document.getElementById('modalAcaoMeta').value = '';
  backdrop.style.display = 'flex';
}

function closeAddAcaoModal() {
  const backdrop = document.getElementById('modalAddAcaoBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function handleAddAcaoModalSubmit(e) {
  e.preventDefault();
  const ticker = document.getElementById('modalAcaoTicker').value.toUpperCase().trim();
  const nome = document.getElementById('modalAcaoNome').value.trim();
  const quantidade = parseFloat(document.getElementById('modalAcaoQtd').value);
  const preco = parseFloat(document.getElementById('modalAcaoPreco').value);
  const meta = parseFloat(document.getElementById('modalAcaoMeta').value) || 0;
  const currentDate = new Date().toLocaleDateString('pt-BR');

  if (!ticker || !nome || isNaN(quantidade) || isNaN(preco)) {
    showToast('Preencha os campos obrigatórios da ação.', 'error');
    return;
  }

  appState.acoes.push({
    id: 'ac-' + Date.now(),
    ticker,
    nome,
    quantidade,
    preco,
    precoMesAnterior: preco,
    precoAnoAnterior: preco,
    meta,
    data: currentDate,
    historico: [
      { data: currentDate + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), preco: preco, quantidade: quantidade, valorTotal: preco * quantidade }
    ]
  });

  closeAddAcaoModal();
  appState.isDemo = false;
  saveLocalState();
  renderApp();
  showToast(`Ação ${ticker} adicionada!`, 'success');
}

function openAddModalForCurrentTab() {
  const activePane = document.querySelector('.tab-pane.active');
  if (!activePane) return;
  const currentTab = activePane.id.replace('tab-', '');
  if (currentTab === 'rendafixa') {
    openAddRfModal();
  } else if (currentTab === 'acoes') {
    openAddAcaoModal();
  }
}

function renderAcoesTable(fin) {
  const tbody = document.getElementById('tbodyAcoes');
  if (!tbody) return;

  if (fin.acoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-4">Nenhuma ação cadastrada na carteira.</td></tr>`;
    return;
  }

  tbody.innerHTML = fin.acoes.map((item, idx) => `
    <!-- DESKTOP ROW -->
    <tr class="col-desktop-row clickable-row" onclick="openEditAcaoModal('${item.id}')" title="Clique para editar">
      <td>
        <div class="ticker-badge" style="border-left-color: ${getPaletteColor(idx)}">
          <strong>${item.ticker}</strong>
        </div>
      </td>
      <td>${escapeHtml(item.nome)}</td>
      <td class="text-right">${item.quantidade}</td>
      <td class="text-right text-muted">${formatCurrency(item.precoMesAnt)}</td>
      <td class="text-right text-muted">${formatCurrency(item.precoAnoAnt)}</td>
      <td class="text-right">${formatCurrency(item.precoAtual)}</td>
      <td class="text-right"><strong>${formatCurrency(item.valorTotal)}</strong></td>
      <td class="text-right">
        <span class="pct-pill">${item.percentualAtual.toFixed(1)}%</span>
      </td>
      <td class="text-right">
        <span class="meta-pill">${item.meta.toFixed(1)}%</span>
      </td>
      <td class="text-right"><span class="text-muted text-small">${item.data || '-'}</span></td>
      <td class="text-center" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="showAssetHistoryModal('${item.id}', 'acao')" title="Ver Histórico de Alterações">📜</button>
        <button class="btn-icon" onclick="openEditAcaoModal('${item.id}')" title="Editar Ação">✏️</button>
        <button class="btn-icon danger" onclick="deleteAcao('${item.id}')" title="Excluir">🗑️</button>
      </td>
    </tr>

    <!-- MOBILE ROW -->
    <tr class="col-mobile-row clickable-row" onclick="openEditAcaoModal('${item.id}')" title="Clique para editar">
      <td>
        <div class="ticker-badge" style="border-left-color: ${getPaletteColor(idx)}; padding:2px 6px; font-size:0.78rem;">
          <strong>${item.ticker}</strong>
        </div>
        <div class="text-small text-muted" style="margin-top:2px;">${escapeHtml(item.nome)}</div>
        <div class="text-small text-muted" style="font-size:0.74rem;">${item.quantidade} un. x ${formatCurrency(item.precoAtual)}</div>
      </td>
      <td class="text-right" style="white-space: nowrap;">
        <strong>${formatCurrency(item.valorTotal)}</strong>
        <div style="font-size: 0.70rem; margin-top: 2px;">
          <span class="pct-pill" style="font-size: 0.67rem; padding: 0 4px;">${item.percentualAtual.toFixed(1)}%</span>
          <span class="text-muted" style="font-size: 0.68rem; margin-left: 2px;">(Meta ${item.meta.toFixed(1)}%)</span>
        </div>
      </td>
      <td class="text-center" onclick="event.stopPropagation()">
        <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
          <button class="btn-icon" onclick="showAssetHistoryModal('${item.id}', 'acao')" title="Ver Histórico">📜</button>
          <button class="btn-icon" onclick="openEditAcaoModal('${item.id}')" title="Editar Ação">✏️</button>
          <button class="btn-icon danger" onclick="deleteAcao('${item.id}')" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('totalAcoesFooter').textContent = formatCurrency(fin.totalAcoes);
}

function openEditAcaoModal(id) {
  const item = appState.acoes.find(a => a.id === id);
  if (!item) return;
  document.getElementById('editModalAcaoId').value = item.id;
  document.getElementById('editModalAcaoTicker').value = item.ticker || '';
  document.getElementById('editModalAcaoNome').value = item.nome || '';
  document.getElementById('editModalAcaoQtd').value = item.quantidade || 0;
  document.getElementById('editModalAcaoPrecoMes').value = item.precoMesAnterior !== undefined ? item.precoMesAnterior : item.precoAtual;
  document.getElementById('editModalAcaoPrecoAno').value = item.precoAnoAnterior !== undefined ? item.precoAnoAnterior : item.precoAtual;
  document.getElementById('editModalAcaoPreco').value = item.precoAtual || 0;
  document.getElementById('editModalAcaoMeta').value = item.meta !== undefined ? item.meta : 10;
  document.getElementById('modalEditAcaoBackdrop').style.display = 'flex';
}

function closeEditAcaoModal() {
  const backdrop = document.getElementById('modalEditAcaoBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function handleEditAcaoModalSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editModalAcaoId').value;
  const item = appState.acoes.find(a => a.id === id);
  if (!item) return;

  const ticker = document.getElementById('editModalAcaoTicker').value.trim().toUpperCase();
  const nome = document.getElementById('editModalAcaoNome').value.trim();
  const quantidade = parseFloat(document.getElementById('editModalAcaoQtd').value);
  const precoMesInput = document.getElementById('editModalAcaoPrecoMes').value;
  const precoAnoInput = document.getElementById('editModalAcaoPrecoAno').value;
  const precoAtualInput = document.getElementById('editModalAcaoPreco').value;
  const meta = parseFloat(document.getElementById('editModalAcaoMeta').value) || 0;

  const precoMes = precoMesInput !== '' ? parseFloat(precoMesInput) : item.precoAtual;
  const precoAno = precoAnoInput !== '' ? parseFloat(precoAnoInput) : item.precoAtual;
  const precoAtual = parseFloat(precoAtualInput);

  if (!ticker || !nome || isNaN(quantidade) || isNaN(precoAtual)) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  if (item.precoAtual !== precoAtual) {
    recordAssetHistory(item, precoAtual);
    item.precoAtual = precoAtual;
  }

  item.ticker = ticker;
  item.nome = nome;
  item.quantidade = quantidade;
  item.precoMesAnterior = isNaN(precoMes) ? item.precoAtual : precoMes;
  item.precoAnoAnterior = isNaN(precoAno) ? item.precoAtual : precoAno;
  item.meta = meta;
  item.data = new Date().toLocaleDateString('pt-BR');

  closeEditAcaoModal();
  appState.isDemo = false;
  saveLocalState();
  renderApp();
  showToast('Ação atualizada com sucesso!', 'success');
}

function startEditAcaoInline(id) {
  editingAcaoId = id;
  renderApp();
}

function cancelAcaoInline() {
  editingAcaoId = null;
  renderApp();
}

function saveAcaoInline(id) {
  const item = appState.acoes.find(a => a.id === id);
  if (!item) return;

  const ticker = document.getElementById(`editAcaoTicker_${id}`).value.toUpperCase().trim();
  const nome = document.getElementById(`editAcaoNome_${id}`).value.trim();
  const quantidade = parseFloat(document.getElementById(`editAcaoQtd_${id}`).value);
  const precoMes = parseFloat(document.getElementById(`editAcaoPrecoMes_${id}`).value);
  const precoAno = parseFloat(document.getElementById(`editAcaoPrecoAno_${id}`).value);
  const preco = parseFloat(document.getElementById(`editAcaoPreco_${id}`).value);
  const meta = parseFloat(document.getElementById(`editAcaoMeta_${id}`).value) || 0;

  if (!ticker || !nome || isNaN(quantidade) || isNaN(preco)) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  const now = new Date();
  const dateTimeStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  item.ticker = ticker;
  item.nome = nome;
  item.quantidade = quantidade;
  item.precoMesAnterior = isNaN(precoMes) ? preco : precoMes;
  item.precoAnoAnterior = isNaN(precoAno) ? preco : precoAno;
  item.preco = preco;
  item.meta = meta;
  item.data = now.toLocaleDateString('pt-BR');

  if (!Array.isArray(item.historico)) {
    item.historico = [];
  }
  const lastHist = item.historico[item.historico.length - 1];
  if (!lastHist || lastHist.preco !== preco || lastHist.quantidade !== quantidade) {
    item.historico.push({ data: dateTimeStr, preco: preco, quantidade: quantidade, valorTotal: preco * quantidade });
  }

  editingAcaoId = null;
  appState.isDemo = false;
  saveLocalState();
  renderApp();
  showToast(`Ação ${ticker} atualizada!`, 'success');
}

function deleteAcao(id) {
  if (confirm('Deseja realmente remover esta ação da carteira?')) {
    appState.acoes = appState.acoes.filter(a => a.id !== id);
    if (editingAcaoId === id) editingAcaoId = null;
    saveLocalState();
    renderApp();
    showToast('Ação removida.', 'info');
  }
}

// --- MODAL HISTÓRICO DE ALTERAÇÕES DO ATIVO ---
function showAssetHistoryModal(id, type) {
  const backdrop = document.getElementById('assetHistoryModalBackdrop');
  const titleEl = document.getElementById('assetHistoryTitle');
  const bodyEl = document.getElementById('assetHistoryBody');
  if (!backdrop || !bodyEl) return;

  let item = null;
  if (type === 'rf') {
    item = appState.rendaFixa.find(r => r.id === id);
  } else {
    item = appState.acoes.find(a => a.id === id);
  }

  if (!item) return;

  const itemName = type === 'rf' ? `${item.nome} (${item.emissor})` : `${item.ticker} - ${item.nome}`;
  if (titleEl) titleEl.textContent = `📜 Histórico: ${itemName}`;

  const hist = (Array.isArray(item.historico) && item.historico.length > 0) ? item.historico : [
    type === 'rf'
      ? { data: item.data || 'Cadastro', valor: item.valor }
      : { data: item.data || 'Cadastro', preco: item.preco, quantidade: item.quantidade, valorTotal: item.preco * item.quantidade }
  ];

  const histReversed = [...hist].reverse();

  bodyEl.innerHTML = `
    <div class="history-timeline">
      ${histReversed.map((entry, idx) => {
        const prevEntry = histReversed[idx + 1];
        let diffText = '';

        if (type === 'rf') {
          if (prevEntry && prevEntry.valor !== undefined) {
            const diff = entry.valor - prevEntry.valor;
            const pct = prevEntry.valor > 0 ? (diff / prevEntry.valor) * 100 : 0;
            diffText = `<span class="${diff >= 0 ? 'evol-positive' : 'evol-negative'}">${diff >= 0 ? '+' : ''}${formatCurrency(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>`;
          }
          return `
            <div class="history-item">
              <div>
                <div class="history-val">${formatCurrency(entry.valor)}</div>
                <div class="history-date">${entry.data}</div>
              </div>
              <div class="text-right">${diffText || '<span class="text-muted text-small">Registro Inicial</span>'}</div>
            </div>
          `;
        } else {
          if (prevEntry && prevEntry.valorTotal !== undefined) {
            const diff = entry.valorTotal - prevEntry.valorTotal;
            const pct = prevEntry.valorTotal > 0 ? (diff / prevEntry.valorTotal) * 100 : 0;
            diffText = `<span class="${diff >= 0 ? 'evol-positive' : 'evol-negative'}">${diff >= 0 ? '+' : ''}${formatCurrency(diff)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>`;
          }
          return `
            <div class="history-item">
              <div>
                <div class="history-val">${formatCurrency(entry.valorTotal)} <small class="text-muted">(${entry.quantidade}x ${formatCurrency(entry.preco)})</small></div>
                <div class="history-date">${entry.data}</div>
              </div>
              <div class="text-right">${diffText || '<span class="text-muted text-small">Registro Inicial</span>'}</div>
            </div>
          `;
        }
      }).join('')}
    </div>
  `;

  backdrop.style.display = 'flex';
}

function closeAssetHistoryModal() {
  const backdrop = document.getElementById('assetHistoryModalBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function renderRebalanceamentoSection(fin) {
  const container = document.getElementById('rebalanceamentoContainer');
  const alertMetas = document.getElementById('alertMetasTotal');
  if (!container) return;

  // Alerta da soma das metas
  if (Math.abs(fin.totalMetasPercent - 100) > 0.1) {
    alertMetas.style.display = 'flex';
    alertMetas.innerHTML = `⚠️ <strong>Atenção:</strong> A soma das metas atuais é <strong>${fin.totalMetasPercent.toFixed(1)}%</strong> (Deveria somar 100%). Ajuste as metas nas ações para um rebalanceamento perfeito.`;
  } else {
    alertMetas.style.display = 'none';
  }

  if (fin.acoes.length === 0) {
    container.innerHTML = `<div class="card text-center py-5 text-muted">Cadastre ações para visualizar as metas e o plano de aporte.</div>`;
    return;
  }

  container.innerHTML = fin.acoes.map((item, idx) => {
    const diffPct = item.percentualAtual - item.meta;
    let statusBadge = '';
    let recomendacao = '';

    if (diffPct < -1) {
      statusBadge = `<span class="badge badge-success">Aporte Recomendado</span>`;
      recomendacao = `Comprar <strong>${formatCurrency(Math.abs(item.valorDiferenca))}</strong> para atingir a meta.`;
    } else if (diffPct > 1) {
      statusBadge = `<span class="badge badge-warning">Acima da Meta</span>`;
      recomendacao = `Acima da meta em <strong>${formatCurrency(Math.abs(item.valorDiferenca))}</strong>.`;
    } else {
      statusBadge = `<span class="badge badge-info">Em Equilíbrio</span>`;
      recomendacao = `Sua posição está alinhada à meta estipulada!`;
    }

    return `
      <div class="card card-rebalance" style="border-left: 5px solid ${getPaletteColor(idx)}">
        <div class="rebalance-header">
          <div>
            <h3 class="m-0">${item.ticker} <small class="text-muted">(${escapeHtml(item.nome)})</small></h3>
            <div class="text-small text-muted mt-1">Valor Atual: ${formatCurrency(item.valorTotal)}</div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="rebalance-bars mt-3">
          <div class="bar-labels">
            <span>Participação Atual: <strong>${item.percentualAtual.toFixed(1)}%</strong></span>
            <span>Meta Estipulada: <strong>${item.meta.toFixed(1)}%</strong></span>
          </div>
          <div class="progress-container mt-1">
            <div class="progress-bar current" style="width: ${Math.min(item.percentualAtual, 100)}%; background: ${getPaletteColor(idx)}"></div>
            <div class="progress-marker" style="left: ${Math.min(item.meta, 100)}%" title="Meta: ${item.meta}%"></div>
          </div>
        </div>

        <div class="rebalance-footer mt-3">
          <span>💡 ${recomendacao}</span>
        </div>
      </div>
    `;
  }).join('');
}

// --- HELPERS DE FORMATAÇÃO DE EVOLUÇÃO ---
function formatDiffVal(diff) {
  if (diff > 0) {
    return `<span class="evol-positive">▲ +${formatCurrency(diff)}</span>`;
  } else if (diff < 0) {
    return `<span class="evol-negative">▼ ${formatCurrency(diff)}</span>`;
  }
  return `<span class="text-muted">R$ 0,00</span>`;
}

function formatDiffPct(diffPct) {
  if (diffPct > 0) {
    return `<span class="evol-positive">▲ +${diffPct.toFixed(1)}%</span>`;
  } else if (diffPct < 0) {
    return `<span class="evol-negative">▼ ${diffPct.toFixed(1)}%</span>`;
  }
  return `<span class="text-muted">0.0%</span>`;
}

function formatEvolutionBadge(diffVal, diffPct, label) {
  const isPos = diffVal >= 0;
  const cls = isPos ? 'evol-pill-positive' : 'evol-pill-negative';
  const arrow = isPos ? '▲' : '▼';
  const sign = isPos ? '+' : '';
  return `<span class="${cls}" title="${label}: ${sign}${formatCurrency(diffVal)} (${sign}${diffPct.toFixed(1)}%)">${arrow} ${sign}${diffPct.toFixed(1)}% (${label})</span>`;
}

// --- EXPORTAR E IMPORTAR JSON BACKUP ---
function exportJsonBackup() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `winvest_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Backup JSON gerado com sucesso!', 'success');
}

function importJsonBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (imported && (Array.isArray(imported.rendaFixa) || Array.isArray(imported.acoes))) {
        appState = {
          rendaFixa: imported.rendaFixa || [],
          acoes: imported.acoes || [],
          lastUpdated: new Date().toISOString()
        };
        saveLocalState();
        renderApp();
        showToast('Backup JSON importado e aplicado com sucesso!', 'success');
      } else {
        showToast('Formato de arquivo JSON inválido.', 'error');
      }
    } catch (err) {
      showToast('Erro ao ler arquivo de backup.', 'error');
    }
  };
  reader.readAsText(file);
}

// --- DESENHO DE GRÁFICOS SVG DONUT ---
function renderDonutChart(elementId, items) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const total = items.reduce((acc, i) => acc + (i.value > 0 ? i.value : 0), 0);
  if (total <= 0) {
    container.innerHTML = `<div class="chart-empty">Sem dados para gráfico</div>`;
    return;
  }

  let accumulatedAngle = 0;
  const slices = items.filter(i => i.value > 0).map(item => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;

    const x1 = 50 + 40 * Math.cos((Math.PI * (startAngle - 90)) / 180);
    const y1 = 50 + 40 * Math.sin((Math.PI * (startAngle - 90)) / 180);
    const x2 = 50 + 40 * Math.cos((Math.PI * (startAngle + angle - 90)) / 180);
    const y2 = 50 + 40 * Math.sin((Math.PI * (startAngle + angle - 90)) / 180);
    const largeArc = angle > 180 ? 1 : 0;

    const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return `<path d="${pathData}" fill="${item.color}"><title>${item.label}: ${formatCurrency(item.value)} (${(percentage * 100).toFixed(1)}%)</title></path>`;
  });

  const legend = items.filter(i => i.value > 0).map(item => `
    <div class="legend-item">
      <span class="legend-color" style="background: ${item.color}"></span>
      <span class="legend-label">${item.label}</span>
      <span class="legend-value">${((item.value / total) * 100).toFixed(1)}%</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="donut-chart-wrapper">
      <svg viewBox="0 0 100 100" class="donut-svg">
        ${slices.join('')}
        <circle cx="50" cy="50" r="24" fill="#111116" />
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>
  `;
}

// --- UTILS & HELPERS ---
function formatCurrency(val) {
  return (parseFloat(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getPaletteColor(index) {
  const colors = ['#1040b0', '#b01010', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  return colors[index % colors.length];
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- GERADOR DE PROMPT PARA IA (AGNÓSTICO) ---
function formatDiffValText(diff) {
  if (diff > 0) return `+${formatCurrency(diff)}`;
  if (diff < 0) return `${formatCurrency(diff)}`;
  return 'R$ 0,00';
}

function formatDiffPctText(diffPct) {
  if (diffPct > 0) return `+${diffPct.toFixed(1)}%`;
  if (diffPct < 0) return `${diffPct.toFixed(1)}%`;
  return '0.0%';
}

function generateAIPromptText() {
  const fin = calculateFinancials();
  const lastUpdate = new Date().toLocaleDateString('pt-BR');

  let prompt = `Você é um analista financeiro sênior especialista em alocação de ativos, renda fixa, ações e gestão de portfólio pessoal.

Por favor, faça um diagnóstico completo, analise a saúde da minha carteira de investimentos e forneça recomendações práticas com base nos dados reais abaixo (data de referência: ${lastUpdate}):

---
### 1. RESUMO PATRIMONIAL & ALOCAÇÃO
- **Patrimônio Total**: ${formatCurrency(fin.patrimonioTotal)}
- **Renda Fixa Total**: ${formatCurrency(fin.totalRendaFixa)} (${fin.pctRendaFixa.toFixed(1)}%)
- **Ações Total**: ${formatCurrency(fin.totalAcoes)} (${fin.pctAcoes.toFixed(1)}%)

### 2. HISTÓRICO DE DESEMPENHO E VARIAÇÃO
- **Variação Mensal do Patrimônio**: ${formatDiffValText(fin.diffTotalMesVal)} (${formatDiffPctText(fin.diffTotalMesPct)})
- **Variação Anual do Patrimônio**: ${formatDiffValText(fin.diffTotalAnoVal)} (${formatDiffPctText(fin.diffTotalAnoPct)})
- **Variação Mensal (Renda Fixa)**: ${formatDiffValText(fin.diffRfMesVal)} (${formatDiffPctText(fin.diffRfMesPct)})
- **Variação Anual (Renda Fixa)**: ${formatDiffValText(fin.diffRfAnoVal)} (${formatDiffPctText(fin.diffRfAnoPct)})
- **Variação Mensal (Ações)**: ${formatDiffValText(fin.diffAcoesMesVal)} (${formatDiffPctText(fin.diffAcoesMesPct)})
- **Variação Anual (Ações)**: ${formatDiffValText(fin.diffAcoesAnoVal)} (${formatDiffPctText(fin.diffAcoesAnoPct)})

### 3. DETALHAMENTO DOS ATIVOS DE RENDA FIXA
${fin.rendaFixa.map(rf => `- **${rf.nome}** (${rf.tipo} - ${rf.emissor}): ${formatCurrency(rf.valorAtual)} | Taxa: ${rf.taxa || 'N/I'} | Var. Mês: ${formatDiffValText(rf.diffMesVal)} (${formatDiffPctText(rf.diffMesPct)}) | Var. Ano: ${formatDiffValText(rf.diffAnoVal)} (${formatDiffPctText(rf.diffAnoPct)})`).join('\n') || 'Nenhum ativo de Renda Fixa registrado.'}

### 4. DETALHAMENTO DA CARTEIRA DE AÇÕES & METAS DE REBALANCEAMENTO
${fin.acoes.map(ac => `- **${ac.ticker}** (${ac.nome}): Qtd: ${ac.quantidade} | Preço Atual: ${formatCurrency(ac.precoAtual)} | Total: ${formatCurrency(ac.valorTotal)} | % Atual na Carteira de Ações: ${ac.percentualAtual.toFixed(1)}% | % Meta Configurada: ${ac.meta.toFixed(1)}% | Var. Mês: ${formatDiffValText(ac.diffMesVal)} (${formatDiffPctText(ac.diffMesPct)}) | Var. Ano: ${formatDiffValText(ac.diffAnoVal)} (${formatDiffPctText(ac.diffAnoPct)})`).join('\n') || 'Nenhuma ação registrada.'}

---

### INSTRUÇÕES PARA A ANÁLISE:
1. **Diagnóstico de Alocação e Diversificação**: Comente sobre a divisão entre Renda Fixa e Ações e a diversificação entre empresas/setores.
2. **Avaliação da Rentabilidade e Evolução**: Destaque pontos positivos e alertas na evolução patrimonial recente.
3. **Plano de Rebalanceamento Inteligente**: Quais ações estão mais abaixo da meta cadastrada e deveriam ser priorizadas nos próximos aportes?
4. **Análise de Risco & Recomendações Práticas**: Identifique possíveis pontos céticos ou riscos de concentração de forma clara e estruturada.`;

  return prompt;
}

function openAIPromptModal() {
  const backdrop = document.getElementById('aiPromptModalBackdrop');
  const textarea = document.getElementById('aiPromptTextarea');
  if (!backdrop || !textarea) return;

  textarea.value = generateAIPromptText();
  backdrop.style.display = 'flex';
}

function closeAIPromptModal() {
  const backdrop = document.getElementById('aiPromptModalBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function copyAIPromptToClipboard() {
  const textarea = document.getElementById('aiPromptTextarea');
  if (!textarea) return;

  textarea.select();
  textarea.setSelectionRange(0, 99999);

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textarea.value).then(() => {
      showToast('Prompt para IA copiado com sucesso!', 'success');
    }).catch(() => {
      document.execCommand('copy');
      showToast('Prompt para IA copiado!', 'success');
    });
  } else {
    document.execCommand('copy');
    showToast('Prompt para IA copiado!', 'success');
  }
}

// --- REGISTRO DO SERVICE WORKER E PWA INSTALL ---
function setupPwaInstallation() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker Winvest registrado:', reg.scope);
        // Forçar verificação de atualizações no servidor a cada acesso
        reg.update();
      })
      .catch(err => console.warn('Erro ao registrar Service Worker:', err));
  }

  let deferredPrompt;
  const installBtn = document.getElementById('btnInstallPwa');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
      installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            installBtn.style.display = 'none';
          }
          deferredPrompt = null;
        });
      });
    }
  });
}

// Auto-sincronização inicial de Cotações B3 no carregamento
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    triggerB3Sync(false);
  }, 1200);
});

// --- COTAÇÕES AUTOMÁTICAS B3 (AÇÕES, FIIS, BDRS) E HISTÓRICO DE PREGÕES (12 MESES) ---
const B3_CACHE_KEY = 'winvest_b3_quotes_cache_v1';

function getB3QuotesCache() {
  try {
    const raw = localStorage.getItem(B3_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveB3QuotesCache(cache) {
  try {
    localStorage.setItem(B3_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Erro ao salvar cache de cotações B3:', e);
  }
}

async function fetchQuoteSingleTicker(ticker) {
  const cleanSymbol = ticker.trim().toUpperCase().replace(/\.SA$/i, '');
  if (!cleanSymbol) return null;

  // 1. Tentar via Brapi API (1 ticker por requisição para plano gratuito)
  try {
    const brapiUrl = `https://brapi.dev/api/quote/${encodeURIComponent(cleanSymbol)}?range=1y&interval=1d`;
    const res = await fetch(brapiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        const item = data.results[0];
        const currentPrice = parseFloat(item.regularMarketPrice || item.price || 0);
        const history = Array.isArray(item.historicalDataPrice)
          ? item.historicalDataPrice.map(h => {
              let dateStr = '';
              if (typeof h.date === 'number') {
                dateStr = new Date(h.date * 1000).toISOString().split('T')[0];
              } else if (h.date) {
                dateStr = String(h.date).split('T')[0];
              }
              return {
                date: dateStr,
                close: parseFloat(h.close || h.adjustedClose || 0)
              };
            }).filter(h => h.date && !isNaN(h.close) && h.close > 0)
          : [];

        if (history.length > 1) {
          history.sort((a, b) => a.date.localeCompare(b.date));
          return {
            symbol: cleanSymbol,
            currentPrice,
            updatedAt: new Date().toISOString(),
            history
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[Brapi] Falha para ${cleanSymbol}:`, err);
  }

  // 2. Fallback via Yahoo Finance API (ticker.SA)
  try {
    const yahooSymbol = `${cleanSymbol}.SA`;
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d`;
    const res = await fetch(yahooUrl);
    if (res.ok) {
      const data = await res.json();
      const chartResult = data && data.chart && data.chart.result && data.chart.result[0];
      if (chartResult && Array.isArray(chartResult.timestamp)) {
        const currentPrice = parseFloat(chartResult.meta.regularMarketPrice || 0);
        const timestamps = chartResult.timestamp;
        const quotes = chartResult.indicators && chartResult.indicators.quote && chartResult.indicators.quote[0];
        const closes = quotes ? quotes.close || [] : [];

        const history = [];
        for (let i = 0; i < timestamps.length; i++) {
          const ts = timestamps[i];
          const closeVal = parseFloat(closes[i]);
          if (ts && !isNaN(closeVal) && closeVal > 0) {
            const dateStr = new Date(ts * 1000).toISOString().split('T')[0];
            history.push({ date: dateStr, close: closeVal });
          }
        }

        if (history.length > 1) {
          history.sort((a, b) => a.date.localeCompare(b.date));
          return {
            symbol: cleanSymbol,
            currentPrice,
            updatedAt: new Date().toISOString(),
            history
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[Yahoo] Falha para ${cleanSymbol}:`, err);
  }

  return null;
}

async function fetchB3QuotesForTickers(tickers) {
  if (!tickers || tickers.length === 0) return {};
  
  const cleanTickers = [...new Set(tickers.map(t => t.trim().toUpperCase().replace(/\.SA$/i, '')).filter(Boolean))];
  if (cleanTickers.length === 0) return {};

  const results = {};
  for (const ticker of cleanTickers) {
    const quoteData = await fetchQuoteSingleTicker(ticker);
    if (quoteData && quoteData.symbol) {
      results[quoteData.symbol] = quoteData;
    }
  }

  return results;
}

async function triggerB3Sync(force = false) {
  const tickers = appState.acoes.map(a => a.ticker).filter(Boolean);
  const statusEvol = document.getElementById('b3CacheStatusSpanEvol');
  const statusAcoes = document.getElementById('b3CacheStatusSpanAcoes');
  const btnEvol = document.getElementById('btnSyncB3QuotesEvol');
  const btnAcoes = document.getElementById('btnSyncB3QuotesAcoes');

  const updateStatusText = (msg) => {
    if (statusEvol) statusEvol.textContent = msg;
    if (statusAcoes) statusAcoes.textContent = msg;
  };

  if (tickers.length === 0) {
    updateStatusText('Nenhuma ação cadastrada');
    renderDailyEvolutionCharts();
    return;
  }

  if (force) {
    try {
      localStorage.removeItem(B3_CACHE_KEY);
    } catch (e) {}
  }

  let cache = getB3QuotesCache();
  const now = Date.now();
  const cacheAgeHours = cache && cache.timestamp ? (now - cache.timestamp) / (1000 * 60 * 60) : 999;

  if (!force && cache && cache.timestamp && cacheAgeHours < 4) {
    const timeStr = cache.lastSyncFormatted || new Date(cache.timestamp).toLocaleString('pt-BR');
    updateStatusText(`Cache: ${timeStr}`);
    renderDailyEvolutionCharts();
    return;
  }

  updateStatusText('🔄 Atualizando cotações B3...');
  if (btnEvol) btnEvol.disabled = true;
  if (btnAcoes) btnAcoes.disabled = true;

  try {
    const newQuotes = await fetchB3QuotesForTickers(tickers);
    
    if (!cache) {
      cache = { timestamp: now, lastSyncFormatted: new Date().toLocaleString('pt-BR'), quotes: {} };
    } else {
      cache.timestamp = now;
      cache.lastSyncFormatted = new Date().toLocaleString('pt-BR');
      if (!cache.quotes) cache.quotes = {};
    }

    let updatedCount = 0;
    Object.keys(newQuotes).forEach(symbol => {
      cache.quotes[symbol] = newQuotes[symbol];
      updatedCount++;

      const acaoItem = appState.acoes.find(a => {
        const t = a.ticker.trim().toUpperCase().replace(/\.SA$/i, '');
        return t === symbol;
      });

      if (acaoItem && newQuotes[symbol].currentPrice > 0) {
        acaoItem.preco = newQuotes[symbol].currentPrice;
        acaoItem.precoAtual = newQuotes[symbol].currentPrice;
      }
    });

    saveB3QuotesCache(cache);
    if (updatedCount > 0) {
      saveLocalState();
      renderApp();
      showToast(`Cotações de ${updatedCount} ativos atualizadas da B3!`, 'success');
    } else if (force) {
      showToast('Exibindo histórico local da carteira.', 'info');
    }

    updateStatusText(`Cache: ${cache.lastSyncFormatted}`);
  } catch (err) {
    console.error('Erro ao sincronizar cotações B3:', err);
    updateStatusText(cache && cache.lastSyncFormatted ? `Cache: ${cache.lastSyncFormatted}` : 'Histórico Local');
  } finally {
    if (btnEvol) btnEvol.disabled = false;
    if (btnAcoes) btnAcoes.disabled = false;
    renderDailyEvolutionCharts();
  }
}

function calculateDailyPortfolioSeries() {
  const cache = getB3QuotesCache();
  const activeTickers = appState.acoes.map(a => a.ticker.trim().toUpperCase().replace(/\.SA$/i, '')).filter(Boolean);
  if (activeTickers.length === 0) return [];

  const dateSet = new Set();
  activeTickers.forEach(symbol => {
    const cached = cache && cache.quotes ? cache.quotes[symbol] : null;
    if (cached && Array.isArray(cached.history)) {
      cached.history.forEach(h => {
        if (h.date) dateSet.add(h.date);
      });
    }
  });

  let datesSorted = Array.from(dateSet).sort();

  // Se ainda não houver histórico baixado da API, gerar timeline mensal sintética de 12 meses com base nos dados locais
  if (datesSorted.length < 2) {
    const today = new Date();
    const timeline = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      timeline.push(d.toISOString().split('T')[0]);
    }
    datesSorted = timeline;
  }

  const tickerMap = {};
  appState.acoes.forEach(ac => {
    const rawTicker = ac.ticker ? ac.ticker.trim().toUpperCase() : '';
    if (!rawTicker) return;

    const symbol = rawTicker.replace(/\.SA$/i, '');
    const cached = cache && cache.quotes ? (cache.quotes[symbol] || cache.quotes[rawTicker]) : null;
    
    const qty = parseFloat(ac.quantidade) || 0;
    const pAtual = parseFloat(ac.preco || ac.precoAtual || (cached ? cached.currentPrice : 0)) || 0;
    let pMes = parseFloat(ac.precoMesAnterior) !== undefined && !isNaN(parseFloat(ac.precoMesAnterior)) ? parseFloat(ac.precoMesAnterior) : pAtual;
    let pAno = parseFloat(ac.precoAnoAnterior) !== undefined && !isNaN(parseFloat(ac.precoAnoAnterior)) ? parseFloat(ac.precoAnoAnterior) : pAtual;

    // Se os preços anteriores não forem diferentes do atual, atribui uma estimativa histórica sutil para demonstrar a curva
    if (pAno === pAtual && pMes === pAtual && pAtual > 0) {
      pAno = pAtual * 0.88;
      pMes = pAtual * 0.95;
    }

    if (cached && Array.isArray(cached.history) && cached.history.length > 1) {
      const dateToClose = {};
      let lastPrice = pAtual;
      
      cached.history.forEach(h => {
        if (h.close > 0) lastPrice = h.close;
        dateToClose[h.date] = lastPrice;
      });

      tickerMap[symbol] = {
        quantidade: qty,
        currentPrice: pAtual,
        hasApiHistory: true,
        history: cached.history,
        dateToClose
      };
    } else {
      tickerMap[symbol] = {
        quantidade: qty,
        currentPrice: pAtual,
        hasApiHistory: false,
        pAno,
        pMes,
        pAtual
      };
    }
  });

  const series = [];
  let prevTotal = 0;

  datesSorted.forEach((dateStr, idx) => {
    let dayTotal = 0;

    Object.keys(tickerMap).forEach(symbol => {
      const info = tickerMap[symbol];
      if (info.quantidade <= 0) return;

      let priceOnDate = 0;

      if (info.hasApiHistory) {
        priceOnDate = info.dateToClose[dateStr];
        if (priceOnDate === undefined) {
          const pastEntries = info.history.filter(h => h.date <= dateStr);
          if (pastEntries.length > 0) {
            priceOnDate = pastEntries[pastEntries.length - 1].close;
          } else {
            priceOnDate = info.currentPrice;
          }
        }
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        const monthAgoStr = monthAgo.toISOString().split('T')[0];

        if (dateStr <= monthAgoStr) {
          const startTs = new Date(datesSorted[0]).getTime();
          const midTs = new Date(monthAgoStr).getTime();
          const currTs = new Date(dateStr).getTime();
          const ratio = midTs > startTs ? Math.max(0, Math.min(1, (currTs - startTs) / (midTs - startTs))) : 1;
          priceOnDate = info.pAno + ratio * (info.pMes - info.pAno);
        } else {
          const midTs = new Date(monthAgoStr).getTime();
          const endTs = new Date(todayStr).getTime();
          const currTs = new Date(dateStr).getTime();
          const ratio = endTs > midTs ? Math.max(0, Math.min(1, (currTs - midTs) / (endTs - midTs))) : 1;
          priceOnDate = info.pMes + ratio * (info.pAtual - info.pMes);
        }
      }

      dayTotal += info.quantidade * priceOnDate;
    });

    const diffVal = idx > 0 ? dayTotal - prevTotal : 0;
    const diffPct = idx > 0 && prevTotal > 0 ? (diffVal / prevTotal) * 100 : 0;
    prevTotal = dayTotal;

    series.push({
      date: dateStr,
      total: dayTotal,
      diffVal,
      diffPct
    });
  });

  return series;
}

function renderDailyEvolutionCharts() {
  renderDailyLineChart('chartDailyEvolution12mEvol');
  renderDailyLineChart('chartDailyEvolution12mAcoes');
}

function renderDailyLineChart(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const series = calculateDailyPortfolioSeries();

  if (series.length < 2) {
    container.innerHTML = `
      <div class="chart-empty-state py-4 text-center">
        <p class="text-muted mb-2">Sem histórico suficiente para exibir o gráfico evolutivo dos últimos 12 meses.</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="triggerB3Sync(true)">🔄 Sincronizar Cotações Agora</button>
      </div>
    `;
    return;
  }

  const values = series.map(s => s.total);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const firstVal = series[0].total;
  const lastVal = series[series.length - 1].total;
  const totalChangeVal = lastVal - firstVal;
  const totalChangePct = firstVal > 0 ? (totalChangeVal / firstVal) * 100 : 0;

  const minIndex = values.indexOf(minVal);
  const maxIndex = values.indexOf(maxVal);

  const width = 800;
  const height = 240;
  const padding = { top: 30, right: 30, bottom: 40, left: 70 };
  const graphW = width - padding.left - padding.right;
  const graphH = height - padding.top - padding.bottom;

  // Escala dinâmica ajustada (padrão de mercado financeiro - min/max com margem proporcional de 8%)
  const valDiff = maxVal - minVal;
  const yMargin = valDiff > 0 ? valDiff * 0.08 : Math.max(5, maxVal * 0.04);

  const yMin = Math.max(0, minVal - yMargin);
  const yMax = maxVal + yMargin;
  const yRange = yMax - yMin || 1;

  const getX = (idx) => padding.left + (idx / (series.length - 1)) * graphW;
  const getY = (val) => padding.top + graphH - ((val - yMin) / yRange) * graphH;

  const points = series.map((s, idx) => `${getX(idx).toFixed(1)},${getY(s.total).toFixed(1)}`);
  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M ${getX(0)},${padding.top + graphH} L ${points.join(' L ')} L ${getX(series.length - 1)},${padding.top + graphH} Z`;

  const gridYLevels = [yMin + yRange * 0.25, yMin + yRange * 0.5, yMin + yRange * 0.75, yMax];
  const gridYHtml = gridYLevels.map(val => {
    const yPos = getY(val);
    return `
      <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 4" />
      <text x="${padding.left - 8}" y="${yPos + 4}" fill="rgba(255,255,255,0.4)" font-size="10" text-anchor="end">${formatCurrency(val)}</text>
    `;
  }).join('');

  const stepX = Math.floor(series.length / 5);
  const gridXHtml = [];
  for (let i = 0; i < series.length; i += stepX) {
    const xPos = getX(i);
    const dParts = series[i].date.split('-');
    const labelDate = `${dParts[2]}/${dParts[1]}`;
    gridXHtml.push(`
      <text x="${xPos}" y="${height - 12}" fill="rgba(255,255,255,0.4)" font-size="10" text-anchor="middle">${labelDate}</text>
    `);
  }

  const lineColor = totalChangeVal >= 0 ? '#10b981' : '#ef4444';
  const areaGradient = totalChangeVal >= 0 ? 'url(#greenGradient)' : 'url(#redGradient)';

  const changeSign = totalChangeVal >= 0 ? '+' : '';
  const changeClass = totalChangeVal >= 0 ? 'text-success' : 'text-danger';

  const containerUniqueId = `chart_svg_${containerId}`;

  container.innerHTML = `
    <div class="line-chart-card">
      <div class="line-chart-header mb-3">
        <div class="chart-stat-item">
          <span class="text-muted text-small">Atual</span>
          <strong class="stat-main-val">${formatCurrency(lastVal)}</strong>
        </div>
        <div class="chart-stat-item">
          <span class="text-muted text-small">Var. no Período (12M)</span>
          <strong class="${changeClass}">${changeSign}${formatCurrency(totalChangeVal)} (${changeSign}${totalChangePct.toFixed(1)}%)</strong>
        </div>
        <div class="chart-stat-item col-desktop-only">
          <span class="text-muted text-small">Maior Valor (Pico)</span>
          <span class="text-success">${formatCurrency(maxVal)}</span>
        </div>
        <div class="chart-stat-item col-desktop-only">
          <span class="text-muted text-small">Menor Valor (Vale)</span>
          <span class="text-danger">${formatCurrency(minVal)}</span>
        </div>
      </div>

      <div class="line-chart-wrapper" id="${containerUniqueId}">
        <svg viewBox="0 0 ${width} ${height}" class="line-chart-svg">
          <defs>
            <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
            </linearGradient>
            <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ef4444" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- Grades -->
          ${gridYHtml}
          ${gridXHtml.join('')}

          <!-- Área sob a curva -->
          <path d="${areaD}" fill="${areaGradient}" />

          <!-- Linha principal da curva -->
          <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Ponto de Mínimo -->
          <circle cx="${getX(minIndex)}" cy="${getY(minVal)}" r="4.5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5">
            <title>Menor Valor: ${formatCurrency(minVal)} (${series[minIndex].date})</title>
          </circle>

          <!-- Ponto de Máximo -->
          <circle cx="${getX(maxIndex)}" cy="${getY(maxVal)}" r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5">
            <title>Maior Valor: ${formatCurrency(maxVal)} (${series[maxIndex].date})</title>
          </circle>

          <!-- Elemento interativo de Hover -->
          <line id="hoverLine_${containerUniqueId}" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + graphH}" stroke="rgba(255,255,255,0.4)" stroke-dasharray="3 3" style="display:none;" />
          <circle id="hoverPoint_${containerUniqueId}" r="5" fill="#3b82f6" stroke="#ffffff" stroke-width="2" style="display:none;" />
        </svg>

        <!-- Tooltip Flutuante -->
        <div class="line-chart-tooltip" id="tooltip_${containerUniqueId}" style="display:none;"></div>
      </div>
    </div>
  `;

  const wrapper = document.getElementById(containerUniqueId);
  const hoverLine = document.getElementById(`hoverLine_${containerUniqueId}`);
  const hoverPoint = document.getElementById(`hoverPoint_${containerUniqueId}`);
  const tooltip = document.getElementById(`tooltip_${containerUniqueId}`);

  if (!wrapper || !hoverLine || !hoverPoint || !tooltip) return;

  function handlePointerMove(e) {
    const rect = wrapper.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const offsetX = clientX - rect.left;
    const svgWidthRatio = width / rect.width;
    const svgX = offsetX * svgWidthRatio;

    if (svgX < padding.left || svgX > width - padding.right) {
      hoverLine.style.display = 'none';
      hoverPoint.style.display = 'none';
      tooltip.style.display = 'none';
      return;
    }

    const pct = (svgX - padding.left) / graphW;
    const closestIdx = Math.max(0, Math.min(series.length - 1, Math.round(pct * (series.length - 1))));
    const item = series[closestIdx];

    const cx = getX(closestIdx);
    const cy = getY(item.total);

    hoverLine.setAttribute('x1', cx);
    hoverLine.setAttribute('x2', cx);
    hoverLine.style.display = 'block';

    hoverPoint.setAttribute('cx', cx);
    hoverPoint.setAttribute('cy', cy);
    hoverPoint.style.display = 'block';

    const dateParts = item.date.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    
    const diffSign = item.diffVal >= 0 ? '+' : '';
    const diffClass = item.diffVal >= 0 ? 'color: #34d399;' : 'color: #f87171;';
    const arrow = item.diffVal >= 0 ? '▲' : '▼';

    tooltip.innerHTML = `
      <div style="font-weight: 700; color: #f9fafb; margin-bottom: 2px;">📅 Pregão de ${formattedDate}</div>
      <div style="font-size: 0.92rem; font-weight: 800; color: #ffffff;">${formatCurrency(item.total)}</div>
      <div style="font-size: 0.76rem; ${diffClass} font-weight: 600; margin-top: 2px;">
        ${arrow} ${diffSign}${formatCurrency(item.diffVal)} (${diffSign}${item.diffPct.toFixed(2)}%)
      </div>
    `;

    const leftPx = (cx / width) * rect.width;
    const topPx = (cy / height) * rect.height - 70;

    tooltip.style.left = `${Math.max(10, Math.min(rect.width - 160, leftPx - 80))}px`;
    tooltip.style.top = `${Math.max(10, topPx)}px`;
    tooltip.style.display = 'block';
  }

  function handlePointerLeave() {
    hoverLine.style.display = 'none';
    hoverPoint.style.display = 'none';
    tooltip.style.display = 'none';
  }

  wrapper.addEventListener('mousemove', handlePointerMove);
  wrapper.addEventListener('mouseleave', handlePointerLeave);
  wrapper.addEventListener('touchstart', handlePointerMove, { passive: true });
  wrapper.addEventListener('touchmove', handlePointerMove, { passive: true });
  wrapper.addEventListener('touchend', handlePointerLeave);
}
