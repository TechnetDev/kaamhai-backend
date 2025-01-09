import BusinessBankAccountDetails from "../models/business/businessBankAccount.model.js";

const createBusinessAccount = async (req, res) => {
  try {
    const {
      accountNumber,
      accountHolderName,
      ifscCode,
      upiId,
      employerId: bodyEmployerId,
    } = req.body;
    const employerId = req.employerId || bodyEmployerId; // Use from req or body

    if (!employerId) {
      return res.status(400).json({ error: "Employer ID is required" });
    }

    const newAccount = new BusinessBankAccountDetails({
      accountNumber,
      accountHolderName,
      ifscCode,
      upiId,
      businessId: employerId, // Associate with the employer
    });

    await newAccount.save();
    res
      .status(201)
      .json({
        message: "Business account created successfully",
        account: newAccount,
      });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAccountsByEmployer = async (req, res) => {
  try {
    const { employerId: paramEmployerId } = req.params;
    const employerId = req.employerId || paramEmployerId; // Use from req or params

    if (!employerId) {
      return res.status(400).json({ error: "Employer ID is required" });
    }

    const accounts = await BusinessBankAccountDetails.find({
      businessId: employerId,
    });

    res.status(200).json(accounts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAllBusinessBankAccounts = async (req, res) => {
  try {
    const businessBankAccounts = await BusinessBankAccountDetails.find(); // Get all records directly

    res.status(200).json(businessBankAccounts); // Return the records as response
  } catch (error) {
    res.status(500).json({ message: error.message }); // Handle error and return message
  }
};

const updateBusinessAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountNumber, accountHolderName, ifscCode, upiId } = req.body;

    const updatedAccount = await BusinessBankAccountDetails.findByIdAndUpdate(
      id,
      { accountNumber, accountHolderName, ifscCode, upiId },
      { new: true }
    );

    if (!updatedAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    res
      .status(200)
      .json({
        message: "Business account updated successfully",
        account: updatedAccount,
      });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteBusinessAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedAccount = await BusinessBankAccountDetails.findByIdAndDelete(
      id
    );

    if (!deletedAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.status(200).json({ message: "Business account deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export {
  createBusinessAccount,
  getAccountsByEmployer,
  updateBusinessAccount,
  deleteBusinessAccount,
  getAllBusinessBankAccounts,
};
