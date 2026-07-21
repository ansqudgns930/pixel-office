import test from "node:test";
import assert from "node:assert/strict";
import { SQLiteStateStore } from "../packages/persistence/src/index.js";
import { ProjectOperations } from "../packages/project-ops/src/index.js";
import { CompanyOperations } from "../packages/company-ops/src/index.js";

function fixture() {
  const state = new SQLiteStateStore(":memory:");
  const projects = new ProjectOperations(state.db, state);
  const companies = new CompanyOperations(state.db, state, projects);
  projects.createWorkspace("w", "Workspace");
  projects.createProject({ id: "p", workspaceId: "w", name: "Delivery", repoPath: ".", defaultBranch: "main", runtimePath: ".", organizationProfile: {}, budgetLimit: 20 }, "owner");
  companies.createCompany({ id: "c", name: "Company", workspaceId: "w", budgetLimit: 30, mandatoryReviews: ["review"], mandatoryApprovals: ["result"], allowedTools: ["test"] }, "owner");
  companies.createDepartment({ id: "d", companyId: "c", parentId: null, name: "Product", budgetLimit: 20 }, "owner");
  companies.linkProject("c", "d", "p", 1, "owner");
  return { state, projects, companies };
}

test("company goal aggregates linked project hierarchy and protects completion evidence", () => {
  const { state, projects, companies } = fixture();
  projects.createMilestone({ id: "m", projectId: "p", title: "M1", status: "active", completionCriteria: ["released"], budgetLimit: 10, dueAt: null }, { id: "owner" });
  projects.createTask({ id: "t", projectId: "p", milestoneId: "m", title: "Ship", status: "ready", priority: 1, completionCriteria: ["checks pass"], budgetLimit: 5 }, { id: "owner" });
  const goal = companies.createGoal({ id: "g", companyId: "c", title: "Launch", description: "Deliver product", ownerId: "owner", completionCriteria: ["All work approved"], budgetLimit: 20, dueAt: null, status: "draft" }, "owner");
  assert.equal(goal.status, "draft");
  companies.linkGoalProject("c", "g", "p", "owner");
  assert.equal(companies.transitionGoal("c", "g", "active", "owner").status, "active");
  const snapshot = companies.goalSnapshot("c", "g", "owner") as any;
  assert.equal(snapshot.metrics.total, 1);
  assert.equal(snapshot.metrics.progress, 0);
  assert.equal(snapshot.projects[0].milestones[0].id, "m");
  assert.equal(snapshot.projects[0].tasks[0].id, "t");
  assert.throws(() => companies.transitionGoal("c", "g", "completed", "owner"), /evidence is incomplete/);
  state.close();
});

test("company goals reject invalid owners, empty criteria and projects outside the company", () => {
  const { state, projects, companies } = fixture();
  assert.throws(() => companies.createGoal({ id: "bad", companyId: "c", title: "Bad", description: "", ownerId: "outsider", completionCriteria: ["done"], budgetLimit: 1, dueAt: null }, "owner"), /company member/);
  assert.throws(() => companies.createGoal({ id: "bad2", companyId: "c", title: "Bad", description: "", ownerId: "owner", completionCriteria: [], budgetLimit: 1, dueAt: null }, "owner"), /criteria required/);
  projects.createWorkspace("w2", "Other");
  projects.createProject({ id: "outside", workspaceId: "w2", name: "Outside", repoPath: ".", defaultBranch: "main", runtimePath: ".", organizationProfile: {}, budgetLimit: 1 }, "owner");
  companies.createGoal({ id: "g", companyId: "c", title: "Goal", description: "", ownerId: "owner", completionCriteria: ["done"], budgetLimit: 1, dueAt: null }, "owner");
  assert.throws(() => companies.linkGoalProject("c", "g", "outside", "owner"), /belong to company/);
  state.close();
});

test("department manager can create and operate a company goal", () => {
  const { state, companies } = fixture();
  companies.addMember("c", "owner", "manager", "department-manager", "d", "human");
  const goal=companies.createGoal({ id: "managed", companyId: "c", title: "Managed goal", description: "", ownerId: "manager", completionCriteria: ["done"], budgetLimit: 5, dueAt: null }, "manager");
  assert.equal(goal.ownerId,"manager");
  companies.linkGoalProject("c","managed","p","manager");
  assert.equal(companies.transitionGoal("c","managed","active","manager").status,"active");
  state.close();
});
