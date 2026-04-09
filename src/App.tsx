import { useState, useMemo } from 'react';
import { 
  Plus, Printer, Trash2, Layout, 
  GripVertical, FileText, Menu, X, Layers3, Settings2, RotateCcw, Box, Folder, CheckCircle2, EyeOff, Eye, MoveHorizontal
} from 'lucide-react';

// ============ TIPOS E INTERFACES ============
interface Project {
  event: string;
  client: string;
  agency: string;
}

interface BleedSettings {
  x: number;
  y: number;
}

interface CalculateScalePrintResult {
  drawW: number;
  drawH: number;
  scale: number;
}

interface Item {
  id: string;
  qty: number;
  name: string;
  type: 'Painel' | 'Balcão';
  material: string;
  isDoubleSided: boolean;
  bleedX: number;
  bleedY: number;
  visibleWidth?: number;
  visibleHeight?: number;
  totalWidth?: number;
  totalHeight?: number;
  width?: number;
  height?: number;
  frontWidth?: number;
  sideWidth?: number;
}

interface Space {
  id: string;
  name: string;
  items: Item[];
}

interface FormState {
  qty: string;
  name: string;
  type: 'Painel' | 'Balcão';
  material: string;
  isCustomBleed: boolean;
  isDoubleSided: boolean;
  customBx: string;
  customBy: string;
  w: string;
  h: string;
  f: string;
  s: string;
}

interface PrintQueueItem {
  type: string;
  space?: Space;
  spaceIndex?: number;
  item?: Item;
}

// --- MOTORES DE PRECISÃO E REGRAS DE NEGÓCIO ---
const parseMeasure = (v: string | number | undefined): number => {
  if (!v) return 0;
  const p = parseFloat(String(v).replace(',', '.'));
  return isNaN(p) ? 0 : Math.max(0, p);
};

const formatM = (v: string | number | undefined): string => {
  const n = parseFloat(String(v || 0));
  return isNaN(n) ? '0,00' : n.toFixed(2).replace('.', ',');
};

const getBleedSettings = (material: string, isCustom: boolean, customX: string, customY: string): BleedSettings => {
  if (isCustom) {
    return { x: parseMeasure(customX), y: parseMeasure(customY) };
  }
  const rules: Record<string, BleedSettings> = {
    'Lona para Q15 (Ilhós)': { x: 0.35, y: 0.25 },
    'Lona para Metalon': { x: 0.10, y: 0.10 },
    'Trainel (Madeira)': { x: 0.15, y: 0.15 },
    'Adesivos': { x: 0.02, y: 0.02 }
  };
  return rules[material] || { x: 0.05, y: 0.05 };
};

const calculateScalePrint = (width: string | number, height: string | number, maxW = 200, maxH = 120): CalculateScalePrintResult => {
  const numW = Math.max(parseFloat(String(width)) || 0.001, 0.001);
  const numH = Math.max(parseFloat(String(height)) || 0.001, 0.001);
  const scale = Math.min(maxW / numW, maxH / numH);
  return { drawW: numW * scale, drawH: numH * scale, scale: scale };
};

// --- COMPONENTES VISUAIS E WRAPPERS (MOBILE SAFE & PRINT FORCED) ---

interface PageWrapperProps {
  children: React.ReactNode;
  isDark?: boolean;
}

const PageWrapper = ({ children, isDark = false }: PageWrapperProps) => (
  <div className="w-full overflow-x-auto print:overflow-visible pb-8 mb-8 print:pb-0 print:mb-0 flex justify-start xl:justify-center px-4 xl:px-0">
    <div 
      className={`w-[297mm] min-w-[297mm] h-[210mm] print:w-full print:h-screen shrink-0 overflow-hidden flex flex-col break-after-page p-12 sm:p-16 relative shadow-[0_15px_50px_rgba(0,0,0,0.08)] print:shadow-none rounded-[24px] sm:rounded-[40px] print:rounded-none`}
      // Solução de "Força Bruta" para garantir fundos pretos no PDF e passar em todos os browsers
      style={{
        backgroundColor: isDark ? '#121211' : '#FFFFFF',
        color: isDark ? '#FFFFFF' : '#121211',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact'
      }}
    >
      {children}
    </div>
  </div>
);

interface CADShapeProps {
  width: string | number;
  height: string | number;
  wLabel: string;
  hLabel: string;
  isDark: boolean;
  children: React.ReactNode;
}

const CADShape = ({ width, height, wLabel, hLabel, isDark, children }: CADShapeProps) => {
  const lineClass = isDark ? "bg-white/40" : "bg-[#121211]/30";
  const textClass = isDark ? "text-white" : "text-[#121211]";

  const GAP = 5; 
  const EXT = 14;

  return (
    <div className="relative" style={{ width, height }}>
      {/* Cota Superior */}
      <div className="absolute left-0 w-full pointer-events-none" style={{ bottom: `calc(100% + ${GAP}px)`, height: `${EXT}px` }}>
        <div className="absolute w-full text-center flex justify-center" style={{ bottom: '100%', paddingBottom: '6px' }}>
          <span className={`text-[13px] font-black tracking-tight ${textClass} leading-none`}>{wLabel} M</span>
        </div>
        <div className={`absolute top-0 left-0 w-full h-[1px] ${lineClass}`}></div>
        <div className={`absolute top-0 left-0 w-[1px] h-full ${lineClass}`}></div>
        <div className={`absolute top-0 right-0 w-[1px] h-full ${lineClass}`}></div>
      </div>

      {/* Cota Lateral Esquerda */}
      <div className="absolute top-0 h-full pointer-events-none" style={{ right: `calc(100% + ${GAP}px)`, width: `${EXT}px` }}>
        <div className="absolute h-full flex flex-col justify-center items-end" style={{ right: '100%', paddingRight: '8px' }}>
          <span className={`text-[13px] font-black tracking-tight ${textClass} leading-none whitespace-nowrap`}>{hLabel} M</span>
        </div>
        <div className={`absolute top-0 left-0 h-full w-[1px] ${lineClass}`}></div>
        <div className={`absolute top-0 left-0 w-full h-[1px] ${lineClass}`}></div>
        <div className={`absolute bottom-0 left-0 w-full h-[1px] ${lineClass}`}></div>
      </div>

      <div className="w-full h-full relative z-10">
        {children}
      </div>
    </div>
  );
};

interface PrintHeaderProps {
  project: Project;
  title: string;
  isDark?: boolean;
  hideBorder?: boolean;
}

const PrintHeader = ({ project, title, isDark = false, hideBorder = false }: PrintHeaderProps) => (
  <div className={`w-full flex justify-between items-end pb-5 mb-10 ${hideBorder ? '' : 'border-b'} ${isDark ? 'border-white/10' : 'border-[#E8ECEF]'} relative z-20`}>
    <div>
      <h1 className={`text-xl font-extrabold uppercase tracking-tight ${isDark ? 'text-white' : 'text-[#121211]'}`}>{project.event || 'PROJETO SEM NOME'}</h1>
      <p className="text-[10px] font-bold text-[#6aaf5b] uppercase tracking-widest mt-1">{title}</p>
    </div>
    <div className="text-right">
      <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-white/50' : 'text-[#8A94A6]'}`}>Cliente Final</p>
      <p className={`text-sm font-extrabold uppercase mt-0.5 ${isDark ? 'text-white' : 'text-[#121211]'}`}>{project.client || '---'}</p>
    </div>
  </div>
);

interface PrintFooterProps {
  sheetNumber: number;
  totalSheets: number;
  isDark?: boolean;
  isWhiteLabel?: boolean;
  hideBorder?: boolean;
}

const PrintFooter = ({ sheetNumber, totalSheets, isDark = false, isWhiteLabel = false, hideBorder = false }: PrintFooterProps) => (
  <div className={`w-full flex justify-between items-center mt-auto pt-5 text-[9px] font-bold uppercase tracking-widest ${hideBorder ? '' : 'border-t'} ${isDark ? 'border-white/10 text-white/50' : 'border-[#E8ECEF] text-[#8A94A6]'} relative z-20`}>
    <div>{isWhiteLabel ? 'DIRETRIZES TÉCNICAS DE CENOGRAFIA' : 'INTER PRODUÇÕES • DIRETRIZES TÉCNICAS'}</div>
    <div>PÁGINA {sheetNumber} DE {totalSheets}</div>
  </div>
);

// --- PÁGINAS DO PDF ---

interface PageProps {
  project: Project;
  sheetNumber: number;
  totalSheets: number;
  isWhiteLabel: boolean;
}

const IntroSheet = ({ project, sheetNumber, totalSheets, isWhiteLabel }: PageProps) => (
  <PageWrapper>
    <div className="flex-1 flex flex-col justify-center max-w-4xl pt-10">
      <div className="w-14 h-14 bg-[#F4F5F7] rounded-2xl mb-8 flex items-center justify-center">
        <Layers3 className="w-7 h-7 text-[#6aaf5b]" />
      </div>
      <p className="text-xs font-bold text-[#8A94A6] tracking-[0.25em] uppercase mb-4">Caderno Técnico de Cenografia</p>
      <h1 className="text-5xl font-extrabold tracking-tight uppercase leading-tight mb-8 text-[#121211] max-w-[800px]">{project.event || 'NOME DO PROJETO'}</h1>
      
      <div className="grid grid-cols-2 gap-16 border-t border-[#E8ECEF] pt-10 mt-4">
        <div>
          <span className="text-[10px] font-bold text-[#8A94A6] uppercase tracking-widest block mb-2">Cliente Final</span>
          <p className="text-xl font-bold uppercase text-[#121211]">{project.client || '---'}</p>
        </div>
        {project.agency && (
          <div>
            <span className="text-[10px] font-bold text-[#8A94A6] uppercase tracking-widest block mb-2">Agência / Design</span>
            <p className="text-xl font-bold uppercase text-[#121211]">{project.agency}</p>
          </div>
        )}
      </div>
    </div>
    <PrintFooter sheetNumber={sheetNumber} totalSheets={totalSheets} isWhiteLabel={isWhiteLabel} />
  </PageWrapper>
);

const AnatomyPage = ({ project, sheetNumber, totalSheets, isWhiteLabel }: PageProps) => (
  <PageWrapper>
    <PrintHeader project={project} title="Anatomia do Gabarito" />
    <div className="flex-1 flex flex-col justify-center">
      <div className="flex gap-10">
        
        {/* CARD CLARO: ÁREA ÚTIL */}
        <div className="flex-1 bg-[#F4F5F7] rounded-[24px] p-8 flex flex-col">
          <div className="w-full h-[240px] bg-white rounded-[16px] mb-8 flex items-center justify-center p-8 shadow-sm">
             <div className="w-full h-full border-[2.5px] border-[#6aaf5b] flex items-center justify-center">
                <span className="font-bold text-[#6aaf5b] uppercase tracking-widest text-[12px]">Área Útil</span>
             </div>
          </div>
          <h3 className="text-[24px] font-black text-[#121211] uppercase mb-4 tracking-tight">Área Útil (Linha Verde)</h3>
          <p className="text-[15px] text-[#121211]/80 leading-relaxed font-medium">
            Representa a face frontal exata da estrutura. <strong className="text-[#121211]">Tudo o que for legível e vital deve ficar dentro desta área.</strong> Informação que cruzar esta linha corre o risco de ir para a lateral.
          </p>
        </div>

        {/* CARD ESCURO: SANGRIA */}
        <div className="flex-1 bg-[#121211] rounded-[24px] p-8 flex flex-col" style={{ backgroundColor: '#1B1B1B' }}>
          <div className="w-full h-[240px] bg-[#2A2A2A] rounded-[16px] mb-8 relative flex items-center justify-center p-8">
             <div className="w-full h-full relative">
                <span className="absolute -top-6 left-0 font-bold text-[#8A94A6] text-[10px] uppercase tracking-widest">Expansão de Fundo</span>
                <div className="w-full h-full border-[2px] border-dashed border-[#6aaf5b] flex items-center justify-center">
                   <span className="font-bold text-[#6aaf5b] text-[12px] uppercase tracking-widest">Área Útil</span>
                </div>
             </div>
          </div>
          <h3 className="text-[24px] font-black text-white uppercase mb-4 tracking-tight">Sangria (Arquivo Final)</h3>
          <p className="text-[15px] text-white/80 leading-relaxed font-medium">
            A margem de segurança escura fora da linha verde pontilhada. <strong className="text-white">O fundo da sua arte tem de expandir e preencher todo este espaço negro.</strong> Esta "sobra" reveste as laterais do painel.
          </p>
        </div>

      </div>
    </div>
    <PrintFooter sheetNumber={sheetNumber} totalSheets={totalSheets} isWhiteLabel={isWhiteLabel} />
  </PageWrapper>
);

const SubmissionRulesPage = ({ project, sheetNumber, totalSheets, isWhiteLabel }: PageProps) => (
  <PageWrapper>
    <PrintHeader project={project} title="Regras Técnicas de Produção" />
    <div className="flex-1 flex flex-col justify-center py-2">
      <div className="grid grid-cols-2 gap-16 h-full">
        
        <div className="flex flex-col h-full">
          <h2 className="text-[28px] font-extrabold leading-tight mb-10 text-[#121211] pr-10">
            As artes devem ser enviadas separadas por pastas definidas por cada espaço.
          </h2>
          <div className="flex items-start gap-6">
            <span className="text-[14px] italic font-medium text-[#5A6270] pt-1">Exemplo:</span>
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                <Folder className="w-[42px] h-[42px] fill-[#121211] text-[#121211]" />
                <span className="text-[22px] font-bold text-[#121211]">Sala Brasil</span>
              </div>
              <div className="ml-[60px] space-y-5">
                <div className="flex items-center gap-4">
                  <div className="bg-[#121211] text-white text-[9px] font-black px-2 py-1 rounded-[4px] uppercase tracking-wider">PDF</div>
                  <span className="text-[16px] font-bold text-[#121211]">Backdrop_Af.pdf</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-[#121211] text-white text-[9px] font-black px-2 py-1 rounded-[4px] uppercase tracking-wider">PDF</div>
                  <span className="text-[16px] font-bold text-[#121211]">Adesivo_Af.pdf</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-10">
            <div className="bg-[#E8ECEF] p-5 px-6 rounded-lg w-[90%]">
               <span className="font-black text-[14px] block mb-1 text-[#121211]">Obs.:</span>
               <p className="text-[14px] font-medium leading-snug text-[#121211]">
                 O arquivo final deve ser fechado e enviado em PDF no formato <strong>PDF/X1-A</strong>.
               </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col h-full">
          <h2 className="text-[28px] font-extrabold leading-tight mb-10 text-[#121211] pr-4">
            É de grande importância o envio dos arquivos abertos e os links <em>(imagens incorporadas)</em> em uma pasta a parte!
          </h2>
          <div className="flex items-start gap-6">
            <span className="text-[14px] italic font-medium text-[#5A6270] pt-1">Exemplo:</span>
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                <Folder className="w-[42px] h-[42px] fill-[#121211] text-[#121211]" />
                <span className="text-[22px] font-bold text-[#121211]">Arquivos Abertos</span>
              </div>
              <div className="ml-[60px] space-y-5">
                <div className="flex items-center gap-4">
                  <div className="bg-[#121211] text-white text-[9px] font-black px-2 py-1 rounded-[4px] uppercase tracking-wider">Ai</div>
                  <span className="text-[16px] font-bold text-[#121211]">Backdrop_Af.Ai</span>
                </div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-[#121211] text-white text-[9px] font-black px-2 py-1 rounded-[4px] uppercase tracking-wider">Ai</div>
                  <span className="text-[16px] font-bold text-[#121211]">Adesivo_Af.Ai</span>
                </div>
                <div className="flex items-center gap-4 mb-6 pt-4">
                  <Folder className="w-[32px] h-[32px] fill-[#121211] text-[#121211]" />
                  <span className="text-[20px] font-bold text-[#121211]">Links / Fotos</span>
                </div>
                <div className="ml-[50px] space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#121211] text-white text-[9px] font-black px-2 py-1 rounded-[4px] uppercase tracking-wider">IMG</div>
                    <span className="text-[16px] font-bold text-[#121211]">Pexels-texture.jpg</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-[#121211] text-white text-[9px] font-black px-2 py-1 rounded-[4px] uppercase tracking-wider">IMG</div>
                    <span className="text-[16px] font-bold text-[#121211]">Night-streets-park.jpg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    <PrintFooter sheetNumber={sheetNumber} totalSheets={totalSheets} isWhiteLabel={isWhiteLabel} />
  </PageWrapper>
);

interface SectorCoverPageProps extends PageProps {
  space: Space;
  spaceIndex: number;
}

const SectorCoverPage = ({ project, space, sheetNumber, totalSheets, isWhiteLabel, spaceIndex }: SectorCoverPageProps) => {
  const sectorNum = String(spaceIndex + 1).padStart(2, '0');
  const totalPieces = space.items.reduce((acc: number, curr: Item) => acc + (parseInt(String(curr.qty)) || 1), 0);
  
  return (
    <PageWrapper isDark={true}>
      <PrintHeader project={project} title="Divisão de Setor" isDark={true} hideBorder={false} />
      <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/5 font-black text-[200px] sm:text-[300px] leading-none pointer-events-none select-none z-0 tracking-tighter">
          {sectorNum}
        </div>
        <span className="text-[#6aaf5b] font-bold uppercase tracking-[0.25em] text-xs sm:text-sm mb-6 flex items-center gap-4 relative z-10">
          <div className="w-12 h-px bg-[#6aaf5b]/50"></div>
          Espaço do Evento
          <div className="w-12 h-px bg-[#6aaf5b]/50"></div>
        </span>
        <h2 className="text-4xl sm:text-6xl leading-none font-black uppercase tracking-tight text-white mb-8 max-w-[800px] relative z-10 drop-shadow-sm">
          {space.name}
        </h2>
        <div className="bg-white/10 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full relative z-10 border border-white/10">
          <p className="text-white/80 font-bold text-[10px] sm:text-xs uppercase tracking-widest">
            {totalPieces} {totalPieces === 1 ? 'Peça Física Requerida' : 'Peças Físicas Requeridas'}
          </p>
        </div>
      </div>
      <PrintFooter sheetNumber={sheetNumber} totalSheets={totalSheets} isDark={true} isWhiteLabel={isWhiteLabel} hideBorder={false} />
    </PageWrapper>
  );
};

interface PieceBalcaoDetailPageProps extends PageProps {
  space: Space;
  item: Item;
}

const PieceBalcaoDetailPage = ({ project, space, item, sheetNumber, totalSheets, isWhiteLabel }: PieceBalcaoDetailPageProps) => {
  const tWidth = item.totalWidth || item.width || 0.001;
  const tHeight = item.totalHeight || item.height || 0.001;
  const vWidth = item.visibleWidth || 0.001;
  const vHeight = item.visibleHeight || item.height || 0.001;

  const { scale } = calculateScalePrint(tWidth, tHeight, 550, 200);
  
  const sTotW = tWidth * scale;
  const sTotH = tHeight * scale;

  const bleedXPct = (item.bleedX / tWidth) * 100;
  const bleedYPct = (item.bleedY / tHeight) * 100;
  const sidePct = ((item.sideWidth || 0) / tWidth) * 100;
  const frontPct = ((item.frontWidth || 0) / tWidth) * 100;
  
  const leftFoldPct = bleedXPct + sidePct;
  const rightFoldPct = bleedXPct + sidePct + frontPct;

  return (
    <PageWrapper>
      <PrintHeader project={project} title={`Setor: ${space.name} - Detalhamento da Peça`} />
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full mb-12 text-center">
           <h2 className="text-4xl font-black uppercase tracking-tight text-[#121211] mb-2">{item.name}</h2>
           <span className="text-[13px] font-bold text-[#8A94A6] uppercase tracking-widest">Visão Planificada</span>
        </div>

        <div className="w-full flex items-center justify-center relative pb-[60px] pt-[30px]">
          <div className="relative" style={{ width: sTotW, height: sTotH }}>
            
            <div className="absolute inset-0 bg-[#404347]"></div>
            <div className="absolute border-[1.5px] border-[#6aaf5b]" style={{ top: `${bleedYPct}%`, bottom: `${bleedYPct}%`, left: `${bleedXPct}%`, right: `${bleedXPct}%` }}></div>
            <div className="absolute top-0 bottom-0 border-l-[1.5px] border-dashed border-[#6aaf5b]/40" style={{ left: `${leftFoldPct}%` }}></div>
            <div className="absolute top-0 bottom-0 border-l-[1.5px] border-dashed border-[#6aaf5b]/40" style={{ left: `${rightFoldPct}%` }}></div>

            <div className="absolute bottom-full flex flex-col items-center pb-3 -translate-x-1/2" style={{ left: `${bleedXPct + (sidePct/2)}%` }}>
               <span className="text-[12px] font-black uppercase tracking-widest whitespace-nowrap mb-1.5 text-[#121211]">Face Lateral</span>
               <div className="w-[1px] h-3 bg-[#121211]/30"></div>
            </div>
            
            <div className="absolute bottom-full flex flex-col items-center pb-3 -translate-x-1/2" style={{ left: `${bleedXPct + sidePct + (frontPct/2)}%` }}>
               <span className="text-[12px] font-black uppercase tracking-widest whitespace-nowrap mb-1.5 text-[#121211]">Face Frontal</span>
               <div className="w-[1px] h-3 bg-[#121211]/30"></div>
            </div>
            
            <div className="absolute bottom-full flex flex-col items-center pb-3 -translate-x-1/2" style={{ left: `${bleedXPct + sidePct + frontPct + (sidePct/2)}%` }}>
               <span className="text-[12px] font-black uppercase tracking-widest whitespace-nowrap mb-1.5 text-[#121211]">Face Lateral</span>
               <div className="w-[1px] h-3 bg-[#121211]/30"></div>
            </div>

            <div className="absolute top-full pt-4" style={{ left: `${bleedXPct}%`, right: `${bleedXPct}%`, height: '50px' }}>
              <div className="relative w-full h-full">
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#121211]/30"></div>
                <div className="absolute top-0 w-[1.5px] h-3 bg-[#121211]/50" style={{ left: '0%' }}></div>
                <div className="absolute top-0 w-[1.5px] h-3 bg-[#121211]/50" style={{ left: `${((item.sideWidth || 0) / vWidth) * 100}%` }}></div>
                <div className="absolute top-0 w-[1.5px] h-3 bg-[#121211]/50" style={{ left: `${(((item.sideWidth || 0) + (item.frontWidth || 0)) / vWidth) * 100}%` }}></div>
                <div className="absolute top-0 w-[1.5px] h-3 bg-[#121211]/50" style={{ left: '100%' }}></div>

                <span className="absolute -top-[8px] -translate-x-1/2 bg-white px-2.5 leading-none text-[15px] font-black text-[#121211]" style={{ left: `${((item.sideWidth || 0) / vWidth) * 50}%` }}>{formatM(item.sideWidth || 0)}</span>
                <span className="absolute -top-[8px] -translate-x-1/2 bg-white px-2.5 leading-none text-[15px] font-black text-[#121211]" style={{ left: `${(((item.sideWidth || 0) + ((item.frontWidth || 0) / 2)) / vWidth) * 100}%` }}>{formatM(item.frontWidth || 0)}</span>
                <span className="absolute -top-[8px] -translate-x-1/2 bg-white px-2.5 leading-none text-[15px] font-black text-[#121211]" style={{ left: `${(((item.sideWidth || 0) + (item.frontWidth || 0) + ((item.sideWidth || 0) / 2)) / vWidth) * 100}%` }}>{formatM(item.sideWidth || 0)}</span>
              </div>
            </div>

            <div className="absolute right-full pr-4 flex flex-row items-center justify-end" style={{ top: `${bleedYPct}%`, bottom: `${bleedYPct}%`, width: '80px' }}>
              <span className="text-[15px] font-black text-[#121211] mr-3">{formatM(vHeight)}</span>
              <div className="h-full relative w-2.5">
                <div className="absolute top-0 right-0 h-full w-[1.5px] bg-[#121211]/30"></div>
                <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#121211]/50"></div>
                <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[#121211]/50"></div>
              </div>
            </div>

          </div>
        </div>
        
        <div className="w-full text-center mt-6">
          <p className="text-[12px] font-medium text-[#5A6270] max-w-[700px] mx-auto bg-[#F4F5F7] px-8 py-4 rounded-xl border border-[#E8ECEF]">
            <strong className="text-[#121211]">Atenção Crítica:</strong> As linhas tracejadas representam a dobra exata da madeira/estrutura. O fundo da sua arte deve cobrir todo o espaço escuro exterior (sangria).
          </p>
        </div>
      </div>
      <PrintFooter sheetNumber={sheetNumber} totalSheets={totalSheets} isWhiteLabel={isWhiteLabel} />
    </PageWrapper>
  );
};

const ClosingPage = ({ project, sheetNumber, totalSheets, isWhiteLabel }: PageProps) => (
  <PageWrapper isDark={true}>
    <PrintHeader project={project} title="Fim do Documento" isDark={true} hideBorder={false} />
    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto relative z-10">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#6aaf5b]/10 flex items-center justify-center mb-6 sm:mb-8">
         <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-[#6aaf5b]" />
      </div>
      <h2 className="text-4xl sm:text-5xl leading-tight font-black uppercase tracking-tighter text-white mb-4 sm:mb-6">
        Pronto para Criação
      </h2>
      <p className="text-white/60 font-medium text-sm sm:text-base mb-12 leading-relaxed px-4 sm:px-10">
        Aguardamos o envio das suas artes. Por favor, aplique o design respeitando as regras gráficas (PDF/X-1a, Preto Rico e Escalas) exigidas neste caderno técnico.
      </p>
    </div>
    <PrintFooter sheetNumber={sheetNumber} totalSheets={totalSheets} isDark={true} isWhiteLabel={isWhiteLabel} hideBorder={false} />
  </PageWrapper>
);

// --- APP PRINCIPAL ---

export default function App() {
  const [step, setStep] = useState<string>('setup');
  const [project, setProject] = useState<Project>({ event: '', client: '', agency: '' });
  const [spaces, setSpaces] = useState<Space[]>([{ id: 's1', name: 'SEÇÃO PRINCIPAL', items: [] }]);
  const [activeSpaceId, setActiveSpaceId] = useState<string>('s1');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isWhiteLabel, setIsWhiteLabel] = useState<boolean>(false);
  const [showPrintHint, setShowPrintHint] = useState<boolean>(false); 
  
  const [draggedSpaceIdx, setDraggedSpaceIdx] = useState<number | null>(null);
  const [draggedItemIdx, setDraggedItemIdx] = useState<number | null>(null);

  const [form, setForm] = useState<FormState>({ 
    qty: '1', 
    name: '', 
    type: 'Painel', 
    material: 'Trainel (Madeira)', 
    isCustomBleed: false,
    isDoubleSided: false,
    customBx: '', 
    customBy: '', 
    w: '', h: '', f: '', s: '' 
  });

  const activeSpace = useMemo(() => spaces.find(s => s.id === activeSpaceId), [spaces, activeSpaceId]);

  const printQueue = useMemo<PrintQueueItem[]>(() => {
    const queue: PrintQueueItem[] = [];
    queue.push({ type: 'intro' });
    queue.push({ type: 'anatomy' });
    queue.push({ type: 'rules' });
    
    spaces.forEach((space, spaceIndex) => {
      if (space.items && space.items.length > 0) {
        queue.push({ type: 'sector_cover', space, spaceIndex });
        space.items.forEach(item => {
          queue.push({ type: 'piece', space, item });
          if (item.type === 'Balcão') {
            queue.push({ type: 'piece_balcao_detail', space, item });
          }
        });
      }
    });
    
    queue.push({ type: 'closing' });
    return queue;
  }, [spaces]);

  const totalSheetsCount = printQueue.length;

  const handleExportPDF = (): void => {
    setShowPrintHint(true);
    setTimeout(() => {
      const originalTitle = document.title;
      const safeEventName = project.event ? project.event.replace(/[^a-zA-Z0-9]/g, '_') : 'Evento';
      document.title = `Caderno_Tecnico_${safeEventName}`;
      window.print();
      document.title = originalTitle;
      setShowPrintHint(false);
    }, 2500); 
  };
  
  const onDropSpace = (e: React.DragEvent<HTMLLIElement>, dropIdx: number): void => {
    e.preventDefault();
    if (draggedSpaceIdx === null || draggedSpaceIdx === dropIdx) return;
    const newSpaces = [...spaces];
    const [removed] = newSpaces.splice(draggedSpaceIdx, 1);
    newSpaces.splice(dropIdx, 0, removed);
    setSpaces(newSpaces); setDraggedSpaceIdx(null);
  };

  const onDropItem = (e: React.DragEvent<HTMLDivElement>, dropIdx: number): void => {
    e.preventDefault();
    if (draggedItemIdx === null || draggedItemIdx === dropIdx) return;
    const activeSpaceObj = spaces.find(s => s.id === activeSpaceId);
    if (!activeSpaceObj) return;
    const newItems = [...activeSpaceObj.items];
    const [removed] = newItems.splice(draggedItemIdx, 1);
    newItems.splice(dropIdx, 0, removed);
    setSpaces(spaces.map(s => s.id === activeSpaceId ? { ...s, items: newItems } : s));
    setDraggedItemIdx(null);
  };

  const handleUpdateSpaceName = (id: string, newName: string): void => setSpaces(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  
  const handleAddSpace = (): void => {
    const newId = `s-${Date.now()}`;
    setSpaces(prev => [...prev, { id: newId, name: 'Nova Seção', items: [] }]);
    setActiveSpaceId(newId);
  };
  
  const handleDeleteSpace = (id: string): void => {
    if (spaces.length <= 1) return;
    const newSpaces = spaces.filter(s => s.id !== id);
    setSpaces(newSpaces);
    setActiveSpaceId(newSpaces[0].id);
  };

  const handleAddItem = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!form.name) return;
    const bleed = getBleedSettings(form.material, form.isCustomBleed, form.customBx, form.customBy);
    let materialName = form.isCustomBleed ? 'Sangria Especial' : form.material;
    
    let newItem = { 
      id: Date.now().toString(), 
      qty: parseInt(form.qty) || 1, 
      name: form.name, 
      type: form.type, 
      material: materialName, 
      isDoubleSided: form.isDoubleSided,
      bleedX: bleed.x, 
      bleedY: bleed.y 
    };
    
    if (form.type === 'Painel') {
      const vW = parseMeasure(form.w), vH = parseMeasure(form.h);
      newItem = { 
        ...newItem, 
        visibleWidth: vW, 
        visibleHeight: vH, 
        totalWidth: vW + (bleed.x * 2), 
        totalHeight: vH + (bleed.y * 2),
        width: vW + (bleed.x * 2), 
        height: vH + (bleed.y * 2) 
      } as Item;
    } else {
      const f = parseMeasure(form.f), s = parseMeasure(form.s), h = parseMeasure(form.h);
      const vW = f + (s * 2);
      newItem = { 
        ...newItem, 
        frontWidth: f, 
        sideWidth: s, 
        height: h, 
        visibleHeight: h, 
        visibleWidth: vW, 
        totalWidth: vW + (bleed.x * 2), 
        totalHeight: h + (bleed.y * 2) 
      } as Item;
    }
    setSpaces(prev => prev.map(s => s.id === activeSpaceId ? { ...s, items: [...s.items, newItem as Item] } : s));
    
    setForm(prev => ({ 
      ...prev, 
      qty: '1',
      name: '', 
      isDoubleSided: false,
      w: '', 
      f: '', 
      h: prev.type === 'Balcão' ? '0,90' : '', 
      s: prev.type === 'Balcão' ? '0,50' : '' 
    }));
  };

  const handleDeleteItem = (spaceId: string, itemId: string): void => setSpaces(prev => prev.map(s => s.id === spaceId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s));

  // UTILS UI COM ANIMAÇÕES
  const inputUI = `w-full bg-[#F4F5F7] border border-transparent focus:border-[#6aaf5b] focus:bg-white focus:ring-4 focus:ring-[#6aaf5b]/10 p-3.5 sm:p-4 outline-none rounded-xl transition-all duration-200 ease-in-out focus:-translate-y-0.5 focus:shadow-sm text-[13px] sm:text-sm font-bold text-[#121211] placeholder-[#8A94A6] hover:bg-[#E8ECEF]`;
  const labelUI = `block text-[10px] sm:text-[11px] font-bold text-[#8A94A6] tracking-widest uppercase mb-1.5 sm:mb-2 ml-1`;
  const buttonPrimaryUI = `w-full py-3 sm:py-3.5 bg-[#121211] text-white font-bold rounded-xl hover:bg-[#6aaf5b] hover:-translate-y-0.5 hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-200 text-[12px] sm:text-[13px] shadow-md`;

  // --- RENDERS ---

  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-[#E8ECEF] flex items-center justify-center p-4 sm:p-6" style={{ fontFamily: "'Archivo', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
        <div className={`w-full max-w-lg bg-[#FFFFFF] p-6 sm:p-12 rounded-[24px] sm:rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.06)] animate-scale-up duration-500`}>
          <div className="flex justify-between items-center mb-8 sm:mb-10">
            <div className="w-10 h-10 bg-[#F4F5F7] rounded-xl flex items-center justify-center">
              <Box className="w-5 h-5 text-[#121211]" />
            </div>
            <span className="text-[9px] font-bold text-[#8A94A6] uppercase tracking-widest bg-[#F4F5F7] px-3 py-1.5 rounded-full">Configuração</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-[#121211]">Novo Evento.</h1>
          <p className="text-[13px] sm:text-sm font-medium mb-8 sm:mb-10 text-[#8A94A6]">Sistema de Gabaritos de Cenografia</p>

          <div className="space-y-4 sm:space-y-5">
            <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
              <label className={labelUI}>Nome do Evento</label>
              <input type="text" placeholder="Ex: Festival de Verão" value={project.event} onChange={e => setProject({...project, event: e.target.value})} className={inputUI} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '150ms' }}>
              <div><label className={labelUI}>Cliente Final</label><input type="text" placeholder="Marca" value={project.client} onChange={e => setProject({...project, client: e.target.value})} className={inputUI} /></div>
              <div><label className={labelUI}>Agência</label><input type="text" placeholder="Produtora" value={project.agency} onChange={e => setProject({...project, agency: e.target.value})} className={inputUI} /></div>
            </div>
            <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
              <button onClick={() => setStep('editor')} disabled={!project.event || !project.client} className="w-full py-3.5 sm:py-4 bg-[#121211] text-white font-bold rounded-xl mt-2 sm:mt-4 hover:bg-[#6aaf5b] transition-colors shadow-lg shadow-black/10 disabled:opacity-30 disabled:hover:bg-[#121211] text-sm">
                Entrar na Área de Trabalho
              </button>
            </div>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUpFade { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes scaleUpFade { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-slide-up { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-scale-up { animation: scaleUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .animate-fade-down { animation: fadeInDown 0.4s ease-out forwards; opacity: 0; }
        `}} />
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="min-h-screen bg-[#E8ECEF] print:bg-white overflow-auto py-6 sm:py-10 print:py-0 flex flex-col items-center gap-2 print:gap-0 print:block animate-in fade-in duration-500" style={{ fontFamily: "'Archivo', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
        
        {/* AVISO TEMPORÁRIO DE EXPORTAÇÃO */}
        {showPrintHint && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#121211]/80 backdrop-blur-sm print:hidden p-4">
            <div className="bg-white p-8 rounded-[32px] max-w-sm w-full text-center shadow-2xl animate-scale-up">
               <div className="w-16 h-16 bg-[#6aaf5b]/10 text-[#6aaf5b] rounded-full flex items-center justify-center mx-auto mb-6">
                 <Printer className="w-8 h-8" />
               </div>
               <h3 className="text-2xl font-black text-[#121211] mb-2 uppercase tracking-tight">Preparando PDF...</h3>
               <p className="text-[#5A6270] font-medium text-sm mb-8 leading-relaxed">
                 Na tela de impressão que vai abrir, altere o Destino para <strong className="text-[#121211]">Salvar como PDF</strong>.
               </p>
               <div className="w-full bg-[#E8ECEF] h-1.5 rounded-full overflow-hidden">
                 <div className="bg-[#6aaf5b] h-full w-full" style={{ animation: 'progress 2.5s ease-in-out forwards' }}></div>
               </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `@keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(0); } }`}} />
          </div>
        )}

        <div className="lg:hidden w-full flex items-center justify-center gap-2.5 mb-2 bg-white/40 py-2.5 px-4 backdrop-blur-sm sticky top-0 z-50 rounded-full mx-4 max-w-[calc(100%-2rem)] print:hidden animate-fade-down">
          <MoveHorizontal className="w-4 h-4 text-[#6aaf5b] animate-bounce" />
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#121211]">Deslize lateralmente para ler</span>
        </div>
        
        <div className="fixed bottom-6 sm:bottom-10 z-[200] flex items-center justify-center gap-2 sm:gap-4 print:hidden bg-white/95 backdrop-blur-xl p-2 sm:p-3 pr-2 sm:pr-4 rounded-[20px] sm:rounded-full border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-slide-up mx-4" style={{ animationDelay: '300ms' }}>
          <button onClick={() => setStep('editor')} className="px-5 sm:px-6 py-3 bg-[#F4F5F7] text-[#121211] font-bold rounded-[12px] sm:rounded-full text-[10px] sm:text-[11px] uppercase tracking-widest hover:bg-[#E8ECEF] hover:-translate-y-0.5 active:scale-95 transition-all duration-200">Voltar</button>
          <button onClick={handleExportPDF} className="px-6 sm:px-8 py-3 bg-[#6aaf5b] text-white font-bold rounded-[12px] sm:rounded-full text-[10px] sm:text-[11px] uppercase tracking-widest hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-[#6aaf5b]/30">
            <Printer className="w-3.5 h-3.5" /> Baixar PDF Final
          </button>
        </div>

        {printQueue.map((page, idx) => {
          const currentNum = idx + 1;
          const delay = `${Math.min(idx * 100, 800)}ms`; 
          
          let PageComponent: React.ReactNode = null;
          if (page.type === 'intro') PageComponent = <IntroSheet project={project} sheetNumber={currentNum} totalSheets={totalSheetsCount} isWhiteLabel={isWhiteLabel} />;
          else if (page.type === 'anatomy') PageComponent = <AnatomyPage project={project} sheetNumber={currentNum} totalSheets={totalSheetsCount} isWhiteLabel={isWhiteLabel} />;
          else if (page.type === 'rules') PageComponent = <SubmissionRulesPage project={project} sheetNumber={currentNum} totalSheets={totalSheetsCount} isWhiteLabel={isWhiteLabel} />;
          else if (page.type === 'sector_cover' && page.space && page.spaceIndex !== undefined) PageComponent = <SectorCoverPage project={project} space={page.space} sheetNumber={currentNum} totalSheets={totalSheetsCount} isWhiteLabel={isWhiteLabel} spaceIndex={page.spaceIndex} />;
          else if (page.type === 'closing') PageComponent = <ClosingPage project={project} sheetNumber={currentNum} totalSheets={totalSheetsCount} isWhiteLabel={isWhiteLabel} />;
          else if (page.type === 'piece_balcao_detail' && page.space && page.item) PageComponent = <PieceBalcaoDetailPage project={project} space={page.space} item={page.item} sheetNumber={currentNum} totalSheets={totalSheetsCount} isWhiteLabel={isWhiteLabel} />;
          else if (page.type === 'piece' && page.item && page.space) {
            const item = page.item;
            const space = page.space;
            const tWidth = item.totalWidth || item.width || 0.001;
            const tHeight = item.totalHeight || item.height || 0.001;
            const vWidth = item.visibleWidth || 0.001;
            const vHeight = item.visibleHeight || item.height || 0.001;
            const { drawW: vW, drawH: vH } = calculateScalePrint(vWidth, vHeight);
            const { drawW: tW, drawH: tH, scale: tScale } = calculateScalePrint(tWidth, tHeight);

            PageComponent = (
              <PageWrapper>
                <PrintHeader project={project} title={`Setor: ${space.name}`} />
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-8 sm:mb-10 border-b border-[#E8ECEF] pb-4 sm:pb-5">
                     <div>
                       <span className="text-[8px] sm:text-[9px] font-bold text-[#8A94A6] uppercase tracking-widest mb-1 sm:mb-1.5 block">Peça Cenográfica</span>
                       <h2 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[#121211]">{item.name}</h2>
                     </div>
                     <div className="text-right flex gap-3 sm:gap-4">
                        <div>
                          <span className="text-[8px] sm:text-[9px] font-bold text-[#8A94A6] uppercase tracking-widest mb-1 sm:mb-1.5 block">Faces</span>
                          <span className={`px-3 sm:px-4 py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block ${item.isDoubleSided ? 'bg-[#121211] text-white shadow-md' : 'bg-[#F4F5F7] text-[#121211]'}`}>
                            {item.isDoubleSided ? 'Frente e Verso (2 Artes)' : 'Apenas Frente'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] sm:text-[9px] font-bold text-[#8A94A6] uppercase tracking-widest mb-1 sm:mb-1.5 block">Quantidade</span>
                          <span className="bg-[#121211] text-white px-3 sm:px-4 py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-widest block">{item.qty} UN</span>
                        </div>
                        <div>
                          <span className="text-[8px] sm:text-[9px] font-bold text-[#8A94A6] uppercase tracking-widest mb-1 sm:mb-1.5 block">Tipo de Estrutura</span>
                          <span className="bg-[#F4F5F7] px-3 sm:px-4 py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[#121211] block">{item.material}</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-8 sm:gap-12">
                    <div className="flex flex-col bg-[#F4F5F7] rounded-[20px] sm:rounded-[24px] p-6 sm:p-10 print:bg-[#F4F5F7]">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-[3px] border-[#6aaf5b]"></div>
                        <h3 className="text-base sm:text-lg font-extrabold uppercase text-[#121211]">Área Útil</h3>
                      </div>
                      <div className="flex-1 flex items-center justify-center pt-[20px] sm:pt-[30px] pl-[30px] sm:pl-[40px]">
                        <CADShape width={`${vW}px`} height={`${vH}px`} wLabel={formatM(vWidth)} hLabel={formatM(vHeight)} isDark={false}>
                          {item.type === 'Painel' ? (
                            <div className="w-full h-full bg-white border-[2.5px] border-[#6aaf5b] shadow-sm rounded-sm"></div>
                          ) : (
                            <div className="w-full h-full bg-white border-[2.5px] border-[#6aaf5b] flex shadow-sm rounded-sm">
                              <div className="border-r border-[#6aaf5b]/30" style={{width: `${((item.sideWidth || 0)/vWidth)*100}%`}}></div>
                              <div className="border-r border-[#6aaf5b]/30" style={{width: `${((item.frontWidth || 0)/vWidth)*100}%`}}></div>
                            </div>
                          )}
                        </CADShape>
                      </div>
                    </div>

                    <div className="flex flex-col bg-[#303336] rounded-[20px] sm:rounded-[24px] p-6 sm:p-10 print:bg-[#303336]">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2">
                        <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-transparent border-[3px] border-[#6aaf5b] shadow-[0_0_0_2px_#303336_inset]"></div>
                        <h3 className="text-base sm:text-lg font-extrabold uppercase text-white">Arquivo Final</h3>
                      </div>
                      <div className="flex-1 flex items-center justify-center pt-[20px] sm:pt-[30px] pl-[30px] sm:pl-[40px]">
                        <CADShape width={`${tW}px`} height={`${tH}px`} wLabel={formatM(tWidth)} hLabel={formatM(tHeight)} isDark={true}>
                          <div className="w-full h-full bg-white/10 relative flex items-center justify-center rounded-sm">
                            <div className="absolute border-[1.5px] border-dashed border-[#6aaf5b]" style={{top: item.bleedY*tScale, bottom: item.bleedY*tScale, left: item.bleedX*tScale, right: item.bleedX*tScale}}></div>
                          </div>
                        </CADShape>
                      </div>
                    </div>
                  </div>
                </div>
                <PrintFooter sheetNumber={currentNum} totalSheets={totalSheetsCount} isWhiteLabel={isWhiteLabel} />
              </PageWrapper>
            );
          }

          return (
            <div key={idx} className="print:animate-none animate-slide-up" style={{ animationDelay: delay }}>
              {PageComponent}
            </div>
          );
        })}

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes scaleUpFade { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-slide-up { animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-scale-up { animation: scaleUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .animate-fade-down { animation: fadeInDown 0.4s ease-out forwards; opacity: 0; }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            body { background: white !important; margin: 0; padding: 0; }
            @page { size: A4 landscape; margin: 0; }
            .animate-slide-up, .animate-scale-up, .animate-fade-down { animation: none !important; opacity: 1 !important; transform: none !important; }
          }
          .break-after-page { page-break-after: always; break-after: page; }
        `}} />
      </div>
    );
  }

  // --- EDITOR WORKSPACE ---
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
      <div className="min-h-screen bg-[#E8ECEF] py-4 sm:py-8 px-4 sm:px-8" style={{ fontFamily: "'Archivo', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
        <div className="max-w-[1440px] mx-auto bg-[#FFFFFF] rounded-[24px] sm:rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden min-h-[90vh] flex flex-col relative animate-scale-up duration-500">
        
        <header className="px-6 sm:px-8 py-4 sm:py-5 border-b border-[#E8ECEF] flex justify-between items-center bg-white z-20">
          <div className="flex items-center gap-3 sm:gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setStep('setup')}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#F4F5F7] flex items-center justify-center text-[#6aaf5b]"><Layers3 className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            <div className="flex flex-col">
              <h1 className="font-extrabold text-sm sm:text-base text-[#121211] tracking-tight leading-none">{project.event}</h1>
              <span className="text-[9px] sm:text-[10px] font-medium text-[#8A94A6] mt-1 truncate max-w-[120px] sm:max-w-none">{project.client}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
             <button 
               onClick={() => setIsWhiteLabel(!isWhiteLabel)} 
               className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border ${isWhiteLabel ? 'bg-[#121211] text-white border-[#121211] hover:bg-[#333]' : 'bg-white text-[#8A94A6] border-[#E8ECEF] hover:bg-[#F4F5F7] hover:border-[#D1D5DB]'} active:scale-95`}
               title="Oculta o nome 'Inter Produções' do PDF exportado"
             >
               {isWhiteLabel ? <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
               <span className="hidden sm:inline">{isWhiteLabel ? 'Modo Confidencial' : 'Marca Inter'}</span>
             </button>
             <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2.5 bg-[#F4F5F7] rounded-lg lg:hidden hover:bg-[#E8ECEF] active:scale-95 transition-all"><Menu className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative">
          <aside className={` ${isMenuOpen ? 'absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in' : 'hidden'} lg:block lg:col-span-3 border-r border-[#E8ECEF] bg-[#FAFAFA] p-4 sm:p-6 overflow-y-auto`}>
            <div className="flex lg:hidden justify-end mb-4 sm:mb-6"><button onClick={() => setIsMenuOpen(false)} className="bg-[#E8ECEF] p-2.5 rounded-full active:scale-95"><X className="w-4 h-4 sm:w-5 sm:h-5" /></button></div>
            <div className="flex items-center justify-between mb-4 sm:mb-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
              <h2 className="text-[9px] sm:text-[10px] font-bold text-[#8A94A6] uppercase tracking-widest">Setores do Evento</h2>
              <button onClick={handleAddSpace} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-[#121211] hover:text-[#6aaf5b] hover:-translate-y-0.5 hover:shadow-md active:scale-95 transition-all duration-200 border border-[#E8ECEF]"><Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
            </div>
            <ul className="space-y-2 sm:space-y-2.5">
              {spaces.map((s, idx) => (
                <li key={s.id} draggable onDragStart={(_e) => setDraggedSpaceIdx(idx)} onDragOver={(_e) => undefined} onDrop={(e) => onDropSpace(e, idx)} className={`cursor-grab active:cursor-grabbing animate-slide-up ${draggedSpaceIdx === idx ? 'opacity-40 scale-95' : ''}`} style={{ animationDelay: `${(idx + 1) * 50}ms` }}>
                  <button onClick={() => { setActiveSpaceId(s.id); setIsMenuOpen(false); }} className={`w-full text-left p-3 sm:p-3.5 rounded-lg sm:rounded-xl flex items-center justify-between transition-all duration-200 border ${activeSpaceId === s.id ? 'border-[#6aaf5b] bg-white shadow-md -translate-y-0.5' : 'border-transparent hover:bg-white hover:-translate-y-0.5 hover:shadow-sm text-[#5A6270]'}`}>
                    <div className="flex items-center gap-2 sm:gap-2.5 overflow-hidden">
                      <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${activeSpaceId === s.id ? 'opacity-30' : 'opacity-10 hover:opacity-40'}`} />
                      <span className={`font-bold text-xs sm:text-sm truncate ${activeSpaceId === s.id ? 'text-[#121211]' : ''}`}>{s.name}</span>
                    </div>
                    <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md transition-colors ${activeSpaceId === s.id ? 'bg-[#F4F5F7] text-[#121211]' : 'bg-transparent'}`}>{s.items.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <main className="lg:col-span-9 bg-white p-4 sm:p-8 overflow-y-auto relative h-full pb-32">
            <div className="flex justify-between items-center mb-6 sm:mb-8 animate-fade-down" style={{ animationDelay: '100ms' }}>
              <input value={activeSpace?.name || ''} onChange={e => handleUpdateSpaceName(activeSpaceId, e.target.value)} className="text-2xl sm:text-4xl font-extrabold tracking-tight outline-none bg-transparent w-full text-[#121211] placeholder-[#E8ECEF] transition-colors focus:text-[#6aaf5b]" placeholder="NOME DO SETOR" />
              <button onClick={() => handleDeleteSpace(activeSpaceId)} className="p-2 sm:p-2.5 bg-[#F4F5F7] text-[#8A94A6] hover:text-red-500 hover:bg-[#FFF0F0] active:scale-95 rounded-lg sm:rounded-xl transition-all duration-200 shrink-0" title="Apagar Setor"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
              
              <div className="xl:col-span-7 space-y-4 sm:space-y-6">
                <div className="p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] border border-[#E8ECEF] bg-white shadow-sm hover:shadow-md transition-shadow duration-300 animate-slide-up" style={{ animationDelay: '150ms' }}>
                  <div className="flex items-center gap-2 mb-5 sm:mb-6">
                    <div className="w-1 h-4 sm:h-5 bg-[#6aaf5b] rounded-full"></div>
                    <h3 className="font-extrabold text-sm sm:text-base text-[#121211]">Adicionar Peça</h3>
                  </div>
                  <form onSubmit={handleAddItem} className="space-y-4 sm:space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
                      
                      <div className="space-y-1 sm:col-span-2">
                        <label className={labelUI}>QTD.</label>
                        <input type="number" min="1" required value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} className={inputUI} placeholder="1" title="Quantidade de peças idênticas" />
                      </div>

                      <div className="space-y-1 sm:col-span-7">
                        <label className={labelUI}>Identificação</label>
                        <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputUI} placeholder="Ex: Painel Palco" />
                      </div>
                      
                      <div className="sm:col-span-3 flex items-end pb-1">
                        <label className="flex items-center justify-center gap-2 cursor-pointer bg-[#F4F5F7] hover:bg-[#E8ECEF] hover:-translate-y-0.5 active:scale-95 transition-all duration-200 w-full p-3 sm:p-4 rounded-xl border border-transparent h-[48px] sm:h-[54px]">
                          <input type="checkbox" checked={form.isDoubleSided} onChange={e => setForm({...form, isDoubleSided: e.target.checked})} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#6aaf5b] bg-white border-[#8A94A6] rounded focus:ring-[#6aaf5b] focus:ring-2 transition-all" />
                          <span className="text-[10px] sm:text-[11px] font-bold text-[#121211] uppercase tracking-widest leading-none pt-0.5 truncate">Frente/Verso</span>
                        </label>
                      </div>
                      
                      <div className="space-y-1 sm:col-span-6">
                        <label className={labelUI}>Estrutura</label>
                        <select 
                          value={form.type} 
                          onChange={e => {
                            const newType = e.target.value as 'Painel' | 'Balcão';
                            setForm({ ...form, type: newType, s: newType === 'Balcão' ? '0,50' : '', h: newType === 'Balcão' ? '0,90' : '' });
                          }} 
                          className={`${inputUI} appearance-none cursor-pointer`}
                        >
                          <option value="Painel">Painel Reto</option>
                          <option value="Balcão">Balcão (3 Faces)</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1 sm:col-span-6">
                        <div className="flex justify-between items-center mb-1.5 px-1">
                          <label className="block text-[9px] sm:text-[10px] font-bold text-[#8A94A6] tracking-widest uppercase transition-colors">Sangria</label>
                          <button 
                            type="button" 
                            onClick={() => setForm({...form, isCustomBleed: !form.isCustomBleed})} 
                            className="text-[8px] sm:text-[9px] text-[#6aaf5b] font-bold uppercase flex items-center gap-1 hover:text-[#4a8a3f] active:scale-95 transition-all bg-transparent border-none cursor-pointer"
                          >
                            {form.isCustomBleed ? <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3"/> : <Settings2 className="w-2.5 h-2.5 sm:w-3 sm:h-3"/>}
                            {form.isCustomBleed ? 'Padrão' : 'Manual'}
                          </button>
                        </div>
                        
                        {form.isCustomBleed ? (
                          <div className="flex items-center gap-1.5 sm:gap-2 animate-in fade-in zoom-in-95 duration-200">
                            <input type="text" inputMode="decimal" required={form.isCustomBleed} placeholder="Lat (+m)" value={form.customBx} onChange={e => setForm({...form, customBx: e.target.value})} className={`${inputUI} px-2 sm:px-3 text-center !ring-[#eab308]/20 !focus:border-[#eab308] border-[#eab308]/30 bg-[#FFFBEB]`} title="Acréscimo Esquerda/Direita" />
                            <span className="text-[#8A94A6] text-xs font-black">X</span>
                            <input type="text" inputMode="decimal" required={form.isCustomBleed} placeholder="Alt (+m)" value={form.customBy} onChange={e => setForm({...form, customBy: e.target.value})} className={`${inputUI} px-2 sm:px-3 text-center !ring-[#eab308]/20 !focus:border-[#eab308] border-[#eab308]/30 bg-[#FFFBEB]`} title="Acréscimo Topo/Base" />
                          </div>
                        ) : (
                          <select value={form.material} onChange={e => setForm({...form, material: e.target.value})} className={`${inputUI} appearance-none cursor-pointer animate-in fade-in duration-200`}>
                            <option value="Trainel (Madeira)">Trainel (Madeira)</option>
                            <option value="Lona para Q15 (Ilhós)">Lona para Q15 (Ilhós)</option>
                            <option value="Lona para Metalon">Lona para Metalon</option>
                            <option value="Adesivos">Adesivos</option>
                          </select>
                        )}
                      </div>
                    </div>

                    <div className={`p-4 sm:p-5 rounded-[12px] sm:rounded-[16px] border border-[#E8ECEF] bg-[#FAFAFA] grid ${form.type === 'Painel' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'} gap-3 transition-all duration-300`}>
                       {form.type === 'Painel' ? (
                         <>
                          <div className="animate-in fade-in"><label className={labelUI}>Largura Útil (m)</label><input type="text" inputMode="decimal" required value={form.w} onChange={e => setForm({...form, w: e.target.value})} className={`${inputUI} bg-white shadow-sm py-2.5 sm:py-3`} placeholder="Ex: 4,50" /></div>
                          <div className="animate-in fade-in"><label className={labelUI}>Altura Útil (m)</label><input type="text" inputMode="decimal" required value={form.h} onChange={e => setForm({...form, h: e.target.value})} className={`${inputUI} bg-white shadow-sm py-2.5 sm:py-3`} placeholder="Ex: 2,50" /></div>
                         </>
                       ) : (
                         <>
                          <div className="animate-in fade-in"><label className={labelUI}>Frente Útil (m)</label><input type="text" inputMode="decimal" required value={form.f} onChange={e => setForm({...form, f: e.target.value})} className={`${inputUI} bg-white shadow-sm py-2.5 sm:py-3`} placeholder="Ex: 2,00"/></div>
                          <div className="animate-in fade-in"><label className={labelUI}>Lados Úteis (m)</label><input type="text" inputMode="decimal" required value={form.s} onChange={e => setForm({...form, s: e.target.value})} className={`${inputUI} bg-white shadow-sm py-2.5 sm:py-3`} placeholder="Ex: 0,50"/></div>
                          <div className="animate-in fade-in"><label className={labelUI}>Altura Útil (m)</label><input type="text" inputMode="decimal" required value={form.h} onChange={e => setForm({...form, h: e.target.value})} className={`${inputUI} bg-white shadow-sm py-2.5 sm:py-3`} placeholder="Ex: 1,00"/></div>
                         </>
                       )}
                    </div>
                    <button type="submit" className={buttonPrimaryUI}>Criar Peça</button>
                  </form>
                </div>
              </div>

              <div className="xl:col-span-5 space-y-4">
                <div className="flex items-center justify-between px-1 animate-slide-up" style={{ animationDelay: '200ms' }}>
                  <h3 className="font-bold text-xs sm:text-sm text-[#121211]">Peças neste Setor</h3>
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#8A94A6] bg-[#F4F5F7] px-2.5 py-1 rounded-md">{activeSpace?.items.length || 0}</span>
                </div>
                <div className="space-y-2.5 sm:space-y-3">
                  {activeSpace?.items.length === 0 ? (
                    <div className="p-6 sm:p-8 border border-dashed border-[#E8ECEF] rounded-[20px] sm:rounded-[24px] text-center bg-[#FAFAFA] animate-in fade-in duration-500"><Layout className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-[#8A94A6] opacity-40" /><p className="text-[11px] sm:text-xs font-medium text-[#8A94A6]">Nenhuma peça cadastrada.</p></div>
                  ) : (
                    activeSpace?.items.map((item, index) => (
                      <div key={item.id} draggable onDragStart={(_e) => setDraggedItemIdx(index)} onDragOver={(_e) => undefined} onDrop={(e) => onDropItem(e, index)} 
                        className={`p-3 sm:p-4 rounded-[12px] sm:rounded-[16px] border border-[#E8ECEF] bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 transition-all duration-300 hover:border-[#6aaf5b] hover:shadow-md hover:-translate-y-1 cursor-grab active:cursor-grabbing animate-slide-up ${draggedItemIdx === index ? 'opacity-40 scale-95 border-dashed' : ''}`}
                        style={{ animationDelay: `${250 + (index * 50)}ms` }}>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <GripVertical className="w-3.5 h-3.5 text-[#E8ECEF] flex-shrink-0 hidden sm:block hover:text-[#8A94A6] transition-colors" />
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg ${item.material === 'Sangria Especial' ? 'bg-[#eab308]/10' : 'bg-[#F4F5F7]'} flex items-center justify-center flex-shrink-0 transition-colors`}>
                             <FileText className={`w-3.5 h-3.5 ${item.material === 'Sangria Especial' ? 'text-[#eab308]' : 'text-[#121211]'}`} />
                          </div>
                          <div>
                            <h4 className="font-bold text-[11px] sm:text-xs text-[#121211] leading-tight mb-1">
                              {item.qty > 1 && <span className="text-[#6aaf5b] mr-1.5">{item.qty}x</span>}
                              {item.name}
                            </h4>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                               <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-white bg-[#121211] px-1.5 py-0.5 rounded">{item.type}</span>
                               <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded truncate max-w-[100px] ${item.material === 'Sangria Especial' ? 'bg-[#eab308]/10 text-[#eab308]' : 'bg-[#F4F5F7] text-[#8A94A6]'}`}>{item.material}</span>
                               {item.isDoubleSided && <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-[#121211] bg-[#eab308]/20 border border-[#eab308]/30 px-1.5 py-0.5 rounded">Frente & Verso</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:gap-4 w-full sm:w-auto border-t border-[#E8ECEF] sm:border-0 pt-2 sm:pt-0">
                          <div className="text-left sm:text-right"><span className="block text-[7px] sm:text-[8px] font-bold uppercase text-[#8A94A6] mb-0.5">Arquivo Final</span><span className="text-[11px] sm:text-xs font-black text-[#121211]">{formatM(item.totalWidth || item.width)} x {formatM(item.totalHeight || item.height)}M</span></div>
                          <button onClick={() => activeSpace && handleDeleteItem(activeSpace.id, item.id)} className="p-1.5 sm:p-2 bg-[#FFF0F0] text-red-500 rounded-md sm:rounded-lg hover:bg-red-500 hover:text-white active:scale-90 transition-all duration-200"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {spaces.some(s => s.items.length > 0) && (
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-white via-white to-transparent flex justify-center z-10 pointer-events-none animate-slide-up" style={{ animationDelay: '400ms' }}>
                <button onClick={() => setStep('preview')} className="pointer-events-auto flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-[#6aaf5b] text-white font-bold text-[10px] sm:text-[11px] tracking-widest uppercase rounded-full shadow-[0_10px_30px_rgba(106,175,91,0.3)] hover:scale-105 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(106,175,91,0.4)] active:scale-95 transition-all duration-300 ease-out">
                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Gerar Gabaritos
                </button>
              </div>
            )}
          </main>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUpFade { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes scaleUpFade { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
          @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-slide-up { animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
          .animate-scale-up { animation: scaleUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          .animate-fade-down { animation: fadeInDown 0.3s ease-out forwards; opacity: 0; }
        `}} />
        </div>
      </div>
    </>
  );
}