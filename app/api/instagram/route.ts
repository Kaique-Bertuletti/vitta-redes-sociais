import { carregarPainel, lerPeriodo, ErroInstagram } from "../../../lib/instagram";

export const maxDuration = 60;

// Mesmos dados do painel em formato JSON. Aceita ?dias=7|30|90 ou ?de=AAAA-MM-DD&ate=AAAA-MM-DD.
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  try {
    const painel = await carregarPainel(lerPeriodo(params));
    return Response.json(painel);
  } catch (e) {
    const erro = e instanceof ErroInstagram ? e.message : "Erro inesperado ao buscar os dados.";
    return Response.json({ erro }, { status: 502 });
  }
}
