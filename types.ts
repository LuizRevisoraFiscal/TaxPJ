
export enum PJRegime {
  LUCRO_REAL = 'LUCRO_REAL',
  LUCRO_PRESUMIDO = 'LUCRO_PRESUMIDO'
}

export enum AssetType {
  RENDA_FIXA = 'RENDA_FIXA',
  RENDA_VARIAVEL = 'RENDA_VARIAVEL',
  FUNDOS_INVESTIMENTO = 'FUNDOS_INVESTIMENTO',
  FII = 'FII',
  JCP = 'JCP'
}

export interface Transaction {
  id: string;
  importId: string;
  profileId: string; // Vínculo com o banco/perfil de configuração
  sourceFileName: string;
  date: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT'; 
  entryType: 'APPLICATION' | 'REDEMPTION';
  assetType: AssetType;
  yield?: number;
  irrfRetained?: number;
  iof?: number;
  bankInfo?: {
    bankName: string;
    account: string;
  };
}

export interface ImportRecord {
  id: string;
  fileName: string;
  timestamp: number;
  count: number;
  profileName: string;
}

export interface TaxCalculation {
  transactionId: string;
  grossYield: number;
  irrfRate: number;
  irrfAmount: number;
  irpjBase: number;
  irpjSurcharge: number;
  csllAmount: number;
  netToPay: number;
  lawReference: string;
}

export interface DashboardStats {
  totalInvested: number;
  totalYield: number;
  totalIRRF: number;
  totalIRPJ: number;
  totalCSLL: number;
  finalTaxBalance: number;
}
