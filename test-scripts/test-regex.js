const content = `import express from 'express';
import productController from '../controllers/product.controller.js';

const router = express.Router();

/**
 * @route POST /api/products/vectorize
 */
router.post('/vectorize', productController.vectorizeProducts);

/**
 * @route POST /api/products/recommend
 */
router.post('/recommend', productController.getRecommendations);

router.get('/stats', productController.getStats);

export default router;
`;

// Test the regex
const pattern = /router\.(\w+)\s*\(\s*['"]([^'"]+)['"]\s*,\s*([a-zA-Z_][a-zA-Z0-9_.]*(?:\([^)]*\))?)\s*\)/g;

let match;
let matches = [];
while ((match = pattern.exec(content)) !== null) {
  matches.push({
    method: match[1],
    path: match[2],
    handler: match[3]
  });
  console.log('Matched:', { method: match[1], path: match[2], handler: match[3] });
}

console.log('\nTotal matches:', matches.length);
