
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, AssetType } from "../types";

/**
 * Serviço de extração de dados financeiros otimizado para extratos de Resumo Mensal e Movimentações.
 * Suporta layouts específicos de grandes bancos brasileiros (BB, Caixa, Bradesco).
 */
export const parseFinancialDocument = async (
  content: string, 
  mimeType: string = 'text/plain',
  isBase64: boolean = false,
  layoutHint: string = 'GENERIC_INVESTMENT'
): Promise<Transaction[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';
    
    const isGeneric = layoutHint === 'GENERIC_INVESTMENT';
    
    let specificContext = "";
    if (layoutHint === 'BANCO_DO_BRASIL_INVEST') {
      specificContext = `Layout: BANCO DO BRASIL - Extrato investimentos financeiros mensal.
      REGRAS ESPECÍFICAS BB:
      1. Localize a seção "Resumo do mês".
      2. Se "APLICAÇÕES (+)" > 0, crie transação APPLICATION.
      3. Se "RESGATES (-)" > 0, crie transação REDEMPTION.
      4. IMPORTANTE: Se não houver resgates mas houver "RENDIMENTO BRUTO (+)" maior que zero, crie uma transação do tipo REDEMPTION com o valor do rendimento bruto para fins de cálculo de tributação.
      5. Data: Use o último dia do "Mês/ano referência" (ex: DEZEMBRO/2025 vira 20251231).
      6. Campos: 'yield' é o "RENDIMENTO BRUTO (+)", 'irrfRetained' é o "IMPOSTO DE RENDA (-)", 'iof' é o campo "IOF (-)".
      7. No campo 'description', coloque o nome do fundo ou produto (ex: RF Ref DI Plus Ágil).`;
    }

    const systemInstruction = `Você é um perito contábil brasileiro especializado em extratos bancários.
    
    OBJETIVO: Extrair dados de aplicações e resgates financeiros para contabilidade de empresas (PJ).
    
    FASE 1: VALIDAÇÃO
    - Verifique se o documento é um extrato bancário ou de investimentos.
    
    FASE 2: EXTRAÇÃO
    - Retorne date (YYYYMMDD), description (NOME DO PRODUTO/APLICAÇÃO), amount (valor principal), yield (rendimento bruto), irrfRetained, iof, entryType (APPLICATION ou REDEMPTION).
    - No caso de resumos mensais sem resgates individuais, trate o rendimento do mês como uma transação de REDEMPTION para que o sistema calcule os impostos devidos sobre o ganho.

    Retorne APENAS o JSON conforme o schema.`;

    const prompt = `Analise este extrato do ${layoutHint}. ${specificContext}`;

    const parts: any[] = [{ text: prompt }];
    if (isBase64) {
      const safeMimeType = mimeType || (content.startsWith('JVBERi') ? 'application/pdf' : 'image/jpeg');
      parts.push({ inlineData: { data: content, mimeType: safeMimeType } });
    } else {
      parts.push({ text: content });
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidLayout: { type: Type.BOOLEAN },
            detectedBank: { type: Type.STRING },
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  yield: { type: Type.NUMBER },
                  irrfRetained: { type: Type.NUMBER },
                  iof: { type: Type.NUMBER },
                  entryType: { type: Type.STRING }
                },
                required: ["date", "amount", "entryType"]
              }
            }
          },
          required: ["isValidLayout", "transactions"]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) throw new Error("A IA não conseguiu ler os dados do arquivo.");

    const result = JSON.parse(textOutput.trim());
    
    if (result.isValidLayout === false && !isGeneric) {
      throw new Error(`Divergência: O arquivo enviado não parece ser do layout ${layoutHint}. Identificado como: ${result.detectedBank || 'Outro'}.`);
    }

    if (!result.transactions || result.transactions.length === 0) {
      throw new Error("Nenhum lançamento de rendimento ou movimentação encontrado neste extrato.");
    }
    
    return result.transactions.map((tx: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      importId: 'IMPORT_' + Date.now(),
      profileId: 'PENDING',
      sourceFileName: 'EXTRATO',
      date: tx.date || '',
      description: tx.description?.toUpperCase() || (tx.entryType === 'APPLICATION' ? 'APLICAÇÃO' : 'RESGATE/RENDIMENTO'),
      amount: Math.abs(Number(tx.amount)) || 0,
      yield: Math.abs(Number(tx.yield)) || 0,
      irrfRetained: Math.abs(Number(tx.irrfRetained)) || 0,
      iof: Math.abs(Number(tx.iof)) || 0,
      entryType: tx.entryType === 'APPLICATION' ? 'APPLICATION' : 'REDEMPTION',
      type: tx.entryType === 'APPLICATION' ? 'DEBIT' : 'CREDIT',
      assetType: AssetType.RENDA_FIXA,
      bankInfo: {
        bankName: layoutHint.replace(/_/g, ' '),
        account: '---'
      }
    }));
  } catch (e: any) {
    console.error("Gemini Parsing Error:", e);
    throw e;
  }
};
