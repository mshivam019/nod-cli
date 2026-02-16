const content = `import express from 'express';
import productController from '../controllers/product.controller.js';
import { modelSelection } from '../middleware/modelSelection.middleware.js';
import { sourceSelection } from '../middleware/sourceSelection.middleware.js';

const router = express.Router();

// Apply model selection middleware to all routes
router.use(modelSelection);
router.use(sourceSelection);

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

// Test controller import extraction
function extractControllerImport(content) {
  // Look for controller import
  const controllerPattern = /import\s+.*\s+from\s*['"][^'"]*controller[^'"]*['"];?/i;
  const match = content.match(controllerPattern);
  console.log('Controller import match:', match ? match[0] : 'not found');
  return match ? match[0] : "import controller from '../controllers/controller.js';";
}

extractControllerImport(content);
