const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: './config.env' });

const app = express();
app.use(express.json());
app.use(cors());

// Servir le frontend statique (Vue.js / Tailwind)
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/saas_kanban';

// Connexion MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connecté à MongoDB avec succès'))
  .catch(err => console.error('Erreur de connexion MongoDB :', err));

// --- SCHÉMAS MONGOOSE ---
const entrepriseSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  secteur: { type: String },
  dateCreation: { type: Date, default: Date.now }
});

const utilisateurSchema = new mongoose.Schema({
  entrepriseId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Entreprise' },
  nom: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String },
  projetsAssignes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Projet' }]
});

const projetSchema = new mongoose.Schema({
  entrepriseId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Entreprise' },
  nom: { type: String, required: true },
  description: { type: String }
});

const tacheSchema = new mongoose.Schema({
  entrepriseId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Entreprise' },
  projetId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Projet' },
  titre: { type: String, required: true },
  statut: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  assigneA: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }
});

const Entreprise = mongoose.model('Entreprise', entrepriseSchema);
const Utilisateur = mongoose.model('Utilisateur', utilisateurSchema);
const Projet = mongoose.model('Projet', projetSchema);
const Tache = mongoose.model('Tache', tacheSchema);

// --- ROUTES API ---
app.get('/api/entreprises', async (req, res) => {
  try {
    const data = await Entreprise.find();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entreprises', async (req, res) => {
  try {
    const ent = new Entreprise(req.body);
    await ent.save();
    res.status(201).json(ent);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});