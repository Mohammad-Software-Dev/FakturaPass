export type DecimalString = string;
export type Tax = { categoryCode: string; rate: DecimalString };
export type AllowanceCharge = {
  charge: boolean;
  amount: DecimalString;
  reason?: string | null;
  reasonCode?: string | null;
  baseAmount?: DecimalString | null;
  percentage?: DecimalString | null;
  tax?: Tax | null;
};
export type Party = {
  name: string;
  tradingName?: string | null;
  address: {
    street: string;
    additional?: string | null;
    city: string;
    postalCode: string;
    countryCode: "DE";
  };
  vatId?: string | null;
  taxNumber?: string | null;
  electronicAddress: { schemeId: string; value: string };
  legalRegistrationId?: { schemeId?: string | null; value: string } | null;
  contact?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};
export type InvoiceLine = {
  id: string;
  name: string;
  description?: string | null;
  quantity: DecimalString;
  unitCode: string;
  unitPrice: { amount: DecimalString; baseQuantity: DecimalString };
  lineNetAmount: DecimalString;
  tax: Tax;
  allowancesCharges: AllowanceCharge[];
  buyerAccountingReference?: string | null;
  purchaseOrderLineReference?: string | null;
};
export type Invoice = {
  schemaVersion: "fakturapass.invoice.v1";
  source: {
    system: string;
    recordId: string;
    receivedAt: string;
    fileName?: string | null;
  };
  document: {
    type: "INVOICE";
    number: string;
    issueDate: string;
    currency: "EUR";
    buyerReference?: string | null;
    purchaseOrderReference?: string | null;
    contractReference?: string | null;
  };
  seller: Party;
  buyer: Party;
  lines: InvoiceLine[];
  allowancesCharges: AllowanceCharge[];
  taxBreakdown: (Tax & {
    taxableAmount: DecimalString;
    taxAmount: DecimalString;
  })[];
  totals: Record<
    | "lineNetAmount"
    | "allowanceTotal"
    | "chargeTotal"
    | "taxExclusiveAmount"
    | "taxAmount"
    | "taxInclusiveAmount"
    | "prepaidAmount"
    | "payableRoundingAmount"
    | "payableAmount",
    DecimalString
  >;
  payment?: {
    meansCode: string;
    dueDate?: string | null;
    terms?: string | null;
    iban?: string | null;
    bic?: string | null;
    accountName?: string | null;
    paymentReference?: string | null;
  } | null;
  attachments: {
    id: string;
    fileName: string;
    mediaType: string;
    description?: string | null;
    objectKey?: string | null;
    sha256?: string | null;
  }[];
  extensions: Record<string, unknown>;
};
export type Finding = {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  layer: "SCHEMA" | "SEMANTIC" | "STANDARD" | "RECIPIENT" | "SYSTEM";
  canonicalPath: string;
  sourcePath: string | null;
  ruleId: string | null;
  messageKey: string;
  parameters: Record<string, unknown>;
  evidenceSource: string | null;
};
export type Status =
  | "NORMALIZED"
  | "VALIDATION_PENDING"
  | "VALID"
  | "INVALID"
  | "BLOCKED_UNSUPPORTED"
  | "APPROVED"
  | "GENERATION_PENDING"
  | "GENERATED"
  | "ARTIFACT_VALIDATED";
