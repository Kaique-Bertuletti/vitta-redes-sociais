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
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / DIA_MS) + 1;
}

function inicioDoDia(data: string): number {
  return Math.floor(Date.parse(`${data}T00:00:00${FUSO}`) / 1000);
}

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

// Lê o período pedido na URL (?dias=7 ou ?de=2026-10-01&ate=2026-10-31).
export function lerPeriodo(params: Record<string, string | string[] | undefined>): Periodo {
  const hoje = hojeEmSaoPaulo();
  const limiteAntigo = somarDias(hoje, -730); // a Meta guarda cerca de 2 anos de métricas
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  let de = um(params.de);
  let ate = um(params.ate);

  if (de && ate && DATA_VALIDA.test(de) && DATA_VALIDA.test(ate)) {
    if (de > ate) [de, ate] = [ate, de];
    if (ate > hoje) ate = hoje;
    if (de < limiteAntigo) de = limiteAntigo;
    if (diasEntre(de, ate) > MAX_DIAS) de = somarDias(ate, -(MAX_DIAS - 1));
    return { de, ate, dias: diasEntre(de, ate) };
  }

  const pedido = Number(um(params.dias));
  const dias = [7, 30, 90].includes(pedido) ? pedido : 30;
  return { de: somarDias(hoje, -(dias - 1)), ate: hoje, dias };
}

function periodoAnterior(p: Periodo): Periodo {
  const ate = somarDias(p.de, -1);
  return { de: somarDias(ate, -(p.dias - 1)), ate, dias: p.dias };
}

// ---------- chamadas à API ----------

function credenciais() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const conta = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!token || !conta) {
    throw new ErroInstagram(
      "As variáveis INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_ACCOUNT_ID não estão configuradas na Vercel."
    );
  }
  return { token, conta };
}

type RespostaErro = { error?: { message?: string } };

async function chamar<T>(caminho: string, params: Record<string, string>, revalidar: number): Promise<T> {
  const { token } = credenciais();
  const url = new URL(`${BASE}/${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // O token vai no cabeçalho, nunca na URL.
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: revalidar },
  });
  const json = (await res.json()) as T & RespostaErro;
  if (!res.ok || json.error) {
    throw new ErroInstagram(json.error?.message ?? `A API da Meta respondeu com erro ${res.status}.`);
  }
  return json;
}

type RespostaInsights = { data: { name: string; total_value?: { value: number } }[] };

function vazio(): Metricas {
  return { views: 0, reach: 0, accounts_engaged: 0, total_interactions: 0 };
}

async function metricasEntre(desde: number, ate: number, revalidar: number): Promise<Metricas> {
  const { conta } = credenciais();
  const agora = Math.floor(Date.now() / 1000);
  const json = await chamar<RespostaInsights>(
    `${conta}/insights`,
    {
      metric: METRICAS.join(","),
      metric_type: "total_value",
      period: "day",
      since: String(desde),
      until: String(Math.min(ate, agora)),
    },
    revalidar
  );
  const m = vazio();
  for (const item of json.data) {
    if ((METRICAS as readonly string[]).includes(item.name)) {
      m[item.name as Metrica] = item.total_value?.value ?? 0;
    }
  }
  return m;
}

// Roda as tarefas em paralelo, poucas por vez, para não estourar o limite da Meta.
async function emLotes<T, R>(itens: T[], tamanho: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(tamanho, itens.length) }, trabalhador));
  return saida;
}

function cacheDoDia(data: string, hoje: string): number {
  if (data === hoje) return 900; // hoje: 15 min
  if (diasEntre(data, hoje) <= 3) return 3600; // dias recentes ainda são ajustados pela Meta
  return 21_600; // dias antigos: 6 h
}

async function serieDiaria(p: Periodo): Promise<Dia[]> {
  const hoje = hojeEmSaoPaulo();
  const datas = Array.from({ length: p.dias }, (_, i) => somarDias(p.de, i));
  return emLotes(datas, 6, async (data) => ({
    data,
    ...(await metricasEntre(inicioDoDia(data), inicioDoDia(somarDias(data, 1)), cacheDoDia(data, hoje))),
  }));
}

// A Meta aceita no máximo 30 dias por consulta; períodos maiores são somados em blocos.
async function totaisDoPeriodo(p: Periodo): Promise<{ totais: Metricas; aproximado: boolean }> {
  const blocos: [string, string][] = [];
  for (let inicio = p.de; inicio <= p.ate; inicio = somarDias(inicio, 30)) {
    const fim = somarDias(inicio, 29) < p.ate ? somarDias(inicio, 29) : p.ate;
    blocos.push([inicio, fim]);
  }
  const partes = await Promise.all(
    blocos.map(([a, b]) => metricasEntre(inicioDoDia(a), inicioDoDia(somarDias(b, 1)), 3600))
  );
  const totais = vazio();
  for (const parte of partes) for (const k of METRICAS) totais[k] += parte[k];
  return { totais, aproximado: blocos.length > 1 };
}

async function perfil(): Promise<Perfil> {
  const { conta } = credenciais();
  return chamar<Perfil>(conta, { fields: "username,name,followers_count,media_count" }, 3600);
}

type MidiaBruta = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  timestamp: string;
  permalink: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

type InsightsDaMidia = { data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] };

async function metricasDoPost(id: string): Promise<Pick<Post, "visualizacoes" | "alcance" | "interacoes">> {
  const valor = (json: InsightsDaMidia, nome: string) => {
    const item = json.data.find((d) => d.name === nome);
    return item?.total_value?.value ?? item?.values?.[0]?.value ?? null;
  };
  for (const lista of ["views,reach,total_interactions", "views,reach"]) {
    try {
      const json = await chamar<InsightsDaMidia>(`${id}/insights`, { metric: lista }, 3600);
      return {
        visualizacoes: valor(json, "views"),
        alcance: valor(json, "reach"),
        interacoes: valor(json, "total_interactions"),
      };
    } catch {
      // alguns formatos não aceitam todas as métricas; tenta a lista menor
    }
  }
  return { visualizacoes: null, alcance: null, interacoes: null };
}

function nomeDoTipo(m: MidiaBruta): string {
  if (m.media_product_type === "REELS") return "Reels";
  if (m.media_type === "CAROUSEL_ALBUM") return "Carrossel";
  if (m.media_type === "VIDEO") return "Vídeo";
  return "Foto";
}

async function postsDoPeriodo(p: Periodo): Promise<{ posts: Post[]; total: number }> {
  const { conta } = credenciais();
  const desde = inicioDoDia(p.de) * 1000;
  const ate = inicioDoDia(somarDias(p.ate, 1)) * 1000;
  const encontrados: MidiaBruta[] = [];
  let cursor: string | undefined;

  for (let pagina = 0; pagina < 6; pagina++) {
    const params: Record<string, string> = {
      fields:
        "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count",
      limit: "50",
    };
    if (cursor) params.after = cursor;
    const json = await chamar<{ data: MidiaBruta[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `${conta}/media`,
      params,
      900
    );
    for (const m of json.data) {
      const t = Date.parse(m.timestamp);
      if (t >= desde && t < ate) encontrados.push(m);
    }
    const maisAntigo = json.data.at(-1);
    if (!json.paging?.next || !maisAntigo || Date.parse(maisAntigo.timestamp) < desde) break;
    cursor = json.paging.cursors?.after;
  }

  const recentes = encontrados.slice(0, 12);
  const metricas = await emLotes(recentes, 6, (m) => metricasDoPost(m.id));
  const posts: Post[] = recentes.map((m, i) => ({
    id: m.id,
    legenda: (m.caption ?? "").replace(/\s+/g, " ").trim(),
    tipo: nomeDoTipo(m),
    data: m.timestamp,
    link: m.permalink,
    imagem: m.thumbnail_url ?? m.media_url,
    curtidas: m.like_count ?? 0,
    comentarios: m.comments_count ?? 0,
    ...metricas[i],
  }));
  posts.sort((a, b) => (b.visualizacoes ?? -1) - (a.visualizacoes ?? -1));
  return { posts, total: encontrados.length };
}

export async function carregarPainel(p: Periodo): Promise<Painel> {
  const anterior = periodoAnterior(p);
  const [dadosPerfil, serie, atual, passado, posts] = await Promise.all([
    perfil(),
    serieDiaria(p),
    totaisDoPeriodo(p),
    totaisDoPeriodo(anterior),
    postsDoPeriodo(p),
  ]);
  return {
    periodo: p,
    anterior,
    perfil: dadosPerfil,
    totais: atual.totais,
    totaisAnteriores: passado.totais,
    totaisAproximados: atual.aproximado,
    serie,
    posts: posts.posts,
    postsNoPeriodo: posts.total,
  };
}
