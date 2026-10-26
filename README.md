# Meta AI Hackathon - Aahwan IT Group

## Project Overview
**Zappertrip Voice AI Agent** is a multimodal AI agent built during the Meta Global AI Developer Hackathon. 

Built by **Aahwan IT Group Pvt Ltd**, this project is a B2B SaaS solution for local businesses in Nepal. Our first pilot client is **Pizza Ghar** (a local food chain), but the platform is designed to be deployed to any shop or distributor.

It allows customers to place food orders using natural voice commands, which are processed by **Meta Muse Spark** and seamlessly pushed to the shop owner via a WhatsApp gateway.

## Problem Statement
**Build for Your World:** Millions of small businesses in Nepal run entirely on WhatsApp. However, taking orders manually is chaotic and time-consuming. This project bridges the gap by providing an AI Voice Agent that handles the order intake, calculates totals, and triggers WhatsApp receipts.

## New Work Built During the Hackathon
To comply with the hackathon rules, here is the clear separation of work:
*   **Legacy Code (Pre-Hackathon):** The Zappertrip WhatsApp gateway (Node.js + Baileys) used to send messages.
*   **New Work (Built Oct 26 - Nov 4):**
    *   Integration of **Meta Muse Spark 1.1** via the Meta Model API.
    *   A deterministic Node.js State Machine to manage the voice conversation flow (preventing AI loops).
    *   A sleek web interface for the Voice AI agent.
    *   A mock e-commerce checkout page triggered by WhatsApp.
    *   Text-to-SQL capabilities using Meta Muse Spark for the distributor dashboard.

## Architecture
1. **Frontend:** HTML/Vanilla JS (Web Speech API for voice capture).
2. **Backend:** Node.js (Express) + PM2.
3. **AI Engine:** Meta Muse Spark 1.1 (Primary), Groq/Gemini (Fallback).
4. **Database:** MySQL (reads product prices, writes bookings).
5. **Messaging:** Local Baileys WhatsApp API Gateway (Zappertrip Gateway).

## How to Run
1. npm install
2. Set up .env (see .env.example)
3. npm start
