// Busca os dados do Instagram da Vitta na API da Meta.
// Roda só no servidor: o token nunca chega ao navegador de quem abre o painel.

const VERSAO_API = "v27.0";
const BASE = `https://graph.facebook.com/${VERSAO_API}`;
const FUSO = "-03:00"; // horário de Brasília
const MAX_DIAS = 90;
const DIA_MS = 86_400_000;

export const METRICAS = ["views", "reach", "accounts_engaged", "total_interactions"] as const;
export type Metrica = (typeof METRICAS)[number];
export type Metricas = Record<Metrica, number>;

export type Perfil = {
  username: string;
  name?: string;
  followers_count?: number;
  media_count?: number;
};

export type Dia = { data: string } & Metricas;

export type Post = {
  id: string;
  legenda: string;
  tipo: string;
  data: string;
  link: string;
  imagem?: string;
  curtidas: number;
  comentarios: number;
  visualizacoes: number | null;
  alcance: number | null;
  interacoes: number | null;
};

export type Periodo = { de: string; ate: string; dias: number };

export type Painel = {
  periodo: Periodo;
  anterior: Periodo;
  perfil: Perfil;
  totais: Metricas;
  totaisAnteriores: Metricas;
  totaisAproximados: boolean;
  serie: Dia[];
  posts: Post[];
  postsNoPeriodo: number;
};

export class ErroInstagram extends Error {}

// ---------- datas ----------

function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new
