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
    required: true,
    index: true // Préparation pour Shard Key { entrepriseId: 1 }
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
    required: true, 
    index: true // Préparation pour Shard Key { entrepriseId: 1 }
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
    required: true, 
    index: true // Préparation pour Shard Key { entrepriseId: 1 }
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
  assigneA: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  dateEcheance: { type: Date },
  dateCreation: { type: Date, default: Date.now }
});

// Index composés pour des requêtes de filtrage ultra performantes
tacheSchema.index({ entrepriseId: 1, projetId: 1, statut: 1 });
projetSchema.index({ entrepriseId: 1 });
utilisateurSchema.index({ entrepriseId: 1, email: 1 });

const Entreprise = mongoose.model('Entreprise', entrepriseSchema);
const Utilisateur = mongoose.model('Utilisateur', utilisateurSchema);
const Projet = mongoose.model('Projet', projetSchema);
const Tache = mongoose.model('Tache', tacheSchema);

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
  await Tache.create([
    {
      entrepriseId: ent1._id,
      projetId: proj1._id,
      titre: 'Définir la Shard Key pour MongoDB',
      description: 'Choisir la clé de hachage optimale pour distribuer les collections multi-tenant.',
      statut: 'todo',
      priorite: 'high',
      assigneA: alice._id,
      dateEcheance: new Date(Date.now() + 7 * 24 * 3600 * 1000)
    },
    {
      entrepriseId: ent1._id,
      projetId: proj1._id,
      titre: 'Mettre en place la réplication Replica Set',
      description: 'Configurer 1 primaire, 2 secondaires et arbitre pour tolérance aux pannes.',
      statut: 'in_progress',
      priorite: 'high',
      assigneA: alice._id,
      dateEcheance: new Date(Date.now() + 3 * 24 * 3600 * 1000)
    },
    {
      entrepriseId: ent1._id,
      projetId: proj1._id,
      titre: 'Conteneurisation Docker & Compose multi-services',
      description: 'Orchestrer l application Express et MongoDB 7 via docker compose.',
      statut: 'done',
      priorite: 'medium',
      assigneA: bob._id,
      dateEcheance: new Date(Date.now() - 1 * 24 * 3600 * 1000)
    }
  ]);

  // Tâches Proj 2 (Mobile)
  await Tache.create([
    {
      entrepriseId: ent1._id,
      projetId: proj2._id,
      titre: 'Implémenter le tableau Kanban en mode tactile',
      description: 'Support fluide du drag and drop sur smartphone et tablette.',
      statut: 'in_progress',
      priorite: 'medium',
      assigneA: bob._id
    },
    {
      entrepriseId: ent1._id,
      projetId: proj2._id,
      titre: 'Validation des maquettes UX avec les bêta-testeurs',
      description: 'Recueillir les retours ergonomiques sur les transitions de statut.',
      statut: 'done',
      priorite: 'low',
      assigneA: clara._id
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
      assigneA: emma._id
    },
    {
      entrepriseId: ent2._id,
      projetId: proj3._id,
      titre: 'Moodboard et charte typographique',
      description: 'Validation de la typographie Inter et de la palette Tailwind.',
      statut: 'done',
      priorite: 'high',
      assigneA: david._id
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

// Réinitialisation des données de démo
app.post('/api/seed', async (req, res) => {
  try {
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
    await Tache.updateMany({ assigneA: userId }, { $set: { assigneA: null } });
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
      .populate('projetId', 'nom')
      .sort({ dateCreation: -1 });

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taches', async (req, res) => {
  try {
    const { entrepriseId, projetId, titre, description, statut, priorite, assigneA, dateEcheance } = req.body;
    if (!entrepriseId || !projetId || !titre) {
      return res.status(400).json({ error: 'entrepriseId, projetId et titre sont requis' });
    }

    // Vérifier que le projet appartient bien à l'entreprise (étanchéité stricte)
    const projet = await Projet.findOne({ _id: projetId, entrepriseId });
    if (!projet) {
      return res.status(403).json({ error: 'Ce projet n appartient pas à l entreprise active' });
    }

    // Vérifier que l'utilisateur assigné appartient à l'entreprise
    if (assigneA) {
      const user = await Utilisateur.findOne({ _id: assigneA, entrepriseId });
      if (!user) {
        return res.status(403).json({ error: 'L utilisateur assigné n appartient pas à cette entreprise' });
      }
    }

    const tache = new Tache({
      entrepriseId,
      projetId,
      titre,
      description,
      statut: statut || 'todo',
      priorite: priorite || 'medium',
      assigneA: assigneA || null,
      dateEcheance: dateEcheance || null
    });

    await tache.save();
    const populated = await Tache.findById(tache._id)
      .populate('assigneA', 'nom email role')
      .populate('projetId', 'nom');

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/taches/:id', async (req, res) => {
  try {
    const { titre, description, statut, priorite, assigneA, dateEcheance, projetId } = req.body;
    const tache = await Tache.findById(req.params.id);
    if (!tache) return res.status(404).json({ error: 'Tâche introuvable' });

    if (titre !== undefined) tache.titre = titre;
    if (description !== undefined) tache.description = description;
    if (statut !== undefined) tache.statut = statut;
    if (priorite !== undefined) tache.priorite = priorite;
    if (assigneA !== undefined) tache.assigneA = assigneA || null;
    if (dateEcheance !== undefined) tache.dateEcheance = dateEcheance || null;
    if (projetId !== undefined) tache.projetId = projetId;

    await tache.save();
    const updated = await Tache.findById(tache._id)
      .populate('assigneA', 'nom email role')
      .populate('projetId', 'nom');

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mise à jour rapide du statut (Kanban drag-and-drop / click)
app.patch('/api/taches/:id/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    if (!['todo', 'in_progress', 'done'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide (todo, in_progress, done acceptés)' });
    }

    const tache = await Tache.findByIdAndUpdate(
      req.params.id, 
      { statut }, 
      { new: true }
    ).populate('assigneA', 'nom email role').populate('projetId', 'nom');

    if (!tache) return res.status(404).json({ error: 'Tâche introuvable' });
    res.json(tache);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/taches/:id', async (req, res) => {
  try {
    const deleted = await Tache.findByIdAndDelete(req.params.id);
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
