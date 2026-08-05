export const COMPANY_DETAILS = {
  legalName: "CoreCare Systems",
  addressLine1: "Red Lion",
  addressLine2: "Fen Road",
  locality: "East Kirkby",
  postTown: "Spilsby",
  postcode: "PE23 4DB",
  country: "United Kingdom",
  telephoneDisplay: "07983 408588",
  telephoneHref: "+447983408588",
  companyNumber: null,
  vatNumber: null,
  icoRegistrationNumber: null,
} as const;

export const COMPANY_ADDRESS = `${COMPANY_DETAILS.addressLine1}, ${COMPANY_DETAILS.addressLine2}, ${COMPANY_DETAILS.locality}, ${COMPANY_DETAILS.postTown}, ${COMPANY_DETAILS.postcode}`;
