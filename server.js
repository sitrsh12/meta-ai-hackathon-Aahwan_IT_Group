require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const { executeDistributorQuery, handleCommerceQuery, callMetaLlama } = require('./ai/metaAgent');
const mysql = require('mysql2/promise');

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

    fetch('http://127.0.0.1:3010/api/ai-demo/send-wa', {
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
      fetch('http://127.0.0.1:3010/api/ai-demo/send-wa', {
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

app.listen(process.env.PORT, () => {
  console.log('🚀 Hackathon Demo running on port ' + process.env.PORT);
});
