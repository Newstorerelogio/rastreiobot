const API_KEY = "CB795F9C6CA49A98F1C424D7DFA70E7E";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });
  const { codigo } = req.query;
  if (!codigo || codigo.length < 8) return res.status(400).json({ erro: "Código inválido" });
  const cod = codigo.trim().toUpperCase();

  try {
    await fetch("https://api.17track.net/track/v2.2/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": API_KEY },
      body: JSON.stringify([{ number: cod }]),
      signal: AbortSignal.timeout(10000),
    });

    const res2 = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": API_KEY },
      body: JSON.stringify([{ number: cod }]),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res2.json();
    const item = data.data?.accepted?.[0];
    if (!item) throw new Error("Código não encontrado");

    const track = item.track_info || item.track || {};
    const latest = track.latest_event || {};
    const latestStatus = track.latest_status || {};

    const descricao = latest.description || latestStatus.sub_status_descr || latestStatus.status || "";
    const local = [latest.location, track.recipient_address?.city, track.recipient_address?.state]
      .filter(Boolean).join(", ") || null;
    const dataHora = latest.time_iso ? latest.time_iso.replace("T", " ").slice(0, 16) : null;

    const statusRaw = (latestStatus.status || "").toLowerCase();
    let status = "em_transito";
    if (statusRaw.includes("delivered")) status = "entregue";
    else if (statusRaw.includes("outfordelivery")) status = "saiu_entrega";
    else if (statusRaw.includes("undelivered") || statusRaw.includes("exception")) status = "problema";
    else if (statusRaw.includes("inforeceived") || statusRaw.includes("notfound")) status = "aguardando";

    const labels = { entregue:"Entregue", saiu_entrega:"Saiu p/ entrega", em_transito:"Em trânsito", aguardando:"Aguardand
