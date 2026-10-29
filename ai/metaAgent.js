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

async function executePizzaQuery(userQuery) {
  const systemPrompt = "You are an expert MySQL assistant for 'Pizza Ghar', a Nepali restaurant. Write a single SELECT query to answer the user's question.\n" +
    "DATABASE SCHEMA:\n" +
    "Table: catalog_orders (id, retailer_name, retailer_phone, total, status, order_note, created_at). status is 'pending' or 'processing'. created_at is a timestamp.\n" +
    "Table: products (id, store_id, name, price_per_unit, stock_qty, active). active = 1 means available.\n" +
    "CRITICAL RULES:\n" +
    "- The products table contains items from MANY shops. Pizza Ghar is store_id = 5. ALWAYS filter products by store_id = 5.\n" +
    "- Always add 'active = 1' when querying products.\n" +
    "- catalog_orders.order_note is a JSON array of ordered items. Each element has: id, qty, found (item name), price, line_total.\n" +
    "- 'How many ORDERS' = COUNT(*) on catalog_orders.\n" +
    "- 'How many <ITEM> sold' = SUM of qty inside order_note JSON. NEVER use COUNT(*) for this. Use JSON_TABLE.\n" +
    "- Only output the raw SQL query (no markdown, no backticks, no explanation).\n" +
    "- Always start with SELECT.\n" +
    "Examples:\n" +
    "Q: How many orders total? -> SELECT COUNT(*) AS total_orders FROM catalog_orders;\n" +
    "Q: What is total revenue? -> SELECT SUM(total) AS revenue FROM catalog_orders;\n" +
    "Q: Which items are low on stock? -> SELECT name, stock_qty FROM products WHERE store_id = 5 AND active = 1 AND stock_qty < 10 ORDER BY stock_qty ASC;\n" +
    "Q: How many pizzas sold today? -> SELECT COALESCE(SUM(j.qty), 0) AS pizzas_sold_today FROM catalog_orders o, JSON_TABLE(o.order_note, \'$[*]\' COLUMNS (qty INT PATH \'$.qty\', name VARCHAR(255) PATH \'$.found\')) AS j WHERE DATE(o.created_at) = CURDATE() AND j.name LIKE \'%Pizza%\';\n" +
    "Q: How many burgers sold today? -> SELECT COALESCE(SUM(j.qty), 0) AS burgers_sold_today FROM catalog_orders o, JSON_TABLE(o.order_note, \'$[*]\' COLUMNS (qty INT PATH \'$.qty\', name VARCHAR(255) PATH \'$.found\')) AS j WHERE DATE(o.created_at) = CURDATE() AND j.name LIKE \'%Burger%\';\n" +
    "Q: What is my best-selling item? -> SELECT j.name, SUM(j.qty) AS total_sold FROM catalog_orders o, JSON_TABLE(o.order_note, \'$[*]\' COLUMNS (qty INT PATH \'$.qty\', name VARCHAR(255) PATH \'$.found\')) AS j GROUP BY j.name ORDER BY total_sold DESC LIMIT 5;";
  
  try {
    const rawResponse = await callMetaLlama(userQuery, systemPrompt, false);
    const cleanSQL = rawResponse.replace(/```sql/gi, '').replace(/```/g, '').replace(/^SQL:\s*/i, '').trim();
    
    console.log('🤖 [AI CO-PILOT SQL]:', cleanSQL);
    
    if (!cleanSQL.toUpperCase().startsWith('SELECT')) {
      return "I can only answer read-only questions about orders and inventory.";
    }

    // GUARDRAIL: Force store_id = 5 on any products query
    let finalSQL = cleanSQL;
    if (/\bfrom\s+products\b/i.test(finalSQL) && !/\bstore_id\s*=\s*5\b/i.test(finalSQL)) {
      console.log('⚠️  [GUARDRAIL] Products query missing store_id = 5, auto-fixing...');
      if (/\bwhere\b/i.test(finalSQL)) {
        finalSQL = finalSQL.replace(/\bwhere\b/i, 'WHERE store_id = 5 AND');
      } else if (/\border\s+by\b/i.test(finalSQL)) {
        finalSQL = finalSQL.replace(/\border\s+by\b/i, 'WHERE store_id = 5 ORDER BY');
      } else if (/\blimit\b/i.test(finalSQL)) {
        finalSQL = finalSQL.replace(/\blimit\b/i, 'WHERE store_id = 5 LIMIT');
      } else {
        finalSQL = finalSQL.replace(/;?\s*$/, ' WHERE store_id = 5;');
      }
      console.log('🔧 [FIXED SQL]:', finalSQL);
    }

    const dbResult = await query(finalSQL, []);
    
    if (!dbResult || dbResult.length === 0) {
      return "The query returned no data.";
    }

    const formatPrompt = "User asked: \"" + userQuery + "\". The database returned: " + JSON.stringify(dbResult) + ". Reply in a short, natural sentence (1-2 sentences max). IMPORTANT: This is a Nepali business - use 'Rs' for any currency/money amounts, NEVER use '$' or 'USD'. Do not mention SQL, tables, or database internals.";
    return await callMetaLlama(formatPrompt, "You are a smart business assistant for Pizza Ghar. Be concise and helpful.");
  } catch (err) {
    console.error('Pizza SQL Error:', err.message);
    return "Sorry, I couldn't process that query. Try 'What are my total orders?' or 'Which items are low on stock?'";
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

module.exports = { executePizzaQuery, handleCommerceQuery, callMetaLlama };
