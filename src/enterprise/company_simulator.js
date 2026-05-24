class CompanySimulator {

    constructor() {
        this.employees = [];
        this.projects = [];
        this.finance = {
            revenue: 0,
            cost: 0,
            profit: 0
        };
        this.kpi = {};
    }

    addEmployee(emp) {
        this.employees.push({
            ...emp,
            performance: 50,
            status: "active"
        });
    }

    addProject(project) {
        this.projects.push({
            ...project,
            progress: 0,
            risk: "low",
            status: "running"
        });
    }

    updatePerformance() {

        for (let emp of this.employees) {
            emp.performance += (Math.random() - 0.5) * 5;
            emp.performance = Math.max(0, Math.min(100, emp.performance));
        }
    }

    simulateProjects() {

        for (let p of this.projects) {
            p.progress += Math.random() * 3;

            if (p.progress > 100) {
                p.status = "completed";
            }

            if (Math.random() < 0.05) {
                p.risk = "high";
            }
        }
    }

    calculateFinance() {

        this.finance.revenue += this.projects.length * 100;
        this.finance.cost += this.employees.length * 20;
        this.finance.profit = this.finance.revenue - this.finance.cost;
    }

    tick() {
        this.updatePerformance();
        this.simulateProjects();
        this.calculateFinance();
    }

    getState() {
        return {
            employees: this.employees,
            projects: this.projects,
            finance: this.finance
        };
    }
}

module.exports = new CompanySimulator();
