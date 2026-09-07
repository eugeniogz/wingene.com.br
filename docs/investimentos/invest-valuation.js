/**
 * ==========================================================================
 * WINVEST — INVEST VALUATION (Módulo de Valuation & DCF)
 * ==========================================================================
 * 1. Múltiplos históricos e comparáveis (P/L, EV/EBITDA, P/FCF, DY, P/VP).
 * 2. Fluxo de Caixa Descontado (DCF) simplificado em 3 cenários (Conservador, Base, Otimista).
 * 3. Cálculo da Margem de Segurança e Valuation Score (0 a 100).
 * 4. Transparência: todas as premissas e cálculos intermediários são expostos.
 */

/**
 * Executa o cálculo matemático padrão do DCF para um cenário específico.
 */
function calculateDCFScenario(params) {
  const fcf0 = parseFloat(params.fcfCurrent);
  const g = parseFloat(params.growthRate) / 100;
  const n = parseInt(params.projectionYears || 5, 10);
  const r = parseFloat(params.discountRate) / 100;
  const gt = parseFloat(params.terminalGrowth) / 100;
  const netDebt = parseFloat(params.netDebt) || 0;
  const shares = parseFloat(params.sharesOutstanding);

  if (isNaN(fcf0) || fcf0 <= 0 || isNaN(shares) || shares <= 0 || isNaN(r) || r <= 0) {
    return {
      isValid: false,
      message: 'Premissas insuficientes para o DCF (FCF atual ou total de ações não informados).',
      projectedFcfs: [],
      pvFcfs: 0,
      terminalValue: 0,
      pvTerminalValue: 0,
      enterpriseValue: 0,
      equityValue: 0,
      intrinsicValue: null
    };
  }

  // A taxa de desconto (WACC) deve ser maior que o crescimento terminal (g_t)
  if (r <= gt) {
    return {
      isValid: false,
      message: 'A taxa de desconto precisa ser estritamente maior que o crescimento na perpetuidade.',
      projectedFcfs: [],
      pvFcfs: 0,
      terminalValue: 0,
      pvTerminalValue: 0,
      enterpriseValue: 0,
      equityValue: 0,
      intrinsicValue: null
    };
  }

  // 1. Projeção dos FCFs e Valor Presente de cada ano
  const projectedFcfs = [];
  let sumPvFcfs = 0;
  let currentFcf = fcf0;

  for (let t = 1; t <= n; t++) {
    currentFcf = currentFcf * (1 + g);
    const pv = currentFcf / Math.pow(1 + r, t);
    sumPvFcfs += pv;
    projectedFcfs.push({
      year: t,
      fcf: currentFcf,
      pv: pv
    });
  }

  // 2. Valor Terminal (Fórmula de Gordon na perpetuidade)
  // TV_n = FCF_n * (1 + g_t) / (r - g_t)
  const fcfTerminal = currentFcf * (1 + gt);
  const terminalValue = fcfTerminal / (r - gt);

  // 3. Valor Presente do Valor Terminal
  const pvTerminalValue = terminalValue / Math.pow(1 + r, n);

  // 4. Enterprise Value & Equity Value
  const enterpriseValue = sumPvFcfs + pvTerminalValue;
  const equityValue = enterpriseValue - netDebt;

  // 5. Valor Intrínseco por ação
  const intrinsicValue = equityValue > 0 ? equityValue / shares : 0;

  return {
    isValid: true,
    growthRate: params.growthRate,
    discountRate: params.discountRate,
    terminalGrowth: params.terminalGrowth,
    projectedFcfs,
    pvFcfs: sumPvFcfs,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
    equityValue,
    intrinsicValue: parseFloat(intrinsicValue.toFixed(2))
  };
}

/**
 * Calcula os 3 cenários de DCF (Conservador, Base e Otimista) e a Margem de Segurança.
 */
function calculateDCFScenarios(asset, currentPrice, activeConfig) {
  const config = activeConfig || getAnalysisConfig();
  const dcfConfig = config.dcfDefaults || {};

  const f = (asset && asset.fundamentals) || {};
  const v = (asset && asset.valuation && asset.valuation.dcf) || {};
  const scenariosPremises = v.scenarios || {};

  const fcfCurrent = v.fcfCurrent !== null && v.fcfCurrent !== undefined ? v.fcfCurrent : f.freeCashFlow;
  const netDebt = v.netDebt !== null && v.netDebt !== undefined ? v.netDebt : f.netDebt;
  const shares = v.sharesOutstanding !== null && v.sharesOutstanding !== undefined ? v.sharesOutstanding : f.sharesOutstanding;
  const projectionYears = v.projectionYears || dcfConfig.projectionYears || 5;

  const getScenarioParams = (name) => {
    const userScen = scenariosPremises[name] || {};
    const defaultScen = dcfConfig[name] || {};
    return {
      fcfCurrent,
      netDebt,
      sharesOutstanding: shares,
      projectionYears,
      growthRate: userScen.growthRate !== undefined ? userScen.growthRate : defaultScen.growthRate,
      discountRate: userScen.discountRate !== undefined ? userScen.discountRate : defaultScen.discountRate,
      terminalGrowth: userScen.terminalGrowth !== undefined ? userScen.terminalGrowth : defaultScen.terminalGrowth
    };
  };

  const conservative = calculateDCFScenario(getScenarioParams('conservative'));
  const base = calculateDCFScenario(getScenarioParams('base'));
  const optimistic = calculateDCFScenario(getScenarioParams('optimistic'));

  let marginOfSafety = null;
  const price = parseFloat(currentPrice || (asset && (asset.precoAtual || asset.preco)));

  if (base.isValid && base.intrinsicValue > 0 && !isNaN(price) && price > 0) {
    marginOfSafety = parseFloat((((base.intrinsicValue - price) / base.intrinsicValue) * 100).toFixed(1));
  }

  return {
    isAvailable: base.isValid,
    projectionYears,
    fcfCurrent,
    netDebt,
    sharesOutstanding: shares,
    currentPrice: price,
    marginOfSafety, // Positivo = com desconto / margem; Negativo = sobrepreço
    scenarios: {
      conservative,
      base,
      optimistic
    },
    disclaimer: 'Estimativa baseada nas premissas informadas.'
  };
}

/**
 * Análise de Múltiplos Comparáveis e Históricos.
 * Calcula desconto ou prêmio relativo vs referência ou média.
 */
function calculateMultiplesAnalysis(asset, currentPrice) {
  const v = (asset && asset.valuation && asset.valuation.multiples) || {};
  const f = (asset && asset.fundamentals) || {};

  // Inferir múltiplos atuais se não informados manualmente
  const price = parseFloat(currentPrice || (asset && (asset.precoAtual || asset.preco)));
  const shares = parseFloat(f.sharesOutstanding);
  const netIncome = parseFloat(f.netIncome);
  const ebitda = parseFloat(f.ebitda);
  const fcf = parseFloat(f.freeCashFlow);
  const netDebt = parseFloat(f.netDebt) || 0;

  let currentPe = v.pe;
  if ((currentPe === null || currentPe === undefined) && !isNaN(price) && !isNaN(shares) && !isNaN(netIncome) && netIncome > 0 && shares > 0) {
    const lpa = netIncome / shares;
    currentPe = parseFloat((price / lpa).toFixed(1));
  }

  let currentEvEbitda = v.evEbitda;
  if ((currentEvEbitda === null || currentEvEbitda === undefined) && !isNaN(price) && !isNaN(shares) && !isNaN(ebitda) && ebitda > 0 && shares > 0) {
    const mktCap = price * shares;
    const ev = mktCap + netDebt;
    currentEvEbitda = parseFloat((ev / ebitda).toFixed(1));
  }

  let currentPFcf = v.pFcf;
  if ((currentPFcf === null || currentPFcf === undefined) && !isNaN(price) && !isNaN(shares) && !isNaN(fcf) && fcf > 0 && shares > 0) {
    const mktCap = price * shares;
    currentPFcf = parseFloat((mktCap / fcf).toFixed(1));
  }

  const currentDy = v.dividendYield !== null && v.dividendYield !== undefined ? v.dividendYield : f.dividendYield;

  const compareMultiple = (current, reference, historical) => {
    const ref = reference !== null && reference !== undefined ? reference : historical;
    if (current === null || current === undefined || isNaN(current) || ref === null || ref === undefined || isNaN(ref) || ref <= 0) {
      return { current, reference: ref, discountPct: null, status: 'ND' };
    }
    // Desconto relativo: se o múltiplo atual for menor que a referência, está com desconto (positivo)
    const discountPct = parseFloat((((ref - current) / ref) * 100).toFixed(1));
    return {
      current,
      reference: ref,
      discountPct,
      status: discountPct > 5 ? 'DISCOUNT' : (discountPct < -5 ? 'PREMIUM' : 'FAIR')
    };
  };

  return {
    pe: compareMultiple(currentPe, v.peReference, v.peHistoricalAvg),
    evEbitda: compareMultiple(currentEvEbitda, v.evEbitdaReference, v.evEbitdaHistoricalAvg),
    pFcf: compareMultiple(currentPFcf, v.pFcfReference, null),
    pvp: compareMultiple(v.pvp, v.pvpReference, null),
    dividendYield: {
      current: currentDy !== null && currentDy !== undefined ? currentDy : null,
      reference: v.dividendYieldReference || null
    }
  };
}

/**
 * Converte Margem de Segurança em pontuação 0 a 100.
 */
function scoreMarginOfSafety(margin) {
  if (margin === null || margin === undefined || isNaN(margin)) return null;
  // Margem >= 40% -> 100 pontos
  // Margem 0% (preço justo base) -> 50 pontos
  // Margem <= -40% -> 0 pontos
  const clamped = Math.max(-50, Math.min(50, margin));
  // Mapeia [-50, 50] para [0, 100]
  return Math.round(((clamped + 50) / 100) * 100);
}

/**
 * Converte descontos médios dos múltiplos em pontuação 0 a 100.
 */
function scoreMultiplesDiscounts(multiplesAnalysis) {
  const discounts = [];
  ['pe', 'evEbitda', 'pFcf', 'pvp'].forEach(key => {
    const item = multiplesAnalysis[key];
    if (item && item.discountPct !== null && !isNaN(item.discountPct)) {
      discounts.push(item.discountPct);
    }
  });

  if (discounts.length === 0) return null;
  const avgDiscount = discounts.reduce((acc, v) => acc + v, 0) / discounts.length;
  // Desconto de +30% -> 100; 0% -> 50; -30% -> 0
  const clamped = Math.max(-30, Math.min(30, avgDiscount));
  return Math.round(((clamped + 30) / 60) * 100);
}

/**
 * CÁLCULO GERAL DO VALUATION SCORE (0 a 100)
 */
function calculateValuationScore(asset, currentPrice, activeConfig) {
  const config = activeConfig || getAnalysisConfig();
  const weights = config.valuationWeights || { dcf: 0.60, multiples: 0.40 };

  const dcfResult = calculateDCFScenarios(asset, currentPrice, config);
  const multiplesResult = calculateMultiplesAnalysis(asset, currentPrice);

  const scoreDcf = scoreMarginOfSafety(dcfResult.marginOfSafety);
  const scoreMultiples = scoreMultiplesDiscounts(multiplesResult);

  let sumWeighted = 0;
  let sumWeights = 0;

  if (scoreDcf !== null) {
    sumWeighted += scoreDcf * weights.dcf;
    sumWeights += weights.dcf;
  }
  if (scoreMultiples !== null) {
    sumWeighted += scoreMultiples * weights.multiples;
    sumWeights += weights.multiples;
  }

  if (sumWeights === 0) {
    return {
      score: null,
      confidence: 0,
      label: 'N/D',
      dcf: dcfResult,
      multiples: multiplesResult,
      message: 'Não há dados suficientes de DCF ou Múltiplos para estimar o Valuation Score.'
    };
  }

  const finalScore = Math.round(sumWeighted / sumWeights);
  const confidence = Math.round(sumWeights * 100);

  return {
    score: finalScore,
    confidence,
    label: `${finalScore}/100`,
    dcf: dcfResult,
    multiples: multiplesResult
  };
}
