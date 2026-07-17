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

// --- CONFIGURAÇÃO DE EVENT LISTENERS ---
function setupEventListeners() {
  // Navegação por Abas / Menu Sanduíche
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      const targetTab = e.currentTarget.dataset.tab;
      
      // Ativa o botão selecionado na gaveta
      const matchingBtns = document.querySelectorAll(`.tab-btn[data-tab="${targetTab}"]`);
      matchingBtns.forEach(b => b.classList.add('active'));

      const targetPane = document.getElementById(`tab-${targetTab}`);
      if (targetPane) targetPane.classList.add('active');

      // Atualiza o subtítulo no cabeçalho com o nome da tela ativa
      const screenTitleEl = document.getElementById('currentScreenSubtitle');
      if (screenTitleEl) {
        screenTitleEl.textContent = e.currentTarget.textContent.trim();
      }

      // Fecha o menu gaveta ao selecionar uma opção
      closeNavDrawer();
    });
  });

  // Form de Adição Rápida Inline Renda Fixa
  document.getElementById('formAddRfInline')?.addEventListener('submit', handleAddRfInline);

  // Form de Adição Rápida Inline Ações
  document.getElementById('formAddAcaoInline')?.addEventListener('submit', handleAddAcaoInline);

  // Auto-fill nome da empresa ao digitar Ticker na barra inline de ações
  document.getElementById('newAcaoTicker')?.addEventListener('input', (e) => {
    const ticker = e.target.value.toUpperCase().trim();
    e.target.value = ticker;
    const nomeInput = document.getElementById('newAcaoNome');
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
}

// --- RENDERIZAÇÃO DA ABA EVOLUÇÃO ---
function renderEvolucaoTab(fin) {
  // 1. Resumo por Grupo
  const tbodyGrupos = document.getElementById('tbodyEvolucaoGrupos');
  if (tbodyGrupos) {
    tbodyGrupos.innerHTML = `
      <tr style="font-weight: 700; background: rgba(16, 64, 176, 0.08);">
        <td>🏢 PATRIMÔNIO TOTAL</td>
        <td class="text-right">${formatCurrency(fin.patrimonioTotal)}</td>
        <td class="text-right">${formatDiffVal(fin.diffTotalMesVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffTotalMesPct)}</td>
        <td class="text-right">${formatDiffVal(fin.diffTotalAnoVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffTotalAnoPct)}</td>
      </tr>
      <tr>
        <td>💰 Grupo Renda Fixa</td>
        <td class="text-right">${formatCurrency(fin.totalRendaFixa)}</td>
        <td class="text-right">${formatDiffVal(fin.diffRfMesVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffRfMesPct)}</td>
        <td class="text-right">${formatDiffVal(fin.diffRfAnoVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffRfAnoPct)}</td>
      </tr>
      <tr>
        <td>📈 Grupo Ações</td>
        <td class="text-right">${formatCurrency(fin.totalAcoes)}</td>
        <td class="text-right">${formatDiffVal(fin.diffAcoesMesVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffAcoesMesPct)}</td>
        <td class="text-right">${formatDiffVal(fin.diffAcoesAnoVal)}</td>
        <td class="text-right">${formatDiffPct(fin.diffAcoesAnoPct)}</td>
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
        <tr>
          <td><span class="badge badge-rf">${item.tipo}</span></td>
          <td><strong>${escapeHtml(item.nome)}</strong> <small class="text-muted">(${escapeHtml(item.emissor)})</small></td>
          <td class="text-right"><strong>${formatCurrency(item.valorAtual)}</strong></td>
          <td class="text-right">${formatDiffVal(item.diffMesVal)}</td>
          <td class="text-right">${formatDiffPct(item.diffMesPct)}</td>
          <td class="text-right">${formatDiffVal(item.diffAnoVal)}</td>
          <td class="text-right">${formatDiffPct(item.diffAnoPct)}</td>
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
        <tr>
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
      `).join('');
    }
  }
}

// --- RENDA FIXA (EDIÇÃO INLINE COM HISTÓRICO) ---
function handleAddRfInline(e) {
  e.preventDefault();
  const tipo = document.getElementById('newRfTipo').value;
  const emissor = document.getElementById('newRfEmissor').value.trim();
  const nome = document.getElementById('newRfNome').value.trim();
  const taxa = document.getElementById('newRfTaxa').value.trim();
  const valor = parseFloat(document.getElementById('newRfValor').value);
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
    data: currentDate
  });

  document.getElementById('newRfEmissor').value = '';
  document.getElementById('newRfNome').value = '';
  document.getElementById('newRfTaxa').value = '';
  document.getElementById('newRfValor').value = '';

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

  tbody.innerHTML = fin.rendaFixa.map(item => {
    if (editingRfId === item.id) {
      // MODO EDIÇÃO INLINE NA LINHA DA TABELA (INCLUINDO MÊS/ANO ANTERIOR)
      return `
        <tr class="row-editing">
          <td>
            <select id="editRfTipo_${item.id}" class="table-input-sm">
              <option value="RDB" ${item.tipo === 'RDB' ? 'selected' : ''}>RDB</option>
              <option value="Fundos de Investimento" ${item.tipo === 'Fundos de Investimento' ? 'selected' : ''}>Fundo de Investimento</option>
              <option value="Tesouro Direto" ${item.tipo === 'Tesouro Direto' ? 'selected' : ''}>Tesouro Direto</option>
              <option value="CDB" ${item.tipo === 'CDB' ? 'selected' : ''}>CDB</option>
              <option value="LCI/LCA" ${item.tipo === 'LCI/LCA' ? 'selected' : ''}>LCI / LCA</option>
              <option value="Outro" ${item.tipo === 'Outro' ? 'selected' : ''}>Outro</option>
            </select>
          </td>
          <td><input type="text" id="editRfEmissor_${item.id}" class="table-input-sm" value="${escapeHtml(item.emissor)}" /></td>
          <td><input type="text" id="editRfNome_${item.id}" class="table-input-sm" value="${escapeHtml(item.nome)}" /></td>
          <td><input type="text" id="editRfTaxa_${item.id}" class="table-input-sm" value="${escapeHtml(item.taxa || '')}" /></td>
          <td><input type="number" step="0.01" id="editRfValMes_${item.id}" class="table-input-sm text-right" value="${item.valorMesAnt}" placeholder="Mês Ant." title="Valor Mês Anterior" /></td>
          <td><input type="number" step="0.01" id="editRfValAno_${item.id}" class="table-input-sm text-right" value="${item.valorAnoAnt}" placeholder="Ano Ant." title="Valor Ano Anterior" /></td>
          <td><input type="number" step="0.01" id="editRfValor_${item.id}" class="table-input-sm text-right" value="${item.valorAtual}" title="Valor Atual" /></td>
          <td class="text-right"><span class="text-muted text-small">${new Date().toLocaleDateString('pt-BR')}</span></td>
          <td class="text-center">
            <button class="btn-icon success" onclick="saveRfInline('${item.id}')" title="Salvar Alteração">✅</button>
            <button class="btn-icon danger" onclick="cancelRfInline()" title="Cancelar">✕</button>
          </td>
        </tr>
      `;
    }

    // MODO LEITURA NORMAL
    return `
      <tr>
        <td><span class="badge badge-rf">${item.tipo}</span></td>
        <td><strong>${escapeHtml(item.emissor)}</strong></td>
        <td>${escapeHtml(item.nome)}</td>
        <td>${item.taxa ? `<span class="taxa-tag">${escapeHtml(item.taxa)}</span>` : '<span class="text-muted">-</span>'}</td>
        <td class="text-right text-muted">${formatCurrency(item.valorMesAnt)}</td>
        <td class="text-right text-muted">${formatCurrency(item.valorAnoAnt)}</td>
        <td class="text-right"><strong>${formatCurrency(item.valorAtual)}</strong></td>
        <td class="text-right"><span class="text-muted text-small">${item.data || '-'}</span></td>
        <td class="text-center">
          <button class="btn-icon" onclick="startEditRfInline('${item.id}')" title="Editar Inline">✏️</button>
          <button class="btn-icon danger" onclick="deleteRendaFixa('${item.id}')" title="Excluir">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('totalRfFooter').textContent = formatCurrency(fin.totalRendaFixa);
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

  item.tipo = tipo;
  item.emissor = emissor;
  item.nome = nome;
  item.taxa = taxa;
  item.valorMesAnterior = isNaN(valMes) ? valor : valMes;
  item.valorAnoAnterior = isNaN(valAno) ? valor : valAno;
  item.valor = valor;
  item.data = new Date().toLocaleDateString('pt-BR');

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
function handleAddAcaoInline(e) {
  e.preventDefault();
  const ticker = document.getElementById('newAcaoTicker').value.toUpperCase().trim();
  const nome = document.getElementById('newAcaoNome').value.trim();
  const quantidade = parseFloat(document.getElementById('newAcaoQtd').value);
  const preco = parseFloat(document.getElementById('newAcaoPreco').value);
  const meta = parseFloat(document.getElementById('newAcaoMeta').value) || 0;
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
    data: currentDate
  });

  document.getElementById('newAcaoTicker').value = '';
  document.getElementById('newAcaoNome').value = '';
  document.getElementById('newAcaoQtd').value = '';
  document.getElementById('newAcaoPreco').value = '';
  document.getElementById('newAcaoMeta').value = '';

  appState.isDemo = false;
  saveLocalState();
  renderApp();
  showToast(`Ação ${ticker} adicionada!`, 'success');
}

function renderAcoesTable(fin) {
  const tbody = document.getElementById('tbodyAcoes');
  if (!tbody) return;

  if (fin.acoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-4">Nenhuma ação cadastrada na carteira.</td></tr>`;
    return;
  }

  tbody.innerHTML = fin.acoes.map((item, idx) => {
    if (editingAcaoId === item.id) {
      // MODO EDIÇÃO INLINE NA TABELA DE AÇÕES (COM PREÇOS ANTERIORES)
      return `
        <tr class="row-editing">
          <td><input type="text" id="editAcaoTicker_${item.id}" class="table-input-sm" value="${item.ticker}" style="text-transform: uppercase;" /></td>
          <td><input type="text" id="editAcaoNome_${item.id}" class="table-input-sm" value="${escapeHtml(item.nome)}" /></td>
          <td><input type="number" step="1" id="editAcaoQtd_${item.id}" class="table-input-sm text-right" value="${item.quantidade}" /></td>
          <td><input type="number" step="0.01" id="editAcaoPrecoMes_${item.id}" class="table-input-sm text-right" value="${item.precoMesAnt}" placeholder="Preço Mês" title="Preço Mês Anterior" /></td>
          <td><input type="number" step="0.01" id="editAcaoPrecoAno_${item.id}" class="table-input-sm text-right" value="${item.precoAnoAnt}" placeholder="Preço Ano" title="Preço Ano Anterior" /></td>
          <td><input type="number" step="0.01" id="editAcaoPreco_${item.id}" class="table-input-sm text-right" value="${item.precoAtual}" title="Preço Atual" /></td>
          <td class="text-right"><strong>${formatCurrency(item.valorTotal)}</strong></td>
          <td class="text-right"><span class="pct-pill">${item.percentualAtual.toFixed(1)}%</span></td>
          <td><input type="number" step="0.1" id="editAcaoMeta_${item.id}" class="table-input-sm text-right" value="${item.meta}" /></td>
          <td class="text-right"><span class="text-muted text-small">${new Date().toLocaleDateString('pt-BR')}</span></td>
          <td class="text-center">
            <button class="btn-icon success" onclick="saveAcaoInline('${item.id}')" title="Salvar Alteração">✅</button>
            <button class="btn-icon danger" onclick="cancelAcaoInline()" title="Cancelar">✕</button>
          </td>
        </tr>
      `;
    }

    // MODO LEITURA NORMAL
    return `
      <tr>
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
        <td class="text-center">
          <button class="btn-icon" onclick="startEditAcaoInline('${item.id}')" title="Editar Inline">✏️</button>
          <button class="btn-icon danger" onclick="deleteAcao('${item.id}')" title="Excluir">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('totalAcoesFooter').textContent = formatCurrency(fin.totalAcoes);
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

  item.ticker = ticker;
  item.nome = nome;
  item.quantidade = quantidade;
  item.precoMesAnterior = isNaN(precoMes) ? preco : precoMes;
  item.precoAnoAnterior = isNaN(precoAno) ? preco : precoAno;
  item.preco = preco;
  item.meta = meta;
  item.data = new Date().toLocaleDateString('pt-BR');

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
  downloadAnchor.setAttribute('download', `wingene_investimentos_${new Date().toISOString().slice(0,10)}.json`);
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

// --- REGISTRO DO SERVICE WORKER E PWA INSTALL ---
function setupPwaInstallation() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker WinGene registrado:', reg.scope);
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
