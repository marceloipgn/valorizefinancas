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

  // 1. Buscar Notícias de Finanças e Economia
  console.log("Buscando notícia na NewsAPI...");
  let newsUrl = `https://newsapi.org/v2/everything?q=investimentos OR "educação financeira" OR selic OR "mercado financeiro"&language=pt&sortBy=publishedAt&pageSize=5&apiKey=${NEWS_API_KEY}`;
  
  let responseNews = await fetch(newsUrl);
  let dataNews = await responseNews.json();

  if (dataNews.status !== 'ok' || !dataNews.articles || dataNews.articles.length === 0) {
    console.log("Nenhum resultado na busca primária. Tentando manchetes de negócios...");
    newsUrl = `https://newsapi.org/v2/top-headlines?country=br&category=business&apiKey=${NEWS_API_KEY}`;
    responseNews = await fetch(newsUrl);
    dataNews = await responseNews.json();
  }

  if (dataNews.status !== 'ok' || !dataNews.articles || dataNews.articles.length === 0) {
    console.error("Erro na NewsAPI:", JSON.stringify(dataNews));
    process.exit(1);
  }

  const noticia = dataNews.articles.find(a => a.title && a.title !== '[Removed]') || dataNews.articles[0];
  console.log(`Notícia encontrada: "${noticia.title}"`);

  // 2. Prompt focado estritamente em Finanças Práticas
  const prompt = `
    Atue como redator especialista do portal 'Valorize Finanças'.
    Escreva um artigo prático e focado em educação financeira e impacto no bolso do leitor em Português (Brasil).
    
    Notícia de referência: ${noticia.title}
    Resumo original: ${noticia.description || 'Assunto sobre mercado financeiro e economia.'}

    Responda APENAS com um objeto JSON válido, sem texto antes/depois e sem blocos Markdown:
    {
      "id": "${Date.now()}",
      "title": "Título chamativo sobre finanças pessoais",
      "slug": "titulo-chamativo-sobre-financas",
      "date": "${new Date().toISOString().split('T')[0]}",
      "summary": "Resumo explicativo em duas frases sobre como o tema afeta as finanças do leitor",
      "content": "Artigo completo com dicas práticas de planejamento financeiro e investimentos, dividido em parágrafos simples"
    }
  `;

  // 3. Chamada à API do Gemini usando a versão mais recente (gemini-2.0-flash)
  console.log("Enviando solicitação ao Gemini...");
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  
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

  console.log("Sucesso! Artigo gerado e salvo em src/data/posts.json");
}

gerarArtigo().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
