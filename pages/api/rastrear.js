const API_KEY = "CB795F9C6CA49A98F1C424D7DFA70E7E";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });
  const { codigo } = req.query;
  if (!codigo || codigo.length < 8) return res.status(400).json({ erro: "Código inválido" });
  const cod = codigo.trim().toUpperCase();

  try {
    // Tenta buscar via 17track retornando resposta bruta para debug
    const res2 = await fetch("https://api.17track.net/track/v2.2/gettrackinfo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "17token": API_KEY },
      body: JSON.stringify([{ number: cod }]),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res2.json();
    
    // Retorna resposta completa para debug
    return res.status(200).json({ 
      debug: true,
      raw: JSON.stringify(data).slice(0, 2000)
    });

  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
}
