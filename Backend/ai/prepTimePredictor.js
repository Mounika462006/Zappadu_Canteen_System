/**
 * AI & Data Science Module: Multiple Linear Regression from Scratch
 * Target: Predict food preparation time based on order complexity, queue size, and peak hour status.
 * Method: Gradient Descent Optimization for Mean Squared Error (MSE) minimization.
 */

// Global model parameters, trained on startup
let weights = [0.8, 1.0, 3.0]; // [complexity, queueSize, peakHour]
let bias = 1.5;
let rSquared = 0.0;
let trainingHistory = [];

/**
 * Generates synthetic historical order data for training.
 * Mimics real canteen dynamics with natural variance (noise).
 */
function generateHistoricalData(numSamples = 150) {
  const data = [];
  const trueComplexityWeight = 1.1;
  const trueQueueWeight = 1.4;
  const truePeakWeight = 5.2;
  const trueIntercept = 1.8;

  for (let i = 0; i < numSamples; i++) {
    // Random feature generation
    const complexity = Math.floor(Math.random() * 15) + 3; // complexity minutes (3-17)
    const queueSize = Math.floor(Math.random() * 8);       // current active orders (0-7)
    const peakHour = Math.random() > 0.65 ? 1 : 0;         // 1 if peak class break, else 0

    // Linear relation + normal distribution noise (~0 to 2 min noise)
    const noise = (Math.random() - 0.5) * 2.5;
    const actualPrepTime = Math.max(
      3, 
      Math.round(trueComplexityWeight * complexity + trueQueueWeight * queueSize + truePeakWeight * peakHour + trueIntercept + noise)
    );

    data.push({
      features: [complexity, queueSize, peakHour],
      label: actualPrepTime
    });
  }
  return data;
}

/**
 * Trains the multiple linear regression model using Batch Gradient Descent.
 */
export function trainModel() {
  console.log('AI Model: Starting Multiple Linear Regression training...');
  const dataset = generateHistoricalData(200);

  // Hyperparameters
  const learningRate = 0.001;
  const epochs = 1000;
  const n = dataset.length;

  // Initialize weights and bias to random small numbers
  weights = [Math.random(), Math.random(), Math.random()];
  bias = Math.random();
  trainingHistory = [];

  // Feature Scaling (Mean Normalization) - not fully necessary here due to small values,
  // but let's keep it simple and robust by adjusting learning rates for features.

  for (let epoch = 1; epoch <= epochs; epoch++) {
    let dw = [0, 0, 0];
    let db = 0;
    let totalError = 0;

    for (let i = 0; i < n; i++) {
      const x = dataset[i].features;
      const y = dataset[i].label;

      // Hypothesis prediction: Y_hat = w1*x1 + w2*x2 + w3*x3 + b
      const yHat = weights[0] * x[0] + weights[1] * x[1] + weights[2] * x[2] + bias;
      const diff = yHat - y;

      totalError += diff * diff;

      // Partial Derivatives
      dw[0] += diff * x[0];
      dw[1] += diff * x[1];
      dw[2] += diff * x[2];
      db += diff;
    }

    // Average the gradients
    dw = dw.map(val => val / n);
    db = db / n;

    // Gradient Descent updates
    weights[0] -= learningRate * dw[0] * 10; // Scale feature learning rate for faster convergence
    weights[1] -= learningRate * dw[1] * 10;
    weights[2] -= learningRate * dw[2] * 20;
    bias -= learningRate * db * 20;

    const mse = totalError / (2 * n);

    if (epoch % 100 === 0 || epoch === 1) {
      trainingHistory.push({ epoch, mse });
    }
  }

  // Calculate R-Squared (Coefficient of Determination) to measure model accuracy
  let meanY = 0;
  dataset.forEach(d => meanY += d.label);
  meanY /= n;

  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const x = dataset[i].features;
    const y = dataset[i].label;
    const yHat = weights[0] * x[0] + weights[1] * x[1] + weights[2] * x[2] + bias;

    ssTot += (y - meanY) * (y - meanY);
    ssRes += (y - yHat) * (y - yHat);
  }

  rSquared = 1 - (ssRes / ssTot);

  console.log('AI Model: Training completed successfully.');
  console.log(`- Final Weights: [Complexity: ${weights[0].toFixed(3)}, QueueSize: ${weights[1].toFixed(3)}, PeakHour: ${weights[2].toFixed(3)}]`);
  console.log(`- Final Intercept (Bias): ${bias.toFixed(3)}`);
  console.log(`- Model R² Accuracy: ${(rSquared * 100).toFixed(2)}%`);
}

/**
 * Predicts the food preparation time for a new order.
 * Inputs:
 * - baseComplexityTime: maximum preparation time of items in order
 * - currentActiveOrdersCount: number of active orders in the preparing queue
 * Returns: { predictedMinutes, explanation }
 */
export function predictPrepTime(baseComplexityTime, currentActiveOrdersCount) {
  // Check if current time is a peak canteen hour (e.g. 12:30 - 13:30 or 15:30 - 16:30)
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeVal = hours + minutes / 60;
  
  // Peak breaks: 12.5 to 13.5 (12:30 - 1:30 PM lunch) or 10.25 to 10.75 (10:15 - 10:45 AM short break)
  const isPeak = (timeVal >= 12.5 && timeVal <= 13.5) || (timeVal >= 10.25 && timeVal <= 10.75) ? 1 : 0;

  // Run the linear regression prediction
  const pred = weights[0] * baseComplexityTime + weights[1] * currentActiveOrdersCount + weights[2] * isPeak + bias;
  const finalMinutes = Math.max(3, Math.round(pred));

  // Build the breakdown details for the user
  const complexityContribution = weights[0] * baseComplexityTime;
  const queueContribution = weights[1] * currentActiveOrdersCount;
  const peakContribution = weights[2] * isPeak;

  return {
    predictedMinutes: finalMinutes,
    explanation: {
      baseComplexity: baseComplexityTime,
      complexityImpact: parseFloat(complexityContribution.toFixed(1)),
      queueCount: currentActiveOrdersCount,
      queueImpact: parseFloat(queueContribution.toFixed(1)),
      isPeakHour: isPeak === 1,
      peakHourImpact: parseFloat(peakContribution.toFixed(1)),
      systemDelay: parseFloat(bias.toFixed(1)),
      rSquared: parseFloat(rSquared.toFixed(3))
    }
  };
}

/**
 * Returns current model information for display in student dashboards.
 */
export function getModelMetrics() {
  return {
    weights: {
      complexity: parseFloat(weights[0].toFixed(3)),
      queueSize: parseFloat(weights[1].toFixed(3)),
      peakHour: parseFloat(weights[2].toFixed(3))
    },
    bias: parseFloat(bias.toFixed(3)),
    rSquared: parseFloat(rSquared.toFixed(3)),
    trainingHistory
  };
}

// Auto-train on startup
trainModel();
