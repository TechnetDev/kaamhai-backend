import path from "path";
import express from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import bodyParser from "body-parser";

dotenv.config();
import connectDB from "./config/db.js";
import cookieParser from "cookie-parser";
import sessionMiddleware from "./middlewares/sessionConfig.js";
import { errorHandler, notFound } from "./handlers/errorHandler.js";
import authRoutes from "./routes/employeeAuthRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import businessRoutes from "./routes/businessRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import jobPosts from "./routes/jobPostsRoutes.js";
import offerLetter from "./routes/offerLetterRoutes.js";
import employeeRoutes from "./routes/employeeDocRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import logSession from "./middlewares/logSession.js";
import adminEmployeeInfoRoutes from "./routes/adminInfoUpdateRoutes.js";
import employeeBankDetailsRoutes from "./routes/employeeBankDetailsRoutes.js";
import industryRoutes from "./routes/industryRoutes.js";
import businessPayment from "./routes/businessPaymentRoutes.js";
import execRoutes from "./routes/adminExecRoutes.js";
import admnRoutes from "./routes/adminGeneralRoutes.js";
import revokingRoutes from "./routes/revokeOfferLetterRoutes/revokingOfferLetterRoutes.js";

const port = process.env.PORT || 5000;
connectDB();
const app = express();

const allowedOrigins = [
  "https://holocron.kaamhai.in",
  "https://dev.kaamhai-holocron.nityom.app",
  "http://localhost:3000",
  "https://www.kaamhai.in",
  "https://kaamhai.in",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // If origin is in the allowedOrigins list or it's undefined (for requests like server-to-server), allow it
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow credentials (cookies) to be sent
  })
);

app.use(morgan("dev"));
app.use(cookieParser());
app.use(sessionMiddleware);

app.use((req, res, next) => {
  console.log("Request Headers:", req.headers);
  next();
});

app.use(logSession);

// app.use(express.json());
app.use(bodyParser.urlencoded());
// app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json({ extended: true }));

app.use("/user", authRoutes);
app.use("/otp", otpRoutes);
app.use("/employee", employeeRoutes);
app.use("/business", businessRoutes);
app.use("/company", companyRoutes);
app.use("/job-posts", jobPosts);
app.use("/offer-letter", offerLetter);
app.use("/notifications", notificationRoutes);
app.use("/admin", adminEmployeeInfoRoutes);
app.use("/employeeBankDetails", employeeBankDetailsRoutes);
app.use("/industry", industryRoutes);
app.use("/business-payment", businessPayment);
app.use("/revokeContractLetter", revokingRoutes);

/*  ADMIN EXEC ROUTES */
app.use("/admin/exec", execRoutes);
app.use("/admin/users", admnRoutes);

app.get("/", (req, res) => {
  res.send("Api is running... ");
});

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port: ${port}`);
});
