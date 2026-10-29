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
const { generateImage } = require('./ai/imageAgent');
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

app.get('/pay', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pay.html')));
app.get('/pizza-voice', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pizza-voice.html')));





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

    if (extracted.intent === 'ASK_IMAGE') {
      const itemName = extracted.item_name || 'Pizza';
      const imageUrl = await generateImage(itemName);
      
      if (imageUrl) {
        return res.json({ 
          success: true, 
          reply: 'यहाँ तपाईंको ' + itemName + ' को तस्बिर छ।', 
          image_url: imageUrl,
          booking_confirmed: false, 
          step: 'VIEWING_IMAGE' 
        });
      } else {
        return res.json({ 
          success: true, 
          reply: 'माफ गर्नुहोस्, तस्बिर बनाउन सकिएन।', 
          booking_confirmed: false, 
          step: 'TAKING_ORDER' 
        });
      }
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

    // Step CONFIRMING (with Agentic Upsell)
    if (!confirmed) {
      // Check if they have Pizza but no Drink
      const hasPizza = found.some(function(m) { return m.found.toLowerCase().indexOf('pizza') !== -1; });
      const hasBurger = found.some(function(m) { return m.found.toLowerCase().indexOf('burger') !== -1; });
      const hasDrink = found.some(function(m) { 
        var n = m.found.toLowerCase();
        return n.indexOf('lassi') !== -1 || n.indexOf('juice') !== -1 || n.indexOf('shake') !== -1 || n.indexOf('soda') !== -1 || n.indexOf('coke') !== -1 || n.indexOf('pepsi') !== -1 || n.indexOf('fanta') !== -1 || n.indexOf('sprite') !== -1 || n.indexOf('tea') !== -1 || n.indexOf('coffee') !== -1 || n.indexOf('water') !== -1;
      });
      
      let upsell = '';
      if (hasPizza && !hasDrink) {
        upsell = ' तपाईंको अर्डरमा पिज्जा छ, के म्यांगो लस्सी (Rs 190) पनि थप्न चाहनुहुन्छ?';
      } else if (hasBurger && !hasDrink) {
        upsell = ' तपाईंको अर्डरमा बर्गर छ, के फ्रेन्च फ्राइज (Rs 220) वा कोक (Rs 90) पनि थप्न चाहनुहुन्छ?';
      }

      return res.json({ success: true, reply: 'जम्मा रु ' + total + ' भयो (' + summary + ')।' + upsell + ' कन्फम बटन थिचेर कन्फम गर्नुहोस या मेनु बटन थिचेर अन्य आइटम हेरी थप्न या घटाउन पनि सक्नुहुन्छ', booking_confirmed: false, step: 'CONFIRMING', cart: found, total: total });
    }

    // Step BOOKED - Node writes DB, sends WA
    let orderId = '';
    try {
      const dbResult = await dbQuery("INSERT INTO catalog_orders (store_id, retailer_name, retailer_phone, total, status, shop_name, order_note) VALUES (?, ?, ?, ?, 'pending', ?, ?)", [5, customerName, phone, total, 'Pizza Ghar', JSON.stringify(found)]);
      orderId = dbResult.insertId;
    } catch (dbErr) { console.error('PIZZA DB Error:', dbErr.message); }

    const waMessage = 'Pizza Ghar Order Pending\n\nOrder ID: #' + orderId + '\nItems: ' + summary + '\nTotal: Rs ' + total + '\nPhone: ' + phone + '\n\nPayment link:\nhttps://whatsapp.zappertrip.com/hackathon/pay?price=' + total + '&phone=' + encodeURIComponent(phone) + '&order_id=' + orderId;

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



app.get('/api/traction', async (req, res) => {
  try {
    const [custRows] = await pool.query("SELECT COUNT(*) AS total_customers, SUM(current_points) AS current_points FROM loyalty_customers");
    const [pointsRows] = await pool.query("SELECT SUM(points) AS total_earned FROM loyalty_transactions WHERE transaction_type = 'earn'");
    const [storeRows] = await pool.query("SELECT name, active FROM stores");
    
    // Group customers by program_id/category_id if needed. For now, let's just send the breakdown if we had it.
    // Since we don't have exact store_ids in loyalty_customers, we'll just return the total.
    
    res.json({
      success: true,
      total_customers: custRows[0].total_customers || 0,
      total_points: pointsRows[0].total_earned || 0,
      current_points_balance: custRows[0].current_points || 0,
      shops: storeRows || []
    });
  } catch (err) {
    console.error('Traction API Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch traction' });
  }
});


app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file' });

  console.log('🎤 Received audio. Size:', req.file.size, 'Type:', req.file.mimetype);

  // 1. Try Groq FIRST (Best for Android/WebM)
  try {
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'ne'); 

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: formData
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      console.log('🎤 [GROQ ASR RESULT]', groqData.text);
      if (groqData.text && groqData.text.trim().length > 0) {
        return res.json({ text: groqData.text, source: 'groq' });
      }
    } else {
      console.log('Groq API failed:', await groqRes.text());
    }
  } catch (err) {
    console.warn('Groq STT error:', err.message);
  }

  // 2. Try Meta (Fallback)
  const inputPath = `/tmp/meta_in_${Date.now()}.raw`;
  const outputPath = `/tmp/meta_out_${Date.now()}.wav`;
  try {
    fs.writeFileSync(inputPath, req.file.buffer);
    await execPromise(`ffmpeg -i ${inputPath} -ar 16000 -ac 1 -c:a pcm_s16le ${outputPath} -y`);
    
    const audioBuffer = fs.readFileSync(outputPath);
    const metaForm = new FormData();
    const requestPayload = JSON.stringify({
      model: 'muse-voice-transcribe-1.0',
      audioEncoding: 'WAV',
      mode: 'PUSH_TO_TALK',
      languageBias: ['Hindi', 'English']
    });
    metaForm.append('request', requestPayload);
    metaForm.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav');

    const metaRes = await fetch('https://api.meta.ai/v1/asr/transcribe', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.META_API_KEY}` },
      body: metaForm
    });

    if (metaRes.ok) {
      const metaData = await metaRes.json();
      console.log('🎤 [META ASR RESULT]', metaData.transcript);
      if (metaData.transcript && metaData.transcript.trim().length > 0) {
        return res.json({ text: metaData.transcript, source: 'meta' });
      }
    }
  } catch (err) {
    console.error('Meta STT error:', err.message);
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }

  return res.status(500).json({ error: 'All transcription services failed or returned empty text' });
});


app.get('/api/owner/orders', async (req, res) => {
  try {
    const rows = await dbQuery("SELECT id, retailer_name, retailer_phone, total, order_note, status FROM catalog_orders WHERE store_id = 5 ORDER BY id DESC LIMIT 15", []);
    res.json({ success: true, orders: rows });
  } catch (err) {
    console.error('Owner Dashboard Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

app.post('/api/pay-confirm', async (req, res) => {
  try {
    const { phone, order_id } = req.body;
    let targetOrderId = order_id;

    if (order_id) {
      console.log('💰 [PAY-CONFIRM HIT] Confirming specific Order ID:', order_id);
      await dbQuery("UPDATE catalog_orders SET status = 'processing' WHERE id = ?", [order_id]);
    } else if (phone) {
      console.log('💰 [PAY-CONFIRM HIT] Confirming by phone:', phone);
      const pending = await dbQuery("SELECT id FROM catalog_orders WHERE retailer_phone = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", [phone]);
      if (pending.length > 0) {
        targetOrderId = pending[0].id;
      }
      await dbQuery("UPDATE catalog_orders SET status = 'processing' WHERE retailer_phone = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", [phone]);
    } else {
      return res.status(400).json({ success: false, error: 'Order ID or Phone required' });
    }

    // Send the WhatsApp Receipt
    if (targetOrderId) {
      try {
        const orderData = await dbQuery("SELECT total, retailer_name FROM catalog_orders WHERE id = ?", [targetOrderId]);
        if (orderData.length > 0) {
          const total = orderData[0].total;
          const name = orderData[0].retailer_name || 'Customer';
          
          const waMessage = '✅ *Payment Received!*\n\nधन्यवाद ' + name + '!\nतपाईंको अर्डर #' + targetOrderId + ' (रु ' + total + ') को भुक्तानी सफल भयो। हामी चाँडै खाना पठाउनेछौं।';
          
          fetch(`${process.env.MAIN_APP_URL || 'http://127.0.0.1:3010'}${process.env.MAIN_APP_SEND_WA_PATH || '/api/ai-demo/send-wa'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone, message: waMessage })
          }).catch(function(e) { console.error('[WA Pay Receipt Failed]', e.message); });
        }
      } catch (e) {
        console.error('Failed to fetch order for WA receipt:', e);
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Pay Confirm Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to confirm payment' });
  }
});

app.delete('/api/owner/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    await dbQuery("DELETE FROM catalog_orders WHERE id = ?", [orderId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete Order Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete order' });
  }
});

app.post('/api/generate-cart-image', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }
    console.log('🎨 [CART IMAGE] Generating combined image for:', items.join(', '));
    const imageUrl = await generateImage(items);
    if (imageUrl) {
      return res.json({ success: true, image_url: imageUrl });
    }
    res.status(500).json({ error: 'Image generation failed' });
  } catch (err) {
    console.error('Cart Image Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log('🚀 Hackathon Demo running on port ' + process.env.PORT);
});
