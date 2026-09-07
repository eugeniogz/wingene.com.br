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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
if (typeof window !== 'undefined' && typeof window.escapeHtml !== 'function') {
  window.escapeHtml = escapeHtml;
}

/**
 * Inicializa a navegação e eventos de Apoio à Decisão
 */
function initInvestDecisionUI() {
  // Inicialização UI
}

/**
 * Menu gaveta simplificado sem listagem individual de ativos (conforme solicitado)
 */
function renderAssetNavDrawerSubmenu() {
  // Desativado a pedido do usuário para manter o menu limpo
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
      <div style="font-weight: 700; color: #cbd5e1; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
        <span>🎯</span> Alocação Recomendada (Prioridade de Aporte)
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="btn btn-secondary btn-sm" id="btnBatchAiFundamentalsRebal" onclick="openBatchAiFundamentalsModal()" style="font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border: 1px solid #818cf8; color: #c7d2fe;" title="Atualizar todos os ativos em 1 clique via IA">
          🤖 Atualizar em Lote via IA
        </button>
      </div>
    </div>
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
  document.getElementById('editHealthPe').value = f.pe !== null && f.pe !== undefined ? f.pe : '';
  document.getElementById('editHealthEps').value = f.eps !== null && f.eps !== undefined ? f.eps : '';
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

  const modal = document.getElementById('modalEditAssetHealthBackdrop');
  if (modal) modal.style.display = 'flex';
}

function closeEditAssetHealthModal() {
  const modal = document.getElementById('modalEditAssetHealthBackdrop');
  if (modal) modal.style.display = 'none';
}

const MODAL_METRIC_INPUT_MAP = [
  { id: 'editHealthPe', badgeId: 'statusBadgePe', key: 'pe' },
  { id: 'editHealthEps', badgeId: 'statusBadgeEps', key: 'eps' },
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
    case 'pe':
      if (val <= 0) return { icon: '🔴', label: 'Prejuízo', badgeClass: 'badge-danger' };
      if (val <= 15) return { icon: '🟢', label: 'Atrativo', badgeClass: 'badge-success' };
      if (val <= 25) return { icon: '🟡', label: 'Moderado', badgeClass: 'badge-warning' };
      return { icon: '🔴', label: 'Esticado', badgeClass: 'badge-danger' };
    case 'eps':
      if (val > 0) return { icon: '🟢', label: 'Lucrativo', badgeClass: 'badge-success' };
      return { icon: '🔴', label: 'Prejuízo', badgeClass: 'badge-danger' };
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
    pe: parseOrNull('editHealthPe'),
    eps: parseOrNull('editHealthEps'),
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
 * Normaliza e limpa o token da Brapi (remove espaços, aspas ou prefixo "Bearer ")
 */
function cleanBrapiToken(rawToken) {
  if (!rawToken) return '';
  let t = String(rawToken).trim();
  t = t.replace(/^["']+|["']+$/g, '').trim();
  if (t.toLowerCase().startsWith('bearer ')) {
    t = t.substring(7).trim();
  }
  return t;
}

/**
 * Extrai indicadores fundamentalistas a partir de texto puro copiado do StatusInvest, Fundamentus, Investidor10 etc.
 */
function parsePastedTextIndicators(raw) {
  const getMatch = (regex) => {
    const m = raw.match(regex);
    return m && m[1] ? m[1].replace(',', '.').trim() : null;
  };
  
  const parseNum = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  return {
    pe: parseNum(getMatch(/(?:P\/L|P\/E|Preço\s*\/\s*Lucro)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)/i)),
    eps: parseNum(getMatch(/(?:LPA|EPS|Lucro\s*por\s*Ação)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)/i)),
    roic: parseNum(getMatch(/(?:ROIC)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i)),
    roe: parseNum(getMatch(/(?:ROE)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i)),
    netMargin: parseNum(getMatch(/(?:MARGEM\s*LÍQUIDA|MARGEM\s*LIQUIDA|Marg\.?\s*Líquida|Marg\.?\s*Liquida|M\.?\s*LÍQUIDA|M\.?\s*LIQUIDA)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i)),
    ebitdaMargin: parseNum(getMatch(/(?:MARGEM\s*EBITDA|Marg\.?\s*EBITDA|M\.?\s*EBITDA)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i)),
    netDebtEbitda: parseNum(getMatch(/(?:DÍVIDA\s*LÍQUIDA\s*\/\s*EBITDA|DIVIDA\s*LIQUIDA\s*\/\s*EBITDA|DÍV\.?\s*LÍQ\.?(?:UIDA)?\s*\/\s*EBITDA|Div\.?\s*Liq\.?\s*\/\s*EBITDA|DL\s*\/\s*EBITDA)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)/i)),
    interestCoverage: parseNum(getMatch(/(?:Cobert\.?\s*Juros|Cobertura\s*de\s*Juros)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)/i)),
    revenueGrowth: parseNum(getMatch(/(?:Cresc\.?\s*Receita|Crescimento\s*Receita|CAGR\s*RECEITAS?(?:\s*5\s*ANOS)?)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i)),
    netIncomeGrowth: parseNum(getMatch(/(?:Cresc\.?\s*Lucro|Crescimento\s*Lucro|CAGR\s*LUCROS?(?:\s*5\s*ANOS)?)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i)),
    fcfGrowth: parseNum(getMatch(/(?:Cresc\.?\s*FCF|Crescimento\s*FCF|Cresc\.?\s*Fluxo)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i)),
    dividendYield: parseNum(getMatch(/(?:D\.?Y\.?|Dividend\s*Yield|Div\.?\s*Yield)\s*[:=\n\r\t\s]+([+-]?\d+(?:[.,]\d+)?)\s*%?/i))
  };
}

/**
 * Gera um prompt dinâmico pronto para IA (ChatGPT / Gemini / Claude) com todos os tickers da carteira
 */
function generateBatchAiPrompt() {
  const acoes = (appState && Array.isArray(appState.acoes)) ? appState.acoes : [];
  const tickers = acoes.map(a => (a.ticker || '').trim().toUpperCase().replace(/\.SA$/i, '')).filter(Boolean);
  const tickersStr = tickers.length > 0 ? tickers.join(', ') : 'PETR4, VALE3, ITUB4, WEGE3';
  const todayIso = new Date().toISOString().split('T')[0];

  return `Atue como um analista de investimentos fundamentalista e especialista no mercado financeiro (B3 e BDRs).
Data de referência: ${todayIso}.

Para cada uma das seguintes ações/BDRs da minha carteira:
[${tickersStr}]

Pesquise e forneça os indicadores fundamentalistas e múltiplos mais recentes disponíveis (LTM / últimos 12 meses divulgados), no formato JSON abaixo.
Se algum indicador não for aplicável ao setor (ex: bancos não têm Dívida Líq/EBITDA nem Margem EBITDA), use null.

Responda ESTRITAMENTE com o bloco JSON válido abaixo, sem texto antes ou depois:

[
  {
    "ticker": "WEGE3",
    "precoAtual": 52.10,
    "pl": 34.72,
    "lpa": 1.49,
    "roic": 25.73,
    "roe": 33.16,
    "margemLiquida": 15.58,
    "margemEbitda": 22.15,
    "dividaLiquidaEbitda": -0.42,
    "crescimentoReceita5a": 18.49,
    "crescimentoLucro5a": 21.72,
    "dividendYield": 2.28
  }
]`;
}

/**
 * Abre o modal de atualização em lote via IA
 */
function openBatchAiFundamentalsModal() {
  const modal = document.getElementById('modalBatchAiFundamentalsBackdrop');
  const promptEl = document.getElementById('batchAiPromptTextarea');
  const inputEl = document.getElementById('batchAiResponseInput');
  const fbEl = document.getElementById('batchAiFeedback');

  if (promptEl) promptEl.value = generateBatchAiPrompt();
  if (inputEl) inputEl.value = '';
  if (fbEl) fbEl.innerHTML = '';
  if (modal) modal.style.display = 'flex';
}

/**
 * Fecha o modal de lote IA
 */
function closeBatchAiFundamentalsModal() {
  const modal = document.getElementById('modalBatchAiFundamentalsBackdrop');
  if (modal) modal.style.display = 'none';
}

/**
 * Copia o prompt para a área de transferência
 */
function copyBatchAiPrompt() {
  const promptEl = document.getElementById('batchAiPromptTextarea');
  const btn = document.getElementById('btnCopyAiPrompt');
  if (!promptEl) return;

  const text = promptEl.value;
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ Copiado!';
      setTimeout(() => { btn.innerHTML = orig; }, 2500);
    }
    showToast('📋 Prompt copiado com sucesso! Cole no ChatGPT ou Gemini.', 'success');
  }).catch(() => {
    promptEl.select();
    document.execCommand('copy');
    showToast('📋 Prompt copiado!', 'info');
  });
}

/**
 * Processa a resposta retornada pela IA (JSON ou texto estruturado) e atualiza toda a carteira
 */
function processBatchAiResponse() {
  const input = document.getElementById('batchAiResponseInput');
  const fb = document.getElementById('batchAiFeedback');
  let raw = (input ? input.value : '').trim();

  if (!raw) {
    if (fb) fb.innerHTML = '<span style="color: #f87171; font-weight: 600;">⚠️ Por favor, cole a resposta da IA antes de processar.</span>';
    return;
  }

  const acoes = (appState && Array.isArray(appState.acoes)) ? appState.acoes : [];
  if (acoes.length === 0) {
    if (fb) fb.innerHTML = '<span style="color: #f87171; font-weight: 600;">❌ Nenhuma ação cadastrada na carteira.</span>';
    return;
  }

  // 1. Tentar extrair lista de objetos (JSON)
  let itemsList = null;
  let cleaned = raw;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) itemsList = parsed;
    else if (parsed && Array.isArray(parsed.results)) itemsList = parsed.results;
    else if (parsed && typeof parsed === 'object') {
      itemsList = [];
      for (const k of Object.keys(parsed)) {
        if (typeof parsed[k] === 'object' && parsed[k] !== null) {
          itemsList.push({ ticker: parsed[k].ticker || k, ...parsed[k] });
        }
      }
    }
  } catch (e) {
    const jsonMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) itemsList = parsed;
      } catch (err2) {}
    }
  }

  // Normalizador de chaves numéricas
  const getNum = (obj, ...keys) => {
    for (const k of keys) {
      const val = obj[k];
      if (val !== undefined && val !== null && val !== '') {
        if (typeof val === 'number') {
          return isNaN(val) ? null : val;
        }
        let str = String(val).trim();
        if (str.includes(',')) {
          str = str.replace(/\./g, '').replace(',', '.');
        }
        const n = parseFloat(str);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const updatedAssets = [];
  const notFoundTickers = [];

  // Cenário 1: Extraído via JSON estruturado
  if (itemsList && itemsList.length > 0) {
    itemsList.forEach(item => {
      const itemTicker = (item.ticker || item.symbol || item.papel || '').trim().toUpperCase().replace(/\.SA$/i, '');
      if (!itemTicker) return;

      const asset = acoes.find(a => (a.ticker || '').trim().toUpperCase().replace(/\.SA$/i, '') === itemTicker);
      if (!asset) {
        notFoundTickers.push(itemTicker);
        return;
      }

      asset.fundamentals = asset.fundamentals || {};

      const price = getNum(item, 'precoAtual', 'preco', 'cotacao', 'regularMarketPrice');
      if (price && price > 0) asset.precoAtual = price;

      const pe = getNum(item, 'pl', 'pe', 'priceEarnings', 'p_l');
      if (pe !== null) asset.fundamentals.pe = pe;

      const eps = getNum(item, 'lpa', 'eps', 'earningsPerShare');
      if (eps !== null) asset.fundamentals.eps = eps;

      const roic = getNum(item, 'roic', 'ROIC');
      if (roic !== null) asset.fundamentals.roic = roic;

      const roe = getNum(item, 'roe', 'ROE');
      if (roe !== null) asset.fundamentals.roe = roe;

      const netMargin = getNum(item, 'margemLiquida', 'margem_liquida', 'netMargin', 'net_margin');
      if (netMargin !== null) asset.fundamentals.netMargin = netMargin;

      const ebitdaMargin = getNum(item, 'margemEbitda', 'margem_ebitda', 'ebitdaMargin', 'ebitda_margin');
      if (ebitdaMargin !== null) asset.fundamentals.ebitdaMargin = ebitdaMargin;

      const netDebtEbitda = getNum(item, 'dividaLiquidaEbitda', 'divida_liquida_ebitda', 'netDebtEbitda', 'net_debt_ebitda');
      if (netDebtEbitda !== null) asset.fundamentals.netDebtEbitda = netDebtEbitda;

      const interestCoverage = getNum(item, 'coberturaJuros', 'cobertura_juros', 'interestCoverage');
      if (interestCoverage !== null) asset.fundamentals.interestCoverage = interestCoverage;

      const revGrowth = getNum(item, 'crescimentoReceita5a', 'crescimento_receita_5a', 'crescimentoReceita', 'revenueGrowth');
      if (revGrowth !== null) asset.fundamentals.revenueGrowth = revGrowth;

      const netGrowth = getNum(item, 'crescimentoLucro5a', 'crescimento_lucro_5a', 'crescimentoLucro', 'netIncomeGrowth');
      if (netGrowth !== null) asset.fundamentals.netIncomeGrowth = netGrowth;

      const dy = getNum(item, 'dividendYield', 'dividend_yield', 'dy', 'DY');
      if (dy !== null) asset.fundamentals.dividendYield = dy;

      asset.fundamentals.fundamentalsUpdatedAt = todayIso;
      updatedAssets.push({ asset, fieldsCount: Object.keys(item).length });
    });
  } else {
    // Cenário 2: Texto livre com separação por Ticker
    const allKnownTickers = acoes.map(a => (a.ticker || '').trim().toUpperCase().replace(/\.SA$/i, '')).filter(Boolean);

    allKnownTickers.forEach(t => {
      const regex = new RegExp('(?:^|\\b)' + t + '\\b([\\s\\S]*?)(?=(?:\\b(?:' + allKnownTickers.filter(x => x !== t).join('|') + ')\\b|$))', 'i');
      const match = raw.match(regex);
      if (match && match[1]) {
        const blockText = match[1];
        const metrics = parsePastedTextIndicators(blockText);
        const hasAny = Object.keys(metrics).some(k => metrics[k] !== null);

        if (hasAny) {
          const asset = acoes.find(a => (a.ticker || '').trim().toUpperCase().replace(/\.SA$/i, '') === t);
          if (asset) {
            asset.fundamentals = asset.fundamentals || {};
            if (metrics.pe !== null) asset.fundamentals.pe = metrics.pe;
            if (metrics.eps !== null) asset.fundamentals.eps = metrics.eps;
            if (metrics.roic !== null) asset.fundamentals.roic = metrics.roic;
            if (metrics.roe !== null) asset.fundamentals.roe = metrics.roe;
            if (metrics.netMargin !== null) asset.fundamentals.netMargin = metrics.netMargin;
            if (metrics.ebitdaMargin !== null) asset.fundamentals.ebitdaMargin = metrics.ebitdaMargin;
            if (metrics.netDebtEbitda !== null) asset.fundamentals.netDebtEbitda = metrics.netDebtEbitda;
            if (metrics.interestCoverage !== null) asset.fundamentals.interestCoverage = metrics.interestCoverage;
            if (metrics.revenueGrowth !== null) asset.fundamentals.revenueGrowth = metrics.revenueGrowth;
            if (metrics.netIncomeGrowth !== null) asset.fundamentals.netIncomeGrowth = metrics.netIncomeGrowth;
            if (metrics.dividendYield !== null) asset.fundamentals.dividendYield = metrics.dividendYield;

            // Extrair cotação se presente no bloco
            const priceMatch = blockText.match(/(?:Cotação|Preço|Cotacao|Preco)\s*[:=\s]+R?\$?\s*([+-]?\d+(?:[.,]\d+)?)/i);
            if (priceMatch && priceMatch[1]) {
              const p = parseFloat(priceMatch[1].replace(',', '.'));
              if (!isNaN(p) && p > 0) asset.precoAtual = p;
            }

            asset.fundamentals.fundamentalsUpdatedAt = todayIso;
            updatedAssets.push({ asset, fieldsCount: Object.values(metrics).filter(v => v !== null).length });
          }
        }
      }
    });
  }

  if (updatedAssets.length === 0) {
    if (fb) {
      fb.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 8px; padding: 12px; color: #f87171; font-weight: 600;">
          ❌ Não foi possível identificar os ativos na resposta. Certifique-se de que a IA respondeu com o JSON gerado pelo prompt ou mencionou os tickers da carteira.
        </div>
      `;
    }
    return;
  }

  // Salvar estado e atualizar telas
  saveLocalState(true, true);
  if (typeof renderTabelaCarteira === 'function') renderTabelaCarteira();
  if (typeof renderRebalanceamentoTable === 'function') renderRebalanceamentoTable();
  if (typeof renderQualityDashboard === 'function') renderQualityDashboard();

  // Exibir resumo do lote
  const rowsHtml = updatedAssets.map(({ asset }) => {
    const f = asset.fundamentals || {};
    const cleanT = (asset.ticker || '').toUpperCase();
    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.8rem;">
        <td style="font-weight: 700; color: #38bdf8; padding: 6px 8px;">${cleanT}</td>
        <td style="padding: 6px 8px; text-align: right;">${asset.precoAtual ? 'R$ ' + asset.precoAtual.toFixed(2).replace('.', ',') : '-'}</td>
        <td style="padding: 6px 8px; text-align: right;">${f.pe ? f.pe.toFixed(1) : '-'}</td>
        <td style="padding: 6px 8px; text-align: right;">${f.eps ? 'R$ ' + f.eps.toFixed(2).replace('.', ',') : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; color: ${f.roic >= 15 ? '#34d399' : '#cbd5e1'}; font-weight: ${f.roic >= 15 ? '700' : 'normal'};">${f.roic !== undefined && f.roic !== null ? f.roic + '%' : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; color: ${f.roe >= 15 ? '#34d399' : '#cbd5e1'}; font-weight: ${f.roe >= 15 ? '700' : 'normal'};">${f.roe !== undefined && f.roe !== null ? f.roe + '%' : '-'}</td>
        <td style="padding: 6px 8px; text-align: right;">${f.netMargin !== undefined && f.netMargin !== null ? f.netMargin + '%' : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; color: ${f.netDebtEbitda !== undefined && f.netDebtEbitda <= 1.5 ? '#34d399' : '#cbd5e1'};">${f.netDebtEbitda !== undefined && f.netDebtEbitda !== null ? f.netDebtEbitda + 'x' : '-'}</td>
        <td style="padding: 6px 8px; text-align: right;">${f.dividendYield !== undefined && f.dividendYield !== null ? f.dividendYield + '%' : '-'}</td>
      </tr>
    `;
  }).join('');

  if (fb) {
    fb.innerHTML = `
      <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 12px; margin-top: 10px;">
        <div style="color: #34d399; font-weight: 700; font-size: 0.92rem; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>✅</span> ${updatedAssets.length} ativos atualizados com sucesso via IA!
        </div>
        <div style="max-height: 240px; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.15); color: #94a3b8; font-size: 0.73rem; text-transform: uppercase;">
                <th style="padding: 4px 8px;">Ticker</th>
                <th style="padding: 4px 8px; text-align: right;">Preço</th>
                <th style="padding: 4px 8px; text-align: right;">P/L</th>
                <th style="padding: 4px 8px; text-align: right;">LPA</th>
                <th style="padding: 4px 8px; text-align: right;">ROIC</th>
                <th style="padding: 4px 8px; text-align: right;">ROE</th>
                <th style="padding: 4px 8px; text-align: right;">Marg. Líq</th>
                <th style="padding: 4px 8px; text-align: right;">Dív. Líq</th>
                <th style="padding: 4px 8px; text-align: right;">DY</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 8px; font-size: 0.78rem; color: #94a3b8;">
          💡 Todos os múltiplos, pontuações de qualidade e prioridades de aporte foram recalculados e salvos.
        </div>
      </div>
    `;
  }

  showToast(`⚡ ${updatedAssets.length} ativos atualizados com sucesso via IA!`, 'success');
}


