import asyncHandler from "../handlers/asyncHandler.js";
import Company from "../models/company.model.js";

// @desc    Update company information
// @route   PUT /api/company/:id/info
// @access  Admin
const updateCompanyInfo = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { companylocationdetails, companyprofile, compbasicdetails } = req.body;

    if (!companylocationdetails && !companyprofile && !compbasicdetails) {
        return res.status(400).json({ error: 'At least one field is required to update' });
    }

    const updateFields = {};
    if (companylocationdetails) updateFields["companylocationdetails"] = companylocationdetails;
    if (companyprofile) updateFields["companyprofile"] = companyprofile;
    if (compbasicdetails) updateFields["compbasicdetails"] = compbasicdetails;

    try {
        const company = await Company.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const updatedFieldsResponse = {};
        if (companylocationdetails) updatedFieldsResponse.companylocationdetails = companylocationdetails;
        if (companyprofile) updatedFieldsResponse.companyprofile = companyprofile;
        if (compbasicdetails) updatedFieldsResponse.compbasicdetails = compbasicdetails;
        res.status(200).json({ message: 'Company information updated successfully', updatedFields: updatedFieldsResponse });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ error: 'An error occurred while updating company information', details: error.message });
    }
});

const getVerifiedCompanies = async (req, res) => {
    try {
      const companies = await Company.find({ status: "approved" });
      res.status(200).json(companies);
    } catch (error) {
      res.status(500).json({ message: "Error fetching verified companies", error: error.message });
    }
  };

export { updateCompanyInfo, getVerifiedCompanies };