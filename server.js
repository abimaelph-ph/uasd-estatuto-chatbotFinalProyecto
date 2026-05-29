import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { articles, questionMap } from "./data/knowledgeBase.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite"
});

const mainQuestions = [
  "¿Qué es la Universidad Autónoma de Santo Domingo?",
  "¿Cuál es la misión de la UASD?",
  "¿Cuáles son las funciones fundamentales de la UASD?",
  "¿Qué es el Consejo Universitario?",
  "¿Cuáles son las funciones del Rector?",
  "¿Cuáles son los derechos de los estudiantes?"
];

const allQuestions = questionMap.map((item) => item.question);

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findDirectQuestion(question) {
  const cleanQuestion = normalize(question);

  return questionMap.find((item) => {
    const q = normalize(item.question);
    if (cleanQuestion === q) return true;
    return item.keywords.some((keyword) => cleanQuestion.includes(normalize(keyword)));
  });
}

function scoreArticle(question, article) {
  const q = normalize(question);
  const content = normalize(article.contenido);
  const words = q
    .split(" ")
    .filter((word) => word.length > 3)
    .filter((word) => !["cuales", "sobre", "establece", "universidad", "uasd", "santo", "domingo"].includes(word));

  let score = 0;

  for (const word of words) {
    if (content.includes(word)) score += 2;
  }

  if (q.includes("mision") && content.includes("es mision de la universidad")) score += 25;
  if (q.includes("vision") && content.includes("vision")) score += 18;
  if (q.includes("valores") && content.includes("valores")) score += 18;
  if (q.includes("rector") && content.includes("son atribuciones del rector")) score += 25;
  if (q.includes("consejo universitario") && content.includes("consejo universitario")) score += 20;
  if (q.includes("claustro mayor") && content.includes("claustro mayor")) score += 20;
  if (q.includes("claustro menor") && content.includes("claustro menor")) score += 20;
  if (q.includes("facultades") && content.includes("las facultades son")) score += 20;
  if (q.includes("escuelas") && content.includes("las escuelas son")) score += 20;
  if (q.includes("estudiantes") && content.includes("estudiantes")) score += 12;
  if (q.includes("docente") && content.includes("personal academico")) score += 12;
  if (q.includes("investigacion") && content.includes("investigacion")) score += 12;
  if (q.includes("extension") && content.includes("extension")) score += 12;
  if (q.includes("postgrado") || q.includes("posgrado")) {
    if (content.includes("posgrado") || content.includes("postgrado")) score += 12;
  }
  if (q.includes("patrimonio") && content.includes("patrimonio")) score += 18;
  if (q.includes("regimen disciplinario") && content.includes("regimen disciplinario")) score += 18;

  return score;
}

function getRelevantContext(question, limit = 6) {
  const direct = findDirectQuestion(question);
  let selected = [];

  if (direct && direct.articles.length > 0) {
    selected = articles.filter((article) => direct.articles.includes(String(article.articulo)));
  }

  const ranked = articles
    .map((article) => ({
      ...article,
      score: scoreArticle(question, article)
    }))
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (!selected.some((article) => article.articulo === item.articulo)) {
      selected.push(item);
    }
    if (selected.length >= limit) break;
  }

  return selected
    .slice(0, limit)
    .map((item) => `ARTÍCULO ${item.articulo}\n${item.contenido}`)
    .join("\n\n---\n\n");
}

app.get("/api/status", (req, res) => {
  res.json({
    ready: articles.length > 0,
    articles: articles.length,
    questions: allQuestions.length
  });
});

app.get("/api/questions", (req, res) => {
  res.json({
    main: mainQuestions,
    all: allQuestions
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return res.status(400).json({
        answer: "Escribe una pregunta válida."
      });
    }

    const question = message.trim();
    const context = getRelevantContext(question, 6);

    if (!context || context.length < 80) {
      return res.json({
        answer: "No encontré información suficiente en el Estatuto Orgánico para responder esa pregunta.",
        usedAI: false
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        answer: context.slice(0, 1400),
        usedAI: false
      });
    }

    const prompt = `
Eres un chatbot académico especializado únicamente en el Estatuto Orgánico de la Universidad Autónoma de Santo Domingo (UASD).

REGLAS OBLIGATORIAS:
1. Responde solo con información que aparezca en el CONTEXTO.
2. No inventes datos, fechas, derechos, deberes, funciones ni artículos.
3. Menciona el número de artículo cuando sea útil.
4. Resume en español claro, formal y fácil de entender.
5. Si el contexto no responde la pregunta, di: "No encontré información suficiente en el Estatuto Orgánico para responder esa pregunta."
6. No copies párrafos demasiado largos; explica de forma ordenada.
7. Corrige errores de acentuación o redacción del texto original si aparecen.

PREGUNTA DEL USUARIO:
${question}

CONTEXTO DEL ESTATUTO:
${context}

RESPUESTA:
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();

    res.json({
      answer,
      usedAI: true
    });
  } catch (error) {
    console.error("Error al procesar la pregunta:", error);

    if (error.status === 429) {
      return res.status(429).json({
        answer: "Has realizado demasiadas consultas en poco tiempo. Espera unos segundos e inténtalo nuevamente."
      });
    }

    if (error.status === 403) {
      return res.status(403).json({
        answer: "La API key de Gemini no es válida o fue bloqueada. Debes generar una nueva API key."
      });
    }

    res.status(500).json({
      answer: "Ocurrió un error al procesar la pregunta."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  console.log(`Artículos cargados: ${articles.length}`);
});
