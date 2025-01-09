import dotenv from "dotenv";
dotenv.config();

import Twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const apiKey = process.env.TWILIO_API_KEY;
// const apiSecret = process.env.TWILIO_API_SECRET;
const authToken = process.env.TWILIO_ACCOUNT_AUTH_TOKEN;
const client = Twilio(accountSid, authToken);

export default client;
