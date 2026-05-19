const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

exports.claudeProxy = onRequest({ secrets: [anthropicKey], cors: false, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  try {
    const apiKey = anthropicKey.value();
    if (!apiKey) { res.status(500).json({ error: "API key not configured" }); return; }

    const { messages, system, maxTokens } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" }); return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens || 1024,
        system: system || "",
        messages,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("claudeProxy error:", err);
    res.status(500).json({ error: err.message });
  }
});
