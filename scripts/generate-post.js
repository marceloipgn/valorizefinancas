const fs = require('fs');
const path = require('path');

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function gerarArtigo() {
  console.log("Iniciando geração de artigo...");

  if (!NEWS_API_KEY || !GEMINI_API_KEY) {
    console.error("ERRO: Verifique se as secrets NEWS_API_KEY e GEMINI_API_KEY foram cadastradas em Settings > Secrets.");
    process.exit(1);
  }

  // 1. Buscar Notícias
  console.log("Buscando notícia na NewsAPI...");
  const newsUrl = `https://newsapi.org/v2/everything?q=financas&language=pt&sortBy=publishedAt&pageSize=1&apiKey=${NEWS_API_KEY}`;
  
  const responseNews = await fetch(newsUrl);
  const dataNews = await responseNews.json();

  if (dataNews.status !== 'ok' || !dataNews.articles || dataNews.articles.length === 0) {
    console.error("Erro na NewsAPI:", JSON.stringify(dataNews));
    process.exit(1);
  }

  const noticia = dataNews.articles[0];
  console.log(`Notícia encontrada: "${noticia.title}"`);

  // 2. Prompt do Gemini (Corrigido sem crases internas)
  const prompt = `
    Atue como redator do portal 'Valorize Finanças'.
    Escreva um artigo em Português (Brasil) baseado nesta notícia:
    Título: ${noticia.title}
    Resumo: ${noticia.description || ''}

    Responda APENAS com um objeto JSON válido, sem nenhum texto antes ou depois e sem blocos de código Markdown:
    {
      "id": "${Date.now()}",
      "title": "Título chamativo",
      "slug": "titulo-chamativo",
      "date": "${new Date().toISOString().split('T')[0]}",
      "summary": "Resumo de duas frases",
      "content": "Conteúdo completo com parágrafos"
    }
  `;

  // 3. Chamada à API do Gemini
  console.log("Enviando solicitação ao Gemini...");
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const responseGemini = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  const dataGemini = await responseGemini.json();

  if (!dataGemini.candidates || !dataGemini.candidates[0]) {
    console.error("Erro na resposta do Gemini:", JSON.stringify(dataGemini));
    process.exit(1);
  }

  const rawText = dataGemini.candidates[0].content.parts[0].text;
  
  // Extrair JSON
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Não foi possível identificar o JSON no texto retornado pelo Gemini:", rawText);
    process.exit(1);
  }

  const novoPost = JSON.parse(jsonMatch[0]);

  // 4. Gravar o arquivo src/data/posts.json
  const pastaData = path.resolve('src/data');
  if (!fs.existsSync(pastaData)) {
    fs.mkdirSync(pastaData, { recursive: true });
  }

  const caminhoPosts = path.join(pastaData, 'posts.json');
  let listaPosts = [];

  if (fs.existsSync(caminhoPosts)) {
    try {
      listaPosts = JSON.parse(fs.readFileSync(caminhoPosts, 'utf-8'));
    } catch (e) {
      listaPosts = [];
    }
  }

  listaPosts.unshift(novoPost);
  fs.writeFileSync(caminhoPosts, JSON.stringify(listaPosts, null, 2));

  console.log("Sucesso! Artigo salvo em src/data/posts.json");
}

gerarArtigo().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
}); 
