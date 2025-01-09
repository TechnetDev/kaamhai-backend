import EmployeeBankAccountDetails from "../models/employee/employeeBankAccountDetails.js";

const createAccount = async (req, res) => {
  try {
    const {
      accountNumber,
      accountHolderName,
      ifscCode,
      upiId,
      employeeId: employeeIdFromBody,
    } = req.body;
    const employeeId = employeeIdFromBody || req.employeeId;

    const newAccount = new EmployeeBankAccountDetails({
      accountNumber,
      accountHolderName,
      ifscCode,
      upiId,
      employeeId,
    });

    await newAccount.save();
    res
      .status(201)
      .json({ message: "Account created successfully", account: newAccount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAccountsByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.employeeId;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const accounts = await EmployeeBankAccountDetails.find({ employeeId });

    res.status(200).json(accounts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAllAccounts = async (req, res) => {
  try {
    const accounts = await EmployeeBankAccountDetails.find().populate(
      "employeeId"
    );
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountNumber, accountHolderName, ifscCode, upiId } = req.body;

    const updatedAccount = await EmployeeBankAccountDetails.findByIdAndUpdate(
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
        message: "Account updated successfully",
        account: updatedAccount,
      });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedAccount = await EmployeeBankAccountDetails.findByIdAndDelete(
      id
    );

    if (!deletedAccount) {
      return res.status(404).json({ message: "Account not found" });
    }

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export {    
  createAccount,
  getAccountsByEmployee,
  updateAccount,
  deleteAccount,
  getAllAccounts,
};
