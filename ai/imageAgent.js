async function generateImage(itemNames) {
  // Accept a single string OR an array of item names
  const items = Array.isArray(itemNames) ? itemNames : [itemNames];
  
  // Build a natural-language list: "Pizza, Burger and Lassi"
  let itemList;
  if (items.length === 1) {
    itemList = items[0];
  } else if (items.length === 2) {
    itemList = items[0] + ' and ' + items[1];
  } else {
    itemList = items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  const prompt = items.length > 1
    ? "A high-quality, mouth-watering professional food photograph of " + itemList + " together on a wooden restaurant table, 4k resolution, studio lighting, appetizing presentation."
    : "A high-quality, mouth-watering professional food photograph of " + itemList + " at a restaurant, 4k resolution, studio lighting.";

  try {
    const url = "https://api.meta.ai/v1/images/generations";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.META_API_KEY
      },
      body: JSON.stringify({
        model: "muse-image-1.0",
        prompt: prompt,
        n: 1,
        size: "1024x1024"
      }),
      signal: AbortSignal.timeout(40000)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data[0]) {
        if (data.data[0].url) {
          console.log('🎨 [IMAGE SUCCESS] URL for:', itemList);
          return data.data[0].url;
        } else if (data.data[0].b64_json) {
          console.log('🎨 [IMAGE SUCCESS] Base64 for:', itemList);
          return 'data:image/jpeg;base64,' + data.data[0].b64_json;
        }
      }
    }
    console.error("[Meta Image API Error] Status: " + response.status);
  } catch (err) {
    console.error("[Meta Image API Error] " + err.message);
  }
  return null;
}

module.exports = { generateImage };
