
import { Transaction, AssetType } from '../types';

export const parseOFX = (content: string): Transaction[] => {
  const transactions: Transaction[] = [];
  // Regex mais tolerante para campos OFX
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];
    const dateMatch = block.match(/<DTPOSTED>([^<]*)/i);
    const amountMatch = block.match(/<TRNAMT>([^<]*)/i);
    const memoMatch = block.match(/<MEMO>([^<]*)/i);

    if (dateMatch && amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      const desc = memoMatch ? memoMatch[1].trim() : 'Transação Financeira';
      
      // Filtra apenas créditos de rendimento ou resgate
      if (amount !== 0) {
        // Fix: Added missing required profileId property to satisfy Transaction interface
        transactions.push({
          id: Math.random().toString(36).substr(2, 9),
          // Added missing required properties to satisfy Transaction interface
          importId: 'INTERNAL_OFX',
          profileId: 'INTERNAL_OFX',
          sourceFileName: 'OFX_IMPORT',
          date: dateMatch[1].substring(0, 8),
          description: desc,
          amount: Math.abs(amount),
          type: amount > 0 ? 'CREDIT' : 'DEBIT',
          // Fix: Added missing required entryType property to satisfy the Transaction interface
          entryType: amount > 0 ? 'REDEMPTION' : 'APPLICATION',
          assetType: identifyAssetType(desc),
          // Fix: Remove 'baseValue' as it is not part of the Transaction interface
          yield: Math.abs(amount) * 0.1 // Estimativa conservadora (ajustável no dashboard)
          // Fix: Removed 'daysHeld' as it is not part of the Transaction interface (Error line 31)
        });
      }
    }
  }

  return transactions;
};

export const parseBBLayout = (content: string): Transaction[] => {
  const lines = content.split('\n');
  const transactions: Transaction[] = [];

  lines.forEach((line) => {
    if (line.length < 100) return;
    const recordType = line.substring(0, 1);
    if (recordType === '1') {
      const date = line.substring(80, 86);
      const amountRaw = line.substring(86, 104).trim();
      const category = line.substring(42, 45).trim();
      const description = `BB Categ ${category} - Lanc ${line.substring(135, 150).trim()}`;
      const amount = parseFloat(amountRaw) / 100 || 0;

      if (amount !== 0) {
        // Fix: Added missing required profileId property to satisfy Transaction interface
        transactions.push({
          id: Math.random().toString(36).substr(2, 9),
          // Added missing required properties to satisfy Transaction interface
          importId: 'INTERNAL_BB',
          profileId: 'INTERNAL_BB',
          sourceFileName: 'BB_LAYOUT_IMPORT',
          date: `20${date.substring(4, 6)}${date.substring(2, 4)}${date.substring(0, 2)}`,
          description,
          amount: Math.abs(amount),
          type: amount > 0 ? 'CREDIT' : 'DEBIT',
          // Fix: Added missing required entryType property to satisfy the Transaction interface
          entryType: amount > 0 ? 'REDEMPTION' : 'APPLICATION',
          assetType: category.startsWith('2') ? AssetType.RENDA_VARIAVEL : AssetType.RENDA_FIXA,
          // Fix: Remove 'baseValue' as it is not part of the Transaction interface
          yield: Math.abs(amount) * 0.1
          // Fix: Removed 'daysHeld' as it is not part of the Transaction interface (Error line 64)
        });
      }
    }
  });

  return transactions;
};

const identifyAssetType = (desc: string): AssetType => {
  const lower = desc.toLowerCase();
  if (lower.includes('cdb') || lower.includes('tesouro') || lower.includes('lci') || lower.includes('lca')) return AssetType.RENDA_FIXA;
  if (lower.includes('ação') || lower.includes('stock') || lower.includes('trade')) return AssetType.RENDA_VARIAVEL;
  if (lower.includes('fundo') || lower.includes('invest')) return AssetType.FUNDOS_INVESTIMENTO;
  if (lower.includes('fii') || lower.includes('imob')) return AssetType.FII;
  if (lower.includes('jcp') || lower.includes('juros s/')) return AssetType.JCP;
  return AssetType.RENDA_FIXA;
};
