// import OfferLetter from '../../../models/offerLetter.model.js';
// import asyncHandler from '../../../handlers/asyncHandler.js';

// // Helper function to get the start of the day, week, and month
// const getStartOfDay = () => new Date(new Date().setHours(0, 0, 0, 0));
// const getStartOfWeek = () => {
//   const currentDate = new Date();
//   const startOfWeek = currentDate.getDate() - currentDate.getDay();
//   return new Date(new Date(currentDate.setDate(startOfWeek)).setHours(0, 0, 0, 0));
// };
// const getStartOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);

// const getOfferLetterStatistics = asyncHandler(async (req, res, next) => {
//   try {
//     // Total offer letters created
//     const totalCreated = await OfferLetter.countDocuments();

//     // Total offer letters accepted
//     const totalAccepted = await OfferLetter.countDocuments({ status: 'Accepted' });

//     // Total offer letters rejected
//     const totalRejected = await OfferLetter.countDocuments({ status: 'Rejected' });

//     // Total offer letters created today
//     const today = await OfferLetter.countDocuments({ createdAt: { $gte: getStartOfDay() } });

//     // Total offer letters created this week
//     const thisWeek = await OfferLetter.countDocuments({ createdAt: { $gte: getStartOfWeek() } });

//     // Total offer letters created this month
//     const thisMonth = await OfferLetter.countDocuments({ createdAt: { $gte: getStartOfMonth() } });

//     // Response object
//     res.status(200).json({
//       globalStats: {
//         totalCreated,
//         totalAccepted,
//         totalRejected,
//       },
//       periodStats: {
//         today,
//         thisWeek,
//         thisMonth
//       }
//     });
//   } catch (error) {
//     res.status(500);
//     next(error);
//   }
// });

// export {
//     getOfferLetterStatistics,
// }