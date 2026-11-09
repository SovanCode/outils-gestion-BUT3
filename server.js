const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Chargement de la configuration d'environnement (config.env prioritaire, puis variables système)
dotenv.config({ path: path.join(__dirname, 'config.env') });

const app = express();
app.use(express.json());
app.use(cors());

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/saas_kanban';

// ==========================================
// 1. SCHÉMAS MONGOOSE & INDEXATION (MULTI-TENANCY)
// ==========================================

// Entreprise (Tenant Racine)
const entrepriseSchema = new mongoose.Schema({
  nom: { type: String, required: [true, 'Le nom est obligatoire'], trim: true },
  secteur: { type: String, trim: true },
  description: { type: String, trim: true },
  dateCreation: { type: Date, default: Date.now }
});

// Utilisateur (Scoped par entrepriseId)
const utilisateurSchema = new mongoose.Schema({
  entrepriseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Entreprise', 
    required: true
  },
  nom: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  role: { type: String, trim: true },
  projetsAssignes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Projet' }],
  dateCreation: { type: Date, default: Date.now }
});

// Projet (Scoped par entrepriseId)
const projetSchema = new mongoose.Schema({
  entrepriseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Entreprise', 
    required: true
  },
  nom: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  membres: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
  dateCreation: { type: Date, default: Date.now }
});

// Tâche (Scoped par entrepriseId et projetId)
const tacheSchema = new mongoose.Schema({
  entrepriseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Entreprise', 
    required: true
  },
  projetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Projet', 
    required: true, 
    index: true 
  },
  titre: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  statut: { 
    type: String, 
    enum: ['todo', 'in_progress', 'done'], 
    default: 'todo' 
  },
  priorite: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  assigneA: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur' }],
  dependances: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tache' }],
  dateEcheance: { type: Date },
  dateCreation: { type: Date, default: Date.now }
});

// Schéma Historique / Logs des modifications de tâches
const tacheLogSchema = new mongoose.Schema({
  entrepriseId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Entreprise', 
    required: true,
    index: true
  },
  tacheId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tache', 
    required: true,
    index: true 
  },
  auteur: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Utilisateur',
    default: null
  },
  action: { type: String, required: true },
  champModifie: { type: String },
  valeurAvant: { type: mongoose.Schema.Types.Mixed, default: null },
  valeurApres: { type: mongoose.Schema.Types.Mixed, default: null },
  message: { type: String },
  dateAction: { type: Date, default: Date.now }
});

// ==========================================
// DÉCLARATION CENTRALISÉE DES INDEX
// (Préparation Shard Key { entrepriseId: 1 } sans doublon)
// ==========================================
utilisateurSchema.index({ entrepriseId: 1 });
utilisateurSchema.index({ entrepriseId: 1, email: 1 });

projetSchema.index({ entrepriseId: 1 });

tacheSchema.index({ entrepriseId: 1 });
tacheSchema.index({ entrepriseId: 1, projetId: 1, statut: 1 });

const Entreprise = mongoose.model('Entreprise', entrepriseSchema);
const Utilisateur = mongoose.model('Utilisateur', utilisateurSchema);
const Projet = mongoose.model('Projet', projetSchema);
const Tache = mongoose.model('Tache', tacheSchema);
const TacheLog = mongoose.model('TacheLog', tacheLogSchema);

// ==========================================
// 2. DONNÉES INITIALES (DEMO / SEED)
// ==========================================
async function seedDatabase() {
  const count = await Entreprise.countDocuments();
  if (count > 0) return;

  console.log('🌱 Initialisation des données de démonstration multi-entreprises...');

  // Entreprise 1
  const ent1 = await Entreprise.create({
    nom: 'TechCorp Solutions',
    secteur: 'Édition Logicielle Cloud',
    description: 'Leader des solutions SaaS collaboratives haute disponibilité.'
  });

  // Utilisateurs TechCorp
  const alice = await Utilisateur.create({
    entrepriseId: ent1._id,
    nom: 'Alice Martin',
    email: 'alice.martin@techcorp.fr',
    role: 'Lead Développeuse Backend'
  });

  const bob = await Utilisateur.create({
    entrepriseId: ent1._id,
    nom: 'Bob Dupont',
    email: 'bob.dupont@techcorp.fr',
    role: 'Développeur Fullstack'
  });

  const clara = await Utilisateur.create({
    entrepriseId: ent1._id,
    nom: 'Clara Moreau',
    email: 'clara.moreau@techcorp.fr',
    role: 'Product Owner'
  });

  // Projets TechCorp
  const proj1 = await Projet.create({
    entrepriseId: ent1._id,
    nom: 'Refonte Architecture Cloud & Sharding',
    description: 'Transition vers cluster distribué MongoDB sharded & haute disponibilité.',
    membres: [alice._id, bob._id]
  });

  const proj2 = await Projet.create({
    entrepriseId: ent1._id,
    nom: 'Application Mobile iOS/Android',
    description: 'Client mobile React Native connecté aux APIs SaaS.',
    membres: [bob._id, clara._id]
  });

  // Mise à jour des projets assignés chez les utilisateurs
  await Utilisateur.findByIdAndUpdate(alice._id, { $addToSet: { projetsAssignes: proj1._id } });
  await Utilisateur.findByIdAndUpdate(bob._id, { $addToSet: { projetsAssignes: [proj1._id, proj2._id] } });
  await Utilisateur.findByIdAndUpdate(clara._id, { $addToSet: { projetsAssignes: proj2._id } });

  // Tâches Proj 1 (Refonte)
  const [tacheDocker] = await Tache.create([
    {
      entrepriseId: ent1._id,
      projetId: proj1._id,
      titre: 'Conteneurisation Docker & Compose multi-services',
      description: 'Orchestrer l application Express et MongoDB 7 via docker compose.',
      statut: 'done',
      priorite: 'medium',
      assigneA: [bob._id],
      dependances: [],
      dateEcheance: new Date(Date.now() - 1 * 24 * 3600 * 1000)
    }
  ]);

  const [tacheReplica] = await Tache.create([
    {
      entrepriseId: ent1._id,
      projetId: proj1._id,
      titre: 'Mettre en place la réplication Replica Set',
      description: 'Configurer 1 primaire, 2 secondaires et arbitre pour tolérance aux pannes.',
      statut: 'in_progress',
      priorite: 'high',
      assigneA: [alice._id, bob._id],
      dependances: [tacheDocker._id],
      dateEcheance: new Date(Date.now() + 3 * 24 * 3600 * 1000)
    }
  ]);

  await Tache.create([
    {
      entrepriseId: ent1._id,
      projetId: proj1._id,
      titre: 'Définir la Shard Key pour MongoDB',
      description: 'Choisir la clé de hachage optimale pour distribuer les collections multi-tenant.',
      statut: 'todo',
      priorite: 'high',
      assigneA: [alice._id],
      dependances: [tacheReplica._id],
      dateEcheance: new Date(Date.now() + 7 * 24 * 3600 * 1000)
    }
  ]);

  // Logs initiaux de démonstration
  await TacheLog.create([
    {
      entrepriseId: ent1._id,
      tacheId: tacheDocker._id,
      auteur: bob._id,
      action: 'creation',
      message: 'Création initiale de la tâche',
      valeurAvant: null,
      valeurApres: { titre: tacheDocker.titre, statut: 'todo' }
    },
    {
      entrepriseId: ent1._id,
      tacheId: tacheDocker._id,
      auteur: bob._id,
      action: 'deplacement_statut',
      champModifie: 'statut',
      valeurAvant: 'in_progress',
      valeurApres: 'done',
      message: 'Statut passé de "in_progress" à "done"'
    }
  ]);

  // Tâches Proj 2 (Mobile)
  const [tacheTactile] = await Tache.create([
    {
      entrepriseId: ent1._id,
      projetId: proj2._id,
      titre: 'Implémenter le tableau Kanban en mode tactile',
      description: 'Support fluide du drag and drop sur smartphone et tablette.',
      statut: 'in_progress',
      priorite: 'medium',
      assigneA: [bob._id, clara._id],
      dependances: []
    }
  ]);

  await Tache.create([
    {
      entrepriseId: ent1._id,
      projetId: proj2._id,
      titre: 'Validation des maquettes UX avec les bêta-testeurs',
      description: 'Recueillir les retours ergonomiques sur les transitions de statut.',
      statut: 'done',
      priorite: 'low',
      assigneA: [clara._id],
      dependances: []
    }
  ]);

  // Entreprise 2 (Isolation stricte vérifiable)
  const ent2 = await Entreprise.create({
    nom: 'InnoDesign Studio',
    secteur: 'Agence Design & Expérience Utilisateur',
    description: 'Studio spécialisé en design system et identités numériques.'
  });

  const david = await Utilisateur.create({
    entrepriseId: ent2._id,
    nom: 'David Leroy',
    email: 'david.leroy@innodesign.io',
    role: 'Directeur Artistique'
  });

  const emma = await Utilisateur.create({
    entrepriseId: ent2._id,
    nom: 'Emma Petit',
    email: 'emma.petit@innodesign.io',
    role: 'UI Designer'
  });

  const proj3 = await Projet.create({
    entrepriseId: ent2._id,
    nom: 'Design System & Branding 2026',
    description: 'Refonte globale du catalogue de composants graphiques.',
    membres: [david._id, emma._id]
  });

  await Tache.create([
    {
      entrepriseId: ent2._id,
      projetId: proj3._id,
      titre: 'Créer les composants de boutons et modals',
      description: 'Variantes Dark et Light mode avec contrastes WCAG AAA.',
      statut: 'todo',
      priorite: 'medium',
      assigneA: [emma._id],
      dependances: []
    },
    {
      entrepriseId: ent2._id,
      projetId: proj3._id,
      titre: 'Moodboard et charte typographique',
      description: 'Validation de la typographie Inter et de la palette Tailwind.',
      statut: 'done',
      priorite: 'high',
      assigneA: [david._id],
      dependances: []
    }
  ]);

  console.log('✅ Base de données initialisée avec succès avec 2 entreprises distinctes !');
}

// ==========================================
// 3. ROUTES API REST (AVEC ISOLATION STRICTE)
// ==========================================

// Santé & vérification
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// --- AUTHENTIFICATION & GESTION DE SESSION ---
// Liste des comptes démo pour connexion rapide 1-clic (demandé pour évaluation fluide)
app.get('/api/auth/demo-users', async (req, res) => {
  try {
    const users = await Utilisateur.find().populate('entrepriseId', 'nom secteur').sort({ nom: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Connexion d'un utilisateur par son email
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Adresse email requise' });

    const user = await Utilisateur.findOne({ email: email.trim().toLowerCase() }).populate('entrepriseId');
    if (!user) {
      return res.status(404).json({ error: 'Aucun collaborateur trouvé avec cet email. Choisissez un compte démo ou inscrivez-vous.' });
    }

    res.json({
      message: 'Connexion réussie',
      user: {
        _id: user._id,
        nom: user.nom,
        email: user.email,
        role: user.role
      },
      entreprise: user.entrepriseId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inscription d'un nouvel utilisateur (avec rattachement ou création d'entreprise)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nom, email, role, entrepriseId, newEntrepriseNom, newEntrepriseSecteur } = req.body;
    if (!nom || !email) {
      return res.status(400).json({ error: 'Nom et email sont obligatoires' });
    }

    const existing = await Utilisateur.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Cette adresse email est déjà enregistrée' });
    }

    let targetEntrepriseId = entrepriseId;
    if (newEntrepriseNom) {
      const newEnt = await Entreprise.create({
        nom: newEntrepriseNom.trim(),
        secteur: newEntrepriseSecteur ? newEntrepriseSecteur.trim() : 'SaaS Tech'
      });
      targetEntrepriseId = newEnt._id;
    }

    if (!targetEntrepriseId) {
      return res.status(400).json({ error: 'Veuillez sélectionner ou créer une entreprise' });
    }

    const user = await Utilisateur.create({
      entrepriseId: targetEntrepriseId,
      nom: nom.trim(),
      email: email.trim().toLowerCase(),
      role: role ? role.trim() : 'Collaborateur'
    });

    const populated = await Utilisateur.findById(user._id).populate('entrepriseId');

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: {
        _id: populated._id,
        nom: populated.nom,
        email: populated.email,
        role: populated.role
      },
      entreprise: populated.entrepriseId
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Vérification de la session active
app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const user = await Utilisateur.findById(userId).populate('entrepriseId');
    if (!user) return res.status(404).json({ error: 'Session expirée ou utilisateur inexistant' });

    res.json({
      user: {
        _id: user._id,
        nom: user.nom,
        email: user.email,
        role: user.role
      },
      entreprise: user.entrepriseId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Réinitialisation des données de démo
app.post('/api/seed', async (req, res) => {
  try {
    await TacheLog.deleteMany({});
    await Tache.deleteMany({});
    await Projet.deleteMany({});
    await Utilisateur.deleteMany({});
    await Entreprise.deleteMany({});
    await seedDatabase();
    res.json({ message: 'Données de démonstration réinitialisées avec succès !' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ENTREPRISES (CRUD) ---
app.get('/api/entreprises', async (req, res) => {
  try {
    const list = await Entreprise.find().sort({ nom: 1 });
    res.json(list);
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

app.put('/api/entreprises/:id', async (req, res) => {
  try {
    const updated = await Entreprise.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Entreprise introuvable' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Suppression en cascade (Entreprise -> Utilisateurs, Projets, Tâches)
app.delete('/api/entreprises/:id', async (req, res) => {
  try {
    const entrepriseId = req.params.id;
    await Tache.deleteMany({ entrepriseId });
    await Projet.deleteMany({ entrepriseId });
    await Utilisateur.deleteMany({ entrepriseId });
    const deleted = await Entreprise.findByIdAndDelete(entrepriseId);
    if (!deleted) return res.status(404).json({ error: 'Entreprise introuvable' });
    res.json({ message: 'Entreprise et toutes ses données associées supprimées avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- UTILISATEURS (CRUD AVEC ISOLATION STRICTE) ---
app.get('/api/utilisateurs', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    if (!entrepriseId) {
      return res.status(400).json({ error: 'Le paramètre entrepriseId est obligatoire (isolation multi-tenant)' });
    }
    const list = await Utilisateur.find({ entrepriseId }).populate('projetsAssignes', 'nom').sort({ nom: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/utilisateurs', async (req, res) => {
  try {
    const { entrepriseId, nom, email, role, projetsAssignes } = req.body;
    if (!entrepriseId) return res.status(400).json({ error: 'entrepriseId requis' });

    const user = new Utilisateur({ entrepriseId, nom, email, role, projetsAssignes });
    await user.save();

    // Mettre à jour les membres des projets concernés
    if (projetsAssignes && projetsAssignes.length > 0) {
      await Projet.updateMany(
        { _id: { $in: projetsAssignes }, entrepriseId },
        { $addToSet: { membres: user._id } }
      );
    }

    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/utilisateurs/:id', async (req, res) => {
  try {
    const { nom, email, role, projetsAssignes } = req.body;
    const user = await Utilisateur.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (nom) user.nom = nom;
    if (email) user.email = email;
    if (role !== undefined) user.role = role;
    if (projetsAssignes !== undefined) {
      // Retirer l'utilisateur des anciens projets non conservés
      const removed = user.projetsAssignes.filter(pId => !projetsAssignes.includes(pId.toString()));
      if (removed.length > 0) {
        await Projet.updateMany({ _id: { $in: removed } }, { $pull: { membres: user._id } });
      }
      // Ajouter l'utilisateur aux nouveaux projets
      if (projetsAssignes.length > 0) {
        await Projet.updateMany({ _id: { $in: projetsAssignes }, entrepriseId: user.entrepriseId }, { $addToSet: { membres: user._id } });
      }
      user.projetsAssignes = projetsAssignes;
    }

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/utilisateurs/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    // Désassigner des tâches
    await Tache.updateMany({ assigneA: userId }, { $pull: { assigneA: userId } });
    // Retirer des projets
    await Projet.updateMany({ membres: userId }, { $pull: { membres: userId } });
    const deleted = await Utilisateur.findByIdAndDelete(userId);
    if (!deleted) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROJETS (CRUD AVEC ISOLATION STRICTE) ---
app.get('/api/projets', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    if (!entrepriseId) {
      return res.status(400).json({ error: 'Le paramètre entrepriseId est obligatoire (isolation multi-tenant)' });
    }
    const list = await Projet.find({ entrepriseId }).populate('membres', 'nom email role').sort({ nom: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projets', async (req, res) => {
  try {
    const { entrepriseId, nom, description, membres } = req.body;
    if (!entrepriseId) return res.status(400).json({ error: 'entrepriseId requis' });

    const projet = new Projet({ entrepriseId, nom, description, membres });
    await projet.save();

    // Mettre à jour les utilisateurs membres
    if (membres && membres.length > 0) {
      await Utilisateur.updateMany(
        { _id: { $in: membres }, entrepriseId },
        { $addToSet: { projetsAssignes: projet._id } }
      );
    }

    res.status(201).json(projet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/projets/:id', async (req, res) => {
  try {
    const { nom, description, membres } = req.body;
    const projet = await Projet.findById(req.params.id);
    if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

    if (nom) projet.nom = nom;
    if (description !== undefined) projet.description = description;

    if (membres !== undefined) {
      // Nettoyer les membres retirés
      const removed = projet.membres.filter(mId => !membres.includes(mId.toString()));
      if (removed.length > 0) {
        await Utilisateur.updateMany({ _id: { $in: removed } }, { $pull: { projetsAssignes: projet._id } });
      }
      // Ajouter aux nouveaux membres
      if (membres.length > 0) {
        await Utilisateur.updateMany({ _id: { $in: membres }, entrepriseId: projet.entrepriseId }, { $addToSet: { projetsAssignes: projet._id } });
      }
      projet.membres = membres;
    }

    await projet.save();
    res.json(projet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Suppression de projet et purge en cascade de ses tâches
app.delete('/api/projets/:id', async (req, res) => {
  try {
    const projetId = req.params.id;
    await Tache.deleteMany({ projetId });
    await Utilisateur.updateMany({ projetsAssignes: projetId }, { $pull: { projetsAssignes: projetId } });
    const deleted = await Projet.findByIdAndDelete(projetId);
    if (!deleted) return res.status(404).json({ error: 'Projet introuvable' });
    res.json({ message: 'Projet et ses tâches associés supprimés avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TÂCHES (CRUD & KANBAN AVEC ISOLATION STRICTE) ---
app.get('/api/taches', async (req, res) => {
  try {
    const { entrepriseId, projetId } = req.query;
    if (!entrepriseId) {
      return res.status(400).json({ error: 'Le paramètre entrepriseId est obligatoire' });
    }

    const filter = { entrepriseId };
    if (projetId) filter.projetId = projetId;

    const list = await Tache.find(filter)
      .populate('assigneA', 'nom email role')
      .populate('dependances', 'titre statut priorite')
      .populate('projetId', 'nom')
      .sort({ dateCreation: -1 });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taches', async (req, res) => {
  try {
    const { entrepriseId, projetId, titre, description, statut, priorite, assigneA, dependances, dateEcheance, userId } = req.body;
    if (!entrepriseId || !projetId || !titre) {
      return res.status(400).json({ error: 'entrepriseId, projetId et titre sont requis' });
    }

    // Vérifier que le projet appartient bien à l'entreprise (étanchéité stricte)
    const projet = await Projet.findOne({ _id: projetId, entrepriseId });
    if (!projet) {
      return res.status(403).json({ error: 'Ce projet n appartient pas à l entreprise active' });
    }

    // Normaliser les assignés en tableau
    let assignesArray = [];
    if (Array.isArray(assigneA)) {
      assignesArray = assigneA.filter(Boolean);
    } else if (assigneA) {
      assignesArray = [assigneA];
    }

    // Vérifier que les utilisateurs assignés appartiennent à l'entreprise
    if (assignesArray.length > 0) {
      const count = await Utilisateur.countDocuments({ _id: { $in: assignesArray }, entrepriseId });
      if (count !== assignesArray.length) {
        return res.status(403).json({ error: 'Un ou plusieurs utilisateurs assignés n appartiennent pas à cette entreprise' });
      }
    }

    // Normaliser les dépendances
    let dependancesArray = [];
    if (Array.isArray(dependances)) {
      dependancesArray = dependances.filter(Boolean);
    } else if (dependances) {
      dependancesArray = [dependances];
    }

    // Vérification de blocage par les dépendances si on tente de créer directement en 'in_progress' ou 'done'
    const targetStatus = statut || 'todo';
    if (targetStatus !== 'todo' && dependancesArray.length > 0) {
      const nonTerminees = await Tache.find({
        _id: { $in: dependancesArray },
        statut: { $ne: 'done' }
      });
      if (nonTerminees.length > 0) {
        const titres = nonTerminees.map(t => `"${t.titre}"`).join(', ');
        return res.status(400).json({
          error: `Impossible de démarrer la tâche : les tâches préalables suivantes doivent être terminées : ${titres}`
        });
      }
    }

    const tache = new Tache({
      entrepriseId,
      projetId,
      titre,
      description,
      statut: targetStatus,
      priorite: priorite || 'medium',
      assigneA: assignesArray,
      dependances: dependancesArray,
      dateEcheance: dateEcheance || null
    });

    await tache.save();

    // Log de création
    const usersAssignes = await Utilisateur.find({ _id: { $in: assignesArray } }, 'nom');
    const nomsAssignes = usersAssignes.map(u => u.nom);
    await TacheLog.create({
      entrepriseId,
      tacheId: tache._id,
      auteur: userId || null,
      action: 'creation',
      champModifie: 'tache',
      valeurAvant: null,
      valeurApres: { 
        titre: tache.titre, 
        statut: tache.statut, 
        description: tache.description,
        assigneA: nomsAssignes 
      },
      message: `Tâche "${tache.titre}" créée`
    });

    const populated = await Tache.findById(tache._id)
      .populate('assigneA', 'nom email role')
      .populate('dependances', 'titre statut priorite')
      .populate('projetId', 'nom');

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/taches/:id', async (req, res) => {
  try {
    const { titre, description, statut, priorite, assigneA, dependances, dateEcheance, projetId, userId } = req.body;
    const tache = await Tache.findById(req.params.id);
    if (!tache) return res.status(404).json({ error: 'Tâche introuvable' });

    const changements = [];

    // Normalisation dépendances
    let dependancesArray = tache.dependances;
    if (dependances !== undefined) {
      dependancesArray = Array.isArray(dependances) ? dependances.filter(d => Boolean(d) && d.toString() !== tache._id.toString()) : (dependances ? [dependances] : []);
    }

    // Si changement de statut vers in_progress ou done, vérifier les dépendances
    if (statut !== undefined && statut !== tache.statut && statut !== 'todo') {
      const depsToCheck = dependancesArray;
      if (depsToCheck && depsToCheck.length > 0) {
        const nonTerminees = await Tache.find({
          _id: { $in: depsToCheck },
          statut: { $ne: 'done' }
        });
        if (nonTerminees.length > 0) {
          const titres = nonTerminees.map(t => `"${t.titre}"`).join(', ');
          return res.status(400).json({
            error: `Action bloquée : la tâche dépend de [${titres}] qui n'est/ne sont pas encore terminée(s)`
          });
        }
      }
    }

    // Détection des changements pour l'historique
    if (statut !== undefined && statut !== tache.statut) {
      changements.push({
        action: 'deplacement_statut',
        champModifie: 'statut',
        valeurAvant: tache.statut,
        valeurApres: statut,
        message: `Statut déplacé de "${tache.statut}" à "${statut}"`
      });
      tache.statut = statut;
    }

    if (description !== undefined && description !== (tache.description || '')) {
      changements.push({
        action: 'modification_description',
        champModifie: 'description',
        valeurAvant: tache.description || '',
        valeurApres: description,
        message: 'Description mise à jour'
      });
      tache.description = description;
    }

    if (titre !== undefined && titre !== tache.titre) {
      changements.push({
        action: 'modification_titre',
        champModifie: 'titre',
        valeurAvant: tache.titre,
        valeurApres: titre,
        message: `Titre modifié de "${tache.titre}" à "${titre}"`
      });
      tache.titre = titre;
    }

    if (priorite !== undefined && priorite !== tache.priorite) {
      changements.push({
        action: 'modification_priorite',
        champModifie: 'priorite',
        valeurAvant: tache.priorite,
        valeurApres: priorite,
        message: `Priorité modifiée de "${tache.priorite}" à "${priorite}"`
      });
      tache.priorite = priorite;
    }

    if (assigneA !== undefined) {
      const newAssignes = Array.isArray(assigneA) ? assigneA.filter(Boolean) : (assigneA ? [assigneA] : []);
      const oldAssignesStr = tache.assigneA.map(a => a.toString()).sort().join(',');
      const newAssignesStr = newAssignes.map(a => a.toString()).sort().join(',');
      if (oldAssignesStr !== newAssignesStr) {
        // Résolution des noms et prénoms pour l'historique
        const usersAvant = await Utilisateur.find({ _id: { $in: tache.assigneA } }, 'nom');
        const usersApres = await Utilisateur.find({ _id: { $in: newAssignes } }, 'nom');
        const nomsAvant = usersAvant.map(u => u.nom);
        const nomsApres = usersApres.map(u => u.nom);

        changements.push({
          action: 'modification_assignation',
          champModifie: 'assigneA',
          valeurAvant: nomsAvant,
          valeurApres: nomsApres,
          message: 'Membres assignés modifiés'
        });
        tache.assigneA = newAssignes;
      }
    }

    if (dependances !== undefined) {
      const oldDepsStr = tache.dependances.map(d => d.toString()).sort().join(',');
      const newDepsStr = dependancesArray.map(d => d.toString()).sort().join(',');
      if (oldDepsStr !== newDepsStr) {
        // Résolution des titres de tâches pour l'historique
        const tachesAvant = await Tache.find({ _id: { $in: tache.dependances } }, 'titre');
        const tachesApres = await Tache.find({ _id: { $in: dependancesArray } }, 'titre');
        const titresAvant = tachesAvant.map(t => t.titre);
        const titresApres = tachesApres.map(t => t.titre);

        changements.push({
          action: 'modification_dependances',
          champModifie: 'dependances',
          valeurAvant: titresAvant,
          valeurApres: titresApres,
          message: 'Tâches dépendantes modifiées'
        });
        tache.dependances = dependancesArray;
      }
    }

    if (dateEcheance !== undefined) tache.dateEcheance = dateEcheance || null;
    if (projetId !== undefined) tache.projetId = projetId;

    await tache.save();

    // Enregistrer les logs
    if (changements.length > 0) {
      for (const ch of changements) {
        await TacheLog.create({
          entrepriseId: tache.entrepriseId,
          tacheId: tache._id,
          auteur: userId || null,
          action: ch.action,
          champModifie: ch.champModifie,
          valeurAvant: ch.valeurAvant,
          valeurApres: ch.valeurApres,
          message: ch.message
        });
      }
    }

    const updated = await Tache.findById(tache._id)
      .populate('assigneA', 'nom email role')
      .populate('dependances', 'titre statut priorite')
      .populate('projetId', 'nom');

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mise à jour rapide du statut (Kanban drag-and-drop / click)
app.patch('/api/taches/:id/statut', async (req, res) => {
  try {
    const { statut, userId } = req.body;
    if (!['todo', 'in_progress', 'done'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide (todo, in_progress, done acceptés)' });
    }

    const tache = await Tache.findById(req.params.id).populate('dependances', 'titre statut');
    if (!tache) return res.status(404).json({ error: 'Tâche introuvable' });

    // Si on tente de déplacer la tâche hors de "todo" (vers in_progress ou done), vérifier ses dépendances
    if (statut !== 'todo' && tache.dependances && tache.dependances.length > 0) {
      const nonTerminees = tache.dependances.filter(d => d && d.statut !== 'done');
      if (nonTerminees.length > 0) {
        const titres = nonTerminees.map(d => `"${d.titre}"`).join(', ');
        return res.status(400).json({
          error: `Impossible de déplacer cette tâche : elle dépend de [${titres}] qui doit/doivent d'abord être terminée(s).`
        });
      }
    }

    const ancienStatut = tache.statut;
    tache.statut = statut;
    await tache.save();

    // Enregistrer le log du déplacement
    if (ancienStatut !== statut) {
      await TacheLog.create({
        entrepriseId: tache.entrepriseId,
        tacheId: tache._id,
        auteur: userId || null,
        action: 'deplacement_statut',
        champModifie: 'statut',
        valeurAvant: ancienStatut,
        valeurApres: statut,
        message: `Statut déplacé de "${ancienStatut}" à "${statut}"`
      });
    }

    const result = await Tache.findById(tache._id)
      .populate('assigneA', 'nom email role')
      .populate('dependances', 'titre statut priorite')
      .populate('projetId', 'nom');

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Récupérer l'historique complet d'une tâche
app.get('/api/taches/:id/logs', async (req, res) => {
  try {
    const logs = await TacheLog.find({ tacheId: req.params.id })
      .populate('auteur', 'nom email role')
      .sort({ dateAction: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une tâche et nettoyer les dépendances et logs associés
app.delete('/api/taches/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    // Retirer cette tâche des dépendances d'autres tâches
    await Tache.updateMany({ dependances: taskId }, { $pull: { dependances: taskId } });
    await TacheLog.deleteMany({ tacheId: taskId });
    const deleted = await Tache.findByIdAndDelete(taskId);
    if (!deleted) return res.status(404).json({ error: 'Tâche introuvable' });
    res.json({ message: 'Tâche supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. CONNEXION MONGODB ET DÉMARRAGE DU SERVEUR
// ==========================================
console.log('🔄 Tentative de connexion à MongoDB via URI :', MONGO_URI);

const connectWithRetry = () => {
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('✅ Connecté avec succès à MongoDB');
      await seedDatabase();
    })
    .catch(err => {
      console.error('❌ Échec de connexion MongoDB, nouvelle tentative dans 3s...', err.message);
      setTimeout(connectWithRetry, 3000);
    });
};

connectWithRetry();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur SaaS Kanban prêt sur http://localhost:${PORT}`);
});

