import type { Dia, Metrica } from "../lib/instagram";

type Serie = { chave: Metrica; rotulo: string };

const L = 1000; // largura do desenho
const A = 280; // altura do desenho
const M = { topo: 16, dir: 12, base: 30, esq: 56 };

const numero = new Intl.NumberFormat("pt-BR");
const curto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function dataCurta(d: string) {
  const [, mes, dia] = d.split("-");
  return `${dia}/${mes}`;
}

function teto(valor: number) {
  if (valor <= 0) return 10;
  const ordem = 10 ** Math.floor(Math.log10(valor));
  for (const passo of [1, 2, 2.5, 5, 10]) {
    if (passo * ordem >= valor) return passo * ordem;
  }
  return 10 * ordem;
}

// Barras para uma métrica e linha para outra, com valores ao passar o mouse.
export function GraficoDiario({ dias, barras, linha }: { dias: Dia[]; barras: Serie; linha: Serie }) {
  const maximo = teto(Math.max(...dias.map((d) => Math.max(d[barras.chave], d[linha.chave])), 1));
  const largura = L - M.esq - M.dir;
  const altura = A - M.topo - M.base;
  const passo = largura / dias.length;
  const x = (i: number) => M.esq + passo * i + passo / 2;
  const y = (v: number) => M.topo + altura - (v / maximo) * altura;
  const larguraBarra = Math.max(Math.min(passo * 0.62, 28), 2);
  const intervaloRotulo = Math.ceil(dias.length / 10);
  const pontos = dias.map((d, i) => `${x(i)},${y(d[linha.chave])}`).join(" ");

  return (
    <figure className="grafico">
      <figcaption className="legenda">
        <span>
          <i className="marcador marcador-barra" aria-hidden="true" />
          {barras.rotulo}
        </span>
        <span>
          <i className="marcador marcador-linha" aria-hidden="true" />
          {linha.rotulo}
        </span>
      </figcaption>
      <div className="grafico-area">
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${barras.rotulo} e ${linha.rotulo} por dia`}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line className="grade" x1={M.esq} x2={L - M.dir} y1={y(maximo * f)} y2={y(maximo * f)} />
              <text className="eixo" x={M.esq - 10} y={y(maximo * f) + 4} textAnchor="end">
                {curto.format(maximo * f)}
              </text>
            </g>
          ))}

          {dias.map((d, i) => (
            <g key={d.data} className="coluna">
              <rect className="faixa-hover" x={x(i) - passo / 2} y={M.topo} width={passo} height={altura} />
              <rect
                className="barra"
                x={x(i) - larguraBarra / 2}
                y={y(d[barras.chave])}
                width={larguraBarra}
                height={Math.max(M.topo + altura - y(d[barras.chave]), 0)}
              />
              <title>
                {`${dataCurta(d.data)}\n${barras.rotulo}: ${numero.format(d[barras.chave])}\n${linha.rotulo}: ${numero.format(d[linha.chave])}`}
              </title>
              {i % intervaloRotulo === 0 && (
                <text className="eixo" x={x(i)} y={A - 8} textAnchor="middle">
                  {dataCurta(d.data)}
                </text>
              )}
            </g>
          ))}

          <polyline className="linha" points={pontos} />
          {dias.length <= 45 &&
            dias.map((d, i) => <circle key={d.data} className="ponto" cx={x(i)} cy={y(d[linha.chave])} r={3.5} />)}
        </svg>
      </div>
    </figure>
  );
}
