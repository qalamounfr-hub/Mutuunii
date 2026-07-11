// netlify/functions/transcribe.js
//
// Reçoit un petit segment audio (envoyé en base64 par l'app), l'envoie à
// Whisper via l'API gratuite de Groq, et renvoie le texte transcrit.
// La clé API reste ici, côté serveur — elle n'est jamais visible dans le
// navigateur de l'utilisateur.
//
// Nécessite la variable d'environnement GROQ_API_KEY, à définir dans
// Netlify → Site configuration → Environment variables.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GROQ_API_KEY manquante sur Netlify (Site configuration → Environment variables)." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Corps de requête invalide." }) };
  }

  const { audio, mimeType } = payload;
  if (!audio) {
    return { statusCode: 400, body: JSON.stringify({ error: "Audio manquant." }) };
  }

  try {
    const buffer = Buffer.from(audio, "base64");

    const ext = (mimeType || "").includes("mp4") ? "mp4" : (mimeType || "").includes("ogg") ? "ogg" : "webm";
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType || "audio/webm" }), `audio.${ext}`);
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "ar");
    form.append("response_format", "json");
    // Le prompt aide Whisper à mieux reconnaître le vocabulaire du tajwid.
    form.append("prompt", "تلاوة وتجويد، تحفة الأطفال، القرآن الكريم");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return {
        statusCode: groqRes.status,
        body: JSON.stringify({ error: (data && data.error && data.error.message) || "Erreur du service Groq." }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text || "" }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String((err && err.message) || err) }) };
  }
};
