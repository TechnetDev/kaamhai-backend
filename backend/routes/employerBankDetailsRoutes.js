import express from 'express';
import {
    createBusinessAccount,
    getAccountsByEmployer,
    updateBusinessAccount,
    deleteBusinessAccount
} from '../controllers/employerBankAccountController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Create a new business bank account
router.post('/accounts', protect, createBusinessAccount);

// Get all accounts associated with the employer
router.get('/accounts', protect, getAccountsByEmployer);

// Update a specific business bank account
router.put('/accounts/:id', protect, updateBusinessAccount);

// Delete a specific business bank account
router.delete('/accounts/:id', protect, deleteBusinessAccount);

export default router;