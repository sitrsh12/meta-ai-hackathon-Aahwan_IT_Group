# 🍕 Pizza Ghar — Voice Ordering Agent
**Meta Global AI Developer Hackathon · Startup Track · Build for Your World**

> Production voice agent for a real restaurant in Nepal. Voice in (EN/NE/Hinglish) -> Muse Spark 1.3 extracts JSON -> deterministic state machine -> WhatsApp receipt + payment link.

**Demo:** [90s Loom - TODO] | **Live:** [https://whatsapp.zappertrip.com/hackathon/pizza-voice](https://whatsapp.zappertrip.com/hackathon/pizza-voice)

### Problem
Small shops in Nepal live on WhatsApp. Manual order-taking is chaotic, and generic bots fail on Nepali accent + Hinglish. Pizza Ghar understands messy spoken language, matches to a real MySQL menu, and frees the owner.

### What’s New (Oct 26 - Nov 4) - Hackathon Compliance
**Pre-hackathon (Before Oct 26):**
- Zappertrip gateway (Node.js + Baileys) - used ONLY as message sender

**Built DURING hackathon:**
- `ai/metaAgent.js`: Meta Muse Spark 1.3 via Meta Model API (api.meta.ai/v1)
- `ai/pizzaAgent.js`: Entity extraction + strict menu matching + cart add/remove logic
- `server.js`: Deterministic State Machine - LLM only extracts, never drives flow
- Multimodal: Groq whisper-large-v3 (STT) + Edge-TTS ne-NP-HemkalaNeural (TTS)
- `public/pizza-voice.html`: Nepali-localized MediaRecorder UI

### Architecture
1. **Ears:** Groq whisper-large-v3 (<0.5s)
2. **Brain:** Meta Muse Spark 1.3 (fuzzy match to MySQL menu -> strict JSON)
3. **State:** Node.js state machine (no hallucination loops)
4. **Mouth:** Edge-TTS ne-NP-HemkalaNeural
5. **Delivery:** Baileys WhatsApp

### How to Run
1. `npm install`
2. `cp .env.example .env` (add `META_API_KEY`, `GROQ_API_KEY`)
3. `npm start`
4. Open `http://localhost:3050/pizza-voice.html`

> Without `MAIN_APP_URL`, runs in console-only mode (perfect for judges without WhatsApp).

### Demo Flow (90s)
1. Enter phone, tap mic: "One Veggie Feast Pizza and a Mango Lassi"
2. See Spark 1.3 JSON + Nepali confirmation
3. Say "Remove the pizza" -> subtraction works
4. Confirm -> WhatsApp receipt
