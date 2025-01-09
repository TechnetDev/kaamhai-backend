import { ReferralClick } from '../models/referral.model.js';

// Tracks referral click and redirects to Play Store
export const trackReferralClick = async (req, res) => {
  try {
    const { refCode } = req.query;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

     // Generate a unique device ID
    const deviceId = Math.random().toString(36).substring(2, 15);

    // Log data before saving
    console.log('Referral data to be saved:', {
      refCode,
      deviceId,
      ipAddress,
      userAgent
    });

   // Check if referral exists in the database
    const existingReferral = await ReferralClick.findOne({ refCode, deviceId });
    if (existingReferral) {
      console.log(`Referral with refCode: ${refCode} and deviceId: ${deviceId} already exists.`);
    } else {
      console.log(`No existing referral found for refCode: ${refCode} and deviceId: ${deviceId}`);
    }

    // Store referral click information
    const savedReferral = await ReferralClick.create({ refCode, deviceId, ipAddress, userAgent });

    // Log data after saving
    console.log('Saved referral data:', savedReferral);

    // Check if the referral was successfully saved
    const savedReferralCheck = await ReferralClick.findById(savedReferral._id);
    console.log('Referral saved check:', savedReferralCheck);

    // Redirect to Play Store with referrer info
    res.redirect(`https://play.google.com/store/apps/details?id=com.kaamhai&referrer=deviceId=${deviceId}`);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Matches deviceId and returns referral code
export const fetchReferralData = async (req, res) => {
  try {
    const { deviceId } = req.query;

    // Find referral record by deviceId
    const referral = await ReferralClick.findOne({ deviceId });

    if (referral) {
      return res.status(200).json({ success: true, refCode: referral.refCode });
    } else {
      return res.status(404).json({ success: false, message: 'No referral data found.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};