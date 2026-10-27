require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const { executeDistributorQuery, handleCommerceQuery, callMetaLlama } = require('./ai/metaAgent');
const { extractPizzaItems, matchPizzaMenu } = require('./ai/pizzaAgent');
const mysql = require('mysql2/promise');
const { execFile } = require('child_process');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
const dbQuery = async (sql, params) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};


function formatSpokenDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

app.get('/ai-demo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ai-demo.html')));
app.get('/voice-demo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'voice-demo.html')));
app.get('/pay', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pay.html')));
app.get('/pizza-voice', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pizza-voice.html')));

app.post('/api/copilot', async (req, res) => {
  try {
    const reply = await executeDistributorQuery(req.body.query);
    res.json({ success: true, reply });
  } catch (err) { res.status(500).json({ success: false, reply: err.message }); }
});

app.post('/api/shop', async (req, res) => {
  try {
    const testUid = 'NAxdcIhNb4qYIQBXweRz2t7gwWxveFEi'; 
    const reply = await handleCommerceQuery(req.body.message, testUid);
    res.json({ success: true, reply });
  } catch (err) { res.status(500).json({ success: false, reply: err.message }); }
});

app.post('/api/voice', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const history = req.body.history || [];
    
    const systemPrompt = `Extract booking details into valid JSON only.
Schema: {"room_type": "Standard Room" | "Deluxe Cottage" | "None", "check_in": "YYYY-MM-DD" | null, "nights": integer | null}
If they mention "Deluxe" or "Cottage", use "Deluxe Cottage". If "Standard", use "Standard Room".
Today is ${today}. If they say "tomorrow", calculate the date as YYYY-MM-DD.
Do not output anything other than valid JSON.`;

    const rawReply = await callMetaLlama(req.body.text, systemPrompt, true, history);
    
    let parsed;
    try {
        let cleanReply = rawReply.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = cleanReply.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error("No JSON");
    } catch(e) {
        console.error("AI Parse Error:", rawReply);
        parsed = { room_type: "None", check_in: null, nights: null };
    }

    const room = parsed.room_type || "None";
    const nights = parseInt(parsed.nights) || null;
    const checkIn = parsed.check_in;

    // --- NODE.JS STATE MACHINE (Bulletproof) ---
    
    // Step 1: Do we have a room?
    if (room === "None") {
        return res.json({ success: true, reply: "We have a Standard Room for Rs 2000 or a Deluxe Cottage for Rs 3500. Which one would you like to book?", booking_confirmed: false });
    }

    // Step 2: Do we have a check-in date?
    if (!checkIn) {
        return res.json({ success: true, reply: "Great choice! What date would you like to check in? (You can say 'tomorrow' or give a specific date)", booking_confirmed: false });
    }

    // Step 3: Do we have the number of nights?
    if (!nights) {
        return res.json({ success: true, reply: "Perfect. How many nights would you like to stay?", booking_confirmed: false });
    }

    // Step 4: We have EVERYTHING. Now confirm.
    let checkOut = new Date(new Date(checkIn).getTime() + (nights * 86400000)).toISOString().split('T')[0];
    const rate = room.includes('Deluxe') ? 3500 : 2000;
    const total = rate * nights;
    
    console.log('[Booking Confirmed] Saving to DB and sending WA to', req.body.phone);
    
    try {
        await dbQuery(
          "INSERT INTO resort_bookings (phone, room_type, price, check_in, check_out, nights, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')", 
          [req.body.phone, room, total, checkIn, checkOut, nights]
        );
    } catch (dbErr) { console.error('❌ DB Error:', dbErr.message); }

    const waMessage = '⏳ *Reservation Pending*\n\nRoom: ' + room + '\nCheck-In: ' + checkIn + '\nCheck-Out: ' + checkOut + ' (' + nights + ' nights)\nTotal: Rs ' + total + '\n\nPlease complete your payment here to confirm:\n\nhttps://whatsapp.zappertrip.com/hackathon/pay?room=' + encodeURIComponent(room) + '&price=' + total + '&phone=' + req.body.phone + '&check_in=' + checkIn + '&check_out=' + checkOut + '&nights=' + nights;

    fetch(`${process.env.MAIN_APP_URL || 'http://127.0.0.1:3010'}${process.env.MAIN_APP_SEND_WA_PATH || '/api/ai-demo/send-wa'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: req.body.phone, message: waMessage })
    }).catch(e => console.error('[WA Send Failed]', e.message));
    
    const spokenCheckIn = formatSpokenDate(checkIn);
    const spokenCheckOut = formatSpokenDate(checkOut);
    const finalReply = "Your " + room + " from " + spokenCheckIn + " to " + spokenCheckOut + " (" + nights + " nights) is on hold. Total is Rs " + total + ". I have sent a payment link to your WhatsApp.";
    res.json({ success: true, reply: finalReply, booking_confirmed: true, room_type: room });

  } catch (err) {
    console.error('🚨 [AI FATAL ERROR]', err.message);
    res.status(500).json({ success: false, reply: "Sorry, my system is down." });
  }
});

app.post('/api/pay-confirm', async (req, res) => {
  try {
    const { phone, room } = req.body;
    try {
      await dbQuery("UPDATE resort_bookings SET status = 'confirmed' WHERE phone = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", [phone]);
    } catch (dbErr) { console.error('❌ DB Error:', dbErr.message); }

    if (phone) {
      fetch(`${process.env.MAIN_APP_URL || 'http://127.0.0.1:3010'}${process.env.MAIN_APP_SEND_WA_PATH || '/api/ai-demo/send-wa'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          message: '✅ *Payment Received!*\n\nYour booking for the ' + room + ' is officially confirmed. Thank you for choosing Zappertrip Resort!'
        })
      }).catch(e => console.error('[WA Pay Send Failed]', e.message));
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file' });

  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'ne'); // Force Nepali

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error('Groq API Error: ' + errText);
    }

    const groqData = await groqRes.json();
    res.json({ text: groqData.text });
  } catch (err) {
    console.error('Transcription error:', err.message);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

app.post('/api/pizza-order', async (req, res) => {
  try {
    const text = req.body.text || '';
    const history = req.body.history || [];
    const phone = req.body.phone || '';
    const customerName = req.body.name || 'Voice Customer';
    const confirmed = req.body.confirmed === true;

    // LLM ONLY extracts items, Node owns state
    const extracted = await extractPizzaItems(text, history);
    
    if (extracted.intent === 'ASK_MENU') {
      return res.json({ success: true, reply: 'हामी संग पिज्जा, बर्गर, पास्ता, र पेय पदार्थहरू छन्। तपाईं के अडर गर्न चाहनुहुन्छ। जस्तै: भेज फिस्ट पिज्जा वा मेंगो लस्सी', booking_confirmed: false, step: 'TAKING_ORDER' });
    }

    if (!extracted.items || extracted.items.length === 0) {
      return res.json({ success: true, reply: 'नमस्कार! पिज्जा घरमा हार्दिक स्वागत छ। हाम्रो स्वादिष्ट मेनुबाट आफूलाई मनपर्ने परिकार छान्नुहोस् र के अर्डर गर्न चाहनुहुन्छ, हामीलाई बताउनुहोस्। तपाईंको स्वाद, हाम्रो प्राथमिकता! पिज्जा घर, स्वादको आफ्नै घर!', booking_confirmed: false, step: 'TAKING_ORDER' });
    }

    const menuResult = await matchPizzaMenu(extracted.items);
    const found = menuResult.matched.filter(function(m) { return m.found; });
    const notFound = menuResult.matched.filter(function(m) { return !m.found; });

    if (found.length === 0) {
      return res.json({ success: true, reply: 'माफ गर्नुहोस्, यो आइटम मेनुमा छैन। अर्को पिज्जाको नाम भन्नुहोस्।', booking_confirmed: false, step: 'TAKING_ORDER' });
    }

    if (notFound.length > 0) {
      const badNames = notFound.map(function(m) { return m.asked; }).join(', ');
      const goodSummary = found.map(function(m) { const npName = nepaliDict[m.found] || m.found; return m.qty + ' ' + npName; }).join(', ');
      return res.json({ success: true, reply: 'मैले ' + goodSummary + ' बुझेँ। तर ' + badNames + ' मेनुमा भेटिएन। कन्फर्म गर्नुहुन्छ कि परिवर्तन गर्नुहुन्छ?', booking_confirmed: false, step: 'CONFIRMING', cart: found, total: menuResult.total });
    }

    const total = menuResult.total;
    const nepaliDict = {
      'Veggie Feast Pizza': 'भेज फेस्ट पिज्जा',
      'Mango Lassi': 'मेंगो लस्सी',
      'Chicken Mix Feast Pizza': 'चिकन मिक्स फिस्ट पिज्जा',
      'Chicken Burger': 'चिकन बर्गर',
      'French Fries (Normal)': 'फ्रेन्च फ्राइज'
    };
    const summary = found.map(function(m) { 
      const npName = nepaliDict[m.found] || m.found;
      return m.qty + ' ' + npName + ' रु ' + m.line_total; 
    }).join(', ');

    // Step CONFIRMING
    if (!confirmed) {
      return res.json({ success: true, reply: 'जम्मा रु ' + total + ' भयो (' + summary + ')। कन्फम बटन थिचेर कन्फम गर्नुहोस या मेनु बटन थिचेर अन्य आइटम हेरी थप्न या घटाउन पनि सक्नुहुन्छ', booking_confirmed: false, step: 'CONFIRMING', cart: found, total: total });
    }

    // Step BOOKED - Node writes DB, sends WA
    try {
      await dbQuery("INSERT INTO catalog_orders (store_id, retailer_name, retailer_phone, total, status, shop_name, order_note) VALUES (?, ?, ?, ?, 'pending', ?, ?)", [5, customerName, phone, total, 'Pizza Ghar', JSON.stringify(found)]);
    } catch (dbErr) { console.error('PIZZA DB Error:', dbErr.message); }

    const waMessage = 'Pizza Ghar Order Pending\n\nItems: ' + summary + '\nTotal: Rs ' + total + '\nPhone: ' + phone + '\n\nPayment link:\nhttps://whatsapp.zappertrip.com/hackathon/pay?price=' + total + '&phone=' + encodeURIComponent(phone);

    fetch(`${process.env.MAIN_APP_URL || 'http://127.0.0.1:3010'}${process.env.MAIN_APP_SEND_WA_PATH || '/api/ai-demo/send-wa'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, message: waMessage })
    }).catch(function(e) { console.error('[WA Pizza Send Failed]', e.message); });

    const finalReply = 'धन्यवाद! ' + summary + ', जम्मा रु ' + total + ' को अर्डर बुक भयो। ह्वाट्सएपमा पेमेन्ट लिङ्क पठाएको छु।';
    return res.json({ success: true, reply: finalReply, booking_confirmed: true, step: 'BOOKED', total: total });

  } catch (err) {
    console.error('PIZZA FATAL', err.message);
    res.status(500).json({ success: false, reply: 'माफ गर्नुहोस्, सिस्टममा समस्या आयो।' });
  }
});

app.post('/api/pizza-tts', (req, res) => {
  const text = (req.body.text || '').slice(0, 500);
  if (!text) return res.status(400).json({ error: 'No text' });
  const filename = 'tts_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.mp3';
  const filepath = path.join('/tmp', filename);
  const edgeTtsPath = '/opt/edge-venv/bin/edge-tts';
  execFile(edgeTtsPath, ['--voice', 'ne-NP-HemkalaNeural', '--rate=+10%', '--pitch=-10Hz', '--text', text, '--write-media', filepath], function(error, stdout, stderr) {
    if (error) { console.error('TTS Error:', stderr || error.message); return res.status(500).json({ error: 'TTS failed' }); }
    res.sendFile(filepath, function(err) { fs.unlink(filepath, function() {}); if (err) console.error('TTS send err:', err.message); });
  });
});


app.post('/api/pizza-tts', (req, res) => {
  const text = req.body.text;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const filename = 'tts_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.mp3';
  const filepath = path.join('/tmp', filename);
  const edgeTtsPath = '/opt/edge-venv/bin/edge-tts';

  execFile(edgeTtsPath, ['--voice', 'ne-NP-HemkalaNeural', '--rate=+10%', '--pitch=-10Hz', '--text', text, '--write-media', filepath], (error, stdout, stderr) => {
    if (error) {
      console.error('TTS Error:', stderr || error.message);
      return res.status(500).json({ error: 'TTS generation failed' });
    }

    res.sendFile(filepath, (err) => {
      fs.unlink(filepath, () => {}); // cleanup
      if (err) console.error('Error sending TTS file:', err);
    });
  });
});

app.listen(process.env.PORT, () => {
  console.log('🚀 Hackathon Demo running on port ' + process.env.PORT);
});
