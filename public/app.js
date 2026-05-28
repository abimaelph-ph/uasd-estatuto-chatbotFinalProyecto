const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const questionsList = document.getElementById("questionsList");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

function addMessage(type, title, text) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.innerHTML = `<strong>${title}</strong><p>${text}</p>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setLoading(isLoading) {
  const button = chatForm.querySelector("button");
  button.disabled = isLoading;
  button.textContent = isLoading ? "Pensando..." : "Enviar";
}

async function checkStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();

    if (data.ready) {
      statusDot.classList.add("ready");
      statusText.textContent = `Estatuto cargado: ${data.chunks} fragmentos`;
    } else {
      statusDot.classList.add("error");
      statusText.textContent = "No se pudo cargar el Estatuto";
    }
  } catch {
    statusDot.classList.add("error");
    statusText.textContent = "Servidor no disponible";
  }
}

async function loadQuestions() {
  try {
    const response = await fetch("/api/questions");
    const data = await response.json();

    questionsList.innerHTML = "";
    data.questions.forEach(question => {
      const button = document.createElement("button");
      button.className = "question-btn";
      button.textContent = question;
      button.addEventListener("click", () => sendMessage(question));
      questionsList.appendChild(button);
    });
  } catch {
    questionsList.innerHTML = "<p>No se pudieron cargar las preguntas.</p>";
  }
}

async function sendMessage(text) {
  const message = text || messageInput.value.trim();
  if (!message) return;

  addMessage("user", "Tú", message);
  messageInput.value = "";
  setLoading(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      addMessage("error", "Error", data.error || "No se pudo procesar la consulta.");
      return;
    }

    addMessage("bot", "Chatbot UASD", data.answer);
  } catch {
    addMessage("error", "Error", "No se pudo conectar con el servidor.");
  } finally {
    setLoading(false);
  }
}

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage();
});

checkStatus();
loadQuestions();
