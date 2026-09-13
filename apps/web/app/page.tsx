import Workspace from "./workspace";
import consulting from "../../../examples/customer-invoice-consulting.json";
export default function Page() {
  return (
    <Workspace
      fixtures={[
        {
          name: "Beratungsleistung · 19 % USt.",
          code: "consulting",
          data: consulting,
        },
      ]}
    />
  );
}
