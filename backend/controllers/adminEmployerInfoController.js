import asyncHandler from "../handlers/asyncHandler.js";
import OfferLetter from '../models/offerLetter.model.js';
import BusinessAccount from "../models/business/businessAccount.model.js";
import EmployerAuthModel from "../models/business/employerAuth.model.js";
import JobPostApplication from '../models/jobPosts/jobPostApplications.model.js';
// @desc    Update business account information
// @route   PUT /api/businessAccount/:id
// @access  Admin
const updateBusinessAccount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { basicDetails, address, companyId } = req.body;

  if (!basicDetails && !address && companyId === undefined) {
    return res
      .status(400)
      .json({ error: "At least one field is required to update" });
  }
  const updateFields = {};
  if (basicDetails) updateFields["basicDetails"] = basicDetails;
  if (address) updateFields["address"] = address;
  if (companyId !== undefined) updateFields["companyId"] = companyId;
  try {
    const businessAccount = await BusinessAccount.findById(id);

    if (!businessAccount) {
      return res.status(404).json({ error: "Business account not found" });
    }

    const updatedBusinessAccount = await BusinessAccount.findByIdAndUpdate(
      businessAccount._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    const updatedFieldsResponse = {};
    if (basicDetails) updatedFieldsResponse.basicDetails = basicDetails;
    if (address) updatedFieldsResponse.address = address;
    if (companyId !== undefined) updatedFieldsResponse.companyId = companyId;

    res.status(200).json({
      message: "Business account updated successfully",
      updatedFields: updatedFieldsResponse,
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({
      error: "An error occurred while updating business account",
      details: error.message,
    });
  }
});

// @desc    Update employer status
// @route   PUT /api/employer/:employerId/status
// @access  Admin
const updateEmployerStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    if (!["approved", "rejected", "under evaluation"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Find the corresponding employer authentication information
    const employerAuth = await EmployerAuthModel.findById(id);

    if (!employerAuth) {
      return res.status(404).json({ message: "Employer not found" });
    }

    // Update the status in EmployerAuthModel
    employerAuth.status = status;
    await employerAuth.save();

    res.status(200).json({
      message: "Status updated successfully",
      status: employerAuth.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function getStartOfDay(date) {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

function getStartOfWeek(date) {
  const newDate = new Date(date);
  const day = newDate.getDay();
  newDate.setDate(newDate.getDate() - day); // Set to the start of the week (Sunday)
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

function getStartOfMonth(date) {
  const newDate = new Date(date);
  newDate.setDate(1); // Set to the 1st of the month
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}
const getOfferLetterStatistics = asyncHandler(async (req, res, next) => {
        try {
    const currentDate = new Date();

    // Helper functions to get start of time periods
    const getStartOfDay = (date) => new Date(date.setHours(0, 0, 0, 0));
    const getStartOfWeek = (date) => {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.setDate(diff));
    };
    const getStartOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

    // Time periods
    const todayStart = getStartOfDay(new Date(currentDate));
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);

    const prevWeekStart = new Date(currentDate);
    prevWeekStart.setDate(currentDate.getDate() - 7);
    const prevMonthStart = new Date(currentDate);
    prevMonthStart.setMonth(currentDate.getMonth() - 1);
    const prev3MonthsStart = new Date(currentDate);
    prev3MonthsStart.setMonth(currentDate.getMonth() - 3);
    const prev6MonthsStart = new Date(currentDate);
    prev6MonthsStart.setMonth(currentDate.getMonth() - 6);
    const prevYearStart = new Date(currentDate);
    prevYearStart.setFullYear(currentDate.getFullYear() - 1);

    // Daily OfferLetter Metrics
    const today = await OfferLetter.countDocuments({ createdAt: { $gte: todayStart } });
    const prevDay = await OfferLetter.countDocuments({
      createdAt: { $gte: yesterdayStart, $lt: todayStart },
    });

    // Weekly, Monthly, and other OfferLetter metrics
    const thisWeek = await OfferLetter.countDocuments({ createdAt: { $gte: getStartOfWeek(currentDate) } });
    const prevWeek = await OfferLetter.countDocuments({
      createdAt: { $gte: getStartOfWeek(prevWeekStart), $lt: getStartOfWeek(currentDate) },
    });

    const thisMonth = await OfferLetter.countDocuments({ createdAt: { $gte: prevMonthStart } });
    const prevMonth = await OfferLetter.countDocuments({
      createdAt: { $gte: prevMonthStart, $lt: getStartOfMonth(currentDate) },
    });

    const this3Months = await OfferLetter.countDocuments({ createdAt: { $gte: prev3MonthsStart } });
    const prev3Months = await OfferLetter.countDocuments({
      createdAt: { $gte: prev3MonthsStart, $lt: prev6MonthsStart },
    });

    const this6Months = await OfferLetter.countDocuments({ createdAt: { $gte: prev6MonthsStart } });
    const prev6Months = await OfferLetter.countDocuments({
      createdAt: { $gte: prev6MonthsStart, $lt: prevYearStart },
    });

    const thisYear = await OfferLetter.countDocuments({ createdAt: { $gte: prevYearStart } });
    const prevYear = await OfferLetter.countDocuments({
      createdAt: { $gte: prevYearStart, $lt: getStartOfMonth(currentDate) },
    });

    // Growth Rates
    const calculateGrowth = (current, previous) =>
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    const dayGrowth = calculateGrowth(today, prevDay);
    const weekGrowth = calculateGrowth(thisWeek, prevWeek);
    const monthGrowth = calculateGrowth(thisMonth, prevMonth);
    const threeMonthGrowth = calculateGrowth(this3Months, prev3Months);
    const sixMonthGrowth = calculateGrowth(this6Months, prev6Months);
    const yearGrowth = calculateGrowth(thisYear, prevYear);

    // Growth Rates for Offer Letters (Accepted and Rejected)
    const getOfferCounts = async (status, startDate) =>
      await OfferLetter.countDocuments({ status, createdAt: { $gte: startDate } });

    const thisMonthAccepted = await getOfferCounts("Accepted", prevMonthStart);
    const thisMonthRejected = await getOfferCounts("Rejected", prevMonthStart);

    const offerLetterGrowth = {
      accepted: {
        monthGrowth: calculateGrowth(thisMonthAccepted, prevMonth),
        threeMonthGrowth: calculateGrowth(this3Months, prev3Months),
        sixMonthGrowth: calculateGrowth(this6Months, prev6Months),
        yearGrowth: calculateGrowth(thisYear, prevYear),
      },
      rejected: {
        monthGrowth: calculateGrowth(thisMonthRejected, prevMonth),
        threeMonthGrowth: calculateGrowth(this3Months, prev3Months),
        sixMonthGrowth: calculateGrowth(this6Months, prev6Months),
        yearGrowth: calculateGrowth(thisYear, prevYear),
      },
    };

    // Growth Rates for Job Applications (Shortlisted and Rejected)
    const getApplicationCounts = async (status, startDate) =>
      await JobPostApplication.countDocuments({ status, createdAt: { $gte: startDate } });

    const thisMonthShortlisted = await getApplicationCounts("shortlisted", prevMonthStart);
    const thisMonthRejectedApps = await getApplicationCounts("rejected", prevMonthStart);

    const jobApplicationGrowth = {
      shortlisted: {
        monthGrowth: calculateGrowth(thisMonthShortlisted, prevMonth),
        threeMonthGrowth: calculateGrowth(this3Months, prev3Months),
        sixMonthGrowth: calculateGrowth(this6Months, prev6Months),
        yearGrowth: calculateGrowth(thisYear, prevYear),
      },
      rejected: {
        monthGrowth: calculateGrowth(thisMonthRejectedApps, prevMonth),
        threeMonthGrowth: calculateGrowth(this3Months, prev3Months),
        sixMonthGrowth: calculateGrowth(this6Months, prev6Months),
        yearGrowth: calculateGrowth(thisYear, prevYear),
      },
    };

    // Extra Stats: Average Offer Letters and Applications Per Employee
    const employeeOfferCounts = await OfferLetter.aggregate([
      { $group: { _id: "$employeeId", offerCount: { $sum: 1 } } },
    ]);
    const totalEmployeesWithOffers = employeeOfferCounts.length;
    const totalOfferLettersIssued = employeeOfferCounts.reduce((sum, entry) => sum + entry.offerCount, 0);
    const avgOffersPerEmployee = totalEmployeesWithOffers > 0 ? totalOfferLettersIssued / totalEmployeesWithOffers : 0;
    const employeeApplicationCounts = await JobPostApplication.aggregate([
      { $group: { _id: "$employeeId", applicationCount: { $sum: 1 } } },
    ]);
    const totalEmployeesWithApplications = employeeApplicationCounts.length;
    const totalApplications = employeeApplicationCounts.reduce((sum, entry) => sum + entry.applicationCount, 0);
    const avgApplicationsPerEmployee =
      totalEmployeesWithApplications > 0 ? totalApplications / totalEmployeesWithApplications : 0;

    const totalShortlisted = await JobPostApplication.countDocuments({ status: "shortlisted" });
    const totalRejectedApplications = await JobPostApplication.countDocuments({ status: "rejected" });

                const periodStats = {
      today,
      thisWeek,
      thisMonth,
      last3Months: this3Months,
      last6Months: this6Months,
      lastYear: thisYear,
    };

    // Response object
    res.status(200).json({
      globalStats: {
        totalCreated: await OfferLetter.countDocuments(),
        totalAccepted: await OfferLetter.countDocuments({ status: "Accepted" }),
        totalRejected: await OfferLetter.countDocuments({ status: "Rejected" }),
      },
      growthStats: {
        dayGrowth: parseFloat(dayGrowth.toFixed(2)),
        weekGrowth: parseFloat(weekGrowth.toFixed(2)),
        monthGrowth: parseFloat(monthGrowth.toFixed(2)),
        threeMonthGrowth: parseFloat(threeMonthGrowth.toFixed(2)),
        sixMonthGrowth: parseFloat(sixMonthGrowth.toFixed(2)),
        yearGrowth: parseFloat(yearGrowth.toFixed(2)),
      },
      offerLetterGrowth,
      jobApplicationGrowth,
      extraStats: {
        avgOffersPerEmployee: parseFloat(avgOffersPerEmployee.toFixed(2)),
        avgApplicationsPerEmployee: parseFloat(avgApplicationsPerEmployee.toFixed(2)),
        totalShortlisted,
        totalRejectedApplications,
      },
            periodStats,
    });
  } catch (error) {
    res.status(500);
    next(error);
  }
});


export { updateBusinessAccount, updateEmployerStatus, getOfferLetterStatistics };