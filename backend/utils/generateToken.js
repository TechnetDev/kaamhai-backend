import jwt from "jsonwebtoken";

/**
 * Generates a JWT token for user authentication.
 *
 * @param {string} phoneNumber - User's phone number.
 * @param {string} role - User's role in the system.
 * @param {string} userId - User's unique identifier.
 * @param {Object} [options={}] - Optional settings for token generation such as expiresIn.
 * @returns {string} - Returns the JWT token.
 */

const generateToken = (phoneNumber, role, userId) => {
  try {
    const payload = { phoneNumber, role, userId };
    console.log("Payload for JWT token:", payload);

    const token = jwt.sign(
      { phoneNumber, role, userId },
      process.env.JWT_SECRET,
      {
        expiresIn: "30d",
      }
    );

    // res.cookie('jwt', token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
    //   sameSite: 'strict', // Prevent CSRF attacks
    //   maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    // });

    return token;
  } catch (error) {
    console.error("Error generating JWT token:", error);
    throw new Error("Failed to generate token");
  }
};

const generateTempToken = (payload, expiresIn = "10m") => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifyTempToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

export { generateToken, generateTempToken, verifyTempToken };
