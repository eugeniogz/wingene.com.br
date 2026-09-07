/**
 * ==========================================================================
 * WINVEST — INVEST THESIS (Tese de Investimento & Hipóteses Verificáveis)
 * ==========================================================================
 * Gerencia a tese qualitativa e transforma premissas em hipóteses testáveis.
 * Avalia indicadores reais contra os limites estipulados na tese.
 * Semáforos: 🟢 Confirmada, 🟡 Atenção, 🔴 Tese ameaçada, ⚪ Dado não informado.
 */

const THESIS_METRIC_LABELS = {
  roic: { name: 'ROIC', unit: '%', isLowerBetter: false },
  roe: { name: 'ROE', unit: '%', isLowerBetter: false },
  revenueGrowth: { name: 'Crescimento de Receita', unit: '% a.a.', isLowerBetter: false },
  netIncomeGrowth: { name: 'Crescimento de Lucro', unit: '% a.a.', isLowerBetter: false },
  freeCashFlowGrowth: { name: 'Crescimento de FCF', unit: '% a.a.', isLowerBetter: false },
  ebitdaMargin: { name: 'Margem EBITDA', unit: '%', isLowerBetter: false },
  netMargin: { name: 'Margem Líquida', unit: '%', isLowerBetter: false },
  netDebtEbitda: { name: 'Dívida Líquida / EBITDA', unit: 'x', isLowerBetter: true },
  interestCoverage: { name: 'Cobertura de Juros', unit: 'x', isLowerBetter: false },
  dividendYield: { name: 'Dividend Yield', unit: '%', isLowerBetter: false }
};

/**
 * Avalia uma única hipótese da tese contra os fundamentos atuais do ativo.
 */
function evaluateSingleThesisCheck(check, fundamentals) {
  const metricKey = check.metric;
  const operator = check.operator || '>=';
  const threshold = parseFloat(check.threshold);
  const metricMeta = THESIS_METRIC_LABELS[metricKey] || { name: metricKey, unit: '', isLowerBetter: false };

  const rawVal = fundamentals ? fundamentals[metricKey] : null;

  if (rawVal === null || rawVal === undefined || isNaN(parseFloat(rawVal))) {
    return {
      ...check,
      metricName: metricMeta.name,
      currentValue: null,
      currentFormatted: 'N/D',
      thresholdFormatted: `${threshold}${metricMeta.unit}`,
      status: 'unknown',
      badgeClass: 'badge-secondary',
      icon: '⚪',
      label: 'Dado Ausente',
      detail: 'Métrica não informada nos fundamentos.'
    };
  }

  const currentVal = parseFloat(rawVal);
  const currentFormatted = `${currentVal.toFixed(1)}${metricMeta.unit}`;
  const thresholdFormatted = `${threshold}${metricMeta.unit}`;

  let isPassed = false;
  let isNear = false; // Margem de 15% para alerta amarelo

  switch (operator) {
    case '>=':
      isPassed = currentVal >= threshold;
      isNear = !isPassed && currentVal >= (threshold * 0.85);
      break;
    case '>':
      isPassed = currentVal > threshold;
      isNear = !isPassed && currentVal >= (threshold * 0.85);
      break;
    case '<=':
      isPassed = currentVal <= threshold;
      isNear = !isPassed && currentVal <= (threshold * 1.15);
      break;
    case '<':
      isPassed = currentVal < threshold;
      isNear = !isPassed && currentVal <= (threshold * 1.15);
      break;
    case '==':
      isPassed = Math.abs(currentVal - threshold) < 0.1;
      isNear = Math.abs(currentVal - threshold) < (threshold * 0.1);
      break;
    default:
      isPassed = currentVal >= threshold;
  }

  let status = 'threatened';
  let icon = '🔴';
  let label = 'Tese Ameaçada';
  let badgeClass = 'badge-danger';

  if (isPassed) {
    status = 'confirmed';
    icon = '🟢';
    label = 'Confirmada';
    badgeClass = 'badge-success';
  } else if (isNear) {
    status = 'warning';
    icon = '🟡';
    label = 'Atenção';
    badgeClass = 'badge-warning';
  }

  return {
    ...check,
    metricName: metricMeta.name,
    currentValue: currentVal,
    currentFormatted,
    thresholdFormatted,
    status,
    badgeClass,
    icon,
    label,
    detail: `Atual: ${currentFormatted} (Meta: ${operator} ${thresholdFormatted})`
  };
}

/**
 * Avalia todas as hipóteses da tese de um ativo.
 */
function evaluateAssetThesis(asset) {
  const t = (asset && asset.thesis) || {};
  const f = (asset && asset.fundamentals) || {};
  const checks = Array.isArray(t.checks) ? t.checks : [];

  const evaluatedChecks = checks.map(c => evaluateSingleThesisCheck(c, f));

  const counts = {
    confirmed: 0,
    warning: 0,
    threatened: 0,
    unknown: 0,
    total: evaluatedChecks.length
  };

  evaluatedChecks.forEach(c => {
    if (counts[c.status] !== undefined) counts[c.status]++;
  });

  const lastReviewDate = t.lastReview ? new Date(t.lastReview).toLocaleDateString('pt-BR') : 'Não informada';
  const dataDate = f.fundamentalsUpdatedAt ? new Date(f.fundamentalsUpdatedAt).toLocaleDateString('pt-BR') : 'Data não informada';

  // O thesisScore é explicitamente definido pelo usuário (não calculado por robô)
  let thesisScore = null;
  if (t.thesisScore !== null && t.thesisScore !== undefined && !isNaN(parseFloat(t.thesisScore))) {
    thesisScore = Math.max(0, Math.min(100, parseFloat(t.thesisScore)));
  }

  return {
    summary: t.summary || 'Resumo da tese não cadastrado.',
    reasons: Array.isArray(t.reasons) ? t.reasons : [],
    competitiveAdvantages: Array.isArray(t.competitiveAdvantages) ? t.competitiveAdvantages : [],
    expectations: Array.isArray(t.expectations) ? t.expectations : [],
    risks: Array.isArray(t.risks) ? t.risks : [],
    invalidationFactors: Array.isArray(t.invalidationFactors) ? t.invalidationFactors : [],
    horizonYears: t.horizonYears || 5,
    lastReviewDate,
    fundamentalsDate: dataDate,
    thesisScore, // 0 a 100 informado pelo usuário
    checks: evaluatedChecks,
    counts
  };
}
