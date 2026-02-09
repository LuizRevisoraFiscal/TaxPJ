
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileUp, 
  Calculator, 
  Loader2, 
  CheckCircle2, 
  Building2, 
  CalendarDays, 
  BookOpen, 
  Database, 
  ArrowUpCircle, 
  Plus, 
  Trash2, 
  FileText, 
  Layers, 
  TrendingUp, 
  BarChart3, 
  Eraser, 
  Info, 
  AlertCircle, 
  Save, 
  Settings2,
  RefreshCcw,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Transaction, PJRegime, DashboardStats } from './types';
import { calculateTax } from './services/taxService';
import { parseFinancialDocument } from './services/geminiService';

interface ConfigProfile {
  id: string;
  name: string;
  bankCode: string;
  assetCode: string;
  liabilityCode: string;
  layoutType: 'BRADESCO_INVEST_FACIL' | 'CAIXA_FIC_GIRO' | 'BANCO_DO_BRASIL_INVEST' | 'GENERIC_INVESTMENT' | '';
}

interface MonthlyGroup {
  monthYear: string; // MM/YYYY
  label: string;
  transactions: Transaction[];
  stats: DashboardStats;
}

const LAYOUT_NAMES: Record<string, string> = {
  'BRADESCO_INVEST_FACIL': 'Bradesco Invest Fácil',
  'CAIXA_FIC_GIRO': 'Caixa FIC Giro',
  'BANCO_DO_BRASIL_INVEST': 'Banco do Brasil - Investimentos',
  'GENERIC_INVESTMENT': 'Layout Genérico / Outros',
  '': ''
};

const LAYOUT_TO_BANK_NAME: Record<string, string> = {
  'BRADESCO_INVEST_FACIL': 'BRADESCO',
  'CAIXA_FIC_GIRO': 'CAIXA ECONÔMICA',
  'BANCO_DO_BRASIL_INVEST': 'BANCO DO BRASIL',
  'GENERIC_INVESTMENT': 'OUTROS'
};

const STORAGE_KEY = 'taxpj_profiles_v21';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'memoria' | 'contabil'>('dashboard');
  
  const [profiles, setProfiles] = useState<ConfigProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [draftConfig, setDraftConfig] = useState<ConfigProfile>({
    id: '',
    name: '',
    bankCode: '',
    assetCode: '',
    liabilityCode: '',
    layoutType: ''
  });

  const importedProfileIds = useMemo(() => {
    return new Set(transactions.map(tx => tx.profileId));
  }, [transactions]);

  useEffect(() => {
    if (profiles.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    }
  }, [profiles]);

  const resetDraft = () => {
    setDraftConfig({ id: '', name: '', bankCode: '', assetCode: '', liabilityCode: '', layoutType: '' });
  };

  const handleSaveBank = () => {
    if (!draftConfig.name || !draftConfig.bankCode || !draftConfig.assetCode || !draftConfig.liabilityCode || !draftConfig.layoutType) {
      setErrorMsg("Preencha todos os campos e selecione um layout.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if (draftConfig.id) {
      setProfiles(prev => prev.map(p => p.id === draftConfig.id ? draftConfig : p));
      setSuccessMsg(`Banco ${draftConfig.name} atualizado.`);
    } else {
      const newId = Date.now().toString();
      const newProfile = { ...draftConfig, id: newId, name: draftConfig.name.toUpperCase() };
      setProfiles(prev => [...prev, newProfile]);
      setSuccessMsg(`Banco ${newProfile.name} cadastrado.`);
    }

    resetDraft();
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleClearProfiles = () => {
    if (window.confirm("Deseja realmente remover TODOS os perfis bancários cadastrados?")) {
      setProfiles([]);
      resetDraft();
      for (let i = 10; i <= 21; i++) {
        localStorage.removeItem(`taxpj_profiles_v${i}`);
      }
      setSuccessMsg("Configurações removidas com sucesso.");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleEditProfile = (profile: ConfigProfile) => {
    setDraftConfig(profile);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveProfile = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm("Deseja remover este banco da lista de importação?")) {
      setProfiles(prev => prev.filter(p => String(p.id) !== String(id)));
      if (draftConfig.id === id) resetDraft();
      setSuccessMsg("Banco removido com sucesso.");
      setTimeout(() => setSuccessMsg(null), 2000);
    }
  };

  const handleUpdateDraft = (updates: Partial<ConfigProfile>) => {
    setDraftConfig(prev => {
      const next = { ...prev, ...updates };
      if ('layoutType' in updates) {
        next.bankCode = '';
        next.assetCode = '';
        next.liabilityCode = '';
        if (updates.layoutType !== '') {
          next.name = LAYOUT_TO_BANK_NAME[updates.layoutType as string] || prev.name;
        }
      }
      return next;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, profile: ConfigProfile) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const allNewTxs: Transaction[] = [];

      for (const file of Array.from(files)) {
        const content = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = (e) => res(e.target?.result as string);
          reader.onerror = (e) => rej(new Error("Erro ao ler arquivo local."));
          reader.readAsDataURL(file);
        });
        const base64 = content.split(',')[1] || content;
        
        const newTxs = await parseFinancialDocument(base64, file.type, true, profile.layoutType as string);
        
        if (newTxs && newTxs.length > 0) {
          allNewTxs.push(...newTxs.map(t => ({ 
            ...t, 
            profileId: profile.id,
            sourceFileName: file.name
          })));
        }
      }

      if (allNewTxs.length > 0) {
        setTransactions(prev => [...prev, ...allNewTxs]);
        setSuccessMsg(`${allNewTxs.length} lançamentos extraídos com sucesso.`);
        setTimeout(() => setActiveTab('contabil'), 800);
      } else {
        setErrorMsg("Nenhuma transação financeira foi identificada nos arquivos.");
      }
    } catch (err: any) {
      console.error("Upload Error:", err);
      setErrorMsg(err.message || "Erro ao processar extrato.");
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(tx => {
      if (!tx.date || tx.date.length < 6) return;
      const my = `${tx.date.substring(4, 6)}/${tx.date.substring(0, 4)}`;
      if (!groups[my]) groups[my] = [];
      groups[my].push(tx);
    });

    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    return Object.entries(groups)
      .map(([my, txs]): MonthlyGroup => {
        const [m, y] = my.split('/');
        const calcs = txs
          .filter(t => t.entryType === 'REDEMPTION')
          .map(t => calculateTax(t, PJRegime.LUCRO_PRESUMIDO));

        const totalYield = calcs.reduce((sum, c) => sum + c.grossYield, 0);
        const totalIRRF = calcs.reduce((sum, c) => sum + c.irrfAmount, 0);
        const totalIRPJBruto = calcs.reduce((sum, c) => sum + (c.irpjBase || 0), 0);
        const totalSurcharge = calcs.reduce((sum, c) => sum + (c.irpjSurcharge || 0), 0);
        const totalCSLL = calcs.reduce((sum, c) => sum + (c.csllAmount || 0), 0);
        const irpjLiquido = Math.max(0, (totalIRPJBruto + totalSurcharge) - totalIRRF);

        return {
          monthYear: my,
          label: `${months[parseInt(m)-1]} de ${y}`,
          transactions: txs.sort((a, b) => a.date.localeCompare(b.date)),
          stats: {
            totalInvested: txs.filter(t => t.entryType === 'APPLICATION').reduce((sum, t) => sum + t.amount, 0),
            totalYield,
            totalIRRF,
            totalIRPJ: irpjLiquido,
            totalCSLL,
            finalTaxBalance: irpjLiquido + totalCSLL
          }
        };
      })
      .sort((a, b) => {
        const [mA, yA] = a.monthYear.split('/');
        const [mB, yB] = b.monthYear.split('/');
        return yA !== yB ? yA.localeCompare(yB) : mA.localeCompare(mB);
      });
  }, [transactions]);

  const globalStats = useMemo(() => {
    return groupedData.reduce((acc, curr) => ({
      totalInvested: acc.totalInvested + curr.stats.totalInvested,
      totalYield: acc.totalYield + curr.stats.totalYield,
      totalIRRF: acc.totalIRRF + curr.stats.totalIRRF,
      totalIRPJ: acc.totalIRPJ + curr.stats.totalIRPJ,
      totalCSLL: acc.totalCSLL + curr.stats.totalCSLL,
      finalTaxBalance: acc.finalTaxBalance + curr.stats.finalTaxBalance,
    }), { totalInvested: 0, totalYield: 0, totalIRRF: 0, totalIRPJ: 0, totalCSLL: 0, finalTaxBalance: 0 });
  }, [groupedData]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe] font-sans text-slate-900">
      <header className="bg-white sticky top-0 z-50 border-b border-slate-100 print:hidden">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><Calculator size={24} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tighter">TaxPJ <span className="text-blue-600">Expert</span></h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Controle Tributário Consolidado</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
                type="button"
                onClick={handleClearProfiles} 
                className="px-4 py-2 text-slate-400 hover:text-orange-600 text-[10px] font-black uppercase flex items-center gap-2 transition-all border border-transparent hover:bg-orange-50 rounded-lg"
                title="Limpar todos os bancos cadastrados"
             >
                <RefreshCcw size={14} /> Limpar Bancos
             </button>
             <button 
                type="button"
                onClick={() => { if(window.confirm("Limpar lançamentos da tela?")) setTransactions([]); }} 
                className="px-4 py-2 text-slate-400 hover:text-red-500 text-[10px] font-black uppercase flex items-center gap-2 transition-all border border-transparent hover:bg-red-50 rounded-lg"
             >
                <Eraser size={14} /> Limpar Lançamentos
             </button>
             <button type="button" onClick={() => window.print()} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-all">
                IMPRIMIR
             </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
        
        {/* CADASTRO DE PERFIL */}
        <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm print:hidden">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                  {draftConfig.id ? `Editando Banco: ${draftConfig.name}` : 'Configurar Novo Perfil de Banco'}
                </h3>
              </div>
              {draftConfig.id && (
                <button 
                  type="button"
                  onClick={resetDraft} 
                  className="text-[10px] font-bold text-blue-600 uppercase border-b border-blue-600 hover:text-blue-500"
                >
                  Cancelar e Limpar
                </button>
              )}
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              <div className="lg:col-span-3">
                <ConfigField label="Nome da Instituição" icon={<Building2 size={12}/>}>
                  <input 
                    type="text" 
                    value={draftConfig.name} 
                    onChange={(e) => handleUpdateDraft({ name: e.target.value })} 
                    className="w-full bg-transparent font-black outline-none placeholder:font-normal placeholder:text-slate-300"
                    placeholder="Ex: BANCO DO BRASIL"
                  />
                </ConfigField>
              </div>

              <div className="lg:col-span-2">
                <ConfigField label="Layout do Extrato" icon={<FileText size={12}/>} color="text-orange-600">
                  <select 
                    value={draftConfig.layoutType} 
                    onChange={(e) => handleUpdateDraft({ layoutType: e.target.value as any })} 
                    className={`w-full bg-transparent outline-none font-black cursor-pointer appearance-none ${!draftConfig.layoutType ? 'text-slate-300' : 'text-slate-900'}`}
                  >
                    <option value="">Selecione...</option>
                    <option value="BANCO_DO_BRASIL_INVEST">Banco do Brasil</option>
                    <option value="CAIXA_FIC_GIRO">Caixa FIC Giro</option>
                    <option value="BRADESCO_INVEST_FACIL">Bradesco Invest Fácil</option>
                    <option value="GENERIC_INVESTMENT">Layout Genérico</option>
                  </select>
                </ConfigField>
              </div>

              <div className="lg:col-span-2">
                <ConfigField label="Conta Contábil (Banco)" color="text-blue-600">
                  <input type="text" value={draftConfig.bankCode} onChange={(e) => handleUpdateDraft({ bankCode: e.target.value })} className="w-full bg-transparent outline-none font-black placeholder:text-slate-300" placeholder="1.1.1.01" />
                </ConfigField>
              </div>

              <div className="lg:col-span-2">
                <ConfigField label="Conta Contábil (Ativo)" color="text-emerald-600">
                  <input type="text" value={draftConfig.assetCode} onChange={(e) => handleUpdateDraft({ assetCode: e.target.value })} className="w-full bg-transparent outline-none font-black placeholder:text-slate-300" placeholder="1.1.4.01" />
                </ConfigField>
              </div>

              <div className="lg:col-span-2">
                <ConfigField label="Conta Contábil (Receita)" color="text-purple-600">
                  <input type="text" value={draftConfig.liabilityCode} onChange={(e) => handleUpdateDraft({ liabilityCode: e.target.value })} className="w-full bg-transparent outline-none font-black placeholder:text-slate-300" placeholder="4.1.1.01" />
                </ConfigField>
              </div>

              <div className="lg:col-span-1">
                <button 
                  type="button"
                  onClick={handleSaveBank}
                  className="w-full h-[52px] bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                  title="Salvar Banco"
                >
                  <Save size={20} />
                </button>
              </div>
           </div>
        </section>

        {/* BANCOS ATIVADOS */}
        <section className="space-y-4 print:hidden">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black italic">!</div>
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Bancos Ativados para Importação</h3>
          </div>

          {profiles.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] py-16 text-center text-slate-400 font-black uppercase text-[10px] tracking-widest italic animate-in fade-in">
              Nenhum banco configurado. Utilize o formulário para adicionar.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 animate-in fade-in">
              {profiles.map(profile => {
                const isImported = importedProfileIds.has(profile.id);
                return (
                  <div 
                    key={profile.id} 
                    className={`rounded-3xl p-6 border transition-all group relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm
                      ${isImported 
                        ? 'bg-emerald-50/50 border-emerald-200 shadow-emerald-100/50' 
                        : 'bg-white border-slate-100 hover:border-blue-200'}`}
                  >
                    <div className="flex items-center gap-6 flex-1">
                      <div className={`p-4 rounded-2xl transition-all
                        ${isImported 
                          ? 'bg-emerald-100 text-emerald-600' 
                          : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                        <Building2 size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className={`text-lg font-black uppercase leading-none ${isImported ? 'text-emerald-900' : 'text-slate-900'}`}>
                            {profile.name}
                          </h4>
                          {isImported ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-black uppercase rounded-full tracking-tighter">
                              <CheckCircle2 size={10} /> Importado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 text-[8px] font-black uppercase rounded-full tracking-tighter">
                              <Clock size={10} /> Pendente
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-2">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${isImported ? 'bg-emerald-100/50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                            Layout: {LAYOUT_NAMES[profile.layoutType]}
                          </span>
                          <span className={`text-[9px] font-bold ${isImported ? 'text-emerald-700' : 'text-blue-600'}`}>B: {profile.bankCode}</span>
                          <span className={`text-[9px] font-bold ${isImported ? 'text-emerald-700' : 'text-emerald-600'}`}>A: {profile.assetCode}</span>
                          <span className={`text-[9px] font-bold ${isImported ? 'text-emerald-700' : 'text-purple-600'}`}>R: {profile.liabilityCode}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <button 
                        type="button"
                        onClick={() => handleEditProfile(profile)} 
                        className={`transition-colors p-2 rounded-lg ${isImported ? 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100' : 'text-slate-300 hover:text-blue-600 hover:bg-blue-50'}`} 
                        title="Editar Configurações"
                      >
                        <Settings2 size={18} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => handleRemoveProfile(e, profile.id)} 
                        className={`transition-all p-2 rounded-lg group/btn shadow-sm hover:shadow-md
                          ${isImported 
                            ? 'text-emerald-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100' 
                            : 'text-slate-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100'}`} 
                        title="Remover Banco"
                      >
                        <Trash2 size={18} />
                      </button>
                      <label className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-lg transition-all active:scale-95 
                        ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                        ${isImported ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                        <FileUp size={16} /> {isImported ? 'Importar Novamente' : 'Importar Extrato'}
                        <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, profile)} accept=".pdf,.png,.jpg,.jpeg,.ofx" disabled={isProcessing} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {transactions.length > 0 && (
          <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
            <div className="flex items-center gap-8 border-b border-slate-100 print:hidden overflow-x-auto no-scrollbar">
              <NavItem label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<BarChart3 size={14}/>} />
              <NavItem label="Contabilidade" active={activeTab === 'contabil'} onClick={() => setActiveTab('contabil')} icon={<BookOpen size={14}/>} />
              <NavItem label="Memória DARF" active={activeTab === 'memoria'} onClick={() => setActiveTab('memoria')} icon={<Layers size={14}/>} />
            </div>

            <div className="min-h-[400px]">
              {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                     <StatCard label="Aplicações" value={globalStats.totalInvested} icon={<ArrowUpCircle className="text-blue-500" />} />
                     <StatCard label="Rendimentos" value={globalStats.totalYield} icon={<Database className="text-emerald-500" />} />
                     <StatCard label="IRRF Retido" value={globalStats.totalIRRF} color="text-amber-600" />
                     <StatCard label="DARF a Pagar" value={globalStats.finalTaxBalance} isHighlight />
                  </div>

                  <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><TrendingUp size={16} className="text-blue-600" /> Visão Consolidada Mensal</h4>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
                                 <th className="pb-4">Mês/Ano</th>
                                 <th className="pb-4">Rendimento</th>
                                 <th className="pb-4">IRPJ (15%)</th>
                                 <th className="pb-4">CSLL (9%)</th>
                                 <th className="pb-4 text-right">DARF Estimado</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {groupedData.map(group => (
                                <tr key={group.monthYear} className="hover:bg-slate-50 transition-colors">
                                   <td className="py-4 font-black text-slate-700">{group.label}</td>
                                   <td className="py-4 text-sm font-black text-emerald-600">{formatCurrency(group.stats.totalYield)}</td>
                                   <td className="py-4 text-sm font-bold text-slate-500">{formatCurrency(group.stats.totalIRPJ)}</td>
                                   <td className="py-4 text-sm font-bold text-slate-500">{formatCurrency(group.stats.totalCSLL)}</td>
                                   <td className="py-4 text-right font-black text-slate-900">{formatCurrency(group.stats.finalTaxBalance)}</td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'contabil' && (
                <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm space-y-16 animate-in fade-in">
                  {groupedData.map(group => {
                    const txsByProfile: Record<string, Transaction[]> = {};
                    group.transactions.forEach(tx => {
                      if (!txsByProfile[tx.profileId]) txsByProfile[tx.profileId] = [];
                      txsByProfile[tx.profileId].push(tx);
                    });

                    return (
                      <div key={group.monthYear} className="space-y-10">
                        <div className="inline-flex items-center gap-3 bg-slate-900 text-white px-6 py-2.5 rounded-2xl shadow-lg">
                           <CalendarDays size={18} className="text-blue-400" />
                           <span className="text-xs font-black uppercase tracking-widest">{group.label}</span>
                        </div>
                        <div className="space-y-12">
                           {Object.entries(txsByProfile).map(([pId, txs]) => {
                              const profile = profiles.find(p => p.id === pId) || { name: 'BANCO REMOVIDO', bankCode: '?', assetCode: '?', liabilityCode: '?' };
                              return (
                                <div key={pId} className="space-y-6">
                                   <div className="bg-slate-50 p-6 rounded-2xl flex justify-between items-center border border-slate-100">
                                      <div className="flex items-center gap-4">
                                         <Building2 size={20} className="text-blue-600" />
                                         <h5 className="font-black text-slate-900 uppercase">{profile.name}</h5>
                                      </div>
                                      <div className="flex gap-4">
                                         <span className="text-[9px] font-bold text-blue-600">BNC: {profile.bankCode}</span>
                                         <span className="text-[9px] font-bold text-emerald-600">ATV: {profile.assetCode}</span>
                                         <span className="text-[9px] font-bold text-purple-600">RCT: {profile.liabilityCode}</span>
                                      </div>
                                   </div>
                                   <div className="overflow-x-auto border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                      <table className="w-full text-left">
                                         <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            <tr>
                                               <th className="py-4 pl-6">Data</th>
                                               <th className="py-4">Contas D/C</th>
                                               <th className="py-4">Histórico</th>
                                               <th className="py-4 text-right pr-6">Valor</th>
                                            </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-50">
                                            {txs.map(tx => {
                                               const items = [];
                                               const assetName = (tx.description || 'APLICAÇÃO FINANCEIRA').toUpperCase();
                                               const bankName = profile.name.toUpperCase();
                                               const monthYear = tx.date.length === 8 ? `${tx.date.substring(4, 6)}/${tx.date.substring(0, 4)}` : '';

                                               if (tx.entryType === 'APPLICATION') {
                                                  // Padrão solicitado: [PREFIXO] - [BANCO] - [APLICAÇÃO] - [MÊS/ANO]
                                                  items.push({ 
                                                    dr: profile.assetCode, 
                                                    cr: profile.bankCode, 
                                                    hist: `APLICAÇÃO FINANCEIRA - ${bankName} - ${assetName} - ${monthYear}`, 
                                                    val: tx.amount 
                                                  });
                                               } else {
                                                  const princ = tx.amount - (tx.yield || 0) + (tx.irrfRetained || 0);
                                                  
                                                  // Resgate de Principal
                                                  items.push({ 
                                                    dr: profile.bankCode, 
                                                    cr: profile.assetCode, 
                                                    hist: `RESGATE DE APLICAÇÃO FINANCEIRA - ${bankName} - ${assetName} - ${monthYear}`, 
                                                    val: princ 
                                                  });
                                                  
                                                  // Rendimento
                                                  if (tx.yield) {
                                                    items.push({ 
                                                      dr: profile.liabilityCode, 
                                                      cr: '807', 
                                                      hist: `RENDIMENTO DE RESGATE DE APLICAÇÃO FINANCEIRA - ${bankName} - ${assetName} - ${monthYear}`, 
                                                      val: tx.yield, 
                                                      color: 'text-purple-600' 
                                                    });
                                                  }

                                                  // IRRF Retido
                                                  if (tx.irrfRetained) {
                                                    items.push({ 
                                                      dr: '806', 
                                                      cr: profile.bankCode, 
                                                      hist: `IRRF RETIDO S/RENDIMENTO DE RESGATE DE APLICAÇÃO FINANCEIRA - ${bankName} - ${assetName} - ${monthYear}`, 
                                                      val: tx.irrfRetained, 
                                                      color: 'text-amber-600' 
                                                    });
                                                  }

                                                  // IOF (Caso a IA extraia IOF no futuro)
                                                  if (tx.iof) {
                                                    items.push({ 
                                                      dr: '808', 
                                                      cr: profile.bankCode, 
                                                      hist: `IOF S/RENDIMENTO DE RESGATE DE APLICAÇÃO FINANCEIRA - ${bankName} - ${assetName} - ${monthYear}`, 
                                                      val: tx.iof, 
                                                      color: 'text-red-600' 
                                                    });
                                                  }
                                               }
                                               return items.map((it, i) => (
                                                  <tr key={tx.id + "_" + i} className="hover:bg-slate-50/50 transition-colors">
                                                     <td className="py-4 text-[10px] font-bold text-slate-500 pl-6">{formatDate(tx.date)}</td>
                                                     <td className="py-4 font-black text-[10px] text-slate-700">{it.dr} / {it.cr}</td>
                                                     <td className="py-4 text-[9px] font-bold text-slate-400 uppercase leading-relaxed max-w-md">{it.hist}</td>
                                                     <td className={`py-4 text-right pr-6 font-black text-xs ${it.color || ''}`}>{formatCurrency(it.val)}</td>
                                                  </tr>
                                               ));
                                            })}
                                         </tbody>
                                      </table>
                                   </div>
                                </div>
                              );
                           })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'memoria' && (
                 <div className="space-y-8 animate-in fade-in">
                    {groupedData.map(group => (
                       <div key={group.monthYear} className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm flex flex-col md:flex-row gap-12 group transition-all hover:border-blue-100">
                          <div className="flex-1 space-y-6">
                             <h4 className="text-xl font-black text-slate-900">{group.label}</h4>
                             <div className="space-y-3 bg-slate-50 p-8 rounded-3xl">
                                <SummaryRow label="Rendimento Tributável Consolidado" value={group.stats.totalYield} isBold color="text-blue-700" />
                                <SummaryRow label="IRPJ (15%)" value={group.stats.totalYield * 0.15} />
                                <SummaryRow label="(-) IRRF Retido a Compensar" value={group.stats.totalIRRF} color="text-amber-600" />
                                <div className="pt-4 border-t border-slate-200"><SummaryRow label="IRPJ Líquido a Recolher" value={group.stats.totalIRPJ} isBold /></div>
                             </div>
                             <div className="space-y-3 bg-emerald-50/20 p-8 rounded-3xl"><SummaryRow label="CSLL Devida (9%)" value={group.stats.totalCSLL} isBold color="text-emerald-700" /></div>
                          </div>
                          <div className="md:w-1/3 bg-slate-900 rounded-[2rem] p-10 text-white flex flex-col justify-center text-center shadow-2xl transition-transform group-hover:scale-[1.02]">
                             <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Total DARF Estimado</span>
                             <p className="text-5xl font-black tracking-tighter mb-4">{formatCurrency(group.stats.finalTaxBalance)}</p>
                             <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Base de Cálculo: {formatCurrency(group.stats.totalYield)}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FEEDBACK OVERLAYS */}
      {isProcessing && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center">
           <div className="bg-slate-900 text-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95">
              <Loader2 size={64} className="text-blue-500 animate-spin" />
              <div className="text-center">
                 <h4 className="text-xl font-black tracking-tight">IA Analisando Documento</h4>
                 <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Extraindo e Validando Lançamentos...</p>
                 <p className="text-white/40 text-[9px] mt-4">Processamento via Gemini Flash (Alta Velocidade).</p>
              </div>
           </div>
        </div>
      )}

      {successMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-2xl font-black flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-[100]">
           <CheckCircle2 size={20} /> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 max-w-lg w-full px-6 z-[100] animate-in fade-in slide-in-from-bottom-4">
           <div className="bg-white border-2 border-red-500 text-red-700 p-6 rounded-3xl shadow-2xl flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
              <div className="flex items-center gap-3 font-black text-sm uppercase tracking-tight">
                 <AlertTriangle size={24} className="text-red-500" />
                 Erro de Processamento
              </div>
              <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap">{errorMsg}</p>
              <button 
                type="button"
                onClick={() => setErrorMsg(null)}
                className="mt-2 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
              >
                Tentar novamente
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

// UI Components
const ConfigField = ({ label, icon, children, color }: any) => (
  <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-1 hover:border-blue-200 transition-colors">
    <label className={`text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 ${color || 'text-slate-400'}`}>{icon} {label}</label>
    <div className="text-[11px] font-bold text-slate-700">{children}</div>
  </div>
);

const StatCard = ({ label, value, isHighlight, color, icon }: any) => (
  <div className={`p-8 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isHighlight ? 'bg-blue-600 text-white border-blue-500 shadow-xl' : 'bg-white border-slate-100 shadow-sm'}`}>
    <div className="flex justify-between items-center mb-4"><span className={`text-[9px] font-black uppercase tracking-widest ${isHighlight ? 'text-white/60' : 'text-slate-400'}`}>{label}</span>{icon}</div>
    <p className={`text-2xl font-black tracking-tighter ${color || ''}`}>{formatCurrency(value)}</p>
  </div>
);

const NavItem = ({ label, active, onClick, icon }: any) => (
  <button type="button" onClick={onClick} className={`pb-4 text-[11px] font-black relative transition-all uppercase tracking-wider flex items-center gap-2 ${active ? 'text-blue-600' : 'text-slate-400'}`}>
    {icon} {label}{active && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-full" />}
  </button>
);

const SummaryRow = ({ label, value, isBold, color }: any) => (
  <div className={`flex justify-between items-center text-sm ${isBold ? 'font-black text-slate-900 text-base' : 'font-bold text-slate-500'} ${color || ''}`}>
     <span>{label}</span><span>{formatCurrency(value)}</span>
  </div>
);

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatDate = (str: string) => str && str.length === 8 ? `${str.substring(6, 8)}/${str.substring(4, 6)}/${str.substring(0, 4)}` : str;

export default App;
