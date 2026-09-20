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
