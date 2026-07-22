import fs from 'fs';
import path from 'path';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function gerarArtigo() {
  // 1. Busca notícia na NewsAPI
  const responseNews = await fetch(
    `https://newsapi.org/v2/everything?q=financas OR economia OR investimentos&language=pt&sortBy=publishedAt&pageSize=1&apiKey=${NEWS_API_KEY}`
  );
  const dataNews = await responseNews.json();
  const noticia = dataNews.articles[0];

  if (!noticia) {
    console.log("Nenhuma notícia encontrada hoje.");
    return;
  }

  // 2. Prepara o prompt para o Gemini reescrever
  const prompt = `
    Você é um redator do portal 'Valorize Finanças'.
    Com base na notícia abaixo, crie um artigo educativo em Português (Brasil).
    
    Título original: ${noticia.title}
    Resumo: ${noticia.description}

    Retorne APENAS um JSON válido no seguinte formato exacto:
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
  const rawText = dataGemini.candidates[0].content.parts[0].text;
  
  // Extrai o JSON retornado pelo Gemini
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Erro ao parsear o JSON do Gemini");
  const novoPost = JSON.parse(jsonMatch[0]);

  // 4. Salva no arquivo src/data/posts.json
  const caminhoPosts = path.resolve('src/data/posts.json');
  
  let listaPosts = [];
  if (fs.existsSync(caminhoPosts)) {
    listaPosts = JSON.parse(fs.readFileSync(caminhoPosts, 'utf-8'));
  }

  // Adiciona o novo artigo no topo da lista
  listaPosts.unshift(novoPost);

  // Garante que a pasta src/data existe
  const pastaData = path.resolve('src/data');
  if (!fs.existsSync(pastaData)) {
    fs.mkdirSync(pastaData, { recursive: true });
  }

  // Escreve o arquivo posts.json
  fs.writeFileSync(caminhoPosts, JSON.stringify(listaPosts, null, 2));
  console.log("Novo artigo salvo com sucesso em src/data/posts.json!");
}

gerarArtigo().catch(console.error);
