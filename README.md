# 🍕 PizzaGhar - Voice Ordering Agent | Meta Global AI Hackathon

**Startup Track | Build for Your World**
> Production voice agent for a real restaurant in Nepal. Live in Birtamode, Jhapa.

**Live:** https://whatsapp.zappertrip.com/hackathon/pizza-voice

### 🌐 Live Demos (Judge Click Here)
- 🎤 **Customer Voice Agent:** [/pizza-voice.html](https://whatsapp.zappertrip.com/hackathon/pizza-voice.html)
- 📊 **Owner Dashboard (Live Orders):** [/owner.html](https://whatsapp.zappertrip.com/hackathon/owner.html)
- 📈 **Traction Dashboard (103 customers, 5 shops):** [/traction.html](https://whatsapp.zappertrip.com/hackathon/traction.html)

### Problem
Small shops in Nepal live on WhatsApp. Manual order-taking is chaotic. Generic bots fail on Nepali accent + Hinglish.

PizzaGhar understands: "Euta veggie feast pizza ra mango lassi dinus na" -> Perfect order.

### Architecture: Ears -> Brain -> State -> Mouth
- **Ears (STT):** Groq whisper-large-v3 (Primary, <0.5s, ne) + Meta muse-voice-transcribe-1.0 (Fallback)
- **Brain:** Meta **Muse Spark 1.3** via Meta Model API - Extracts strict JSON, fuzzy matches to MySQL menu
- **State:** Node.js Deterministic State Machine (LLM never drives flow, only extracts)
- **Mouth:** Edge-TTS ne-NP-HemkalaNeural (Branded as **Hemlata** - Our Nepali Didi)
- **Delivery:** Baileys WhatsApp (receipt + payment link)

### What is New (Oct 26 - Nov 4) - Hackathon Compliance
**Pre-Hackathon (Before Oct 26):** ZapperTrip WhatsApp Gateway (Node.js + Baileys) - message sender only.

**Built DURING Hackathon:**
- ai/metaAgent.js: Muse Spark 1.3 integration via api.meta.ai/v1
- ai/pizzaAgent.js: Entity extraction + cart logic
- server.js: Deterministic State Machine
- public/pizza-voice.html: Nepali-localized UI + Dual-STT

### 🧠 Engineering Highlight: Dual-STT for Nepal
We tested Meta Muse Voice Transcribe as primary. It does not officially support Nepali yet and hallucinated Bengali/Gujarati for accented Nepali.

Solution: **Dual-STT Pipeline** for 100% reliability for our real client.
Primary: Groq whisper-large-v3 with language: ne -> Perfect Nepali Devanagari, <0.5s.
Fallback: Meta Muse Voice (integrated via Meta Model API) -> Maximizes Meta ecosystem use.

This is honest engineering for a real-world client, not just a demo.

### Demo Flow (60s)
1. Enter phone, tap mic: "One Veggie Feast Pizza and a Mango Lassi"
2. See Spark 1.3 JSON + Hemlata says "Veggie Feast Pizza ra Mango Lassi add bhayo hai!"
3. Say "Pizza hataidinu" -> Removes correctly
4. Confirm -> WhatsApp receipt + Khalti/eSewa link

### How to Run
1. npm install
2. cp .env.example .env (Add META_API_KEY, GROQ_API_KEY)
3. npm start
4. Open http://localhost:3050/pizza-voice.html
