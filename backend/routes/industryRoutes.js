import express from 'express';
import {
  createIndustry,
  deleteIndustry,
  addCategoryToIndustry,
  deleteCategoryFromIndustry,
  getIndustryWithCategories,
  getAllIndustriesWithCategories
} from '../controllers/industryController.js';

const router = express.Router();

router.post('/create', createIndustry);
router.delete('/:id', deleteIndustry);
router.post('/:id/category', addCategoryToIndustry);
router.get("/:industryId", getIndustryWithCategories);
router.delete('/:industryId/category/:categoryId', deleteCategoryFromIndustry);
router.get('/', getAllIndustriesWithCategories);
export default router;