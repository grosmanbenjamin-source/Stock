# VolailleStock — PRD

## Original problem statement
Peux tu me faire un système de gestion et suivi de stock? Pour des poulets. Il faudrait un stock de départ ( atelier ) que j'approvisionne chaque semaine. Qui est ensuite distribué dans differents points de ventes. Une fois la journée je dois pouvoir déduire le nombre de poulets vendus. Je rentre que des poulets entiers mais les points de ventes peuvent les vendre soit en entier soit par demi. Il faudrait qu'en fin de journée je puisse dire combien de poulets vendu sur chaque points de ventes pour réajuster le stock. Je peux aussi transférer des poulets d'un points de ventes a un autre.

User choices: admin seul avec mot de passe; stock compté en demis; points de vente créés dans l'app; quantités seulement (pas de CA).

## Architecture
FastAPI + MongoDB (locations: atelier + pos, stock stored as integer halves; movements ledger) ; React + shadcn, JWT Bearer (localStorage). Dates in Europe/Paris.

## Implemented (2026-10-30)
- Login admin (grosman.benjamin@gmail.com), brute-force lockout, change password
- Dashboard: atelier stock, approvisionner, distribuer, transférer (demis acceptés, retour atelier possible), réajuster
- Ventes du jour: saisie entiers + demis par point de vente, date au choix, déjà saisi du jour
- Historique filtrable + annulation d'un mouvement (stock rétabli)
- CRUD points de vente avec seuil d'alerte stock bas

## Backlog
- P1: Rapport hebdomadaire (approvisionné vs vendu vs restant), export CSV/PDF
- P2: Comptes vendeurs par point de vente, date picker FR, pertes/invendus
