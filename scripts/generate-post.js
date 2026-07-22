const fs = require('fs');
const path = require('path');

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function gerarArtigo() {
  if (!NEWS_API_KEY || !GEMINI_API_KEY) {
    throw new Error("As chaves NEWS_API_KEY ou GEMINI_API_KEY não foram encontradas nos Secrets.");
  }

  // 1. Busca notícia na NewsAPI
  const responseNews = await fetch(
    `https://newsapi.org/v2/everything?q=financas OR economia OR investimentos&language=pt&sortBy=publishedAt&pageSize=1&apiKey=${NEWS_API_KEY}`
  );
  const dataNews = await responseNews.json();

  if (dataNews.status !== 'ok' || !dataNews.articles || dataNews.articles.length === 0) {
    console.log("Nenhuma notícia encontrada na NewsAPI hoje.");
    return;
  }

  const noticia = dataNews.articles[0];

  // 2. Prepara o prompt para o Gemini
  const prompt = `
    Você é um redator do portal 'Valorize Finanças'.
    Com base na notícia abaixo, crie um artigo educativo em Português (Brasil).
    
    Título original: ${noticia.title}
    Resumo: ${noticia.description}

    Retorne APENAS um JSON válido no seguinte formato exato (sem formatação markdown ```json):
    {
      "id": "${Date.now()}",
      "title": "Título atraente em PT-BR",
      "slug": "titulo-atraente-slug",
      "date": "${new Date().toISOString().split('T')[0]}",
      "summary": "Resumo de duas frases do artigo",
      "content": "Conteúdo completo com parágrafos separados por \\n\\n"
    }
  `;

  // 3. Chama a API do Gemini
  const responseGemini = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );

  const dataGemini = await responseGemini.json();
  
  if (!dataGemini.candidates || !dataGemini.candidates[0]) {
    console.error("Resposta do Gemini:", JSON.stringify(dataGemini));
    throw new Error("Resposta inválida da API do Gemini.");
  }

  const rawText = dataGemini.candidates[0].content.parts[0].text;
  
  // Extrai o JSON
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Erro ao extrair JSON do Gemini.");
  const novoPost = JSON.parse(jsonMatch[0]);

  // 4. Salva no arquivo src/data/posts.json
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

  // Adiciona o novo post no topo
  listaPosts.unshift(novoPost);

  // Grava o arquivo atualizado
  fs.writeFileSync(caminhoPosts, JSON.stringify(listaPosts, null, 2));
  console.log("Novo artigo gerado e salvo em src/data/posts.json!");
}

gerarArtigo().catch((err) => {
  console.error("Erro na execução:", err);
  process.exit(1);
});
