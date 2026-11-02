# SPÉCIFICATION FONCTIONNELLE : OUTIL SAAS DE GESTION DE PROJET & KANBAN
**Formation :** BUT 3 Informatique — Parcours BD / Cloud  
**Projet :** TD1 : Startup – Outil de gestion de projet SaaS (Partie I)  
**Date :** Octobre / Novembre 2026  

---

## 1. Contexte & Vision Produit

Inspirée des standards de référence du marché SaaS (Trello, Notion, ClickUp, Linear), la plateforme **Pulse SaaS** est conçue pour permettre aux entreprises hébergées de piloter collaborativement leurs projets et tâches au sein d'un environnement moderne, réactif et visuel.

La plateforme repose sur un modèle d'hébergement partagé (**Multi-Tenant**) où plusieurs organisations clientes cohabitent au sein de la même infrastructure logicielle et de la même base de données MongoDB, sous réserve d'une **étanchéité stricte** garantie au niveau applicatif.

---

## 2. Authentification & Mécanisme d'Isolation Multi-Tenants

Conformément aux attentes formulées pour l'application SaaS :

### 2.1. Écran d'Accueil & Authentification Préalable
Avant d'accéder au tableau Kanban et aux projets, l'utilisateur passe obligatoirement par un **portail de connexion** :
1. **Connexion par Email Professionnel :** L'utilisateur saisit son adresse email. L'application identifie le collaborateur et résout immédiatement son organisation de rattachement (`entrepriseId`).
2. **Connexion Rapide Démo (1-Clic pour l'évaluation) :** Des raccourcis préconfigurés permettent au correcteur d'entrer instantanément sous l'identité d'Alice Martin (*TechCorp Solutions*) ou de David Leroy (*InnoDesign Studio*) afin de tester le cloisonnement sans devoir créer de compte.
3. **Inscription & Création d'Espace :** Possibilité de créer un profil collaborateur et d'instancier une nouvelle entreprise ou de rejoindre une organisation existante.

### 2.2. Cloisonnement Strict des Données en Session
Dès la connexion validée :
- **Verrouillage du Tenant :** L'interface et l'ensemble des requêtes API sont strictement verrouillées sur l'identifiant unique de l'entreprise (`entrepriseId`).
- **Étanchéité Totale :**
  - Un collaborateur de l'entreprise *TechCorp Solutions* n'a aucune visibilité sur les projets, les membres ou les tâches de l'entreprise *InnoDesign Studio*.
  - Les listes déroulantes (projets, membres à assigner) ne contiennent que les entités de l'entreprise connectée.
  - Il est impossible d'injecter ou d'assigner une ressource transverse d'une entreprise à une autre.
- **Déconnexion & Changement d'Espace :** Un bouton "Déconnexion" dans la barre supérieure purge la session active et permet de basculer vers un autre compte d'une autre entreprise pour constater l'étanchéité.

---

## 3. Périmètre Fonctionnel & Règles de Gestion (CRUD)

### 3.1. Gestion des Entreprises (Tenants)
- **Création & Modification :** Enregistrement du nom, du secteur d'activité et d'une description.
- **Suppression en cascade :** La suppression d'une entreprise entraîne automatiquement la suppression irréversible de l'ensemble de ses collaborateurs, de ses projets et de toutes les tâches associées.

### 3.2. Gestion des Projets
- **CRUD Complet :** Création, modification et suppression de projets au sein de l'entreprise active.
- **Équipe Projet :** Affectation de plusieurs collaborateurs de l'entreprise au projet.
- **Suppression sécurisée :** La suppression d'un projet purge automatiquement l'ensemble des tâches rattachées à ce dernier et met à jour la liste des projets assignés chez les collaborateurs.

### 3.3. Gestion des Utilisateurs (Collaborateurs)
- **CRUD Complet :** Ajout de collaborateurs avec nom, adresse email et rôle / poste (ex: Lead Dev, Product Owner, UI Designer).
- **Rattachement exclusif :** Un collaborateur appartient obligatoirement à une seule entreprise cliente.
- **Suppression propre :** La suppression d'un collaborateur le retire de l'ensemble des projets auxquels il participait et désassigne ses tâches en cours (`assigneA: null`) sans supprimer la tâche elle-même.

### 3.4. Gestion des Tâches & Tableau Kanban
- **Visualisation dynamique en 3 colonnes :**
  - **À faire (Todo) :** Tâches planifiées en attente de prise en charge.
  - **En cours (In Progress) :** Tâches actuellement traitées par un collaborateur.
  - **Terminé (Done) :** Tâches finalisées et validées.
- **Transitions de statut :**
  - Par **glisser-déposer (Drag & Drop)** direct d'une carte entre les colonnes.
  - Par **clic rapide** sur les flèches de transition intégrées sur chaque carte.
- **Attributs d'une tâche :**
  - Titre et description détaillée.
  - Rattachement obligatoire à un projet de l'entreprise active.
  - Attribution nominative à un collaborateur de l'entreprise avec affichage de ses initiales et avatar.
  - Niveau de priorité visuel : Basse (gris), Moyenne (orange), Urgente (rouge).
  - Date d'échéance optionnelle.
- **Filtre par projet :** Possibilité de filtrer le tableau Kanban sur un projet spécifique ou d'afficher toutes les tâches de l'entreprise.

---

## 4. Données de Démonstration & Facilité d'Évaluation

Pour faciliter la recette et la correction du TD :
- L'application précharge automatiquement au premier démarrage deux entreprises distinctes :
  1. **TechCorp Solutions** (Édition Logicielle Cloud) : 3 utilisateurs, 2 projets et 5 tâches réparties dans les colonnes Kanban.
  2. **InnoDesign Studio** (Design & UX) : 2 utilisateurs, 1 projet et 2 tâches.
- Un bouton **"Données Démo"** présent sur l'écran de connexion permet à tout moment de réinitialiser la base de données dans son état propre initial.
