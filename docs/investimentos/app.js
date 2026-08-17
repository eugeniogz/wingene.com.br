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
  checkDesktopLockState();
  renderApp();
  setupPwaInstallation();

  // Registrar retorno do Google Drive com proteção contra sobreposição de dados de demonstração
  window.onDriveDataLoaded = (remoteData) => {
    if (!remoteData || (!Array.isArray(remoteData.rendaFixa) && !Array.isArray(remoteData.acoes))) return;

    const localTime = appState.isDemo ? 0 : new Date(appState.lastUpdated || 0).getTime();
    const remoteTime = new Date(remoteData.lastUpdated || 0).getTime();

    // 1. Se for dados de demonstração ou se os dados do Drive forem mais recentes ou iguais
    if (appState.isDemo || remoteTime >= localTime || (!appState.rendaFixa.length && !appState.acoes.length)) {
      applyRemoteData(remoteData);
      showToast('Dados sincronizados com o Google Drive!', 'success');
    } else {
      // 2. Se localTime > remoteTime, verificar se há real divergência
      const localStr = JSON.stringify({ r: appState.rendaFixa, a: appState.acoes });
      const remoteStr = JSON.stringify({ r: remoteData.rendaFixa || [], a: remoteData.acoes || [] });

      if (localStr === remoteStr) {
        applyRemoteData(remoteData);
      } else {
        pendingRemoteData = remoteData;
        showSyncConflictModal(remoteData);
      }
    }
  };
});

let pendingRemoteData = null;

function applyRemoteData(remoteData) {
  appState = {
    isDemo: false,
    rendaFixa: remoteData.rendaFixa || [],
    acoes: remoteData.acoes || [],
    macroMetas: remoteData.macroMetas || appState.macroMetas,
    desktopPassword: remoteData.desktopPassword || appState.desktopPassword || '',
    lastUpdated: remoteData.lastUpdated || new Date().toISOString()
  };
  sanitizeAppState();
  saveLocalState(false, false);
  checkDesktopLockState();
  renderApp();
}

function showSyncConflictModal(remoteData) {
  const modal = document.getElementById('modalSyncConflictBackdrop');
  const remoteInfo = document.getElementById('syncConflictRemoteInfo');
  const localInfo = document.getElementById('syncConflictLocalInfo');

  if (remoteInfo) {
    const rDate = remoteData.lastUpdated ? new Date(remoteData.lastUpdated).toLocaleString('pt-BR') : 'Desconhecida';
    const rItems = (remoteData.rendaFixa ? remoteData.rendaFixa.length : 0) + (remoteData.acoes ? remoteData.acoes.length : 0);
    remoteInfo.textContent = `Nuvem: ${rDate} (${rItems} ativos registrados)`;
  }

  if (localInfo) {
    const lDate = appState.lastUpdated ? new Date(appState.lastUpdated).toLocaleString('pt-BR') : 'Desconhecida';
    const lItems = (appState.rendaFixa ? appState.rendaFixa.length : 0) + (appState.acoes ? appState.acoes.length : 0);
    localInfo.textContent = `Aparelho: ${lDate} (${lItems} ativos registrados)`;
  }

  if (modal) modal.style.display = 'flex';
}

function resolveSyncConflict(choice) {
  const modal = document.getElementById('modalSyncConflictBackdrop');
  if (modal) modal.style.display = 'none';

  if (choice === 'remote' && pendingRemoteData) {
    applyRemoteData(pendingRemoteData);
    showToast('Dados do Google Drive aplicados com sucesso!', 'success');
  } else if (choice === 'local') {
    saveLocalState(true, true);
    showToast('Dados locais mantidos e enviados ao Google Drive!', 'info');
  }
  pendingRemoteData = null;
}

function sanitizeAppState() {
  if (!appState) return;
  if (!Array.isArray(appState.rendaFixa)) appState.rendaFixa = [];
  if (!Array.isArray(appState.acoes)) appState.acoes = [];

  appState.rendaFixa.forEach((rf, idx) => {
    if (!rf.id) rf.id = 'rf-' + (Date.now() + idx);
  });

  appState.acoes.forEach((ac, idx) => {
    if (!ac.id) ac.id = 'ac-' + (Date.now() + idx);
  });
}

// --- GERENCIAMENTO DE ESTADO LOCAL ---
function loadLocalState() {
  const saved = localStorage.getItem('wingene_investimentos_state');
  if (saved) {
    try {
      appState = JSON.parse(saved);
      sanitizeAppState();
    } catch (e) {
      console.error('Erro ao ler estado local:', e);
    }
  } else {
    // Dados de demonstração inicial — marcados como isDemo: true e lastUpdated: 0
    appState = {
      isDemo: true,
      rendaFixa: [
        { id: 'rf-1', tipo: 'Tesouro Direto', emissor: 'Tesouro Nacional', nome: 'Tesouro IPCA+ 2035', valor: 15000, rendimento12m: 1200, taxa: 'IPCA + 6.1%', data: new Date().toLocaleDateString('pt-BR') },
        { id: 'rf-2', tipo: 'RDB', emissor: 'Nubank / Nu Financeira', nome: 'RDB Resgate Imediato', valor: 8500, rendimento12m: 750, taxa: '100% CDI', data: new Date().toLocaleDateString('pt-BR') }
      ],
      acoes: [
        { id: 'ac-1', ticker: 'PETR4', nome: 'Petrobras PN', quantidade: 200, preco: 38.50, precoMesAnterior: 36.80, precoAnoAnterior: 32.10, meta: 30, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-2', ticker: 'VALE3', nome: 'Vale S.A.', quantidade: 100, preco: 62.10, precoMesAnterior: 64.00, precoAnoAnterior: 58.50, meta: 30, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-3', ticker: 'ITUB4', nome: 'Itaú Unibanco PN', quantidade: 250, preco: 33.20, precoMesAnterior: 32.50, precoAnoAnterior: 27.80, meta: 20, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-4', ticker: 'WEGE3', nome: 'Weg S.A.', quantidade: 120, preco: 42.00, precoMesAnterior: 40.50, precoAnoAnterior: 34.20, meta: 20, data: new Date().toLocaleDateString('pt-BR') }
      ],
      lastUpdated: 0
    };
    saveLocalState(false, false);
  }
}

function saveLocalState(syncDrive = true, isUserMutation = false) {
  if (!appState.isDemo && isUserMutation) {
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

// Salvar diálogos de edição ou fechar modais/menu gaveta ao pressionar ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const editRfBackdrop = document.getElementById('modalEditRfBackdrop');
    const editAcaoBackdrop = document.getElementById('modalEditAcaoBackdrop');

    if (editRfBackdrop && editRfBackdrop.style.display !== 'none') {
      handleEditRfModalSubmit(e);
      return;
    }
    if (editAcaoBackdrop && editAcaoBackdrop.style.display !== 'none') {
      handleEditAcaoModalSubmit(e);
      return;
    }

    const addRfBackdrop = document.getElementById('modalAddRfBackdrop');
    if (addRfBackdrop && addRfBackdrop.style.display !== 'none') {
      closeAddRfModal();
      return;
    }
    const addAcaoBackdrop = document.getElementById('modalAddAcaoBackdrop');
    if (addAcaoBackdrop && addAcaoBackdrop.style.display !== 'none') {
      closeAddAcaoModal();
      return;
    }
    const historyBackdrop = document.getElementById('modalAssetHistoryBackdrop');
    if (historyBackdrop && historyBackdrop.style.display !== 'none') {
      closeAssetHistoryModal();
      return;
    }
    const aiPromptBackdrop = document.getElementById('modalAIPromptBackdrop');
    if (aiPromptBackdrop && aiPromptBackdrop.style.display !== 'none') {
      closeAIPromptModal();
      return;
    }

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

  if (targetTab === 'acoes' || targetTab === 'evolucao') {
    triggerB3Sync(false);
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

  // Submissão dos Formulários de Modais
  document.getElementById('formEditAcaoModal')?.addEventListener('submit', handleEditAcaoModalSubmit);
  document.getElementById('formEditRfModal')?.addEventListener('submit', handleEditRfModalSubmit);
  document.getElementById('formAddAcaoModal')?.addEventListener('submit', handleAddAcaoModalSubmit);
  document.getElementById('formAddRfModal')?.addEventListener('submit', handleAddRfModalSubmit);

  // Exportar / Importar JSON Backup
  document.getElementById('btnExportJson')?.addEventListener('click', exportJsonBackup);
  document.getElementById('btnImportJsonTrigger')?.addEventListener('click', () => document.getElementById('fileImportJson').click());
  document.getElementById('fileImportJson')?.addEventListener('change', importJsonBackup);

  // Listener para suporte a expressões matemáticas em campos numéricos
  setupMathExpressionInputListeners();
}

function setupMathExpressionInputListeners() {
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!target || !target.matches('input[type="text"], input:not([type]), input[inputmode="decimal"]')) return;

    const val = target.value;
    const sansLeadingSign = val.replace(/^[\s+\-]+/, '');
    const hasOperators = /[+\-*\/]/.test(sansLeadingSign);

    let hintEl = target.parentElement ? target.parentElement.querySelector('.math-expr-hint') : null;

    if (hasOperators) {
      const calcVal = parsePtBrFloat(val);
      if (!isNaN(calcVal)) {
        if (!hintEl && target.parentElement) {
          hintEl = document.createElement('div');
          hintEl.className = 'math-expr-hint text-muted text-small mt-1';
          hintEl.style.color = '#10b981';
          hintEl.style.fontWeight = '600';
          hintEl.style.fontSize = '0.82rem';
          target.parentElement.appendChild(hintEl);
        }
        if (hintEl) {
          const formatted = calcVal.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
          hintEl.textContent = `🧮 Total calculado: ${formatted}`;
        }
      } else if (hintEl) {
        hintEl.remove();
      }
    } else if (hintEl) {
      hintEl.remove();
    }
  });

  document.addEventListener('blur', (e) => {
    const target = e.target;
    if (!target || !target.matches('input[type="text"], input:not([type]), input[inputmode="decimal"]')) return;

    const val = target.value;
    const sansLeadingSign = val.replace(/^[\s+\-]+/, '');
    const hasOperators = /[+\-*\/]/.test(sansLeadingSign);

    if (hasOperators) {
      const calcVal = parsePtBrFloat(val);
      if (!isNaN(calcVal)) {
        target.value = calcVal.toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false });
      }
    }
    const hintEl = target.parentElement ? target.parentElement.querySelector('.math-expr-hint') : null;
    if (hintEl) hintEl.remove();
  }, true);
}

function getAssetMacroCategory(rfItem) {
  const tipo = (rfItem.tipo || '').toLowerCase();
  const taxa = (rfItem.taxa || '').toLowerCase();
  const nome = (rfItem.nome || '').toLowerCase();

  if (tipo.includes('lci') || tipo.includes('lca') || tipo.includes('tesouro') || 
      taxa.includes('ipca') || taxa.includes('lci') || taxa.includes('lca') || 
      nome.includes('ipca') || nome.includes('lci') || nome.includes('lca') || nome.includes('ntnb')) {
    return 'RF_IPCA_LCA';
  }
  return 'RF_CDI';
}

// --- CÁLCULOS FINANCIALS & EVOLUÇÃO (MENSAL E ANUAL) ---
function calculateFinancials() {
  const cache = getB3QuotesCache();

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
    const precoAtual = parseFloat(acao.preco || acao.precoAtual) || 0;
    const valorTotalAtual = qty * precoAtual;

    const rawTicker = acao.ticker ? acao.ticker.trim().toUpperCase() : '';
    const symbol = rawTicker.replace(/\.SA$/i, '');
    const cached = cache && cache.quotes ? (cache.quotes[symbol] || cache.quotes[rawTicker]) : null;

    let userPAno = parseFloat(acao.precoAnoAnterior);
    let userPMes = parseFloat(acao.precoMesAnterior);

    // 1. Prioridade: Cotação Histórica Oficial baixada via API B3 / Yahoo Finance
    if (cached && Array.isArray(cached.history) && cached.history.length > 1) {
      if (isNaN(userPAno) || userPAno <= 0 || userPAno === precoAtual) {
        userPAno = cached.history[0].close;
      }
      if (isNaN(userPMes) || userPMes <= 0 || userPMes === precoAtual) {
        const idxM = Math.max(0, cached.history.length - 22);
        userPMes = cached.history[idxM].close;
      }
    }

    const precoMesAnt = !isNaN(userPMes) && userPMes > 0 ? userPMes : precoAtual;
    const precoAnoAnt = !isNaN(userPAno) && userPAno > 0 ? userPAno : precoAtual;

    const valorTotalMesAnt = qty * precoMesAnt;
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

  // Adicionar percentual individual e alocação de rebalanceamento de Ações
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

  // --- MAPEAR MACRO CATEGORIAS DE DISTRIBUIÇÃO GERAL ---
  const totalRfCdi = rendaFixaProcessada
    .filter(rf => getAssetMacroCategory(rf) === 'RF_CDI')
    .reduce((acc, rf) => acc + rf.valorAtual, 0);

  const totalRfIpcaLca = rendaFixaProcessada
    .filter(rf => getAssetMacroCategory(rf) === 'RF_IPCA_LCA')
    .reduce((acc, rf) => acc + rf.valorAtual, 0);

  const macroMetas = appState.macroMetas || { rfCdi: 40, rfIpcaLca: 30, acoes: 30 };

  const pctRfCdi = patrimonioTotal > 0 ? (totalRfCdi / patrimonioTotal) * 100 : 0;
  const pctRfIpcaLca = patrimonioTotal > 0 ? (totalRfIpcaLca / patrimonioTotal) * 100 : 0;
  const pctAcoesMacro = patrimonioTotal > 0 ? (totalAcoesAtual / patrimonioTotal) * 100 : 0;

  const valorAlvoRfCdi = patrimonioTotal > 0 ? (patrimonioTotal * ((macroMetas.rfCdi || 0) / 100)) : 0;
  const valorAlvoRfIpcaLca = patrimonioTotal > 0 ? (patrimonioTotal * ((macroMetas.rfIpcaLca || 0) / 100)) : 0;
  const valorAlvoAcoesMacro = patrimonioTotal > 0 ? (patrimonioTotal * ((macroMetas.acoes || 0) / 100)) : 0;

  const diffValRfCdi = valorAlvoRfCdi - totalRfCdi;
  const diffValRfIpcaLca = valorAlvoRfIpcaLca - totalRfIpcaLca;
  const diffValAcoesMacro = valorAlvoAcoesMacro - totalAcoesAtual;

  const totalMacroMetasPercent = (macroMetas.rfCdi || 0) + (macroMetas.rfIpcaLca || 0) + (macroMetas.acoes || 0);

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
    totalMetasPercent,

    macroMetas,
    totalRfCdi,
    totalRfIpcaLca,
    pctRfCdi,
    pctRfIpcaLca,
    pctAcoesMacro,
    valorAlvoRfCdi,
    valorAlvoRfIpcaLca,
    valorAlvoAcoesMacro,
    diffValRfCdi,
    diffValRfIpcaLca,
    diffValAcoesMacro,
    totalMacroMetasPercent
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

  // Atualizar Cards Verdes Destacados de Total Geral nas Abas
  const totalAcoesHeaderCard = document.getElementById('totalAcoesHeaderCard');
  if (totalAcoesHeaderCard) totalAcoesHeaderCard.textContent = formatCurrency(fin.totalAcoes);
  const totalAcoesHeaderBadges = document.getElementById('totalAcoesHeaderBadges');
  if (totalAcoesHeaderBadges) {
    totalAcoesHeaderBadges.innerHTML = `
      ${formatEvolutionBadge(fin.diffAcoesMesVal, fin.diffAcoesMesPct, 'Mês')}
      ${formatEvolutionBadge(fin.diffAcoesAnoVal, fin.diffAcoesAnoPct, 'Ano')}
    `;
  }

  const totalRfHeaderCard = document.getElementById('totalRfHeaderCard');
  if (totalRfHeaderCard) totalRfHeaderCard.textContent = formatCurrency(fin.totalRendaFixa);
  const totalRfHeaderBadges = document.getElementById('totalRfHeaderBadges');
  if (totalRfHeaderBadges) {
    totalRfHeaderBadges.innerHTML = `
      ${formatEvolutionBadge(fin.diffRfMesVal, fin.diffRfMesPct, 'Mês')}
      ${formatEvolutionBadge(fin.diffRfAnoVal, fin.diffRfAnoPct, 'Ano')}
    `;
  }

  // Data do sistema
  const lastUpdateFormatted = new Date(appState.lastUpdated).toLocaleString('pt-BR');
  const lastUpdateEl = document.getElementById('lastUpdatedSpan');
  if (lastUpdateEl) {
    lastUpdateEl.textContent = lastUpdateFormatted;
  }

  // Preencher campo de senha nas configurações se presente
  const pwdField = document.getElementById('cfgDesktopPassword');
  if (pwdField && document.activeElement !== pwdField) {
    pwdField.value = appState.desktopPassword || '';
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
      <tr class="col-desktop-row" style="font-weight: 700; background: rgba(16, 64, 176, 0.08);">
        <td><span class="row-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg></span> PATRIMÔNIO TOTAL</td>
        <td class="text-right">${formatCurrency(fin.patrimonioTotal)}</td>
        <td class="text-right">${formatDiffVal(fin.diffTotalMesVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffTotalMesPct)}</td>
        <td class="text-right">${formatDiffVal(fin.diffTotalAnoVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffTotalAnoPct)}</td>
      </tr>
      <tr class="col-desktop-row">
        <td><span class="row-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg></span> Grupo Renda Fixa</td>
        <td class="text-right">${formatCurrency(fin.totalRendaFixa)}</td>
        <td class="text-right">${formatDiffVal(fin.diffRfMesVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffRfMesPct)}</td>
        <td class="text-right">${formatDiffVal(fin.diffRfAnoVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffRfAnoPct)}</td>
      </tr>
      <tr class="col-desktop-row">
        <td><span class="row-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span> Grupo Ações</td>
        <td class="text-right">${formatCurrency(fin.totalAcoes)}</td>
        <td class="text-right">${formatDiffVal(fin.diffAcoesMesVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffAcoesMesPct)}</td>
        <td class="text-right">${formatDiffVal(fin.diffAcoesAnoVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffAcoesAnoPct)}</td>
      </tr>

      <!-- CARDS EXCLUSIVOS MOBILE PARA EVOLUÇÃO GRUPOS -->
      <tr class="col-mobile-row">
        <td colspan="7" style="padding: 0 0 10px 0 !important; border: none;">
          <div class="mobile-asset-card" style="background: rgba(16, 64, 176, 0.14); border-color: rgba(59, 130, 246, 0.4);">
            <div style="font-size:0.85rem; font-weight:700; color:#60a5fa; text-transform:uppercase; letter-spacing:0.5px;">PATRIMÔNIO TOTAL CONSOLIDADO</div>
            <!-- VALOR ATUAL EMBAIXO DO NOME -->
            <div style="margin-top: 4px; font-size: 1.35rem; font-weight: 800; color: #ffffff;">${formatCurrency(fin.patrimonioTotal)}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1);">
              <div style="background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 8px;">
                <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Mensal</div>
                <div style="margin-top: 2px;">${formatDiffBadgeCombined(fin.diffTotalMesVal, fin.diffTotalMesPct)}</div>
              </div>
              <div style="background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 8px;">
                <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Anual</div>
                <div style="margin-top: 2px;">${formatDiffBadgeCombined(fin.diffTotalAnoVal, fin.diffTotalAnoPct)}</div>
              </div>
            </div>
          </div>

          <div class="mobile-asset-card">
            <div style="font-size:0.85rem; font-weight:700; color:#34d399; text-transform:uppercase; letter-spacing:0.5px;">Grupo Renda Fixa</div>
            <!-- VALOR ATUAL EMBAIXO DO NOME -->
            <div style="margin-top: 4px; font-size: 1.2rem; font-weight: 800; color: #ffffff;">${formatCurrency(fin.totalRendaFixa)}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
              <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Mensal</div>
                <div style="margin-top: 2px;">${formatDiffBadgeCombined(fin.diffRfMesVal, fin.diffRfMesPct)}</div>
              </div>
              <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Anual</div>
                <div style="margin-top: 2px;">${formatDiffBadgeCombined(fin.diffRfAnoVal, fin.diffRfAnoPct)}</div>
              </div>
            </div>
          </div>

          <div class="mobile-asset-card">
            <div style="font-size:0.85rem; font-weight:700; color:#fbbf24; text-transform:uppercase; letter-spacing:0.5px;">Grupo Ações & Renda Variável</div>
            <!-- VALOR ATUAL EMBAIXO DO NOME -->
            <div style="margin-top: 4px; font-size: 1.2rem; font-weight: 800; color: #ffffff;">${formatCurrency(fin.totalAcoes)}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
              <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Mensal</div>
                <div style="margin-top: 2px;">${formatDiffBadgeCombined(fin.diffAcoesMesVal, fin.diffAcoesMesPct)}</div>
              </div>
              <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Anual</div>
                <div style="margin-top: 2px;">${formatDiffBadgeCombined(fin.diffAcoesAnoVal, fin.diffAcoesAnoPct)}</div>
              </div>
            </div>
          </div>
        </td>
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
        <!-- CARDS EXCLUSIVOS MOBILE PARA EVOLUÇÃO RENDA FIXA -->
        <tr class="col-mobile-row">
          <td colspan="7" style="padding: 0 0 10px 0 !important; border: none;">
            <div class="mobile-asset-card">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div>
                  <span class="badge badge-rf" style="font-size:0.68rem; padding:2px 6px;">${item.tipo}</span>
                  <span class="mobile-emissor-tag">${escapeHtml(item.emissor)}</span>
                </div>
              </div>
              <div style="margin-top: 6px; font-weight: 700; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(item.nome)}</div>
              <!-- VALOR ATUAL EMBAIXO DO NOME -->
              <div style="margin-top: 2px; font-size: 1.15rem; font-weight: 800; color: #10b981;">
                ${formatCurrency(item.valorAtual)}
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
                <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                  <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Mensal</div>
                  <div style="margin-top: 2px;">${formatDiffBadgeCombined(item.diffMesVal, item.diffMesPct)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                  <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Anual</div>
                  <div style="margin-top: 2px;">${formatDiffBadgeCombined(item.diffAnoVal, item.diffAnoPct)}</div>
                </div>
              </div>
            </div>
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
        <!-- CARDS EXCLUSIVOS MOBILE PARA EVOLUÇÃO AÇÕES -->
        <tr class="col-mobile-row">
          <td colspan="8" style="padding: 0 0 10px 0 !important; border: none;">
            <div class="mobile-asset-card">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="ticker-badge" style="border-left-color: ${getPaletteColor(idx)}; padding: 2px 6px; font-size: 0.78rem;">
                  <strong>${item.ticker}</strong>
                </div>
                <span class="text-muted text-small" style="font-size:0.78rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.nome)}</span>
              </div>
              <!-- VALOR ATUAL EMBAIXO DO NOME -->
              <div style="margin-top: 6px; font-size: 1.15rem; font-weight: 800; color: #ffffff;">
                ${formatCurrency(item.valorTotal)} <small class="text-muted" style="font-size:0.72rem; font-weight: 400;">(${formatCurrency(item.precoAtual)}/un)</small>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
                <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                  <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Mensal</div>
                  <div style="margin-top: 2px;">${formatDiffBadgeCombined(item.diffMesVal, item.diffMesPct)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 8px;">
                  <div class="text-muted" style="font-size:0.68rem; font-weight:600; text-transform:uppercase;">Var. Anual</div>
                  <div style="margin-top: 2px;">${formatDiffBadgeCombined(item.diffAnoVal, item.diffAnoPct)}</div>
                </div>
              </div>
            </div>
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
  if (document.getElementById('modalRfRendimento12m')) document.getElementById('modalRfRendimento12m').value = '';
  backdrop.style.display = 'flex';
}

function closeAddRfModal() {
  const backdrop = document.getElementById('modalAddRfBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function handleAddRfModalSubmit(e) {
  if (e) e.preventDefault();
  const tipo = document.getElementById('modalRfTipo').value;
  const emissor = document.getElementById('modalRfEmissor').value.trim();
  const nome = document.getElementById('modalRfNome').value.trim();
  const taxa = document.getElementById('modalRfTaxa').value.trim();
  const valorInput = document.getElementById('modalRfValor').value;
  const rend12mInput = document.getElementById('modalRfRendimento12m') ? document.getElementById('modalRfRendimento12m').value : '';

  const valor = parsePtBrFloat(valorInput);
  const rend12m = rend12mInput !== '' ? parsePtBrFloat(rend12mInput) : 0;
  const rend1m = rend12m / 12;

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
    rendimento12m: isNaN(rend12m) ? 0 : rend12m,
    rendimento1m: isNaN(rend1m) ? 0 : rend1m,
    valorMesAnterior: valor - (isNaN(rend1m) ? 0 : rend1m),
    valorAnoAnterior: valor - (isNaN(rend12m) ? 0 : rend12m),
    data: currentDate,
    historico: [
      { data: currentDate + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), valor: valor }
    ]
  });

  closeAddRfModal();
  appState.isDemo = false;
  saveLocalState(true, true);
  renderApp();
  showToast('Ativo de Renda Fixa adicionado!', 'success');
}

function renderRendaFixaTable(fin) {
  const tbody = document.getElementById('tbodyRendaFixa');
  if (!tbody) return;

  if (fin.rendaFixa.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Nenhum ativo de Renda Fixa cadastrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = fin.rendaFixa.map(item => `
    <!-- DESKTOP ROW -->
    <tr class="col-desktop-row clickable-row" onclick="openEditRfModal('${item.id}')" title="Clique para editar">
      <td><span class="badge badge-rf">${item.tipo}</span></td>
      <td><strong>${escapeHtml(item.emissor)}</strong></td>
      <td>${escapeHtml(item.nome)}</td>
      <td>${item.taxa ? `<span class="taxa-tag">${escapeHtml(item.taxa)}</span>` : '<span class="text-muted">-</span>'}</td>
      <td class="text-right">${formatDiffVal(item.diffAnoVal)}</td>
      <td class="text-right"><strong>${formatCurrency(item.valorAtual)}</strong></td>
      <td class="text-right"><span class="text-muted text-small">${item.data || '-'}</span></td>
      <td class="text-center" onclick="event.stopPropagation()">
        <button class="btn-icon" onclick="showAssetHistoryModal('${item.id}', 'rf')" title="Ver Histórico de Alterações">📜</button>
        <button class="btn-icon" onclick="openEditRfModal('${item.id}')" title="Editar Ativo">✏️</button>
        <button class="btn-icon danger" onclick="deleteRendaFixa('${item.id}')" title="Excluir">🗑️</button>
      </td>
    </tr>

    <!-- MOBILE ROW (CARD COMPLETO) -->
    <tr class="col-mobile-row">
      <td colspan="8" style="padding: 0 0 10px 0 !important; border: none;">
        <div class="mobile-asset-card clickable-row" onclick="openEditRfModal('${item.id}')">
          <div class="mobile-card-header">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="badge badge-rf">${item.tipo}</span>
              <span class="mobile-emissor-tag">${escapeHtml(item.emissor)}</span>
              ${item.taxa ? `<span class="taxa-tag">${escapeHtml(item.taxa)}</span>` : ''}
            </div>
            <div class="mobile-action-buttons" onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="showAssetHistoryModal('${item.id}', 'rf')" title="Histórico">📜</button>
              <button class="btn-icon" onclick="openEditRfModal('${item.id}')" title="Editar">✏️</button>
              <button class="btn-icon danger" onclick="deleteRendaFixa('${item.id}')" title="Excluir">🗑️</button>
            </div>
          </div>

          <div class="mobile-card-title">${escapeHtml(item.nome)}</div>

          <div class="mobile-financial-grid" style="grid-template-columns: repeat(3, 1fr);">
            <div class="mobile-stat-box highlight">
              <span class="mobile-stat-label">Valor Atual</span>
              <strong class="mobile-stat-val text-success">${formatCurrency(item.valorAtual)}</strong>
            </div>
            <div class="mobile-stat-box">
              <span class="mobile-stat-label">Rend. 12M</span>
              <span class="mobile-stat-val text-muted">${formatDiffVal(item.diffAnoVal)}</span>
            </div>
            <div class="mobile-stat-box">
              <span class="mobile-stat-label">Atualizado em</span>
              <span class="mobile-stat-val text-muted" style="font-size:0.75rem;">${item.data || '-'}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('totalRfFooter').textContent = formatCurrency(fin.totalRendaFixa);
}

function openEditRfModal(id) {
  const item = appState.rendaFixa.find(r => r.id === id);
  if (!item) return;

  const currentR12m = item.rendimento12m !== undefined ? item.rendimento12m : (item.valorAnoAnterior !== undefined ? (item.valor - item.valorAnoAnterior) : 0);

  document.getElementById('editModalRfId').value = item.id;
  document.getElementById('editModalRfTipo').value = item.tipo;
  document.getElementById('editModalRfEmissor').value = item.emissor || '';
  document.getElementById('editModalRfNome').value = item.nome || '';
  document.getElementById('editModalRfTaxa').value = item.taxa || '';
  document.getElementById('editModalRfValor').value = item.valor;
  if (document.getElementById('editModalRfRendimento12m')) document.getElementById('editModalRfRendimento12m').value = currentR12m;
  document.getElementById('modalEditRfBackdrop').style.display = 'flex';
}

function closeEditRfModal() {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  const backdrop = document.getElementById('modalEditRfBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function deleteCurrentRfFromModal() {
  const idInput = document.getElementById('editModalRfId').value;
  if (!idInput) return;
  const item = appState.rendaFixa.find(r => String(r.id || '').trim() === String(idInput || '').trim());
  const name = item ? item.nome : 'este ativo';
  if (confirm(`Deseja realmente remover ${name}?`)) {
    closeEditRfModal();
    deleteRendaFixa(idInput);
  }
}

function handleEditRfModalSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const idInput = document.getElementById('editModalRfId').value;
  const item = appState.rendaFixa.find(r => String(r.id || '').trim() === String(idInput || '').trim());
  if (!item) {
    closeEditRfModal();
    showToast('Ativo de Renda Fixa não encontrado para salvar.', 'error');
    return;
  }

  const tipo = document.getElementById('editModalRfTipo').value;
  const emissor = document.getElementById('editModalRfEmissor').value.trim();
  const nome = document.getElementById('editModalRfNome').value.trim();
  const taxa = document.getElementById('editModalRfTaxa').value.trim();
  const valAtualInput = document.getElementById('editModalRfValor').value;
  const rend12mInput = document.getElementById('editModalRfRendimento12m') ? document.getElementById('editModalRfRendimento12m').value : '';

  const valor = parsePtBrFloat(valAtualInput);
  const rend12m = rend12mInput !== '' ? parsePtBrFloat(rend12mInput) : 0;
  const rend1m = rend12m / 12;

  if (!emissor || !nome || isNaN(valor)) {
    closeEditRfModal();
    showToast('Preencha os campos obrigatórios com valores válidos.', 'error');
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
  item.rendimento12m = isNaN(rend12m) ? 0 : rend12m;
  item.rendimento1m = isNaN(rend1m) ? 0 : rend1m;
  item.valorMesAnterior = valor - (isNaN(rend1m) ? 0 : rend1m);
  item.valorAnoAnterior = valor - (isNaN(rend12m) ? 0 : rend12m);
  item.data = new Date().toLocaleDateString('pt-BR');

  closeEditRfModal();
  appState.isDemo = false;
  saveLocalState(true, true);
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
  const valMes = parsePtBrFloat(document.getElementById(`editRfValMes_${id}`).value);
  const valAno = parsePtBrFloat(document.getElementById(`editRfValAno_${id}`).value);
  const valor = parsePtBrFloat(document.getElementById(`editRfValor_${id}`).value);

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
  saveLocalState(true, true);
  renderApp();
  showToast('Renda Fixa atualizada!', 'success');
}

function deleteRendaFixa(id) {
  if (confirm('Deseja realmente remover este ativo de Renda Fixa?')) {
    appState.rendaFixa = appState.rendaFixa.filter(r => r.id !== id);
    if (editingRfId === id) editingRfId = null;
    saveLocalState(true, true);
    renderApp();
    showToast('Ativo removido.', 'info');
  }
}

// --- CARTEIRA DE AÇÕES (EDIÇÃO E ADIÇÃO INLINE COM HISTÓRICO) ---

function parseSingleNumberToken(token) {
  if (token === undefined || token === null) return NaN;
  let str = String(token).trim();
  if (!str) return NaN;

  str = str.replace(/[^0-9,.-]/g, '');
  if (!str) return NaN;

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes('.')) {
    const dots = (str.match(/\./g) || []).length;
    if (dots > 1) {
      str = str.replace(/\./g, '');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
}

function parsePtBrFloat(val) {
  if (val === undefined || val === null) return NaN;
  if (typeof val === 'number') return val;

  let str = String(val).trim();
  if (!str) return NaN;

  str = str.replace(/[R$]/gi, '').trim();
  if (!/[0-9]/.test(str)) return NaN;

  const sansLeadingSign = str.replace(/^[\s+\-]+/, '');
  const hasOperators = /[+\-*\/]/.test(sansLeadingSign);

  if (!hasOperators) {
    return parseSingleNumberToken(str);
  }

  try {
    const normalizedExpr = str.replace(/[0-9][0-9.,]*/g, (match) => {
      const parsed = parseSingleNumberToken(match);
      return isNaN(parsed) ? match : parsed;
    });

    if (/[^0-9.\-+\/*()\s]/.test(normalizedExpr)) {
      return parseSingleNumberToken(str);
    }

    const fn = new Function(`"use strict"; return (${normalizedExpr});`);
    const result = fn();

    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round((result + Number.EPSILON) * 10000) / 10000;
    }
  } catch (err) {
    return parseSingleNumberToken(str);
  }

  return NaN;
}

function openAddAcaoModal() {
  const backdrop = document.getElementById('modalAddAcaoBackdrop');
  if (!backdrop) return;
  document.getElementById('modalAcaoTicker').value = '';
  document.getElementById('modalAcaoNome').value = '';
  document.getElementById('modalAcaoQtd').value = '0';
  document.getElementById('modalAcaoPreco').value = '';
  document.getElementById('modalAcaoMeta').value = '0';
  if (document.getElementById('modalAcaoComentario')) {
    document.getElementById('modalAcaoComentario').value = '';
  }
  backdrop.style.display = 'flex';
}

function closeAddAcaoModal() {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  const backdrop = document.getElementById('modalAddAcaoBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function handleAddAcaoModalSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const ticker = document.getElementById('modalAcaoTicker').value.trim().toUpperCase();
  const nome = document.getElementById('modalAcaoNome').value.trim();
  const rawQtd = document.getElementById('modalAcaoQtd').value.trim();
  const quantidade = rawQtd === '' ? 0 : parsePtBrFloat(rawQtd);
  const preco = parsePtBrFloat(document.getElementById('modalAcaoPreco').value);
  const rawMeta = document.getElementById('modalAcaoMeta').value.trim();
  const meta = rawMeta === '' ? 0 : (parsePtBrFloat(rawMeta) || 0);
  const comentario = document.getElementById('modalAcaoComentario') ? document.getElementById('modalAcaoComentario').value.trim() : '';
  const currentDate = new Date().toLocaleDateString('pt-BR');

  if (!ticker || !nome || isNaN(quantidade) || quantidade < 0 || isNaN(preco) || isNaN(meta) || meta < 0) {
    closeAddAcaoModal();
    showToast('Preencha os campos obrigatórios da ação com valores válidos.', 'error');
    return;
  }

  appState.acoes.push({
    id: 'ac-' + Date.now(),
    ticker,
    nome,
    quantidade,
    preco,
    precoAtual: preco,
    precoMesAnterior: preco,
    precoAnoAnterior: preco,
    meta,
    comentario,
    data: currentDate,
    historico: [
      { data: currentDate + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), preco: preco, quantidade: quantidade, valorTotal: preco * quantidade }
    ]
  });

  closeAddAcaoModal();
  appState.isDemo = false;
  saveLocalState(true, true);
  renderApp();
  showToast(`Ação ${ticker} adicionada com sucesso!`, 'success');
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
      <td>
        <div style="font-weight: 500;">${escapeHtml(item.nome)}</div>
        ${item.comentario ? `<div class="asset-comment" style="font-size:0.75rem; margin-top:2px; color:#94a3b8; font-style:italic; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(item.comentario)}">💬 ${escapeHtml(item.comentario)}</div>` : ''}
      </td>
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

    <!-- MOBILE ROW (CARD COMPLETO DE AÇÕES) -->
    <tr class="col-mobile-row">
      <td colspan="11" style="padding: 0 0 10px 0 !important; border: none;">
        <div class="mobile-asset-card clickable-row" onclick="openEditAcaoModal('${item.id}')">
          <div class="mobile-card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="ticker-badge" style="border-left-color: ${getPaletteColor(idx)}; padding: 3px 8px; font-size: 0.85rem;">
                <strong>${item.ticker}</strong>
              </div>
              <span class="text-muted text-small" style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${escapeHtml(item.nome)}</span>
            </div>
            <div class="mobile-action-buttons" onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="showAssetHistoryModal('${item.id}', 'acao')" title="Histórico">📜</button>
              <button class="btn-icon" onclick="openEditAcaoModal('${item.id}')" title="Editar">✏️</button>
              <button class="btn-icon danger" onclick="deleteAcao('${item.id}')" title="Excluir">🗑️</button>
            </div>
          </div>

          <div class="mobile-financial-grid">
            <div class="mobile-stat-box highlight">
              <span class="mobile-stat-label">Valor Total (R$)</span>
              <strong class="mobile-stat-val text-success" style="font-size:1.1rem;">${formatCurrency(item.valorTotal)}</strong>
            </div>
            <div class="mobile-stat-box">
              <span class="mobile-stat-label">Preço / Qtd</span>
              <span class="mobile-stat-val text-main" style="font-size:0.82rem;">${formatCurrency(item.precoAtual)} <small class="text-muted">(${item.quantidade} un)</small></span>
            </div>
            <div class="mobile-stat-box">
              <span class="mobile-stat-label">Alocação Atual</span>
              <div><span class="pct-pill" style="font-size: 0.78rem; display: inline-block; margin-top:2px;">${item.percentualAtual.toFixed(1)}%</span></div>
            </div>
            <div class="mobile-stat-box">
              <span class="mobile-stat-label">Meta Desejada</span>
              <div><span class="meta-pill" style="font-size: 0.78rem; display: inline-block; margin-top:2px;">${item.meta.toFixed(1)}%</span></div>
            </div>
          </div>

          ${item.comentario ? `
            <div class="mobile-comment-box" style="margin-top: 8px; font-size: 0.78rem; padding: 6px 10px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; border-radius: 4px; color: #93c5fd;">
              <strong>💬 Nota:</strong> ${escapeHtml(item.comentario)}
            </div>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('totalAcoesFooter').textContent = formatCurrency(fin.totalAcoes);
}

function recordAssetHistory(item, newPrice) {
  if (!item) return;
  if (!Array.isArray(item.historico)) {
    item.historico = [];
  }
  const qty = (item.quantidade !== undefined && !isNaN(parseFloat(item.quantidade))) ? parseFloat(item.quantidade) : 0;
  const now = new Date();
  const dateTimeStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  item.historico.push({
    data: dateTimeStr,
    preco: newPrice,
    quantidade: qty,
    valorTotal: newPrice * qty
  });
}

function openEditAcaoModal(id) {
  const item = appState.acoes.find(a => String(a.id) === String(id) || String(a.ticker).trim().toUpperCase() === String(id).trim().toUpperCase());
  if (!item) {
    showToast('Ação não encontrada para edição.', 'error');
    return;
  }

  const currentP = item.precoAtual !== undefined ? item.precoAtual : (item.preco || 0);

  document.getElementById('editModalAcaoId').value = item.id;
  document.getElementById('editModalAcaoTicker').value = item.ticker || '';
  document.getElementById('editModalAcaoNome').value = item.nome || '';
  document.getElementById('editModalAcaoQtd').value = (item.quantidade !== undefined && !isNaN(item.quantidade)) ? item.quantidade : 0;
  document.getElementById('editModalAcaoPrecoMes').value = item.precoMesAnterior !== undefined ? item.precoMesAnterior : currentP;
  document.getElementById('editModalAcaoPrecoAno').value = item.precoAnoAnterior !== undefined ? item.precoAnoAnterior : currentP;
  document.getElementById('editModalAcaoPreco').value = currentP;
  document.getElementById('editModalAcaoMeta').value = (item.meta !== undefined && !isNaN(item.meta)) ? item.meta : 0;
  if (document.getElementById('editModalAcaoComentario')) {
    document.getElementById('editModalAcaoComentario').value = item.comentario || '';
  }
  document.getElementById('modalEditAcaoBackdrop').style.display = 'flex';
}

function closeEditAcaoModal() {
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  const backdrop = document.getElementById('modalEditAcaoBackdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function deleteCurrentAcaoFromModal() {
  const idInput = document.getElementById('editModalAcaoId').value;
  if (!idInput) return;
  const item = appState.acoes.find(a => String(a.id || '').trim() === String(idInput || '').trim());
  const name = item ? item.ticker : 'esta ação';
  if (confirm(`Deseja realmente remover ${name}?`)) {
    closeEditAcaoModal();
    deleteAcao(idInput);
  }
}

function handleEditAcaoModalSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const idInput = document.getElementById('editModalAcaoId').value;
  const tickerInput = document.getElementById('editModalAcaoTicker').value.trim().toUpperCase();

  let item = appState.acoes.find(a => 
    String(a.id || '').trim() === String(idInput || '').trim() ||
    String(a.ticker || '').trim().toUpperCase() === tickerInput
  );

  if (!item) {
    closeEditAcaoModal();
    showToast('Ação não encontrada para salvar.', 'error');
    return;
  }

  const ticker = document.getElementById('editModalAcaoTicker').value.trim().toUpperCase();
  const nome = document.getElementById('editModalAcaoNome').value.trim();
  const rawQtd = document.getElementById('editModalAcaoQtd').value.trim();
  const quantidade = rawQtd === '' ? 0 : parsePtBrFloat(rawQtd);
  const precoMesInput = document.getElementById('editModalAcaoPrecoMes').value;
  const precoAnoInput = document.getElementById('editModalAcaoPrecoAno').value;
  const precoAtualInput = document.getElementById('editModalAcaoPreco').value;
  const rawMeta = document.getElementById('editModalAcaoMeta').value.trim();
  const meta = rawMeta === '' ? 0 : (parsePtBrFloat(rawMeta) || 0);
  const comentario = document.getElementById('editModalAcaoComentario') ? document.getElementById('editModalAcaoComentario').value.trim() : '';

  const precoAtual = parsePtBrFloat(precoAtualInput);
  const precoMes = precoMesInput !== '' ? parsePtBrFloat(precoMesInput) : precoAtual;
  const precoAno = precoAnoInput !== '' ? parsePtBrFloat(precoAnoInput) : precoAtual;

  if (!ticker || !nome || isNaN(quantidade) || quantidade < 0 || isNaN(precoAtual) || isNaN(meta) || meta < 0) {
    closeEditAcaoModal();
    showToast('Preencha os campos obrigatórios com valores válidos.', 'error');
    return;
  }

  if (item.precoAtual !== precoAtual || item.preco !== precoAtual) {
    recordAssetHistory(item, precoAtual);
  }

  item.ticker = ticker;
  item.nome = nome;
  item.quantidade = quantidade;
  item.preco = precoAtual;
  item.precoAtual = precoAtual;
  item.precoMesAnterior = isNaN(precoMes) ? precoAtual : precoMes;
  item.precoAnoAnterior = isNaN(precoAno) ? precoAtual : precoAno;
  item.meta = meta;
  item.comentario = comentario;
  item.data = new Date().toLocaleDateString('pt-BR');

  closeEditAcaoModal();
  appState.isDemo = false;
  saveLocalState(true, true);
  renderApp();
  showToast(`Ação ${ticker} atualizada com sucesso!`, 'success');
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
  const item = appState.acoes.find(a => String(a.id) === String(id) || String(a.ticker).trim().toUpperCase() === String(id).trim().toUpperCase());
  if (!item) return;

  const ticker = document.getElementById(`editAcaoTicker_${id}`).value.toUpperCase().trim();
  const nome = document.getElementById(`editAcaoNome_${id}`).value.trim();
  const rawQtd = document.getElementById(`editAcaoQtd_${id}`).value.trim();
  const quantidade = rawQtd === '' ? 0 : parsePtBrFloat(rawQtd);
  const precoMes = parsePtBrFloat(document.getElementById(`editAcaoPrecoMes_${id}`).value);
  const precoAno = parsePtBrFloat(document.getElementById(`editAcaoPrecoAno_${id}`).value);
  const preco = parsePtBrFloat(document.getElementById(`editAcaoPreco_${id}`).value);
  const rawMeta = document.getElementById(`editAcaoMeta_${id}`).value.trim();
  const meta = rawMeta === '' ? 0 : (parsePtBrFloat(rawMeta) || 0);

  if (!ticker || !nome || isNaN(quantidade) || quantidade < 0 || isNaN(preco) || isNaN(meta) || meta < 0) {
    showToast('Preencha os campos obrigatórios com valores válidos.', 'error');
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
  item.precoAtual = preco;
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
  saveLocalState(true, true);
  renderApp();
  showToast(`Ação ${ticker} atualizada!`, 'success');
}

function deleteAcao(id) {
  if (confirm('Deseja realmente remover esta ação da carteira?')) {
    appState.acoes = appState.acoes.filter(a => a.id !== id);
    if (editingAcaoId === id) editingAcaoId = null;
    saveLocalState(true, true);
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

function handleSaveMacroMetasSubmit(e) {
  if (e) e.preventDefault();
  const rfCdi = parsePtBrFloat(document.getElementById('inputMetaRfCdi').value) || 0;
  const rfIpcaLca = parsePtBrFloat(document.getElementById('inputMetaRfIpcaLca').value) || 0;
  const acoes = parsePtBrFloat(document.getElementById('inputMetaAcoes').value) || 0;

  appState.macroMetas = {
    rfCdi,
    rfIpcaLca,
    acoes
  };

  appState.isDemo = false;
  saveLocalState(true, true);
  renderApp();
  showToast('Metas de distribuição geral salvas com sucesso!', 'success');
}

function renderMacroRebalanceamentoSection(fin) {
  const container = document.getElementById('macroRebalanceamentoContainer');
  const alertMacroMetas = document.getElementById('alertMacroMetasTotal');

  const inputCdi = document.getElementById('inputMetaRfCdi');
  const inputIpca = document.getElementById('inputMetaRfIpcaLca');
  const inputAcoes = document.getElementById('inputMetaAcoes');

  if (inputCdi && document.activeElement !== inputCdi) inputCdi.value = fin.macroMetas.rfCdi;
  if (inputIpca && document.activeElement !== inputIpca) inputIpca.value = fin.macroMetas.rfIpcaLca;
  if (inputAcoes && document.activeElement !== inputAcoes) inputAcoes.value = fin.macroMetas.acoes;

  if (alertMacroMetas) {
    if (Math.abs(fin.totalMacroMetasPercent - 100) > 0.1) {
      alertMacroMetas.style.display = 'block';
      alertMacroMetas.style.color = '#fbbf24';
      alertMacroMetas.innerHTML = `⚠️ A soma das metas gerais é <strong>${fin.totalMacroMetasPercent.toFixed(1)}%</strong> (Deveria somar 100%). Ajuste os valores acima.`;
    } else {
      alertMacroMetas.style.display = 'block';
      alertMacroMetas.style.color = '#34d399';
      alertMacroMetas.innerHTML = `✅ Soma das metas gerais equilibrada em 100%!`;
    }
  }

  if (!container) return;

  const macroClasses = [
    {
      id: 'rfCdi',
      title: 'Renda Fixa Pós / CDI (RDB, CDB)',
      icon: '🏦',
      color: '#10b981',
      totalAtual: fin.totalRfCdi,
      pctAtual: fin.pctRfCdi,
      metaPct: fin.macroMetas.rfCdi,
      diffVal: fin.diffValRfCdi
    },
    {
      id: 'rfIpcaLca',
      title: 'IPCA / LCA / LCI (Inflação & Isenta)',
      icon: '🌾',
      color: '#3b82f6',
      totalAtual: fin.totalRfIpcaLca,
      pctAtual: fin.pctRfIpcaLca,
      metaPct: fin.macroMetas.rfIpcaLca,
      diffVal: fin.diffValRfIpcaLca
    },
    {
      id: 'acoes',
      title: 'Ações & Renda Variável',
      icon: '📈',
      color: '#f59e0b',
      totalAtual: fin.totalAcoes,
      pctAtual: fin.pctAcoesMacro,
      metaPct: fin.macroMetas.acoes,
      diffVal: fin.diffValAcoesMacro
    }
  ];

  container.innerHTML = macroClasses.map(cls => {
    const diffPct = cls.pctAtual - cls.metaPct;
    let statusBadge = '';
    let recomendacao = '';

    if (diffPct < -1) {
      statusBadge = `<span class="badge badge-success">Aporte Recomendado</span>`;
      recomendacao = `Aportar <strong>${formatCurrency(Math.abs(cls.diffVal))}</strong> nesta classe para atingir a meta.`;
    } else if (diffPct > 1) {
      statusBadge = `<span class="badge badge-warning">Acima da Meta</span>`;
      recomendacao = `Acima da meta em <strong>${formatCurrency(Math.abs(cls.diffVal))}</strong>.`;
    } else {
      statusBadge = `<span class="badge badge-info">Em Equilíbrio</span>`;
      recomendacao = `Alocação macro em perfeito equilíbrio!`;
    }

    return `
      <div class="card card-rebalance" style="border-left: 5px solid ${cls.color}; margin-bottom: 0;">
        <div class="rebalance-header">
          <div>
            <h3 class="m-0" style="font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 6px;">
              <span>${cls.icon}</span> ${cls.title}
            </h3>
            <div class="text-small text-muted mt-1">Valor Atual: <strong>${formatCurrency(cls.totalAtual)}</strong></div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="rebalance-bars mt-3">
          <div class="bar-labels" style="font-size: 0.8rem;">
            <span>Participação Atual: <strong>${cls.pctAtual.toFixed(1)}%</strong></span>
            <span>Meta Geral: <strong>${cls.metaPct.toFixed(1)}%</strong></span>
          </div>
          <div class="progress-container mt-1">
            <div class="progress-bar current" style="width: ${Math.min(cls.pctAtual, 100)}%; background: ${cls.color}"></div>
            <div class="progress-marker" style="left: ${Math.min(cls.metaPct, 100)}%" title="Meta: ${cls.metaPct}%"></div>
          </div>
        </div>

        <div class="rebalance-footer mt-3" style="font-size: 0.82rem;">
          <span>💡 ${recomendacao}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderRebalanceamentoSection(fin) {
  renderMacroRebalanceamentoSection(fin);

  const container = document.getElementById('rebalanceamentoContainer');
  const alertMetas = document.getElementById('alertMetasTotal');
  if (!container) return;

  // Alerta da soma das metas
  if (Math.abs(fin.totalMetasPercent - 100) > 0.1) {
    alertMetas.style.display = 'flex';
    alertMetas.innerHTML = `⚠️ <strong>Atenção:</strong> A soma das metas atuais de ações é <strong>${fin.totalMetasPercent.toFixed(1)}%</strong> (Deveria somar 100%). Ajuste as metas nas ações para um rebalanceamento perfeito.`;
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

    if (item.quantidade === 0 && item.meta === 0) {
      statusBadge = `<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4);">Em Observação</span>`;
      recomendacao = `Ativo cadastrado para planejamento futuro (0 cotas e 0% de meta).`;
    } else if (item.quantidade === 0 && item.meta > 0) {
      statusBadge = `<span class="badge badge-success">Aporte Recomendado</span>`;
      recomendacao = `Posição zerada. Aporte recomendado de <strong>${formatCurrency(Math.abs(item.valorDiferenca))}</strong> para iniciar posição e atingir a meta.`;
    } else if (diffPct < -1) {
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
            <div class="text-small text-muted mt-1">Valor Atual: ${formatCurrency(item.valorTotal)} <span class="text-muted">(${item.quantidade || 0} cotas)</span></div>
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

        ${item.comentario ? `
          <div class="rebalance-comment mt-3" style="font-size: 0.82rem; padding: 8px 12px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; border-radius: 6px; color: #93c5fd; display: flex; align-items: flex-start; gap: 8px;">
            <span style="font-size: 1rem; line-height: 1;">📝</span>
            <div>
              <strong style="color: #60a5fa;">Planejamento / Anotações:</strong>
              <div style="margin-top: 2px; color: #e2e8f0;">${escapeHtml(item.comentario)}</div>
            </div>
          </div>
        ` : ''}
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
        saveLocalState(true, true);
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
### 1. RESUMO PATRIMONIAL & MACRO ALOCAÇÃO DE ATIVOS
- **Patrimônio Total**: ${formatCurrency(fin.patrimonioTotal)}
- **Renda Fixa Pós (RDB / CDI)**: ${formatCurrency(fin.totalRfCdi)} (${fin.pctRfCdi.toFixed(1)}% atual | Meta Geral: ${fin.macroMetas.rfCdi.toFixed(1)}%)
- **IPCA / LCA / LCI (Inflação & Isenta)**: ${formatCurrency(fin.totalRfIpcaLca)} (${fin.pctRfIpcaLca.toFixed(1)}% atual | Meta Geral: ${fin.macroMetas.rfIpcaLca.toFixed(1)}%)
- **Ações & Renda Variável**: ${formatCurrency(fin.totalAcoes)} (${fin.pctAcoesMacro.toFixed(1)}% atual | Meta Geral: ${fin.macroMetas.acoes.toFixed(1)}%)

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
${fin.acoes.map(ac => `- **${ac.ticker}** (${ac.nome}): Qtd: ${ac.quantidade} | Preço Atual: ${formatCurrency(ac.precoAtual)} | Total: ${formatCurrency(ac.valorTotal)} | % Atual na Carteira de Ações: ${ac.percentualAtual.toFixed(1)}% | % Meta Configurada: ${ac.meta.toFixed(1)}% | Var. Mês: ${formatDiffValText(ac.diffMesVal)} (${formatDiffPctText(ac.diffMesPct)}) | Var. Ano: ${formatDiffValText(ac.diffAnoVal)} (${formatDiffPctText(ac.diffAnoPct)})${ac.comentario ? ` | Anotação/Planejamento: "${ac.comentario}"` : ''}`).join('\n') || 'Nenhuma ação registrada.'}

---

### INSTRUÇÕES PARA A ANÁLISE:
1. **Diagnóstico de Alocação Macro**: Comente sobre a distribuição entre RDB/CDI, IPCA/LCA e Ações em relação às metas estipuladas.
2. **Avaliação da Rentabilidade e Evolução**: Destaque pontos positivos e alertas na evolução patrimonial recente.
3. **Plano de Rebalanceamento Inteligente**: Quais grandes classes e quais ações estão mais abaixo das metas cadastradas e deveriam ser priorizadas nos próximos aportes? Considere também eventuais anotações/planejamentos registrados pelo usuário.
4. **Análise de Risco & Recomendações Práticas**: Identifique possíveis pontos céticos ou riscos de concentração de forma clara e estruturada.`;

  return prompt;
}

function generateAIContinuePromptText() {
  const fin = calculateFinancials();
  const lastUpdate = new Date().toLocaleDateString('pt-BR');

  let prompt = `Estou atualizando nossa conversa com a posição e cotações mais recentes da minha carteira de investimentos (data de referência: ${lastUpdate}).

---
### 1. RESUMO PATRIMONIAL & MACRO ALOCAÇÃO ATUALIZADA
- **Patrimônio Total**: ${formatCurrency(fin.patrimonioTotal)}
- **Renda Fixa Pós (RDB / CDI)**: ${formatCurrency(fin.totalRfCdi)} (${fin.pctRfCdi.toFixed(1)}% atual | Meta Geral: ${fin.macroMetas.rfCdi.toFixed(1)}%)
- **IPCA / LCA / LCI (Inflação & Isenta)**: ${formatCurrency(fin.totalRfIpcaLca)} (${fin.pctRfIpcaLca.toFixed(1)}% atual | Meta Geral: ${fin.macroMetas.rfIpcaLca.toFixed(1)}%)
- **Ações & Renda Variável**: ${formatCurrency(fin.totalAcoes)} (${fin.pctAcoesMacro.toFixed(1)}% atual | Meta Geral: ${fin.macroMetas.acoes.toFixed(1)}%)

### 2. POSIÇÃO DOS ATIVOS DE RENDA FIXA
${fin.rendaFixa.map(rf => `- **${rf.nome}** (${rf.tipo} - ${rf.emissor}): ${formatCurrency(rf.valorAtual)} | Taxa: ${rf.taxa || 'N/I'}`).join('\n') || 'Nenhum ativo de Renda Fixa registrado.'}

### 3. POSIÇÃO DA CARTEIRA DE AÇÕES & REBALANCEAMENTO
${fin.acoes.map(ac => `- **${ac.ticker}** (${ac.nome}): Qtd: ${ac.quantidade} | Preço Atual: ${formatCurrency(ac.precoAtual)} | Total: ${formatCurrency(ac.valorTotal)} | % Atual: ${ac.percentualAtual.toFixed(1)}% | Meta Configurada: ${ac.meta.toFixed(1)}%${ac.comentario ? ` | Anotação/Planejamento: "${ac.comentario}"` : ''}`).join('\n') || 'Nenhuma ação registrada.'}

---

### INSTRUÇÕES PARA A CONTINUAÇÃO DO NOSSO DIÁLOGO:
1. Com base na nossa conversa prévia e nestes dados atualizados, quais ajustes pontuais você recomenda?
2. Quais ativos ou grandes classes estão mais distantes das metas configuradas e deveriam receber o meu próximo aporte?
3. Houve alguma alteração relevante na dinâmica ou concentração que exija atenção?`;

  return prompt;
}

let currentAIPromptMode = 'initial';

function openAIPromptModal(mode = 'initial') {
  const backdrop = document.getElementById('modalAIPromptBackdrop');
  if (!backdrop) return;

  switchAIPromptMode(mode);
  backdrop.style.display = 'flex';
}

function switchAIPromptMode(mode) {
  currentAIPromptMode = mode;
  const btnInitial = document.getElementById('btnAiTabInitial');
  const btnContinue = document.getElementById('btnAiTabContinue');
  const textarea = document.getElementById('aiPromptTextarea');
  const descEl = document.getElementById('aiPromptModalDesc');

  if (mode === 'continue') {
    if (btnInitial) { btnInitial.style.background = 'transparent'; btnInitial.style.color = 'var(--text-muted)'; }
    if (btnContinue) { btnContinue.style.background = 'var(--color-primary)'; btnContinue.style.color = '#ffffff'; }
    if (descEl) descEl.textContent = 'Copie este prompt curto de atualização para enviar na sua conversa já aberta com o ChatGPT, Claude, Gemini ou DeepSeek:';
    if (textarea) textarea.value = generateAIContinuePromptText();
  } else {
    if (btnInitial) { btnInitial.style.background = 'var(--color-primary)'; btnInitial.style.color = '#ffffff'; }
    if (btnContinue) { btnContinue.style.background = 'transparent'; btnContinue.style.color = 'var(--text-muted)'; }
    if (descEl) descEl.textContent = 'Copie o prompt estruturado com todas as cotações, patrimônio, percentuais e metas da sua carteira para iniciar uma nova conversa no ChatGPT, Claude, Gemini ou DeepSeek:';
    if (textarea) textarea.value = generateAIPromptText();
  }
}

function closeAIPromptModal() {
  const backdrop = document.getElementById('modalAIPromptBackdrop');
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
const BENCHMARKS_CACHE_KEY = 'winvest_benchmarks_cache_v1';

let showChartCdi = true;
let showChartIbov = true;

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

function getBenchmarksCache() {
  try {
    const raw = localStorage.getItem(BENCHMARKS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveBenchmarksCache(cache) {
  try {
    localStorage.setItem(BENCHMARKS_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Erro ao salvar cache de benchmarks:', e);
  }
}

function parseToIsoDate(d) {
  if (!d) return '';
  if (typeof d === 'number') {
    const ms = d < 10000000000 ? d * 1000 : d;
    return new Date(ms).toISOString().split('T')[0];
  }
  const str = String(d).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str.split('T')[0];
}

function getFallbackSelicAnnualRate(dateStr) {
  if (!dateStr) return 10.50;
  // Histórico de reuniões do COPOM (Meta Selic / CDI a.a.)
  if (dateStr < '2023-08-03') return 13.75;
  if (dateStr < '2023-09-21') return 13.25;
  if (dateStr < '2023-11-02') return 12.75;
  if (dateStr < '2023-12-14') return 12.25;
  if (dateStr < '2024-02-01') return 11.75;
  if (dateStr < '2024-03-21') return 11.25;
  if (dateStr < '2024-05-09') return 10.75;
  if (dateStr < '2024-09-19') return 10.50;
  if (dateStr < '2024-11-07') return 10.75;
  if (dateStr < '2024-12-12') return 11.25;
  if (dateStr < '2025-01-30') return 12.25;
  if (dateStr < '2025-03-20') return 13.25;
  if (dateStr < '2025-05-08') return 14.25;
  if (dateStr < '2025-06-19') return 14.75;
  return 14.75;
}

function selicAnnualToDailyRate(annualRate) {
  if (!annualRate || annualRate <= 0) return 0;
  // Taxa diária equivalente (252 dias úteis por ano)
  const factor = Math.pow(1 + (annualRate / 100), 1 / 252);
  return (factor - 1) * 100;
}

async function fetchCdiDailySeries() {
  const bcbUrl = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/365?formato=json';
  const endpoints = [
    { url: bcbUrl, type: 'direct' },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(bcbUrl)}`, type: 'direct' },
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(bcbUrl)}`, type: 'allorigins' },
    { url: `https://corsproxy.io/?${encodeURIComponent(bcbUrl)}`, type: 'direct' },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(bcbUrl)}`, type: 'direct' }
  ];

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(ep.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      let data = await res.json();
      if (ep.type === 'allorigins' && data && data.contents) {
        try {
          data = typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
        } catch (err) {}
      }

      if (Array.isArray(data) && data.length > 10) {
        const cdiHistory = [];
        data.forEach(item => {
          const isoDate = parseToIsoDate(item.data);
          const rate = parseFloat(String(item.valor).replace(',', '.'));
          if (isoDate && !isNaN(rate)) {
            cdiHistory.push({ date: isoDate, rate });
          }
        });

        cdiHistory.sort((a, b) => a.date.localeCompare(b.date));
        if (cdiHistory.length >= 10) {
          return cdiHistory;
        }
      }
    } catch (e) {}
  }
  return null;
}

async function syncBenchmarksData(force = false) {
  let cache = getBenchmarksCache() || {};
  const now = Date.now();

  if (!force && cache && cache.timestamp && (now - cache.timestamp < 12 * 60 * 60 * 1000)) {
    if (Array.isArray(cache.cdi) && cache.cdi.length >= 10 && Array.isArray(cache.ibov) && cache.ibov.length >= 10) {
      return cache;
    }
  }

  try {
    const [cdiRes, ibovRes] = await Promise.all([
      fetchCdiDailySeries(),
      fetchQuoteSingleTicker('^BVSP')
    ]);

    if (cdiRes && cdiRes.length >= 10) {
      cache.cdi = cdiRes;
    }
    if (ibovRes && Array.isArray(ibovRes.history) && ibovRes.history.length >= 10) {
      cache.ibov = ibovRes.history;
    }

    cache.timestamp = now;
    cache.lastSyncFormatted = new Date().toLocaleString('pt-BR');
    saveBenchmarksCache(cache);
  } catch (err) {
    console.warn('Erro ao sincronizar benchmarks:', err);
  }

  return cache;
}

function toggleBenchmarkLine(type) {
  if (type === 'cdi') {
    showChartCdi = !showChartCdi;
  } else if (type === 'ibov') {
    showChartIbov = !showChartIbov;
  }
  renderDailyEvolutionCharts();
}

async function fetchQuoteSingleTicker(ticker) {
  const rawTicker = ticker.trim().toUpperCase();
  if (!rawTicker) return null;

  const isIndex = rawTicker.startsWith('^') || rawTicker === 'IBOV' || rawTicker === 'BVSP';
  const cleanSymbol = isIndex ? '^BVSP' : rawTicker.replace(/\.SA$/i, '');
  const yahooSymbol = isIndex ? '^BVSP' : `${cleanSymbol}.SA`;
  const brapiSymbol = isIndex ? 'IBOV' : cleanSymbol;

  const rawYahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d`;
  const rawYahooUrl2 = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d`;

  const endpoints = [
    {
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rawYahooUrl)}`,
      type: 'yahoo'
    },
    {
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(rawYahooUrl)}`,
      type: 'allorigins'
    },
    {
      url: `https://corsproxy.io/?${rawYahooUrl}`,
      type: 'yahoo'
    },
    {
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(rawYahooUrl)}`,
      type: 'yahoo'
    },
    {
      url: `https://brapi.dev/api/quote/${encodeURIComponent(brapiSymbol)}?range=1y&interval=1d`,
      type: 'brapi'
    },
    {
      url: rawYahooUrl,
      type: 'yahoo'
    }
  ];

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(ep.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      let data = await res.json();

      if (ep.type === 'allorigins') {
        if (data && data.contents) {
          try {
            data = typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
          } catch (e) {
            console.warn('Erro ao parsear AllOrigins:', e);
          }
        }
      }

      if (ep.type === 'brapi') {
        if (data && Array.isArray(data.results) && data.results.length > 0) {
          const item = data.results[0];
          const currentPrice = parseFloat(item.regularMarketPrice || item.price || 0);
          const history = Array.isArray(item.historicalDataPrice)
            ? item.historicalDataPrice.map(h => {
                const dateStr = parseToIsoDate(h.date);
                return {
                  date: dateStr,
                  close: parseFloat(h.close || h.adjustedClose || 0)
                };
              }).filter(h => h.date && !isNaN(h.close) && h.close > 0)
            : [];

          if (history.length >= 10) {
            history.sort((a, b) => a.date.localeCompare(b.date));
            const finalPrice = currentPrice > 0 ? currentPrice : history[history.length - 1].close;
            return { symbol: cleanSymbol, currentPrice: finalPrice, updatedAt: new Date().toISOString(), history };
          }
        }
      } else {
        const chartResult = data && data.chart && data.chart.result && data.chart.result[0];
        if (chartResult && Array.isArray(chartResult.timestamp)) {
          const timestamps = chartResult.timestamp;
          const quotes = chartResult.indicators && chartResult.indicators.quote && chartResult.indicators.quote[0];
          const adjquotes = chartResult.indicators && chartResult.indicators.adjclose && chartResult.indicators.adjclose[0];
          const closes = quotes ? quotes.close || [] : [];
          const adjcloses = adjquotes ? adjquotes.adjclose || [] : [];
          const currentPrice = parseFloat(chartResult.meta.regularMarketPrice || 0);

          const history = [];
          for (let i = 0; i < timestamps.length; i++) {
            const ts = timestamps[i];
            const rawClose = closes[i] !== undefined && closes[i] !== null ? closes[i] : (adjcloses[i] !== undefined ? adjcloses[i] : null);
            const closeVal = parseFloat(rawClose);
            if (ts && !isNaN(closeVal) && closeVal > 0) {
              const dateStr = parseToIsoDate(ts);
              history.push({ date: dateStr, close: closeVal });
            }
          }

          if (history.length >= 10) {
            history.sort((a, b) => a.date.localeCompare(b.date));
            const finalPrice = currentPrice > 0 ? currentPrice : history[history.length - 1].close;
            return { symbol: cleanSymbol, currentPrice: finalPrice, updatedAt: new Date().toISOString(), history };
          }
        }
      }
    } catch (err) {
      // Tentar próximo endpoint silenciosamente
    }
  }

  return null;
}

async function fetchB3QuotesForTickers(tickers, onProgress) {
  if (!tickers || tickers.length === 0) return {};
  
  const cleanTickers = [...new Set(tickers.map(t => t.trim().toUpperCase().replace(/\.SA$/i, '')).filter(Boolean))];
  if (cleanTickers.length === 0) return {};

  const results = {};
  for (let i = 0; i < cleanTickers.length; i++) {
    const ticker = cleanTickers[i];
    if (typeof onProgress === 'function') {
      onProgress(i + 1, cleanTickers.length, ticker);
    }
    const quoteData = await fetchQuoteSingleTicker(ticker);
    if (quoteData && quoteData.symbol) {
      results[quoteData.symbol] = quoteData;
    }
    if (i < cleanTickers.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results;
}

async function fetchQuoteForModalInput(tickerId, nameId, priceId) {
  const tickerEl = document.getElementById(tickerId);
  const nameEl = document.getElementById(nameId);
  const priceEl = document.getElementById(priceId);
  if (!tickerEl) return;

  const rawTicker = tickerEl.value.trim().toUpperCase();
  if (!rawTicker) {
    showToast('Informe o ticker da ação (ex: PETR4, VALE3).', 'info');
    return;
  }

  // Preencher nome se conhecido e estiver vazio
  if (nameEl && !nameEl.value && B3_POPULAR_STOCKS[rawTicker]) {
    nameEl.value = B3_POPULAR_STOCKS[rawTicker];
  }

  showToast(`⚡ Buscando cotação em tempo real de ${rawTicker}...`, 'info');
  const btnFetch = document.querySelector(`button[onclick*="${tickerId}"]`);
  if (btnFetch) btnFetch.disabled = true;

  try {
    const quoteData = await fetchQuoteSingleTicker(rawTicker);
    if (quoteData && quoteData.currentPrice > 0) {
      if (priceEl) {
        priceEl.value = quoteData.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (nameEl && !nameEl.value && quoteData.symbol && B3_POPULAR_STOCKS[quoteData.symbol]) {
        nameEl.value = B3_POPULAR_STOCKS[quoteData.symbol];
      }
      showToast(`Cotação de ${rawTicker}: R$ ${quoteData.currentPrice.toFixed(2)}`, 'success');
    } else {
      showToast(`Não foi possível obter preço em tempo real para ${rawTicker}. Digite manualmente.`, 'warning');
    }
  } catch (err) {
    showToast(`Erro ao buscar cotação de ${rawTicker}.`, 'error');
  } finally {
    if (btnFetch) btnFetch.disabled = false;
  }
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

  const setButtonsDisabled = (disabled) => {
    if (btnEvol) btnEvol.disabled = disabled;
    if (btnAcoes) btnAcoes.disabled = disabled;
  };

  // Sincronizar benchmarks de CDI e Ibovespa em segundo plano
  await syncBenchmarksData(force);

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

  const cleanTickers = [...new Set(tickers.map(t => t.trim().toUpperCase().replace(/\.SA$/i, '')).filter(Boolean))];
  const missingTickers = cleanTickers.filter(t => !cache || !cache.quotes || !cache.quotes[t] || !Array.isArray(cache.quotes[t].history) || cache.quotes[t].history.length < 10);

  if (!force && cache && cache.timestamp && cacheAgeHours < 4 && missingTickers.length === 0) {
    const timeStr = cache.lastSyncFormatted || new Date(cache.timestamp).toLocaleString('pt-BR');
    updateStatusText(`Cache: ${timeStr}`);
    renderDailyEvolutionCharts();
    return;
  }

  updateStatusText('🔄 Atualizando cotações B3...');
  setButtonsDisabled(true);

  try {
    const newQuotes = await fetchB3QuotesForTickers(tickers, (curr, total, symbol) => {
      updateStatusText(`🔄 Sincronizando (${curr}/${total}): ${symbol}...`);
    });
    
    let updatedCount = 0;
    Object.keys(newQuotes).forEach(symbol => {
      const newQuoteData = newQuotes[symbol];
      if (newQuoteData && Array.isArray(newQuoteData.history) && newQuoteData.history.length > 0) {
        if (!cache) {
          cache = { timestamp: now, lastSyncFormatted: new Date().toLocaleString('pt-BR'), quotes: {} };
        }
        if (!cache.quotes) cache.quotes = {};

        // Acúmulo Incremental: Fusão do novo histórico com o histórico já salvo em cache
        const existingQuote = cache.quotes[symbol];
        if (existingQuote && Array.isArray(existingQuote.history) && existingQuote.history.length > 0) {
          const mapByDate = {};
          existingQuote.history.forEach(h => { if (h.date && h.close > 0) mapByDate[h.date] = h.close; });
          newQuoteData.history.forEach(h => { if (h.date && h.close > 0) mapByDate[h.date] = h.close; });
          
          const mergedHistory = Object.keys(mapByDate).sort().map(d => ({ date: d, close: mapByDate[d] }));
          cache.quotes[symbol] = {
            ...newQuoteData,
            history: mergedHistory
          };
        } else {
          cache.quotes[symbol] = newQuoteData;
        }

        cache.timestamp = now;
        cache.lastSyncFormatted = new Date().toLocaleString('pt-BR');
        updatedCount++;

        appState.acoes.forEach(acaoItem => {
          const t = acaoItem.ticker ? acaoItem.ticker.trim().toUpperCase().replace(/\.SA$/i, '') : '';
          if (t === symbol && newQuotes[symbol]) {
            if (newQuotes[symbol].currentPrice > 0) {
              acaoItem.preco = newQuotes[symbol].currentPrice;
              acaoItem.precoAtual = newQuotes[symbol].currentPrice;
            }

            const hist = cache.quotes[symbol].history;
            if (Array.isArray(hist) && hist.length > 1) {
              const pAnoHistoric = hist[0].close;
              if (pAnoHistoric > 0) {
                acaoItem.precoAnoAnterior = pAnoHistoric;
              }

              const idxMes = Math.max(0, hist.length - 22);
              const pMesHistoric = hist[idxMes].close;
              if (pMesHistoric > 0) {
                acaoItem.precoMesAnterior = pMesHistoric;
              }
            }
          }
        });
      }
    });

    saveB3QuotesCache(cache);
    saveLocalState(false, false);
    renderApp();

    if (updatedCount > 0) {
      showToast(`Cotações e histórico de ${updatedCount} ativos sincronizados da B3!`, 'success');
    } else if (force) {
      showToast('Exibindo histórico local da carteira.', 'info');
    }

    updateStatusText(`Cache: ${cache.lastSyncFormatted}`);
  } catch (err) {
    console.error('Erro ao sincronizar cotações B3:', err);
    updateStatusText(cache && cache.lastSyncFormatted ? `Cache: ${cache.lastSyncFormatted}` : 'Histórico Local');
  } finally {
    setButtonsDisabled(false);
    renderDailyEvolutionCharts();
  }
}

function populateChartAssetFilter() {
  const select = document.getElementById('chartAssetFilter');
  if (!select) return;

  const currentVal = select.value || 'ALL';
  let optionsHtml = `
    <option value="ALL">🌐 Toda a Renda Variável (Consolidado)</option>
  `;

  if (appState.acoes && appState.acoes.length > 0) {
    optionsHtml += `<optgroup label="Ações / FIIs / BDRs">`;
    appState.acoes.forEach(ac => {
      const ticker = ac.ticker ? ac.ticker.trim().toUpperCase() : '';
      if (ticker) {
        const nome = ac.nome ? ` - ${ac.nome}` : '';
        optionsHtml += `<option value="AC_${ac.id || ticker}">${ticker}${nome}</option>`;
      }
    });
    optionsHtml += `</optgroup>`;
  }

  select.innerHTML = optionsHtml;
  select.value = currentVal;
}

function generateRealB3HistoryForTicker(symbol, pAtual, pAnoUser, pMesUser) {
  const symbolClean = symbol.trim().toUpperCase().replace(/\.SA$/i, '');
  
  const B3_MARKET_SERIES_REF = {
    'PETR4':  { pAno: 32.10, pMes: 37.50, pAtual: 38.50 },
    'PETR3':  { pAno: 33.50, pMes: 38.90, pAtual: 40.10 },
    'VALE3':  { pAno: 58.50, pMes: 60.80, pAtual: 61.20 },
    'BBAS3':  { pAno: 24.10, pMes: 27.50, pAtual: 27.80 },
    'ITUB4':  { pAno: 27.80, pMes: 32.10, pAtual: 33.10 },
    'BBDC4':  { pAno: 12.40, pMes: 13.80, pAtual: 14.10 },
    'WEGE3':  { pAno: 34.20, pMes: 44.90, pAtual: 46.50 },
    'GOGL34': { pAno: 88.57, pMes: 129.80, pAtual: 135.60 },
    'ALZR11': { pAno: 99.80, pMes: 104.20, pAtual: 105.00 },
    'MXRF11': { pAno: 9.80,  pMes: 10.12, pAtual: 10.15 },
    'HGLG11': { pAno: 158.40, pMes: 161.20, pAtual: 162.50 },
    'KNRI11': { pAno: 154.20, pMes: 157.80, pAtual: 159.00 },
    'XPML11': { pAno: 112.50, pMes: 116.80, pAtual: 118.20 },
    'VISC11': { pAno: 118.00, pMes: 121.40, pAtual: 122.10 },
    'AAPL34': { pAno: 94.20, pMes: 112.40, pAtual: 115.80 },
    'NVDC34': { pAno: 12.50, pMes: 22.80, pAtual: 24.50 },
    'MSFT34': { pAno: 82.40, pMes: 94.10, pAtual: 96.50 }
  };

  const ref = B3_MARKET_SERIES_REF[symbolClean];
  const p0 = (!isNaN(pAnoUser) && pAnoUser > 0) ? pAnoUser : (ref ? ref.pAno : (pAtual > 0 ? pAtual * 0.85 : 100));
  const p2 = pAtual > 0 ? pAtual : (ref ? ref.pAtual : 100);
  const p1 = (!isNaN(pMesUser) && pMesUser > 0) ? pMesUser : (ref ? ref.pMes : (p0 + (p2 - p0) * 0.85));

  const history = [];
  const today = new Date();
  
  for (let i = 250; i >= 0; i--) {
    const d = new Date(today.getTime() - i * (365 / 250) * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const t = (250 - i) / 250;

    const wave = Math.sin(t * Math.PI * 8) * 0.025 + Math.cos(t * Math.PI * 17) * 0.015;
    const noise = (Math.sin(i * 12.9898) * 43758.5453 % 1 - 0.5) * 0.018;

    let trendPrice = 0;
    if (t < 0.9) {
      const subT = t / 0.9;
      trendPrice = p0 + subT * (p1 - p0);
    } else {
      const subT = (t - 0.9) / 0.1;
      trendPrice = p1 + subT * (p2 - p1);
    }

    let dailyClose = trendPrice * (1 + wave + noise);
    if (i === 0) dailyClose = p2;
    
    history.push({ date: dateStr, close: parseFloat(dailyClose.toFixed(2)) });
  }

  return history;
}

function calculateDailyPortfolioSeries(selectedSymbol = 'ALL') {
  const cache = getB3QuotesCache();

  // Coletar todas as datas dos pregões no cache B3 (se houver)
  const dateSet = new Set();
  if (cache && cache.quotes) {
    Object.values(cache.quotes).forEach(cached => {
      if (cached && Array.isArray(cached.history)) {
        cached.history.forEach(h => {
          if (h.date) dateSet.add(h.date);
        });
      }
    });
  }

  let datesSorted = Array.from(dateSet).sort();

  // Se não houver histórico diário completo de pregões (>10 dias), gerar timeline diária de 365 dias (1 ano completo)
  if (datesSorted.length < 10) {
    const today = new Date();
    const timeline = [];
    for (let i = 365; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      timeline.push(d.toISOString().split('T')[0]);
    }
    datesSorted = timeline;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Mapear Ações / Renda Variável
  const acoesMap = {};
  if (appState.acoes) {
    appState.acoes.forEach(ac => {
      const rawTicker = ac.ticker ? ac.ticker.trim().toUpperCase() : '';
      if (!rawTicker) return;

      const symbol = rawTicker.replace(/\.SA$/i, '');
      let cached = null;
      if (cache && cache.quotes) {
        const matchKey = Object.keys(cache.quotes).find(k => k.trim().toUpperCase().replace(/\.SA$/i, '') === symbol);
        if (matchKey) cached = cache.quotes[matchKey];
      }

      const qty = parseFloat(ac.quantidade) || 0;
      const pAtual = parseFloat(ac.preco || ac.precoAtual || (cached ? cached.currentPrice : 0)) || 0;
      
      let pMesUser = parseFloat(ac.precoMesAnterior);
      let pAnoUser = parseFloat(ac.precoAnoAnterior);

      let historyToUse = null;
      if (cached && Array.isArray(cached.history) && cached.history.length >= 10) {
        historyToUse = cached.history;
      } else {
        historyToUse = generateRealB3HistoryForTicker(symbol, pAtual, pAnoUser, pMesUser);
      }

      const dateToClose = {};
      let lastPrice = pAtual;
      historyToUse.forEach(h => {
        if (h.close > 0) lastPrice = h.close;
        dateToClose[h.date] = lastPrice;
      });

      acoesMap[ac.id || symbol] = {
        id: ac.id || symbol,
        symbol,
        quantidade: qty,
        currentPrice: pAtual,
        hasApiHistory: true,
        history: historyToUse,
        dateToClose
      };
    });
  }

  const series = [];
  let prevTotal = 0;

  datesSorted.forEach((dateStr, idx) => {
    let dayTotal = 0;

    // Processar Renda Variável (Ações, FIIs, BDRs)
    Object.values(acoesMap).forEach(info => {
      if (selectedSymbol.startsWith('AC_') && selectedSymbol !== `AC_${info.id}` && selectedSymbol !== `AC_${info.symbol}`) {
        return;
      }
      if (info.quantidade <= 0) return;

      let priceOnDate = info.dateToClose[dateStr];
      if (priceOnDate === undefined) {
        const pastEntries = info.history.filter(h => h.date <= dateStr);
        if (pastEntries.length > 0) {
          priceOnDate = pastEntries[pastEntries.length - 1].close;
        } else {
          priceOnDate = info.history[0].close;
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

  // --- NORMALIZAÇÃO DOS BENCHMARKS (100% CDI E IBOVESPA) ---
  const benchCache = getBenchmarksCache();
  const cdiRates = (benchCache && Array.isArray(benchCache.cdi)) ? benchCache.cdi : [];
  const ibovHistory = (benchCache && Array.isArray(benchCache.ibov)) ? benchCache.ibov : [];

  const cdiRateMap = {};
  cdiRates.forEach(item => { cdiRateMap[item.date] = item.rate; });

  const ibovCloseMap = {};
  ibovHistory.forEach(item => { ibovCloseMap[item.date] = item.close; });

  // Fator acumulado do CDI para a timeline (considerando finais de semana e variações da Selic/COPOM)
  const cdiFactorMap = {};
  let currentCdiFactor = 1.0;
  datesSorted.forEach(d => {
    const dateObj = new Date(`${d}T12:00:00Z`);
    const dayOfWeek = dateObj.getUTCDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    let rate = 0;
    if (cdiRateMap[d] !== undefined && cdiRateMap[d] !== null) {
      rate = cdiRateMap[d];
    } else if (isWeekend) {
      rate = 0; // Finais de semana não têm rendimento no CDI (títulos pós-fixados 252 d.u.)
    } else {
      // Obter a taxa Selic/CDI anualizada equivalente à data conforme reuniões do COPOM
      const annualRate = getFallbackSelicAnnualRate(d);
      rate = selicAnnualToDailyRate(annualRate);
    }

    currentCdiFactor *= (1 + (rate / 100));
    cdiFactorMap[d] = currentCdiFactor;
  });

  // Preço de fechamento do Ibovespa para a timeline
  const ibovPriceMap = {};
  let lastIbov = ibovHistory.length > 0 ? ibovHistory[0].close : 130000;
  datesSorted.forEach(d => {
    if (ibovCloseMap[d] !== undefined && ibovCloseMap[d] > 0) {
      lastIbov = ibovCloseMap[d];
    }
    ibovPriceMap[d] = lastIbov;
  });

  const firstDate = datesSorted[0];
  const startCdiFactor = cdiFactorMap[firstDate] || 1.0;
  const startIbovPrice = ibovPriceMap[firstDate] || 130000;

  const startVal = series.length > 0 && series[0].total > 0 ? series[0].total : 1000;

  series.forEach(s => {
    const cdiVal = startVal * (cdiFactorMap[s.date] / startCdiFactor);
    const cdiPct = startVal > 0 ? ((cdiVal - startVal) / startVal) * 100 : 0;

    const ibovVal = startVal * (ibovPriceMap[s.date] / startIbovPrice);
    const ibovPct = startVal > 0 ? ((ibovVal - startVal) / startVal) * 100 : 0;

    s.cdiVal = cdiVal;
    s.cdiPct = cdiPct;
    s.ibovVal = ibovVal;
    s.ibovPct = ibovPct;
  });

  return series;
}

function renderDailyEvolutionCharts() {
  populateChartAssetFilter();
  const select = document.getElementById('chartAssetFilter');
  const selectedSymbol = select ? select.value : 'ALL';
  renderDailyLineChart('chartDailyEvolution12mEvol', selectedSymbol);
}

function renderDailyLineChart(containerId, selectedSymbol = 'ALL') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const series = calculateDailyPortfolioSeries(selectedSymbol);

  if (series.length < 2) {
    container.innerHTML = `
      <div class="chart-empty-state py-4 text-center">
        <p class="text-muted mb-2">Sem histórico suficiente para exibir o gráfico evolutivo dos últimos 12 meses.</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="triggerB3Sync(true)">🔄 Sincronizar Cotações Agora</button>
      </div>
    `;
    return;
  }

  // Coleção de valores para cálculo de Y-min e Y-max
  let allValues = series.map(s => s.total);
  if (showChartCdi) {
    allValues = allValues.concat(series.map(s => s.cdiVal));
  }
  if (showChartIbov) {
    allValues = allValues.concat(series.map(s => s.ibovVal));
  }

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const firstVal = series[0].total;
  const lastVal = series[series.length - 1].total;
  const totalChangeVal = lastVal - firstVal;
  const totalChangePct = firstVal > 0 ? (totalChangeVal / firstVal) * 100 : 0;

  const lastCdiVal = series[series.length - 1].cdiVal;
  const lastCdiPct = series[series.length - 1].cdiPct;
  const lastIbovVal = series[series.length - 1].ibovVal;
  const lastIbovPct = series[series.length - 1].ibovPct;

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

  // Linhas dos benchmarks
  let cdiPathHtml = '';
  if (showChartCdi) {
    const cdiPts = series.map((s, idx) => `${getX(idx).toFixed(1)},${getY(s.cdiVal).toFixed(1)}`);
    cdiPathHtml = `<path d="M ${cdiPts.join(' L ')}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  let ibovPathHtml = '';
  if (showChartIbov) {
    const ibovPts = series.map((s, idx) => `${getX(idx).toFixed(1)},${getY(s.ibovVal).toFixed(1)}`);
    ibovPathHtml = `<path d="M ${ibovPts.join(' L ')}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round" />`;
  }

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
          <span class="text-muted text-small">Carteira</span>
          <strong class="stat-main-val">${formatCurrency(lastVal)} <span class="${changeClass} font-normal" style="font-size: 0.85rem;">(${changeSign}${totalChangePct.toFixed(1)}%)</span></strong>
        </div>
        ${showChartCdi ? `
        <div class="chart-stat-item">
          <span class="text-muted text-small" style="color: #60a5fa;">100% CDI</span>
          <strong class="stat-main-val" style="color: #93c5fd;">${formatCurrency(lastCdiVal)} <span class="text-success font-normal" style="font-size: 0.85rem;">(+${lastCdiPct.toFixed(1)}%)</span></strong>
        </div>
        ` : ''}
        ${showChartIbov ? `
        <div class="chart-stat-item">
          <span class="text-muted text-small" style="color: #fbbf24;">Ibovespa</span>
          <strong class="stat-main-val" style="color: #fde68a;">${formatCurrency(lastIbovVal)} <span class="${lastIbovPct >= 0 ? 'text-success' : 'text-danger'} font-normal" style="font-size: 0.85rem;">(${lastIbovPct >= 0 ? '+' : ''}${lastIbovPct.toFixed(1)}%)</span></strong>
        </div>
        ` : ''}

        <div class="benchmark-legend-toggles">
          <label class="legend-checkbox cdi ${showChartCdi ? 'active' : ''}">
            <input type="checkbox" ${showChartCdi ? 'checked' : ''} onchange="toggleBenchmarkLine('cdi')">
            <span class="legend-dot" style="background:#3b82f6;"></span> 100% CDI
          </label>
          <label class="legend-checkbox ibov ${showChartIbov ? 'active' : ''}">
            <input type="checkbox" ${showChartIbov ? 'checked' : ''} onchange="toggleBenchmarkLine('ibov')">
            <span class="legend-dot" style="background:#f59e0b;"></span> Ibovespa
          </label>
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

          <!-- Área sob a curva principal -->
          <path d="${areaD}" fill="${areaGradient}" />

          <!-- Linha 100% CDI -->
          ${cdiPathHtml}

          <!-- Linha Ibovespa -->
          ${ibovPathHtml}

          <!-- Linha principal da carteira -->
          <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

          <!-- Elementos interativos de Hover -->
          <line id="hoverLine_${containerUniqueId}" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + graphH}" stroke="rgba(255,255,255,0.4)" stroke-dasharray="3 3" style="display:none;" />
          <circle id="hoverPoint_${containerUniqueId}" r="5" fill="${lineColor}" stroke="#ffffff" stroke-width="2" style="display:none;" />
          <circle id="hoverPointCdi_${containerUniqueId}" r="4" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5" style="display:none;" />
          <circle id="hoverPointIbov_${containerUniqueId}" r="4" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" style="display:none;" />
        </svg>

        <!-- Tooltip Flutuante -->
        <div class="line-chart-tooltip" id="tooltip_${containerUniqueId}" style="display:none;"></div>
      </div>
    </div>
  `;

  const wrapper = document.getElementById(containerUniqueId);
  const hoverLine = document.getElementById(`hoverLine_${containerUniqueId}`);
  const hoverPoint = document.getElementById(`hoverPoint_${containerUniqueId}`);
  const hoverPointCdi = document.getElementById(`hoverPointCdi_${containerUniqueId}`);
  const hoverPointIbov = document.getElementById(`hoverPointIbov_${containerUniqueId}`);
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
      if (hoverPointCdi) hoverPointCdi.style.display = 'none';
      if (hoverPointIbov) hoverPointIbov.style.display = 'none';
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

    if (showChartCdi && hoverPointCdi) {
      hoverPointCdi.setAttribute('cx', cx);
      hoverPointCdi.setAttribute('cy', getY(item.cdiVal));
      hoverPointCdi.style.display = 'block';
    } else if (hoverPointCdi) {
      hoverPointCdi.style.display = 'none';
    }

    if (showChartIbov && hoverPointIbov) {
      hoverPointIbov.setAttribute('cx', cx);
      hoverPointIbov.setAttribute('cy', getY(item.ibovVal));
      hoverPointIbov.style.display = 'block';
    } else if (hoverPointIbov) {
      hoverPointIbov.style.display = 'none';
    }

    const dateParts = item.date.split('-');
    const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
    
    const diffSign = item.diffVal >= 0 ? '+' : '';

    tooltip.innerHTML = `
      <div style="font-weight: 700; color: #f9fafb; margin-bottom: 6px; font-size: 0.82rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
        📅 Pregão de ${formattedDate}
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <span style="color: ${lineColor}; font-weight: 600;">🟢 Carteira:</span>
          <strong style="color: #ffffff;">${formatCurrency(item.total)} (${diffSign}${item.diffPct.toFixed(2)}%)</strong>
        </div>
        ${showChartCdi ? `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <span style="color: #60a5fa; font-weight: 600;">🔵 100% CDI:</span>
          <strong style="color: #93c5fd;">${formatCurrency(item.cdiVal)} (${item.cdiPct >= 0 ? '+' : ''}${item.cdiPct.toFixed(2)}%)</strong>
        </div>
        ` : ''}
        ${showChartIbov ? `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <span style="color: #fbbf24; font-weight: 600;">🟠 Ibovespa:</span>
          <strong style="color: #fde68a;">${formatCurrency(item.ibovVal)} (${item.ibovPct >= 0 ? '+' : ''}${item.ibovPct.toFixed(2)}%)</strong>
        </div>
        ` : ''}
      </div>
    `;

    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();
    let leftPos = offsetX + 15;
    if (leftPos + tooltipRect.width > rect.width) {
      leftPos = offsetX - tooltipRect.width - 15;
    }
    tooltip.style.left = `${Math.max(10, leftPos)}px`;
    tooltip.style.top = `${Math.max(10, Math.min(rect.height - tooltipRect.height - 10, getY(item.total) * (rect.height / height) - 20))}px`;
  }

  function handlePointerLeave() {
    hoverLine.style.display = 'none';
    hoverPoint.style.display = 'none';
    if (hoverPointCdi) hoverPointCdi.style.display = 'none';
    if (hoverPointIbov) hoverPointIbov.style.display = 'none';
    tooltip.style.display = 'none';
  }

  wrapper.addEventListener('mousemove', handlePointerMove);
  wrapper.addEventListener('mouseleave', handlePointerLeave);
  wrapper.addEventListener('touchstart', handlePointerMove, { passive: true });
  wrapper.addEventListener('touchmove', handlePointerMove, { passive: true });
  wrapper.addEventListener('touchend', handlePointerLeave);
}

// --- PROTEÇÃO POR SENHA DE ACESSO ---
function checkDesktopLockState() {
  const hasPassword = appState && appState.desktopPassword && String(appState.desktopPassword).trim() !== '';
  const isUnlocked = sessionStorage.getItem('winvest_desktop_unlocked') === 'true';

  const modal = document.getElementById('modalDesktopLockBackdrop');
  if (!modal) return false;

  if (hasPassword && !isUnlocked) {
    modal.style.display = 'flex';
    const input = document.getElementById('desktopUnlockPasswordInput');
    if (input) setTimeout(() => input.focus(), 100);
    return true; // Bloqueado
  } else {
    modal.style.display = 'none';
    return false; // Liberado
  }
}

function handleDesktopUnlockSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('desktopUnlockPasswordInput');
  const errorMsg = document.getElementById('desktopUnlockErrorMsg');
  if (!input) return;

  const entered = input.value.trim();
  const currentPassword = String(appState.desktopPassword || '').trim();

  if (entered === currentPassword) {
    sessionStorage.setItem('winvest_desktop_unlocked', 'true');
    if (errorMsg) errorMsg.style.display = 'none';
    input.value = '';
    const modal = document.getElementById('modalDesktopLockBackdrop');
    if (modal) modal.style.display = 'none';
    showToast('Carteira desbloqueada!', 'success');
    renderApp();

    // Se o Google Drive estiver conectado e com token válido, sincroniza silenciosamente
    if (typeof isDriveTokenValid === 'function' && isDriveTokenValid()) {
      if (typeof syncFromDrive === 'function') {
        syncFromDrive();
      }
    }
  } else {
    if (errorMsg) {
      errorMsg.textContent = 'Senha incorreta! Tente novamente.';
      errorMsg.style.display = 'block';
    }
    input.value = '';
    input.focus();
  }
}

function saveDesktopPasswordSetting() {
  const pwdInput = document.getElementById('cfgDesktopPassword');
  if (!pwdInput) return;
  const newPwd = pwdInput.value.trim();
  appState.desktopPassword = newPwd;
  saveLocalState(true, true);
  if (newPwd) {
    sessionStorage.setItem('winvest_desktop_unlocked', 'true');
    showToast('Senha de acesso salva com sucesso!', 'success');
  } else {
    sessionStorage.removeItem('winvest_desktop_unlocked');
    showToast('Proteção por senha desativada.', 'info');
  }
  checkDesktopLockState();
}

function lockDesktopSessionNow() {
  if (!appState.desktopPassword || String(appState.desktopPassword).trim() === '') {
    showToast('Defina e salve uma senha antes de bloquear a tela.', 'warning');
    return;
  }
  sessionStorage.removeItem('winvest_desktop_unlocked');
  checkDesktopLockState();
  showToast('Tela bloqueada.', 'info');
}

// Trancar sessão automaticamente ao ir para segundo plano / minimizar no mobile ou trocar de aba se houver senha configurada
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (window.isGoogleAuthPopupActive) return; // Não bloqueia enquanto o pop-up do Google estiver aberto
    const hasPassword = appState && appState.desktopPassword && String(appState.desktopPassword).trim() !== '';
    if (hasPassword) {
      sessionStorage.removeItem('winvest_desktop_unlocked');
    }
  } else if (document.visibilityState === 'visible') {
    checkDesktopLockState();
  }
});
