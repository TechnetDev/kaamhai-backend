import Industry from "../models/industry.model.js";
import mongoose from "mongoose";
import winston from "winston";

// Initialize logger
const logger = winston.createLogger({
  level: "error",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log" }),
  ],
});

const createIndustry = async (req, res) => {
  try {
    const { name, categories } = req.body;
    const newIndustry = new Industry({
      name,
      categories: categories.map((category) => ({ name: category })),
    });
    await newIndustry.save();
    res.status(201).json(newIndustry);
  } catch (error) {
    logger.error(error.message, { metadata: error });
    res.status(400).json({ error: error.message });
  }
};

// Delete Industry
const deleteIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedIndustry = await Industry.findByIdAndDelete(id);
    if (!deletedIndustry) {
      return res.status(404).json({ error: "Industry not found" });
    }
    res.status(200).json({ message: "Industry deleted successfully" });
  } catch (error) {
    logger.error(error.message, { metadata: error });
    res.status(400).json({ error: error.message });
  }
};

// Add Category to Industry
const addCategoryToIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    const { categories } = req.body; // Expecting an array of categories
    const industry = await Industry.findById(id);
    if (!industry) {
      return res.status(404).json({ error: "Industry not found" });
    }
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: "Categories should be an array" });
    }
    categories.forEach((category) => {
      industry.categories.push({ name: category });
    });
    await industry.save();
    res.status(201).json(industry);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// Delete Category from Industry
const deleteCategoryFromIndustry = async (req, res) => {
  try {
    const { industryId, categoryId } = req.params;

    // Find the industry and update it by removing the category
    const industry = await Industry.findByIdAndUpdate(
      industryId,
      { $pull: { categories: { _id: categoryId } } },
      { new: true }
    );

    if (!industry) {
      return res.status(404).json({ message: "Industry not found" });
    }

    res.status(200).json({
      message: "Category deleted successfully",
      industry,
    });
  } catch (error) {
    logger.error(error.message, { metadata: error });
    res.status(500).json({ message: error.message });
  }
};

const getIndustryWithCategories = async (req, res) => {
  try {
    const { industryId } = req.params;

    // Find the industry by ID
    const industry = await Industry.findById(industryId).populate("categories");

    if (!industry) {
      return res.status(404).json({ message: "Industry not found" });
    }

    res.status(200).json(industry);
  } catch (error) {
    logger.error(error.message, { metadata: error });
    res.status(500).json({ message: error.message });
  }
};

const getAllIndustriesWithCategories = async (req, res) => {
  try {
    const industries = await Industry.find().populate("categories");
    res.status(200).json(industries);
  } catch (error) {
    logger.error(error.message, { metadata: error });
    res.status(500).json({ message: error.message });
  }
};

export {
  createIndustry,
  deleteIndustry,
  addCategoryToIndustry,
  deleteCategoryFromIndustry,
  getIndustryWithCategories,
  getAllIndustriesWithCategories,
};
