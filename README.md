# 🍕 PizzaGhar - Voice Ordering Agent | Meta Global AI Hackathon

![Live](https://img.shields.io/badge/LIVE-Birtamode_Jhapa-green)
![Meta](https://img.shields.io/badge/Model-Muse_Spark_1.3-blue)
![Traction](https://img.shields.io/badge/Traction-115_Customers-orange)
![STT](https://img.shields.io/badge/STT-Groq_Whisper_v3-purple)

**Startup Track | Build for Your World**
> Production voice agent for a real restaurant in Nepal. Live in Birtamode, Jhapa.

**Live:** https://whatsapp.zappertrip.com/hackathon/pizza-voice
**Demo Video:** Coming soon.

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

### 💼 Business Impact & Scale
- **Current Traction:** The **Aahwan Loyalty** platform (live since Sept 2024) powers **5 shops** in Jhapa, Nepal, serving **116 active customers** and **21,000+ points** (MySQL production data).
- **Hackathon Innovation:** The Voice Ordering Agent is built *on top* of Aahwan Loyalty, currently piloted with **PizzaGhar (Birtamode)** as the flagship client. The other 4 pilot shops will receive the voice agent next.
- **Business Model (SaaS):** We charge a subscription of **Rs 1,500/month** per shop (or 1% transaction fee). 
- **Target Market:** There are **50,000+** registered restaurants and cafes in Nepal alone. If we capture just 1% of this market, it represents Rs 75 Lakhs in MRR.
- **Why Meta AI?** Without Muse Spark's strict JSON extraction and Groq's fast Nepali transcription, this voice pipeline would be too slow and expensive to run on a profit margin at this scale.
- **QR Optimization:** A static QR (permanent link) is used for hackathon judging — zero expiry, perfectly optimized for live testing.

### Architecture: Ears -> Brain -> State -> Mouth
- **Ears (STT):** Groq whisper-large-v3 (Primary, <0.5s, ne) + Meta muse-voice-transcribe-1.0 (Fallback)
- **Brain:** Meta **Muse Spark 1.3** via Meta Model API - Extracts strict JSON, fuzzy matches to MySQL menu
- **State:** Node.js Deterministic State Machine (The LLM only *extracts* JSON to support the flow, it **never executes or drives it**, completely preventing AI hallucinations and loops)
- **Mouth:** Edge-TTS ne-NP-HemkalaNeural (Branded as **Hemlata** - Our Nepali Didi)
- **Eyes (Multimodal):** Meta **muse-image-1.0** generates a combined professional food photograph of ALL ordered items, delivered asynchronously while Hemlata speaks.
- **Agentic Upsell:** If a user orders a Pizza but no drink, the Node.js State Machine autonomously injects a prompt to add a Mango Lassi, acting as a revenue-generating salesperson.
- **Delivery:** Baileys WhatsApp (receipt + payment link)
- **Operations:** Live Owner Dashboard (auto-refreshes every 3s) + Payment Gateway Lifecycle (Pending -> Paid)

### What is New (Oct 26 - Nov 4) - Hackathon Compliance
**Pre-Hackathon (Before Oct 26):** ZapperTrip WhatsApp Gateway (Node.js + Baileys) - message sender only.

**Built DURING Hackathon:**
- ai/metaAgent.js: Muse Spark 1.3 integration via api.meta.ai/v1
- ai/pizzaAgent.js: Entity extraction + cart logic
- server.js: Deterministic State Machine - LLM only extracts, never executes the flow (Zero Hallucinations)
- public/pizza-voice.html: Nepali-localized UI + Dual-STT + Async image loading
- ai/imageAgent.js: Meta muse-image-1.0 integration for combined cart visualization

### 🧠 Engineering Highlight: Dual-STT for Nepal
We tested Meta Muse Voice Transcribe as primary. It does not officially support Nepali yet and hallucinated Bengali/Gujarati for accented Nepali.

Solution: **Dual-STT Pipeline** for 100% reliability for our real client.
Primary: Groq whisper-large-v3 with language: ne -> Perfect Nepali Devanagari, <0.5s.
Fallback: Meta Muse Voice (integrated via Meta Model API) -> Maximizes Meta ecosystem use.

This is honest engineering for a real-world client, not just a demo.

### Demo Flow (60s)
1. Enter phone, tap mic: "One Veggie Feast Pizza" (Without a drink)
2. **Agentic Upsell:** Hemlata autonomously suggests "के म्यांगो लस्सी (Rs 190) पनि थप्न चाहनुहुन्छ?"
3. Say "Ho, thapnus" -> Lassi is added to the cart
4. Say "Pizza hataidinu" -> Removes correctly
5. Confirm -> Order instantly pops up on the **Live Owner Dashboard** (Yellow PENDING)
6. **Image Magic:** AI generates a combined photo of the cart using Meta Muse Image while Hemlata speaks
7. Click the WhatsApp payment link -> Complete mock eSewa/Khalti checkout
7. Watch the Owner Dashboard instantly flip the order to **Green PAID** in real-time

### 🛠️ Tech Stack
- **Backend:** Node.js, Express
- **Database:** MySQL (`mysql2`)
- **AI Models:** Meta Model API (`muse-spark-1.3`, `muse-voice-transcribe-1.0`)
- **Speech (STT/TTS):** Groq Whisper v3, Edge-TTS
- **Messaging:** Baileys (WhatsApp)
- **Frontend:** Vanilla JS, Tailwind CSS

### How to Run
1. npm install
2. cp .env.example .env (Add META_API_KEY, GROQ_API_KEY)
3. npm start
4. Open http://localhost:3050/pizza-voice.html
