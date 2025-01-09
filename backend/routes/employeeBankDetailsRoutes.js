import express from 'express';
import { createAccount, getAllAccounts, getAccountsByEmployee, updateAccount, deleteAccount } from '../controllers/employeeBankAccountController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.post('/accounts', protect, createAccount);
router.get('/accounts/:employeeId?', protect, getAccountsByEmployee);
router.get('/all/accounts', protect, getAllAccounts);
router.put('/accounts/:id', protect, updateAccount);
router.delete('/accounts/:id', protect, deleteAccount);

export default router;