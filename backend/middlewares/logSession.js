const logSession = (req, res, next) => {
  console.log("Session Data:", req.session);
  next();
};

export default logSession;