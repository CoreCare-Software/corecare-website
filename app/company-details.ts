export const COMPANY_DETAILS = {
  proprietorName: "Christopher Anthony Warman",
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
  icoApplicationReference: "C1999522",
  icoPublicRegistrationNumber: null,
  icoStatus: "Application submitted; public register entry awaiting publication",
} as const;

export const CONTRACTING_NAME = `${COMPANY_DETAILS.proprietorName}, trading as ${COMPANY_DETAILS.legalName}`;

export const COMPANY_ADDRESS = `${COMPANY_DETAILS.addressLine1}, ${COMPANY_DETAILS.addressLine2}, ${COMPANY_DETAILS.locality}, ${COMPANY_DETAILS.postTown}, ${COMPANY_DETAILS.postcode}`;
