import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { carregarPainel, lerPeriodo, ErroInstagram, type Metricas, type Painel } from "../lib/instagram";
import { GraficoDiario } from "./grafico";

export const maxDuration = 60;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const numero = new Intl.NumberFormat("pt-BR");
const porcento = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

function dataLonga(d: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T12:00:00Z`)
  );
}

function dataPost(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(
    new Date(iso)
  );
}

function variacao(atual: number, anterior: number) {
  if (!anterior) return null;
  return (atual - anterior) / anterior;
}

function Delta({ valor, texto }: { valor: number | null; texto: string }) {
  if (valor === null) return <div className="delta">Sem dados do período anterior</div>;
  const classe = valor > 0 ? "pos" : valor < 0 ? "neg" : "";
  const sinal = valor > 0 ? "+" : "";
  return (
    <div className={`delta ${classe}`}>
      {sinal}
      {porcento.format(valor)} {texto}
    </div>
  );
}

function Kpi(props: { rotulo: string; valor: string; delta?: ReactNode; dica?: string }) {
  return (
    <div className="kpi" title={props.dica}>
      <div className="rotulo">{props.rotulo}</div>
      <div className="valor">{props.valor}</div>
      {props.delta}
    </div>
  );
}

function Periodos({ painel, ativo }: { painel: Pick<Painel, "periodo">; ativo: string }) {
  const hoje = painel.periodo.ate;
  return (
    <nav className="periodos" aria-label="Escolher período">
      <div className="atalhos">
        {[7, 30, 90].map((d) => (
          <a key={d} href={`?dias=${d}`} className="atalho" aria-current={ativo === String(d) ? "page" : undefined}>
            {d} dias
          </a>
        ))}
      </div>
      <form className="intervalo" method="get">
        <label>
          De
          <input type="date" name="de" defaultValue={painel.periodo.de} max={hoje} required />
        </label>
        <label>
          Até
          <input type="date" name="ate" defaultValue={painel.periodo.ate} max={hoje} required />
        </label>
        <button type="submit" aria-current={ativo === "personalizado" ? "page" : undefined}>
          Ver período
        </button>
      </form>
    </nav>
  );
}

function Cabecalho({ usuario, seguidores }: { usuario?: string; seguidores?: number }) {
  const agora = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return (
    <header className="gb-header">
      <div className="wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gb-logo gb-logo--claro" src="/marca-fundo-claro.png" alt="Grupo Bild — Bild e Vitta" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gb-logo gb-logo--escuro" src="/marca-fundo-escuro.png" alt="Grupo Bild — Bild e Vitta" />
        <div className="meta">
          {usuario && (
            <a href={`https://www.instagram.com/${usuario}/`} target="_blank" rel="noreferrer">
              @{usuario}
            </a>
          )}
          {seguidores !== undefined && <span>{numero.format(seguidores)} seguidores</span>}
          <span>Atualizado em {agora}</span>
        </div>
      </div>
    </header>
  );
}

function taxa(m: Metricas) {
  return m.reach ? m.accounts_engaged / m.reach : 0;
}

export default function Page({ searchParams }: Props) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  );
}

function Carregando() {
  return (
    <div className="painel-vitta">
      <header className="gb-header">
        <div className="wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gb-logo gb-logo--claro" src="/marca-fundo-claro.png" alt="Grupo Bild — Bild e Vitta" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gb-logo gb-logo--escuro" src="/marca-fundo-escuro.png" alt="Grupo Bild — Bild e Vitta" />
        </div>
      </header>
      <main className="wrap">
        <section className="hero">
          <span className="gb-faixa" aria-hidden="true" />
          <div>
            <h1>Instagram da Vitta</h1>
            <p>Buscando os dados na Meta…</p>
          </div>
        </section>
      </main>
    </div>
  );
}

async function Conteudo({ searchParams }: Props) {
  await connection(); // sempre busca dados novos a cada visita
  const params = await searchParams;
  const periodo = lerPeriodo(params);
  const ativo = params.de && params.ate ? "personalizado" : String(periodo.dias);

  let painel: Painel;
  try {
    painel = await carregarPainel(periodo);
  } catch (e) {
    const motivo = e instanceof ErroInstagram ? e.message : "Erro inesperado ao montar o painel.";
    return (
      <div className="painel-vitta">
        <Cabecalho />
        <main className="wrap">
          <section className="hero">
            <span className="gb-faixa" aria-hidden="true" />
            <div>
              <h1>Instagram da Vitta</h1>
            </div>
          </section>
          <Periodos painel={{ periodo }} ativo={ativo} />
          <section className="painel aviso" role="alert">
            <h2>Os dados do Instagram não carregaram</h2>
            <p>A Meta respondeu: {motivo}</p>
            <p>
              Confira se o token em Vercel → Settings → Environment Variables é o mais recente e, depois de trocá-lo,
              faça um Redeploy.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const { totais, totaisAnteriores: ant, perfil, serie, posts } = painel;
  const comparacao = `vs. ${painel.periodo.dias} dias anteriores`;
  const aprox = painel.totaisAproximados ? "≈ " : "";
  const dicaAprox = painel.totaisAproximados
    ? "Para períodos acima de 30 dias, a Meta soma blocos de 30 dias; a mesma pessoa pode ser contada mais de uma vez."
    : undefined;
  const taxaAtual = taxa(totais);
  const taxaAnterior = taxa(ant);

  return (
    <div className="painel-vitta">
      <Cabecalho usuario={perfil.username} seguidores={perfil.followers_count} />

      <main className="wrap">
        <section className="hero">
          <span className="gb-faixa" aria-hidden="true" />
          <div>
            <h1>Instagram da Vitta</h1>
            <p>
              {dataLonga(painel.periodo.de)} a {dataLonga(painel.periodo.ate)} · {painel.periodo.dias}{" "}
              {painel.periodo.dias === 1 ? "dia" : "dias"}
            </p>
          </div>
        </section>

        <Periodos painel={painel} ativo={ativo} />

        <section className="kpis" aria-label="Resumo do período">
          <Kpi
            rotulo="Visualizações"
            valor={numero.format(totais.views)}
            delta={<Delta valor={variacao(totais.views, ant.views)} texto={comparacao} />}
            dica="Quantas vezes os posts, reels e stories foram exibidos."
          />
          <Kpi
            rotulo="Contas alcançadas"
            valor={aprox + numero.format(totais.reach)}
            delta={<Delta valor={variacao(totais.reach, ant.reach)} texto={comparacao} />}
            dica={dicaAprox ?? "Pessoas diferentes que viram o conteúdo ao menos uma vez."}
          />
          <Kpi
            rotulo="Interações"
            valor={numero.format(totais.total_interactions)}
            delta={<Delta valor={variacao(totais.total_interactions, ant.total_interactions)} texto={comparacao} />}
            dica="Curtidas, comentários, salvamentos, compartilhamentos e respostas."
          />
          <Kpi
            rotulo="Contas engajadas"
            valor={aprox + numero.format(totais.accounts_engaged)}
            delta={<Delta valor={variacao(totais.accounts_engaged, ant.accounts_engaged)} texto={comparacao} />}
            dica={dicaAprox ?? "Pessoas diferentes que interagiram com o conteúdo."}
          />
          <Kpi
            rotulo="Taxa de engajamento"
            valor={porcento.format(taxaAtual)}
            delta={
              <div className={`delta ${taxaAtual > taxaAnterior ? "pos" : taxaAtual < taxaAnterior ? "neg" : ""}`}>
                {taxaAnterior ? `${porcento.format(taxaAnterior)} no período anterior` : "Sem dados do período anterior"}
              </div>
            }
            dica="Contas engajadas divididas pelas contas alcançadas."
          />
        </section>

        <section className="painel">
          <h2>Visualizações e alcance por dia</h2>
          <GraficoDiario
            dias={serie}
            barras={{ chave: "views", rotulo: "Visualizações" }}
            linha={{ chave: "reach", rotulo: "Contas alcançadas" }}
          />
        </section>

        <section className="painel">
          <h2>Interações por dia</h2>
          <GraficoDiario
            dias={serie}
            barras={{ chave: "total_interactions", rotulo: "Interações" }}
            linha={{ chave: "accounts_engaged", rotulo: "Contas engajadas" }}
          />
        </section>

        <section className="painel">
          <h2>Posts do período</h2>
          {posts.length === 0 ? (
            <p className="vazio">Nenhum post publicado neste período. Escolha um intervalo maior para ver os posts.</p>
          ) : (
            <>
              <p className="nota">
                {painel.postsNoPeriodo > posts.length
                  ? `Os ${posts.length} posts mais recentes de ${painel.postsNoPeriodo} publicados, do mais visto para o menos visto.`
                  : `${posts.length} ${posts.length === 1 ? "post publicado" : "posts publicados"}, do mais visto para o menos visto.`}
              </p>
              <ol className="posts">
                {posts.map((post) => (
                  <li key={post.id} className="post">
                    <a href={post.link} target="_blank" rel="noreferrer" className="post-imagem">
                      {post.imagem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.imagem} alt={post.legenda.slice(0, 80) || `${post.tipo} de ${dataPost(post.data)}`} loading="lazy" />
                      ) : (
                        <span className="sem-imagem">{post.tipo}</span>
                      )}
                    </a>
                    <div className="post-corpo">
                      <div className="post-meta">
                        <span className="post-tipo">{post.tipo}</span>
                        <span>{dataPost(post.data)}</span>
                      </div>
                      <p className="post-legenda">{post.legenda || "Sem legenda"}</p>
                      <dl className="post-numeros">
                        <div>
                          <dt>Visualizações</dt>
                          <dd>{post.visualizacoes === null ? "—" : numero.format(post.visualizacoes)}</dd>
                        </div>
                        <div>
                          <dt>Alcance</dt>
                          <dd>{post.alcance === null ? "—" : numero.format(post.alcance)}</dd>
                        </div>
                        <div>
                          <dt>Interações</dt>
                          <dd>{numero.format(post.interacoes ?? post.curtidas + post.comentarios)}</dd>
                        </div>
                      </dl>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </main>

      <footer className="gb-footer">
        <div className="wrap">
          <span>Fonte: API do Instagram (Meta) · Grupo Bild, uso interno</span>
          <span>Dados atualizados a cada hora</span>
        </div>
      </footer>
    </div>
  );
}
