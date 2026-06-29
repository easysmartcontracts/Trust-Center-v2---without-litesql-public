export const COLORS = {
  finance: '#FFBB00',
  workflow: '#1F79C3',
  knowledge: '#BAB649',
  compliance: '#279989',
  payroll: '#4A8B4D',
  'year-end-reporting': '#BAB649',
};

export const SAAS_PRODUCTS = [
  { name: "BL Administration", slug: "bl-administration", category: "Knowledge", color: "#BAB649", status_url: "https://status.bjornlunden.se" },
  { name: "Lundify", slug: "lundify", category: "Knowledge", color: "#BAB649", status_url: "https://status.lundify.com" },
  { name: "Lundify Workflow", slug: "lundify-workflow", category: "Workflow", color: "#1F79C3", status_url: "https://status.lundify.com" },
  { name: "Lundify Compliance", slug: "lundify-compliance", category: "Compliance", color: "#279989", status_url: "https://status.lundify.com" },
  { name: "KING Finance", slug: "king-finance", category: "Finance", color: "#FFBB00", status_url: "https://status.kingfinance.com" },
  { name: "KING ERP", slug: "king-erp", category: "Finance", color: "#FFBB00", status_url: "https://status.kingfinance.com" },
  { name: "Qbis", slug: "qbis", category: "Payroll", color: "#4A8B4D", status_url: "https://status.qbis.se" },
  { name: "Eazyproject", slug: "eazyproject", category: "Year-end-reporting", color: "#BAB649", status_url: "https://status.eazyproject.net" }
];

export const COMPLIANCE_DOCUMENTS = [
  { name: "Security Whitepaper", slug: "security-whitepaper", type: "Security", requires_nda: false, products: ["king-finance","king-erp","lundify","bl-administration"] },
  { name: "Data Processing Agreement", slug: "dpa", type: "Privacy", requires_nda: false },
  { name: "DPIA – BL Platforms", slug: "dpia-bl", type: "Privacy", requires_nda: true, products: ["bl-administration","lundify"] },
  { name: "Pentest – Executive Summary", slug: "pentest-summary", type: "Pentest", requires_nda: true, products: ["king-finance","king-erp"] }
];

export const SUBPROCESSORS = [
  { name: "Amazon Web Services", slug: "aws", category: "Hosting", region: "EU / Sweden", purpose: "Infrastructure hosting and storage", products: ["king-finance","king-erp","lundify","bl-administration"] },
  { name: "SendGrid", slug: "sendgrid", category: "Email Services", region: "EU/US", purpose: "Transactional email delivery", products: ["lundify","bl-administration"] },
  { name: "Datadog", slug: "datadog", category: "Monitoring", region: "EU", purpose: "System monitoring and analytics", products: ["king-erp","king-finance"] }
];

export const POLICIES = [
  { name: "Information Security Policy", slug: "information-security-policy", category: "Security" },
  { name: "Incident Response Plan", slug: "incident-response-plan", category: "Security" },
  { name: "Business Continuity Policy", slug: "business-continuity-policy", category: "Continuity" },
  { name: "Privacy Policy", slug: "privacy-policy", category: "Privacy" }
];

export const PENTEST_REPORTS = [
  { name: "Pentest 2025 – Summary", slug: "pentest-2025-summary", provider: "External Security Partner", findings_status: "Closed", products: ["king-finance","king-erp"] },
  { name: "API Security Audit – Lundify", slug: "api-audit-lundify", provider: "External Security Partner", findings_status: "No Critical", products: ["lundify","lundify-workflow"] }
];

