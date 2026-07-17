import { timeOfDayGreeting } from "./timeGreeting";

const at = (hour: number) => timeOfDayGreeting(new Date(2026, 0, 1, hour, 30));

describe("timeOfDayGreeting", () => {
  it("returns morning greeting before noon", () => {
    expect(at(5)).toBe("בוקר טוב");
    expect(at(11)).toBe("בוקר טוב");
  });

  it("returns afternoon greeting from noon to before 17:00", () => {
    expect(at(12)).toBe("צהריים טובים");
    expect(at(15)).toBe("צהריים טובים");
    expect(at(16)).toBe("צהריים טובים");
  });

  it("returns evening greeting from 17:00 to before 22:00", () => {
    expect(at(17)).toBe("ערב טוב");
    expect(at(21)).toBe("ערב טוב");
  });

  it("returns night greeting from 22:00 to before 05:00", () => {
    expect(at(22)).toBe("לילה טוב");
    expect(at(2)).toBe("לילה טוב");
    expect(at(4)).toBe("לילה טוב");
  });
});
