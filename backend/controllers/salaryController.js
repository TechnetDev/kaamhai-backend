import BusinessAccount from "../models/business/businessAccount.model.js";
import EmployeeToCompanyMapping from "../models/EmployeeToCompanyMapping.models.js";
import EmployeeInfo from "../models/employee/EmployeeInfo.model.js";
import OfferLetter from "../models/offerLetter.model.js";
import PaymentRequest from "../models/advancePaymentRequests.model.js";
import LeaveRequest from "../models/leaveRequests.model.js";
import Liability from "../models/liability.model.js";
import { generateV4ReadSignedUrl } from "../utils/uploadToGCP.js"; // Utility function for signed URLs
import EmployeePayment from "../models/SalaryPayment.model.js";
import Company from "../models/company.model.js";
import PDFDocument from "pdfkit";
import EmployeeBankAccountDetails from "../models/employee/employeeBankAccountDetails.js";
import axios from "axios";

export const getEmployeesAndSalaryForEmployer = async (req, res) => {
  try {
    const employerId =
      req.employerId || req.params.employerId || req.body.employerId; // Extract employerId from the token
    if (!employerId) {
      return res
        .status(400)
        .json({ message: "Employer ID not provided in token." });
    }

    // Find the business account of the employer
    const businessAccount = await BusinessAccount.findOne({
      _id: employerId,
    }).select("companyId");
    if (!businessAccount) {
      return res.status(404).json({
        message: "Business account not found for the given employer ID.",
      });
    }

    const companyId = businessAccount.companyId;
    if (!companyId) {
      return res
        .status(404)
        .json({ message: "Company ID not associated with this employer." });
    }

    // Find employees linked to the company
    const companyMapping = await EmployeeToCompanyMapping.findOne({
      companyId,
    }).select("employees");
    if (!companyMapping || !companyMapping.employees.length) {
      return res
        .status(404)
        .json({ message: "No employees found for the company." });
    }

    const totalEmployeesForCompany = companyMapping.employees.length;
    // Fetch current month details
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    const uniqueEmployeeCount = await EmployeePayment.distinct("employeeId", {
      companyId, // Ensure it's filtered by the same company ID
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    });

    // Calculate the total count of unique employee IDs
    const totalUniqueEmployeesPaid = uniqueEmployeeCount.length;

    // Calculate the sum of all `totalAmount` values for the ongoing month
    const totalSalaryPaidResult = await EmployeePayment.aggregate([
      {
        $match: {
          companyId, // Filter by companyId
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: null, // Group all documents
          totalSalaryPaid: { $sum: "$totalAmount" }, // Sum the totalAmount field
        },
      },
    ]);

    const totalSalaryPaid =
      totalSalaryPaidResult.length > 0
        ? totalSalaryPaidResult[0].totalSalaryPaid
        : 0; // Default to 0 if no payments exist

    // Fetch employee details along with liabilities and leave data
    const employeeDetails = await Promise.all(
      companyMapping.employees.map(async (employeeId) => {
        const employee = await EmployeeInfo.findOne({ id: employeeId }).select(
          "id personalInfo.name facePhoto email formattedId"
        );

        if (!employee) return null; // Skip if employee data is missing

        // Fetch jobTitle, startDate, and grossSalary from OfferLetter
        const offerLetter = await OfferLetter.findOne({
          employeeId,
          employerId,
        });

        const advancePayment = await PaymentRequest.aggregate([
          {
            $match: {
              employeeId,
              companyId,
              status: "approved",
              createdAt: { $gte: startOfMonth, $lte: endOfMonth },
            },
          },
          {
            $group: {
              _id: null, // Grouping not needed, so use `null`
              totalAmount: { $sum: "$amount" }, // Sum all amounts
            },
          },
        ]);

        // Get advance payment transactions
        const advancePaymentRequests = await PaymentRequest.find({
          employeeId,
          companyId,
          status: "approved",
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        }).select("_id amount createdAt");

        const totalAdvancePayment =
          advancePayment.length > 0 ? advancePayment[0].totalAmount : 0;

        const advPaymentTransactions = advancePaymentRequests.map(
          (transaction) => ({
            amount: transaction.amount,
            date: transaction.createdAt,
            type: "Advance Payment",
            _id: transaction._id
          })
        );

        const paymentRequests = await PaymentRequest.find({
          employeeId,
          companyId,
          status: "approved", // Only include approved transactions
        })
          .select("amount createdAt _id") // Select only the required fields
          .sort({ createdAt: -1 });

        const advancePaymentTransactions = paymentRequests.map(
          (transaction) => ({
            amount: transaction.amount,
            date: transaction.createdAt,
            _id: transaction._id,
          })
        );

        // Get salary payment transactions
        const salaryPaymentRecords = await EmployeePayment.find({
          employeeId,
          companyId,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        }).select("modeOfPayment totalAmount _id createdAt");

        const salaryPaymentTransactions = salaryPaymentRecords.map(
          (record) => ({
            amount: record.totalAmount,
            date: record.createdAt,
            modeOfPayment: record.modeOfPayment,
            _id: record._id,
            type: "Salary Payment",
          })
        );

        // Fetch liabilities for the employee
        // Fetch liabilities for the employee
        const liabilities = await Liability.find({
          employeeid: employeeId,
          companyid: companyId,
          status: "accepted",
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        }).select("amount itemName reason _id leaveId createdAt");

        console.log("Fetched liabilities:", liabilities); // Log all liabilities for debugging

        // Process liabilities and check leave details if applicable
        const liabilityDetails = await Promise.all(
          liabilities.map(async (liability) => {
            let leaveDetails = null;
            let calculatedAmount = liability.amount || 0; // Default to liability amount if unpaidDays don't exist

            // If leaveId exists, fetch leave details
            if (liability.leaveId) {
              const leaveRequest = await LeaveRequest.findOne({
                _id: liability.leaveId,
                leaveType: "unpaid",
              }).select("startDate endDate leaveType totalDays reason");

              if (leaveRequest) {
                const unpaidDays =
                  (new Date(leaveRequest.endDate) -
                    new Date(leaveRequest.startDate)) /
                    (1000 * 60 * 60 * 24) +
                  1;

                if (unpaidDays > 0) {
                  leaveDetails = {
                    ...leaveRequest._doc,
                    unpaidDays,
                  };

                  // Fetch dailyWage from OfferLetter
                  const offerLetter = await OfferLetter.findOne({ employeeId });
                  if (offerLetter && offerLetter.dailyWage) {
                    calculatedAmount = unpaidDays * offerLetter.dailyWage;
                  }
                }
              }
            }

            return {
              amount: calculatedAmount, // Use the calculated amount
              itemName: liability.itemName || "N/A",
              reason: liability.reason || "N/A",
              date: liability.createdAt || new Date(),
              leaveDetails: leaveDetails || null,
              _id: liability._id,
              type: "Liability",
            };
          })
        );

        const allTransactions = [
          ...advPaymentTransactions,
          ...salaryPaymentTransactions,
          ...liabilityDetails,
        ];

        // Sort transactions by date
        allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate deductions
        let totalLiabilities = 0;
        let unpaidLeaveDeductions = 0;

        for (const liability of liabilityDetails) {
          if (liability.amount) {
            totalLiabilities += liability.amount;
          }
          console.log("unpaid leaves:");
          console.log(liability.leaveDetails?.unpaidDays);
          // Calculate unpaid leave deduction
          if (liability.leaveDetails?.unpaidDays) {
            const offerLetter = await OfferLetter.findOne({
              employeeId,
              employerId,
            }).select("dailyWage");
            const dailyWage = offerLetter?.dailyWage || 0;
            console.log("dailyWage: ");
            console.log(dailyWage);
            unpaidLeaveDeductions +=
              dailyWage * liability.leaveDetails.unpaidDays;
          }
        }

        // Construct deductions object
        const deductions = {
          totalLiabilities,
          unpaidLeaveDeductions,
          final: totalLiabilities + unpaidLeaveDeductions,
          breakdown: {
            liabilities: totalLiabilities,
            unpaidLeaves: unpaidLeaveDeductions,
          },
        };
        const facePhotoUri = employee.facePhoto?.isCompleted
          ? await generateV4ReadSignedUrl(
              employeeId.toString(),
              employee.facePhoto.filename
            )
          : null;

        // Fetch monthly advance and salary payment records
        const paymentRecords = await EmployeePayment.find({
          employeeId,
          companyId,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        }).select(" modeOfPayment totalAmount createdAt");
        const paymentDate = paymentRecords ? paymentRecords.createdAt : null;

        const salaryPayment = paymentRecords.length
          ? paymentRecords.map((record) => ({
              ...record._doc, // Spread the existing fields from each document
              paymentDate: record.createdAt, // Add the payment date field for each record
            }))
          : null;

        return {
          employeeID: employeeId,
          name: employee.personalInfo.name,
          companyId: companyId,
          email: employee.email,
          totalAdvancePayment,
          formattedId: employee.formattedId,
          liabilities: liabilityDetails,
          facePhoto: facePhotoUri,
          jobTitle: offerLetter?.jobTitle || "Not Assigned",
          startDate: offerLetter?.startDate || "Not Assigned",
          grossSalary: offerLetter?.grossSalary || 0,
          offerLetter: offerLetter ? offerLetter.toObject() : null,
          deductions,
          balance:
            offerLetter?.grossSalary - deductions.final - totalAdvancePayment,
          advancePaymentTransactions,
          salaryPayment,
          transactions: allTransactions,
        };
      })
    );

    // Filter out any null values (in case of missing employees)
    const filteredEmployees = employeeDetails.filter(Boolean);

    return res.status(200).json({
      employeesUnpaid: totalEmployeesForCompany - totalUniqueEmployeesPaid,
      totalSalaryPaid,
      totalUniqueEmployeesPaid,
      totalEmployeesForCompany,
      employees: filteredEmployees,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return res
      .status(500)
      .json({ message: "An error occurred while fetching employees.", error });
  }
};

export const createPaymentRecord = async (req, res) => {
  try {
    const {
      employeeId,
      formattedId,
      companyId,
      joiningDate,
      jobTitle,
      grossSalary,
      advancePayment = 0,
      deductions = {},
      balance,
      deductionCredit = 0,
      incentives = 0,
      modeOfPayment,
      totalAmount,
      employerId: employerIdFromBody, // For admin case
    } = req.body;

    // Use employerId from request body if provided (admin case), otherwise from authenticated request
    const employerId = employerIdFromBody || req.employerId;

    if (!employerId) {
      return res.status(400).json({ message: "Employer ID is required." });
    }

    const paymentRecord = new EmployeePayment({
      employeeId,
      formattedId,
      employerId,
      companyId,
      joiningDate,
      jobTitle,
      grossSalary,
      advancePayment,
      deductions,
      balance,
      deductionCredit,
      incentives,
      modeOfPayment,
      totalAmount,
    });

    await paymentRecord.save();

    res.status(201).json({
      message: "Payment record created successfully",
      data: paymentRecord,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const getEmployeeSalaryDetails = async (req, res) => {
  try {
    const employeeId = req.employeeId || req.params.employeeId; // Extract employeeId from the token or request

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID not provided." });
    }

    // Fetch employee payment records for all time
    const employeePayment = await EmployeePayment.findOne({ employeeId });

    if (!employeePayment) {
      return res
        .status(404)
        .json({ message: "No salary record found for the employee." });
    }

    // Fetch the complete offer letter for the employee
    const offerLetter = await OfferLetter.findOne({ employeeId });

    if (!offerLetter) {
      return res
        .status(404)
        .json({ message: "No offer letter found for the employee." });
    }

    // Fetch company details based on companyId
    const company = await Company.findOne({
      _id: employeePayment.companyId,
    }).select(
      "companyprofile.businessname compbasicdetails.hrnumber compbasicdetails.ownernumber"
    );

    if (!company) {
      return res
        .status(404)
        .json({ message: "No company record found for the given company ID." });
    }

    // Fetch and process liabilities for all time (no date range)
    const liabilities = await Liability.find({
      employeeid: employeeId,
      companyid: employeePayment.companyId,
      status: "accepted",
    }).select("amount itemName reason _id leaveId createdAt");

    const liabilityDetails = await Promise.all(
      liabilities.map(async (liability) => {
        let leaveDetails = null;

        if (liability.leaveId) {
          const leaveRequest = await LeaveRequest.findOne({
            _id: liability.leaveId,
            leaveType: "unpaid",
          }).select("startDate endDate leaveType totalDays reason");

          if (leaveRequest) {
            const unpaidDays =
              leaveRequest.leaveType === "unpaid"
                ? (new Date(leaveRequest.endDate) -
                    new Date(leaveRequest.startDate)) /
                    (1000 * 60 * 60 * 24) +
                  1
                : 0;

            leaveDetails = {
              ...leaveRequest._doc,
              unpaidDays: unpaidDays > 0 ? unpaidDays : undefined,
            };
          }
        }

        return {
          amount: liability.amount || undefined,
          itemName: liability.itemName || undefined,
          reason: liability.reason || undefined,
          createdAt: liability.createdAt || undefined,
          leaveDetails: leaveDetails || null,
          _id: liability._id,
          type: "Liability",
        };
      })
    );

    // Fetch advance payments and salary payments for all time (no date range)
    const advancePayments = await PaymentRequest.find({ employeeId }).select(
      "-__v"
    );
    const salaryPayments = await EmployeePayment.find({ employeeId }).select(
      "-__v"
    );

    // Combine all transactions
    const allTransactions = [
      //   ...advancePayments.map((record) => ({
      //     ...record.toObject(),
      //     type: 'Advance Payment',
      //   })),
      ...salaryPayments.map((record) => ({
        ...record.toObject(),
        type: "Salary Payment",
      })),
      //     ...liabilityDetails,
    ];

    // Sort transactions by date
    allTransactions.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    const salaryDetails = {
      employeeId: employeePayment.employeeId,
      formattedId: employeePayment.formattedId,
      employerId: employeePayment.employerId,
      companyId: employeePayment.companyId,
      joiningDate: employeePayment.joiningDate,
      jobTitle: employeePayment.jobTitle,
      grossSalary: employeePayment.grossSalary,
      advancePayment: employeePayment.advancePayment,
      deductions: employeePayment.deductions,
      balance: employeePayment.balance,
      deductionCredit: employeePayment.deductionCredit,
      incentives: employeePayment.incentives,
      modeOfPayment: employeePayment.modeOfPayment,
      totalAmount: employeePayment.totalAmount,
      offerLetter, // Send the complete OfferLetter model in response
      companyDetails: {
        businessName: company.companyprofile.businessname,
        hrNumber: company.compbasicdetails.hrnumber,
        ownerNumber: company.compbasicdetails.ownernumber,
      },
      allTransactions, // Add all records sorted by date
    };

    return res.status(200).json({ salaryDetails });
  } catch (error) {
    console.error("Error fetching salary details:", error);
    return res.status(500).json({
      message: "An error occurred while fetching salary details.",
      error,
    });
  }
};

export const getCompanySalaryDetails = async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query; // Pagination parameters
    const skip = (page - 1) * limit;

    // Step 1: Fetch salary details
    const salaryDetails = await EmployeePayment.find()
      .skip(skip)
      .limit(limit)
      .select(
        "employeeId formattedId employerId companyId joiningDate jobTitle grossSalary advancePayment deductions balance deductionCredit incentives modeOfPayment totalAmount createdAt"
      );

    // Step 2: Extract unique employee and company IDs from salary details
    const employeeIds = [
      ...new Set(salaryDetails.map((record) => record.employeeId.toString())),
    ];
    const companyIds = [
      ...new Set(salaryDetails.map((record) => record.companyId.toString())),
    ];

    // Step 3: Fetch related data manually
    const employees = await EmployeeInfo.find({
      id: { $in: employeeIds },
    }).select("id personalInfo.name");
    const companies = await Company.find({ _id: { $in: companyIds } }).select(
      "companyprofile.businessname"
    );

    // Step 4: Create lookup objects for quick access
    const employeeLookup = employees.reduce((acc, emp) => {
      acc[emp.id] = emp.personalInfo.name || "Unknown Employee";
      return acc;
    }, {});

    const companyLookup = companies.reduce((acc, comp) => {
      acc[comp._id] = comp.companyprofile.businessname || "Unknown Company";
      return acc;
    }, {});

    // Step 5: Merge salary details with related data
    const salaryRecords = salaryDetails.map((record) => {
      const recordObject = record.toObject();
      return {
        ...recordObject,
        employeeName: employeeLookup[record.employeeId] || "Unknown Employee",
        companyName: companyLookup[record.companyId] || "Unknown Company",
        type: "Salary Payment",
      };
    });

    // Step 6: Fetch liabilities and process them
    const liabilities = await Liability.find({ status: "accepted" }).select(
      "employeeid companyid amount itemName reason _id leaveId createdAt"
    );

    const liabilityDetails = await Promise.all(
      liabilities.map(async (liability) => {
        let leaveDetails = null;

        if (liability.leaveId) {
          const leaveRequest = await LeaveRequest.findOne({
            _id: liability.leaveId,
            leaveType: "unpaid",
          }).select("startDate endDate leaveType totalDays reason");

          if (leaveRequest) {
            const unpaidDays =
              leaveRequest.leaveType === "unpaid"
                ? (new Date(leaveRequest.endDate) -
                    new Date(leaveRequest.startDate)) /
                    (1000 * 60 * 60 * 24) +
                  1
                : 0;

            leaveDetails = {
              ...leaveRequest._doc,
              unpaidDays: unpaidDays > 0 ? unpaidDays : undefined,
            };
          }
        }

        return {
          amount: liability.amount || undefined,
          itemName: liability.itemName || undefined,
          reason: liability.reason || undefined,
          createdAt: liability.createdAt || undefined,
          leaveDetails: leaveDetails || null,
          _id: liability._id,
          type: "Liability",
        };
      })
    );

    // Step 7: Fetch advance payments
    const advancePayments = await PaymentRequest.find().select("-__v");

    // Step 8: Combine all transactions
    const allTransactions = [
      ...salaryRecords,
      // Uncomment to include advance payments and liabilities
      // ...advancePayments.map((record) => ({
      //   ...record.toObject(),
      //   type: 'Advance Payment',
      // })),
      // ...liabilityDetails,
    ];

    // Step 9: Sort transactions by date (recent first)
    allTransactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Pagination setup
    const totalTransactions = allTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);
    const paginatedTransactions = allTransactions.slice(skip, skip + limit);

    return res.status(200).json({
      transactions: paginatedTransactions,
      pagination: {
        totalTransactions,
        totalPages,
        currentPage: parseInt(page),
        perPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching salary details:", error);
    return res.status(500).json({
      message: "An error occurred while fetching salary details.",
      error,
    });
  }
};

export const updateEmployeePayment = async (req, res) => {
  try {
    const { _id } = req.params; // Extract _id from request parameters
    const updates = req.body; // Extract updates from request body

    // Validate _id
    if (!_id) {
      return res
        .status(400)
        .json({ message: "EmployeePayment _id is required." });
    }

    // Find and update the record
    const updatedRecord = await EmployeePayment.findByIdAndUpdate(
      _id,
      updates,
      { new: true } // Return the updated document
    );

    // Check if the record exists
    if (!updatedRecord) {
      return res
        .status(404)
        .json({ message: "EmployeePayment record not found." });
    }

    // Respond with the updated record
    return res.status(200).json({
      message: "EmployeePayment record updated successfully.",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("Error updating EmployeePayment record:", error);
    return res.status(500).json({
      message: "An error occurred while updating the EmployeePayment record.",
      error,
    });
  }
};

const drawTable = (doc, headers, rows, startX, startY, colWidths) => {
  const rowHeight = 25;
  let currentY = startY;
  const headerFontSize = 14;
  const cellFontSize = 12;

  // Draw table header
  doc
    .fontSize(headerFontSize)
    .fillColor("#ffffff")
    .rect(
      startX,
      currentY,
      colWidths.reduce((a, b) => a + b, 0),
      rowHeight
    )
    .fill("#FFCB08");

  headers.forEach((header, i) => {
    let xPos = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.fillColor("#ffffff").text(header, xPos + 5, currentY + 7);
  });

  currentY += rowHeight;

  // Draw row lines and content
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      let xPos = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc
        .rect(xPos, currentY, colWidths[i], rowHeight)
        .fill(i % 2 === 0 ? "#f2f2f2" : "#ffffff");
      doc
        .fillColor("#000000")
        .fontSize(cellFontSize)
        .text(cell, xPos + 5, currentY + 7);
    });

    currentY += rowHeight;
  });

  return currentY;
};

export const generateSalarySlip = async (req, res) => {
  try {
    const employeeId = req.employeeId || req.params.employeeId; // Extract employeeId from token or request
    const logoPath =
      "https://storage.googleapis.com/kaamhai_logo/kaamhai%20(1).png";
    const response = await axios.get(logoPath, { responseType: "arraybuffer" });
    const logoBuffer = Buffer.from(response.data, "binary");

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID not provided." });
    }

    // Fetch data similar to the first controller
    const employeePayment = await EmployeePayment.findOne({ employeeId });
    if (!employeePayment) {
      return res
        .status(404)
        .json({ message: "No salary record found for the employee." });
    }

    const employee = await EmployeeInfo.findOne({ id: employeeId }).select(
      "id personalInfo.name"
    );

    const offerLetter = await OfferLetter.findOne({ employeeId });
    if (!offerLetter) {
      return res
        .status(404)
        .json({ message: "No offer letter found for the employee." });
    }

    const accountDetails = await EmployeeBankAccountDetails.find({
      employeeId,
    });

    const account = accountDetails[0];

    const company = await Company.findOne({
      _id: employeePayment.companyId,
    }).select(
      "companyprofile.businessname compbasicdetails.hrnumber compbasicdetails.ownernumber"
    );
    if (!company) {
      return res
        .status(404)
        .json({ message: "No company record found for the given company ID." });
    }

    const liabilities = await Liability.find({
      employeeid: employeeId,
      companyid: employeePayment.companyId,
      status: "accepted",
    }).select("amount itemName reason _id leaveId createdAt");

    const liabilityDetails = await Promise.all(
      liabilities.map(async (liability) => {
        let leaveDetails = null;
        let calculatedAmount = liability.amount || 0; // Default to liability amount if unpaidDays don't exist

        // If leaveId exists, fetch leave details
        if (liability.leaveId) {
          const leaveRequest = await LeaveRequest.findOne({
            _id: liability.leaveId,
            leaveType: "unpaid",
          }).select("startDate endDate leaveType totalDays reason");

          if (leaveRequest) {
            const unpaidDays =
              (new Date(leaveRequest.endDate) -
                new Date(leaveRequest.startDate)) /
                (1000 * 60 * 60 * 24) +
              1;

            if (unpaidDays > 0) {
              leaveDetails = {
                ...leaveRequest._doc,
                unpaidDays,
              };

              // Fetch dailyWage from OfferLetter
              const offerLetter = await OfferLetter.findOne({ employeeId });
              if (offerLetter && offerLetter.dailyWage) {
                calculatedAmount = unpaidDays * offerLetter.dailyWage;
              }
            }
          }
        }

        return {
          amount: calculatedAmount, // Use the calculated amount
          itemName: liability.itemName || "N/A",
          reason: liability.reason || "N/A",
          createdAt: liability.createdAt || new Date(),
          leaveDetails: leaveDetails || null,
          _id: liability._id,
          type: "Liability",
        };
      })
    );
    const advancePayments = await PaymentRequest.find({ employeeId }).select(
      "-__v"
    );
    const salaryPayments = await EmployeePayment.find({ employeeId }).select(
      "-__v"
    );

    const allTransactions = [
      ...advancePayments.map((record) => ({
        ...record.toObject(),
        type: "Advance Payment",
        amount: record.amount || 0, // Use advancePayment for advance payment type
      })),
      ...salaryPayments.map((record) => ({
        ...record.toObject(),
        type: "Salary Payment",
        amount: record.totalAmount || 0, // Use totalAmount for salary payment type
      })),
      ...liabilityDetails,
    ];

    allTransactions.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    console.log(allTransactions);
    // Generate PDF
    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });
    doc.pipe(res);

    // Header
    doc
      .fontSize(16)
      .fillColor("#000000")
      .text(
        `Salary Slip - ${new Date().toLocaleString("default", {
          month: "long",
        })} ${new Date().getFullYear()}`,
        50,
        50
      );
    doc.fontSize(16).text("Kaamhai", 450, 50);
    doc.image(logoBuffer, 520, 40, { width: 30 });

    doc.moveTo(50, 80).lineTo(550, 80).stroke().dash(5);

    doc.fontSize(12).fillColor("#333");
    doc
      .fontSize(12)
      .text(`Employee Name: ${employee.personalInfo.name}`, 50, 100);
    doc.text(`Employee ID: ${employeeId}`, 50, 120);
    doc.text(`Designation: ${offerLetter.jobTitle}`, 50, 140);
    doc.text(`Company: ${company.companyprofile.businessname}`, 350, 100);
    // doc.text(`Issued on: ${data.salaryDatePaid}`, 350, 120);

    doc.moveTo(50, 180).lineTo(550, 180).stroke();

    // Payment Info Section
    doc.fontSize(12).text("Payment Info:", 50, 190).moveDown();
    doc.text(`Account number: ${account.accountNumber}`, 50, 210);
    doc.text(`Account Holder Name: ${account.accountHolderName}`, 50, 230);
    doc.text(`IFSC code: ${account.ifscCode}`, 50, 250);

    doc.moveTo(50, 270).lineTo(550, 270).stroke().dash(5);

    // Earnings Table
    const earningsHeaders = ["S No", "Earnings", "Amount"];
    const earningsRows = [
      ["1", "Basic Salary", `Rs ${offerLetter.salary || 0}`],
      [
        "2",
        "Food Allowance",
        `Rs ${
          offerLetter.foodAllowance && offerLetter.foodAllowance.amount
            ? offerLetter.foodAllowance.amount
            : 0
        }`,
      ],
      [
        "3",
        "Accommodation Allowance",
        `Rs ${
          offerLetter.accommodationAllowance &&
          offerLetter.accommodationAllowance.amount
            ? offerLetter.accommodationAllowance.amount
            : 0
        }`,
      ],
      ["4", "Gross Salary", `Rs ${employeePayment.grossSalary || 0}`],
      [
        "5",
        "Deductions",
        `Rs ${
          employeePayment.deductions && employeePayment.deductions.final
            ? employeePayment.deductions.final
            : 0
        }`,
      ],
      ["6", "Deduction Credit", `Rs ${employeePayment.deductionCredit || 0}`],
      ["7", "Incentives", `Rs ${employeePayment.incentives || 0}`],
      [
        "8",
        "Total Paid (Net Salary)",
        `Rs ${employeePayment.totalAmount || 0}`,
      ],
    ];
    const earningsColWidths = [50, 300, 150];
    const earningsTableY = drawTable(
      doc,
      earningsHeaders,
      earningsRows,
      50,
      290,
      earningsColWidths
    );

    // Transaction History
    if (allTransactions.length > 0) {
      doc.fontSize(14).text("Transaction History", 250, earningsTableY + 30);
      doc.fontSize(12);
      const transHeaders = [
        "Sl No",
        "Transaction ID",
        "Date",
        "Type",
        "Mode",
        "Amount",
      ];
      const transRows = allTransactions.map((txn, idx) => [
        String(idx + 1).padStart(2, "0"),
        `payment_${txn._id.toString().slice(-4)}`,
        new Date(txn.createdAt).toLocaleDateString(),
        txn.type,
        txn.modeOfPayment,
        `Rs ${txn.amount}`,
      ]);
      const transColWidths = [50, 100, 100, 100, 100, 100];
      drawTable(
        doc,
        transHeaders,
        transRows,
        50,
        earningsTableY + 60,
        transColWidths
      );
    }

    doc.end();
  } catch (error) {
    console.error("Error generating salary slip:", error);
    res.status(500).json({
      message: "An error occurred while generating the salary slip.",
      error,
    });
  }
};
