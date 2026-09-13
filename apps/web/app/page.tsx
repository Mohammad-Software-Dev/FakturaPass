import Workspace from "./workspace";
import brandProject from "../../../examples/customer-invoice-brand-project.json";
import consulting from "../../../examples/customer-invoice-consulting.json";
import equipment from "../../../examples/customer-invoice-office-equipment.json";
export default function Page() {
  return (
    <Workspace
      fixtures={[
        {
          name: "Beratungsleistung · 19 % USt.",
          code: "consulting",
          data: consulting,
        },
        {
          name: "Büroausstattung · Projektrabatt",
          code: "office-equipment",
          data: equipment,
        },
        {
          name: "Markenprojekt · Anzahlung",
          code: "brand-project",
          data: brandProject,
        },
      ]}
    />
  );
}
