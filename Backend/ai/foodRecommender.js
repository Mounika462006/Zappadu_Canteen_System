/**
 * AI & Data Science Module: Content-Based Recommender System
 * Method: Cosine Similarity Vector Matching.
 * Target: Recommend top 3 food items to students based on their purchase history profiles.
 */

import { dbAll } from '../db.js';

// Feature dimensions:
// 0: South Indian, 1: North Indian, 2: Chinese, 3: Snacks, 4: Beverages, 5: Rice, 6: Breads
// 7: Price Bracket (0 to 1), 8: Spicy Profile, 9: Sweet Profile, 10: Healthy Profile
const FEATURE_COUNT = 11;

/**
 * Encodes a menu item into a numerical feature vector.
 */
function getMenuItemVector(item) {
  const vec = new Array(FEATURE_COUNT).fill(0);

  // 1. One-Hot Encode Category
  const cat = item.category.toLowerCase();
  if (cat.includes('south indian')) vec[0] = 1.0;
  else if (cat.includes('north indian')) vec[1] = 1.0;
  else if (cat.includes('chinese')) vec[2] = 1.0;
  else if (cat.includes('snacks')) vec[3] = 1.0;
  else if (cat.includes('beverages')) vec[4] = 1.0;
  else if (cat.includes('rice')) vec[5] = 1.0;
  else if (cat.includes('breads')) vec[6] = 1.0;

  // 2. Price Scaling (0 to 1 range, max price ~150 rupees)
  vec[7] = Math.min(1.0, item.price / 150);

  // 3. Extrapolate Flavor Profiles using text keywords
  const fullText = `${item.name} ${item.description}`.toLowerCase();
  
  // Spicy profile
  if (fullText.includes('spicy') || fullText.includes('masala') || fullText.includes('chili') || fullText.includes('biryani') || fullText.includes('curry') || fullText.includes('vada pav')) {
    vec[8] = 0.9;
  } else if (fullText.includes('sambar') || fullText.includes('chutney')) {
    vec[8] = 0.4;
  }

  // Sweet profile
  if (fullText.includes('sweet') || fullText.includes('coffee') || fullText.includes('tea') || fullText.includes('chai') || fullText.includes('juice') || fullText.includes('ice cream')) {
    vec[9] = 0.9;
  }

  // Healthy/Steamed profile
  if (fullText.includes('steamed') || fullText.includes('idli') || fullText.includes('lentil') || fullText.includes('whole wheat') || fullText.includes('dal') || fullText.includes('lime')) {
    vec[10] = 0.8;
  }

  return vec;
}

/**
 * Calculates the dot product of two vectors.
 */
function dotProduct(vecA, vecB) {
  let product = 0;
  for (let i = 0; i < FEATURE_COUNT; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
}

/**
 * Calculates the magnitude of a vector.
 */
function magnitude(vec) {
  let sum = 0;
  for (let i = 0; i < FEATURE_COUNT; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

/**
 * Computes Cosine Similarity between two vectors: (A . B) / (||A|| * ||B||)
 */
function cosineSimilarity(vecA, vecB) {
  const dot = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * Generates food recommendations for a given student based on their past orders.
 */
export async function getRecommendations(studentId) {
  try {
    // 1. Fetch all past order items for the student
    const query = `
      SELECT oi.menuItemId, oi.name, oi.price, oi.quantity, mi.category, mi.description 
      FROM order_items oi
      JOIN orders o ON oi.orderId = o.id
      JOIN menu_items mi ON oi.menuItemId = mi.id
      WHERE o.studentId = ? AND o.status != 'cancelled'
    `;
    const pastItems = await dbAll(query, [studentId]);
    
    // Fetch all available menu items to recommend from
    const allItems = await dbAll('SELECT * FROM menu_items WHERE available = 1');

    if (allItems.length === 0) return [];

    // Fallback: If no order history, return top popular items by general category or default picks
    if (pastItems.length === 0) {
      console.log(`AI Recommender: No history for student ${studentId}. Returning default popular items.`);
      // Return 3 items from different categories/shops
      return allItems.slice(0, 3).map(item => ({
        ...item,
        aiReason: 'Popular choice in the canteen right now!'
      }));
    }

    // 2. Build User Preference Profile Vector
    const userPrefVector = new Array(FEATURE_COUNT).fill(0);
    let totalQuantity = 0;

    for (const item of pastItems) {
      const vec = getMenuItemVector({
        category: item.category,
        price: item.price,
        name: item.name,
        description: item.description
      });

      const weight = item.quantity;
      totalQuantity += weight;

      for (let i = 0; i < FEATURE_COUNT; i++) {
        userPrefVector[i] += vec[i] * weight;
      }
    }

    // Normalize User Vector
    if (totalQuantity > 0) {
      for (let i = 0; i < FEATURE_COUNT; i++) {
        userPrefVector[i] /= totalQuantity;
      }
    }

    // 3. Compute Cosine Similarity for each available item
    const scoredItems = [];
    const pastItemIds = new Set(pastItems.map(item => item.menuItemId));

    for (const item of allItems) {
      const itemVector = getMenuItemVector(item);
      const similarity = cosineSimilarity(userPrefVector, itemVector);

      // Add a slight variance/penalty if they ordered it already, to keep suggestions fresh
      const penalty = pastItemIds.has(item.id) ? 0.85 : 1.0;
      const score = similarity * penalty;

      // Determine textual explanation for the recommendation
      let aiReason = 'Fits your dietary style.';
      if (itemVector[8] > 0.6 && userPrefVector[8] > 0.5) {
        aiReason = 'Matches your preference for spicy foods!';
      } else if (itemVector[9] > 0.6 && userPrefVector[9] > 0.5) {
        aiReason = 'Recommended because you enjoy sweet drinks & treats.';
      } else if (itemVector[10] > 0.6 && userPrefVector[10] > 0.5) {
        aiReason = 'Perfect lightweight & healthy choice for you.';
      } else if (pastItemIds.has(item.id)) {
        aiReason = 'You ordered this before and enjoyed it!';
      } else {
        aiReason = `Pairs perfectly with your favorite ${pastItems[0]?.category || 'dishes'}.`;
      }

      scoredItems.push({
        ...item,
        score,
        aiReason
      });
    }

    // 4. Sort and return top 3 recommendations
    scoredItems.sort((a, b) => b.score - a.score);
    return scoredItems.slice(0, 3);
  } catch (error) {
    console.error('AI Recommender: Failed to calculate recommendations:', error);
    return [];
  }
}
