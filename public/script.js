const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const mainQuestions = document.getElementById("mainQuestions");
const allQuestions = document.getElementById("allQuestions");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

let history = JSON.parse(localStorage.getItem("chatHistoryUASD")) || [];

function saveHistory() {
  localStorage.setItem("chatHistoryUASD", JSON.stringify(history));
}

function addMessage(role, text, save = true) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (save) {
    history.push({ role, text });
    saveHistory();
  }
}

function renderHistory() {
  chatBox.innerHTML = "";

  if (history.length === 0) {
    addMessage("bot", "Hola Soy PriceBot 🤖, Tu Asistente Virtual de la UASD, Haz una Pregunta o Selecciona una Opcion...");
    return;
  }

  history.forEach((msg) => addMessage(msg.role, msg.text, false));
}

async function loadQuestions() {
  try {
    const res = await fetch("/api/questions");
    const data = await res.json();

    mainQuestions.innerHTML = "";
    data.main.forEach((question) => {
      const btn = document.createElement("button");
      btn.className = "question-btn";
      btn.textContent = question;
      btn.onclick = () => sendMessage(question);
      mainQuestions.appendChild(btn);
    });

    allQuestions.innerHTML = "";
    data.all.forEach((question) => {
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = question;
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(question);
        } catch (e) {}
        messageInput.value = question;
        messageInput.focus();
      };
      allQuestions.appendChild(btn);
    });
  } catch (error) {
    console.error("Error cargando preguntas:", error);
  }
}

async function sendMessage(message) {
  const cleanMessage = message.trim();
  if (!cleanMessage) return;

  addMessage("user", cleanMessage);
  messageInput.value = "";

  const loading = document.createElement("div");
  loading.className = "message bot";
  loading.textContent = "Escribiendo respuesta...";
  chatBox.appendChild(loading);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: cleanMessage })
    });

    const data = await res.json();
    loading.remove();
    addMessage("bot", data.answer || "No pude generar una respuesta.");
  } catch (error) {
    loading.remove();
    addMessage("bot", "Ocurrió un error al conectar con el servidor.");
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(messageInput.value);
});

clearHistoryBtn.addEventListener("click", () => {
  history = [];
  saveHistory();
  renderHistory();
});

loadQuestions();
renderHistory();


const toggleQuestionsBtn = document.getElementById("toggleQuestionsBtn");
const questionsContainer = document.getElementById("questionsContainer");

toggleQuestionsBtn.addEventListener("click", () => {

  questionsContainer.classList.toggle("show");

  if (questionsContainer.classList.contains("show")) {
    toggleQuestionsBtn.textContent = "Ocultar Preguntas";
  } else {
    toggleQuestionsBtn.textContent = "Mostrar más preguntas";
  }

});