/**
 * ==========================================================================
 * WINVEST — INVEST UI (Dashboard de Saúde do Ativo, Telas, Menus e Rebalanceamento)
 * ==========================================================================
 * 1. Dashboard Completo de Saúde do Ativo (4 dimensões: Qualidade, Valuation, Tese, Prioridade).
 * 2. Menu gaveta com lista de ativos para navegação direta.
 * 3. Tabela de Rebalanceamento Inteligente ordenada por Prioridade de Aporte.
 * 4. Alertas informativos transparentes.
 * 5. Registro e visualização de Snapshots Históricos.
 * 6. Modais para edição de Fundamentos, Tese e Premissas de Valuation.
 */

let currentAssetHealthId = null;

/**
 * Inicializa a navegação e eventos de Apoio à Decisão
 */
function initInvestDecisionUI() {
  renderAssetNavDrawerSubmenu();
}

/**
 * Renderiza os links de cada ativo no Menu Gaveta (Menu Sanduíche)
 */
function renderAssetNavDrawerSubmenu() {
  const container = document.getElementById('navDrawerAssetsContainer');
  if (!container) return;

  if (!appState || !Array.isArray(appState.acoes) || appState.acoes.length === 0) {
    container.innerHTML = `<div class="text-muted text-small px-3 py-2">Nenhum ativo cadastrado.</div>`;
    return;
  }

  container.innerHTML = appState.acoes.map((ac, idx) => {
    const qRes = typeof calculateQualityScore === 'function' ? calculateQualityScore(ac) : null;
    const scoreText = (qRes && qRes.score !== null) ? `${qRes.score} pts` : 'N/D';
    const color = getPaletteColor(idx);

    return `
      <button type="button" class="nav-drawer-item" onclick="openAssetHealthDashboard('${ac.id}')" style="border-left: 3px solid ${color}; padding-left: 12px;">
        <span class="nav-item-icon" style="font-weight: 800; font-size: 0.8rem; color: ${color}; min-width: 48px;">
          ${ac.ticker}
        </span>
        <span class="nav-item-text" style="font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(ac.nome || ac.ticker)}
        </span>
        <span class="badge" style="background: rgba(255,255,255,0.06); font-size: 0.7rem; margin-left: auto;">
          ${scoreText}
        </span>
      </button>
    `;
  }).join('');
}

/**
 * Abre o Dashboard de Saúde do Ativo por ID ou Ticker
 */
function openAssetHealthDashboard(assetId) {
  if (!appState || !Array.isArray(appState.acoes)) return;

  const asset = appState.acoes.find(a => String(a.id) === String(assetId) || a.ticker === String(assetId).toUpperCase());
  if (!asset) {
    showToast('Ativo não encontrado.', 'error');
    return;
  }

  currentAssetHealthId = asset.id;

  // Renderizar o conteúdo do Dashboard
  renderAssetHealthDashboard(asset);

  // Mudar para a tela de saúde do ativo
  switchTab('asset-detail');
}

/**
 * Renderiza o Dashboard Completo da Ação
 */
function renderAssetHealthDashboard(asset) {
  const container = document.getElementById('assetDetailContent');
  if (!container) return;

  const fin = (typeof calculateFinancials === 'function') ? calculateFinancials() : null;
  const finItem = fin ? fin.acoes.find(a => a.id === asset.id || a.ticker === asset.ticker) : null;

  const price = parseFloat((finItem && finItem.precoAtual) || asset.precoAtual || asset.preco) || 0;
  const qty = parseFloat(asset.quantidade) || 0;
  const totalVal = qty * price;
  const pctAtual = finItem ? finItem.percentualAtual : 0;
  const meta = parseFloat(asset.meta) || 0;
  const gap = parseFloat((meta - pctAtual).toFixed(1));

  // 1. Cálculos dos Scores
  const qRes = calculateQualityScore(asset);
  const vRes = calculateValuationScore(asset, price);
  const tRes = evaluateAssetThesis(asset);
  const invRes = calculateInvestmentScore(qRes.score, vRes.score, tRes.thesisScore);
  const prioRes = calculateAllocationPriority(asset, finItem || { precoAtual: price, meta, percentualAtual: pctAtual });

  // Opções para o Seletor Rápido de Ativos no Topo
  const assetOptions = appState.acoes.map(a => `
    <option value="${a.id}" ${a.id === asset.id ? 'selected' : ''}>
      ${a.ticker} — ${escapeHtml(a.nome || '')}
    </option>
  `).join('');

  // 2. Montar HTML Completo do Dashboard
  container.innerHTML = `
    <!-- CABEÇALHO DO ATIVO -->
    <div class="card mb-3" style="border-top: 4px solid var(--primary-blue);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <h1 style="margin: 0; font-size: 1.8rem; font-weight: 800; letter-spacing: -0.02em;">
              ${asset.ticker}
            </h1>
            <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3);">
              ${asset.tipo || 'STOCK'}
            </span>
            ${asset.setor ? `
              <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: #cbd5e1; border: 1px solid var(--border-light);">
                🏭 ${escapeHtml(asset.setor)}
              </span>
            ` : ''}
          </div>
          <div style="font-size: 1rem; color: #cbd5e1; margin-top: 2px;">
            ${escapeHtml(asset.nome || '')}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <select class="form-control form-control-sm" style="width: auto; min-width: 180px;" onchange="openAssetHealthDashboard(this.value)">
            ${assetOptions}
          </select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('acoes')">
            ⬅️ Carteira
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="openEditAssetHealthModal('${asset.id}')">
            ✏️ Editar Análise & Fundamentos
          </button>
        </div>
      </div>

      <!-- BARRA DE POSIÇÃO E METAS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light);">
        <div>
          <span class="text-muted text-small">Preço Atual</span>
          <div style="font-size: 1.25rem; font-weight: 700; color: #ffffff;">${formatCurrency(price)}</div>
        </div>
        <div>
          <span class="text-muted text-small">Posição em Carteira</span>
          <div style="font-size: 1.25rem; font-weight: 700; color: #10b981;">
            ${formatCurrency(totalVal)} <small class="text-muted" style="font-size: 0.75rem;">(${qty} ações)</small>
          </div>
        </div>
        <div>
          <span class="text-muted text-small">% Atual vs. Meta</span>
          <div style="font-size: 1.25rem; font-weight: 700; color: #60a5fa;">
            ${pctAtual.toFixed(1)}% <span class="text-muted" style="font-size: 0.85rem;">/ ${meta.toFixed(1)}%</span>
          </div>
        </div>
        <div>
          <span class="text-muted text-small">Diferença da Meta</span>
          <div style="font-size: 1.25rem; font-weight: 700; color: ${gap >= 0 ? '#10b981' : '#f59e0b'};">
            ${gap >= 0 ? `+${gap.toFixed(1)} p.p. (Abaixo)` : `${gap.toFixed(1)} p.p. (Acima)`}
          </div>
        </div>
        <div>
          <span class="text-muted text-small">Prioridade de Aporte</span>
          <div>
            <span class="badge ${prioRes.priorityBadge}" style="font-size: 0.85rem; padding: 4px 10px; margin-top: 4px;">
              ${prioRes.priorityLevel}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- OS 4 CARDS DE SCORES (AS 4 DIMENSÕES) -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 20px;">
      <!-- DIMENSÃO 1: QUALIDADE -->
      <div class="card" style="border-top: 3px solid #10b981; background: linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, rgba(24, 24, 31, 0.95) 100%);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="text-muted text-small" style="text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">1. QUALIDADE</span>
            <div style="font-size: 2rem; font-weight: 800; color: ${qRes.score !== null ? '#10b981' : '#94a3b8'}; margin: 4px 0;">
              ${qRes.score !== null ? qRes.label : 'N/D'}
            </div>
          </div>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);">
            Confiança: ${qRes.confidence}%
          </span>
        </div>
        <div class="progress-container mt-1" style="height: 6px;">
          <div class="progress-bar" style="width: ${qRes.score || 0}%; background: #10b981;"></div>
        </div>
        <div class="text-muted text-small mt-2" style="font-size: 0.75rem;">
          ${qRes.missingComponents.length === 0 ? 'Todos os 7 fatores informados' : `Faltando: ${qRes.missingComponents.join(', ')}`}
        </div>
      </div>

      <!-- DIMENSÃO 2: VALUATION -->
      <div class="card" style="border-top: 3px solid #3b82f6; background: linear-gradient(180deg, rgba(59, 130, 246, 0.06) 0%, rgba(24, 24, 31, 0.95) 100%);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="text-muted text-small" style="text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">2. VALUATION</span>
            <div style="font-size: 2rem; font-weight: 800; color: ${vRes.score !== null ? '#60a5fa' : '#94a3b8'}; margin: 4px 0;">
              ${vRes.score !== null ? vRes.label : 'N/D'}
            </div>
          </div>
          <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3);">
            Confiança: ${vRes.confidence}%
          </span>
        </div>
        <div class="progress-container mt-1" style="height: 6px;">
          <div class="progress-bar" style="width: ${vRes.score || 0}%; background: #3b82f6;"></div>
        </div>
        <div class="text-muted text-small mt-2" style="font-size: 0.75rem;">
          ${vRes.dcf && vRes.dcf.marginOfSafety !== null ? `Margem de Seg.: ${vRes.dcf.marginOfSafety > 0 ? '+' : ''}${vRes.dcf.marginOfSafety}%` : 'DCF não parametrizado'}
        </div>
      </div>

      <!-- DIMENSÃO 3: TESE -->
      <div class="card" style="border-top: 3px solid #f59e0b; background: linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, rgba(24, 24, 31, 0.95) 100%);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="text-muted text-small" style="text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">3. TESE DE INVESTIMENTO</span>
            <div style="font-size: 2rem; font-weight: 800; color: ${tRes.thesisScore !== null ? '#fbbf24' : '#94a3b8'}; margin: 4px 0;">
              ${tRes.thesisScore !== null ? `${tRes.thesisScore}/100` : 'N/D'}
            </div>
          </div>
          <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.3);">
            Avaliação Manual
          </span>
        </div>
        <div class="progress-container mt-1" style="height: 6px;">
          <div class="progress-bar" style="width: ${tRes.thesisScore || 0}%; background: #f59e0b;"></div>
        </div>
        <div class="text-muted text-small mt-2" style="font-size: 0.75rem;">
          Hipóteses: 🟢 ${tRes.counts.confirmed} | 🟡 ${tRes.counts.warning} | 🔴 ${tRes.counts.threatened}
        </div>
      </div>

      <!-- DIMENSÃO 4: INVESTMENT SCORE FINAL -->
      <div class="card" style="border-top: 3px solid #a855f7; background: linear-gradient(180deg, rgba(168, 85, 247, 0.08) 0%, rgba(24, 24, 31, 0.95) 100%);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="text-muted text-small" style="text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">INVESTMENT SCORE</span>
            <div style="font-size: 2rem; font-weight: 800; color: ${invRes.color}; margin: 4px 0;">
              ${invRes.score !== null ? invRes.label : 'N/D'}
            </div>
          </div>
          <span class="badge ${invRes.badgeClass}" style="font-size: 0.75rem;">
            ${invRes.classification}
          </span>
        </div>
        <div class="progress-container mt-1" style="height: 6px;">
          <div class="progress-bar" style="width: ${invRes.score || 0}%; background: #a855f7;"></div>
        </div>
        <div class="text-muted text-small mt-2" style="font-size: 0.75rem;">
          Apoio à decisão (não constitui recomendação automática)
        </div>
      </div>
    </div>

    <!-- SEÇÃO 1: DETALHAMENTO DE QUALIDADE & FUNDAMENTOS -->
    <div class="card mb-3">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;" class="mb-3">
        <div>
          <h2 class="card-title mb-1" style="display: flex; align-items: center; gap: 8px;">
            <span>💎</span> Detalhamento do Score de Qualidade (Fatores & Notas)
          </h2>
          <p class="text-muted text-small mb-0">
            Período de referência dos dados: <strong>${asset.fundamentals && asset.fundamentals.fundamentalsUpdatedAt ? asset.fundamentals.fundamentalsUpdatedAt : 'Não informado'}</strong>
          </p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
        ${renderQualityComponentsGrid(qRes)}
      </div>
    </div>

    <!-- SEÇÃO 2: VALUATION & CENÁRIOS DCF -->
    <div class="card mb-3">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;" class="mb-3">
        <div>
          <h2 class="card-title mb-1" style="display: flex; align-items: center; gap: 8px;">
            <span>⚖️</span> Valuation: Fluxo de Caixa Descontado (DCF) & Cenários
          </h2>
          <p class="text-muted text-small mb-0">
            Todas as premissas são transparentes e editáveis. Estimativa baseada nas premissas informadas.
          </p>
        </div>
        <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fde68a; border: 1px solid rgba(245, 158, 11, 0.3);">
          ⚠️ Premissas transparentes
        </span>
      </div>

      ${renderDcfScenariosCards(vRes.dcf, price)}

      <div class="mt-4">
        <h3 style="font-size: 1rem; font-weight: 700; color: #cbd5e1; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <span>📊</span> Múltiplos Comparáveis & Referências
        </h3>
        ${renderMultiplesTable(vRes.multiples)}
      </div>
    </div>

    <!-- SEÇÃO 3: TESE DE INVESTIMENTO & HIPÓTESES VERIFICÁVEIS -->
    <div class="card mb-3">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;" class="mb-3">
        <div>
          <h2 class="card-title mb-1" style="display: flex; align-items: center; gap: 8px;">
            <span>📜</span> Tese de Investimento & Hipóteses Verificáveis
          </h2>
          <p class="text-muted text-small mb-0">
            Acompanhamento contínuo das premissas que justificam manter a posição na carteira.
          </p>
        </div>
        <span class="text-muted text-small">
          Última revisão da tese: <strong>${tRes.lastReviewDate}</strong>
        </span>
      </div>

      <!-- Resumo da Tese -->
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
        <strong style="color: #60a5fa; font-size: 0.9rem;">Resumo da Tese:</strong>
        <p style="margin: 6px 0 0 0; color: #e2e8f0; font-size: 0.9rem; line-height: 1.5;">
          ${escapeHtml(tRes.summary)}
        </p>
      </div>

      <!-- Hipóteses Verificáveis com Semáforos -->
      <h3 style="font-size: 0.95rem; font-weight: 700; color: #cbd5e1; margin-bottom: 10px;">
        Hipóteses Verificáveis (Semáforo Dinâmico):
      </h3>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        ${renderThesisChecksList(tRes.checks)}
      </div>

      <!-- Riscos e Invalidação -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
        <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 12px;">
          <strong style="color: #ef4444; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span> Principais Riscos
          </strong>
          <ul style="margin: 8px 0 0 18px; color: #fca5a5; font-size: 0.82rem; line-height: 1.4;">
            ${tRes.risks.length > 0 ? tRes.risks.map(r => `<li>${escapeHtml(r)}</li>`).join('') : '<li class="text-muted">Nenhum risco registrado.</li>'}
          </ul>
        </div>

        <div style="background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 12px;">
          <strong style="color: #f59e0b; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
            <span>🚫</span> O que Invalidaria a Tese
          </strong>
          <ul style="margin: 8px 0 0 18px; color: #fde68a; font-size: 0.82rem; line-height: 1.4;">
            ${tRes.invalidationFactors.length > 0 ? tRes.invalidationFactors.map(f => `<li>${escapeHtml(f)}</li>`).join('') : '<li class="text-muted">Nenhum fator de invalidação registrado.</li>'}
          </ul>
        </div>
      </div>
    </div>

    <!-- SEÇÃO 4: HISTÓRICO DE SNAPSHOTS -->
    <div class="card">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;" class="mb-3">
        <div>
          <h2 class="card-title mb-1" style="display: flex; align-items: center; gap: 8px;">
            <span>📸</span> Histórico de Snapshots & Evolução de Qualidade
          </h2>
          <p class="text-muted text-small mb-0">
            Acompanhe se a qualidade e atratividade do ativo estão melhorando ou piorando ao longo do tempo.
          </p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="saveAssetAnalysisSnapshot('${asset.id}')">
          📸 Gravar Snapshot Atual
        </button>
      </div>

      ${renderSnapshotsHistoryTable(asset.analysisSnapshots)}
    </div>
  `;
}

/**
 * Renderiza os cards dos 7 fatores de qualidade
 */
function renderQualityComponentsGrid(qRes) {
  if (!qRes || !qRes.components) {
    return `<div class="text-muted">Sem dados de qualidade.</div>`;
  }

  const entries = Object.entries(qRes.components);
  return entries.map(([key, comp]) => {
    const scoreVal = comp.score !== null ? comp.score.toFixed(1) : 'N/D';
    const hasData = comp.available;

    let detailStr = '';
    if (comp.details) {
      detailStr = Object.entries(comp.details)
        .map(([k, v]) => `<span style="display: inline-block; margin-right: 8px;">${k}: <strong>${v}</strong></span>`)
        .join('');
    }

    return `
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-light); border-left: 3px solid ${hasData ? '#10b981' : '#64748b'}; border-radius: 8px; padding: 12px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem; font-weight: 600; color: #ffffff;">${comp.label}</span>
          <span class="badge" style="background: ${hasData ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)'}; color: ${hasData ? '#34d399' : '#94a3b8'}; font-weight: 700;">
            ${scoreVal} / 10
          </span>
        </div>
        <div class="text-muted text-small mt-1" style="font-size: 0.72rem;">
          Peso: ${(comp.weight * 100).toFixed(0)}% ${comp.isManual ? '• (Manual)' : '• (Automático)'}
        </div>
        <div class="mt-2" style="font-size: 0.78rem; color: #94a3b8;">
          ${detailStr || 'Sem detalhes'}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderiza os cards de cenários DCF
 */
function renderDcfScenariosCards(dcf, currentPrice) {
  if (!dcf || !dcf.isAvailable) {
    return `
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px dashed var(--border-light); border-radius: 8px; padding: 20px; text-align: center;" class="text-muted text-small">
        Para calcular os 3 cenários de DCF, informe o Fluxo de Caixa Livre (FCF) e a quantidade de ações no botão "Editar Análise & Fundamentos".
      </div>
    `;
  }

  const s = dcf.scenarios;
  const p = currentPrice || 0;
  const mos = dcf.marginOfSafety;

  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
      <!-- CENÁRIO CONSERVADOR -->
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; text-align: center;">
        <span class="text-muted text-small" style="font-weight: 700; text-transform: uppercase;">🛡️ Conservador</span>
        <div style="font-size: 1.5rem; font-weight: 800; color: #93c5fd; margin: 6px 0;">
          ${s.conservative.isValid ? formatCurrency(s.conservative.intrinsicValue) : 'N/D'}
        </div>
        <div class="text-muted" style="font-size: 0.75rem;">
          Cresc: ${s.conservative.growthRate}% | Desc: ${s.conservative.discountRate}% | Perp: ${s.conservative.terminalGrowth}%
        </div>
      </div>

      <!-- CENÁRIO BASE -->
      <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 8px; padding: 14px; text-align: center;">
        <span style="font-weight: 800; text-transform: uppercase; color: #60a5fa; font-size: 0.8rem;">🎯 Base (Referência)</span>
        <div style="font-size: 1.6rem; font-weight: 800; color: #ffffff; margin: 6px 0;">
          ${s.base.isValid ? formatCurrency(s.base.intrinsicValue) : 'N/D'}
        </div>
        <div class="text-muted" style="font-size: 0.75rem;">
          Cresc: ${s.base.growthRate}% | Desc: ${s.base.discountRate}% | Perp: ${s.base.terminalGrowth}%
        </div>
      </div>

      <!-- CENÁRIO OTIMISTA -->
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; text-align: center;">
        <span class="text-muted text-small" style="font-weight: 700; text-transform: uppercase;">🚀 Otimista</span>
        <div style="font-size: 1.5rem; font-weight: 800; color: #34d399; margin: 6px 0;">
          ${s.optimistic.isValid ? formatCurrency(s.optimistic.intrinsicValue) : 'N/D'}
        </div>
        <div class="text-muted" style="font-size: 0.75rem;">
          Cresc: ${s.optimistic.growthRate}% | Desc: ${s.optimistic.discountRate}% | Perp: ${s.optimistic.terminalGrowth}%
        </div>
      </div>

      <!-- COMPARAÇÃO COM PREÇO ATUAL -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; text-align: center;">
        <span class="text-muted text-small" style="font-weight: 700; text-transform: uppercase;">Preço Atual vs. Base</span>
        <div style="font-size: 1.4rem; font-weight: 800; color: ${mos >= 0 ? '#10b981' : '#ef4444'}; margin: 6px 0;">
          ${mos !== null ? `${mos > 0 ? '+' : ''}${mos}%` : 'N/D'}
        </div>
        <div class="text-muted" style="font-size: 0.75rem;">
          ${mos >= 0 ? 'Com margem de segurança' : 'Acima da estimativa base'}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza a tabela de múltiplos comparáveis
 */
function renderMultiplesTable(multiples) {
  if (!multiples) return '<div class="text-muted text-small">Sem dados de múltiplos.</div>';

  const rows = [
    { name: 'P/L (Preço / Lucro)', data: multiples.pe },
    { name: 'EV / EBITDA', data: multiples.evEbitda },
    { name: 'P / FCF (Preço / Fluxo de Caixa)', data: multiples.pFcf },
    { name: 'P / VP (Preço / Valor Patrimonial)', data: multiples.pvp }
  ];

  return `
    <div class="table-responsive">
      <table class="data-table" style="font-size: 0.85rem;">
        <thead>
          <tr>
            <th>Múltiplo</th>
            <th class="text-right">Atual</th>
            <th class="text-right">Referência / Média</th>
            <th class="text-right">Desconto / Prêmio Relativo</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const d = r.data || {};
            const curStr = d.current !== null && d.current !== undefined ? parseFloat(d.current).toFixed(1) + 'x' : 'N/D';
            const refStr = d.reference !== null && d.reference !== undefined ? parseFloat(d.reference).toFixed(1) + 'x' : 'N/D';
            const discStr = d.discountPct !== null && d.discountPct !== undefined ? `${d.discountPct > 0 ? '+' : ''}${d.discountPct}%` : 'N/D';
            
            let badge = `<span class="badge" style="background: rgba(148,163,184,0.15); color: #94a3b8;">N/D</span>`;
            if (d.status === 'DISCOUNT') badge = `<span class="badge badge-success">Com Desconto</span>`;
            else if (d.status === 'PREMIUM') badge = `<span class="badge badge-warning">Com Prêmio</span>`;
            else if (d.status === 'FAIR') badge = `<span class="badge badge-info">Alinhado</span>`;

            return `
              <tr>
                <td><strong>${r.name}</strong></td>
                <td class="text-right">${curStr}</td>
                <td class="text-right text-muted">${refStr}</td>
                <td class="text-right" style="color: ${d.discountPct > 0 ? '#10b981' : (d.discountPct < 0 ? '#ef4444' : '#ffffff')};">
                  <strong>${discStr}</strong>
                </td>
                <td class="text-center">${badge}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Renderiza a lista de hipóteses da tese
 */
function renderThesisChecksList(checks) {
  if (!checks || checks.length === 0) {
    return `<div class="text-muted text-small py-2">Nenhuma hipótese verificável cadastrada. Cadastre hipóteses como "ROIC >= 20%" para monitoramento contínuo.</div>`;
  }

  return checks.map(c => `
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-light); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.2rem;">${c.icon}</span>
        <div>
          <strong style="color: #ffffff; font-size: 0.88rem;">${escapeHtml(c.description || `${c.metricName} ${c.operator} ${c.thresholdFormatted}`)}</strong>
          <div class="text-muted" style="font-size: 0.75rem;">${c.detail}</div>
        </div>
      </div>
      <span class="badge ${c.badgeClass}">
        ${c.label}
      </span>
    </div>
  `).join('');
}

/**
 * Renderiza o histórico de snapshots
 */
function renderSnapshotsHistoryTable(snapshots) {
  if (!snapshots || snapshots.length === 0) {
    return `<div class="text-muted text-small py-3 text-center">Nenhum snapshot gravado ainda. Clique em "Gravar Snapshot Atual" para iniciar a série histórica da qualidade da empresa.</div>`;
  }

  return `
    <div class="table-responsive">
      <table class="data-table" style="font-size: 0.82rem;">
        <thead>
          <tr>
            <th>Data</th>
            <th class="text-right">Preço</th>
            <th class="text-right">Quality Score</th>
            <th class="text-right">Valuation Score</th>
            <th class="text-right">Investment Score</th>
            <th class="text-right">ROIC</th>
            <th class="text-right">ROE</th>
            <th class="text-right">FCF</th>
          </tr>
        </thead>
        <tbody>
          ${snapshots.slice().reverse().map(s => `
            <tr>
              <td><strong>${s.date}</strong></td>
              <td class="text-right">${formatCurrency(s.price)}</td>
              <td class="text-right"><strong class="text-success">${s.qualityScore !== null ? s.qualityScore : 'N/D'}</strong></td>
              <td class="text-right" style="color: #60a5fa;">${s.valuationScore !== null ? s.valuationScore : 'N/D'}</td>
              <td class="text-right"><strong style="color: #a855f7;">${s.investmentScore !== null ? s.investmentScore : 'N/D'}</strong></td>
              <td class="text-right">${s.roic !== null && s.roic !== undefined ? s.roic + '%' : 'N/D'}</td>
              <td class="text-right">${s.roe !== null && s.roe !== undefined ? s.roe + '%' : 'N/D'}</td>
              <td class="text-right">${s.fcf ? formatCurrencyCompact(s.fcf) : 'N/D'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Grava um snapshot atual do ativo
 */
function saveAssetAnalysisSnapshot(assetId) {
  const asset = appState.acoes.find(a => String(a.id) === String(assetId));
  if (!asset) return;

  const fin = calculateFinancials();
  const finItem = fin ? fin.acoes.find(a => a.id === asset.id || a.ticker === asset.ticker) : null;
  const price = parseFloat((finItem && finItem.precoAtual) || asset.precoAtual || asset.preco) || 0;

  const qRes = calculateQualityScore(asset);
  const vRes = calculateValuationScore(asset, price);
  const tRes = evaluateAssetThesis(asset);
  const invRes = calculateInvestmentScore(qRes.score, vRes.score, tRes.thesisScore);

  const f = asset.fundamentals || {};
  const today = new Date().toLocaleDateString('pt-BR');

  if (!Array.isArray(asset.analysisSnapshots)) {
    asset.analysisSnapshots = [];
  }

  asset.analysisSnapshots.push({
    date: today,
    price,
    qualityScore: qRes.score,
    valuationScore: vRes.score,
    thesisScore: tRes.thesisScore,
    investmentScore: invRes.score,
    roic: f.roic || null,
    roe: f.roe || null,
    fcf: f.freeCashFlow || null,
    growth: f.revenueGrowth || null,
    netDebtEbitda: f.netDebtEbitda || null
  });

  saveLocalState(true, true);
  renderAssetHealthDashboard(asset);
  showToast(`Snapshot gravado com sucesso para ${asset.ticker}!`, 'success');
}

/**
 * Renderiza a nova Tabela de Rebalanceamento Inteligente (Apoio à Decisão)
 */
function renderSmartRebalancingDecision(fin) {
  const container = document.getElementById('rebalanceamentoDecisionContainer');
  if (!container) return;

  const list = buildRebalancingDecisionList(fin);
  const alerts = generateInvestmentAlerts(fin);

  // Alertas Informativos
  let alertsHtml = '';
  if (alerts.length > 0) {
    alertsHtml = `
      <div class="mb-4">
        <h3 style="font-size: 0.95rem; font-weight: 700; color: #cbd5e1; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          <span>🔔</span> Alertas Informativos do Sistema (${alerts.length})
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
          ${alerts.map(al => `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-light); border-left: 3px solid ${al.type === 'danger' ? '#ef4444' : (al.type === 'warning' ? '#f59e0b' : '#3b82f6')}; border-radius: 8px; padding: 10px 14px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.85rem; color: #ffffff;">
                <span>${al.icon}</span> ${al.title}
              </div>
              <div class="text-muted mt-1" style="font-size: 0.78rem; line-height: 1.4;">
                ${al.description}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Tabela Ordenada por Prioridade de Aporte
  let tableHtml = `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr class="col-desktop-row">
            <th>Ativo</th>
            <th class="text-right">Valor Atual</th>
            <th class="text-right">% Atual</th>
            <th class="text-right">% Meta</th>
            <th class="text-right">Diferença</th>
            <th class="text-center">Quality</th>
            <th class="text-center">Valuation</th>
            <th class="text-center">Investment Score</th>
            <th class="text-center">Prioridade de Aporte</th>
            <th class="text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(item => {
            const d = item.decision;
            const q = d.qualityScore;
            const v = d.valuationScore;
            const inv = d.investmentScore;
            const gap = d.allocationGap;

            return `
              <tr class="col-desktop-row clickable-row" onclick="openEditAcaoModal('${item.id}')" title="Clique para editar dados de ${item.ticker}">
                <td>
                  <strong>${item.ticker}</strong>
                  <div class="text-muted text-small">${escapeHtml(item.nome || '')}</div>
                </td>
                <td class="text-right">${formatCurrency(item.valorTotal)}</td>
                <td class="text-right"><span class="pct-pill">${item.percentualAtual.toFixed(1)}%</span></td>
                <td class="text-right"><span class="meta-pill">${item.meta.toFixed(1)}%</span></td>
                <td class="text-right" style="color: ${gap > 0 ? '#10b981' : (gap < 0 ? '#f59e0b' : '#ffffff')};">
                  <strong>${gap > 0 ? `-${gap.toFixed(1)} p.p.` : (gap < 0 ? `+${Math.abs(gap).toFixed(1)} p.p.` : '0.0 p.p.')}</strong>
                </td>
                <td class="text-center">
                  <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
                    ${q.score !== null ? q.score : 'N/D'}
                  </span>
                </td>
                <td class="text-center">
                  <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd;">
                    ${v.score !== null ? v.score : 'N/D'}
                  </span>
                </td>
                <td class="text-center">
                  <span class="badge ${inv.badgeClass}">
                    ${inv.score !== null ? inv.score : 'N/D'}
                  </span>
                </td>
                <td class="text-center">
                  <span class="badge ${d.priorityBadge}" style="font-weight: 800;">
                    ${d.priorityLevel}
                  </span>
                </td>
                <td class="text-center" onclick="event.stopPropagation()">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="openAssetHealthDashboard('${item.id}')">
                    🩺 Saúde
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = alertsHtml + tableHtml;
}

/**
 * Abre o Modal de Edição de Fundamentos, Tese e Premissas de Valuation
 */
function openEditAssetHealthModal(assetId) {
  const asset = appState.acoes.find(a => String(a.id) === String(assetId));
  if (!asset) return;

  currentAssetHealthId = asset.id;

  const f = asset.fundamentals || {};
  const q = asset.qualitative || {};
  const t = asset.thesis || {};
  const v = (asset.valuation && asset.valuation.dcf) || {};
  const scen = v.scenarios || {};

  // Preencher campos de identificação
  document.getElementById('editHealthAssetId').value = asset.id;
  document.getElementById('editHealthModalTitle').textContent = `Editar Análise de ${asset.ticker} (${asset.nome || ''})`;
  document.getElementById('editHealthTipo').value = asset.tipo || 'STOCK';
  document.getElementById('editHealthSetor').value = asset.setor || '';
  document.getElementById('editHealthUpdatedAt').value = f.fundamentalsUpdatedAt || '';

  // Fundamentos
  document.getElementById('editHealthRoic').value = f.roic !== null && f.roic !== undefined ? f.roic : '';
  document.getElementById('editHealthRoe').value = f.roe !== null && f.roe !== undefined ? f.roe : '';
  document.getElementById('editHealthRevenue').value = f.revenue !== null && f.revenue !== undefined ? f.revenue : '';
  document.getElementById('editHealthRevenueGrowth').value = f.revenueGrowth !== null && f.revenueGrowth !== undefined ? f.revenueGrowth : '';
  document.getElementById('editHealthNetIncome').value = f.netIncome !== null && f.netIncome !== undefined ? f.netIncome : '';
  document.getElementById('editHealthNetIncomeGrowth').value = f.netIncomeGrowth !== null && f.netIncomeGrowth !== undefined ? f.netIncomeGrowth : '';
  document.getElementById('editHealthFcf').value = f.freeCashFlow !== null && f.freeCashFlow !== undefined ? f.freeCashFlow : '';
  document.getElementById('editHealthFcfGrowth').value = f.freeCashFlowGrowth !== null && f.freeCashFlowGrowth !== undefined ? f.freeCashFlowGrowth : '';
  document.getElementById('editHealthEbitdaMargin').value = f.ebitdaMargin !== null && f.ebitdaMargin !== undefined ? f.ebitdaMargin : '';
  document.getElementById('editHealthNetMargin').value = f.netMargin !== null && f.netMargin !== undefined ? f.netMargin : '';
  document.getElementById('editHealthNetDebt').value = f.netDebt !== null && f.netDebt !== undefined ? f.netDebt : '';
  document.getElementById('editHealthNetDebtEbitda').value = f.netDebtEbitda !== null && f.netDebtEbitda !== undefined ? f.netDebtEbitda : '';
  document.getElementById('editHealthInterestCoverage').value = f.interestCoverage !== null && f.interestCoverage !== undefined ? f.interestCoverage : '';
  document.getElementById('editHealthShares').value = f.sharesOutstanding !== null && f.sharesOutstanding !== undefined ? f.sharesOutstanding : '';
  document.getElementById('editHealthDividendYield').value = f.dividendYield !== null && f.dividendYield !== undefined ? f.dividendYield : '';

  // Qualitativo & Tese
  document.getElementById('editHealthMoatScore').value = q.competitiveAdvantageScore !== null && q.competitiveAdvantageScore !== undefined ? q.competitiveAdvantageScore : '';
  document.getElementById('editHealthGovernanceScore').value = q.governanceScore !== null && q.governanceScore !== undefined ? q.governanceScore : '';
  document.getElementById('editHealthThesisScore').value = t.thesisScore !== null && t.thesisScore !== undefined ? t.thesisScore : '';
  document.getElementById('editHealthThesisSummary').value = t.summary || '';
  document.getElementById('editHealthThesisRisks').value = Array.isArray(t.risks) ? t.risks.join('\n') : '';
  document.getElementById('editHealthThesisInvalidation').value = Array.isArray(t.invalidationFactors) ? t.invalidationFactors.join('\n') : '';
  document.getElementById('editHealthThesisLastReview').value = t.lastReview || '';

  // DCF Cenários
  const scBase = scen.base || {};
  const scCons = scen.conservative || {};
  const scOpt = scen.optimistic || {};

  document.getElementById('editHealthDcfBaseGrowth').value = scBase.growthRate !== undefined ? scBase.growthRate : 10;
  document.getElementById('editHealthDcfBaseDiscount').value = scBase.discountRate !== undefined ? scBase.discountRate : 11.5;
  document.getElementById('editHealthDcfBaseTerminal').value = scBase.terminalGrowth !== undefined ? scBase.terminalGrowth : 4.0;

  document.getElementById('editHealthDcfConsGrowth').value = scCons.growthRate !== undefined ? scCons.growthRate : 6;
  document.getElementById('editHealthDcfConsDiscount').value = scCons.discountRate !== undefined ? scCons.discountRate : 12.5;

  document.getElementById('editHealthDcfOptGrowth').value = scOpt.growthRate !== undefined ? scOpt.growthRate : 14;
  document.getElementById('editHealthDcfOptDiscount').value = scOpt.discountRate !== undefined ? scOpt.discountRate : 10.5;

  // Configurar listeners e atualizar semáforos de indicadores
  setupModalFundamentalListeners();
  updateModalFundamentalBadges();

  // Renderizar hipóteses editáveis
  renderModalThesisChecksEditor(t.checks || []);

  // Preencher links de consulta rápida externa
  const extContainer = document.getElementById('externalCheckLinks');
  if (extContainer) {
    const cleanTicker = (asset.ticker || '').trim().toUpperCase().replace(/\.SA$/i, '');
    extContainer.innerHTML = `
      <a href="https://statusinvest.com.br/acoes/${cleanTicker}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding: 3px 8px; color: #60a5fa;" title="Ver no Status Invest">StatusInvest ↗</a>
      <a href="https://www.fundamentus.com.br/detalhes.php?papel=${cleanTicker}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding: 3px 8px; color: #60a5fa;" title="Ver no Fundamentus">Fundamentus ↗</a>
    `;
  }

  const modal = document.getElementById('modalEditAssetHealthBackdrop');
  if (modal) modal.style.display = 'flex';
}

function closeEditAssetHealthModal() {
  const modal = document.getElementById('modalEditAssetHealthBackdrop');
  if (modal) modal.style.display = 'none';
}

const MODAL_METRIC_INPUT_MAP = [
  { id: 'editHealthRoic', badgeId: 'statusBadgeRoic', key: 'roic' },
  { id: 'editHealthRoe', badgeId: 'statusBadgeRoe', key: 'roe' },
  { id: 'editHealthNetMargin', badgeId: 'statusBadgeNetMargin', key: 'netMargin' },
  { id: 'editHealthEbitdaMargin', badgeId: 'statusBadgeEbitdaMargin', key: 'ebitdaMargin' },
  { id: 'editHealthNetDebtEbitda', badgeId: 'statusBadgeNetDebtEbitda', key: 'netDebtEbitda' },
  { id: 'editHealthInterestCoverage', badgeId: 'statusBadgeInterestCoverage', key: 'interestCoverage' },
  { id: 'editHealthRevenueGrowth', badgeId: 'statusBadgeRevenueGrowth', key: 'revenueGrowth' },
  { id: 'editHealthNetIncomeGrowth', badgeId: 'statusBadgeNetIncomeGrowth', key: 'netIncomeGrowth' },
  { id: 'editHealthFcfGrowth', badgeId: 'statusBadgeFcfGrowth', key: 'fcfGrowth' },
  { id: 'editHealthDividendYield', badgeId: 'statusBadgeDividendYield', key: 'dividendYield' }
];

/**
 * Avalia um indicador fundamentalista retornando estado semafórico (verde, amarelo, vermelho)
 */
function evaluateModalIndicatorValue(metricKey, rawVal) {
  if (rawVal === null || rawVal === undefined || rawVal === '' || isNaN(parseFloat(rawVal))) {
    return { icon: '⚪', label: 'N/D', badgeClass: 'badge-secondary' };
  }
  const val = parseFloat(rawVal);
  switch (metricKey) {
    case 'roic':
    case 'roe':
      if (val >= 15) return { icon: '🟢', label: 'Forte', badgeClass: 'badge-success' };
      if (val >= 10) return { icon: '🟡', label: 'Regular', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Fraco', badgeClass: 'badge-danger' };
    case 'netMargin':
      if (val >= 10) return { icon: '🟢', label: 'Forte', badgeClass: 'badge-success' };
      if (val >= 5) return { icon: '🟡', label: 'Regular', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Baixa', badgeClass: 'badge-danger' };
    case 'ebitdaMargin':
      if (val >= 18) return { icon: '🟢', label: 'Forte', badgeClass: 'badge-success' };
      if (val >= 10) return { icon: '🟡', label: 'Regular', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Baixa', badgeClass: 'badge-danger' };
    case 'netDebtEbitda':
      if (val <= 1.5) return { icon: '🟢', label: 'Controlada', badgeClass: 'badge-success' };
      if (val <= 2.5) return { icon: '🟡', label: 'Moderada', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Elevada', badgeClass: 'badge-danger' };
    case 'interestCoverage':
      if (val >= 5.0) return { icon: '🟢', label: 'Segura', badgeClass: 'badge-success' };
      if (val >= 2.5) return { icon: '🟡', label: 'Atenção', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Crítica', badgeClass: 'badge-danger' };
    case 'revenueGrowth':
    case 'netIncomeGrowth':
      if (val >= 10) return { icon: '🟢', label: 'Alto', badgeClass: 'badge-success' };
      if (val >= 3) return { icon: '🟡', label: 'Moderado', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Fraco/Queda', badgeClass: 'badge-danger' };
    case 'fcfGrowth':
      if (val >= 10) return { icon: '🟢', label: 'Alto', badgeClass: 'badge-success' };
      if (val >= 0) return { icon: '🟡', label: 'Estável', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Queda', badgeClass: 'badge-danger' };
    case 'dividendYield':
      if (val >= 6) return { icon: '🟢', label: 'Alto', badgeClass: 'badge-success' };
      if (val >= 3) return { icon: '🟡', label: 'Médio', badgeClass: 'badge-warning' };
      return { icon: '⚪', label: 'Baixo', badgeClass: 'badge-secondary' };
    default:
      return { icon: '⚪', label: '-', badgeClass: 'badge-secondary' };
  }
}

/**
 * Atualiza os badges de status de todos os indicadores fundamentalistas no modal
 */
function updateModalFundamentalBadges() {
  MODAL_METRIC_INPUT_MAP.forEach(m => {
    const input = document.getElementById(m.id);
    const badge = document.getElementById(m.badgeId);
    if (!input || !badge) return;
    const val = input.value.replace(/\./g, '').replace(',', '.').trim();
    const evalRes = evaluateModalIndicatorValue(m.key, val);
    badge.className = `badge ${evalRes.badgeClass}`;
    badge.textContent = `${evalRes.icon} ${evalRes.label}`;
  });
  updateAllModalCheckRows();
}

/**
 * Registra ouvintes para atualizar os badges do formulário em tempo real
 */
let modalFundamentalListenersRegistered = false;
function setupModalFundamentalListeners() {
  if (modalFundamentalListenersRegistered) return;
  MODAL_METRIC_INPUT_MAP.forEach(m => {
    const input = document.getElementById(m.id);
    if (input) {
      input.addEventListener('input', updateModalFundamentalBadges);
    }
  });
  modalFundamentalListenersRegistered = true;
}

/**
 * Avalia uma única linha de hipótese dentro do modal e atualiza seu badge (🟢, 🟡, 🔴, ⚪)
 */
function evaluateModalCheckRow(rowEl) {
  if (!rowEl) return;
  const metric = rowEl.querySelector('.check-metric')?.value;
  const op = rowEl.querySelector('.check-op')?.value || '>=';
  const threshVal = rowEl.querySelector('.check-threshold')?.value.replace(',', '.').trim();
  const threshold = parseFloat(threshVal);

  const badgeEl = rowEl.querySelector('.check-status-badge');
  if (!badgeEl) return;

  if (isNaN(threshold)) {
    badgeEl.className = 'check-status-badge badge badge-secondary';
    badgeEl.textContent = '⚪ Limite?';
    return;
  }

  // Buscar valor atual do campo fundamental correspondente no modal
  const inputEntry = MODAL_METRIC_INPUT_MAP.find(m => m.key === metric);
  const inputEl = inputEntry ? document.getElementById(inputEntry.id) : null;
  const rawVal = inputEl ? inputEl.value.replace(/\./g, '').replace(',', '.').trim() : '';

  if (rawVal === '' || isNaN(parseFloat(rawVal))) {
    badgeEl.className = 'check-status-badge badge badge-secondary';
    badgeEl.textContent = '⚪ Sem Dado';
    return;
  }

  const currentVal = parseFloat(rawVal);
  let isPassed = false;
  let isNear = false;

  switch (op) {
    case '>=':
      isPassed = currentVal >= threshold;
      isNear = !isPassed && currentVal >= (threshold * 0.85);
      break;
    case '<=':
      isPassed = currentVal <= threshold;
      isNear = !isPassed && currentVal <= (threshold * 1.15);
      break;
    case '>':
      isPassed = currentVal > threshold;
      isNear = !isPassed && currentVal >= (threshold * 0.85);
      break;
    case '<':
      isPassed = currentVal < threshold;
      isNear = !isPassed && currentVal <= (threshold * 1.15);
      break;
  }

  if (isPassed) {
    badgeEl.className = 'check-status-badge badge badge-success';
    badgeEl.textContent = '🟢 Confirmada';
    badgeEl.title = `Atual: ${currentVal} ${op} Limite: ${threshold}`;
  } else if (isNear) {
    badgeEl.className = 'check-status-badge badge badge-warning';
    badgeEl.textContent = '🟡 Atenção';
    badgeEl.title = `Atual: ${currentVal} (próximo do limite ${threshold})`;
  } else {
    badgeEl.className = 'check-status-badge badge badge-danger';
    badgeEl.textContent = '🔴 Ameaçada';
    badgeEl.title = `Atual: ${currentVal} violou o limite ${threshold}`;
  }
}

/**
 * Atualiza todas as linhas de hipóteses e o resumo de semáforos no topo da lista
 */
function updateAllModalCheckRows() {
  const rows = document.querySelectorAll('#modalThesisChecksList > div');
  let confirmed = 0;
  let warning = 0;
  let threatened = 0;
  let unknown = 0;

  rows.forEach(r => {
    evaluateModalCheckRow(r);
    const badge = r.querySelector('.check-status-badge');
    if (badge) {
      if (badge.classList.contains('badge-success')) confirmed++;
      else if (badge.classList.contains('badge-warning')) warning++;
      else if (badge.classList.contains('badge-danger')) threatened++;
      else unknown++;
    }
  });

  const summaryEl = document.getElementById('modalThesisChecksSummary');
  if (summaryEl) {
    if (rows.length === 0) {
      summaryEl.innerHTML = `<span class="text-muted text-small">Nenhuma hipótese cadastrada. Clique em "➕ Nova Hipótese" abaixo.</span>`;
    } else {
      summaryEl.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; background: rgba(255,255,255,0.02); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
          <span style="color: #cbd5e1; font-weight: 600; font-size: 0.78rem;">Status das Hipóteses:</span>
          <span class="badge badge-success" style="padding: 2px 8px; font-size: 0.72rem;">🟢 ${confirmed} Confirmada(s)</span>
          <span class="badge badge-warning" style="padding: 2px 8px; font-size: 0.72rem;">🟡 ${warning} Em Atenção</span>
          <span class="badge badge-danger" style="padding: 2px 8px; font-size: 0.72rem;">🔴 ${threatened} Ameaçada(s)</span>
          ${unknown > 0 ? `<span class="badge badge-secondary" style="padding: 2px 8px; font-size: 0.72rem;">⚪ ${unknown} Sem Dados</span>` : ''}
        </div>
      `;
    }
  }
}

/**
 * Renderiza a lista de hipóteses no modal de edição com badges semafóricos em tempo real
 */
function renderModalThesisChecksEditor(checks) {
  const container = document.getElementById('modalThesisChecksList');
  if (!container) return;

  container.innerHTML = checks.map((c, idx) => `
    <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap;" data-check-idx="${idx}">
      <span class="check-status-badge badge badge-secondary" style="min-width: 96px; text-align: center; font-size: 0.72rem; padding: 4px 6px;">⚪ Aguardando</span>
      <input type="text" class="form-control form-control-sm check-desc" placeholder="Descrição da hipótese" value="${escapeHtml(c.description || '')}" style="flex: 2; min-width: 160px;" oninput="updateAllModalCheckRows()" />
      <select class="form-control form-control-sm check-metric" style="flex: 1.5; min-width: 130px;" onchange="updateAllModalCheckRows()">
        <option value="roic" ${c.metric === 'roic' ? 'selected' : ''}>ROIC</option>
        <option value="roe" ${c.metric === 'roe' ? 'selected' : ''}>ROE</option>
        <option value="revenueGrowth" ${c.metric === 'revenueGrowth' ? 'selected' : ''}>Cresc. Receita</option>
        <option value="ebitdaMargin" ${c.metric === 'ebitdaMargin' ? 'selected' : ''}>Margem EBITDA</option>
        <option value="netMargin" ${c.metric === 'netMargin' ? 'selected' : ''}>Margem Líquida</option>
        <option value="netDebtEbitda" ${c.metric === 'netDebtEbitda' ? 'selected' : ''}>Dív. Líq / EBITDA</option>
        <option value="interestCoverage" ${c.metric === 'interestCoverage' ? 'selected' : ''}>Cobert. Juros</option>
        <option value="fcfGrowth" ${c.metric === 'fcfGrowth' ? 'selected' : ''}>Cresc. FCF</option>
        <option value="dividendYield" ${c.metric === 'dividendYield' ? 'selected' : ''}>Dividend Yield</option>
      </select>
      <select class="form-control form-control-sm check-op" style="width: 70px;" onchange="updateAllModalCheckRows()">
        <option value=">=" ${c.operator === '>=' ? 'selected' : ''}>&gt;=</option>
        <option value="<=" ${c.operator === '<=' ? 'selected' : ''}>&lt;=</option>
        <option value=">" ${c.operator === '>' ? 'selected' : ''}>&gt;</option>
        <option value="<" ${c.operator === '<' ? 'selected' : ''}>&lt;</option>
      </select>
      <input type="text" inputmode="decimal" class="form-control form-control-sm check-threshold" placeholder="Limite" value="${c.threshold !== undefined ? c.threshold : ''}" style="width: 80px;" oninput="updateAllModalCheckRows()" />
      <button type="button" class="btn-icon danger" onclick="this.parentElement.remove(); updateAllModalCheckRows();" title="Excluir Hipótese">✕</button>
    </div>
  `).join('');

  updateAllModalCheckRows();
}

function addModalThesisCheckRow() {
  const container = document.getElementById('modalThesisChecksList');
  if (!container) return;

  const div = document.createElement('div');
  div.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap;';
  div.innerHTML = `
    <span class="check-status-badge badge badge-secondary" style="min-width: 96px; text-align: center; font-size: 0.72rem; padding: 4px 6px;">⚪ Aguardando</span>
    <input type="text" class="form-control form-control-sm check-desc" placeholder="Ex: ROIC permanecer acima de 20%" style="flex: 2; min-width: 160px;" oninput="updateAllModalCheckRows()" />
    <select class="form-control form-control-sm check-metric" style="flex: 1.5; min-width: 130px;" onchange="updateAllModalCheckRows()">
      <option value="roic">ROIC</option>
      <option value="roe">ROE</option>
      <option value="revenueGrowth">Cresc. Receita</option>
      <option value="ebitdaMargin">Margem EBITDA</option>
      <option value="netMargin">Margem Líquida</option>
      <option value="netDebtEbitda">Dív. Líq / EBITDA</option>
      <option value="interestCoverage">Cobert. Juros</option>
      <option value="fcfGrowth">Cresc. FCF</option>
      <option value="dividendYield">Dividend Yield</option>
    </select>
    <select class="form-control form-control-sm check-op" style="width: 70px;" onchange="updateAllModalCheckRows()">
      <option value=">=">&gt;=</option>
      <option value="<=">&lt;=</option>
      <option value=">">&gt;</option>
      <option value="<">&lt;</option>
    </select>
    <input type="text" inputmode="decimal" class="form-control form-control-sm check-threshold" placeholder="20" value="20" style="width: 80px;" oninput="updateAllModalCheckRows()" />
    <button type="button" class="btn-icon danger" onclick="this.parentElement.remove(); updateAllModalCheckRows();" title="Excluir">✕</button>
  `;
  container.appendChild(div);
  updateAllModalCheckRows();
}

/**
 * Salva as alterações feitas no Modal de Saúde do Ativo
 */
function handleSaveAssetHealthSubmit(e) {
  if (e) e.preventDefault();

  const assetId = document.getElementById('editHealthAssetId').value;
  const asset = appState.acoes.find(a => String(a.id) === String(assetId));
  if (!asset) return;

  const parseOrNull = (id) => {
    const el = document.getElementById(id);
    if (!el || el.value.trim() === '') return null;
    const num = parseFloat(el.value.replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? null : num;
  };

  asset.tipo = document.getElementById('editHealthTipo').value || 'STOCK';
  asset.setor = document.getElementById('editHealthSetor').value.trim();

  // 1. Atualizar Fundamentos
  asset.fundamentals = {
    roic: parseOrNull('editHealthRoic'),
    roe: parseOrNull('editHealthRoe'),
    revenue: parseOrNull('editHealthRevenue'),
    revenueGrowth: parseOrNull('editHealthRevenueGrowth'),
    netIncome: parseOrNull('editHealthNetIncome'),
    netIncomeGrowth: parseOrNull('editHealthNetIncomeGrowth'),
    freeCashFlow: parseOrNull('editHealthFcf'),
    freeCashFlowGrowth: parseOrNull('editHealthFcfGrowth'),
    ebitdaMargin: parseOrNull('editHealthEbitdaMargin'),
    netMargin: parseOrNull('editHealthNetMargin'),
    netDebt: parseOrNull('editHealthNetDebt'),
    netDebtEbitda: parseOrNull('editHealthNetDebtEbitda'),
    interestCoverage: parseOrNull('editHealthInterestCoverage'),
    sharesOutstanding: parseOrNull('editHealthShares'),
    dividendYield: parseOrNull('editHealthDividendYield'),
    fundamentalsUpdatedAt: document.getElementById('editHealthUpdatedAt').value || null
  };

  // 2. Atualizar Qualitativo
  asset.qualitative = {
    competitiveAdvantageScore: parseOrNull('editHealthMoatScore'),
    governanceScore: parseOrNull('editHealthGovernanceScore'),
    notes: (asset.qualitative && asset.qualitative.notes) || ''
  };

  // 3. Atualizar Tese
  const risksText = document.getElementById('editHealthThesisRisks').value.trim();
  const invText = document.getElementById('editHealthThesisInvalidation').value.trim();

  // Coletar hipóteses
  const checkRows = document.querySelectorAll('#modalThesisChecksList > div');
  const checks = [];
  checkRows.forEach((row, i) => {
    const desc = row.querySelector('.check-desc').value.trim();
    const metric = row.querySelector('.check-metric').value;
    const op = row.querySelector('.check-op').value;
    const threshVal = row.querySelector('.check-threshold').value.replace(',', '.');
    const threshold = parseFloat(threshVal);
    if (!isNaN(threshold)) {
      checks.push({
        id: `check-${Date.now()}-${i}`,
        description: desc || `${metric} ${op} ${threshold}`,
        metric,
        operator: op,
        threshold
      });
    }
  });

  asset.thesis = {
    summary: document.getElementById('editHealthThesisSummary').value.trim(),
    reasons: (asset.thesis && asset.thesis.reasons) || [],
    competitiveAdvantages: (asset.thesis && asset.thesis.competitiveAdvantages) || [],
    expectations: (asset.thesis && asset.thesis.expectations) || [],
    risks: risksText ? risksText.split('\n').filter(Boolean) : [],
    invalidationFactors: invText ? invText.split('\n').filter(Boolean) : [],
    horizonYears: (asset.thesis && asset.thesis.horizonYears) || 5,
    lastReview: document.getElementById('editHealthThesisLastReview').value || null,
    thesisScore: parseOrNull('editHealthThesisScore'),
    checks
  };

  // 4. Atualizar Premissas de Valuation DCF
  asset.valuation = asset.valuation || {};
  asset.valuation.dcf = asset.valuation.dcf || {};
  asset.valuation.dcf.scenarios = {
    base: {
      growthRate: parseOrNull('editHealthDcfBaseGrowth') || 10,
      discountRate: parseOrNull('editHealthDcfBaseDiscount') || 11.5,
      terminalGrowth: parseOrNull('editHealthDcfBaseTerminal') || 4.0
    },
    conservative: {
      growthRate: parseOrNull('editHealthDcfConsGrowth') || 6,
      discountRate: parseOrNull('editHealthDcfConsDiscount') || 12.5,
      terminalGrowth: parseOrNull('editHealthDcfBaseTerminal') || 3.5
    },
    optimistic: {
      growthRate: parseOrNull('editHealthDcfOptGrowth') || 14,
      discountRate: parseOrNull('editHealthDcfOptDiscount') || 10.5,
      terminalGrowth: parseOrNull('editHealthDcfBaseTerminal') || 4.5
    }
  };

  saveLocalState(true, true);
  closeEditAssetHealthModal();
  renderAssetHealthDashboard(asset);
  renderAssetNavDrawerSubmenu();

  showToast(`Análise e fundamentos de ${asset.ticker} atualizados!`, 'success');
}

/**
 * Salva o Token da Brapi configurado na tela de configurações
 */
function saveBrapiTokenSetting() {
  const input = document.getElementById('cfgBrapiToken');
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    localStorage.setItem('wingene_brapi_token', val);
    showToast('Token da API Brapi salvo com sucesso!', 'success');
  } else {
    localStorage.removeItem('wingene_brapi_token');
    showToast('Token da Brapi removido.', 'info');
  }
}

/**
 * Busca os indicadores fundamentalistas mais recentes de um ativo na internet via Brapi (brapi.dev)
 * e preenche automaticamente os campos da tela de edição com feedback semafórico instantâneo.
 */
async function fetchFundamentalsForCurrentModal() {
  const assetId = document.getElementById('editHealthAssetId')?.value;
  const asset = appState.acoes.find(a => String(a.id) === String(assetId));
  if (!asset) {
    showToast('Ação não encontrada para consulta.', 'error');
    return;
  }

  const rawTicker = (asset.ticker || '').trim().toUpperCase();
  const cleanTicker = rawTicker.replace(/\.SA$/i, '');
  if (!cleanTicker) {
    showToast('Ticker inválido para consulta.', 'warning');
    return;
  }

  // Verificar existência de token da Brapi
  let token = localStorage.getItem('wingene_brapi_token');
  if (!token || token.trim() === '') {
    const entered = prompt(
      `Para buscar os indicadores fundamentalistas de ${cleanTicker} diretamente da internet, insira seu Token gratuito da Brapi (brapi.dev):\n\n(Obtenha gratuitamente criando sua conta em https://brapi.dev em menos de 1 minuto).`,
      ''
    );
    if (entered && entered.trim()) {
      token = entered.trim();
      localStorage.setItem('wingene_brapi_token', token);
      const cfgInput = document.getElementById('cfgBrapiToken');
      if (cfgInput) cfgInput.value = token;
    } else {
      showToast('Token da Brapi não informado. Você pode cadastrá-lo a qualquer momento na aba Configurações.', 'info');
      return;
    }
  }

  const btn = document.getElementById('btnFetchFundamentalsOnline');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `⏳ Buscando ${cleanTicker}...`;
  }

  try {
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}?modules=summaryProfile,financialData,defaultKeyStatistics&token=${encodeURIComponent(token)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wingene_brapi_token');
        throw new Error('Token da Brapi inválido ou não autorizado. Verifique seu token em brapi.dev.');
      }
      throw new Error(`Erro na consulta da API Brapi (Status ${res.status}).`);
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      throw new Error(`Nenhum dado encontrado para o ticker ${cleanTicker}.`);
    }

    const item = data.results[0];
    const fin = item.financialData || {};
    const stats = item.defaultKeyStatistics || {};
    const prof = item.summaryProfile || {};

    const formatPctVal = (val) => {
      if (val === null || val === undefined || isNaN(val)) return null;
      const n = parseFloat(val);
      const pct = (Math.abs(n) > 0 && Math.abs(n) < 1.0) ? (n * 100) : n;
      return pct.toFixed(1).replace('.', ',');
    };

    const formatIntVal = (val) => {
      if (val === null || val === undefined || isNaN(val)) return null;
      return Math.round(parseFloat(val)).toString();
    };

    // 1. Setor / Indústria
    const sectorEl = document.getElementById('editHealthSetor');
    if (sectorEl) {
      const parts = [prof.sector, prof.industry].filter(Boolean);
      if (parts.length > 0) sectorEl.value = parts.join(' / ');
    }

    // 2. Margens e Rentabilidade
    if (fin.profitMargins !== undefined) {
      const el = document.getElementById('editHealthNetMargin');
      if (el) el.value = formatPctVal(fin.profitMargins);
    }
    if (fin.ebitdaMargins !== undefined) {
      const el = document.getElementById('editHealthEbitdaMargin');
      if (el) el.value = formatPctVal(fin.ebitdaMargins);
    }
    if (fin.returnOnEquity !== undefined) {
      const el = document.getElementById('editHealthRoe');
      if (el) el.value = formatPctVal(fin.returnOnEquity);
    }
    if (item.roic !== undefined || fin.returnOnAssets !== undefined) {
      const el = document.getElementById('editHealthRoic');
      if (el) el.value = formatPctVal(item.roic !== undefined ? item.roic : fin.returnOnAssets);
    }

    // 3. Crescimentos
    if (fin.revenueGrowth !== undefined) {
      const el = document.getElementById('editHealthRevenueGrowth');
      if (el) el.value = formatPctVal(fin.revenueGrowth);
    }
    if (fin.earningsGrowth !== undefined) {
      const el = document.getElementById('editHealthNetIncomeGrowth');
      if (el) el.value = formatPctVal(fin.earningsGrowth);
    }

    // 4. Dividend Yield
    const dyVal = item.dividendYield !== undefined ? item.dividendYield : item.regularMarketDividendYield;
    if (dyVal !== undefined && dyVal !== null) {
      const el = document.getElementById('editHealthDividendYield');
      if (el) el.value = formatPctVal(dyVal);
    }

    // 5. Totais Financeiros (R$)
    if (fin.totalRevenue) {
      const el = document.getElementById('editHealthRevenue');
      if (el) el.value = formatIntVal(fin.totalRevenue);
    }
    if (stats.netIncomeToCommon || fin.netIncome) {
      const el = document.getElementById('editHealthNetIncome');
      if (el) el.value = formatIntVal(stats.netIncomeToCommon || fin.netIncome);
    }
    if (fin.freeCashflow) {
      const el = document.getElementById('editHealthFcf');
      if (el) el.value = formatIntVal(fin.freeCashflow);
    }
    if (stats.sharesOutstanding) {
      const el = document.getElementById('editHealthShares');
      if (el) el.value = formatIntVal(stats.sharesOutstanding);
    }

    // Dívida Líquida & Dívida Líq / EBITDA
    let netDebtNum = null;
    if (fin.totalDebt !== undefined && fin.totalCash !== undefined) {
      netDebtNum = parseFloat(fin.totalDebt) - parseFloat(fin.totalCash);
      const el = document.getElementById('editHealthNetDebt');
      if (el) el.value = formatIntVal(netDebtNum);
    }

    if (netDebtNum !== null) {
      let ebitdaNum = parseFloat(fin.ebitda || 0);
      if (ebitdaNum <= 0 && fin.totalRevenue && fin.ebitdaMargins) {
        ebitdaNum = parseFloat(fin.totalRevenue) * parseFloat(fin.ebitdaMargins);
      }
      if (ebitdaNum > 0) {
        const debtRatio = (netDebtNum / ebitdaNum).toFixed(1).replace('.', ',');
        const el = document.getElementById('editHealthNetDebtEbitda');
        if (el) el.value = debtRatio;
      }
    }

    // Data de referência: hoje
    const todayIso = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('editHealthUpdatedAt');
    if (dateEl) dateEl.value = todayIso;

    // Atualizar badges semafóricos e hipóteses em tempo real
    updateModalFundamentalBadges();
    showToast(`Indicadores de ${cleanTicker} atualizados com sucesso da internet!`, 'success');
  } catch (err) {
    console.error('Erro ao buscar indicadores online:', err);
    showToast(err.message || 'Falha ao buscar indicadores online.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}
