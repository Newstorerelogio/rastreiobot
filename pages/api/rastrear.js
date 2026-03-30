const API_KEY = "CB795F9C6CA49A98F1C424D7DFA70E7E";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });
  const { codigo } = req.query;
  if (!codigo || codigo.length < 8) return res.status(400).json({ erro: "Código inválido" });
  const cod = codigo.trim().toUpperCase();

  try {
    // Registra o código
    await fetch("https://api.17track.net/track/v2.2/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": API_KEY },
      body: JSON.stringify([{ number: cod }]),
      signal: AbortSignal.timeout(10000),
    });

    // Aguarda 5 segundos para o 17track buscar os dados
    await new Promise(r => setTimeout(r, 5000));

    // Consulta os dados
    const res2 = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": API_KEY },
      body: JSON.stringify([{ number: cod }]),
      signal: AbortSignal.timeout(10000),
    });

    if (!res2.ok) throw new Error(`17track HTTP ${res2.status}`);
    const data = await res2.json();
    if (data.code !== 0) throw new Error(`17track erro: ${data.message || data.code}`);

    const item = data.data?.accepted?.[0];
    if (!item) throw new Error("Código não encontrado");

    const track = item.track;
    const eventos = track?.tracking?.providers?.[0]?.events || track?.events || [];
    const ul = eventos[0];

    if (!ul) {
      return res.status(200).json({
        status: "aguardando",
        evento: "Aguardando dados do 17track — tente novamente em 1 minuto",
        local: null, data: null,
        resumo: "Seu pedido foi registrado. Consulte novamente em 1 minuto para ver os dados.",
      });
    }

    const descricao = ul.description || ul.detail || "";
    const tag = track?.tag || 0;
    let status = "em_transito";
    if (tag === 70 || descricao.toLowerCase().includes("entregue")) status = "entregue";
    else if (tag === 50 || descricao.toLowerCase().includes("saiu para entrega")) status = "saiu_entrega";
    else if (tag === 60 || tag === 65) status = "problema";
    else if (tag === 10 || tag === 20) status = "aguardando";

    const local = [ul.location, ul.country].filter(Boolean).join(", ") || null;
    const dataHora = ul.time ? ul.time.replace("T", " ").slice(0, 16) : null;
    const labels = { entregue:"Entregue", saiu_entrega:"Saiu p/ entrega", em_transito:"Em trânsito", aguardando:"Aguardando", problema:"Problema" };

    let resumo;
    if (status === "entregue") resumo = "Seu pedido foi entregue com sucesso! 🎉";
    else if (status === "saiu_entrega") resumo = "Seu pedido saiu para entrega hoje! 📬";
    else if (status === "problema") resumo = `Houve um problema: ${descricao}.`;
    else if (local) resumo = `Seu pedido está em ${local} — ${labels[status]}.`;
    else resumo = `Status: ${labels[status] || descricao}.`;

    return res.status(200).json({ status, evento: descricao, local, data: dataHora, resumo });

  } catch (err) {
    console.error("Erro 17track:", err.message);
    return res.status(500).json({ erro: err.message });
  }
}
