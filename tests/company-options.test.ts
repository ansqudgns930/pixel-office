import test from "node:test";
import assert from "node:assert/strict";
import { hiddenCompanyCount, isGeneratedTestCompany, userFacingCompanyOptions } from "../apps/web/src/companyOptions.js";

test("company options hide generated QA/probe review companies but keep the selected company", () => {
  const companies = [
    { id: "real-company", name: "Real Company" },
    { id: "delegated-work-flow-qa-1", name: "Delegated Work Flow QA" },
    { id: "employee-workflow-qa-123", name: "Employee Workflow QA Company" },
    { id: "employee-api-probe-456", name: "Probe Company" },
    { id: "ui-ux-review-company", name: "UI UX Review Company" },
    { id: "test-company", name: "Test Company" },
  ];

  assert.equal(isGeneratedTestCompany(companies[0]!), false);
  assert.equal(companies.slice(1).every(isGeneratedTestCompany), true);
  assert.deepEqual(userFacingCompanyOptions(companies).map(company => company.id), ["real-company"]);
  assert.deepEqual(userFacingCompanyOptions(companies, "ui-ux-review-company").map(company => company.id), ["real-company", "ui-ux-review-company"]);
  assert.equal(hiddenCompanyCount(companies, "ui-ux-review-company"), 4);
});

