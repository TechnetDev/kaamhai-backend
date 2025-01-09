import mongoose from "mongoose";

const authSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      unique: true,
      trim: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    referralCode: {
      type: String,
    },
    status: {
      type: String,
      enum: ["approved", "rejected", "under evaluation"],
      default: "under evaluation",
    },
    state: {
      type: String,
      required: true,
    },
    formattedId: { type: String },
    dob: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// checking if password is valid
authSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// generating a hash
authSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const EmployeeAuthModel =
  mongoose.models.AuthModel || mongoose.model("AuthModel", authSchema);

export default EmployeeAuthModel;
