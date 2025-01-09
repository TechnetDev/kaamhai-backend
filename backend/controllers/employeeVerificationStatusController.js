import EmployeeDocument from '../models/employee/EmployeeDoc.model.js';
import EmployeeInfo from '../models/employee/EmployeeInfo.model.js';

export const isEmployeeVerified = async (req, res) => {
  try {
    const employeeID = req.employeeId;
    const employeeDocument = await EmployeeDocument.findOne({ id: employeeID });
    const employeeInfo = await EmployeeInfo.findOne({ id: employeeID });

    if (!employeeDocument || !employeeInfo) {
      return res.status(404).json({ message: 'Employee not found' });
    }


    const isCompleted = employeeDocument.aadharCard.isCompleted &&
                        employeeDocument.facePhoto.isCompleted &&
                        employeeInfo.personalInfo.isCompleted &&
                        employeeInfo.professionalInfo.isCompleted;


    res.status(200).json({ employeeID, isCompleted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};