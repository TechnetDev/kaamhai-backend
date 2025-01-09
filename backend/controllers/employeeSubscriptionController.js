import Razorpay from 'razorpay';
import Subscription from '../models/employee/EmployeeSubscription.model.js';
import EmployeeInfoModel from '../models/employee/EmployeeInfo.model.js';

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLAN_IDS = {
  '499': process.env.RAZORPAY_PLAN_ID_499,
  '249': process.env.RAZORPAY_PLAN_ID_249,
};

export const createPremiumSubscription = async (req, res) => {
  const employeeId = req.employeeId;
  const { amount } = req.body;
  const planId = PLAN_IDS[amount];

  if (!planId) {
    return res.status(400).json({ message: 'Invalid subscription amount' });
  }

  try {
    const user = await EmployeeInfoModel.findOne({ id: employeeId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const subscription = await razorpayInstance.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12,
    });

    const newSubscription = new Subscription({
      userId: user.id,
      razorpaySubscriptionId: subscription.id,
      status: subscription.status,
    });

    await newSubscription.save();
    res.json({ message: 'Premium subscription created', subscription });
  } catch (error) {
    res.status(500).json({ message: 'Error creating subscription', error });
  }
};

export const checkPaymentStatus = async (req, res) => {
  const employeeId = req.employeeId;

  try {
    const subscription = await Subscription.findOne({ userId: employeeId, status: 'active' });
    const user = await EmployeeInfoModel.findOne({ id: employeeId, plan: 'premium' });

    if (subscription && user) {
      res.status(201).json({ message: 'Payment successful', success: true, subscription });
    } else {
      res.status(200).json({ message: 'Payment failed', success: false });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error checking payment status', error });
  }
};