import crypto from 'crypto';
import razorpay from '../utils/razorpay.js';
import BusinessAccount from '../models/business/businessAccount.model.js';
import JobPost from '../models/jobPosts/jobPosts.model.js';
export const createOrder = async (req, res) => {
  const { amount, businessAccountId } = req.body;

  const options = {
    amount: amount * 100,
    currency: 'INR',
    receipt: `receipt_${businessAccountId}`,
    payment_capture: 1,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ orderId: order.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const handleWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  console.log('Request Headers:', req.headers);
  console.log('Request Body:', req.body);

  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  console.log('Computed digest:', digest);
  console.log('Received signature:', req.headers['x-razorpay-signature']);

  if (digest === req.headers['x-razorpay-signature']) {
    console.log('Request is legit');

    const event = req.body.event;
    if (event === 'payment.captured') {
      const { order_id, payment_id } = req.body.payload.payment.entity;
      const jobPostId = req.body.payload.payment.entity.notes.jobPostId;

      console.log('Order ID:', order_id);
      console.log('Payment ID:', payment_id);
      console.log('Job Post ID:', jobPostId);

      try {
        // Find the job post by jobPostId and update isPaymentDone
        await JobPost.findByIdAndUpdate(jobPostId, { isPaymentDone: true });
        res.status(200).json({ status: 'ok' });
      } catch (error) {
        console.error('Error updating job post:', error);
        res.status(500).json({ message: 'Error updating job post', success: false, error: error.message });
      }
    } else {
      console.log('Unhandled event:', event);
      res.status(400).json({ status: 'event not handled' });
    }
  } else {
    console.log('Invalid signature');
    res.status(400).json({ status: 'invalid signature' });
  }
};