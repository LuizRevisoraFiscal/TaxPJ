
import { Transaction, TaxCalculation, AssetType, PJRegime } from '../types';
import { LAW_REFERENCES } from '../constants';

export const calculateTax = (tx: Transaction, regime: PJRegime): TaxCalculation => {
  // Base de cálculo é o RENDIMENTO BRUTO (Renda Total no extrato Bradesco)
  const rendimentoBruto = tx.yield || 0;
  
  // IRRF já retido pelo banco no ato do resgate
  const irrfRetidoNoExtrato = tx.irrfRetained || 0;
  
  // 1. Calculamos o IRPJ de 15%
  const irpjBruto = rendimentoBruto * 0.15;
  
  // 2. Calculamos a CSLL de 9%
  const csllDevida = rendimentoBruto * 0.09;

  // 3. Abatemos o IRRF do IRPJ de 15% (Lógica solicitada)
  // O saldo do IRPJ a pagar não pode ser negativo por operação na guia, mas vira crédito acumulado.
  const irpjAposDeducao = Math.max(0, irpjBruto - irrfRetidoNoExtrato);

  // 4. Adicional de IRPJ (se houver, simplificado)
  const adicionalIRPJ = rendimentoBruto > 20000 ? (rendimentoBruto - 20000) * 0.10 : 0;

  // Saldo total a recolher na guia DARF para esta operação
  const saldoLiquidoARecolher = irpjAposDeducao + adicionalIRPJ + csllDevida;

  return {
    transactionId: tx.id,
    grossYield: rendimentoBruto,
    irrfRate: 0, 
    irrfAmount: irrfRetidoNoExtrato,
    irpjBase: irpjBruto, // Mantemos o bruto para exibição
    irpjSurcharge: adicionalIRPJ,
    csllAmount: csllDevida,
    netToPay: saldoLiquidoARecolher,
    lawReference: LAW_REFERENCES.RENDA_FIXA
  };
};

export const generateDominioExport = (transactions: Transaction[], calculations: TaxCalculation[]): string => {
  let csv = 'Data;Historico;Rendimento_Bruto;IRRF_Extrato;IRPJ_15;CSLL_9;DARF_Final\n';
  transactions.forEach((tx, idx) => {
    const calc = calculations[idx];
    if (calc) {
      const formattedDate = `${tx.date.substring(6,8)}/${tx.date.substring(4,6)}/${tx.date.substring(0,4)}`;
      csv += `${formattedDate};${tx.description};${calc.grossYield.toFixed(2)};${calc.irrfAmount.toFixed(2)};${calc.irpjBase.toFixed(2)};${calc.csllAmount.toFixed(2)};${calc.netToPay.toFixed(2)}\n`;
    }
  });
  return csv;
};
