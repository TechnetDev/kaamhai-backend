import crypto from 'crypto';
import Subscription from '../models/employee/EmployeeSubscription.model.js';
import EmployeeInfoModel from '../models/employee/EmployeeInfo.model.js';

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

export const handleWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;
console.log(body);
  const generatedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(body))
    .digest('hex');

  if (generatedSignature !== signature) {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  const { event, payload } = body;
console.log("Event: ", event);
  console.log("Payload: ", payload);

  if (event === 'subscription.charged') {
    const subscriptionId = payload.subscription.entity.id;
    const paymentStatus = payload.subscription.entity.status;

    // Extract payment details
    const paymentId = payload.payment.entity.id;
    const paymentMethod = payload.payment.entity.method;
    const paymentAmount = payload.payment.entity.amount;

    try {
      const subscription = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId });

      if (subscription) {
        // Update subscription status and payment details
        subscription.status = paymentStatus;
        subscription.paymentId = paymentId;
        subscription.paymentMethod = paymentMethod;
        subscription.paymentAmount = paymentAmount;

        await subscription.save();

        // Update user plan if payment is successful
        if (paymentStatus === 'active' || paymentStatus === 'paid') {
          const user = await EmployeeInfoModel.findOne({ id: subscription.userId });

          if (user) {
            user.plan = 'premium';
            await user.save();
          }
        }

        res.json({ message: 'Subscription payment handled successfully' });
      } else {
        res.status(404).json({ message: 'Subscription not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error handling webhook', error });
    }
  } else {
    res.status(400).json({ message: 'Unhandled event type' });
  }
};