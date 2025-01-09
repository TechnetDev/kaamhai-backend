import { sendOTP, verifyOTP } from '../utils/otpService.js';

export const sendOtpController = async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
    }
    try {
        // Generate and send OTP, then store it in session for later verification
        const otp = await sendOTP(phoneNumber);
        req.session.otp = otp;
        req.session.phoneNumber = phoneNumber;

        res.json({ message: "OTP sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to send OTP", error: error.message });
    }
};

export const verifyOtpController = async (req, res) => {
    const { phoneNumber, otp } = req.body;

    // Retrieve the OTP and phone number from the session
    const sessionOtp = req.session.otp;
    const sessionPhoneNumber = req.session.phoneNumber;

    if (!phoneNumber || !otp) {
        return res.status(400).json({ message: "Phone number and OTP are required" });
    }

    if (phoneNumber !== sessionPhoneNumber) {
        return res.status(400).json({ message: "Phone number does not match" });
    }

    try {
        const status = verifyOTP(otp, sessionOtp);
        if (status === 'approved') {
            req.session.destroy(); // Clear session after successful verification
            res.json({ message: "OTP verified successfully" });
        } else {
            res.status(401).json({ message: "Invalid OTP" });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to verify OTP", error: error.message });
    }
};