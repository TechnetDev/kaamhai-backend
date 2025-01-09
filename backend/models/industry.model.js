import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const industrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  categories: [categorySchema],
});

export default mongoose.model("Industry", industrySchema);
