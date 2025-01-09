const formatPhoneNumber = (phoneNumber) => {
  // Remove any non-digit characters
  const cleanedNumber = phoneNumber.replace(/\D/g, "");

  // Check if the number has exactly 10 digits
  if (cleanedNumber.length === 10) {
    // Add the country code if missing
    return "+91" + cleanedNumber;
  } else {
    // Handle invalid phone number length
    return "Invalid phone number";
  }
};

const parseDate = (str) => {
  if (!str) return null;
  const parts = str.split("-");
  const d1 = new Date(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0));
  return d1;
};


const personalInfoParser = (personalInfo) => {
  const { qualification } = personalInfo.education || {};
  return {
    name: personalInfo.name,
    fatherName: personalInfo.fatherName,
    dateOfBirth: parseDate(personalInfo.dateOfBirth),
    bloodGroup: personalInfo.bloodGroup,
    emergencyContact: personalInfo.emergencyContact,
    insurance: personalInfo.insurance,
    residentialAddress: {
      houseNo: personalInfo.residentialAddress.houseNo,
      state: personalInfo.residentialAddress.state,
      village: personalInfo.residentialAddress.village,
      pincode: personalInfo.residentialAddress.pincode,
    },
    mailingAddress: {
      houseNo: personalInfo.mailingAddress.houseNo,
      state: personalInfo.mailingAddress.state,
      village: personalInfo.mailingAddress.village,
      pincode: personalInfo.mailingAddress.pincode,
    },
    familyContact: {
      name: personalInfo.familyContact.name,
      contactNo: personalInfo.familyContact.contactNo,
      relationship: personalInfo.familyContact.relationship,
    },
    localContact: {
      name: personalInfo.localContact.name,
      contactNo: personalInfo.localContact.contactNo,
      relationship: personalInfo.localContact.relationship,
    },
    education: {
      qualification: qualification
        ? {
            label: qualification.label,
            value: qualification.value,
            _index: qualification._index,
          }
        : undefined,
      institute: personalInfo.education.institute,
      startDate: parseDate(personalInfo.education.startDate),
      endDate: parseDate(personalInfo.education.endDate),
    },
  };
};

const professionalInfoParser = (professionalInfo) => {
  return {
    category: professionalInfo.category,
    job: professionalInfo.job,
    skills: professionalInfo.skills,
    preferredWorkLocation: professionalInfo?.preferredWorkLocation?.label || "",
    totalExperience: professionalInfo.totalExperience,
  };
};

export { formatPhoneNumber, personalInfoParser, professionalInfoParser, parseDate };