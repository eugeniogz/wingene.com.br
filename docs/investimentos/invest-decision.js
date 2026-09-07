/**
 * ==========================================================================
 * WINVEST — INVEST DECISION (Investment Score, Prioridade de Aporte & Alertas)
 * ==========================================================================
 * 1. Investment Score ponderado (Qualidade, Valuation, Tese) sem recomendação automática.
 * 2. Prioridade de Aporte fundamentada:
 *    - Posições acima da meta NUNCA são priorizadas.
 *    - Posições abaixo da meta com valuation muito esticado são penalizadas.
 * 3. Tabela de Rebalanceamento Inteligente ordenada por prioridade de aporte.
 * 4. Alertas informativos transparentes.
 */

/**
 * Calcula o Investment Score final (0 a 100).
 */
function calculateInvestmentScore(qualityScore, valuationScore, thesisScore, activeConfig) {
  const config = activeConfig || getAnalysisConfig();
  const weights = config.investmentWeights || { quality: 0.40, valuation: 0.40, thesis: 0.20 };
  const bands = config.investmentBands || DEFAULT_ANALYSIS_CONFIG.investmentBands;

  let sumWeighted = 0;
  let sumWeights = 0;

  if (qualityScore !== null && qualityScore !== undefined && !isNaN(qualityScore)) {
    sumWeighted += qualityScore * weights.quality;
    sumWeights += weights.quality;
  }
  if (valuationScore !== null && valuationScore !== undefined && !isNaN(valuationScore)) {
    sumWeighted += valuationScore * weights.valuation;
    sumWeights += weights.valuation;
  }
  if (thesisScore !== null && thesisScore !== undefined && !isNaN(thesisScore)) {
    sumWeighted += thesisScore * weights.thesis;
    sumWeights += weights.thesis;
  }

  if (sumWeights === 0) {
    return {
      score: null,
      confidence: 0,
      label: 'N/D',
      classification: 'Sem Dados',
      badgeClass: 'badge-secondary',
      color: '#94a3b8'
    };
  }

  const finalScore = Math.round(sumWeighted / sumWeights);
  const confidence = Math.round(sumWeights * 100);

  let band = bands[bands.length - 1];
  for (const b of bands) {
    if (finalScore >= b.min) {
      band = b;
      break;
    }
  }

  return {
    score: finalScore,
    confidence,
    label: `${finalScore}/100`,
    classification: band.label,
    badgeClass: band.badgeClass,
    color: band.color
  };
}

/**
 * Calcula a Prioridade de Aporte de forma transparente e documentada.
 * 
 * Fórmula:
 * allocationPriority = investmentScore * fatorDeDistanciaDaMeta * fatorDeValuation
 * 
 * Regras cruciais:
 * 1. Meta zerada -> Sem prioridade (0).
 * 2. Ativo no alvo ou acima da meta (allocationGap <= 0) -> Fator de distância = 0 (ACIMA DA META).
 * 3. Ativo abaixo da meta com valuation muito caro -> Fator de valuation é reduzido drasticamente.
 */
function calculateAllocationPriority(asset, finItem, activeConfig) {
  const qRes = calculateQualityScore(asset, activeConfig);
  const price = parseFloat(finItem.precoAtual || asset.preco);
  const vRes = calculateValuationScore(asset, price, activeConfig);
  const tRes = evaluateAssetThesis(asset);

  const invScoreRes = calculateInvestmentScore(qRes.score, vRes.score, tRes.thesisScore, activeConfig);
  const invScore = invScoreRes.score !== null ? invScoreRes.score : 50; // neutro se sem scores

  const meta = parseFloat(finItem.meta) || 0;
  const pctAtual = parseFloat(finItem.percentualAtual) || 0;
  const allocationGap = parseFloat((meta - pctAtual).toFixed(2)); // Positivo = abaixo da meta

  // 1. Meta 0%
  if (meta === 0) {
    return {
      priorityScore: 0,
      priorityLevel: 'META ZERO',
      priorityBadge: 'badge-secondary',
      badgeColor: '#64748b',
      allocationGap,
      fatorDistancia: 0,
      fatorValuation: 1.0,
      investmentScore: invScoreRes,
      qualityScore: qRes,
      valuationScore: vRes,
      thesisResult: tRes,
      explanation: 'Ativo com meta de alocação zerada (0%).'
    };
  }

  // 2. Acima da meta ou no equilíbrio (gap <= 0)
  // REGRA: Uma ação excelente que já esteja acima da meta NÃO deve receber prioridade de aporte.
  if (allocationGap <= 0) {
    return {
      priorityScore: 0,
      priorityLevel: 'ACIMA DA META',
      priorityBadge: 'badge-warning',
      badgeColor: '#f59e0b',
      allocationGap,
      fatorDistancia: 0,
      fatorValuation: 1.0,
      investmentScore: invScoreRes,
      qualityScore: qRes,
      valuationScore: vRes,
      thesisResult: tRes,
      explanation: `Posição ${Math.abs(allocationGap).toFixed(1)} p.p. acima da meta. Rebalanceamento não recomenda novos aportes no momento.`
    };
  }

  // 3. Abaixo da meta (gap > 0)
  // Fator de distância: curvas proporcionais (ex: 5 p.p. abaixo -> fator 1.0; 10 p.p. abaixo -> fator 1.8)
  const fatorDistancia = Math.min(2.5, Math.max(0.2, allocationGap / 5.0));

  // Fator de Valuation:
  // REGRA: Ação abaixo da meta, mas com valuation muito ruim, NÃO deve ser automaticamente priorizada.
  let fatorValuation = 1.0;
  if (vRes.score !== null) {
    if (vRes.score >= 75) {
      fatorValuation = 1.35; // Valuation muito atrativo -> acelera aporte
    } else if (vRes.score >= 55) {
      fatorValuation = 1.10; // Valuation razoável
    } else if (vRes.score >= 35) {
      fatorValuation = 0.75; // Valuation levemente esticado -> modera aporte
    } else {
      fatorValuation = 0.40; // Valuation muito esticado -> penaliza severamente a prioridade
    }
  }

  // Índice numérico de prioridade
  const priorityScore = Math.round(invScore * fatorDistancia * fatorValuation);

  let priorityLevel = 'MÉDIA';
  let priorityBadge = 'badge-info';
  let badgeColor = '#3b82f6';

  if (priorityScore >= 120) {
    priorityLevel = 'MUITO ALTA';
    priorityBadge = 'badge-success';
    badgeColor = '#10b981';
  } else if (priorityScore >= 80) {
    priorityLevel = 'ALTA';
    priorityBadge = 'badge-success';
    badgeColor = '#34d399';
  } else if (priorityScore >= 45) {
    priorityLevel = 'MÉDIA';
    priorityBadge = 'badge-info';
    badgeColor = '#60a5fa';
  } else {
    priorityLevel = 'BAIXA';
    priorityBadge = 'badge-secondary';
    badgeColor = '#fb923c';
  }

  return {
    priorityScore,
    priorityLevel,
    priorityBadge,
    badgeColor,
    allocationGap,
    fatorDistancia: parseFloat(fatorDistancia.toFixed(2)),
    fatorValuation: parseFloat(fatorValuation.toFixed(2)),
    investmentScore: invScoreRes,
    qualityScore: qRes,
    valuationScore: vRes,
    thesisResult: tRes,
    explanation: `Abaixo da meta em ${allocationGap.toFixed(1)} p.p. Prioridade ajustada por atratividade e valuation.`
  };
}

/**
 * Constrói a lista enriquecida de rebalanceamento ordenada por prioridade de aporte.
 */
function buildRebalancingDecisionList(fin, activeConfig) {
  if (!fin || !Array.isArray(fin.acoes) || fin.acoes.length === 0) {
    return [];
  }

  const list = fin.acoes.map(finItem => {
    // Buscar o ativo original correspondente em appState para obter fundamentos e tese
    const originalAsset = (typeof appState !== 'undefined' && appState.acoes)
      ? appState.acoes.find(a => String(a.id) === String(finItem.id) || a.ticker === finItem.ticker)
      : finItem;

    const decision = calculateAllocationPriority(originalAsset, finItem, activeConfig);

    return {
      ...finItem,
      originalAsset,
      decision
    };
  });

  // Ordenar por prioridade de aporte decrescente
  list.sort((a, b) => b.decision.priorityScore - a.decision.priorityScore);

  return list;
}

/**
 * Gera alertas informativos e objetivos sobre os ativos da carteira.
 */
function generateInvestmentAlerts(fin, activeConfig) {
  const alerts = [];
  if (!fin || !Array.isArray(fin.acoes)) return alerts;

  fin.acoes.forEach(finItem => {
    const originalAsset = (typeof appState !== 'undefined' && appState.acoes)
      ? appState.acoes.find(a => String(a.id) === String(finItem.id) || a.ticker === finItem.ticker)
      : finItem;

    const ticker = finItem.ticker;
    const meta = parseFloat(finItem.meta) || 0;
    const pctAtual = parseFloat(finItem.percentualAtual) || 0;
    const gap = parseFloat((meta - pctAtual).toFixed(1));

    // Alerta 1: Meta 0%
    if (meta === 0) {
      alerts.push({
        type: 'warning',
        icon: '⚪',
        ticker,
        title: `${ticker} possui meta de 0%`,
        description: 'O ativo está registrado na carteira mas não tem meta de alocação definida.'
      });
    }

    // Alerta 2: Desvio expressivo da meta
    if (gap >= 3.0) {
      alerts.push({
        type: 'info',
        icon: '🎯',
        ticker,
        title: `${ticker} está ${gap} p.p. abaixo da meta`,
        description: `Alocação atual de ${pctAtual.toFixed(1)}% vs. meta de ${meta.toFixed(1)}%.`
      });
    } else if (gap <= -3.0) {
      alerts.push({
        type: 'warning',
        icon: '⚠️',
        ticker,
        title: `${ticker} está ${Math.abs(gap)} p.p. acima da meta de alocação`,
        description: `Posição representativa de ${pctAtual.toFixed(1)}% vs. meta de ${meta.toFixed(1)}%. Não priorizar aportes.`
      });
    }

    // Alerta 3: Valuation e DCF
    const price = parseFloat(finItem.precoAtual || finItem.preco);
    const vRes = calculateValuationScore(originalAsset, price, activeConfig);
    if (vRes.dcf && vRes.dcf.isAvailable && vRes.dcf.marginOfSafety !== null) {
      if (vRes.dcf.marginOfSafety >= 25) {
        alerts.push({
          type: 'success',
          icon: '💎',
          ticker,
          title: `${ticker} apresenta valuation atrativo (Margem de Segurança: +${vRes.dcf.marginOfSafety}%)`,
          description: `Preço atual (${formatCurrency(price)}) abaixo da estimativa base de DCF (${formatCurrency(vRes.dcf.scenarios.base.intrinsicValue)}).`
        });
      } else if (vRes.dcf.marginOfSafety <= -30) {
        alerts.push({
          type: 'warning',
          icon: '🏷️',
          ticker,
          title: `${ticker} apresenta cotação acima do DCF base (${vRes.dcf.marginOfSafety}%)`,
          description: `Preço atual (${formatCurrency(price)}) acima da estimativa base (${formatCurrency(vRes.dcf.scenarios.base.intrinsicValue)}). Múltiplos esticados.`
        });
      }
    }

    // Alerta 4: Tese de Investimento ameaçada ou em atenção
    const tRes = evaluateAssetThesis(originalAsset);
    if (tRes.counts.threatened > 0) {
      alerts.push({
        type: 'danger',
        icon: '🔴',
        ticker,
        title: `${ticker}: Hipótese da tese ameaçada`,
        description: `${tRes.counts.threatened} hipótese(s) violaram os limites definidos na sua tese de investimento.`
      });
    } else if (tRes.counts.warning > 0) {
      alerts.push({
        type: 'warning',
        icon: '🟡',
        ticker,
        title: `${ticker}: Hipótese em zona de atenção`,
        description: `${tRes.counts.warning} hipótese(s) próximas do limite de tolerância da tese.`
      });
    }

    // Alerta 5: Dados antigos ou não atualizados
    const f = (originalAsset && originalAsset.fundamentals) || {};
    if (f.fundamentalsUpdatedAt) {
      const parts = f.fundamentalsUpdatedAt.split('-');
      if (parts.length === 3) {
        const updateDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const diffDays = Math.round((Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 150) {
          alerts.push({
            type: 'secondary',
            icon: '📅',
            ticker,
            title: `${ticker}: Dados fundamentais desatualizados (${diffDays} dias)`,
            description: `Última referência registrada: ${updateDate.toLocaleDateString('pt-BR')}. Recomenda-se revisar após nova divulgação de resultados.`
          });
        }
      }
    }
  });

  return alerts;
}
