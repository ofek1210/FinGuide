import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

jest.mock("./landing/useLandingAnimations", () => ({
  useLandingAnimations: jest.fn(),
}));

describe("LandingPage interactions", () => {
  it("opens and closes FAQ answers", () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);

    const question = screen.getByRole("button", { name: /האם הנתונים שלי בטוחים/ });
    const answer = screen.getByText(/כל המסמכים מוצפנים/).parentElement;

    expect(question.getAttribute("aria-expanded")).toBe("false");
    expect(answer?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(question);
    expect(question.getAttribute("aria-expanded")).toBe("true");
    expect(answer?.getAttribute("aria-hidden")).toBe("false");

    fireEvent.click(question);
    expect(question.getAttribute("aria-expanded")).toBe("false");
  });
});
