const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const app = express();
app.use(cors());
app.use(express.json());

// Leer base de datos local (Archivos JSON)
const rutasFile = path.join(__dirname, 'data', 'rutas.json');
let rutasDB = [];
try {
  rutasDB = JSON.parse(fs.readFileSync(rutasFile, 'utf8'));
  console.log(`Base de datos cargada: ${rutasDB.length} rutas encontradas.`);
} catch (e) {
  console.log("No se pudo leer rutas.json. El servidor iniciará vacío.");
}

// Endpoint principal de búsqueda de rutas
app.post('/api/routes/find', (req, res) => {
  const { origin, destination } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Origen y Destino requeridos' });
  }

  // Convertir las coordenadas del usuario a puntos de Turf.js
  const originPoint = turf.point([origin.lng, origin.lat]);
  const destPoint = turf.point([destination.lng, destination.lat]);

  const rutasValidas = [];

  // Recorrer la base de datos de combis
  rutasDB.forEach(ruta => {
    // Convertir el trazado de la ruta a formato Turf
    const line = turf.lineString(ruta.lineString.coordinates);
    
    // ¿A qué distancia (en kilómetros) está el origen de la línea de la combi?
    const distanceToOrigin = turf.pointToLineDistance(originPoint, line);
    
    // ¿A qué distancia está el destino de la línea de la combi?
    const distanceToDest = turf.pointToLineDistance(destPoint, line);

    // LÓGICA DE NEGOCIO:
    // Si ambos puntos están a menos de 500 metros (0.5 km) de la ruta, 
    // significa que esta combi le sirve al usuario.
    if (distanceToOrigin < 0.5 && distanceToDest < 0.5) {
      rutasValidas.push(ruta);
    }
  });

  res.json({ routes: rutasValidas });
});

// Endpoint secundario: Caminata
// (Actualmente el Frontend simula la línea de caminata, pero aquí podemos procesar cálculos más adelante)
app.post('/api/routes/walking', (req, res) => {
  res.json({ success: true, message: "Caminata manejada por frontend" });
});

// Puerto 5000 para sincronizar con el Frontend
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🧠 Motor de Rutas ChapaTuRuta corriendo en http://localhost:${PORT}`);
});
