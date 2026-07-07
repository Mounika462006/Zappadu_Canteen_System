/**
 * AI Module: Intelligent Canteen Chatbot Engine ("ZappaBot")
 * Method: Rule-Based Natural Language Processing, Keyword Extraction, and Constraint Parsing.
 * Target: Parse natural language queries and return helpful recommendations, filters, or cart action items.
 */
   
import { dbAll } from '../db.js';
import { getRecommendations } from './foodRecommender.js';

/**
 * Handles incoming chatbot queries and returns structured responses.
 */
export async function handleChatQuery(message, studentId) {
  const msg = message.toLowerCase().trim();
  const allItems = await dbAll('SELECT mi.*, s.name as shopName FROM menu_items mi JOIN shops s ON mi.shopId = s.id WHERE mi.available = 1');
  
  let responseText = "";
  let action = null; // Client-side action trigger (e.g., { type: 'add_to_cart', itemId: '1' })
  let suggestedPrompts = [
    "What is spicy under ₹50?",
    "Help me choose breakfast",
    "Show me South Indian foods",
    "Where can I get Cold Coffee?"
  ];

  // 1. Check for pricing constraints (e.g., "under 50", "below 60", "under 100 rupees")
  const priceRegex = /(?:under|below|less than|within|max|budget of)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i;
  const priceMatch = msg.match(priceRegex);
  let priceLimit = null;
  if (priceMatch) {
    priceLimit = parseInt(priceMatch[1]);
  }

  // 2. Identify Category and Flavor Profile Keywords
  let categoryKeyword = null;
  if (msg.includes('south indian') || msg.includes('dosa') || msg.includes('idli') || msg.includes('vada')) {
    categoryKeyword = 'South Indian';
  } else if (msg.includes('north indian') || msg.includes('paneer') || msg.includes('chole') || msg.includes('dal')) {
    categoryKeyword = 'North Indian';
  } else if (msg.includes('chinese') || msg.includes('rice') || msg.includes('noodle') || msg.includes('fried rice')) {
    categoryKeyword = 'Chinese';
  } else if (msg.includes('snack') || msg.includes('samosa') || msg.includes('vada pav')) {
    categoryKeyword = 'Snacks';
  } else if (msg.includes('drink') || msg.includes('beverage') || msg.includes('coffee') || msg.includes('tea') || msg.includes('soda') || msg.includes('chai')) {
    categoryKeyword = 'Beverages';
  }

  let flavorKeyword = null;
  if (msg.includes('spicy') || msg.includes('hot') || msg.includes('pepper') || msg.includes('masala')) {
    flavorKeyword = 'spicy';
  } else if (msg.includes('sweet') || msg.includes('cold') || msg.includes('dessert') || msg.includes('sugar')) {
    flavorKeyword = 'sweet';
  } else if (msg.includes('healthy') || msg.includes('light') || msg.includes('steamed') || msg.includes('diet')) {
    flavorKeyword = 'healthy';
  }

  // 3. Identify Direct Actions (e.g. "add Masala Dosa to cart", "buy coffee")
  const addToCartRegex = /(?:add|put|order|get|buy)\s+([a-zA-Z\s0-9\(\)]+?)(?:\s+to\s+cart|\s+to\s+my\s+cart|$)/i;
  const cartMatch = msg.match(addToCartRegex);
  
  if (cartMatch && !msg.includes('recommend') && !msg.includes('suggest') && !msg.includes('what')) {
    const itemName = cartMatch[1].trim();
    // Find item with closest name match
    let bestMatch = null;
    let highestScore = 0;

    for (const item of allItems) {
      if (item.name.toLowerCase() === itemName) {
        bestMatch = item;
        break;
      }
      if (item.name.toLowerCase().includes(itemName) || itemName.includes(item.name.toLowerCase())) {
        bestMatch = item;
        break;
      }
    }

    if (bestMatch) {
      responseText = `🛒 I have added **${bestMatch.name}** (₹${bestMatch.price}) from **${bestMatch.shopName}** directly to your cart! You can review your cart or type 'checkout' to complete your order.`;
      action = {
        type: 'add_to_cart',
        itemId: bestMatch.id,
        itemName: bestMatch.name,
        itemPrice: bestMatch.price,
        shopId: bestMatch.shopId
      };
      suggestedPrompts = [
        "Go to Cart",
        "What else do you suggest?",
        "Any quick beverages?"
      ];
      return { responseText, action, suggestedPrompts };
    }
  }

  // 4. Chatbot Navigation Actions
  if (msg === 'go to cart' || msg === 'open cart' || msg === 'view cart') {
    responseText = "Opening your shopping cart right now!";
    action = { type: 'navigate', path: '/cart' };
    return { responseText, action, suggestedPrompts };
  } else if (msg === 'checkout' || msg === 'place order') {
    responseText = "Redirecting you to the checkout cart page so you can select payment and place your order!";
    action = { type: 'navigate', path: '/cart' };
    return { responseText, action, suggestedPrompts };
  } else if (msg === 'my orders' || msg === 'track order' || msg === 'status') {
    responseText = "Let's check your current active orders. Opening the Orders page...";
    action = { type: 'navigate', path: '/orders' };
    return { responseText, action, suggestedPrompts };
  }

  // 5. Query Filter Handling (combination of category, flavor, price)
  let filtered = [...allItems];

  if (categoryKeyword) {
    filtered = filtered.filter(item => item.category === categoryKeyword || (categoryKeyword === 'Chinese' && item.category === 'Chinese') || (categoryKeyword === 'South Indian' && item.category === 'South Indian'));
  }
  if (priceLimit !== null) {
    filtered = filtered.filter(item => item.price <= priceLimit);
  }
  if (flavorKeyword) {
    filtered = filtered.filter(item => {
      const text = `${item.name} ${item.description}`.toLowerCase();
      if (flavorKeyword === 'spicy') return text.includes('spicy') || text.includes('masala') || text.includes('chili') || text.includes('biryani');
      if (flavorKeyword === 'sweet') return text.includes('sweet') || text.includes('coffee') || text.includes('tea') || text.includes('juice') || text.includes('cream');
      if (flavorKeyword === 'healthy') return text.includes('steamed') || text.includes('idli') || text.includes('wheat') || text.includes('dal');
      return true;
    });
  }

  // 6. Formulate Intelligent Response
  
  // Checking for greeting
  const greetings = ['hello', 'hi', 'hey', 'yo', 'good morning', 'good afternoon', 'good evening', 'help', 'who are you'];
  const isGreeting = greetings.some(g => msg.startsWith(g)) || msg === 'help';

  if (isGreeting) {
    responseText = `👋 Hello! I am **ZappaBot**, your intelligent Canteen Assistant! I can help you:
    \n• Search food by budget (e.g. *"spicy under ₹50"*)
    \n• Add items directly to your cart (e.g. *"add Masala Dosa"*)
    \n• Give personalized recommendations based on your preferences
    \n• Navigate around the site (*"open cart"*, *"track orders"*)
    \n\nWhat can I prepare for you today?`;
  }
  // Checking for recommendations request
  else if (msg.includes('recommend') || msg.includes('suggest') || msg.includes('what should i eat') || msg.includes('special')) {
    const recs = await getRecommendations(studentId || '1');
    if (recs.length > 0) {
      responseText = `✨ Based on our **AI Recommendation Engine (Cosine Similarity Model)**, here are some top suggestions tailored for you:
      \n${recs.map((r, i) => `${i+1}. **${r.name}** (₹${r.price}) - *${r.aiReason}*`).join('\n')}
      \nWould you like me to add any of these to your cart?`;
      suggestedPrompts = recs.map(r => `Add ${r.name}`);
    } else {
      responseText = "I highly recommend trying our fresh **Masala Dosa** from Annapurna or a cold **Cold Coffee** from Quick Bites! Both are student favorites today.";
    }
  } 
  // Custom filter responses
  else if (categoryKeyword || priceLimit !== null || flavorKeyword) {
    if (filtered.length === 0) {
      responseText = `Sorry, I couldn't find any active menu items matching those requirements ${priceLimit ? `under ₹${priceLimit}` : ""}. 
      \nWould you like to try something else or see our full menu?`;
      suggestedPrompts = ["Show me everything", "Recommended food", "Samosa under 30"];
    } else {
      const criteria = [];
      if (flavorKeyword) criteria.push(`**${flavorKeyword}**`);
      if (categoryKeyword) criteria.push(`**${categoryKeyword}**`);
      if (priceLimit) criteria.push(`under **₹${priceLimit}**`);

      responseText = `🔍 Found **${filtered.length}** delicious items matching ${criteria.join(' ')}:
      \n${filtered.slice(0, 5).map(item => `• **${item.name}** (₹${item.price}) at *${item.shopName}* - "${item.description.slice(0, 50)}..."`).join('\n')}
      ${filtered.length > 5 ? `\n...and ${filtered.length - 5} more items!` : ""}
      \nType **"add [item name]"** to quickly add it to your cart!`;
      
      suggestedPrompts = filtered.slice(0, 3).map(item => `Add ${item.name}`);
    }
  }
  // Search for specific item by name
  else {
    let matchedItem = null;
    for (const item of allItems) {
      if (msg.includes(item.name.toLowerCase())) {
        matchedItem = item;
        break;
      }
    }

    if (matchedItem) {
      responseText = `🍴 Yes, we have **${matchedItem.name}**! It costs **₹${matchedItem.price}** at **${matchedItem.shopName}**. 
      \n*Description*: ${matchedItem.description}
      \n*Est. Prep Time*: ~${matchedItem.preparationTime} minutes.
      \nWould you like me to add it to your cart?`;
      suggestedPrompts = [`Add ${matchedItem.name}`, "What goes well with this?", "Recommended food"];
    } else {
      // General NLP fallback fallback
      responseText = `I'm not quite sure how to process that. I can search our menu, help you place orders, or run our AI Recommendation algorithms.
      \nTry asking:
      \n• *"spicy under 50"*
      \n• *"what do you recommend?"*
      \n• *"add Idli Sambar"*`;
    }
  }

  return { responseText, action, suggestedPrompts };
}
