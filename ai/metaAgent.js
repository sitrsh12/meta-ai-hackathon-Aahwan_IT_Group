const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function callMetaLlama(prompt, systemPrompt = "You are a helpful assistant.", jsonMode = false, history = []) {
  
  // 1. Try Meta's Official API
  if (process.env.META_API_KEY) {
    try {
      const url = "https://api.meta.ai/v1/chat/completions"; 
      const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: prompt }];
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.META_API_KEY },
        body: JSON.stringify({
          model: process.env.META_MODEL || "muse-spark-1.3", 
          messages: messages,
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(30000),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [AI SUCCESS] Answered by Meta Muse Spark');
        return data.choices[0].message.content.trim();
      } else {
        console.error("[Meta API Error] " + response.status + ": " + await response.text());
      }
    } catch (e) { console.log("[AI Fallback] Meta API failed/timed out."); }
  }

  // 2. Try Groq (Fallback)
  if (process.env.GROQ_API_KEY) {
    try {
      const url = "https://api.groq.com/openai/v1/chat/completions";
      const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: prompt }];
      
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.GROQ_API_KEY },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b", 
          messages: messages,
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [AI SUCCESS] Answered by Groq');
        return data.choices[0].message.content.trim();
      }
    } catch (e) { console.log("[AI Fallback] Groq timed out."); }
  }

  // 3. Hard Fallback (Regex)
  console.log("[AI Fatal] All AI providers failed. Using Regex fallback.");
  const lowerPrompt = prompt.toLowerCase();
  const lowerHistory = JSON.stringify(history).toLowerCase();
  
  let room = "None";
  let nights = null;
  let checkIn = null;
  
  const combinedText = lowerPrompt + " " + lowerHistory;
  
  if (combinedText.includes('deluxe') || combinedText.includes('cottage')) room = "Deluxe Cottage";
  if (combinedText.includes('standard')) room = "Standard Room";
  
  const nightMatch = lowerPrompt.match(/(\d+)\s*night/);
  if (nightMatch) nights = parseInt(nightMatch[1]);
  
  if (lowerPrompt.includes('tomorrow')) {
      checkIn = new Date(new Date().getTime() + 86400000).toISOString().split('T')[0];
  } else if (lowerPrompt.includes('today')) {
      checkIn = new Date().toISOString().split('T')[0];
  }

  return JSON.stringify({ room_type: room, check_in: checkIn, nights: nights });
}

async function generateSQLForDistributor(userQuery) {
  const systemPrompt = "Extract intent to JSON. Intents: count_pending (needs rider_name), list_trips (needs rider_name). If unknown, output {\"intent\": \"unknown\"}.";
  const aiResponse = await callMetaLlama(userQuery, systemPrompt, true);
  let parsed;
  try { parsed = JSON.parse(aiResponse.replace(/```json/g, '').replace(/```/g, '').trim()); } catch (e) { return null; }

  if (parsed.intent === 'count_pending') return "SELECT COUNT(*) AS count FROM delivery_trips t JOIN delivery_riders r ON t.rider_id = r.id WHERE r.name = '" + parsed.rider_name + "' AND t.status = 'pending';";
  if (parsed.intent === 'list_trips') return "SELECT t.id, t.status, t.shop_name, r.name FROM delivery_trips t JOIN delivery_riders r ON t.rider_id = r.id WHERE r.name = '" + parsed.rider_name + "';";
  return null;
}

async function executeDistributorQuery(userQuery) {
  const sql = await generateSQLForDistributor(userQuery);
  if (!sql || !sql.startsWith('SELECT')) return "I cannot answer that.";
  try {
    const dbResult = await query(sql, []);
    if (dbResult.length === 0) return "No records found.";
    const formatPrompt = "User asked: " + userQuery + ". Data: " + JSON.stringify(dbResult) + ". Summarize in professional English.";
    return await callMetaLlama(formatPrompt, "You are a data assistant.");
  } catch (err) {
    return "Error querying database.";
  }
}

async function handleCommerceQuery(userMessage, shopUid) {
  const systemPrompt = "Extract product name to JSON: {\"product_name\": \"Wai Wai\"}. If none, {\"product_name\": null}.";
  const aiExtraction = await callMetaLlama(userMessage, systemPrompt, true);
  let parsed;
  try { parsed = JSON.parse(aiExtraction.replace(/```json/g, '').replace(/```/g, '').trim()); } catch (e) { return "Maaf garnus, bujhina."; }

  if (!parsed.product_name) return "Tapai kun saman khojdai hunuhuncha?";
  
  const stores = await query("SELECT id FROM stores WHERE uid = ? LIMIT 1", [shopUid]);
  if (stores.length === 0) return "Store not found.";
  
  const products = await query("SELECT name, price_per_unit AS price, stock_qty FROM products WHERE store_id = ? AND name LIKE ? LIMIT 1", [stores[0].id, "%" + parsed.product_name + "%"]);
  if (products.length === 0) return "Maaf garnus, " + parsed.product_name + " stock ma chhaina.";
  if (products[0].stock_qty <= 0) return "Maaf garnus, " + products[0].name + " out of stock chha.";

  const replyPrompt = "Customer asked: " + userMessage + ". Data: " + products[0].name + ", Rs " + products[0].price + ". Reply in the same language.";
  return await callMetaLlama(replyPrompt, "You are a shop assistant.", false);
}

module.exports = { executeDistributorQuery, handleCommerceQuery, callMetaLlama };
