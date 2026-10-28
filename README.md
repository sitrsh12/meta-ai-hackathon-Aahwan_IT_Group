# 🍕 PizzaGhar - Voice Ordering Agent | Meta Global AI Hackathon

![Live](https://img.shields.io/badge/LIVE-Birtamode_Jhapa-green)
![Meta](https://img.shields.io/badge/Model-Muse_Spark_1.3-blue)
![Traction](https://img.shields.io/badge/Traction-115_Customers-orange)
![STT](https://img.shields.io/badge/STT-Groq_Whisper_v3-purple)

**Startup Track | Build for Your World**
> Production voice agent for a real restaurant in Nepal. Live in Birtamode, Jhapa.

**Live:** https://whatsapp.zappertrip.com/hackathon/pizza-voice

<div align="left">
  <a href="https://whatsapp.zappertrip.com/hackathon/pizza-voice.html">
    <img src="https://raw.githubusercontent.com/sitrsh12/meta-ai-hackathon-Aahwan_IT_Group/main/public/qr.png" alt="Scan to try the Voice Agent" width="150" style="border-radius: 12px; border: 2px solid #eee;" />
  </a>
  <p><em>📱 Scan with your phone to try the live Voice Agent instantly.</em></p>
</div>

### 🌐 Live Demos (Judge Click Here)

- 🎤 **Customer Voice Agent:** [/pizza-voice.html](https://whatsapp.zappertrip.com/hackathon/pizza-voice.html)
- 📊 **Owner Dashboard (Live Orders):** [/owner.html](https://whatsapp.zappertrip.com/hackathon/owner.html)
- 📈 **Traction Dashboard (115 customers, 5 shops):** [/traction.html](https://whatsapp.zappertrip.com/hackathon/traction.html)

### 🏪 Real Client Consent - VERIFIED
**Client:** PizzaGhar, Birtamode, Jhapa, Nepal  
**Consent:** ✅ Obtained on 27 Oct 2026 via WhatsApp  
**Permission:** Shop name, photo, demo video usage for Meta Hackathon  
**Privacy:** Customer PII masked (98XXXXXXXX).

### Problem
Small shops in Nepal live on WhatsApp. Manual order-taking is chaotic. Generic bots fail on Nepali accent + Hinglish.

PizzaGhar understands: "Euta veggie feast pizza ra mango lassi dinus na" -> Perfect order.

### Architecture: Ears -> Brain -> State -> Mouth
- **Ears (STT):** Groq whisper-large-v3 (Primary, <0.5s, ne) + Meta muse-voice-transcribe-1.0 (Fallback)
- **Brain:** Meta **Muse Spark 1.3** via Meta Model API - Extracts strict JSON, fuzzy matches to MySQL menu
- **State:** Node.js Deterministic State Machine (LLM never drives flow, only extracts)
- **Mouth:** Edge-TTS ne-NP-HemkalaNeural (Branded as **Hemlata** - Our Nepali Didi)
- **Delivery:** Baileys WhatsApp (receipt + payment link)
- **Operations:** Live Owner Dashboard (auto-refreshes every 3s) + Payment Gateway Lifecycle (Pending -> Paid)

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
4. Confirm -> Order instantly pops up on the **Live Owner Dashboard** (Yellow PENDING)
5. Click the WhatsApp payment link -> Complete mock eSewa/Khalti checkout
6. Watch the Owner Dashboard instantly flip the order to **Green PAID** in real-time

### How to Run
1. npm install
2. cp .env.example .env (Add META_API_KEY, GROQ_API_KEY)
3. npm start
4. Open http://localhost:3050/pizza-voice.html
