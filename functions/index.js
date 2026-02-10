const cors = require("cors")({ origin: true });
const { GoogleGenAI } = require("@google/genai");

// Função HTTP (API) para o seu site chamar
exports.geminiProxy = async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Use POST" });
      }

      const { prompt } = req.body || {};
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Campo 'prompt' é obrigatório" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });
      }

      const ai = new GoogleGenAI({ apiKey });

      // modelo pode variar — use o que você já usa no app
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });

      const text =
        response?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";

      return res.json({ text });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao chamar Gemini" });
    }
  });
};
