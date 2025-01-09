import asyncHandler from "../handlers/asyncHandler.js";
import Company from "../models/company.model.js";
import BusinessAccount from "../models/business/businessAccount.model.js";
import {
  uploadFileToGCS,
  deleteFileFromGCS,
  generateV4ReadSignedUrl,
} from "../utils/uploadToGCP.js";
import generateUID from "../utils/uidGenerator.js";
import JobPost from "../models/jobPosts/jobPosts.model.js";
const storeCompanyDocuments = async (userId, body, files) => {
  console.log("Files received:", files);

  // Process each file and generate signed URLs
  const processFile = async (file) => {
    if (!file) return { fileName: null, signedUrl: null };
    const url = await uploadFileToGCS(userId, file);
    const fileName = url.split("/").pop();
    const signedUrl = await generateV4ReadSignedUrl(userId, fileName);
    return { fileName, signedUrl };
  };

  const logoResult = await processFile(files?.logo);
  const documentResult = await processFile(files?.document);
  const additionalDocumentResult = await processFile(files?.additionalDocument);

  return {
    companyDetails: {
      companylocationdetails: body.companylocationdetails,
      companyprofile: {
        ...body.companyprofile,
        logo: logoResult.fileName,
      },
      compbasicdetails: {
        ...body.compbasicdetails,
        additionallicence: additionalDocumentResult.fileName,
        document: documentResult.fileName,
      },
    },
    signedUrls: {
      logo: logoResult.signedUrl,
      document: documentResult.signedUrl,
      additionalDocument: additionalDocumentResult.signedUrl,
    },
  };
};

const createCompany = asyncHandler(async (req, res) => {
  try {
    // Destructure the relevant fields from the request body
    let {
      businessname,
      industry,
      category,
      yearOfEstablishment,
      googlemaplink,
      docstype,
      employerId: employerIdFromBody,
    } = req.body;

    // Determine the userId (employerId) based on the role
    const userId =
      req.role === "admin" && employerIdFromBody
        ? employerIdFromBody
        : req.employerId; // userId from the token, attached by the protect middleware

    console.log("UserId from request:", userId);

    // Fetch business account using userId
    const fetchedBusinessAccount = await BusinessAccount.findById(userId);

    if (!fetchedBusinessAccount) {
      console.error("Business Account not found!");
      return res.status(400).json({ error: "Business account not found" });
    }

    if (!businessname) {
      console.error("Business name is required but not provided.");
      return res.status(400).json({ error: "Business name is required" });
    }

    const UID = generateUID(businessname);

    // Construct new company details
    const newCompanyDetails = {
      companylocationdetails: {
        googlemaplink,
      },
      companyprofile: {
        businessname,
        industry,
        category,
      },
      compbasicdetails: {
        docstype,
      },
      yearOfEstablishment,
      createdBy: userId,
      isCompleted: true,
      UID,
    };

    console.log(newCompanyDetails);

    // Create new company record
    const company = await Company.create(newCompanyDetails);
    console.log(company._id);
    await company.save();

    // Update business account with new company ID and status
    fetchedBusinessAccount.companyId = company._id;
    fetchedBusinessAccount.status = "approved";

    await fetchedBusinessAccount.save();

    res.status(200).json({
      message: "Company linked successfully",
      company,
      businessAccount: fetchedBusinessAccount,
    });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
});

const listOfCompanies = asyncHandler(async (req, res) => {
  try {
    // Step 1: Retrieve all companies
    const companies = await Company.find(
      {},
      {
        _id: 1,
        UID: 1,
        companyprofile: { businessname: 1, category: 1 },
        compbasicdetails: { ownernumber: 1 },
        status: 1,
      }
    );

    // Step 2: Retrieve all business accounts for the companies
    const companyIds = companies.map((company) => company._id);
    const businessAccounts = await BusinessAccount.find({
      companyId: { $in: companyIds },
    }).select({ basicDetails: { fullName: 1 }, companyId: 1 });

    // Step 3: Create a mapping of companyId to fullName for quick lookup
    const businessAccountMap = {};
    businessAccounts.forEach((account) => {
      businessAccountMap[account.companyId] = account.basicDetails.fullName;
    });

    // Step 4: Map the company data and include the fullName
    const nameAndIds = companies.map((company) => ({
      id: company._id,
      uid: company.UID,
      name: company.companyprofile.businessname,
      category: company.companyprofile.category,
      ownernumber: company.compbasicdetails.ownernumber,
      status: company.status,
      fullName: businessAccountMap[company._id] || null, // Get fullName from the map
    }));

    res.status(200).json(nameAndIds);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve companies",
      error: error.message,
    });
  }
});

const updateProfilePicture = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const logo = req.file;

  if (!logo) {
    return res.status(400).json({ error: "Logo file is required" });
  }

  const userId = req.employerId;

  try {
    // Upload the logo to GCS and get the logo URL
    const logoUrl = await uploadFileToGCS(userId, logo);
    const logoName = logoUrl.split("/").pop();

    // Generate a signed URL for the logo
    const signedLogoUrl = await generateV4ReadSignedUrl(userId, logoName);

    // Update the company profile with the logo details
    const company = await Company.findByIdAndUpdate(
      id,
      { "companyprofile.logo": { name: logoName, uri: signedLogoUrl } },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.status(200).json({
      message: "Profile picture updated successfully",
      logo: { uri: signedLogoUrl, name: logo.originalname },
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({
      error: "An error occurred while updating profile picture",
      details: error.message,
    });
  }
});

const uploadCompanyBackgroundPhoto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const backgroundPhoto = req.file;

  if (!backgroundPhoto) {
    console.log("No background photo file provided");
    return res.status(400).json({ error: "Background photo file is required" });
  }

  const userId = req.employerId;
  console.log(
    `Uploading background photo for company ID: ${id}, by user: ${userId}`
  );

  try {
    const backgroundPhotoUrl = await uploadFileToGCS(id, backgroundPhoto);
    console.log(`Uploaded background photo to GCS, URL: ${backgroundPhotoUrl}`);

    const fileName = backgroundPhotoUrl.split("/").pop();
    const company = await Company.findByIdAndUpdate(
      id,
      { "companyprofile.backgroundPhoto": fileName },
      { new: true, runValidators: true }
    );

    if (!company) {
      console.log(`Company not found with ID: ${id}`);
      return res.status(404).json({ error: "Company not found" });
    }

    console.log(
      `Updated company with new background photo: ${JSON.stringify(
        company.companyprofile.backgroundPhoto,
        null,
        2
      )}`
    );
    res
      .status(200)
      .json({
        message: "Background photo uploaded successfully",
        backgroundPhotoUrl,
      });
  } catch (error) {
    console.error("Upload Error:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while uploading background photo",
        details: error.message,
      });
  }
});

const getCompanyBackgroundPhoto = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.employerId;

  try {
    console.log(`Fetching company with ID: ${id}`);
    const company = await Company.findById(id);

    if (!company) {
      console.log(`Company not found with ID: ${id}`);
      return res.status(404).json({ error: "Company not found" });
    }

    console.log(`Company found: ${JSON.stringify(company, null, 2)}`);
    const backgroundPhoto = company.companyprofile.backgroundPhoto;

    if (!backgroundPhoto) {
      console.log(`Background photo not found for company ID: ${id}`);
      return res.status(404).json({ error: "Background photo not found" });
    }

    console.log(
      `Generating signed URL for user: ${userId}, file: ${backgroundPhoto}`
    );
    const backgroundPhotoUrl = await generateV4ReadSignedUrl(
      id,
      backgroundPhoto
    );
    res.status(200).json({ backgroundPhotoUrl });
  } catch (error) {
    console.error("Retrieval Error:", error);
    res.status(500).json({
      error: "An error occurred while retrieving background photo",
      details: error.message,
    });
  }
});

const updateCompanyInfo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { companylocationdetails, companyprofile, compbasicdetails, branches } =
    req.body;

  if (
    !companylocationdetails &&
    !companyprofile &&
    !compbasicdetails &&
    !branches
  ) {
    return res
      .status(400)
      .json({ error: "At least one field is required to update" });
  }

  try {
    const currentCompanyData = await Company.findById(id);
    if (!currentCompanyData) {
      return res.status(404).json({ error: "Company not found" });
    }

    const updateFields = {
      companylocationdetails: {
        ...currentCompanyData.companylocationdetails,
        ...companylocationdetails,
      },
      companyprofile: {
        ...currentCompanyData.companyprofile,
        ...companyprofile,
      },
      compbasicdetails: {
        ...currentCompanyData.compbasicdetails,
        ...compbasicdetails,
      },
      branches: branches || currentCompanyData.branches,
    };

    const company = await Company.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res
      .status(200)
      .json({ message: "Company information updated successfully", company });
  } catch (error) {
    console.error("Update Error:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while updating company information",
        details: error.message,
      });
  }
});

const getCompanyPhotos = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const photoUrls = company.compbasicdetails.additionalImages || [];

    const signedPhotoUrls = await Promise.all(
      photoUrls.map(async (photo) => {
        const signedUrl = await generateV4ReadSignedUrl(id, photo);
        return {
          uri: signedUrl,
          photoId: photo, // assuming `photo.url` is unique and used as the ID
        };
      })
    );

    res
      .status(200)
      .json({
        message: "Photos retrieved successfully",
        photos: signedPhotoUrls,
      });
  } catch (error) {
    console.error("Error retrieving photos:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while retrieving photos",
        details: error.message,
      });
  }
});

const getCompanyPhotoById = asyncHandler(async (req, res) => {
  const { id, photoId } = req.params;

  try {
    const company = await Company.findById(id);

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    const photoUrl = company.additionalImages.find((url) =>
      url.includes(photoId)
    );

    if (!photoUrl) {
      return res.status(404).json({ error: "Photo not found" });
    }

    res
      .status(200)
      .json({ message: "Photo retrieved successfully", photo: photoUrl });
  } catch (error) {
    console.error("Error retrieving photo:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while retrieving the photo",
        details: error.message,
      });
  }
});

const selectCompany = asyncHandler(async (req, res) => {
  let { companyId, role } = req.body;
  let businessAccountId = req.session.businessAccountId;

  if (!businessAccountId) {
    const userId = req.employerId;
    const existingBusiness = await BusinessAccount.findById(userId);
    if (existingBusiness) {
      req.session.businessAccountId = existingBusiness._id;
      businessAccountId = existingBusiness._id;
    } else {
      console.error("Business Account not found!");
      return res
        .status(400)
        .json({ error: "Business account not found in session" });
    }
  }

  let company;
  if (companyId) {
    company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }
  } else {
    console.error("Invalid company details");
    return res.status(400).json({ error: "Invalid company details" });
  }

  const businessAccount = await BusinessAccount.findById(businessAccountId);
  if (!businessAccount) {
    return res.status(404).json({ error: "Business account not found" });
  }

  // Update the business account with companyId and role
  businessAccount.companyId = company._id;
  if (role) {
    businessAccount.role = role;
  }

  await businessAccount.save();

  res.status(200).json({
    message: "Company linked successfully",
    businessAccount,
  });
});

const getCompanyById = async (req, res) => {
  const { companyId } = req.params;

  try {
    // Step 1: Retrieve the company by ID
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Step 2: Retrieve job posts associated with the company
    const jobPosts = await JobPost.find({ companyId: companyId });

    // Step 3: Include the branch count and job posts in the response
    const responseCompany = {
      ...company._doc,
      branchCount: company.branchCount,
      jobPosts: jobPosts, // Include job posts in the response
    };

    res.status(200).json({
      message: "Company found",
      company: responseCompany,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching company", error: error.message });
  }
};
// const getCompanyById = async (req, res) => {
//   const { companyId } = req.params;
//   try {
//     const company = await Company.findById(companyId);
//     if (!company) {
//       return res.status(404).json({ message: "Company not found" });
//     }

//     // Destructure logo properties
//     const { logo } = company.companyprofile;
//     const responseCompany = {
//       ...company._doc, // All other properties of the company
//       companyprofile: {
//         ...company.companyprofile._doc,
//         logoUri: logo.uri,
//         logoName: logo.name
//       }
//     };
//     delete responseCompany.companyprofile.logo; // Remove the original logo object

//     res.status(200).json({ message: "Company found", company: responseCompany });
//   } catch (error) {
//     res.status(500).json({ message: "Error fetching company", error: error.message });
//   }
// };

const getUnverifiedCompanies = async (req, res) => {
  try {
    const companies = await Company.find({ status: "under evaluation" });
    res.status(200).json(companies);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching unverified companies",
      error: error.message,
    });
  }
};

const verifyCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status } = req.query;

    if (!["approved", "rejected", "under evalutaion"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      { status },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res
      .status(200)
      .json({ message: "Status updated successfully", status: company.status });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.params;

  try {
    const company = await Company.findByIdAndDelete(companyId);

    if (!company) {
      return res.status(404).json({
        message: "Company not found",
      });
    }
    await BusinessAccount.updateMany(
      { companyId: companyId },
      { $unset: { companyId: "" } }
    );
    res.status(200).json({
      message: "Company deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete company",
      error: error.message,
    });
  }
});

const uploadCompanyPhotos = asyncHandler(async (req, res) => {
  const { id } = req.params; // Get company ID from request parameters
  const files = req.files; // Get uploaded files from request

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "At least one photo is required" });
  }

  const userId = req.employerId; // Get user ID from request (assumed to be set previously)

  try {
    // Step 1: Upload each file to GCS and get their URLs
    const uploadPromises = files.map((file) => uploadFileToGCS(id, file));
    const photosUrls = await Promise.all(uploadPromises);

    // Extract file names from URLs
    const photoFileNames = photosUrls.map((url) => url.split("/").pop());

    // Step 2: Update the company's additionalImages with the new photos' file names
    const company = await Company.findByIdAndUpdate(
      id,
      {
        $push: {
          "compbasicdetails.additionalImages": { $each: photoFileNames },
        },
      },
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Step 3: Generate signed URLs for each photo
    const signedPhotosUrls = await Promise.all(
      photoFileNames.map((fileName) => generateV4ReadSignedUrl(id, fileName))
    );

    console.log(signedPhotosUrls);
    res
      .status(200)
      .json({
        message: "Photos uploaded successfully",
        photosUrls: signedPhotosUrls,
      });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({
      error: "An error occurred while uploading photos",
      details: error.message,
    });
  }
});

const getCompanyLogo = asyncHandler(async (req, res) => {
  try {
    const companyId = req.params.id;
    const userId = req.employerId;

    if (!companyId) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await Company.findById(companyId).select(
      "companyprofile.logo"
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const { logo } = company.companyprofile;

    if (logo) {
      const logoUrl = await generateV4ReadSignedUrl(userId, logo);
      res.json({ logo: { uri: logoUrl, name: logo } });
    } else {
      res.json({ logo: null });
    }
  } catch (error) {
    console.error("Error fetching company logo:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const deleteCompanyPhotoByUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { photoUrl } = req.body;

  try {
    console.log("Photo URL:", photoUrl);
    console.log("Company ID:", id);

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Extract the file name from the provided URL
    const fileName = photoUrl.split("/").pop();

    // Check if the photo exists in additionalImages
    const photoIndex =
      company.compbasicdetails.additionalImages.indexOf(fileName);
    if (photoIndex === -1) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Remove the photo URL from the additionalImages array
    company.compbasicdetails.additionalImages.splice(photoIndex, 1);

    // Ensure document and additionallicence are strings
    if (typeof company.compbasicdetails.document === "object") {
      company.compbasicdetails.document = JSON.stringify(
        company.compbasicdetails.document
      );
    }
    if (typeof company.compbasicdetails.additionallicence === "object") {
      company.compbasicdetails.additionallicence = JSON.stringify(
        company.compbasicdetails.additionallicence
      );
    }

    await company.save({ validateModifiedOnly: true });

    res.status(200).json({ message: "Photo deleted successfully", photoUrl });
  } catch (error) {
    console.error("Error deleting photo:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while deleting the photo",
        details: error.message,
      });
  }
});

export {
  createCompany,
  updateProfilePicture,
  uploadCompanyPhotos,
  updateCompanyInfo,
  selectCompany,
  listOfCompanies,
  getCompanyById,
  getCompanyLogo,
  getUnverifiedCompanies,
  verifyCompany,
  getCompanyBackgroundPhoto,
  uploadCompanyBackgroundPhoto,
  deleteCompany,
  getCompanyPhotos,
  getCompanyPhotoById,
  deleteCompanyPhotoByUrl,
};
