const content = `import express from 'express';
import productController from '../controllers/product.controller.js';

const router = express.Router();

router.post('/vectorize', productController.vectorizeProducts);
router.post('/recommend', productController.getRecommendations);
router.get('/stats', productController.getStats);

export default router;
`;

// Parse routes from the file
const routePattern = /router\.(\w+)\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*([^)]+))?\s*\)/g;
let match;

while ((match = routePattern.exec(content)) !== null) {
  console.log('Matched:', {
    method: match[1],
    path: match[2],
    middlewares: match[3]
  });
}

console.log('\n--- Testing full pattern ---');

// Try different pattern
const fullPattern = /router\.(\w+)\s*\(\s*['"]([^'"]+)['"]\s*,?\s*([^)]+)?\s*\)/g;
while ((match = fullPattern.exec(content)) !== null) {
  console.log('Full pattern matched:', {
    method: match[1],
    path: match[2],
    rest: match[3]
  });
}
