/**
 * ==========================================================================
 * WINVEST — INVEST QUALITY (Motor de Cálculo do Quality Score)
 * ==========================================================================
 * Calcula notas de 0 a 10 para cada indicador com base em QUALITY_THRESHOLDS.
 * Agrega o Quality Score (0 a 100) respeitando dados ausentes e calculando confiança.
 * Separa claramente indicadores automáticos de avaliações manuais.
 */

/**
 * Avalia um valor numérico contra uma tabela de cortes configurável.
 * Retorna nota de 0 a 10 ou null se o dado for ausente/inválido.
 */
function scoreIndicatorByThreshold(value, thresholds) {
  if (value === null || value === undefined || isNaN(parseFloat(value))) {
    return null;
  }
  const val = parseFloat(value);
  if (!Array.isArray(thresholds) || thresholds.length === 0) {
    return null;
  }

  for (const t of thresholds) {
    if (t.max !== undefined && val <= t.max) {
      return t.score;
    }
    if (t.min !== undefined && val > t.min) {
      return t.score;
    }
  }

  // Fallback para último score
  return thresholds[thresholds.length - 1].score;
}

/**
 * 1. Rentabilidade: ROIC e ROE
 */
function scoreRoic(roic, thresholds) {
  return scoreIndicatorByThreshold(roic, thresholds.roic);
}

function scoreRoe(roe, thresholds) {
  return scoreIndicatorByThreshold(roe, thresholds.roe);
}

function scoreRentabilidade(fundamentals, thresholds) {
  if (!fundamentals) return null;
  const sRoic = scoreRoic(fundamentals.roic, thresholds);
  const sRoe = scoreRoe(fundamentals.roe, thresholds);

  if (sRoic !== null && sRoe !== null) {
    return (sRoic * 0.6) + (sRoe * 0.4);
  }
  if (sRoic !== null) return sRoic;
  if (sRoe !== null) return sRoe;
  return null;
}

/**
 * 2. Crescimento: Receita e Lucro
 */
function scoreCrescimento(fundamentals, thresholds) {
  if (!fundamentals) return null;
  const sRev = scoreIndicatorByThreshold(fundamentals.revenueGrowth, thresholds.growth);
  const sNetInc = scoreIndicatorByThreshold(fundamentals.netIncomeGrowth, thresholds.growth);

  if (sRev !== null && sNetInc !== null) {
    return (sRev * 0.5) + (sNetInc * 0.5);
  }
  if (sRev !== null) return sRev;
  if (sNetInc !== null) return sNetInc;
  return null;
}

/**
 * 3. Geração de Caixa: FCF Growth e consistência
 */
function scoreCaixa(fundamentals, thresholds) {
  if (!fundamentals) return null;
  const sFcfGrowth = scoreIndicatorByThreshold(fundamentals.freeCashFlowGrowth, thresholds.fcfGrowth);
  
  // Se houver FCF absoluto e Receita, checar Margem FCF (FCF / Receita)
  let sFcfMargin = null;
  const fcf = parseFloat(fundamentals.freeCashFlow);
  const rev = parseFloat(fundamentals.revenue);
  if (!isNaN(fcf) && !isNaN(rev) && rev > 0) {
    const fcfMarginPct = (fcf / rev) * 100;
    sFcfMargin = scoreIndicatorByThreshold(fcfMarginPct, thresholds.netMargin);
  }

  if (sFcfGrowth !== null && sFcfMargin !== null) {
    return (sFcfGrowth * 0.5) + (sFcfMargin * 0.5);
  }
  if (sFcfGrowth !== null) return sFcfGrowth;
  if (sFcfMargin !== null) return sFcfMargin;

  // Se tiver pelo menos FCF positivo informado
  if (!isNaN(fcf)) {
    return fcf > 0 ? 7 : 3;
  }
  return null;
}

/**
 * 4. Endividamento: Net Debt / EBITDA e Cobertura de Juros
 */
function scoreEndividamento(fundamentals, thresholds) {
  if (!fundamentals) return null;
  const sLeverage = scoreIndicatorByThreshold(fundamentals.netDebtEbitda, thresholds.netDebtEbitda);
  const sCoverage = scoreIndicatorByThreshold(fundamentals.interestCoverage, thresholds.interestCoverage);

  if (sLeverage !== null && sCoverage !== null) {
    return (sLeverage * 0.65) + (sCoverage * 0.35);
  }
  if (sLeverage !== null) return sLeverage;
  if (sCoverage !== null) return sCoverage;

  // Se dívida líquida for informada e for negativa (caixa líquido)
  const netDebt = parseFloat(fundamentals.netDebt);
  if (!isNaN(netDebt) && netDebt <= 0) {
    return 10;
  }
  return null;
}

/**
 * 5. Margens: Líquida e EBITDA
 */
function scoreMargens(fundamentals, thresholds) {
  if (!fundamentals) return null;
  const sNet = scoreIndicatorByThreshold(fundamentals.netMargin, thresholds.netMargin);
  const sEbitda = scoreIndicatorByThreshold(fundamentals.ebitdaMargin, thresholds.ebitdaMargin);

  if (sNet !== null && sEbitda !== null) {
    return (sNet * 0.5) + (sEbitda * 0.5);
  }
  if (sNet !== null) return sNet;
  if (sEbitda !== null) return sEbitda;
  return null;
}

/**
 * 6 & 7. Avaliações Qualitativas Manuais (0 a 10)
 */
function scoreQualitativoManual(value) {
  if (value === null || value === undefined || isNaN(parseFloat(value))) {
    return null;
  }
  const v = parseFloat(value);
  return Math.max(0, Math.min(10, v));
}

/**
 * CÁLCULO GERAL DO QUALITY SCORE (0 a 100)
 * 
 * Separa indicadores automáticos de manuais.
 * Nunca assume 0 para dados ausentes: reduz a confiança e normaliza pelos pesos presentes.
 */
function calculateQualityScore(asset, activeConfig) {
  const config = activeConfig || getAnalysisConfig();
  const weights = config.qualityWeights;
  const thresholds = config.qualityThresholds;

  const f = asset ? (asset.fundamentals || {}) : {};
  const q = asset ? (asset.qualitative || {}) : {};

  // FIIs não utilizam os mesmos critérios de ações convencionais
  if (asset && asset.tipo === 'FII') {
    return {
      score: null,
      confidence: 0,
      label: 'N/A (FII)',
      isFii: true,
      components: {},
      missingCount: 0,
      totalCount: 7,
      message: 'Indicadores de qualidade de empresas convencionais não são aplicados a FIIs.'
    };
  }

  // 7 Componentes estruturados
  const components = {
    rentabilidade: {
      label: 'Rentabilidade',
      weight: weights.rentabilidade,
      score: scoreRentabilidade(f, thresholds),
      isManual: false,
      details: {
        roic: f.roic !== undefined && f.roic !== null ? `${parseFloat(f.roic).toFixed(1)}%` : 'N/D',
        roe: f.roe !== undefined && f.roe !== null ? `${parseFloat(f.roe).toFixed(1)}%` : 'N/D'
      }
    },
    crescimento: {
      label: 'Crescimento',
      weight: weights.crescimento,
      score: scoreCrescimento(f, thresholds),
      isManual: false,
      details: {
        revenueGrowth: f.revenueGrowth !== undefined && f.revenueGrowth !== null ? `${parseFloat(f.revenueGrowth).toFixed(1)}%` : 'N/D',
        netIncomeGrowth: f.netIncomeGrowth !== undefined && f.netIncomeGrowth !== null ? `${parseFloat(f.netIncomeGrowth).toFixed(1)}%` : 'N/D'
      }
    },
    caixa: {
      label: 'Geração de Caixa',
      weight: weights.caixa,
      score: scoreCaixa(f, thresholds),
      isManual: false,
      details: {
        fcfGrowth: f.freeCashFlowGrowth !== undefined && f.freeCashFlowGrowth !== null ? `${parseFloat(f.freeCashFlowGrowth).toFixed(1)}%` : 'N/D',
        fcf: f.freeCashFlow !== undefined && f.freeCashFlow !== null ? formatCurrencyCompact(f.freeCashFlow) : 'N/D'
      }
    },
    endividamento: {
      label: 'Endividamento',
      weight: weights.endividamento,
      score: scoreEndividamento(f, thresholds),
      isManual: false,
      details: {
        netDebtEbitda: f.netDebtEbitda !== undefined && f.netDebtEbitda !== null ? `${parseFloat(f.netDebtEbitda).toFixed(2)}x` : 'N/D',
        interestCoverage: f.interestCoverage !== undefined && f.interestCoverage !== null ? `${parseFloat(f.interestCoverage).toFixed(1)}x` : 'N/D'
      }
    },
    margens: {
      label: 'Margens',
      weight: weights.margens,
      score: scoreMargens(f, thresholds),
      isManual: false,
      details: {
        netMargin: f.netMargin !== undefined && f.netMargin !== null ? `${parseFloat(f.netMargin).toFixed(1)}%` : 'N/D',
        ebitdaMargin: f.ebitdaMargin !== undefined && f.ebitdaMargin !== null ? `${parseFloat(f.ebitdaMargin).toFixed(1)}%` : 'N/D'
      }
    },
    vantagemCompetitiva: {
      label: 'Vantagem Competitiva (Moat)',
      weight: weights.vantagemCompetitiva,
      score: scoreQualitativoManual(q.competitiveAdvantageScore),
      isManual: true,
      details: {
        manualScore: q.competitiveAdvantageScore !== null && q.competitiveAdvantageScore !== undefined ? `${q.competitiveAdvantageScore}/10` : 'N/D'
      }
    },
    governanca: {
      label: 'Governança',
      weight: weights.governanca,
      score: scoreQualitativoManual(q.governanceScore),
      isManual: true,
      details: {
        manualScore: q.governanceScore !== null && q.governanceScore !== undefined ? `${q.governanceScore}/10` : 'N/D'
      }
    }
  };

  let sumWeightedScores = 0;
  let sumAvailableWeights = 0;
  let totalAvailableCount = 0;
  const missingComponents = [];

  for (const [key, comp] of Object.entries(components)) {
    if (comp.score !== null && comp.score !== undefined) {
      sumWeightedScores += comp.score * comp.weight;
      sumAvailableWeights += comp.weight;
      totalAvailableCount++;
      comp.available = true;
    } else {
      comp.available = false;
      missingComponents.push(comp.label);
    }
  }

  const confidence = Math.round(sumAvailableWeights * 100);

  // Se não houver dados suficientes
  if (sumAvailableWeights === 0) {
    return {
      score: null,
      confidence: 0,
      label: 'N/D',
      components,
      missingComponents,
      updatedAt: f.fundamentalsUpdatedAt || null,
      message: 'Dados fundamentais não informados para calcular o Quality Score.'
    };
  }

  // Normalização proporcional ao peso dos componentes com dados
  const normalizedScore0to10 = sumWeightedScores / sumAvailableWeights;
  const finalScore0to100 = Math.round(normalizedScore0to10 * 10);

  return {
    score: finalScore0to100,
    confidence, // 0 a 100% de confiança
    label: `${finalScore0to100}/100`,
    components,
    missingComponents,
    totalAvailableCount,
    totalCount: 7,
    updatedAt: f.fundamentalsUpdatedAt || null
  };
}

/**
 * Formatador compacto de moeda para exibir em badges e resumos (ex: R$ 4,2 B)
 */
function formatCurrencyCompact(val) {
  if (val === null || val === undefined || isNaN(parseFloat(val))) return 'N/D';
  const num = parseFloat(val);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e9) {
    return `${sign}R$ ${(abs / 1e9).toFixed(1).replace('.', ',')} B`;
  }
  if (abs >= 1e6) {
    return `${sign}R$ ${(abs / 1e6).toFixed(1).replace('.', ',')} M`;
  }
  if (abs >= 1e3) {
    return `${sign}R$ ${(abs / 1e3).toFixed(1).replace('.', ',')} mil`;
  }
  return `${sign}R$ ${abs.toFixed(2).replace('.', ',')}`;
}

/**
 * Exibe o indicador ou explica que está ausente
 */
function formatIndicatorDisplay(value, suffix = '', precision = 1) {
  if (value === null || value === undefined || isNaN(parseFloat(value))) {
    return { text: 'N/D', isMissing: true, tooltip: 'Dado não informado.' };
  }
  const formatted = parseFloat(value).toFixed(precision).replace('.', ',');
  return { text: `${formatted}${suffix}`, isMissing: false, tooltip: '' };
}
