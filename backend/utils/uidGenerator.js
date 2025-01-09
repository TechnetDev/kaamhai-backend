const generateRandomAlphanumeric = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  let hasNumber = false;

  for (let i = 0; i < 3; i++) {
    const char = chars.charAt(Math.floor(Math.random() * chars.length));
    if (/\d/.test(char)) {
      hasNumber = true;
    }
    result += char;
  }

  // Ensure at least one number is present
  if (!hasNumber) {
    const randomIndex = Math.floor(Math.random() * 3);
    const randomDigit = Math.floor(Math.random() * 10);
    result =
      result.substring(0, randomIndex) +
      randomDigit +
      result.substring(randomIndex + 1);
  }

  return result;
};

const getInitials = (businessName) => {
  const words = businessName.split(" ");
  if (words.length >= 2) {
    return words[0][0].toUpperCase() + words[1][0].toUpperCase();
  } else {
    return businessName.substring(0, 2).toUpperCase();
  }
};

const generateUID = (businessName) => {
  const initials = getInitials(businessName);
  const YYY = generateRandomAlphanumeric();
  return `KH${initials}-${YYY}`;
};

export default generateUID;
