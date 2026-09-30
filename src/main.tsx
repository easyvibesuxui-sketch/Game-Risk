import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Campaign } from "./components/Campaign";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Campaign />
  </StrictMode>,
);
