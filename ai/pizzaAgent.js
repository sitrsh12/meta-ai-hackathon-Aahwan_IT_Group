const mysql = require('mysql2/promise');
const { callMetaLlama } = require('./metaAgent');

const PIZZA_STORE_ID = 5;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

async function query(sql, params) {
  const p = params || [];
  const [rows] = await pool.execute(sql, p);
  return rows;
}


async function getMenuNames() {
  const rows = await query("SELECT name FROM products WHERE store_id = ? AND active = 1", [PIZZA_STORE_ID]);
  return rows.map(r => r.name).join(", ");
}

async function extractPizzaItems(userText, history) {
  const h = history || [];
  const menuNames = await getMenuNames();
  const systemPrompt = "You are a smart Pizza Ghar voice assistant. The input comes from a speech-to-text engine and WILL contain phonetic spelling, typos, or Nepali accent words. Your job is to fuzzy-match the user's intent to the CLOSEST items in this EXACT menu: " + menuNames + ". If the user asks what is on the menu, return {\"intent\": \"ASK_MENU\", \"items\": []}. If the user asks to see a picture/image of a food item (e.g., 'show me the pizza', 'what does it look like'), return {\"intent\": \"ASK_IMAGE\", \"item_name\": \"exact menu name\"}. Otherwise, extract items to JSON using EXACT menu names. IMPORTANT: If the user asks for an item that is NOT on the menu (e.g., momo, sushi), YOU MUST STILL EXTRACT IT AS AN ORDER using the user's requested name, so the backend can reject it. Do NOT return NONE for food items. Schema: {\"intent\": \"ORDER\", \"items\": [{\"name\": \"exact menu name or requested name\", \"qty\": integer}]}. If the user is just chatting or cancelling, return {\"intent\": \"NONE\", \"items\": []}. No other text.";
  const prompt = "Latest Customer Message: " + userText + ". Review the conversation history. Return the COMPLETE cumulative list of ALL items currently in the cart. If the customer is adding a new item (e.g. 'and a lassi'), include previously ordered items AND the new item. If the customer says to REMOVE, CANCEL, or DELETE an item (e.g. 'remove the pizza'), return the cart WITHOUT that item. If they remove everything, return an empty list. Return ONLY JSON.";
  const raw = await callMetaLlama(prompt, systemPrompt, true, h);
  let clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (!m) return { intent: 'NONE', items: [] };
  try {
    const parsed = JSON.parse(m[0]);
    if (parsed.intent === 'ASK_MENU') return { intent: 'ASK_MENU', items: [] };
    if (parsed.intent === 'ASK_IMAGE') return { intent: 'ASK_IMAGE', item_name: parsed.item_name, items: [] };
    if (!parsed.items) return { intent: 'NONE', items: [] };
    return { intent: 'ORDER', items: parsed.items };
  } catch (e) {
    return { intent: 'NONE', items: [] };
  }
}

async function matchPizzaMenu(items) {
  const matched = [];
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const name = items[i].name || "";
    const qty = parseInt(items[i].qty, 10) || 1;
    if (!name) continue;
    const rows = await query("SELECT id, name, price_per_unit AS price, stock_qty FROM products WHERE store_id = ? AND active = 1 AND name LIKE ? LIMIT 1", [PIZZA_STORE_ID, "%" + name + "%"]);
    if (rows.length === 0) {
      matched.push({ asked: name, found: null, qty: qty });
    } else {
      const price = parseFloat(rows[0].price);
      total = total + (price * qty);
      matched.push({ asked: name, found: rows[0].name, price: price, qty: qty, line_total: price * qty });
    }
  }
  return { matched: matched, total: total };
}

module.exports = { extractPizzaItems, matchPizzaMenu, PIZZA_STORE_ID };
