# SPÉCIFICATION TECHNIQUE D'ARCHITECTURE DE DONNÉES (MONGODB)
**Formation :** BUT 3 Informatique — Parcours BD / Cloud  
**Projet :** TD1 : Startup – Outil de gestion de projet SaaS (Partie I)  
**Date :** Octobre / Novembre 2026  

---

## 1. Vue d'Ensemble de l'Architecture Technique

L'application est conçue selon une architecture **3-tiers conteneurisée**, hébergée via Docker Compose :
- **Client (Frontend) :** Interface monopage réactive servie statiquement (HTML5, Vue.js 3 en mode CDN ESM, Tailwind CSS). Elle intègre un portail d'authentification et un tableau Kanban dynamique avec drag & drop HTML5 natif.
- **Serveur (Backend & API REST) :** Runtime **Node.js 20** avec **Express 4**. Il assure l'authentification des utilisateurs, le cloisonnement strict des requêtes par tenant (`entrepriseId`), et la sérialisation JSON native.
- **Persistance & ODM :** **MongoDB 7** manipulé via l'ODM **Mongoose 8**.
- **Orchestration :** `docker compose` orchestré via le fichier unique **`compose.yml`**, gérant un réseau isolé (`saas-network`) et la persistance des volumes (`mongo_data`).

---

## 2. Modèle de Données & Structures JSON (MongoDB)

Toutes les entités de l'application (en dehors du tenant racine `entreprises`) portent obligatoirement la clé étrangère logiquement isolée **`entrepriseId`**.

### 2.1. Collection `entreprises` (Tenant Racine)

Représente l'organisation cliente hébergée sur la plateforme SaaS.

```json
{
  "_id": { "$oid": "670d1a000000000000000001" },
  "nom": "TechCorp Solutions",
  "secteur": "Édition Logicielle Cloud",
  "description": "Leader des solutions SaaS collaboratives haute disponibilité.",
  "dateCreation": { "$date": "2026-10-14T08:00:00.000Z" }
}
```

- **Règles & Contraintes :**
  - `nom` : Chaîne obligatoire, nettoyée des espaces superflus.
  - La suppression d'un document `entreprise` déclenche la cascade de suppression intégrale de ses utilisateurs, projets et tâches.

---

### 2.2. Collection `utilisateurs` (Collaborateurs & Authentification)

Représente un membre d'une entreprise pouvant être authentifié et assigné à des projets et des tâches.

```json
{
  "_id": { "$oid": "670d1b000000000000000002" },
  "entrepriseId": { "$oid": "670d1a000000000000000001" },
  "nom": "Alice Martin",
  "email": "alice.martin@techcorp.fr",
  "role": "Lead Développeuse Backend",
  "projetsAssignes": [
    { "$oid": "670d1c000000000000000003" }
  ],
  "dateCreation": { "$date": "2026-10-14T08:05:00.000Z" }
}
```

- **Règles & Contraintes :**
  - `entrepriseId` : Référence obligatoire vers `entreprises._id`. Clé de cloisonnement et future Shard Key.
  - `email` : Chaîne normalisée en minuscules, servant d'identifiant de connexion au portail SaaS.
  - `projetsAssignes` : Tableau d'ObjectId référençant les projets de l'entreprise auxquels le collaborateur participe.

---

### 2.3. Collection `projets` (Espaces de Travail)

Regroupe des tâches et rassemble une équipe de collaborateurs de l'entreprise.

```json
{
  "_id": { "$oid": "670d1c000000000000000003" },
  "entrepriseId": { "$oid": "670d1a000000000000000001" },
  "nom": "Refonte Architecture Cloud & Sharding",
  "description": "Transition vers cluster distribué MongoDB sharded & haute disponibilité.",
  "membres": [
    { "$oid": "670d1b000000000000000002" },
    { "$oid": "670d1b000000000000000004" }
  ],
  "dateCreation": { "$date": "2026-10-14T08:10:00.000Z" }
}
```

- **Règles & Contraintes :**
  - `entrepriseId` : Référence obligatoire vers `entreprises._id`.
  - `membres` : Tableau d'ObjectId référençant les collaborateurs de la même entreprise.
  - La suppression d'un document `projet` entraîne automatiquement la purge de l'intégralité des tâches rattachées.

---

### 2.4. Collection `taches` (Items du Tableau Kanban)

Représente une unité de travail affectée à un collaborateur au sein d'un projet.

```json
{
  "_id": { "$oid": "670d1d000000000000000005" },
  "entrepriseId": { "$oid": "670d1a000000000000000001" },
  "projetId": { "$oid": "670d1c000000000000000003" },
  "titre": "Définir la Shard Key pour MongoDB",
  "description": "Choisir la clé de hachage optimale pour distribuer les collections multi-tenant.",
  "statut": "todo",
  "priorite": "high",
  "assigneA": { "$oid": "670d1b000000000000000002" },
  "dateEcheance": { "$date": "2026-10-21T18:00:00.000Z" },
  "dateCreation": { "$date": "2026-10-14T08:15:00.000Z" }
}
```

- **Règles & Contraintes :**
  - `statut` : Enum strict parmi `["todo", "in_progress", "done"]`.
  - `priorite` : Enum strict parmi `["low", "medium", "high"]`.
  - `assigneA` : Référence optionnelle vers un utilisateur de l'entreprise (ou `null`).

---

## 3. Stratégie d'Indexation & Performance (Sans Index en Doublon)

Afin de garantir des temps de réponse constants lors de la montée en charge, d'assurer une étanchéité par tenant et de préparer le sharding sans aucun index dupliqué, les index suivants sont déclarés de façon centralisée :

```javascript
// Index d'isolation et requêtes par tenant (Shard Key { entrepriseId: 1 })
utilisateurSchema.index({ entrepriseId: 1 });
utilisateurSchema.index({ entrepriseId: 1, email: 1 });

projetSchema.index({ entrepriseId: 1 });

tacheSchema.index({ entrepriseId: 1 });
tacheSchema.index({ entrepriseId: 1, projetId: 1, statut: 1 });
```

---

## 4. Endpoints de l'API REST

### 4.1. Authentification & Comptes Démo
- `GET /api/auth/demo-users` : Liste des comptes préconfigurés pour connexion rapide en un clic.
- `POST /api/auth/login` : Connexion par email (`{ email }`), renvoyant l'utilisateur et son organisation.
- `POST /api/auth/register` : Inscription d'un nouvel utilisateur et création optionnelle d'entreprise.
- `GET /api/auth/me` : Récupération du profil et validation de session.

### 4.2. CRUD Métier (Isolé par `entrepriseId`)
- `/api/entreprises` : GET, POST, PUT, DELETE (suppression en cascade).
- `/api/projets` : GET (filtré par `entrepriseId`), POST, PUT, DELETE (purge des tâches).
- `/api/utilisateurs` : GET (filtré par `entrepriseId`), POST, PUT, DELETE (désassignation propre).
- `/api/taches` : GET (filtré par `entrepriseId` et `projetId`), POST, PUT, PATCH (`/api/taches/:id/statut` pour le Kanban), DELETE.

---

## 5. Anticipation de la Partie II : Réplication, Haute Disponibilité & Sharding

Conformément à la directive du TD1 :
> *"Dans la deuxième partie du TD, l'architecture MongoDB évoluera vers un environnement distribué intégrant réplication et sharding. Veillez donc à ce que la connexion à la base de données soit configurable facilement, sans modification du code source de l'application, afin d'anticiper cette évolution et la montée en charge !"*

### 5.1. Découplage Total via Variable d'Environnement (`MONGO_URI`)

Le code source de l'application (`server.js`) ne contient **aucune chaîne de connexion en dur**.  
La chaîne de connexion est injectée depuis `config.env` dans `process.env.MONGO_URI` :

```ini
# Partie I : Instance Standalone
MONGO_URI=mongodb://mongodb:27017/saas_kanban

# Partie II : Bascule vers routeurs distribués mongos avec Replica Set
# MONGO_URI=mongodb://mongos1:27017,mongos2:27017/saas_kanban?replicaSet=rs0&readPreference=secondaryPreferred
```

Lors du passage en Partie II, il suffira de modifier cette ligne dans `config.env` sans toucher au conteneur applicatif ni recompiler le code.

### 5.2. Stratégie de Partitionnement (Shard Key)

Toutes les collections métier (`utilisateurs`, `projets`, `taches`) intègrent déjà l'index `{ entrepriseId: 1 }` :
```javascript
sh.shardCollection("saas_kanban.taches", { "entrepriseId": 1 })
sh.shardCollection("saas_kanban.projets", { "entrepriseId": 1 })
sh.shardCollection("saas_kanban.utilisateurs", { "entrepriseId": 1 })
```
- **Avantage majeur (Locality of Reference) :** Toutes les tâches, membres et projets d'une même entreprise résideront sur le même nœud / shard, évitant ainsi les requêtes dispersées (scatter-gather queries) et garantissant des performances optimales.
