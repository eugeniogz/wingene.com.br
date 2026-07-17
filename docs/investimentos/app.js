/**
 * WinGene Investimentos — Lógica Principal da PWA (Edição Inline)
 * Gerenciamento de Renda Fixa, Ações, Percentuais e Metas com Edição Direta nas Tabelas.
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

  // Registrar retorno do Google Drive
  window.onDriveDataLoaded = (remoteData) => {
    if (remoteData && (Array.isArray(remoteData.rendaFixa) || Array.isArray(remoteData.acoes))) {
      appState = {
        rendaFixa: remoteData.rendaFixa || [],
        acoes: remoteData.acoes || [],
        lastUpdated: remoteData.lastUpdated || new Date().toISOString()
      };
      saveLocalState(false);
      renderApp();
      showToast('Dados sincronizados com o Google Drive!', 'success');
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
    // Dados de demonstração inicial
    appState = {
      rendaFixa: [
        { id: 'rf-1', tipo: 'Tesouro Direto', emissor: 'Tesouro Nacional', nome: 'Tesouro IPCA+ 2035', valor: 15000, taxa: 'IPCA + 6.1%', data: new Date().toLocaleDateString('pt-BR') },
        { id: 'rf-2', tipo: 'RDB', emissor: 'Nubank / Nu Financeira', nome: 'RDB Resgate Imediato', valor: 8500, taxa: '100% CDI', data: new Date().toLocaleDateString('pt-BR') }
      ],
      acoes: [
        { id: 'ac-1', ticker: 'PETR4', nome: 'Petrobras PN', quantidade: 200, preco: 38.50, meta: 30, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-2', ticker: 'VALE3', nome: 'Vale S.A.', quantidade: 100, preco: 62.10, meta: 30, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-3', ticker: 'ITUB4', nome: 'Itaú Unibanco PN', quantidade: 250, preco: 33.20, meta: 20, data: new Date().toLocaleDateString('pt-BR') },
        { id: 'ac-4', ticker: 'WEGE3', nome: 'Weg S.A.', quantidade: 120, preco: 42.00, meta: 20, data: new Date().toLocaleDateString('pt-BR') }
      ],
      lastUpdated: new Date().toISOString()
    };
    saveLocalState(false);
  }
}

function saveLocalState(syncDrive = true) {
  appState.lastUpdated = new Date().toISOString();
  localStorage.setItem('wingene_investimentos_state', JSON.stringify(appState));
  
  if (syncDrive && typeof saveToDrive === 'function') {
    saveToDrive(appState);
  }
}

// --- CONFIGURAÇÃO DE EVENT LISTENERS ---
function setupEventListeners() {
  // Navegação por Abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      const targetTab = e.currentTarget.dataset.tab;
      e.currentTarget.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');
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

  // Exportar / Importar JSON Backup
  document.getElementById('btnExportJson')?.addEventListener('click', exportJsonBackup);
  document.getElementById('btnImportJsonTrigger')?.addEventListener('click', () => document.getElementById('fileImportJson').click());
  document.getElementById('fileImportJson')?.addEventListener('change', importJsonBackup);
}

// --- CÁLCULOS FINANCEIROS E REBALANCEAMENTO ---
function calculateFinancials() {
  const totalRendaFixa = appState.rendaFixa.reduce((acc, item) => acc + (parseFloat(item.valor) || 0), 0);
  
  const acoesComTotais = appState.acoes.map(acao => {
    const qty = parseFloat(acao.quantidade) || 0;
    const price = parseFloat(acao.preco) || 0;
    const valorTotal = qty * price;
    const meta = parseFloat(acao.meta) || 0;
    return { ...acao, valorTotal, meta };
  });

  const totalAcoes = acoesComTotais.reduce((acc, item) => acc + item.valorTotal, 0);
  const patrimonioTotal = totalRendaFixa + totalAcoes;

  // Calcular percentual de cada ação na carteira de Ações e metas
  const acoesComPercentual = acoesComTotais.map(acao => {
    const percentualAtual = totalAcoes > 0 ? (acao.valorTotal / totalAcoes) * 100 : 0;
    const valorAlvoMeta = totalAcoes > 0 ? (totalAcoes * (acao.meta / 100)) : 0;
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
    totalRendaFixa,
    totalAcoes,
    patrimonioTotal,
    pctRendaFixa: patrimonioTotal > 0 ? (totalRendaFixa / patrimonioTotal) * 100 : 0,
    pctAcoes: patrimonioTotal > 0 ? (totalAcoes / patrimonioTotal) * 100 : 0,
    acoes: acoesComPercentual,
    totalMetasPercent
  };
}

// --- RENDERIZAÇÃO GERAL DA INTERFACE ---
function renderApp() {
  const fin = calculateFinancials();

  // 1. Visão Geral / Cards Principais
  document.getElementById('statPatrimonioTotal').textContent = formatCurrency(fin.patrimonioTotal);
  document.getElementById('statRendaFixaTotal').textContent = formatCurrency(fin.totalRendaFixa);
  document.getElementById('statRendaFixaPct').textContent = `${fin.pctRendaFixa.toFixed(1)}%`;
  document.getElementById('statAcoesTotal').textContent = formatCurrency(fin.totalAcoes);
  document.getElementById('statAcoesPct').textContent = `${fin.pctAcoes.toFixed(1)}%`;

  // Data do sistema
  const lastUpdateFormatted = new Date(appState.lastUpdated).toLocaleString('pt-BR');
  document.getElementById('lastUpdatedSpan').textContent = lastUpdateFormatted;

  // Gráficos de Visão Geral (Donut Charts SVG)
  renderDonutChart('chartAssetAllocation', [
    { label: 'Renda Fixa', value: fin.totalRendaFixa, color: '#10b981' },
    { label: 'Ações', value: fin.totalAcoes, color: '#1040b0' }
  ]);

  renderDonutChart('chartStockBreakdown', fin.acoes.map((ac, idx) => ({
    label: ac.ticker,
    value: ac.valorTotal,
    color: getPaletteColor(idx)
  })));

  // 2. Renderizar Tabela de Renda Fixa com Suporte a Edição Inline
  renderRendaFixaTable(fin);

  // 3. Renderizar Tabela de Ações com Suporte a Edição Inline
  renderAcoesTable(fin);

  // 4. Renderizar Rebalanceamento & Metas
  renderRebalanceamentoSection(fin);
}

// --- RENDA FIXA (EDIÇÃO E ADIÇÃO INLINE) ---
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
    data: currentDate
  });

  document.getElementById('newRfEmissor').value = '';
  document.getElementById('newRfNome').value = '';
  document.getElementById('newRfTaxa').value = '';
  document.getElementById('newRfValor').value = '';

  saveLocalState();
  renderApp();
  showToast('Ativo de Renda Fixa adicionado!', 'success');
}

function renderRendaFixaTable(fin) {
  const tbody = document.getElementById('tbodyRendaFixa');
  if (!tbody) return;

  if (appState.rendaFixa.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Nenhum ativo de Renda Fixa cadastrado ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = appState.rendaFixa.map(item => {
    if (editingRfId === item.id) {
      // MODO EDIÇÃO INLINE NA LINHA DA TABELA
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
          <td><input type="number" step="0.01" id="editRfValor_${item.id}" class="table-input-sm text-right" value="${item.valor}" /></td>
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
        <td class="text-right"><strong>${formatCurrency(item.valor)}</strong></td>
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
  const valor = parseFloat(document.getElementById(`editRfValor_${id}`).value);

  if (!emissor || !nome || isNaN(valor)) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  item.tipo = tipo;
  item.emissor = emissor;
  item.nome = nome;
  item.taxa = taxa;
  item.valor = valor;
  item.data = new Date().toLocaleDateString('pt-BR');

  editingRfId = null;
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

// --- CARTEIRA DE AÇÕES (EDIÇÃO E ADIÇÃO INLINE) ---
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
    meta,
    data: currentDate
  });

  document.getElementById('newAcaoTicker').value = '';
  document.getElementById('newAcaoNome').value = '';
  document.getElementById('newAcaoQtd').value = '';
  document.getElementById('newAcaoPreco').value = '';
  document.getElementById('newAcaoMeta').value = '';

  saveLocalState();
  renderApp();
  showToast(`Ação ${ticker} adicionada!`, 'success');
}

function renderAcoesTable(fin) {
  const tbody = document.getElementById('tbodyAcoes');
  if (!tbody) return;

  if (fin.acoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Nenhuma ação cadastrada na carteira.</td></tr>`;
    return;
  }

  tbody.innerHTML = fin.acoes.map((item, idx) => {
    if (editingAcaoId === item.id) {
      // MODO EDIÇÃO INLINE NA TABELA DE AÇÕES
      return `
        <tr class="row-editing">
          <td><input type="text" id="editAcaoTicker_${item.id}" class="table-input-sm" value="${item.ticker}" style="text-transform: uppercase;" /></td>
          <td><input type="text" id="editAcaoNome_${item.id}" class="table-input-sm" value="${escapeHtml(item.nome)}" /></td>
          <td><input type="number" step="1" id="editAcaoQtd_${item.id}" class="table-input-sm text-right" value="${item.quantidade}" /></td>
          <td><input type="number" step="0.01" id="editAcaoPreco_${item.id}" class="table-input-sm text-right" value="${item.preco}" /></td>
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
        <td class="text-right">${formatCurrency(item.preco)}</td>
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
  const preco = parseFloat(document.getElementById(`editAcaoPreco_${id}`).value);
  const meta = parseFloat(document.getElementById(`editAcaoMeta_${id}`).value) || 0;

  if (!ticker || !nome || isNaN(quantidade) || isNaN(preco)) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }

  item.ticker = ticker;
  item.nome = nome;
  item.quantidade = quantidade;
  item.preco = preco;
  item.meta = meta;
  item.data = new Date().toLocaleDateString('pt-BR');

  editingAcaoId = null;
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
