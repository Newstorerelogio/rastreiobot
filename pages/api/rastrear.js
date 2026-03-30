// pages/api/rastrear.js
// Usa a API 17track - funciona de qualquer servidor no mundo

const API_KEY = "CB795F9C6CA49A98F1C424D7DFA70E7E";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

  const { codigo } = req.query;
  if (!codigo || codigo.length < 8) return res.status(400).json({ erro: "Código inválido" });

  const cod = codigo.trim().toUpperCase();

  try {
    // Passo 1: Registrar o código (necessário antes de consultar)
    await fetch("https://api.17track.net/track/v2.2/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": API_KEY,
      },
      body: JSON.stringify([{ number: cod, carrier: 3031 }]),
      signal: AbortSignal.timeout(10000),
    });

    // Passo 2: Buscar informações do rastreio
    const res2 = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": API_KEY,
      },
      body: JSON.stringify([{ number: cod, carrier: 3031 }]),
      signal: AbortSignal.timeout(10000),
    });

    if (!res2.ok) throw new Error(`17track HTTP ${res2.status}`);

    const data = await res2.json();

    if (data.code !== 0) throw new Error(`17track erro: ${data.message || data.code}`);

    const item = data.data?.accepted?.[0];
    if (!item) {
      const rejected = data.data?.rejected?.[0];
      throw new Error(rejected?.error?.message || "Código não encontrado");
    }

    const track = item.track;
    const eventos = track?.tracking?.providers?.[0]?.events || track?.events || [];
    const ul = eventos[0];

    if (!ul) {
      return res.status(200).json({
        status: "aguardando",
        evento: "Aguardando postagem",
        local: null, data: null,
        resumo: "Seu pedido ainda não foi postado.",
      });
    }

    const descricao = ul.description || ul.detail || "";
    const d = descricao.toLowerCase();

    // Status baseado no tag do 17track
    const tag = track?.tag || track?.status || 0;
    let status = "em_transito";

    // Tags do 17track: 10=notfound, 20=notfound, 30=notfound, 35=notfound, 40=transit, 50=pickup, 60=undelivered, 65=exception, 70=delivered
    if (tag === 70 || d.includes("entregue") || d.includes("delivered")) status = "entregue";
    else if (tag === 50 || d.includes("saiu para entrega") || d.includes("out for delivery")) status = "saiu_entrega";
    else if (tag === 60 || tag === 65 || d.includes("tentativa") || d.includes("falhou") || d.includes("failed")) status = "problema";
    else if (tag === 10 || tag === 20 || d.includes("postado") || d.includes("coletado")) status = "aguardando";

    const local    = [ul.location, ul.country].filter(Boolean).join(", ") || null;
    const dataHora = ul.time ? ul.time.replace("T", " ").slice(0, 16) : null;

    const statusLabels = {
      entregue: "Entregue", saiu_entrega: "Saiu p/ entrega",
      em_transito: "Em trânsito", aguardando: "Aguardando", problema: "Problema",
    };

    let resumo;
    if (status === "entregue")          resumo = "Seu pedido foi entregue com sucesso! 🎉";
    else if (status === "saiu_entrega") resumo = "Seu pedido saiu para entrega hoje! Fique atento. 📬";
    else if (status === "problema")     resumo = `Houve um problema: ${descricao}.`;
    else if (local)                     resumo = `Seu pedido está em ${local} — ${statusLabels[status]}.`;
    else                                resumo = `Status: ${statusLabels[status] || descricao}.`;

    return res.status(200).json({ status, evento: descricao, local, data: dataHora, resumo });

  } catch (err) {
    console.error("Erro 17track:", err.message);
    return res.status(500).json({ erro: err.message });
  }
}
