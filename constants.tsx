
export const LAW_REFERENCES = {
  RENDA_FIXA: 'Lei nº 11.033/2004 - Tabela Regressiva',
  FUNDOS: 'Lei nº 14.754/2023 - Nova Lei de Fundos',
  RENDA_VARIAVEL: 'Lei nº 9.430/1996 - Ganhos Líquidos',
  IN_RFB: 'IN RFB nº 1.585/2015',
  JCP: 'MPV nº 1.303/2025 (Alíquota 20%)'
};

export const PJ_TAX_CONFIG = {
  LUCRO_PRESUMIDO: {
    IRPJ_BASE: 100, // Rendimentos financeiros entram 100% na base
    CSLL_BASE: 100
  },
  LUCRO_REAL: {
    TAX_TREATMENT: 'Adição ao lucro líquido para apuração do IRPJ/CSLL'
  }
};
