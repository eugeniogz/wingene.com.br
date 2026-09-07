/**
 * ==========================================================================
 * WINVEST — INVEST CONFIG (Configurações e Parâmetros Centrais)
 * ==========================================================================
 * Centraliza pesos, faixas de corte de indicadores e premissas padrão.
 * Evita números mágicos espalhados pelo código e permite customização.
 */

const DEFAULT_ANALYSIS_CONFIG = {
  // 1. Pesos do Quality Score (Soma = 1.00 ou 100%)
  qualityWeights: {
    rentabilidade: 0.20,
    crescimento: 0.15,
    caixa: 0.20,
    endividamento: 0.15,
    margens: 0.10,
    vantagemCompetitiva: 0.10,
    governanca: 0.10
  },

  // 2. Pesos do Valuation Score
  valuationWeights: {
    dcf: 0.60,
    multiples: 0.40
  },

  // 3. Pesos do Investment Score Final
  investmentWeights: {
    quality: 0.40,
    valuation: 0.40,
    thesis: 0.20
  },

  // 4. Faixas de Corte para Notas Fundamentais (0 a 10)
  qualityThresholds: {
    // ROIC (% a.a.)
    roic: [
      { max: 5, score: 2 },
      { max: 10, score: 4 },
      { max: 15, score: 6 },
      { max: 20, score: 8 },
      { min: 20, score: 10 }
    ],

    // ROE (% a.a.)
    roe: [
      { max: 8, score: 2 },
      { max: 14, score: 5 },
      { max: 20, score: 8 },
      { min: 20, score: 10 }
    ],

    // Crescimento de Receita / Lucro (% a.a.)
    growth: [
      { max: 0, score: 2 },
      { max: 5, score: 4 },
      { max: 10, score: 6 },
      { max: 15, score: 8 },
      { min: 15, score: 10 }
    ],

    // Crescimento do FCF (% a.a.)
    fcfGrowth: [
      { max: 0, score: 2 },
      { max: 5, score: 4 },
      { max: 10, score: 6 },
      { max: 15, score: 8 },
      { min: 15, score: 10 }
    ],

    // Dívida Líquida / EBITDA (quanto menor, melhor)
    netDebtEbitda: [
      { max: 0, score: 10 },    // Caixa líquido
      { max: 1.5, score: 9 },
      { max: 2.5, score: 7 },
      { max: 3.5, score: 4 },
      { min: 3.5, score: 2 }
    ],

    // Cobertura de Juros (EBIT / Despesa Financeira)
    interestCoverage: [
      { max: 1.5, score: 2 },
      { max: 3.0, score: 5 },
      { max: 6.0, score: 8 },
      { min: 6.0, score: 10 }
    ],

    // Margem Líquida (%)
    netMargin: [
      { max: 3, score: 2 },
      { max: 8, score: 5 },
      { max: 15, score: 8 },
      { min: 15, score: 10 }
    ],

    // Margem EBITDA (%)
    ebitdaMargin: [
      { max: 8, score: 2 },
      { max: 15, score: 5 },
      { max: 25, score: 8 },
      { min: 25, score: 10 }
    ]
  },

  // 5. Faixas de Classificação do Investment Score
  investmentBands: [
    { min: 80, label: "Muito interessante", badgeClass: "badge-success", color: "#10b981" },
    { min: 65, label: "Interessante", badgeClass: "badge-info", color: "#34d399" },
    { min: 50, label: "Neutro", badgeClass: "badge-warning", color: "#f59e0b" },
    { min: 35, label: "Pouco interessante", badgeClass: "badge-secondary", color: "#fb923c" },
    { min: 0,  label: "Desfavorável", badgeClass: "badge-danger", color: "#ef4444" }
  ],

  // 6. Premissas Padrão para Cenários DCF
  dcfDefaults: {
    projectionYears: 5,
    conservative: { growthRate: 6.0, discountRate: 12.5, terminalGrowth: 3.5 },
    base:         { growthRate: 10.0, discountRate: 11.5, terminalGrowth: 4.0 },
    optimistic:   { growthRate: 14.0, discountRate: 10.5, terminalGrowth: 4.5 }
  }
};

/**
 * Retorna a configuração de análise ativa (mesclando appState com defaults).
 */
function getAnalysisConfig() {
  if (typeof appState !== 'undefined' && appState && appState.analysisConfig) {
    return {
      ...DEFAULT_ANALYSIS_CONFIG,
      ...appState.analysisConfig,
      qualityWeights: { ...DEFAULT_ANALYSIS_CONFIG.qualityWeights, ...(appState.analysisConfig.qualityWeights || {}) },
      valuationWeights: { ...DEFAULT_ANALYSIS_CONFIG.valuationWeights, ...(appState.analysisConfig.valuationWeights || {}) },
      investmentWeights: { ...DEFAULT_ANALYSIS_CONFIG.investmentWeights, ...(appState.analysisConfig.investmentWeights || {}) },
      qualityThresholds: { ...DEFAULT_ANALYSIS_CONFIG.qualityThresholds, ...(appState.analysisConfig.qualityThresholds || {}) }
    };
  }
  return DEFAULT_ANALYSIS_CONFIG;
}

/**
 * Preenche os campos do formulário de configurações com a configuração ativa
 */
function populateAnalysisConfigForm() {
  const cfg = getAnalysisConfig();
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  // Quality Weights
  setVal('cfgWeightRentab', (cfg.qualityWeights.rentabilidade * 100).toFixed(0));
  setVal('cfgWeightCresc', (cfg.qualityWeights.crescimento * 100).toFixed(0));
  setVal('cfgWeightCaixa', (cfg.qualityWeights.caixa * 100).toFixed(0));
  setVal('cfgWeightDivida', (cfg.qualityWeights.endividamento * 100).toFixed(0));
  setVal('cfgWeightMargens', (cfg.qualityWeights.margens * 100).toFixed(0));
  setVal('cfgWeightMoat', (cfg.qualityWeights.vantagemCompetitiva * 100).toFixed(0));
  setVal('cfgWeightGov', (cfg.qualityWeights.governanca * 100).toFixed(0));

  // Valuation Weights
  setVal('cfgWeightDcf', (cfg.valuationWeights.dcf * 100).toFixed(0));
  setVal('cfgWeightMultiplos', (cfg.valuationWeights.multiples * 100).toFixed(0));

  // Investment Score Weights
  setVal('cfgWeightInvQuality', (cfg.investmentWeights.quality * 100).toFixed(0));
  setVal('cfgWeightInvValuation', (cfg.investmentWeights.valuation * 100).toFixed(0));
  setVal('cfgWeightInvThesis', (cfg.investmentWeights.thesis * 100).toFixed(0));
}

/**
 * Salva os novos pesos informados na interface
 */
function handleSaveAnalysisConfigSubmit(e) {
  if (e) e.preventDefault();
  if (typeof appState === 'undefined' || !appState) return;

  const parseWeight = (id) => {
    const el = document.getElementById(id);
    const num = el ? parseFloat(el.value) : NaN;
    return isNaN(num) ? 0 : num / 100;
  };

  appState.analysisConfig = appState.analysisConfig || {};

  appState.analysisConfig.qualityWeights = {
    rentabilidade: parseWeight('cfgWeightRentab') || 0.20,
    crescimento: parseWeight('cfgWeightCresc') || 0.15,
    caixa: parseWeight('cfgWeightCaixa') || 0.20,
    endividamento: parseWeight('cfgWeightDivida') || 0.15,
    margens: parseWeight('cfgWeightMargens') || 0.10,
    vantagemCompetitiva: parseWeight('cfgWeightMoat') || 0.10,
    governanca: parseWeight('cfgWeightGov') || 0.10
  };

  appState.analysisConfig.valuationWeights = {
    dcf: parseWeight('cfgWeightDcf') || 0.60,
    multiples: parseWeight('cfgWeightMultiplos') || 0.40
  };

  appState.analysisConfig.investmentWeights = {
    quality: parseWeight('cfgWeightInvQuality') || 0.40,
    valuation: parseWeight('cfgWeightInvValuation') || 0.40,
    thesis: parseWeight('cfgWeightInvThesis') || 0.20
  };

  saveLocalState(true, true);
  if (typeof renderApp === 'function') renderApp();
  showToast('Configurações e pesos de análise salvos com sucesso!', 'success');
}

/**
 * Restaura pesos para os padrões do sistema
 */
function resetAnalysisConfigDefaults() {
  if (typeof appState === 'undefined' || !appState) return;
  appState.analysisConfig = JSON.parse(JSON.stringify(DEFAULT_ANALYSIS_CONFIG));
  saveLocalState(true, true);
  populateAnalysisConfigForm();
  if (typeof renderApp === 'function') renderApp();
  showToast('Pesos restaurados para os padrões!', 'info');
}
