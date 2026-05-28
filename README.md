# Chatbot Web Inteligente para Consulta del Estatuto Orgánico de la UASD

Este proyecto es una aplicación web tipo chatbot que permite consultar el Estatuto Orgánico de la Universidad Autónoma de Santo Domingo usando Node.js, Express, JavaScript e inteligencia artificial.

## Tecnologías usadas

- HTML5
- CSS3
- JavaScript
- Node.js
- Express
- pdf-parse
- OpenAI API

## Estructura

```text
uasd-chatbot/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server.js
├── package.json
├── .env.example
└── README.md
```

## Instalación

1. Instala Node.js.
2. Abre la carpeta del proyecto en VS Code.
3. Ejecuta:

```bash
npm install
```

4. Copia el archivo `.env.example` y renómbralo como `.env`.
5. Coloca tu API key:

```env
OPENAI_API_KEY=tu_clave_aqui
PORT=3000
MODEL=gpt-4.1-mini
```

6. Inicia el proyecto:

```bash
npm start
```

7. Abre en el navegador:

```text
http://localhost:3000
```

## Nota importante

Si no colocas una API key, el sistema funcionará en modo básico: buscará fragmentos del Estatuto y mostrará una respuesta aproximada. Para respuestas inteligentes completas, configura la clave de OpenAI en el archivo `.env`.
