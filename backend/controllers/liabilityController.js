import EmployeeInfoModel from '../models/employee/EmployeeInfo.model.js';
import Company from '../models/company.model.js';
import { uploadFileToGCS, generateV4ReadSignedUrl } from "../utils/uploadToGCP.js";
import LeaveRequest from '../models/leaveRequests.model.js';
// Create a new liability request
export const createLiability = async (req, res) => {
  try {
    const { employeeid, formattedid, date, type, itemName, amount, leaveDetails, employerid: manualEmployerId} = req.body; // Added `type` and `leaveDetails`
    const employerId = manualEmployerId || req.employerId;
    const { liabilityPhoto } = req.files || {}; // Get uploaded liability photo

    // Fetch companyId using employerId
    const businessAccount = await BusinessAccount.findById(employerId);
    if (!businessAccount || !businessAccount.companyId) {
      return res.status(404).json({ message: "Employer or company not found" });
    }

    const companyid = businessAccount.companyId;

    let liabilityPhotoDetails = null;
    if (type === "item" && liabilityPhoto && liabilityPhoto.length > 0) {
      // Upload photo to GCS for item liabilities
      await uploadFileToGCS(employeeid, liabilityPhoto[0]);

      liabilityPhotoDetails = {
        filename: liabilityPhoto[0].filename,
        contentType: liabilityPhoto[0].mimetype,
        uri: liabilityPhoto[0].path,
        fileCopyUri: liabilityPhoto[0].destination + liabilityPhoto[0].filename,
        isCompleted: true,
      };
    }

    let leaveRequest = null;
    if (type === "leave") {
      // Extract leave details
      const { startDate, endDate, totalDays, reason } = leaveDetails;

      // Create leave request
      leaveRequest = await LeaveRequest.create({
        employeeId: employeeid,
        companyId: companyid,
        startDate,
        endDate,
        totalDays,
        reason,
        status: "pending",
      });
    }

    // Create liability record
    const liability = await Liability.create({
      employeeid,
      formattedid,
      date,
      type,
      itemName: type === "item" ? itemName : undefined,
      amount: type === "item" ? amount : undefined,
      companyid,
      status: "pending",
      liabilityPhoto: type === "item" ? liabilityPhotoDetails : undefined,
      leaveId: type === "leave" ? leaveRequest._id : undefined,
    });

    res.status(201).json({ message: "Liability request created", liability });
  } catch (error) {
    res.status(500).json({ message: "Error creating liability request", error });
  }
};

// Fetch all liabilities for a company based on companyId
export const getLiabilitiesByCompany = async (req, res) => {
  try {
    const employerId = req.employerId;

    // Fetch companyId using employerId
    const businessAccount = await BusinessAccount.findById(employerId);
    if (!businessAccount || !businessAccount.companyId) {
        return res.status(404).json({ message: 'Employer or company not found' });
    }

    const companyid = businessAccount.companyId;

    // Fetch liabilities for the company
    const liabilities = await Liability.find({ companyid });

    // Add detailed employee info including face photo URI
    const detailedLiabilities = await Promise.all(
      liabilities.map(async (liability) => {
        const employee = await EmployeeInfoModel.findOne({ id: liability.employeeid })
          .select('personalInfo.name facePhoto email');

        const facePhoto = employee && employee.facePhoto && employee.facePhoto.isCompleted
          ? await generateV4ReadSignedUrl(liability.employeeid.toString(), employee.facePhoto.filename)
          : null;

        return {
          ...liability._doc,
          employee: employee ? {
            name: employee.personalInfo.name,
            email: employee.email,
            facePhotoUri: facePhoto
          } : null,
        };
      })
    );

    res.status(200).json({ liabilities: detailedLiabilities });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching liabilities', error });
  }
};

// Fetch all liabilities for an employee based on employeeId
export const getLiabilitiesByEmployee = async (req, res) => {
    try {
      const { employeeid } = req.params;
  
      // Fetch liabilities for the employee
      const liabilities = await Liability.find({ employeeid });
  
      // Add detailed employee info and generate signed URLs for facePhoto and liabilityPhoto
      const detailedLiabilities = await Promise.all(
        liabilities.map(async (liability) => {
          // Fetch employee details
          const employee = await EmployeeInfoModel.findOne({ id: liability.employeeid })
            .select('personalInfo.name facePhoto email');
  
          // Generate signed URL for facePhoto if available
          const facePhotoUri = employee && employee.facePhoto && employee.facePhoto.isCompleted
            ? await generateV4ReadSignedUrl(liability.employeeid.toString(), employee.facePhoto.filename)
            : null;
  
          // Generate signed URL for liabilityPhoto if available
          const liabilityPhotoUri = liability.liabilityPhoto && liability.liabilityPhoto.isCompleted
            ? await generateV4ReadSignedUrl(liability.employeeid.toString(), liability.liabilityPhoto.filename)
            : null;
  
          // Fetch leave details if the liability type is 'leave'
          let leaveDetails = null;
          if (liability.type === 'leave' && liability.leaveId) {
            leaveDetails = await LeaveRequest.findById(liability.leaveId).select('-__v -createdAt -updatedAt');
          }
  
          return {
            ...liability._doc,
            // employee: employee ? {
           // name: employee.personalInfo.name,
           // email: employee.email,
           // facePhotoUri,
         // } : null,
          liabilityPhotoUri, // Include liabilityPhoto URL
          leaveDetails,      // Include leave details if available
        };
      })
    );

    res.status(200).json({ liabilities: detailedLiabilities });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching liabilities', error });
  }
};

export const getAllLiabilitiesWithDetails = async (req, res) => {
  try {
    // Fetch all liabilities
    const liabilities = await Liability.find().lean();

    // Process each liability to include additional details
    const detailedLiabilities = await Promise.all(
      liabilities.map(async (liability) => {
        // Fetch employee details
        const employee = await EmployeeInfoModel.findOne({id :liability.employeeid})
          .select('personalInfo.name facePhoto email');
        // Generate signed URL for employee facePhoto if available
        const facePhotoUri = employee?.facePhoto?.isCompleted
          ? await generateV4ReadSignedUrl(liability.employeeid.toString(), employee.facePhoto.filename)
          : null;

        // Fetch company details
        const company = await Company.findById(liability.companyid)
          .select('companyprofile.businessname companylocationdetails.city companylocationdetails.pincode');

        // Fetch employer (business account) details
        const employer = await BusinessAccount.findOne({ companyId: liability.companyid })
          .select('basicDetails.fullName basicDetails.phoneNumber basicDetails.email');

        // Generate signed URL for liability photo if available
        const liabilityPhotoUri = liability.liabilityPhoto?.isCompleted
          ? await generateV4ReadSignedUrl(liability.employeeid.toString(), liability.liabilityPhoto.filename)
          : null;

        // Fetch leave details if the liability type is 'leave'
        let leaveDetails = null;
        if (liability.type === 'leave' && liability.leaveId) {
          leaveDetails = await LeaveRequest.findById(liability.leaveId).select('-__v -createdAt -updatedAt');
        }

        // Construct the detailed liability object
        return {
          ...liability,
          employee: employee
            ? {
                name: employee.personalInfo.name,
                email: employee.email,
                facePhotoUri,
              }
            : null,
          company: company
            ? {
                businessName: company.companyprofile.businessname,
                city: company.companylocationdetails.city,
                pincode: company.companylocationdetails.pincode,
            }
            : null,
          employer: employer
            ? {
                fullName: employer.basicDetails.fullName,
                phoneNumber: employer.basicDetails.phoneNumber,
                email: employer.basicDetails.email,
              }
            : null,
          liabilityPhotoUri,
          leaveDetails,
        };
      })
    );

    res.status(200).json({ liabilities: detailedLiabilities });
  } catch (error) {
    console.error('Error fetching liabilities:', error);
    res.status(500).json({ message: 'Error fetching liabilities', error });
  }
};

export const getLiabilitiesForEmployee = async (req, res) => {
  try {
    const employeeid = req.employeeId;

    // Fetch liabilities for the employee
    const liabilities = await Liability.find({ employeeid });

    // Add detailed employee info and generate signed URLs for facePhoto and liabilityPhoto
    const detailedLiabilities = await Promise.all(
      liabilities.map(async (liability) => {
        // Fetch employee details
        const employee = await EmployeeInfoModel.findOne({ id: liability.employeeid })
          .select('personalInfo.name facePhoto email');

        // Generate signed URL for liabilityPhoto if available
        const liabilityPhotoUri = liability.liabilityPhoto && liability.liabilityPhoto.isCompleted
          ? await generateV4ReadSignedUrl(liability.employeeid.toString(), liability.liabilityPhoto.filename)
          : null;

        // Fetch leave details if the liability type is 'leave'
        let leaveDetails = null;
        if (liability.type === 'leave' && liability.leaveId) {
          leaveDetails = await LeaveRequest.findById(liability.leaveId).select('-__v -createdAt -updatedAt');
        }

        return {
          ...liability._doc,
          liabilityPhotoUri, // Include liabilityPhoto URL
          leaveDetails,      // Include leave details if available
        };
      })
    );

    res.status(200).json({ liabilities: detailedLiabilities });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching liabilities', error });
  }
};

// Employee accepts or disputes a liability request
export const updateLiabilityStatusByEmployee = async (req, res) => {
  try {
    const { id } = req.params; // Liability ID
    const { status } = req.body; // New status value

    // Validate status
    const validStatuses = ['pending', 'rejected', 'accepted', 'dispute'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Update liability with the new status
    const liability = await Liability.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!liability) {
      return res.status(404).json({ message: 'Liability request not found' });
    }

    res.status(200).json({ message: 'Liability status updated successfully', liability });
  } catch (error) {
    res.status(500).json({ message: 'Error updating liability status', error });
  }
};


// Admin updates any field in the liability request
export const updateLiabilityByAdmin = async (req, res) => {
  try {
    const { id } = req.params; // Liability ID
    const updates = req.body; // Fields to update

    const liability = await Liability.findByIdAndUpdate(id, updates, {
      new: true,
    });

    if (!liability) {
      return res.status(404).json({ message: 'Liability request not found' });
    }

    res.status(200).json({ message: 'Liability updated', liability });
  } catch (error) {
    res.status(500).json({ message: 'Error updating liability', error });
  }
};