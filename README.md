*This project has been created as part of the 42 curriculum by feazeved, alebarbo, dda-fons, wlucas-f.*

<div align="center">

# 🃏 ft_transcendence

**A real-time, multiplayer card-game platform with lobbies, tournaments, spectators, friends and chat.**

![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=white)
![Tailwind](https://img.shields.io/badge/Styling-Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Django](https://img.shields.io/badge/Backend-Django_+_DRF-092E20?logo=django&logoColor=white)
![Channels](https://img.shields.io/badge/Realtime-Django_Channels-44B78B)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Cache_&_Pub/Sub-Redis-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Deploy-Docker_Compose-2496ED?logo=docker&logoColor=white)

[Repository](https://github.com/feazeved/ft_transcendence)

</div>

---

## Table of Contents

1. [Description](#1-description)
2. [Instructions](#2-instructions)
3. [Team Information](#3-team-information)
4. [Project Management](#4-project-management)
5. [Technical Stack](#5-technical-stack)
6. [Database Schema](#6-database-schema)
7. [Features List](#7-features-list)
8. [Modules](#8-modules)
9. [Individual Contributions](#9-individual-contributions)
10. [Mandatory Requirements Checklist](#10-mandatory-requirements-checklist)
11. [Resources](#11-resources)

---

## 1. Description

**ft_transcendence** is the final project of the 42 Common Core. Our team built a full-stack web application: a **real-time multiplayer UNO-style card game platform** where users can create accounts, befriend other players, chat, open game rooms, play with up to **10 players**, spectate live matches and compete in tournaments.

### Goal

Deliver a production-style web application that combines a rich single-page frontend, a robust real-time backend and a reliable relational data model, while practising team work (roles, code reviews, pull requests, shared ownership).

### Key features

- **Complete card game** with a standalone, unit-tested rules engine and configurable **house rules** (stacking +2/+4, jump-in, seven-swap, zero-swap, draw-until-playable, turn timer).
- **Remote real-time play** over WebSockets, with reconnection handling and expiry of disconnected players.
- **Up to 10 players per table**, with seat selection and fair turn handling.
- **Spectator mode** with live spectator counter and per-room spectator permission.
- **Tournament system**, **leaderboard** and **live profile stats** (wins, losses, games played).
- **Chat**: direct messages, table chat, chat dock, game invitations, typing indicators, read receipts, user blocking.
- **Friends & presence**: friend requests pushed live over a presence socket, online status, badge counter for pending requests.
- **Secure authentication**: email + password (Argon2 hashing, live password-rule feedback) and **OAuth 2.0 with 42 and Google**.
- **Custom design system**: theme tokens and reusable UI components built with Tailwind CSS.
- **One-command deployment** with Docker Compose, Nginx reverse proxy and HTTPS.

---


## 2. Instructions

### Prerequisites

| Requirement | Version / Notes |
|---|---|
| Docker Engine | 24+ |
| Docker Compose | v2 (`docker compose`) |
| GNU Make | any recent version (the `Makefile` wraps every Docker Compose command) |
| Google Chrome | latest stable (target browser) |
| OpenSSL | used by `docker/nginx/gen-certs.sh` to generate the local HTTPS certificate |
| OAuth credentials | a 42 API application and a Google OAuth client (for social login) |

### Step-by-step

```bash
# 1. Clone the repository
git clone https://github.com/feazeved/ft_transcendence.git
cd ft_transcendence

# 2. Create your environment file from the template
cp .env.example .env
#    then edit .env and fill in:
#      - DJANGO_SECRET_KEY
#      - POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB, and make sure the
#        user, password and database inside DATABASE_URL match them
#      - allowed hosts / FRONTEND_URL, Redis host
#      - 42 and Google OAuth client id / secret
#      - e-mail settings (used for e-mail confirmation and password-reset e-mails)

# 3. Build and start everything with a single command
make            # = make up = docker compose up --build -d
```

`make up` first runs `check-env`, which stops with an explanatory message if `.env` is missing. When the containers are up, open **https://localhost** in Google Chrome. The HTTPS certificate is generated automatically by `docker/nginx/gen-certs.sh` on the first start, so the browser asks you to accept it the first time.

### Makefile reference

| Command | What it does |
|---|---|
| `make` / `make up` | Check `.env`, then build and start the whole stack in the background |
| `make down` | Stop and remove the containers |
| `make re` | `down` then `up` |
| `make build` | Rebuild all images without cache |
| `make logs` / `make ps` | Follow logs / list running services |
| `make fclean` | Remove containers, **volumes**, images and orphans (full clean) |
| `make reset-db` | Drop the volumes (including the database) and start again from scratch |
| `make migrate` / `make makemigrations` | Apply / create Django migrations in the `backend` container |
| `make check-drift` | Report any model column missing from the database (detects an already-applied migration that was edited afterwards — see `docs/adr/0003-applied-migrations-are-never-edited.md`) |
| `make superuser` | Create a Django admin user |
| `make backend-shell` / `frontend-shell` / `db-shell` | Open a shell in the backend / frontend container, or `psql` in the database |
| `make test-engine` | Run the game-engine unit tests (`pytest`) |
| `make test-api` | Run the Django API / consumer tests (`manage.py test game_api`) |
| `make backend-tests` | Run both test suites (`test-engine` + `test-api`) |

> Production deployment (Render / Vercel) uses `docker-compose.prod.yml` and a production Nginx configuration on top of the same images.

> The `.env` file is ignored by Git. Never commit credentials — only `.env.example` is versioned.

---

## 3. Team Information

| Member | 42 login · Git identities | Assigned role(s) | Responsibilities |
|---|---|---|---|
| **Daniel Fonseca** | `dda-fons` · `Danielfonsecaa` | **Product Owner** + **Lead Frontend Developer** | Defined the product vision and UX direction (the "hub" home page, lobby, table, profile), owned the visual redesign and design system, prioritised features, validated finished work, integrated the `dev`/`redesign` branches, prepared the deployment (Render / Vercel, production Nginx). |
| **Felipe Suassuna** | `feazeved` · `Felipe Azevedo Soares Suassuna` | **Technical Lead** (DevOps) + **Developer** (infrastructure & frontend) | Owns the technical architecture and infrastructure: bootstrapped the repository, built the Docker / Nginx / Makefile stack and the HTTPS setup, prepared the deployment, reviewed and merged pull requests; also delivered the home, friends and leaderboard pages and the block-user feature. |
| **Alex Barbosa** | `alebarbo` · `magusk89`, `Magusk Lutus` | **Project Manager / Scrum Master** + **Backend Developer** | Coordinated the team's work (issues, branches, pull requests), tracked progress and reviewed critical backend changes; developed the backend: Django project, game engine and its rules modifiers, authentication, presence, friends/profile API, chat, leaderboard, tournaments and the test-suite. |
| **Wallace Gonçalves** | `wlucas-f` · `Wallace` | **Backend Developer** (data model & concurrency) | Designed and documented the database ERD, implemented room codes and names, the spectator model/endpoints, and hardened the game WebSocket consumer and viewsets (transactions, row-locking, `on_commit`). |

> Since we are a four-person team, some members hold several roles, as allowed by the subject. All members developed code, participated in code reviews, tested and documented their own work.

---
