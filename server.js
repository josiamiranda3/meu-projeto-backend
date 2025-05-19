// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const Papa = require('papaparse');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Rota: ocorrências fixas de espécies ameaçadas
app.get('/api/ocorrencias', async (req, res) => {
  const especies = [
    { cientifico: 'Panthera onca', comum: 'Onça-pintada' },
    { cientifico: 'Leontopithecus rosalia', comum: 'Mico-leão-dourado' },
    { cientifico: 'Chelonia mydas', comum: 'Tartaruga-Marinha' }
  ];

  const resultados = [];

  for (const especie of especies) {
    try {
      const response = await axios.get('https://api.gbif.org/v1/occurrence/search', {
        params: {
          scientificName: especie.cientifico,
          country: 'BR',
          limit: 5
        }
      });

      const dados = response.data.results.map((item) => ({
        especie: especie.comum,
        cidade: item.stateProvince || 'Local não informado',
        data: item.eventDate || 'Data não informada'
      }));

      resultados.push(...dados);
    } catch (err) {
      console.error(`Erro ao buscar dados para ${especie.comum}:`, err.message);
    }
  }

  res.json(resultados);
});

// Rota: dados globais de CO₂
app.get('/api/co2', async (req, res) => {
  const url = 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv';

  https.get(url, (response) => {
    let rawData = '';
    response.on('data', chunk => rawData += chunk);
    response.on('end', () => {
      const parsed = Papa.parse(rawData, { header: true, skipEmptyLines: true });
      const data = parsed.data;

      const filtered = data.filter(d =>
        (d.country === 'Brazil' || d.country === 'World') && d.co2 && d.co2_per_capita
      );

      const latestYear = Math.max(...filtered.map(d => parseInt(d.year)));
      const latestData = filtered.filter(d => parseInt(d.year) === latestYear);

      const resultados = latestData.map(d => ({
        pais: d.country,
        ano: latestYear,
        co2: parseFloat(d.co2).toFixed(2),
        perCapita: parseFloat(d.co2_per_capita).toFixed(2)
      }));

      res.json(resultados);
    });
  }).on('error', err => {
    console.error('Erro ao buscar CSV:', err.message);
    res.status(500).json({ error: 'Erro ao carregar dados de CO₂' });
  });
});

// Rota: busca personalizada de espécies
app.get('/api/ocorrencias/custom', async (req, res) => {
  const { scientificName, country, limit } = req.query;

  if (!scientificName || !country) {
    return res.status(400).json({ error: 'Parâmetros obrigatórios: scientificName e country.' });
  }

  const url = 'https://api.gbif.org/v1/occurrence/search';
  const params = {
    scientificName,
    country,
    hasCoordinate: 'true',
    limit: limit || 10
  };

  try {
    const response = await axios.get(url, { params });
    const dados = response.data.results;

    if (!dados.length) {
      return res.json([]);
    }

    const ocorrencias = dados.map((item) => ({
      especie: item.species || 'Desconhecida',
      latitude: item.decimalLatitude,
      longitude: item.decimalLongitude,
      data: item.eventDate,
      fonte: item.datasetName
    }));

    res.json(ocorrencias);
  } catch (err) {
    console.error('Erro ao buscar ocorrências personalizadas:', err.message);
    res.status(500).json({ error: 'Erro ao acessar a API do GBIF' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
