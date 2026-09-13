import Workspace from "./workspace";
import basic from "../../../fixtures/valid/FP-A-001.json";
import decimal from "../../../fixtures/valid/FP-A-003.json";
import mismatch from "../../../fixtures/invalid/FP-A-102.json";
import unsupported from "../../../fixtures/invalid/FP-A-105.json";
import missing from "../../../fixtures/invalid/FP-A-101.json";
import customerConsulting from "../../../examples/customer-invoice-consulting.json";
export default function Page() {
  return (
    <Workspace
      fixtures={[
        {
          name: "Kundenbeispiel · Digitalberatung",
          code: "CUSTOMER-EXAMPLE",
          data: customerConsulting,
        },
        { name: "Standardrechnung · 19 % USt.", code: "FP-A-001", data: basic },
        {
          name: "Dezimalmenge · 1,25 Stunden",
          code: "FP-A-003",
          data: decimal,
        },
        {
          name: "Abweichender Rechnungsbetrag",
          code: "FP-A-102",
          data: mismatch,
        },
        {
          name: "Nicht unterstützter Steuerfall",
          code: "FP-A-105",
          data: unsupported,
        },
        { name: "Fehlende Käuferreferenz", code: "FP-A-101", data: missing },
      ]}
    />
  );
}
