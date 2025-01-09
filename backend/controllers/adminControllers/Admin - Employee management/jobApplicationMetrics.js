// import EmployeeInfo from "../../../models/employee/EmployeeInfo.model.js";
// import asyncHandler from "../../../handlers/asyncHandler.js";
// import jobPostApplicationsModel from "../../../models/jobPosts/jobPostApplications.model.js";
// import OfferLetter from "../../../models/offerLetter.model.js";

// const getStats = asyncHandler(async (req, res, next) => {
//   try {
//     // Global stats calculation
//     const totalCandidates = await EmployeeInfo.countDocuments();
//     const totalApplications = await jobPostApplicationsModel.countDocuments();

//     // Calculate average applications per candidate
//     const averageApplicationsPerCandidate = totalCandidates ? (totalApplications / totalCandidates).toFixed(4) : 0;

//     // Calculate counts and percentage split for application statuses
//     const applicationStatusCounts = await jobPostApplicationsModel.aggregate([
//       {
//         $group: {
//           _id: '$status',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     const statusCounts = applicationStatusCounts.reduce((acc, { _id, count }) => {
//       acc[_id] = count;
//       return acc;
//     }, { shortlisted: 0, rejected: 0, 'under review': 0 });

//     const totalStatusCount = statusCounts.shortlisted + statusCounts.rejected + statusCounts['under review'];

//     const statusPercentages = {
//       shortlistedPercentage: totalStatusCount ? ((statusCounts.shortlisted / totalStatusCount) * 100).toFixed(2) : 0,
//       rejectedPercentage: totalStatusCount ? ((statusCounts.rejected / totalStatusCount) * 100).toFixed(2) : 0,
//       underReviewPercentage: totalStatusCount ? ((statusCounts['under review'] / totalStatusCount) * 100).toFixed(2) : 0,
//     };

//     // Employee-specific details calculation
//     const employees = await EmployeeInfo.find().select('personalInfo.name');

//     const employeeDetails = await Promise.all(employees.map(async (employee) => {
//       const { _id: employeeId, personalInfo: { name: candidateName } } = employee;

//       // Fetch total number of applications for the employee
//       const totalApplications = await jobPostApplicationsModel.countDocuments({ employeeId });

//       // Fetch counts of application statuses
//       const applicationStatusCounts = await jobPostApplicationsModel.aggregate([
//         {
//           $match: { employeeId }
//         },
//         {
//           $group: {
//             _id: null,
//             shortlistedCount: { $sum: { $cond: [{ $eq: ["$status", "shortlisted"] }, 1, 0] } },
//             rejectedCountApps: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
//             underReviewCount: { $sum: { $cond: [{ $eq: ["$status", "under review"] }, 1, 0] } }
//           }
//         }
//       ]);

//       const { shortlistedCount = 0, rejectedCountApps = 0, underReviewCount = 0 } = applicationStatusCounts[0] || {};

//       // Fetch total number of offer letters for the employee
//       const totalOfferLetters = await OfferLetter.countDocuments({ employeeId });

//       // Fetch counts of accepted and rejected offer letters
//       const offerLetterStatusCounts = await OfferLetter.aggregate([
//         {
//           $match: { employeeId }
//         },
//         {
//           $group: {
//             _id: null,
//             acceptedCount: { $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] } },
//             rejectedCount: { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
//             pendingCount: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } }
//           }
//         }
//       ]);

//       const { acceptedCount = 0, rejectedCount = 0, pendingCount = 0 } = offerLetterStatusCounts[0] || {};

//       // Return the aggregated data for each employee
//       return {
//         employeeId,
//         candidateName,
//         totalApplications,
//         applications: {
//           shortlisted: shortlistedCount,
//           rejected: rejectedCountApps,
//           underReview: underReviewCount
//         },
//         totalOfferLetters,
//         offerLetters: {
//           accepted: acceptedCount,
//           rejected: rejectedCount,
//           pending: pendingCount
//         }
//       };
//     }));

//     res.status(200).json({
//       globalStats: {
//         totalCandidates,
//         totalApplications,
//         averageApplicationsPerCandidate,
//         applicationStatusCounts: {
//           shortlisted: statusCounts.shortlisted,
//           rejected: statusCounts.rejected,
//           underReview: statusCounts['under review']
//         },
//         applicationStatusPercentages: statusPercentages
//       },
//       employeeDetails
//     });
//   } catch (error) {
//     res.status(500);
//     next(error);
//   }
// });

// export {
//     getStats,
// }