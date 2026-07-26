import "@testing-library/jest-dom";
import { act } from "react";
import * as React from "react";

// @testing-library/react still routes through react-dom/test-utils, which expects React.act.
Object.assign(React, { act });

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
