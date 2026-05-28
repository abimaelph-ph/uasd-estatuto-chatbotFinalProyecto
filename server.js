import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import pdf from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const ESTATUTO_URL =
  "https://postgrado.uasd.edu.do/wp-content/uploads/2024/06/ESTATUTO-ORGANICO-UASD.pdf";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

let estatutoText = "";
let chunks = [];

const suggestedQuestions = [
  "¿Qué es la Universidad Autónoma de Santo Domingo?",
  "¿Cuál es la misión de la UASD?",
  "¿Cuáles son los fines de la Universidad?",
  "¿Cuáles son las funciones fundamentales de la UASD?",
  "¿Qué establece el Estatuto sobre la autonomía universitaria?",
  "¿Cuáles son los principios que orientan a la Universidad?",
  "¿Cómo está organizada la Universidad?",
  "¿Cuáles son los organismos de gobierno de la UASD?",
  "¿Qué es el Claustro Mayor?",
  "¿Qué es el Consejo Universitario?",
  "¿Quiénes integran el Consejo Universitario?",
  "¿Cuáles son las funciones del Rector?",
  "¿Qué establece el Estatuto sobre los estudiantes?",
  "¿Cuáles son los derechos de los estudiantes?",
  "¿Cuáles son los deberes de los estudiantes?",
  "¿Qué establece el Estatuto sobre el régimen disciplinario?"
];

function normalizeText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function splitIntoChunks(text, size = 1400, overlap = 220) {
  const clean = normalizeText(text);
  const result = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    result.push(clean.slice(start, end));
    start += size - overlap;
  }

  return result;
}

function scoreChunk(question, chunk) {
  const words = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zñ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const cleanChunk = chunk
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return words.reduce(
    (score, word) => score + (cleanChunk.includes(word) ? 1 : 0),
    0
  );
}

function getRelevantContext(question, limit = 3) {
  const scoredChunks = chunks
    .map((chunk, index) => ({
      index,
      chunk,
      score: scoreChunk(question, chunk)
    }))
    .sort((a, b) => b.score - a.score);

  const bestScore = scoredChunks[0]?.score || 0;

  if (bestScore === 0) {
    return "";
  }

  return scoredChunks
    .filter((item) => item.score >= 1)
    .slice(0, limit)
    .map((item) => `Fragmento ${item.index + 1}: ${item.chunk}`)
    .join("\n\n");
}

async function loadEstatuto() {
  try {
    console.log("Descargando Estatuto Orgánico de la UASD...");

    const response = await axios.get(ESTATUTO_URL, {
      responseType: "arraybuffer"
    });

    const data = await pdf(response.data);
    estatutoText = normalizeText(data.text);
    chunks = splitIntoChunks(estatutoText);

    console.log(
      `Estatuto cargado correctamente. Fragmentos creados: ${chunks.length}`
    );
  } catch (error) {
    console.error("No se pudo cargar el PDF oficial:", error.message);
    estatutoText = "";
    chunks = [];
  }
}

function fallbackAnswer(context) {
  if (!context || context.length < 100) {
    return "No encontré información suficiente en el Estatuto Orgánico para responder esa pregunta.";
  }

  const preview = context
    .replace(/Fragmento \d+:/g, "")
    .slice(0, 700)
    .trim();

  return `Según la información encontrada en el Estatuto Orgánico de la UASD, esta consulta se relaciona con lo siguiente: ${preview}...`;
}

app.get("/api/status", (req, res) => {
  res.json({
    ready: chunks.length > 0,
    chunks: chunks.length,
    source: ESTATUTO_URL
  });
});

app.get("/api/questions", (req, res) => {
  res.json({ questions: suggestedQuestions });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return res.status(400).json({
        error: "Escribe una pregunta válida."
      });
    }

    const question = message.trim();
    const context = getRelevantContext(question, 3);

    if (!context || context.length < 50) {
      return res.json({
        answer:
          "No encontré información suficiente en el Estatuto Orgánico para responder esa pregunta.",
        usedAI: false
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        answer: fallbackAnswer(context),
        usedAI: false
      });
    }

    const prompt = `
Eres un chatbot académico especializado únicamente en el Estatuto Orgánico de la Universidad Autónoma de Santo Domingo (UASD).

Reglas obligatorias:
1. Responde solo con la información que aparece en el contexto proporcionado.
2. No uses conocimiento externo.
3. No inventes artículos, funciones, cargos, derechos ni deberes.
4. Si la pregunta no está relacionada con el Estatuto Orgánico de la UASD, responde exactamente:
"Esta pregunta no está relacionada con el Estatuto Orgánico de la UASD."
5. Si el contexto no contiene información suficiente para responder, responde exactamente:
"No encontré información suficiente en el Estatuto Orgánico para responder esa pregunta."
6. Corrige redacción y acentos al responder.
7. No copies texto dañado del PDF si tiene errores; resume con palabras claras.
8. Responde en español simple, claro y académico.

Pregunta del usuario:
${question}

Contexto encontrado del Estatuto:
${context}

Respuesta:
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      answer: text,
      usedAI: true
    });
  } catch (error) {
    console.error("Error al procesar la pregunta:", error);

    if (error.status === 429) {
  return res.status(429).json({
    error:
      "Has realizado demasiadas consultas en poco tiempo. Espera unos segundos e inténtalo nuevamente."
  });
}

res.status(500).json({
  error: "Ocurrió un error al procesar la pregunta."
});
  }
});

app.listen(PORT, async () => {
  await loadEstatuto();
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});