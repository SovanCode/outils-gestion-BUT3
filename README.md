# Pulse SaaS - Gestion de Projet & Tableau Kanban Multi-Tenant
> **BUT 3 Informatique — Parcours BD / Cloud**  
> **TD1 : Startup – Outil de gestion de projet SaaS (Partie I)**

Plateforme SaaS collaborative inspirée de Trello, Notion et ClickUp, développée avec **Node.js 20, Express, MongoDB 7, Mongoose, Vue.js 3 et Tailwind CSS**, orchestrée via **Docker Compose**.

L'application intègre un **portail d'authentification** et une **isolation logicielle stricte (Multi-Tenancy)** garantissant l'étanchéité totale des données entre les différentes organisations clientes.

---

## 🚀 Démarrage Rapide en Une Seule Commande

Conformément au cahier des charges, aucune installation préalable de dépendances (`node_modules`) ni configuration manuelle n'est requise. Tout est conteneurisé.

Exécutez simplement à la racine du projet :

```bash
docker compose up -d --build
```

---

## 🌐 Accès à l'Application

Une fois les conteneurs démarrés :
- **Application Web & Portail de Connexion :** [http://localhost:5000](http://localhost:5000)
- **Base de données MongoDB :** `localhost:27017`

---

## 🔑 Portail de Connexion & Comptes de Démonstration (1-Clic)

À l'ouverture sur [http://localhost:5000](http://localhost:5000), vous arrivez directement sur l'écran d'accueil d'authentification :

### 1. Connexion Rapide Démo (Recommandé pour l'évaluation)
Quatre comptes préconfigurés appartenant à 2 entreprises distinctes permettent de tester le cloisonnement immédiatement en un seul clic :

- **🏢 TechCorp Solutions (Édition Logicielle Cloud) :**
  - **Alice Martin** (`alice.martin@techcorp.fr`) — *Lead Développeuse*
  - **Bob Dupont** (`bob.dupont@techcorp.fr`) — *Développeur Fullstack*
- **🎨 InnoDesign Studio (Agence Design & UX) :**
  - **David Leroy** (`david.leroy@innodesign.io`) — *Directeur Artistique*
  - **Emma Petit** (`emma.petit@innodesign.io`) — *UI Designer*

### 2. Démonstration de l'Isolation Stricte Multi-Tenants
1. Connectez-vous en 1 clic en tant que **Alice Martin** (*TechCorp Solutions*).
2. Observez le tableau Kanban, les 2 projets (*Refonte Architecture Cloud* et *Application Mobile*) et les 3 collaborateurs propres à TechCorp.
3. Cliquez sur **Déconnexion** en haut à droite.
4. Connectez-vous en 1 clic en tant que **David Leroy** (*InnoDesign Studio*).
5. **Résultat :** Les données de TechCorp ont totalement disparu. Seuls le projet de design et les tâches d'InnoDesign Studio sont visibles. Aucun croisement de données n'est possible.

### 3. Création d'un Nouvel Espace (Inscription)
L'onglet **"Nouvel Espace / Inscription"** permet également de créer un nouveau compte collaborateur et d'instancier en direct une nouvelle entreprise client.

---

## ⚡ Fonctionnalités Clés

- **Tableau Kanban Dynamique :**
  - 3 colonnes : *À faire*, *En cours*, *Terminé* avec compteurs d'items en temps réel.
  - **Drag & Drop natif HTML5** : glissez-déposez les cartes d'une colonne à une autre.
  - **Boutons de transition rapide** (flèches ⬅️ / ➡️) pour changer le statut en un clic.
  - Badges de priorités visuels (*Basse*, *Moyenne*, *Urgente*).
  - Filtre de vue par projet ou affichage global de l'entreprise.
- **CRUD Complet sur 4 niveaux :**
  - Entreprises, Projets, Collaborateurs, Tâches.
- **Suppression en Cascade Intelligente :**
  - Supprimer une entreprise supprime automatiquement tous ses collaborateurs, projets et tâches associées.
  - Supprimer un projet purge automatiquement toutes ses tâches Kanban.
  - Supprimer un utilisateur désassigne proprement ses tâches sans perte d'information.

---

## 🔮 Anticipation de la Partie II : Sharding & Réplication

Le sujet précise que l'architecture MongoDB évoluera vers un environnement distribué intégrant réplication et sharding sans réécriture du code applicatif :

1. **Découplage de la configuration (`config.env`) :**
   Aucune chaîne de connexion n'est codée en dur. L'application lit `MONGO_URI` depuis le fichier d'environnement.
   - **Partie I (Actuelle) :**
     ```ini
     MONGO_URI=mongodb://mongodb:27017/saas_kanban
     ```
   - **Partie II (Évolution sans modification de code) :**
     ```ini
     MONGO_URI=mongodb://mongos1:27017,mongos2:27017/saas_kanban?replicaSet=rs0
     ```

2. **Clé de Partitionnement (Shard Key) :**
   Toutes les collections (`utilisateurs`, `projets`, `taches`) intègrent systématiquement le champ `entrepriseId` indexé de façon centralisée (sans aucun index dupliqué), permettant de partitionner la base par organisation cliente (`{ entrepriseId: 1 }`). Toutes les données d'une entreprise résideront ainsi sur le même shard (haute localité des requêtes).

---

## 📂 Structure Propre & Plate du Répertoire

```text
td1-saas-kanban/
├── config.env                                         # Configuration des variables d'environnement (MONGO_URI, PORT)
├── .env.example                                       # Modèle de variables d'environnement
├── Dockerfile                                         # Build du conteneur applicatif Node.js 20 Alpine
├── compose.yml                                        # Définition des services MongoDB 7 & App Express (sans doublon)
├── package.json                                       # Dépendances Node (Express, Mongoose, Cors, Dotenv)
├── server.js                                          # API REST, Auth, Mongoose, Multi-tenancy & Seed
├── public/
│   └── index.html                                     # Portail d'authentification + Tableau Kanban interactif Vue 3 / Tailwind
├── SPECIFICATION_TECHNIQUE.md                         # Spécification technique & structures JSON MongoDB
├── SPECIFICATION_FONCTIONNELLE.md                       # Spécification fonctionnelle, multi-tenancy & cycle de vie
├── Dossier_Specifications_Fonctionnelles_et_Techniques.pdf # Dossier officiel PDF
└── README.md                                          # Documentation complète d'installation et d'utilisation
```

---

## 🛑 Arrêt des Conteneurs

Pour arrêter les services :
```bash
docker compose down
```

Pour arrêter et réinitialiser le volume de la base de données :
```bash
docker compose down -v
```
