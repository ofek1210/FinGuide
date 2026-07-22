'use strict';

const PensionFund = require('../../models/PensionFund');
const PensionDeposit = require('../../models/PensionDeposit');
const PensionImportSnapshot = require('../../models/PensionImportSnapshot');
const {
  importClearinghouseFile,
  clearClearinghouseData,
} = require('../../services/pensionClearinghouseImportService');
const { createDomainTestHarness } = require('../helpers/domainTestHarness');

describe('pension clearinghouse import replace', () => {
  const harness = createDomainTestHarness('clearinghouse-import');

  beforeAll(() => harness.beforeAll());
  afterEach(() => harness.afterEach());
  afterAll(() => harness.afterAll());

  const parsedV1 = {
    funds: [{
      fundName: 'קרן ישנה',
      fundType: 'pension_comprehensive',
      provider: 'מנורה',
      accountNumber: '111',
      currentBalance: 100000,
      deposits: [{
        accountNumber: '111',
        valueDate: new Date('2024-01-01'),
        salaryMonth: '2024-01',
        employeeDeposit: 1000,
        employerDeposit: 1000,
        severanceDeposit: 0,
      }],
    }],
  };

  const parsedV2 = {
    funds: [{
      fundName: 'קרן חדשה',
      fundType: 'study_fund',
      provider: 'הראל',
      accountNumber: '222',
      currentBalance: 50000,
      deposits: [{
        accountNumber: '222',
        valueDate: new Date('2025-01-01'),
        salaryMonth: '2025-01',
        employeeDeposit: 500,
        employerDeposit: 500,
        severanceDeposit: 0,
      }],
    }],
  };

  it('re-import replaces previous clearinghouse funds and deposits', async () => {
    const { userId } = await harness.register();

    await importClearinghouseFile(userId, parsedV1, 'report-v1.xlsx');
    await importClearinghouseFile(userId, parsedV2, 'report-v2.xlsx');

    const funds = await PensionFund.find({ user: userId, source: 'clearinghouse' }).lean();
    expect(funds).toHaveLength(1);
    expect(funds[0].fundName).toBe('קרן חדשה');
    expect(funds[0].sourceFile).toBe('report-v2.xlsx');

    const deposits = await PensionDeposit.find({ user: userId, source: 'clearinghouse' }).lean();
    expect(deposits).toHaveLength(1);
    expect(deposits[0].accountNumber).toBe('222');
    expect(deposits[0].sourceFile).toBe('report-v2.xlsx');
  });

  it('does not delete manual funds when clearinghouse is replaced', async () => {
    const { userId } = await harness.register();

    await PensionFund.create({
      user: userId,
      fundName: 'קרן ידנית',
      fundType: 'pension_comprehensive',
      source: 'manual',
      status: 'active',
      isActive: true,
    });

    await importClearinghouseFile(userId, parsedV1, 'first.xlsx');
    await importClearinghouseFile(userId, parsedV2, 'second.xlsx');

    const manual = await PensionFund.findOne({ user: userId, source: 'manual' });
    expect(manual).toBeTruthy();
    expect(manual.fundName).toBe('קרן ידנית');

    const clearinghouse = await PensionFund.find({ user: userId, source: 'clearinghouse' });
    expect(clearinghouse).toHaveLength(1);
  });

  it('clearClearinghouseData removes snapshots too', async () => {
    const { userId } = await harness.register();

    await importClearinghouseFile(userId, parsedV1, 'snap.xlsx');
    expect(await PensionImportSnapshot.countDocuments({ user: userId, source: 'clearinghouse' })).toBe(1);

    await clearClearinghouseData(userId);
    expect(await PensionImportSnapshot.countDocuments({ user: userId, source: 'clearinghouse' })).toBe(0);
  });
});
