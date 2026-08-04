/** CoreCare Platform 1.11.0 - secure Stripe Billing integration */
const VERSION = "1.11.0";
const SESSION_COOKIE = "corecare_session";
const SESSION_HOURS = 12;
// Cloudflare Workers Web Crypto rejects PBKDF2 iteration counts above 100,000.
// Keep this explicit so password creation, verification, and dummy checks cannot
// drift beyond the production runtime's supported ceiling.
const CLOUDFLARE_WORKERS_PBKDF2_MAX_ITERATIONS = 100000;
const PASSWORD_ITERATIONS = CLOUDFLARE_WORKERS_PBKDF2_MAX_ITERATIONS;
const LOGIN_WINDOW_MINUTES = 15;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_PASSWORD_LENGTH = 1024;
const MAX_JSON_BYTES = 3 * 1024 * 1024;
const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PLATFORM_SETTINGS_KEY = "owner_platform";
const STRIPE_WEBHOOK_PATH = "/api/billing/stripe/webhook";
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;
const STRIPE_API_ORIGIN = "https://api.stripe.com";
const DEFAULT_PLATFORM_SETTINGS = Object.freeze({
  defaultSupportDurationMinutes: 60,
  maximumSupportDurationMinutes: 240,
  warningErrorThreshold: 1,
  criticalErrorThreshold: 10,
  activeSupportWarningThreshold: 4,
  auditPageSize: 100,
  healthRetentionDays: 90,
  auditCheckpointHours: 24,
});

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health") return health(env);
      if (url.pathname === "/api/version") return json({ name: "CoreCare Platform", version: VERSION, release: "CoreCare Platform 1.11.0 - secure Stripe Billing integration" });
      if (["/auth/portal-login", "/api/auth/portal-login"].includes(url.pathname) && request.method === "POST") return portalLogin(request, env, "PLATFORM");
      if (url.pathname === STRIPE_WEBHOOK_PATH && request.method === "POST") return await stripeWebhook(request, env);
      if (url.pathname === "/api/platform/health-ingest" && request.method === "POST") return ingestPlatformHealth(request, env);
      if (url.pathname === "/api/platform/product-tickets" && request.method === "POST") return ingestProductTicket(request, env);
      if (url.pathname === "/api/platform/access/exchange" && request.method === "POST") return exchangePlatformAccess(request, env);
      if (url.pathname === "/api/platform/entitlements" && request.method === "GET") return resolveProductEntitlements(request, env);
      if (/^\/api\/platform\/organisations\/[^/]+\/products\/[^/]+\/entitlements$/.test(url.pathname) && request.method === "GET") return resolveProductEntitlements(request, env);
      if (url.pathname === "/api/platform/entitlements/acknowledge" && request.method === "POST") return acknowledgeProductEntitlements(request, env);
      if (url.pathname === "/api/auth/login" && request.method === "POST") return login(request, env);
      if (url.pathname === "/api/auth/logout" && request.method === "POST") return logout(request, env);
      if (url.pathname === "/api/auth/session" && request.method === "GET") return sessionInfo(request, env);

      if (url.pathname.startsWith("/api/")) {
        if (!env.DB) return databaseRequired();
        const session = await requireSession(request, env.DB);
        if (session instanceof Response) return session;
        const requestGuard = authenticatedRequestGuard(request, url, session);
        if (requestGuard) return requestGuard;

        if (url.pathname === "/api/auth/change-password" && request.method === "POST") return changePassword(request, env.DB, session);
        if (url.pathname === "/api/development/status") return developmentStatus(env, session);
        if (url.pathname === "/api/dashboard" && request.method === "GET") return dashboardSummary(env.DB, session);
        if (url.pathname === "/api/carer/dashboard" && request.method === "GET") return await permitted(env.DB, session, "visits.view", () => carerDashboard(env.DB, session));
        if (url.pathname === "/api/operations/board" && request.method === "GET") return requireManagementWorkspace(session) || operationsBoard(env.DB, session);
        if (url.pathname === "/api/rota" && request.method === "GET") return requireManagementWorkspace(session) || rotaBoard(env.DB, session, url);
        if (url.pathname === "/api/rota" && request.method === "POST") return requireManagementWorkspace(session) || createRotaVisit(request, env, session);
        if (url.pathname === "/api/rota/templates" && request.method === "GET") return listRotaTemplates(env.DB, session);
        if (url.pathname === "/api/rota/templates/visit" && request.method === "POST") return saveRotaVisitTemplate(request, env.DB, session);
        if (url.pathname === "/api/rota/templates/working-pattern" && request.method === "POST") return saveWorkingPattern(request, env.DB, session);
        if (url.pathname === "/api/rota/templates/exception" && request.method === "POST") return saveRotaException(request, env.DB, session);
        if (url.pathname === "/api/rota/templates/generate" && request.method === "POST") return generateRotaFromTemplates(request, env, session);
        const templateDeleteMatch=url.pathname.match(/^\/api\/rota\/templates\/(visit|working-pattern|exception)\/([^/]+)$/);
        if(templateDeleteMatch&&request.method === "DELETE") return deleteRotaTemplateItem(env.DB,session,templateDeleteMatch[1],decodeURIComponent(templateDeleteMatch[2]));
        if (url.pathname === "/api/routing/settings") {
          if (request.method === "GET") return getRoutingSettings(env, session);
          if (request.method === "PUT") return updateRoutingSettings(request, env, session);
        }
        if (url.pathname === "/api/routing/recalculate" && request.method === "POST") return recalculateRouting(request, env, session);
        const requirementMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/visit-requirements$/);
        if (requirementMatch && request.method === "GET") return listVisitRequirements(env.DB, session, decodeURIComponent(requirementMatch[1]));
        if (requirementMatch && request.method === "POST") return saveVisitRequirements(request, env.DB, session, decodeURIComponent(requirementMatch[1]));
        if (/^\/api\/rota\/[^/]+\/recurrence$/.test(url.pathname) && request.method === "POST") return manageVisitRecurrence(request, env.DB, session, url.pathname.split("/")[3]);
        if (/^\/api\/rota\/[^/]+$/.test(url.pathname) && request.method === "PATCH") return updateRotaVisit(request, env, session, url.pathname.split("/").pop());
        if (/^\/api\/rota\/[^/]+\/cancel$/.test(url.pathname) && request.method === "POST") return cancelRotaVisit(request, env.DB, session, url.pathname.split("/")[3]);
        if (url.pathname === "/api/visits/board" && request.method === "GET") return requireManagementWorkspace(session) || visitsBoard(env.DB, session);
        if (url.pathname === "/api/visits" && request.method === "POST") return requireManagementWorkspace(session) || createVisit(request, env.DB, session);
        if (url.pathname === "/api/visits/client-code" && request.method === "POST") return requireManagementWorkspace(session) || ensureClientVisitCode(request, env.DB, session);
        if (url.pathname === "/api/visits/sync" && request.method === "POST") return syncVisitEvents(request, env.DB, session);
        const visitRecordMatch = url.pathname.match(/^\/api\/visits\/([^/]+)\/care-record$/);
        if (visitRecordMatch && request.method === "GET") return getVisitCareRecord(env.DB, session, decodeURIComponent(visitRecordMatch[1]));
        if (visitRecordMatch && request.method === "POST") return saveVisitCareRecord(request, env.DB, session, decodeURIComponent(visitRecordMatch[1]));
        if (url.pathname === "/api/operations/tasks" && request.method === "POST") return createOperationsTask(request, env.DB, session);
        const operationsTaskMatch = url.pathname.match(/^\/api\/operations\/tasks\/([^/]+)\/(complete|escalate)$/);
        if (operationsTaskMatch && request.method === "POST") return updateOperationsTask(env.DB, session, decodeURIComponent(operationsTaskMatch[1]), operationsTaskMatch[2]);
        if (url.pathname === "/api/operations/incidents" && request.method === "POST") return createOperationsIncident(request, env.DB, session);
        const operationsIncidentMatch = url.pathname.match(/^\/api\/operations\/incidents\/([^/]+)\/review$/);
        if (operationsIncidentMatch && request.method === "POST") return reviewOperationsIncident(request, env.DB, session, decodeURIComponent(operationsIncidentMatch[1]));
        if (url.pathname === "/api/operations/handovers" && request.method === "POST") return createShiftHandover(request, env.DB, session);
        const handoverAckMatch = url.pathname.match(/^\/api\/operations\/handovers\/([^/]+)\/acknowledge$/);
        if (handoverAckMatch && request.method === "POST") return acknowledgeShiftHandover(env.DB, session, decodeURIComponent(handoverAckMatch[1]));
        if (url.pathname === "/api/care-plans" && request.method === "GET") return await permitted(env.DB, session, "care_plans.view", () => listAllCarePlans(env.DB, session, url));
        if (url.pathname === "/api/care-delivery/dashboard" && request.method === "GET") return await permitted(env.DB, session, "care_plans.view", () => careDeliveryDashboard(env.DB, session));
        if (url.pathname === "/api/medication" && request.method === "GET") return await permitted(env.DB, session, "medication.view", () => listMedication(env.DB, session, url));
        if (url.pathname === "/api/medication" && request.method === "POST") return await permitted(env.DB, session, "medication.manage", () => saveMedication(request, env.DB, session));
        const medicationAdminMatch = url.pathname.match(/^\/api\/medication\/([^/]+)\/administer$/);
        if (medicationAdminMatch && request.method === "POST") return await permitted(env.DB, session, "medication.manage", () => administerMedication(request, env.DB, session, decodeURIComponent(medicationAdminMatch[1])));
        if (url.pathname === "/api/medication/daily-mar" && request.method === "GET") return await permitted(env.DB, session, "medication.view", () => dailyMar(env.DB, session, url));
        const medicationStockMatch = url.pathname.match(/^\/api\/medication\/([^/]+)\/stock$/);
        if (medicationStockMatch && request.method === "POST") return await permitted(env.DB, session, "medication.manage", () => adjustMedicationStock(request, env.DB, session, decodeURIComponent(medicationStockMatch[1])));
        const medicationCorrectionMatch = url.pathname.match(/^\/api\/medication\/administrations\/([^/]+)\/correct$/);
        if (medicationCorrectionMatch && request.method === "POST") return await permitted(env.DB, session, "medication.manage", () => correctMedicationAdministration(request, env.DB, session, decodeURIComponent(medicationCorrectionMatch[1])));
        if (url.pathname === "/api/body-map" && request.method === "GET") return await permitted(env.DB, session, "clients.view", () => listBodyMap(env.DB, session, url));
        if (url.pathname === "/api/body-map" && request.method === "POST") return await permitted(env.DB, session, "care_plans.manage", () => createBodyMapRecord(request, env.DB, session));
        const bodyMapUpdateMatch = url.pathname.match(/^\/api\/body-map\/([^/]+)\/update$/);
        if (bodyMapUpdateMatch && request.method === "POST") return await permitted(env.DB, session, "care_plans.manage", () => updateBodyMapRecord(request, env.DB, session, decodeURIComponent(bodyMapUpdateMatch[1])));
        const carePlanActionMatch = url.pathname.match(/^\/api\/care-plans\/([^/]+)\/(approve|generate-visits)$/);
        if (carePlanActionMatch && request.method === "POST") return carePlanAction(request, env.DB, session, decodeURIComponent(carePlanActionMatch[1]), carePlanActionMatch[2]);
        const careAlertMatch = url.pathname.match(/^\/api\/care-delivery\/alerts\/([^/]+)\/acknowledge$/);
        if (careAlertMatch && request.method === "POST") return acknowledgeCareAlert(env.DB, session, decodeURIComponent(careAlertMatch[1]));
        if (url.pathname === "/api/platform/dashboard" && request.method === "GET") return platformDashboard(env.DB, session);
        if (url.pathname === "/api/platform/control-centre" && request.method === "GET") return platformControlCentre(env.DB, session);
        if (url.pathname === "/api/platform/support-tickets" && request.method === "POST") return createPlatformTicket(request, env.DB, session);
        const platformTicketMatch = url.pathname.match(/^\/api\/platform\/support-tickets\/([^/]+)$/);
        if (platformTicketMatch && request.method === "GET") return getPlatformTicket(env.DB, session, decodeURIComponent(platformTicketMatch[1]));
        if (platformTicketMatch && request.method === "PUT") return updatePlatformTicket(request, env.DB, session, decodeURIComponent(platformTicketMatch[1]));
        const platformTicketMessageMatch = url.pathname.match(/^\/api\/platform\/support-tickets\/([^/]+)\/messages$/);
        if (platformTicketMessageMatch && request.method === "POST") return addPlatformTicketMessage(request, env.DB, session, decodeURIComponent(platformTicketMessageMatch[1]));
        const platformTicketAttachmentMatch = url.pathname.match(/^\/api\/platform\/support-tickets\/([^/]+)\/attachments$/);
        if (platformTicketAttachmentMatch && request.method === "POST") return addPlatformTicketAttachment(request, env, session, decodeURIComponent(platformTicketAttachmentMatch[1]));
        const platformAttachmentGetMatch = url.pathname.match(/^\/api\/platform\/support-attachments\/([^/]+)$/);
        if (platformAttachmentGetMatch && request.method === "GET") return getPlatformTicketAttachment(env, session, decodeURIComponent(platformAttachmentGetMatch[1]));
        const platformAttachmentDeleteMatch = url.pathname.match(/^\/api\/platform\/ticket-attachments\/([^/]+)$/);
        if (platformAttachmentDeleteMatch && request.method === "DELETE") return deletePlatformTicketAttachment(env, session, decodeURIComponent(platformAttachmentDeleteMatch[1]));
        const platformTicketTimeMatch = url.pathname.match(/^\/api\/platform\/support-tickets\/([^/]+)\/time$/);
        if (platformTicketTimeMatch && request.method === "POST") return addPlatformTicketTime(request, env.DB, session, decodeURIComponent(platformTicketTimeMatch[1]));
        if (url.pathname === "/api/platform/support-sessions" && request.method === "POST") return createPlatformSupportSession(request, env, session);
        const platformSessionEndMatch = url.pathname.match(/^\/api\/platform\/support-sessions\/([^/]+)\/end$/);
        if (platformSessionEndMatch && request.method === "POST") return endPlatformSupportSession(env.DB, session, decodeURIComponent(platformSessionEndMatch[1]));
        const platformOrgOpsMatch = url.pathname.match(/^\/api\/platform\/products\/([^/]+)\/organisations\/([^/]+)\/operations$/);
        if (platformOrgOpsMatch && request.method === "GET") return platformOrganisationOperations(env, session, decodeURIComponent(platformOrgOpsMatch[1]), decodeURIComponent(platformOrgOpsMatch[2]));
        const platformOrgFeaturesMatch = url.pathname.match(/^\/api\/platform\/products\/([^/]+)\/organisations\/([^/]+)\/features$/);
        if (platformOrgFeaturesMatch && request.method === "GET") return getOrganisationFeatureEntitlements(env.DB, session, decodeURIComponent(platformOrgFeaturesMatch[1]), decodeURIComponent(platformOrgFeaturesMatch[2]));
        if (platformOrgFeaturesMatch && request.method === "PUT") return updateOrganisationFeatureEntitlements(request, env.DB, session, decodeURIComponent(platformOrgFeaturesMatch[1]), decodeURIComponent(platformOrgFeaturesMatch[2]));
        const platformProductOrganisationsMatch = url.pathname.match(/^\/api\/platform\/products\/([^/]+)\/organisations$/);
        if (platformProductOrganisationsMatch && request.method === "POST") return linkProductOrganisation(request, env, session, decodeURIComponent(platformProductOrganisationsMatch[1]));
        const platformProductFeaturesMatch = url.pathname.match(/^\/api\/platform\/products\/([^/]+)\/features$/);
        if (platformProductFeaturesMatch && request.method === "GET") return listPlatformProductFeatures(env.DB, session, decodeURIComponent(platformProductFeaturesMatch[1]));
        if (platformProductFeaturesMatch && request.method === "POST") return savePlatformProductFeature(request, env.DB, session, decodeURIComponent(platformProductFeaturesMatch[1]));
        if (url.pathname === "/api/platform/products" && request.method === "POST") return createPlatformProduct(request, env.DB, session);
        const platformProductMatch = url.pathname.match(/^\/api\/platform\/products\/([^/]+)$/);
        if (platformProductMatch && request.method === "PUT") return updatePlatformProduct(request, env.DB, session, decodeURIComponent(platformProductMatch[1]));
        if (url.pathname === "/api/platform/revenue" && request.method === "GET") return platformRevenue(env.DB, session);
        if (url.pathname === "/api/platform/billing" && request.method === "GET") return platformBillingStatus(request, env, session);
        if (url.pathname === "/api/platform/billing/catalogue" && request.method === "POST") return configureStripeCatalogue(env, session);
        if (url.pathname === "/api/platform/customer-success" && request.method === "GET") return platformCustomerSuccessNeutral(env.DB, session);
        if (url.pathname === "/api/platform/assistant" && request.method === "POST") return platformAssistant(request, env.DB, session);
        if (url.pathname === "/api/platform/assistant/history" && request.method === "GET") return platformAssistantHistory(env.DB, session);
        if (url.pathname === "/api/platform/notifications" && request.method === "GET") return listNotifications(env.DB, session, url);
        if (url.pathname === "/api/platform/notifications/mark-all-read" && request.method === "POST") return markAllNotificationsRead(env.DB, session);
        const notificationActionMatch = url.pathname.match(/^\/api\/platform\/notifications\/([^/]+)\/(read|acknowledge|archive)$/);
        if (notificationActionMatch && request.method === "POST") return updateNotificationState(env.DB, session, decodeURIComponent(notificationActionMatch[1]), notificationActionMatch[2]);
        if (url.pathname === "/api/platform/workflows" && request.method === "GET") return listWorkflows(env.DB, session, url);
        if (url.pathname === "/api/platform/workflows" && request.method === "POST") return createWorkflow(request, env.DB, session);
        if (url.pathname === "/api/platform/workflows/templates" && request.method === "GET") return listWorkflowTemplates(env.DB, session);
        if (url.pathname === "/api/platform/workflows/runs" && request.method === "GET") return listWorkflowRuns(env.DB, session, url);
        const workflowMatch = url.pathname.match(/^\/api\/platform\/workflows\/([^/]+)$/);
        if (workflowMatch && request.method === "PUT") return updateWorkflow(request, env.DB, session, decodeURIComponent(workflowMatch[1]));
        if (workflowMatch && request.method === "DELETE") return deleteWorkflow(env.DB, session, decodeURIComponent(workflowMatch[1]));
        const workflowRunMatch = url.pathname.match(/^\/api\/platform\/workflows\/([^/]+)\/run$/);
        if (workflowRunMatch && request.method === "POST") return runWorkflow(request, env.DB, session, decodeURIComponent(workflowRunMatch[1]));
        if (url.pathname === "/api/platform/search" && request.method === "GET") return platformSearch(env.DB, session, url);
        if (url.pathname === "/api/platform/audit" && request.method === "GET") return platformAudit(env.DB, session, url);
        if (url.pathname === "/api/platform/settings") {
          if (request.method === "GET") return getPlatformSettings(env.DB, session);
          if (request.method === "PUT") return updatePlatformSettings(request, env.DB, session);
        }
        if (url.pathname === "/api/platform/system-health" && request.method === "GET") return platformSystemHealth(env.DB, session);
        if (url.pathname === "/api/platform/plans") {
          if (request.method === "GET") return listSubscriptionPlans(env.DB, session);
          if (request.method === "POST") return saveSubscriptionPlan(request, env.DB, session);
        }
        if (url.pathname === "/api/platform/users") {
          if (request.method === "GET") return listPlatformUsers(env.DB, session);
          if (request.method === "POST") return createPlatformUser(request, env.DB, session);
        }
        const platformUserMatch = url.pathname.match(/^\/api\/platform\/users\/([^/]+)$/);
        if (platformUserMatch && request.method === "PUT") return updatePlatformUser(request, env.DB, session, decodeURIComponent(platformUserMatch[1]));
        const platformUserResetMatch = url.pathname.match(/^\/api\/platform\/users\/([^/]+)\/reset-password$/);
        if (platformUserResetMatch && request.method === "POST") return resetPlatformUserPassword(request, env.DB, session, decodeURIComponent(platformUserResetMatch[1]));
        const platformUserSessionsMatch = url.pathname.match(/^\/api\/platform\/users\/([^/]+)\/revoke-sessions$/);
        if (platformUserSessionsMatch && request.method === "POST") return revokePlatformUserSessions(env.DB, session, decodeURIComponent(platformUserSessionsMatch[1]));
        if (url.pathname === "/api/platform/organisations" && request.method === "GET") return listOrganisations(env.DB, session);
        if (url.pathname === "/api/platform/organisations" && request.method === "POST") return createOrganisation(request, env.DB, session);
        const organisationBillingMatch = url.pathname.match(/^\/api\/platform\/organisations\/([^/]+)\/billing\/(checkout|portal|sync)$/);
        if (organisationBillingMatch && request.method === "POST") {
          const organisationId=decodeURIComponent(organisationBillingMatch[1]),action=organisationBillingMatch[2];
          if(action==="checkout")return createStripeCheckout(request,env,session,organisationId);
          if(action==="portal")return createStripePortal(request,env,session,organisationId);
          return syncStripeSubscription(env,session,organisationId);
        }
        const orgMatch = url.pathname.match(/^\/api\/platform\/organisations\/([^/]+)$/);
        if (orgMatch && request.method === "GET") return getPlatformOrganisation(env.DB, session, decodeURIComponent(orgMatch[1]));
        if (orgMatch && request.method === "PUT") return updateOrganisationAdmin(request, env.DB, session, decodeURIComponent(orgMatch[1]));
        if (url.pathname === "/api/platform/switch-organisation" && request.method === "POST") return switchOrganisation(request, env.DB, session);
        if (url.pathname === "/api/platform/exit-support" && request.method === "POST") return exitSupportMode(env.DB, session);
        if (url.pathname === "/api/organisation/profile" && request.method === "GET") return getOrganisationProfile(env.DB, session);
        if (url.pathname === "/api/organisation/profile" && request.method === "PUT") return updateOrganisationProfile(request, env.DB, session);
        if (url.pathname === "/api/security/permissions" && request.method === "GET") return listPermissionCatalogue(env.DB, session);
        if (url.pathname === "/api/security/roles") {
          if (request.method === "GET") return listCustomRoles(env.DB, session);
          if (request.method === "POST") return createCustomRole(request, env.DB, session);
        }
        const securityRoleMatch = url.pathname.match(/^\/api\/security\/roles\/([^/]+)$/);
        if (securityRoleMatch) {
          const roleId = decodeURIComponent(securityRoleMatch[1]);
          if (request.method === "PUT") return updateCustomRole(request, env.DB, session, roleId);
          if (request.method === "DELETE") return deleteCustomRole(env.DB, session, roleId);
        }
        if (url.pathname === "/api/security/overview" && request.method === "GET") return securityOverview(env.DB, session);
        if (url.pathname === "/api/security/sessions" && request.method === "GET") return listActiveSessions(env.DB, session);
        const revokeSessionMatch = url.pathname.match(/^\/api\/security\/sessions\/([^/]+)$/);
        if (revokeSessionMatch && request.method === "DELETE") return revokeSession(env.DB, session, decodeURIComponent(revokeSessionMatch[1]));
        if (url.pathname === "/api/security/policy") {
          if (request.method === "GET") return getSecurityPolicy(env.DB, session);
          if (request.method === "PUT") return updateSecurityPolicy(request, env.DB, session);
        }
        if (url.pathname === "/api/security/login-history" && request.method === "GET") return listLoginHistory(env.DB, session);
        if (url.pathname === "/api/security/effective-access" && request.method === "GET") return effectiveAccess(env.DB, session, url);
        if (url.pathname === "/api/security/modules") {
          if (request.method === "GET") return listOrganisationModules(env.DB, session);
          if (request.method === "PUT") return updateOrganisationModules(request, env.DB, session);
        }
        const userPermissionMatch = url.pathname.match(/^\/api\/security\/users\/([^/]+)\/permissions$/);
        if (userPermissionMatch) {
          const targetUserId = decodeURIComponent(userPermissionMatch[1]);
          if (request.method === "GET") return getUserPermissionOverrides(env.DB, session, targetUserId);
          if (request.method === "PUT") return updateUserPermissionOverrides(request, env.DB, session, targetUserId);
        }
        if (url.pathname === "/api/security/emergency-mode" && request.method === "PUT") return updateEmergencyMode(request, env.DB, session);
        if (url.pathname === "/api/branches") {
          if (request.method === "GET") return listBranches(env.DB, session);
          if (request.method === "POST") return createBranch(request, env.DB, session);
        }
        const branchMatch = url.pathname.match(/^\/api\/branches\/([^/]+)$/);
        if (branchMatch && request.method === "PUT") return updateBranch(request, env.DB, session, decodeURIComponent(branchMatch[1]));
        if (url.pathname === "/api/family-access") {
          if (request.method === "GET") return listFamilyAccess(env.DB, session);
          if (request.method === "POST") return saveFamilyAccess(request, env.DB, session);
        }
        if (url.pathname === "/api/staff") {
          if (request.method === "GET") return await permitted(env.DB, session, "staff.view", () => listStaff(env.DB, session, url));
          if (request.method === "POST") return await permitted(env.DB, session, "staff.create", () => createStaff(request, env.DB, session));
          return methodNotAllowed(["GET", "POST"]);
        }
        const staffMatch = url.pathname.match(/^\/api\/staff\/([^/]+)$/);
        if (staffMatch) {
          const id = decodeURIComponent(staffMatch[1]);
          if (request.method === "PUT") return await permitted(env.DB, session, "staff.edit", () => updateStaff(request, env.DB, session, id));
          return methodNotAllowed(["PUT"]);
        }
        const clientCareMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/(care-plans|risks|documents)$/);
        if (clientCareMatch) {
          const clientId = decodeURIComponent(clientCareMatch[1]);
          const module = clientCareMatch[2];
          if (module === "care-plans") {
            if (request.method === "GET") return await permitted(env.DB, session, "care_plans.view", () => listCarePlans(env.DB, session, clientId));
            if (request.method === "POST") return await permitted(env.DB, session, "care_plans.create", () => createCarePlan(request, env.DB, session, clientId));
          }
          if (module === "risks") {
            if (request.method === "GET") return await permitted(env.DB, session, "risks.view", () => listRisks(env.DB, session, clientId));
            if (request.method === "POST") return await permitted(env.DB, session, "risks.manage", () => createRisk(request, env.DB, session, clientId));
          }
          if (module === "documents") {
            if (request.method === "GET") return await permitted(env.DB, session, "documents.view", () => listDocuments(env.DB, session, clientId));
            if (request.method === "POST") return await permitted(env.DB, session, "documents.manage", () => createDocument(request, env.DB, session, clientId));
          }
          return methodNotAllowed(["GET", "POST"]);
        }
        const carePlanMatch = url.pathname.match(/^\/api\/care-plans\/([^/]+)$/);
        if (carePlanMatch) {
          const id = decodeURIComponent(carePlanMatch[1]);
          if (request.method === "PUT") return await permitted(env.DB, session, "care_plans.edit", () => updateCarePlan(request, env.DB, session, id));
          if (request.method === "DELETE") return await permitted(env.DB, session, "care_plans.archive", () => archiveCarePlan(env.DB, session, id));
          return methodNotAllowed(["PUT", "DELETE"]);
        }
        const riskMatch = url.pathname.match(/^\/api\/risks\/([^/]+)$/);
        if (riskMatch) {
          const id = decodeURIComponent(riskMatch[1]);
          if (request.method === "PUT") return await permitted(env.DB, session, "risks.manage", () => updateRisk(request, env.DB, session, id));
          return methodNotAllowed(["PUT"]);
        }
        const documentMatch = url.pathname.match(/^\/api\/documents\/([^/]+)$/);
        if (documentMatch) {
          const id = decodeURIComponent(documentMatch[1]);
          if (request.method === "DELETE") return await permitted(env.DB, session, "documents.manage", () => archiveDocument(env.DB, session, id));
          return methodNotAllowed(["DELETE"]);
        }
        if (url.pathname === "/api/clients") {
          if (request.method === "GET") return await permitted(env.DB, session, "clients.view", () => listClients(env.DB, session, url));
          if (request.method === "POST") return await permitted(env.DB, session, "clients.create", () => createClient(request, env.DB, session));
          return methodNotAllowed(["GET", "POST"]);
        }
        const clientMatch = url.pathname.match(/^\/api\/clients\/([^/]+)$/);
        if (clientMatch) {
          const id = decodeURIComponent(clientMatch[1]);
          if (request.method === "GET") return await permitted(env.DB, session, "clients.view", () => getClient(env.DB, session, id));
          if (request.method === "PUT") return await permitted(env.DB, session, "clients.edit", () => updateClient(request, env.DB, session, id));
          if (request.method === "DELETE") return await permitted(env.DB, session, "clients.archive", () => archiveClient(env.DB, session, id));
          return methodNotAllowed(["GET", "PUT", "DELETE"]);
        }
        if (url.pathname === "/api/users") {
          if (request.method === "GET") return listUsers(env.DB, session);
          if (request.method === "POST") return createUser(request, env.DB, session);
          return methodNotAllowed(["GET", "POST"]);
        }
        const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
        if (userMatch && request.method === "PUT") return updateUser(request, env.DB, session, decodeURIComponent(userMatch[1]));
        if (url.pathname === "/api/audit" && request.method === "GET") return listAudit(env.DB, session, url);
        if (url.pathname === "/api/organisation" && request.method === "PUT") return updateOrganisation(request, env.DB, session);
        return json({ error: { code: "API_ROUTE_NOT_FOUND", message: "The requested API route does not exist." } }, 404);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, error.status);
      const databaseMessage=String(error?.message||error);
      if(databaseMessage.includes('SUBSCRIPTION_USER_LIMIT'))return json({error:{code:'SUBSCRIPTION_LIMIT_REACHED',message:'This organisation has reached its active-user allowance. Disable a user or upgrade it to Unlimited.'}},409);
      if(databaseMessage.includes('SUBSCRIPTION_CLIENT_LIMIT'))return json({error:{code:'SUBSCRIPTION_LIMIT_REACHED',message:'This organisation has reached its active-client allowance. Archive a client or upgrade it to Unlimited.'}},409);
      console.error(JSON.stringify({ message: "CoreCare request failed", error: clean(error?.message || error), path: url.pathname, method: request.method }));
      return json({ error: { code: "INTERNAL_ERROR", message: "CoreCare could not complete the request." } }, 500);
    }
  },
  async scheduled(_event, env, context) {
    context.waitUntil(runPlatformMaintenance(env));
  }
};

function health(env) {
  return json({ ok: true, service: "corecare", version: VERSION, database: Boolean(env.DB), authentication: Boolean(env.DB), timestamp: new Date().toISOString() });
}

function portalOriginAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.origin === "https://www.corecaresystems.co.uk" || url.origin === "https://corecaresystems.co.uk" || (["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:");
  } catch { return false; }
}

function portalReturnPath(value) {
  const path = String(value || "/").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

async function portalLogin(request, env, productCode) {
  if (!portalOriginAllowed(request)) return json({ error: { code: "INVALID_ORIGIN", message: "This sign-in request was not sent by CoreCare Systems." } }, 403);
  if (Number(request.headers.get("content-length") || 0) > 16_384) return json({ error: { code: "REQUEST_TOO_LARGE", message: "This sign-in request is too large." } }, 413);
  let form;
  try { form = await request.formData(); } catch { return json({ error: { code: "VALIDATION_ERROR", message: "Enter an email address and password." } }, 400); }
  const email = clean(form.get("email")).toLowerCase().slice(0, 240);
  const password = String(form.get("password") || "");
  const failure = () => new Response(null, { status: 303, headers: { location: `https://www.corecaresystems.co.uk/login?product=${productCode}&error=invalid_credentials`, "cache-control": "no-store" } });
  if (!email || !password || password.length > MAX_PASSWORD_LENGTH) return failure();
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  headers.set("accept", "application/json");
  const result = await login(new Request(request.url, { method: "POST", headers, body: JSON.stringify({ email, password }) }), env);
  if (!result.ok) return failure();
  const cookie = result.headers.get("set-cookie");
  if (!cookie) return json({ error: { code: "SESSION_NOT_CREATED", message: "CoreCare could not create a sign-in session." } }, 502);
  return new Response(null, { status: 303, headers: { location: portalReturnPath(form.get("returnTo")), "set-cookie": cookie.replace(/SameSite=Strict/i, "SameSite=Lax"), "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}

async function login(request, env) {
  if (!env.DB) return databaseRequired("Authentication requires the D1 database binding named DB.");
  const input = await readJson(request);
  const email = clean(input.email).toLowerCase();
  const password = String(input.password || "");
  if (!email || !password) return json({ error: { code: "VALIDATION_ERROR", message: "Enter an email address and password." } }, 400);
  if (password.length > MAX_PASSWORD_LENGTH) return json({ error: { code: "INVALID_CREDENTIALS", message: "The email address or password is incorrect." } }, 401);

  const ip = clean(request.headers.get("cf-connecting-ip")).slice(0, 64) || "unknown";
  const attemptKey = await sha256Base64(`${email}|${ip}`);
  const ipAttemptKey = await sha256Base64(`ip|${ip}`);
  const [attempt, ipAttempt] = await Promise.all([
    env.DB.prepare("SELECT attempt_count,window_started_at,locked_until FROM login_attempts WHERE attempt_key=?").bind(attemptKey).first(),
    env.DB.prepare("SELECT attempt_count,window_started_at,locked_until FROM login_attempts WHERE attempt_key=?").bind(ipAttemptKey).first(),
  ]);
  if ([attempt, ipAttempt].some(item => item?.locked_until && new Date(item.locked_until) > new Date())) {
    return json({ error: { code: "ACCOUNT_TEMPORARILY_LOCKED", message: "Too many unsuccessful attempts. Try again in 15 minutes." } }, 429, { "retry-after": String(LOGIN_WINDOW_MINUTES * 60) });
  }

  const user = await env.DB.prepare(`SELECT u.id,u.organisation_id,u.email,u.display_name,u.role,u.access_level,u.is_platform_user,u.home_branch_id,u.status,u.password_hash,u.password_salt,u.password_iterations,u.must_change_password,
    o.name AS organisation_name,o.status AS organisation_status,COALESCE(osp.session_hours,?) AS policy_session_hours
    FROM users u JOIN organisations o ON o.id=u.organisation_id LEFT JOIN organisation_security_policies osp ON osp.organisation_id=o.id
    WHERE lower(u.email)=lower(?) LIMIT 1`).bind(SESSION_HOURS,email).first();
  const credentialsMatch = user?.password_hash && user?.password_salt
    ? await verifyPassword(password, user.password_salt, user.password_hash, user.password_iterations || PASSWORD_ITERATIONS)
    : await dummyPasswordCheck(password);
  const valid = Boolean(user && user.status === "active" && (user.organisation_status === "active" || user.is_platform_user) && credentialsMatch);
  if (!valid) {
    await Promise.all([
      recordFailedLogin(env.DB, attemptKey, email, ip, attempt),
      recordFailedLogin(env.DB, ipAttemptKey, email, ip, ipAttempt),
    ]);
    if (user?.id && user?.organisation_id) {
      await env.DB.prepare("INSERT INTO login_history(id,organisation_id,user_id,outcome,reason,ip_hint,user_agent) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(),user.organisation_id,user.id,"failed","Invalid credentials",ip,clean(request.headers.get("user-agent")).slice(0,250)).run();
    }
    return json({ error: { code: "INVALID_CREDENTIALS", message: "The email address or password is incorrect." } }, 401);
  }

  const token = randomToken();
  const tokenHash = await sha256Base64(token);
  const sessionHours = Math.max(1, Math.min(168, Number(user.policy_session_hours) || SESSION_HOURS));
  const expires = new Date(Date.now() + sessionHours * 3600000);
  const statements = [
    env.DB.prepare("DELETE FROM login_attempts WHERE attempt_key IN (?,?)").bind(attemptKey,ipAttemptKey),
    env.DB.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
    env.DB.prepare("INSERT INTO sessions (id,user_id,organisation_id,active_branch_id,token_hash,expires_at,user_agent,ip_hint) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), user.id, user.organisation_id, user.home_branch_id, tokenHash, expires.toISOString(), clean(request.headers.get("user-agent")).slice(0, 250), ip),
    env.DB.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id),
    env.DB.prepare("INSERT INTO login_history(id,organisation_id,user_id,outcome,reason,ip_hint,user_agent) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),user.organisation_id,user.id,"success","Password sign-in",ip,clean(request.headers.get("user-agent")).slice(0,250)),
    auditStatement(env.DB, user.organisation_id, user.id, "user.login", "user", user.id, { email: user.email })
  ];
  if (Number(user.password_iterations || 0) < PASSWORD_ITERATIONS) {
    const upgraded = await hashPassword(password);
    statements.push(env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,password_changed_at=COALESCE(password_changed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(upgraded.hash,upgraded.salt,PASSWORD_ITERATIONS,user.id));
  }
  await env.DB.batch(statements);
  return json({ user: publicUser(user), expiresAt: expires.toISOString() }, 200, { "set-cookie": sessionCookie(token, expires) });
}

async function recordFailedLogin(db, key, email, ip, attempt) {
  const now = Date.now();
  const windowStart = attempt?.window_started_at ? new Date(attempt.window_started_at).getTime() : 0;
  const within = now - windowStart < LOGIN_WINDOW_MINUTES * 60000;
  const count = within ? (attempt?.attempt_count || 0) + 1 : 1;
  const lock = count >= MAX_LOGIN_ATTEMPTS ? new Date(now + LOGIN_WINDOW_MINUTES * 60000).toISOString() : null;
  await db.prepare(`INSERT INTO login_attempts (attempt_key,email,ip_hint,attempt_count,window_started_at,locked_until,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(attempt_key) DO UPDATE SET email=excluded.email,ip_hint=excluded.ip_hint,attempt_count=excluded.attempt_count,window_started_at=excluded.window_started_at,locked_until=excluded.locked_until,updated_at=CURRENT_TIMESTAMP`).bind(key, email, ip, count, within ? attempt.window_started_at : new Date(now).toISOString(), lock).run();
}

async function logout(request, env) {
  if (env.DB) {
    const token = cookieValue(request, SESSION_COOKIE);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256Base64(token)).run();
  }
  return json({ ok: true }, 200, { "set-cookie": expiredSessionCookie() });
}

async function sessionInfo(request, env) {
  if (!env.DB) return databaseRequired();
  const session = await requireSession(request, env.DB);
  if (session instanceof Response) return session;
  const access = await buildAccessProfile(env.DB, session);
  return json({ user: {...publicUser(session), permissions: access.permissions, modules: access.modules}, expiresAt: session.expires_at });
}

async function requireSession(request, db) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return unauthorised();
  const row = await db.prepare(`SELECT s.id AS session_id,s.created_at,s.last_seen_at,s.expires_at,s.user_id,s.organisation_id,s.active_branch_id,s.support_mode,s.support_origin_organisation_id,s.support_started_at,
    (SELECT ss.reason FROM support_sessions ss WHERE ss.session_id=s.id AND ss.ended_at IS NULL ORDER BY ss.started_at DESC LIMIT 1) AS support_reason,
    (SELECT ss.access_mode FROM support_sessions ss WHERE ss.session_id=s.id AND ss.ended_at IS NULL ORDER BY ss.started_at DESC LIMIT 1) AS support_access_mode,
    u.email,u.display_name,u.role,u.access_level,u.is_platform_user,u.home_branch_id,u.staff_id,u.status,u.must_change_password,
    o.name AS organisation_name,o.status AS organisation_status,b.name AS branch_name,COALESCE(osp.idle_timeout_minutes,60) AS idle_timeout_minutes,COALESCE(osp.emergency_mode,0) AS emergency_mode
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN organisations o ON o.id=s.organisation_id LEFT JOIN branches b ON b.id=s.active_branch_id
    LEFT JOIN organisation_security_policies osp ON osp.organisation_id=s.organisation_id
    WHERE s.token_hash=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP LIMIT 1`).bind(await sha256Base64(token)).first();
  if (!row || row.status !== "active" || (row.organisation_status !== "active" && !row.is_platform_user)) return unauthorised();
  const idleMinutes = Math.max(5, Math.min(1440, Number(row.idle_timeout_minutes) || 60));
  const lastSeen = databaseTimestamp(row.last_seen_at || row.created_at);
  if (!lastSeen || Date.now() - lastSeen.getTime() > idleMinutes * 60000) {
    await db.prepare("DELETE FROM sessions WHERE id=?").bind(row.session_id).run();
    return unauthorised("Your session expired after a period of inactivity.", "SESSION_IDLE_TIMEOUT");
  }
  if (!lastSeen || Date.now() - lastSeen.getTime() >= 5 * 60000) {
    await db.prepare("UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.session_id).run();
  }
  return row;
}

function authenticatedRequestGuard(request,url,session){
  const unsafe=!SAFE_HTTP_METHODS.has(request.method.toUpperCase());
  if(unsafe&&request.headers.get("origin")!==url.origin)return json({error:{code:"INVALID_REQUEST_ORIGIN",message:"This request did not originate from CoreCare Platform."}},403);
  if(session.must_change_password&&url.pathname!=="/api/auth/change-password")return json({error:{code:"PASSWORD_CHANGE_REQUIRED",message:"Change your temporary password before continuing."}},428);
  const supportExit=url.pathname==="/api/platform/exit-support";
  if(unsafe&&session.support_mode&&clean(session.support_access_mode)!=="full"&&!supportExit&&url.pathname!=="/api/auth/change-password"){
    return json({error:{code:"READ_ONLY_SUPPORT_SESSION",message:"This Support Mode session is read only. Start an authorised full-support session to make changes."}},403);
  }
  const emergencyAllowed=supportExit||url.pathname==="/api/security/emergency-mode"||url.pathname==="/api/auth/change-password";
  if(unsafe&&session.emergency_mode&&!emergencyAllowed)return json({error:{code:"EMERGENCY_MODE_ACTIVE",message:"High-risk changes are frozen while emergency mode is active."}},423);
  return null;
}

async function changePassword(request, db, session) {
  const input = await readJson(request);
  const current = String(input.currentPassword || "");
  const next = String(input.newPassword || "");
  if (next.length < 12 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
    return json({ error: { code: "WEAK_PASSWORD", message: "Use at least 12 characters with upper-case, lower-case and a number." } }, 400);
  }
  const user = await db.prepare("SELECT password_hash,password_salt,password_iterations FROM users WHERE id=?").bind(session.user_id).first();
  if (!user || !await verifyPassword(current, user.password_salt, user.password_hash, user.password_iterations || PASSWORD_ITERATIONS)) {
    return json({ error: { code: "CURRENT_PASSWORD_INCORRECT", message: "The current password is incorrect." } }, 400);
  }
  const secured = await hashPassword(next);
  await db.batch([
    db.prepare("UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=0,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(secured.hash, secured.salt, PASSWORD_ITERATIONS, session.user_id),
    db.prepare("DELETE FROM sessions WHERE user_id=? AND id<>?").bind(session.user_id, session.session_id),
    auditStatement(db, session.organisation_id, session.user_id, "user.password_changed", "user", session.user_id, {})
  ]);
  return json({ ok: true });
}

function branchRestricted(session){ return !session.is_platform_user && ["branch_manager","senior_carer","carer","office_staff"].includes(session.access_level) && Boolean(session.active_branch_id || session.home_branch_id); }
function activeBranch(session){ return session.active_branch_id || session.home_branch_id || null; }
const CLIENT_COLUMNS = `id,first_name,last_name,preferred_name,date_of_birth,nhs_number,address_line_1,address_line_2,town,postcode,phone,email,care_package,next_review,status,risk,gp_name,gp_practice,gp_phone,next_of_kin_name,next_of_kin_relationship,next_of_kin_phone,emergency_contact_name,emergency_contact_phone,allergies,communication_needs,capacity_notes,important_notes,archived_at,created_at,updated_at`;

async function listClients(db, session, url) {
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const sql = `SELECT ${CLIENT_COLUMNS} FROM clients WHERE organisation_id=? ${branchRestricted(session) ? "AND branch_id=?" : ""} ${includeArchived ? "" : "AND status<>'Archived'"} ORDER BY last_name COLLATE NOCASE,first_name COLLATE NOCASE`;
  const result = await db.prepare(sql).bind(session.organisation_id,...(branchRestricted(session)?[activeBranch(session)]:[])).all();
  return json({ clients: result.results.map(toClient) });
}

async function getClient(db, session, id) {
  const row = await db.prepare(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE id=? AND organisation_id=? ${branchRestricted(session)?"AND branch_id=?":""} LIMIT 1`).bind(id, session.organisation_id,...(branchRestricted(session)?[activeBranch(session)]:[])).first();
  if (!row) return json({ error: { code: "CLIENT_NOT_FOUND", message: "Client record not found." } }, 404);
  return json({ client: toClient(row) });
}

async function createClient(request, db, session) {
  if (!hasRole(session, ["owner", "manager", "carer"])) return forbidden();
  const raw = await readJson(request);
  const input = normaliseClient(raw);
  const validation = validateClient(input);
  if (validation) return json({ error: { code: "VALIDATION_ERROR", message: validation } }, 400);
  if (input.status !== "Archived") {
    const limit = await enforceOrganisationSubscriptionLimit(db, session.organisation_id, "clients");
    if (limit) return limit;
  }
  const id = crypto.randomUUID();
  const fields = clientFields(input);
  const requirements = normaliseVisitRequirements(raw.visitRequirements, raw.visitStartDate);
  const statements = [
    db.prepare(`INSERT INTO clients (id,organisation_id,branch_id,${fields.names.join(",")}) VALUES (?, ?, ?, ${fields.names.map(() => "?").join(",")})`).bind(id, session.organisation_id, activeBranch(session), ...fields.values),
    db.prepare(`INSERT INTO client_visit_codes(id,organisation_id,client_id,code,active,created_by) VALUES(?,?,?,?,1,?)`).bind(crypto.randomUUID(),session.organisation_id,id,'CC-'+crypto.randomUUID().replaceAll('-','').slice(0,20).toUpperCase(),session.user_id),
    auditStatement(db, session.organisation_id, session.user_id, "client.created", "client", id, { name: `${input.firstName} ${input.lastName}` })
  ];
  statements.push(...clientOnboardingStatements(db, session, id, input));
  for (const requirement of requirements) statements.push(...visitRequirementStatements(db, session, id, requirement));
  await db.batch(statements);
  return json({ client: { ...input, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, requirementsCreated: requirements.length, visitsGenerated: requirements.reduce((n,r)=>n+generatedOccurrenceCount(r),0) }, 201);
}


function normaliseVisitRequirements(value, fallbackStartDate) {
  if (!Array.isArray(value)) return [];
  const fallback = clean(fallbackStartDate) || new Date().toISOString().slice(0,10);
  return value.map(item => ({
    visitType: clean(item.visitType) || 'Personal care',
    days: Array.isArray(item.days) ? item.days.map(Number).filter(n => n >= 0 && n <= 6) : [1,2,3,4,5,6,0],
    preferredTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(clean(item.preferredTime)) ? clean(item.preferredTime) : '08:00',
    windowMinutes: Math.max(0, Math.min(240, Number(item.windowMinutes) || 60)),
    schedulingRule: ['flexible','window','fixed'].includes(clean(item.schedulingRule)) ? clean(item.schedulingRule) : ((Number(item.windowMinutes)||60)===0?'fixed':'flexible'),
    timeCriticalReason: clean(item.timeCriticalReason),
    durationMinutes: Math.max(15, Math.min(480, Number(item.durationMinutes) || 30)),
    carersRequired: Math.max(1, Math.min(4, Number(item.carersRequired) || 1)),
    notes: clean(item.notes),
    startDate: clean(item.startDate) || fallback,
    endDate: clean(item.endDate) || null
  })).filter(r => r.days.length);
}
function generatedDates(requirement, weeks=8) {
  const dates=[]; const start=new Date(`${requirement.startDate}T12:00:00`); const endLimit=requirement.endDate?new Date(`${requirement.endDate}T23:59:59`):new Date(start.getTime()+weeks*7*86400000);
  for(let d=new Date(start);d<=endLimit;d.setDate(d.getDate()+1)){if(requirement.days.includes(d.getDay()))dates.push(new Date(d));}
  return dates;
}
function generatedOccurrenceCount(requirement){return generatedDates(requirement).length;}
function visitRequirementStatements(db, session, clientId, requirement) {
  const requirementId=crypto.randomUUID();
  const statements=[db.prepare(`INSERT INTO client_visit_requirements(id,organisation_id,client_id,visit_type,days_json,preferred_time,window_minutes,duration_minutes,carers_required,notes,start_date,end_date,created_by,scheduling_rule,time_critical_reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(requirementId,session.organisation_id,clientId,requirement.visitType,JSON.stringify(requirement.days),requirement.preferredTime,requirement.windowMinutes,requirement.durationMinutes,requirement.carersRequired,requirement.notes,requirement.startDate,requirement.endDate,session.user_id,requirement.schedulingRule,requirement.timeCriticalReason)];
  for(const date of generatedDates(requirement)){
    const day=date.toISOString().slice(0,10), start=new Date(`${day}T${requirement.preferredTime}:00`), end=new Date(start.getTime()+requirement.durationMinutes*60000);
    statements.push(db.prepare(`INSERT OR IGNORE INTO care_visits(id,organisation_id,client_id,staff_id,visit_type,scheduled_start,scheduled_end,status,rota_source,rota_status,recurrence_group_id,recurrence_pattern,requirement_id,requirement_occurrence_date,created_by,protected_time_rule,protected_time_reason,protected_window_minutes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,clientId,null,requirement.visitType,start.toISOString(),end.toISOString(),'scheduled','requirement','draft',requirementId,'requirement',requirementId,day,session.user_id,requirement.schedulingRule,requirement.timeCriticalReason,requirement.windowMinutes));
  }
  return statements;
}
function clientOnboardingStatements(db,session,clientId,input){
  const due=new Date(Date.now()+3*86400000).toISOString();
  const items=[['assessment','Complete initial assessment','critical'],['care_plan','Complete and approve care plan','critical'],['risk_assessment','Complete risk assessments','critical'],['medication','Complete medication assessment','warning'],['consent','Record consent and key documents','warning'],['funding','Confirm funding and invoicing details','warning'],['visit_requirements','Review visit requirements','warning']];
  const clientName=`${input.firstName} ${input.lastName}`;
  const st=[];
  for(const [key,title,severity] of items){
    st.push(db.prepare(`INSERT INTO client_onboarding_items(id,organisation_id,client_id,item_key,title,severity,due_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,clientId,key,title,severity,due));
    st.push(db.prepare(`INSERT INTO operations_tasks(id,organisation_id,branch_id,client_id,title,description,category,priority,status,due_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,activeBranch(session),clientId,`${title}: ${clientName}`,'Automatically created during client onboarding.','Onboarding',severity==='critical'?'high':'normal','open',due,session.user_id));
  }
  st.push(db.prepare(`INSERT INTO notifications(id,organisation_id,category,priority,title,message,source,source_id,action_url) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,'care','warning',`New client onboarding: ${clientName}`,'Visit requirements have been sent to the allocation queue. Complete the assessment, care plan and risk assessments before publishing care.','client_onboarding',clientId,'#clients'));
  return st;
}
async function listVisitRequirements(db,session,clientId){
  const rows=await db.prepare(`SELECT * FROM client_visit_requirements WHERE organisation_id=? AND client_id=? AND status='active' ORDER BY preferred_time`).bind(session.organisation_id,clientId).all();
  return json({requirements:(rows.results||[]).map(r=>({...r,days:JSON.parse(r.days_json||'[]')}))});
}
async function saveVisitRequirements(request,db,session,clientId){
  if(!hasRole(session,['owner','manager','carer']))return forbidden();
  const input=await readJson(request),requirements=normaliseVisitRequirements(input.requirements,input.startDate);
  if(!requirements.length)return json({error:{code:'VALIDATION_ERROR',message:'Add at least one valid visit requirement.'}},400);
  const client=await db.prepare('SELECT id FROM clients WHERE id=? AND organisation_id=?').bind(clientId,session.organisation_id).first();if(!client)return notFound('Client');
  const statements=[];
  for(const r of requirements)statements.push(...visitRequirementStatements(db,session,clientId,r));
  statements.push(auditStatement(db,session.organisation_id,session.user_id,'client.visit_requirements_created','client',clientId,{count:requirements.length}));
  await db.batch(statements);return json({ok:true,requirementsCreated:requirements.length,visitsGenerated:requirements.reduce((n,r)=>n+generatedOccurrenceCount(r),0)});
}

async function updateClient(request, db, session, id) {
  if (!hasRole(session, ["owner", "manager", "carer"])) return forbidden();
  const raw = await readJson(request);
  const input = normaliseClient(raw);
  const validation = validateClient(input);
  if (validation) return json({ error: { code: "VALIDATION_ERROR", message: validation } }, 400);
  const fields = clientFields(input);
  const assignments = fields.names.map(name => `${name}=?`).join(",");
  const existing = await db.prepare(`SELECT id,status FROM clients WHERE id=? AND organisation_id=? LIMIT 1`).bind(id,session.organisation_id).first();
  if (!existing) return json({ error: { code: "CLIENT_NOT_FOUND", message: "Client record not found." } }, 404);
  if (existing.status === "Archived" && input.status !== "Archived") {
    const limit = await enforceOrganisationSubscriptionLimit(db, session.organisation_id, "clients");
    if (limit) return limit;
  }
  const statements=[db.prepare(`UPDATE clients SET ${assignments},archived_at=CASE WHEN ?='Archived' THEN COALESCE(archived_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(...fields.values,input.status,id,session.organisation_id)];
  let requirementsCreated=0,visitsGenerated=0;
  if(Array.isArray(raw.visitRequirements)){
    const requirements=normaliseVisitRequirements(raw.visitRequirements,raw.visitStartDate);
    statements.push(db.prepare(`DELETE FROM care_visits WHERE organisation_id=? AND client_id=? AND requirement_id IS NOT NULL AND status='scheduled' AND staff_id IS NULL AND datetime(scheduled_start)>=datetime('now')`).bind(session.organisation_id,id));
    statements.push(db.prepare(`UPDATE client_visit_requirements SET status='replaced',updated_at=CURRENT_TIMESTAMP WHERE organisation_id=? AND client_id=? AND status='active'`).bind(session.organisation_id,id));
    for(const requirement of requirements)statements.push(...visitRequirementStatements(db,session,id,requirement));
    requirementsCreated=requirements.length;
    visitsGenerated=requirements.reduce((n,r)=>n+generatedOccurrenceCount(r),0);
    statements.push(auditStatement(db,session.organisation_id,session.user_id,'client.visit_requirements_replaced','client',id,{count:requirementsCreated,visitsGenerated}));
  }
  statements.push(auditStatement(db,session.organisation_id,session.user_id,"client.updated","client",id,{name:`${input.firstName} ${input.lastName}`}));
  await db.batch(statements);
  const response=await db.prepare(`SELECT ${CLIENT_COLUMNS} FROM clients WHERE id=? AND organisation_id=? LIMIT 1`).bind(id,session.organisation_id).first();
  return json({client:toClient(response),requirementsCreated,visitsGenerated});
}

async function archiveClient(db, session, id) {
  if (!hasRole(session, ["owner", "manager"])) return forbidden();
  const existing = await db.prepare("SELECT first_name,last_name FROM clients WHERE id=? AND organisation_id=?").bind(id, session.organisation_id).first();
  if (!existing) return json({ error: { code: "CLIENT_NOT_FOUND", message: "Client record not found." } }, 404);
  await db.batch([
    db.prepare("UPDATE clients SET status='Archived',archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?").bind(id, session.organisation_id),
    auditStatement(db, session.organisation_id, session.user_id, "client.archived", "client", id, { name: `${existing.first_name} ${existing.last_name}` })
  ]);
  return json({ ok: true });
}

function clientFields(input) {
  const mapping = {
    first_name: input.firstName, last_name: input.lastName, preferred_name: input.preferredName,
    date_of_birth: input.dateOfBirth, nhs_number: input.nhsNumber, address_line_1: input.addressLine1,
    address_line_2: input.addressLine2, town: input.town, postcode: input.postcode, phone: input.phone,
    email: input.email, care_package: input.carePackage, next_review: input.nextReview, status: input.status,
    risk: input.risk, gp_name: input.gpName, gp_practice: input.gpPractice, gp_phone: input.gpPhone,
    next_of_kin_name: input.nextOfKinName, next_of_kin_relationship: input.nextOfKinRelationship,
    next_of_kin_phone: input.nextOfKinPhone, emergency_contact_name: input.emergencyContactName,
    emergency_contact_phone: input.emergencyContactPhone, allergies: input.allergies,
    communication_needs: input.communicationNeeds, capacity_notes: input.capacityNotes,
    important_notes: input.importantNotes
  };
  return { names: Object.keys(mapping), values: Object.values(mapping) };
}

function validateClient(input) {
  if (!input.firstName || !input.lastName || !input.town || !input.dateOfBirth || !input.nextReview) return "Complete all required client fields.";
  if (!/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(input.dateOfBirth) || !/[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(input.nextReview)) return "Enter valid dates.";
  if (!['Active', 'Paused', 'Archived'].includes(input.status)) return "Choose a valid client status.";
  if (!['Standard', 'Medium', 'High'].includes(input.risk)) return "Choose a valid risk level.";
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) return "Enter a valid email address.";
  return null;
}

function normaliseClient(input) {
  const textFields = ["firstName","lastName","preferredName","nhsNumber","addressLine1","addressLine2","town","postcode","phone","email","carePackage","gpName","gpPractice","gpPhone","nextOfKinName","nextOfKinRelationship","nextOfKinPhone","emergencyContactName","emergencyContactPhone","allergies","communicationNeeds","capacityNotes","importantNotes"];
  const output = {};
  for (const field of textFields) output[field] = clean(input[field]);
  output.dateOfBirth = clean(input.dateOfBirth);
  output.nextReview = clean(input.nextReview);
  output.status = clean(input.status) || "Active";
  output.risk = clean(input.risk) || "Standard";
  return output;
}

function toClient(row) {
  return {
    id: row.id, firstName: row.first_name, lastName: row.last_name, preferredName: row.preferred_name || "",
    dateOfBirth: row.date_of_birth, nhsNumber: row.nhs_number || "", addressLine1: row.address_line_1 || "",
    addressLine2: row.address_line_2 || "", town: row.town, postcode: row.postcode || "", phone: row.phone || "",
    email: row.email || "", carePackage: row.care_package || "", nextReview: row.next_review, status: row.status,
    risk: row.risk, gpName: row.gp_name || "", gpPractice: row.gp_practice || "", gpPhone: row.gp_phone || "",
    nextOfKinName: row.next_of_kin_name || "", nextOfKinRelationship: row.next_of_kin_relationship || "",
    nextOfKinPhone: row.next_of_kin_phone || "", emergencyContactName: row.emergency_contact_name || "",
    emergencyContactPhone: row.emergency_contact_phone || "", allergies: row.allergies || "",
    communicationNeeds: row.communication_needs || "", capacityNotes: row.capacity_notes || "",
    importantNotes: row.important_notes || "", archivedAt: row.archived_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}




async function rotaBoard(db, session, url) {
  const org=session.organisation_id;
  const from=clean(url.searchParams.get('from'))||new Date().toISOString().slice(0,10);
  const to=clean(url.searchParams.get('to'))||new Date(Date.now()+6*86400000).toISOString().slice(0,10);
  const [visits,clients,staff,patterns,requirements,assignments]=await Promise.all([
    db.prepare(`SELECT v.*,c.first_name||' '||c.last_name client_name,s.first_name||' '||s.last_name staff_name,
      (SELECT rt.status FROM rota_visit_templates rt WHERE rt.id=v.template_id AND rt.organisation_id=v.organisation_id) recurrence_status,
      (SELECT rt.interval_weeks FROM rota_visit_templates rt WHERE rt.id=v.template_id AND rt.organisation_id=v.organisation_id) recurrence_interval_weeks,
      (SELECT rt.effective_from FROM rota_visit_templates rt WHERE rt.id=v.template_id AND rt.organisation_id=v.organisation_id) recurrence_effective_from,
      (SELECT rt.effective_to FROM rota_visit_templates rt WHERE rt.id=v.template_id AND rt.organisation_id=v.organisation_id) recurrence_effective_to,
      (SELECT rt.end_after_occurrences FROM rota_visit_templates rt WHERE rt.id=v.template_id AND rt.organisation_id=v.organisation_id) recurrence_end_after_occurrences,
      (SELECT GROUP_CONCAT(rt.day_of_week) FROM rota_visit_templates rt WHERE rt.series_id=v.recurrence_group_id AND rt.organisation_id=v.organisation_id) recurrence_days,
      CASE WHEN (SELECT rt.preferred_staff_id FROM rota_visit_templates rt WHERE rt.id=v.template_id AND rt.organisation_id=v.organisation_id) IS NULL THEN 0 ELSE 1 END recurrence_keep_carer,
      COALESCE(v.protected_time_rule,'flexible') protected_time_rule, v.protected_time_reason, COALESCE(v.protected_window_minutes,0) protected_window_minutes
      FROM care_visits v LEFT JOIN clients c ON c.id=v.client_id AND c.organisation_id=v.organisation_id LEFT JOIN staff s ON s.id=v.staff_id AND s.organisation_id=v.organisation_id
      WHERE v.organisation_id=? AND date(v.scheduled_start) BETWEEN date(?,'-1 day') AND date(?,'+1 day') AND v.rota_status!='cancelled'
      ORDER BY v.scheduled_start`).bind(org,from,to).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name FROM clients WHERE organisation_id=? AND archived_at IS NULL ORDER BY first_name,last_name`).bind(org).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name,job_title FROM staff WHERE organisation_id=? AND status='Active' ORDER BY first_name,last_name`).bind(org).all(),
    db.prepare(`SELECT * FROM staff_working_patterns WHERE organisation_id=? AND status='active' ORDER BY staff_id,week_number,day_of_week,start_time`).bind(org).all(),
    db.prepare(`SELECT * FROM client_visit_requirements WHERE organisation_id=? AND status='active'`).bind(org).all(),
    db.prepare(`SELECT client_id,staff_id FROM client_staff_assignments WHERE organisation_id=?`).bind(org).all()
  ]);
  const rows=visits.results||[], now=Date.now();
  rows.forEach(v=>{const start=new Date(v.scheduled_start).getTime(),end=v.scheduled_end?new Date(v.scheduled_end).getTime():start+3600000;v.live_status=v.status==='scheduled'&&start<now?'late':v.status==='in_progress'&&end<now?'overrunning':v.status;});
  const stats={total:rows.length,unallocated:rows.filter(x=>!x.staff_id).length,late:rows.filter(x=>x.live_status==='late').length,inProgress:rows.filter(x=>x.status==='in_progress').length,completed:rows.filter(x=>x.status==='completed').length};
  return json({from,to,visits:rows,clients:clients.results||[],staff:staff.results||[],workingPatterns:patterns.results||[],requirements:requirements.results||[],preferredAssignments:assignments.results||[],stats});
}

async function listRotaTemplates(db,session){
  if(!await userHasPermission(db,session,'rota.templates.view')&&!hasRole(session,['owner','manager','scheduler','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const org=session.organisation_id;
  const [visitTemplates,patterns,exceptions,runs,clients,staff]=await Promise.all([
    db.prepare(`SELECT t.*,c.first_name||' '||c.last_name client_name,p.first_name||' '||p.last_name preferred_staff_name,b.first_name||' '||b.last_name backup_staff_name FROM rota_visit_templates t LEFT JOIN clients c ON c.id=t.client_id AND c.organisation_id=t.organisation_id LEFT JOIN staff p ON p.id=t.preferred_staff_id AND p.organisation_id=t.organisation_id LEFT JOIN staff b ON b.id=t.backup_staff_id AND b.organisation_id=t.organisation_id WHERE t.organisation_id=? ORDER BY t.day_of_week,t.preferred_time,c.last_name`).bind(org).all(),
    db.prepare(`SELECT w.*,s.first_name||' '||s.last_name staff_name FROM staff_working_patterns w LEFT JOIN staff s ON s.id=w.staff_id AND s.organisation_id=w.organisation_id WHERE w.organisation_id=? ORDER BY s.last_name,w.week_number,w.day_of_week,w.start_time`).bind(org).all(),
    db.prepare(`SELECT e.*,s.first_name||' '||s.last_name staff_name,c.first_name||' '||c.last_name client_name,r.first_name||' '||r.last_name replacement_staff_name FROM rota_template_exceptions e LEFT JOIN staff s ON s.id=e.staff_id AND s.organisation_id=e.organisation_id LEFT JOIN clients c ON c.id=e.client_id AND c.organisation_id=e.organisation_id LEFT JOIN staff r ON r.id=e.replacement_staff_id AND r.organisation_id=e.organisation_id WHERE e.organisation_id=? AND datetime(COALESCE(e.end_at,e.start_at))>=datetime('now','-30 day') ORDER BY e.start_at DESC`).bind(org).all(),
    db.prepare(`SELECT * FROM rota_generation_runs WHERE organisation_id=? ORDER BY generated_at DESC LIMIT 12`).bind(org).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name FROM clients WHERE organisation_id=? AND archived_at IS NULL ORDER BY first_name,last_name`).bind(org).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name,job_title FROM staff WHERE organisation_id=? AND status='Active' ORDER BY first_name,last_name`).bind(org).all()
  ]);
  return json({visitTemplates:visitTemplates.results||[],workingPatterns:patterns.results||[],exceptions:exceptions.results||[],runs:runs.results||[],clients:clients.results||[],staff:staff.results||[]});
}
async function saveRotaVisitTemplate(request,db,session){
  if(!await userHasPermission(db,session,'rota.templates.manage')&&!hasRole(session,['owner','manager','scheduler','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const i=await readJson(request),clientId=clean(i.clientId),time=clean(i.preferredTime),day=Number(i.dayOfWeek),duration=Math.max(15,Number(i.durationMinutes)||30);
  if(!clientId||!time||day<1||day>7)return json({error:{code:'VALIDATION_ERROR',message:'Select a client, day and preferred time.'}},400);
  const id=clean(i.id)||crypto.randomUUID();
  await db.batch([db.prepare(`INSERT INTO rota_visit_templates(id,organisation_id,client_id,name,visit_type,day_of_week,preferred_time,duration_minutes,carers_required,preferred_staff_id,backup_staff_id,window_minutes,effective_from,effective_to,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET client_id=excluded.client_id,name=excluded.name,visit_type=excluded.visit_type,day_of_week=excluded.day_of_week,preferred_time=excluded.preferred_time,duration_minutes=excluded.duration_minutes,carers_required=excluded.carers_required,preferred_staff_id=excluded.preferred_staff_id,backup_staff_id=excluded.backup_staff_id,window_minutes=excluded.window_minutes,effective_from=excluded.effective_from,effective_to=excluded.effective_to,status=excluded.status,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`).bind(id,session.organisation_id,clientId,clean(i.name)||'Recurring care visit',clean(i.visitType)||'Care visit',day,time,duration,Math.max(1,Number(i.carersRequired)||1),clean(i.preferredStaffId)||null,clean(i.backupStaffId)||null,Math.max(0,Number(i.windowMinutes)||15),clean(i.effectiveFrom)||null,clean(i.effectiveTo)||null,clean(i.status)||'active',clean(i.notes),session.user_id),auditStatement(db,session.organisation_id,session.user_id,'rota.template_saved','rota_visit_template',id,{clientId,day,time})]);return json({ok:true,id});
}
async function saveWorkingPattern(request,db,session){
  if(!await userHasPermission(db,session,'rota.templates.manage')&&!hasRole(session,['owner','manager','scheduler','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const i=await readJson(request),staffId=clean(i.staffId),day=Number(i.dayOfWeek),start=clean(i.startTime),end=clean(i.endTime),cycle=Math.min(8,Math.max(1,Number(i.cycleWeeks)||1)),week=Math.min(cycle,Math.max(1,Number(i.weekNumber)||1));
  if(!staffId||day<1||day>7||!start||!end||end<=start)return json({error:{code:'VALIDATION_ERROR',message:'Select a carer, day and valid start/end times.'}},400);
  const id=clean(i.id)||crypto.randomUUID();await db.batch([db.prepare(`INSERT INTO staff_working_patterns(id,organisation_id,staff_id,name,cycle_weeks,week_number,day_of_week,start_time,end_time,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET staff_id=excluded.staff_id,name=excluded.name,cycle_weeks=excluded.cycle_weeks,week_number=excluded.week_number,day_of_week=excluded.day_of_week,start_time=excluded.start_time,end_time=excluded.end_time,status=excluded.status,updated_at=CURRENT_TIMESTAMP`).bind(id,session.organisation_id,staffId,clean(i.name)||'Normal working pattern',cycle,week,day,start,end,clean(i.status)||'active',session.user_id),auditStatement(db,session.organisation_id,session.user_id,'rota.working_pattern_saved','staff_working_pattern',id,{staffId,day,start,end})]);return json({ok:true,id});
}
async function saveRotaException(request,db,session){
  if(!await userHasPermission(db,session,'rota.templates.manage')&&!hasRole(session,['owner','manager','scheduler','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const i=await readJson(request),start=clean(i.startAt),type=clean(i.exceptionType)||'other';if(!start)return json({error:{code:'VALIDATION_ERROR',message:'Enter the exception start date and time.'}},400);
  const id=clean(i.id)||crypto.randomUUID();await db.batch([db.prepare(`INSERT INTO rota_template_exceptions(id,organisation_id,exception_type,staff_id,client_id,template_id,start_at,end_at,action,replacement_staff_id,reason,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET exception_type=excluded.exception_type,staff_id=excluded.staff_id,client_id=excluded.client_id,template_id=excluded.template_id,start_at=excluded.start_at,end_at=excluded.end_at,action=excluded.action,replacement_staff_id=excluded.replacement_staff_id,reason=excluded.reason`).bind(id,session.organisation_id,type,clean(i.staffId)||null,clean(i.clientId)||null,clean(i.templateId)||null,start,clean(i.endAt)||null,clean(i.action)||'exclude',clean(i.replacementStaffId)||null,clean(i.reason),session.user_id),auditStatement(db,session.organisation_id,session.user_id,'rota.exception_saved','rota_exception',id,{type,start})]);return json({ok:true,id});
}
async function deleteRotaTemplateItem(db,session,type,id){
  if(!await userHasPermission(db,session,'rota.templates.manage')&&!hasRole(session,['owner','manager','scheduler','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const table=type==='visit'?'rota_visit_templates':type==='working-pattern'?'staff_working_patterns':'rota_template_exceptions';await db.batch([db.prepare(`DELETE FROM ${table} WHERE id=? AND organisation_id=?`).bind(id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'rota.template_deleted',type,id,{})]);return json({ok:true});
}
function mondayOf(value){const d=new Date(`${value}T00:00:00`);const shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);return d;}
async function generateRotaFromTemplates(request,env,session){
  const db=env.DB;if(!await userHasPermission(db,session,'rota.templates.generate')&&!hasRole(session,['owner','manager','scheduler','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const i=await readJson(request),weekValue=clean(i.weekCommencing);if(!weekValue)return json({error:{code:'VALIDATION_ERROR',message:'Select a week to generate.'}},400);const week=mondayOf(weekValue),weekEnd=new Date(week);weekEnd.setDate(weekEnd.getDate()+7);const mode=['fill','regenerate'].includes(clean(i.mode))?clean(i.mode):'fill';
  if(mode==='regenerate')await db.prepare(`DELETE FROM care_visits WHERE organisation_id=? AND rota_source='template' AND status='scheduled' AND datetime(scheduled_start)>=datetime(?) AND datetime(scheduled_start)<datetime(?) AND COALESCE(manually_overridden,0)=0`).bind(session.organisation_id,week.toISOString(),weekEnd.toISOString()).run();
  const templates=(await db.prepare(`SELECT * FROM rota_visit_templates WHERE organisation_id=? AND status='active' ORDER BY day_of_week,preferred_time`).bind(session.organisation_id).all()).results||[];let created=0,skipped=0,unallocated=0;const warnings=[],statements=[];
  for(const t of templates){const day=new Date(week);day.setDate(day.getDate()+Number(t.day_of_week)-1);const date=day.toISOString().slice(0,10);if(t.effective_from&&date<t.effective_from){skipped++;continue}if(t.effective_to&&date>t.effective_to){skipped++;continue}const interval=Math.max(1,Number(t.interval_weeks)||1);if(interval>1&&t.effective_from){const origin=mondayOf(t.effective_from),weeks=Math.floor((week-origin)/(7*86400000));if(weeks<0||weeks%interval!==0){skipped++;continue}}if(Number(t.end_after_occurrences)>0){const made=await db.prepare(`SELECT COUNT(*) count FROM care_visits WHERE organisation_id=? AND template_id=? AND status!='cancelled'`).bind(session.organisation_id,t.id).first();if(Number(made?.count||0)>=Number(t.end_after_occurrences)){skipped++;continue}}
    const start=new Date(`${date}T${t.preferred_time}:00`),end=new Date(start.getTime()+Number(t.duration_minutes)*60000);
    const duplicate=await db.prepare(`SELECT id FROM care_visits WHERE organisation_id=? AND template_id=? AND date(scheduled_start)=date(?) AND status!='cancelled' LIMIT 1`).bind(session.organisation_id,t.id,start.toISOString()).first();if(duplicate){skipped++;continue}
    const ex=await db.prepare(`SELECT * FROM rota_template_exceptions WHERE organisation_id=? AND (template_id=? OR client_id=? OR staff_id IN (?,?)) AND datetime(start_at)<=datetime(?) AND datetime(COALESCE(end_at,start_at,'9999-12-31'))>=datetime(?) ORDER BY created_at DESC LIMIT 1`).bind(session.organisation_id,t.id,t.client_id,t.preferred_staff_id||'',t.backup_staff_id||'',end.toISOString(),start.toISOString()).first();if(ex&&ex.action==='exclude'){skipped++;warnings.push(`${t.name}: skipped due to ${ex.exception_type}`);continue}
    let staffId=ex?.replacement_staff_id||t.preferred_staff_id||null;
    async function available(candidate){if(!candidate)return false;const clash=await db.prepare(`SELECT id FROM care_visits WHERE organisation_id=? AND staff_id=? AND status!='cancelled' AND datetime(scheduled_start)<datetime(?) AND datetime(COALESCE(scheduled_end,scheduled_start))>datetime(?) LIMIT 1`).bind(session.organisation_id,candidate,end.toISOString(),start.toISOString()).first();if(clash)return false;const pattern=await db.prepare(`SELECT id FROM staff_working_patterns WHERE organisation_id=? AND staff_id=? AND status='active' AND day_of_week=? AND time(start_time)<=time(?) AND time(end_time)>=time(?) LIMIT 1`).bind(session.organisation_id,candidate,t.day_of_week,t.preferred_time,end.toISOString().slice(11,16)).first();return Boolean(pattern)}
    if(staffId&&!await available(staffId))staffId=t.backup_staff_id&&await available(t.backup_staff_id)?t.backup_staff_id:null;
    if(!staffId){unallocated++;warnings.push(`${t.name}: left in allocation queue`)}
    const id=crypto.randomUUID();statements.push(db.prepare(`INSERT INTO care_visits(id,organisation_id,client_id,staff_id,visit_type,scheduled_start,scheduled_end,status,rota_source,rota_status,recurrence_group_id,recurrence_pattern,template_id,published_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`).bind(id,session.organisation_id,t.client_id,staffId,t.visit_type,start.toISOString(),end.toISOString(),'scheduled','template','draft',t.id,'weekly_template',t.id,session.user_id));created++;
  }
  const runId=crypto.randomUUID();statements.push(db.prepare(`INSERT INTO rota_generation_runs(id,organisation_id,week_commencing,templates_considered,visits_created,visits_skipped,visits_unallocated,warnings_json,generated_by) VALUES(?,?,?,?,?,?,?,?,?)`).bind(runId,session.organisation_id,week.toISOString().slice(0,10),templates.length,created,skipped,unallocated,JSON.stringify(warnings),session.user_id));statements.push(auditStatement(db,session.organisation_id,session.user_id,'rota.week_generated','rota_generation',runId,{week:weekValue,created,skipped,unallocated,mode}));if(statements.length)await db.batch(statements);
  const staffDays=(await db.prepare(`SELECT DISTINCT staff_id,date(scheduled_start) day FROM care_visits WHERE organisation_id=? AND staff_id IS NOT NULL AND datetime(scheduled_start)>=datetime(?) AND datetime(scheduled_start)<datetime(?)`).bind(session.organisation_id,week.toISOString(),weekEnd.toISOString()).all()).results||[];for(const x of staffDays)await recalculateStaffTravel(env,session,x.staff_id,x.day);
  return json({ok:true,runId,templates:templates.length,created,skipped,unallocated,warnings});
}

async function createRotaVisit(request,env,session){
  const db=env.DB;
  const i=await readJson(request),clientId=clean(i.clientId),start=clean(i.scheduledStart);
  if(!clientId||!start)return json({error:{code:'VALIDATION_ERROR',message:'Select a client and start time.'}},400);
  const staffId=clean(i.staffId)||null,end=clean(i.scheduledEnd)||null;
  if(staffId){const clash=await db.prepare(`SELECT id FROM care_visits WHERE organisation_id=? AND staff_id=? AND rota_status!='cancelled' AND status!='cancelled' AND datetime(scheduled_start)<datetime(COALESCE(?,?,'9999-12-31')) AND datetime(COALESCE(scheduled_end,scheduled_start,'9999-12-31'))>datetime(?) LIMIT 1`).bind(session.organisation_id,staffId,end,start,start).first();if(clash)return json({error:{code:'ROTA_CLASH',message:'This staff member already has an overlapping visit.'}},409);}
  const id=crypto.randomUUID(),recurrence=clean(i.recurrence)||'none',group=recurrence==='none'?null:crypto.randomUUID();
  const occurrences=[];let cursor=new Date(start),finish=end?new Date(end):null,count=recurrence==='weekly'?Math.min(Number(i.occurrences)||4,52):1;
  for(let n=0;n<count;n++){const vid=n===0?id:crypto.randomUUID();occurrences.push(db.prepare(`INSERT INTO care_visits(id,organisation_id,client_id,staff_id,visit_type,scheduled_start,scheduled_end,status,rota_source,rota_status,recurrence_group_id,recurrence_pattern,published_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`).bind(vid,session.organisation_id,clientId,staffId,clean(i.visitType)||'Care visit',cursor.toISOString(),finish?finish.toISOString():null,'scheduled','rota','published',group,recurrence,session.user_id));cursor=new Date(cursor.getTime()+7*86400000);if(finish)finish=new Date(finish.getTime()+7*86400000);}
  occurrences.push(auditStatement(db,session.organisation_id,session.user_id,'rota.visit_published','visit',id,{clientId,staffId,recurrence,count}));
  await db.batch(occurrences);return json({ok:true,id,created:count});
}

async function manageVisitRecurrence(request,db,session,id){
  if(!await userHasPermission(db,session,'rota.templates.manage')&&!hasRole(session,['owner','manager','scheduler','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const visit=await db.prepare(`SELECT * FROM care_visits WHERE id=? AND organisation_id=?`).bind(id,session.organisation_id).first();if(!visit)return notFound('Rota visit');
  const i=await readJson(request),action=clean(i.action)||'create';
  const existing=visit.template_id?await db.prepare(`SELECT * FROM rota_visit_templates WHERE id=? AND organisation_id=?`).bind(visit.template_id,session.organisation_id).first():null;
  const seriesId=existing?.series_id||clean(i.seriesId)||crypto.randomUUID();
  if(action==='pause'||action==='resume'){
    await db.batch([db.prepare(`UPDATE rota_visit_templates SET status=?,paused_at=?,updated_at=CURRENT_TIMESTAMP WHERE organisation_id=? AND series_id=?`).bind(action==='pause'?'paused':'active',action==='pause'?new Date().toISOString():null,session.organisation_id,seriesId),auditStatement(db,session.organisation_id,session.user_id,`rota.recurrence_${action}`,'rota_recurrence',seriesId,{visitId:id})]);return json({ok:true,action,seriesId});
  }
  if(action==='stop'){
    const stopDate=clean(i.effectiveTo)||new Date(visit.scheduled_start).toISOString().slice(0,10);
    const statements=[db.prepare(`UPDATE rota_visit_templates SET effective_to=?,status='ended',updated_at=CURRENT_TIMESTAMP WHERE organisation_id=? AND series_id=?`).bind(stopDate,session.organisation_id,seriesId)];
    if(i.detachVisit!==false)statements.push(db.prepare(`UPDATE care_visits SET template_id=NULL,recurrence_group_id=NULL,recurrence_pattern='none',updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(id,session.organisation_id));
    statements.push(auditStatement(db,session.organisation_id,session.user_id,'rota.recurrence_stopped','rota_recurrence',seriesId,{visitId:id,stopDate,detached:i.detachVisit!==false}));await db.batch(statements);return json({ok:true,action,seriesId,detached:i.detachVisit!==false});
  }
  const start=new Date(visit.scheduled_start),duration=Math.max(15,Math.round(((visit.scheduled_end?new Date(visit.scheduled_end):new Date(start.getTime()+30*60000))-start)/60000));
  const days=Array.isArray(i.days)&&i.days.length?[...new Set(i.days.map(Number).filter(x=>x>=1&&x<=7))]:[((start.getDay()+6)%7)+1];
  const interval=Math.min(52,Math.max(1,Number(i.intervalWeeks)||1)),effectiveFrom=clean(i.effectiveFrom)||start.toISOString().slice(0,10),effectiveTo=clean(i.effectiveTo)||null,endAfter=Math.max(0,Number(i.endAfterOccurrences)||0);
  const keepCarer=i.keepCarer!==false,staffId=keepCarer?visit.staff_id:null,name=clean(i.name)||`${visit.visit_type||'Care visit'} recurring visit`;
  const statements=[];
  if(action==='update'&&seriesId)statements.push(db.prepare(`DELETE FROM rota_visit_templates WHERE organisation_id=? AND series_id=?`).bind(session.organisation_id,seriesId));
  let firstTemplateId=null;
  for(const day of days){const tid=crypto.randomUUID();if(!firstTemplateId)firstTemplateId=tid;statements.push(db.prepare(`INSERT INTO rota_visit_templates(id,organisation_id,client_id,name,visit_type,day_of_week,preferred_time,duration_minutes,carers_required,preferred_staff_id,backup_staff_id,window_minutes,effective_from,effective_to,status,notes,created_by,series_id,interval_weeks,end_after_occurrences,paused_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(tid,session.organisation_id,visit.client_id,name,visit.visit_type||'Care visit',day,start.toISOString().slice(11,16),duration,1,staffId,null,15,effectiveFrom,effectiveTo,'active',clean(i.notes)||visit.planner_notes||'',session.user_id,seriesId,interval,endAfter,null));}
  statements.push(db.prepare(`UPDATE care_visits SET template_id=?,recurrence_group_id=?,recurrence_pattern=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(firstTemplateId,seriesId,interval===1?'weekly':`every_${interval}_weeks`,id,session.organisation_id));
  statements.push(auditStatement(db,session.organisation_id,session.user_id,action==='update'?'rota.recurrence_updated':'rota.recurrence_created','rota_recurrence',seriesId,{visitId:id,days,interval,effectiveFrom,effectiveTo,endAfter,staffId}));
  await db.batch(statements);return json({ok:true,action,seriesId,templateId:firstTemplateId,templatesCreated:days.length});
}

async function authoriseProtectedVisitChange(db,session,visit,input,newStart){
  const email=clean(input.managerEmail).toLowerCase(),password=String(input.managerPassword||''),reason=clean(input.managerOverrideReason);
  if(!email||!password||reason.length<5)return {error:json({error:{code:'TIME_CRITICAL_AUTH_REQUIRED',message:'Manager authorisation, password and a clear reason are required to change this protected visit.'}},409)};
  const manager=await db.prepare(`SELECT id,email,role,access_level,status,password_hash,password_salt,password_iterations FROM users WHERE organisation_id=? AND lower(email)=lower(?) LIMIT 1`).bind(session.organisation_id,email).first();
  const valid=manager&&manager.status==='active'&&await verifyPassword(password,manager.password_salt,manager.password_hash,manager.password_iterations||PASSWORD_ITERATIONS);
  if(!valid)return {error:json({error:{code:'MANAGER_AUTH_FAILED',message:'The manager email address or password is incorrect.'}},401)};
  const managerSession={...session,user_id:manager.id,role:manager.role,access_level:manager.access_level,is_platform_user:false};
  const allowed=['owner','manager'].includes(manager.role)||['organisation_owner','organisation_admin','branch_manager'].includes(manager.access_level)||await userHasPermission(db,managerSession,'rota.time_critical.override');
  if(!allowed)return {error:json({error:{code:'MANAGER_AUTH_FORBIDDEN',message:'This account is not authorised to override protected visit times.'}},403)};
  return {manager,reason,statement:db.prepare(`INSERT INTO protected_visit_authorisations(id,organisation_id,visit_id,requested_by,authorised_by,previous_start,new_start,reason) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,visit.id,session.user_id,manager.id,visit.scheduled_start,newStart,reason)};
}

async function updateRotaVisit(request,env,session,id){
  const db=env.DB;
  const i=await readJson(request),row=await db.prepare(`SELECT * FROM care_visits WHERE id=? AND organisation_id=?`).bind(id,session.organisation_id).first();if(!row)return notFound('Rota visit');
  if(['in_progress','completed'].includes(row.status))return json({error:{code:'VISIT_STARTED',message:'A started or completed visit cannot be rescheduled from the rota.'}},409);
  const requestedLocked=i.plannerLocked===true||i.plannerLocked===1||i.plannerLocked==='1';
  if(Number(row.planner_locked)===1){const allowed=await userHasPermission(db,session,'rota.visit.override_lock');if(!allowed)return json({error:{code:'VISIT_LOCKED',message:'This visit is locked. An authorised planner or manager must unlock or change it.'}},409);}
  const staffId=clean(i.staffId)||null,start=clean(i.scheduledStart)||row.scheduled_start,end=clean(i.scheduledEnd)||row.scheduled_end,scope=['single','future','series'].includes(clean(i.scope))?clean(i.scope):'single',reason=clean(i.reason)||'Planner adjustment',plannerNotes=clean(i.plannerNotes)||row.planner_notes||'';
  const protectedRule=clean(row.protected_time_rule)||'flexible',timeChanged=new Date(start).getTime()!==new Date(row.scheduled_start).getTime();
  let protectedAuth=null;
  if(timeChanged&&protectedRule!=='flexible'){
    if(protectedRule==='window'){const delta=Math.abs(new Date(start)-new Date(row.scheduled_start))/60000;if(delta<=Number(row.protected_window_minutes||0)){/* permitted within window */}else{protectedAuth=await authoriseProtectedVisitChange(db,session,row,i,start);if(protectedAuth.error)return protectedAuth.error;}}
    else {protectedAuth=await authoriseProtectedVisitChange(db,session,row,i,start);if(protectedAuth.error)return protectedAuth.error;}
  }
  if(staffId){const clash=await db.prepare(`SELECT id FROM care_visits WHERE organisation_id=? AND staff_id=? AND id!=? AND rota_status!='cancelled' AND datetime(scheduled_start)<datetime(COALESCE(?,?,'9999-12-31')) AND datetime(COALESCE(scheduled_end,scheduled_start,'9999-12-31'))>datetime(?) LIMIT 1`).bind(session.organisation_id,staffId,id,end,start,start).first();if(clash)return json({error:{code:'ROTA_CLASH',message:'This staff member already has an overlapping visit.'}},409);}
  let travelAssessment=null;
  const overrideReason=clean(i.travelOverrideReason);
  if(staffId){
    travelAssessment=await assessTravelPlacement(env,session,{id,client_id:clean(i.clientId)||row.client_id,staff_id:staffId,scheduled_start:start,scheduled_end:end});
    if(travelAssessment.conflict){
      const permitted=overrideReason && await userHasPermission(db,session,'rota.travel.override');
      if(!permitted)return json({error:{code:'TRAVEL_CONFLICT',message:`Travel time requires ${travelAssessment.required} minutes but only ${travelAssessment.available} minutes is available. A permitted planner or manager must enter an override reason.`},travel:travelAssessment},409);
    }
  }
  const before=JSON.stringify({staffId:row.staff_id,start:row.scheduled_start,end:row.scheduled_end,visitType:row.visit_type,plannerLocked:Number(row.planner_locked)||0,plannerNotes:row.planner_notes||''});
  const after=JSON.stringify({staffId,start,end,visitType:clean(i.visitType)||row.visit_type,plannerLocked:requestedLocked?1:0,plannerNotes});
  const statements=[];
  if(protectedAuth?.statement)statements.push(protectedAuth.statement);
  if(scope==='single'||!row.requirement_id){statements.push(db.prepare(`UPDATE care_visits SET client_id=?,staff_id=?,visit_type=?,scheduled_start=?,scheduled_end=?,rota_source='planner',rota_status='draft',change_reason=?,manually_overridden=1,travel_override=?,travel_override_reason=?,planner_locked=?,planner_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(clean(i.clientId)||row.client_id,staffId,clean(i.visitType)||row.visit_type,start,end,reason,travelAssessment?.conflict?1:0,overrideReason,requestedLocked?1:0,plannerNotes,id,session.organisation_id));}
  else {
    const time=new Date(start).toISOString().slice(11,16),duration=Math.max(15,Math.round((new Date(end)-new Date(start))/60000));
    statements.push(db.prepare(`UPDATE client_visit_requirements SET visit_type=?,preferred_time=?,duration_minutes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(clean(i.visitType)||row.visit_type,time,duration,row.requirement_id,session.organisation_id));
    const condition=scope==='future'?'AND date(scheduled_start)>=date(?)':'';
    const bind=[staffId,clean(i.visitType)||row.visit_type,reason,requestedLocked?1:0,plannerNotes,row.requirement_id,session.organisation_id];if(scope==='future')bind.push(row.scheduled_start);
    statements.push(db.prepare(`UPDATE care_visits SET staff_id=?,visit_type=?,rota_source='planner',rota_status='draft',change_reason=?,manually_overridden=1,planner_locked=?,planner_notes=?,updated_at=CURRENT_TIMESTAMP WHERE requirement_id=? AND organisation_id=? AND status='scheduled' ${condition}`).bind(...bind));
  }
  statements.push(db.prepare(`INSERT INTO visit_change_history(id,organisation_id,visit_id,requirement_id,change_scope,reason,before_json,after_json,changed_by) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,id,row.requirement_id,scope,reason,before,after,session.user_id));
  statements.push(auditStatement(db,session.organisation_id,session.user_id,'rota.visit_updated','visit',id,{staffId,start,end,scope,reason,protectedOverride:Boolean(protectedAuth),authorisedBy:protectedAuth?.manager?.id||null}));
  if(travelAssessment?.conflict){statements.push(db.prepare(`INSERT INTO travel_override_history(id,organisation_id,visit_id,calculated_minutes,available_minutes,shortfall_minutes,reason,overridden_by) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,id,travelAssessment.required,travelAssessment.available,travelAssessment.shortfall,overrideReason,session.user_id));}
  await db.batch(statements);
  const affectedDays=new Set([String(start).slice(0,10),String(row.scheduled_start).slice(0,10)]);
  for(const day of affectedDays){if(staffId)await recalculateStaffTravel(env,session,staffId,day);if(row.staff_id&&row.staff_id!==staffId)await recalculateStaffTravel(env,session,row.staff_id,day);}
  return json({ok:true,scope,travel:travelAssessment});
}
async function cancelRotaVisit(request,db,session,id){const i=await readJson(request);const row=await db.prepare(`SELECT status FROM care_visits WHERE id=? AND organisation_id=?`).bind(id,session.organisation_id).first();if(!row)return notFound('Rota visit');if(row.status==='completed')return json({error:{code:'VISIT_COMPLETED',message:'A completed visit cannot be cancelled.'}},409);await db.batch([db.prepare(`UPDATE care_visits SET status='cancelled',rota_status='cancelled',cancelled_at=CURRENT_TIMESTAMP,cancellation_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(clean(i.reason)||'Cancelled from rota',id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'rota.visit_cancelled','visit',id,{reason:i.reason})]);return json({ok:true});}


async function routingSettings(db,organisationId){
  await db.prepare(`INSERT OR IGNORE INTO organisation_routing_settings(organisation_id) VALUES(?)`).bind(organisationId).run();
  return db.prepare(`SELECT * FROM organisation_routing_settings WHERE organisation_id=?`).bind(organisationId).first();
}
async function getRoutingSettings(env,session){
  if(!await userHasPermission(env.DB,session,'rota.travel.settings')&&!canManageSecurity(session))return forbidden();
  const settings=await routingSettings(env.DB,session.organisation_id);
  return json({settings,mapboxConfigured:Boolean(env.MAPBOX_ACCESS_TOKEN)});
}
async function updateRoutingSettings(request,env,session){
  if(!await userHasPermission(env.DB,session,'rota.travel.settings')&&!canManageSecurity(session))return forbidden();
  const i=await readJson(request),provider=['manual','mapbox'].includes(clean(i.provider))?clean(i.provider):'manual';
  const fallback=Math.max(0,Math.min(180,Number(i.defaultTravelMinutes)||15)),buffer=Math.max(0,Math.min(60,Number(i.parkingBufferMinutes)||5)),cacheDays=Math.max(1,Math.min(365,Number(i.cacheDays)||90));
  if(provider==='mapbox'&&!env.MAPBOX_ACCESS_TOKEN)return json({error:{code:'MAPBOX_NOT_CONFIGURED',message:'Add the MAPBOX_ACCESS_TOKEN Cloudflare secret before enabling Mapbox routing.'}},400);
  await env.DB.batch([env.DB.prepare(`INSERT INTO organisation_routing_settings(organisation_id,provider,default_travel_minutes,parking_buffer_minutes,cache_days,block_conflicts,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(organisation_id) DO UPDATE SET provider=excluded.provider,default_travel_minutes=excluded.default_travel_minutes,parking_buffer_minutes=excluded.parking_buffer_minutes,cache_days=excluded.cache_days,block_conflicts=excluded.block_conflicts,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(session.organisation_id,provider,fallback,buffer,cacheDays,i.blockConflicts===false?0:1,session.user_id),auditStatement(env.DB,session.organisation_id,session.user_id,'routing.settings_updated','organisation',session.organisation_id,{provider,fallback,buffer,cacheDays})]);
  return getRoutingSettings(env,session);
}
function fullClientAddress(row){return [row.address_line_1,row.address_line_2,row.town,row.postcode,'United Kingdom'].map(clean).filter(Boolean).join(', ');}
async function clientRouteLocation(env,session,clientId){
  const c=await env.DB.prepare(`SELECT id,address_line_1,address_line_2,town,postcode FROM clients WHERE id=? AND organisation_id=?`).bind(clientId,session.organisation_id).first();
  if(!c)return null;const address=fullClientAddress(c);if(!address)return null;const hash=await sha256Base64(address.toLowerCase());
  let cached=await env.DB.prepare(`SELECT * FROM routing_location_cache WHERE organisation_id=? AND entity_type='client' AND entity_id=? AND address_hash=? ORDER BY geocoded_at DESC LIMIT 1`).bind(session.organisation_id,clientId,hash).first();
  if(cached?.longitude!=null&&cached?.latitude!=null)return {hash,address,longitude:Number(cached.longitude),latitude:Number(cached.latitude)};
  if(!env.MAPBOX_ACCESS_TOKEN)return {hash,address};
  const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=gb&limit=1&access_token=${encodeURIComponent(env.MAPBOX_ACCESS_TOKEN)}`;
  const response=await fetch(url);if(!response.ok)return {hash,address};const data=await response.json(),centre=data.features?.[0]?.center;if(!centre)return {hash,address};
  await env.DB.prepare(`INSERT OR REPLACE INTO routing_location_cache(id,organisation_id,entity_type,entity_id,address_hash,formatted_address,longitude,latitude,provider,geocoded_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(),session.organisation_id,'client',clientId,hash,address,centre[0],centre[1],'mapbox').run();
  return {hash,address,longitude:centre[0],latitude:centre[1]};
}
async function routeBetweenClients(env,session,originClientId,destinationClientId){
  const settings=await routingSettings(env.DB,session.organisation_id);const fallback={minutes:Number(settings.default_travel_minutes)||15,miles:0,source:'manual'};
  if(!originClientId||!destinationClientId||originClientId===destinationClientId)return {...fallback,minutes:Math.max(0,Number(settings.parking_buffer_minutes)||0)};
  if(settings.provider!=='mapbox'||!env.MAPBOX_ACCESS_TOKEN)return {...fallback,minutes:fallback.minutes+(Number(settings.parking_buffer_minutes)||0)};
  const [a,b]=await Promise.all([clientRouteLocation(env,session,originClientId),clientRouteLocation(env,session,destinationClientId)]);if(a?.longitude==null||b?.longitude==null)return {...fallback,minutes:fallback.minutes+(Number(settings.parking_buffer_minutes)||0)};
  const cached=await env.DB.prepare(`SELECT * FROM routing_route_cache WHERE organisation_id=? AND origin_hash=? AND destination_hash=? AND provider='mapbox' AND datetime(expires_at)>CURRENT_TIMESTAMP`).bind(session.organisation_id,a.hash,b.hash).first();
  if(cached)return {minutes:Math.ceil(Number(cached.duration_seconds)/60)+(Number(settings.parking_buffer_minutes)||0),miles:Number(cached.distance_metres)/1609.344,source:'mapbox-cache'};
  const url=`https://api.mapbox.com/directions/v5/mapbox/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=false&steps=false&access_token=${encodeURIComponent(env.MAPBOX_ACCESS_TOKEN)}`;
  const response=await fetch(url);if(!response.ok)return {...fallback,minutes:fallback.minutes+(Number(settings.parking_buffer_minutes)||0)};const data=await response.json(),route=data.routes?.[0];if(!route)return {...fallback,minutes:fallback.minutes+(Number(settings.parking_buffer_minutes)||0)};
  const expires=new Date(Date.now()+(Number(settings.cache_days)||90)*86400000).toISOString();
  await env.DB.prepare(`INSERT INTO routing_route_cache(id,organisation_id,origin_hash,destination_hash,provider,distance_metres,duration_seconds,expires_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(organisation_id,origin_hash,destination_hash,provider) DO UPDATE SET distance_metres=excluded.distance_metres,duration_seconds=excluded.duration_seconds,calculated_at=CURRENT_TIMESTAMP,expires_at=excluded.expires_at`).bind(crypto.randomUUID(),session.organisation_id,a.hash,b.hash,'mapbox',Math.round(route.distance),Math.round(route.duration),expires).run();
  return {minutes:Math.ceil(route.duration/60)+(Number(settings.parking_buffer_minutes)||0),miles:route.distance/1609.344,source:'mapbox'};
}
async function assessTravelPlacement(env,session,proposed){
  const day=String(proposed.scheduled_start).slice(0,10),rows=await env.DB.prepare(`SELECT id,client_id,scheduled_start,scheduled_end FROM care_visits WHERE organisation_id=? AND staff_id=? AND id!=? AND date(scheduled_start)=date(?) AND rota_status!='cancelled' AND status!='cancelled' ORDER BY scheduled_start`).bind(session.organisation_id,proposed.staff_id,proposed.id||'',day).all();
  const start=new Date(proposed.scheduled_start),end=new Date(proposed.scheduled_end||proposed.scheduled_start);let previous=null,next=null;for(const r of rows.results||[]){if(new Date(r.scheduled_end||r.scheduled_start)<=start)previous=r;else if(new Date(r.scheduled_start)>=end){next=r;break;}}
  const checks=[];if(previous){const route=await routeBetweenClients(env,session,previous.client_id,proposed.client_id),available=Math.floor((start-new Date(previous.scheduled_end||previous.scheduled_start))/60000);checks.push({side:'before',required:route.minutes,available,route});}
  if(next){const route=await routeBetweenClients(env,session,proposed.client_id,next.client_id),available=Math.floor((new Date(next.scheduled_start)-end)/60000);checks.push({side:'after',required:route.minutes,available,route});}
  const failed=checks.filter(x=>x.available<x.required),worst=failed.sort((a,b)=>(b.required-b.available)-(a.required-a.available))[0];return {conflict:Boolean(worst),required:worst?.required||0,available:worst?.available||0,shortfall:worst?worst.required-worst.available:0,checks};
}
async function recalculateStaffTravel(env,session,staffId,day){
  if(!staffId||!day)return;const result=await env.DB.prepare(`SELECT id,client_id,scheduled_start,scheduled_end FROM care_visits WHERE organisation_id=? AND staff_id=? AND date(scheduled_start)=date(?) AND rota_status!='cancelled' AND status!='cancelled' ORDER BY scheduled_start`).bind(session.organisation_id,staffId,day).all(),visits=result.results||[];const statements=[];
  for(let index=0;index<visits.length;index++){const visit=visits[index],prev=visits[index-1],next=visits[index+1];const before=prev?await routeBetweenClients(env,session,prev.client_id,visit.client_id):{minutes:0,miles:0,source:'start'},after=next?await routeBetweenClients(env,session,visit.client_id,next.client_id):{minutes:0,miles:0,source:'finish'};const available=prev?Math.floor((new Date(visit.scheduled_start)-new Date(prev.scheduled_end||prev.scheduled_start))/60000):9999,conflict=prev&&available<before.minutes?1:0;statements.push(env.DB.prepare(`UPDATE care_visits SET travel_before_minutes=?,travel_after_minutes=?,travel_before_miles=?,travel_after_miles=?,travel_source=?,travel_calculated_at=CURRENT_TIMESTAMP,travel_conflict=?,travel_conflict_minutes=? WHERE id=? AND organisation_id=?`).bind(before.minutes,after.minutes,Number(before.miles||0).toFixed(2),Number(after.miles||0).toFixed(2),before.source,conflict,conflict?before.minutes-available:0,visit.id,session.organisation_id));}
  if(statements.length)await env.DB.batch(statements);
}
async function recalculateRouting(request,env,session){
  if(!await userHasPermission(env.DB,session,'rota.edit')&&!canManageSecurity(session))return forbidden();const i=await readJson(request),staffId=clean(i.staffId),day=clean(i.day);if(!staffId||!day)return json({error:{code:'VALIDATION_ERROR',message:'Choose a care worker and day.'}},400);await recalculateStaffTravel(env,session,staffId,day);return json({ok:true});
}

async function visitsBoard(db, session) {
  const org=session.organisation_id;
  const [visits,clients,staff,codes]=await Promise.all([
    db.prepare(`SELECT v.*,c.first_name||' '||c.last_name client_name,s.first_name||' '||s.last_name staff_name FROM care_visits v LEFT JOIN clients c ON c.id=v.client_id AND c.organisation_id=v.organisation_id LEFT JOIN staff s ON s.id=v.staff_id AND s.organisation_id=v.organisation_id WHERE v.organisation_id=? AND date(v.scheduled_start)=date('now') ORDER BY v.scheduled_start`).bind(org).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name FROM clients WHERE organisation_id=? AND archived_at IS NULL ORDER BY first_name,last_name`).bind(org).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name,job_title FROM staff WHERE organisation_id=? AND status='Active' ORDER BY first_name,last_name`).bind(org).all(),
    db.prepare(`SELECT client_id,code FROM client_visit_codes WHERE organisation_id=? AND active=1`).bind(org).all()
  ]);
  const rows=visits.results||[], now=Date.now();
  rows.forEach(v=>{if(v.status==='scheduled'&&new Date(v.scheduled_start).getTime()+15*60000<now)v.live_status='late';else if(v.status==='in_progress'&&v.scheduled_end&&new Date(v.scheduled_end).getTime()<now)v.live_status='overrunning';else v.live_status=v.status;});
  const stats={scheduled:rows.filter(x=>x.status==='scheduled').length,inProgress:rows.filter(x=>x.status==='in_progress').length,late:rows.filter(x=>x.live_status==='late').length,completed:rows.filter(x=>x.status==='completed').length,overrunning:rows.filter(x=>x.live_status==='overrunning').length};
  return json({visits:rows,clients:clients.results||[],staff:staff.results||[],codes:codes.results||[],stats});
}
async function createVisit(request,db,session){const i=await readJson(request);if(!clean(i.clientId)||!clean(i.scheduledStart))return json({error:{code:'VALIDATION_ERROR',message:'Select a client and scheduled start.'}},400);const id=crypto.randomUUID();await db.batch([db.prepare(`INSERT INTO care_visits(id,organisation_id,client_id,staff_id,visit_type,scheduled_start,scheduled_end,rota_source,rota_status,published_at,created_by) VALUES(?,?,?,?,?,?,?,'manual','published',CURRENT_TIMESTAMP,?)`).bind(id,session.organisation_id,clean(i.clientId),clean(i.staffId)||null,clean(i.visitType)||'Care visit',clean(i.scheduledStart),clean(i.scheduledEnd)||null,session.user_id),auditStatement(db,session.organisation_id,session.user_id,'visits.created','visit',id,{clientId:i.clientId})]);return json({ok:true,id});}
async function getVisitCareRecord(db,session,visitId){
  const visit=await db.prepare(`SELECT v.*,c.first_name||' '||c.last_name client_name,s.first_name||' '||s.last_name staff_name FROM care_visits v LEFT JOIN clients c ON c.id=v.client_id AND c.organisation_id=v.organisation_id LEFT JOIN staff s ON s.id=v.staff_id AND s.organisation_id=v.organisation_id WHERE v.id=? AND v.organisation_id=?`).bind(visitId,session.organisation_id).first();
  if(!visit)return notFound('Visit');
  if(['carer','senior_carer'].includes(session.access_level)&&(!session.staff_id||visit.staff_id!==session.staff_id))return forbidden('This visit is allocated to another care worker.');
  const [record,tasks,medication]=await Promise.all([
    db.prepare(`SELECT * FROM visit_care_records WHERE organisation_id=? AND visit_id=?`).bind(session.organisation_id,visitId).first(),
    db.prepare(`SELECT * FROM visit_task_records WHERE organisation_id=? AND visit_id=? ORDER BY recorded_at`).bind(session.organisation_id,visitId).all(),
    db.prepare(`SELECT * FROM visit_medication_records WHERE organisation_id=? AND visit_id=? ORDER BY recorded_at`).bind(session.organisation_id,visitId).all()
  ]);
  return json({visit,record:record||null,tasks:tasks.results||[],medication:medication.results||[]});
}
async function saveVisitCareRecord(request,db,session,visitId){
  const i=await readJson(request),visit=await db.prepare(`SELECT * FROM care_visits WHERE id=? AND organisation_id=?`).bind(visitId,session.organisation_id).first();
  if(!visit)return notFound('Visit');
  if(['carer','senior_carer'].includes(session.access_level)&&(!session.staff_id||visit.staff_id!==session.staff_id))return forbidden('This visit is allocated to another care worker.');
  if(!['in_progress','completed'].includes(visit.status))return json({error:{code:'VISIT_NOT_STARTED',message:'Clock into the visit before recording care delivery.'}},409);
  const notes=clean(i.careNotes);if(!notes)return json({error:{code:'VALIDATION_ERROR',message:'Enter the care notes before completing the visit.'}},400);
  const recordId=crypto.randomUUID(),tasks=Array.isArray(i.tasks)?i.tasks:[],meds=Array.isArray(i.medication)?i.medication:[],statements=[];
  statements.push(db.prepare(`INSERT INTO visit_care_records(id,organisation_id,visit_id,client_id,staff_id,mood,wellbeing,care_notes,fluid_intake_ml,nutrition,toileting,mobility_support,skin_observation,body_map_notes,follow_up_required,follow_up_notes,completed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organisation_id,visit_id) DO UPDATE SET mood=excluded.mood,wellbeing=excluded.wellbeing,care_notes=excluded.care_notes,fluid_intake_ml=excluded.fluid_intake_ml,nutrition=excluded.nutrition,toileting=excluded.toileting,mobility_support=excluded.mobility_support,skin_observation=excluded.skin_observation,body_map_notes=excluded.body_map_notes,follow_up_required=excluded.follow_up_required,follow_up_notes=excluded.follow_up_notes,completed_by=excluded.completed_by,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(recordId,session.organisation_id,visitId,visit.client_id,visit.staff_id||session.staff_id||null,clean(i.mood)||'not_recorded',clean(i.wellbeing)||'no_change',notes,Math.max(0,Number(i.fluidIntakeMl)||0),clean(i.nutrition)||'not_recorded',clean(i.toileting)||'not_recorded',clean(i.mobilitySupport),clean(i.skinObservation),clean(i.bodyMapNotes),i.followUpRequired?1:0,clean(i.followUpNotes),session.user_id));
  statements.push(db.prepare(`DELETE FROM visit_task_records WHERE organisation_id=? AND visit_id=?`).bind(session.organisation_id,visitId));
  for(const task of tasks){if(!clean(task.key)||!clean(task.label))continue;statements.push(db.prepare(`INSERT INTO visit_task_records(id,organisation_id,visit_id,task_key,task_label,status,notes,recorded_by) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,visitId,clean(task.key),clean(task.label),clean(task.status)||'completed',clean(task.notes),session.user_id));}
  statements.push(db.prepare(`DELETE FROM visit_medication_records WHERE organisation_id=? AND visit_id=?`).bind(session.organisation_id,visitId));
  for(const med of meds){if(!clean(med.outcome)||clean(med.outcome)==='not_required')continue;statements.push(db.prepare(`INSERT INTO visit_medication_records(id,organisation_id,visit_id,client_id,medication_name,outcome,reason,signature_name,recorded_by) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,visitId,visit.client_id,clean(med.name)||'Scheduled medication',clean(med.outcome),clean(med.reason),clean(med.signatureName)||clean(session.display_name)||'CoreCare user',session.user_id));}
  const complete=i.completeVisit!==false;
  if(complete)statements.push(db.prepare(`UPDATE care_visits SET status='completed',actual_end=COALESCE(actual_end,CURRENT_TIMESTAMP),notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(notes,visitId,session.organisation_id));
  if(i.followUpRequired)statements.push(db.prepare(`INSERT INTO operations_tasks(id,organisation_id,client_id,title,description,priority,status,due_at,created_by) VALUES(?,?,?,?,?,'high','open',datetime('now','+1 day'),?)`).bind(crypto.randomUUID(),session.organisation_id,visit.client_id,'Care visit follow-up',clean(i.followUpNotes)||'Review follow-up raised from the care visit.',session.user_id));
  if(i.incidentRequired&&clean(i.incidentTitle))statements.push(db.prepare(`INSERT INTO operations_incidents(id,organisation_id,client_id,title,description,severity,status,reported_by) VALUES(?,?,?,?,?,?, 'open',?)`).bind(crypto.randomUUID(),session.organisation_id,visit.client_id,clean(i.incidentTitle),clean(i.incidentDetails),clean(i.incidentSeverity)||'medium',session.user_id));
  statements.push(auditStatement(db,session.organisation_id,session.user_id,'care_delivery.visit_recorded','visit',visitId,{tasks:tasks.length,medication:meds.length,followUp:Boolean(i.followUpRequired),incident:Boolean(i.incidentRequired),completed:complete}));
  await db.batch(statements);return json({ok:true,visitId,status:complete?'completed':visit.status});
}
async function ensureClientVisitCode(request,db,session){const i=await readJson(request),clientId=clean(i.clientId),regenerate=Boolean(i.regenerate);if(!clientId)return json({error:{code:'VALIDATION_ERROR',message:'Select a client.'}},400);const client=await db.prepare('SELECT id,first_name,last_name FROM clients WHERE id=? AND organisation_id=? AND archived_at IS NULL').bind(clientId,session.organisation_id).first();if(!client)return notFound('Client');let row=await db.prepare('SELECT code,created_at FROM client_visit_codes WHERE organisation_id=? AND client_id=? AND active=1 ORDER BY created_at DESC').bind(session.organisation_id,clientId).first();if(regenerate){if(!hasRole(session,['owner','manager','organisation_owner','organisation_admin','branch_manager']))return forbidden();const code='CC-'+crypto.randomUUID().replaceAll('-','').slice(0,20).toUpperCase();await db.batch([db.prepare('UPDATE client_visit_codes SET active=0 WHERE organisation_id=? AND client_id=? AND active=1').bind(session.organisation_id,clientId),db.prepare('INSERT INTO client_visit_codes(id,organisation_id,client_id,code,active,created_by) VALUES(?,?,?,?,1,?)').bind(crypto.randomUUID(),session.organisation_id,clientId,code,session.user_id),auditStatement(db,session.organisation_id,session.user_id,'client.verification_code_regenerated','client',clientId,{client:`${client.first_name} ${client.last_name}`})]);row={code,created_at:new Date().toISOString()};}else if(!row){const code='CC-'+crypto.randomUUID().replaceAll('-','').slice(0,20).toUpperCase();await db.prepare('INSERT INTO client_visit_codes(id,organisation_id,client_id,code,active,created_by) VALUES(?,?,?,?,1,?)').bind(crypto.randomUUID(),session.organisation_id,clientId,code,session.user_id).run();row={code,created_at:new Date().toISOString()};}return json({ok:true,code:row.code,createdAt:row.created_at,clientName:`${client.first_name} ${client.last_name}`});}

async function syncVisitEvents(request,db,session){const i=await readJson(request),events=Array.isArray(i.events)?i.events:[];const results=[];for(const event of events){const eventId=clean(event.eventId),code=clean(event.code),type=clean(event.type),deviceTime=clean(event.deviceTime);if(!eventId||!code||!['clock_in','clock_out'].includes(type)||!deviceTime){results.push({eventId,ok:false,error:'Invalid event'});continue;}const existing=await db.prepare('SELECT id FROM visit_events WHERE device_event_id=? AND organisation_id=?').bind(eventId,session.organisation_id).first();if(existing){results.push({eventId,ok:true,duplicate:true});continue;}const clientCode=await db.prepare('SELECT client_id FROM client_visit_codes WHERE organisation_id=? AND code=? AND active=1').bind(session.organisation_id,code).first();if(!clientCode){results.push({eventId,ok:false,error:'Invalid or inactive client code'});continue;}const isCarer=['carer','senior_carer'].includes(session.access_level);if(isCarer&&!session.staff_id){results.push({eventId,ok:false,error:'Your login is not linked to a staff record. Ask a manager to update your staff profile.'});continue;}const staffFilter=session.staff_id?`AND staff_id=?`:'';
const visitSql=`SELECT id,status,staff_id FROM care_visits WHERE organisation_id=? AND client_id=? ${staffFilter} AND date(scheduled_start)=date(?) AND status IN ('scheduled','in_progress') ORDER BY CASE WHEN status='in_progress' THEN 0 ELSE 1 END, CASE WHEN staff_id IS NOT NULL THEN 0 ELSE 1 END, ABS(strftime('%s',scheduled_start)-strftime('%s',?)) LIMIT 1`;
let visit=session.staff_id
  ?await db.prepare(visitSql).bind(session.organisation_id,clientCode.client_id,session.staff_id,deviceTime,deviceTime).first()
  :await db.prepare(visitSql).bind(session.organisation_id,clientCode.client_id,deviceTime,deviceTime).first();if(!visit){results.push({eventId,ok:false,error:'No matching visit found'});continue;}if(type==='clock_in'&&visit.status!=='scheduled'){results.push({eventId,ok:true,duplicate:true});continue;}if(type==='clock_out'&&visit.status!=='in_progress'){results.push({eventId,ok:false,error:'Visit is not clocked in'});continue;}const source=clean(event.source)||'online';const update=type==='clock_in'?db.prepare(`UPDATE care_visits SET status='in_progress',actual_start=?,clock_in_method='qr',clock_in_device_time=?,clock_in_received_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(deviceTime,deviceTime,visit.id,session.organisation_id):db.prepare(`UPDATE care_visits SET status='completed',actual_end=?,clock_out_method='qr',clock_out_device_time=?,clock_out_received_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(deviceTime,deviceTime,visit.id,session.organisation_id);await db.batch([update,db.prepare(`INSERT INTO visit_events(id,organisation_id,visit_id,event_type,device_event_id,device_time,source,payload_json,created_by) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,visit.id,type,eventId,deviceTime,source,JSON.stringify(event),session.user_id),auditStatement(db,session.organisation_id,session.user_id,`visits.${type}`,'visit',visit.id,{deviceTime,source})]);results.push({eventId,ok:true,visitId:visit.id});}return json({ok:true,results,receivedAt:new Date().toISOString()});}

async function operationsBoard(db, session) {
  const org=session.organisation_id;
  const [tasks,incidents,handovers,clients,staff,careDue,riskDue]=await Promise.all([
    db.prepare(`SELECT t.*,c.first_name||' '||c.last_name client_name,s.first_name||' '||s.last_name staff_name FROM operations_tasks t LEFT JOIN clients c ON c.id=t.client_id AND c.organisation_id=t.organisation_id LEFT JOIN staff s ON s.id=t.assigned_staff_id AND s.organisation_id=t.organisation_id WHERE t.organisation_id=? ORDER BY CASE t.status WHEN 'escalated' THEN 1 WHEN 'overdue' THEN 2 WHEN 'open' THEN 3 ELSE 4 END,COALESCE(t.due_at,t.created_at) LIMIT 100`).bind(org).all(),
    db.prepare(`SELECT i.*,c.first_name||' '||c.last_name client_name FROM operations_incidents i LEFT JOIN clients c ON c.id=i.client_id AND c.organisation_id=i.organisation_id WHERE i.organisation_id=? ORDER BY CASE i.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,i.created_at DESC LIMIT 50`).bind(org).all(),
    db.prepare(`SELECT h.*,u.display_name created_by_name FROM shift_handovers h LEFT JOIN users u ON u.id=h.created_by AND u.organisation_id=h.organisation_id WHERE h.organisation_id=? ORDER BY h.created_at DESC LIMIT 20`).bind(org).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name FROM clients WHERE organisation_id=? AND archived_at IS NULL ORDER BY first_name,last_name`).bind(org).all(),
    db.prepare(`SELECT id,first_name,last_name,preferred_name,job_title FROM staff WHERE organisation_id=? AND status='Active' ORDER BY first_name,last_name`).bind(org).all(),
    db.prepare(`SELECT COUNT(*) count FROM care_plans WHERE organisation_id=? AND status='Active' AND date(review_date)<=date('now','+30 day')`).bind(org).first(),
    db.prepare(`SELECT COUNT(*) count FROM risk_assessments WHERE organisation_id=? AND status='Active' AND date(review_date)<=date('now','+30 day')`).bind(org).first()
  ]);
  const taskRows=tasks.results||[], incidentRows=incidents.results||[];
  const now=Date.now(); taskRows.forEach(t=>{if(t.status==='open'&&t.due_at&&new Date(t.due_at).getTime()<now)t.status='overdue'});
  const stats={open:taskRows.filter(x=>x.status==='open').length,overdue:taskRows.filter(x=>x.status==='overdue').length,completed:taskRows.filter(x=>x.status==='completed').length,escalated:taskRows.filter(x=>x.status==='escalated').length,incidentsOpen:incidentRows.filter(x=>x.status!=='closed').length,incidentsHigh:incidentRows.filter(x=>['high','critical'].includes(x.severity)&&x.status!=='closed').length,handoversUnread:(handovers.results||[]).filter(x=>!x.acknowledged_at).length,careDue:careDue?.count||0,riskDue:riskDue?.count||0,activeStaff:(staff.results||[]).length,activeClients:(clients.results||[]).length};
  const timeline=[...taskRows.slice(0,20).map(x=>({type:'task',title:x.title,detail:`${x.status}${x.client_name?' · '+x.client_name:''}`,created_at:x.updated_at||x.created_at})),...incidentRows.slice(0,20).map(x=>({type:'incident',title:x.title,detail:`${x.severity} · ${x.status}`,created_at:x.updated_at||x.created_at})),...(handovers.results||[]).slice(0,10).map(x=>({type:'handover',title:`${x.shift} handover`,detail:x.summary,created_at:x.created_at}))].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,25);
  return json({stats,tasks:taskRows,incidents:incidentRows,handovers:handovers.results||[],clients:clients.results||[],staff:staff.results||[],timeline});
}
async function createOperationsTask(request,db,session){const i=await readJson(request),title=clean(i.title);if(!title)return json({error:{code:'VALIDATION_ERROR',message:'Enter a task title.'}},400);const id=crypto.randomUUID();await db.batch([db.prepare(`INSERT INTO operations_tasks(id,organisation_id,client_id,assigned_staff_id,title,description,category,priority,status,due_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,session.organisation_id,clean(i.clientId)||null,clean(i.staffId)||null,title,clean(i.description),clean(i.category)||'Care',['low','normal','high','critical'].includes(clean(i.priority))?clean(i.priority):'normal','open',clean(i.dueAt)||null,session.user_id),auditStatement(db,session.organisation_id,session.user_id,'operations.task_created','task',id,{title})]);return json({ok:true,id});}
async function updateOperationsTask(db,session,id,action){const row=await db.prepare('SELECT title FROM operations_tasks WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first();if(!row)return notFound('Task');const status=action==='complete'?'completed':'escalated',column=action==='complete'?'completed_at':'escalated_at';await db.batch([db.prepare(`UPDATE operations_tasks SET status=?,${column}=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(status,id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,`operations.task_${action}`,'task',id,{title:row.title})]);return json({ok:true});}
async function createOperationsIncident(request,db,session){const i=await readJson(request),title=clean(i.title),description=clean(i.description);if(!title||!description)return json({error:{code:'VALIDATION_ERROR',message:'Enter an incident title and description.'}},400);const id=crypto.randomUUID();await db.batch([db.prepare(`INSERT INTO operations_incidents(id,organisation_id,client_id,reported_by,category,severity,title,description,status,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,session.organisation_id,clean(i.clientId)||null,session.user_id,clean(i.category)||'General',['low','medium','high','critical'].includes(clean(i.severity))?clean(i.severity):'medium',title,description,'open',clean(i.occurredAt)||null),auditStatement(db,session.organisation_id,session.user_id,'operations.incident_created','incident',id,{title,severity:i.severity})]);return json({ok:true,id});}
async function reviewOperationsIncident(request,db,session,id){const i=await readJson(request);const row=await db.prepare('SELECT title FROM operations_incidents WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first();if(!row)return notFound('Incident');await db.batch([db.prepare(`UPDATE operations_incidents SET status='closed',manager_review=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(clean(i.review)||'Reviewed and closed.',session.user_id,id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'operations.incident_reviewed','incident',id,{title:row.title})]);return json({ok:true});}
async function createShiftHandover(request,db,session){const i=await readJson(request),summary=clean(i.summary);if(!summary)return json({error:{code:'VALIDATION_ERROR',message:'Enter a handover summary.'}},400);const id=crypto.randomUUID();await db.batch([db.prepare(`INSERT INTO shift_handovers(id,organisation_id,shift,summary,concerns,outstanding_actions,created_by) VALUES(?,?,?,?,?,?,?)`).bind(id,session.organisation_id,clean(i.shift)||'Day',summary,clean(i.concerns),clean(i.outstandingActions),session.user_id),auditStatement(db,session.organisation_id,session.user_id,'operations.handover_created','handover',id,{shift:i.shift})]);return json({ok:true,id});}
async function acknowledgeShiftHandover(db,session,id){const row=await db.prepare('SELECT shift FROM shift_handovers WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first();if(!row)return notFound('Handover');await db.batch([db.prepare('UPDATE shift_handovers SET acknowledged_by=?,acknowledged_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?').bind(session.user_id,id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'operations.handover_acknowledged','handover',id,{shift:row.shift})]);return json({ok:true});}


async function refreshCareDeliveryAlerts(db, session) {
  const org=session.organisation_id, today=new Date().toISOString().slice(0,10), in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const [plans,risks,clients]=await Promise.all([
    db.prepare("SELECT id,client_id,title,review_date,approval_status,status FROM care_plans WHERE organisation_id=? AND status='Active'").bind(org).all(),
    db.prepare("SELECT id,client_id,title,severity,review_date,status FROM risk_assessments WHERE organisation_id=? AND status='Active'").bind(org).all(),
    db.prepare("SELECT id,first_name,last_name FROM clients WHERE organisation_id=? AND status='Active'").bind(org).all()
  ]);
  const names=Object.fromEntries((clients.results||[]).map(c=>[c.id,`${c.first_name} ${c.last_name}`]));
  const statements=[];
  for(const p of plans.results||[]){
    if(p.approval_status!=='approved') statements.push(db.prepare(`INSERT OR IGNORE INTO care_delivery_alerts(id,organisation_id,client_id,care_plan_id,alert_type,severity,title,message,due_date) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),org,p.client_id,p.id,'care_plan_approval','warning',`Care plan awaiting approval: ${names[p.client_id]||'Client'}`,p.title,p.review_date));
    if(p.review_date&&p.review_date<=in30) statements.push(db.prepare(`INSERT OR IGNORE INTO care_delivery_alerts(id,organisation_id,client_id,care_plan_id,alert_type,severity,title,message,due_date) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),org,p.client_id,p.id,'care_plan_review',p.review_date<today?'critical':'warning',`Care plan review ${p.review_date<today?'overdue':'due soon'}: ${names[p.client_id]||'Client'}`,p.title,p.review_date));
    if(p.review_date) statements.push(db.prepare(`INSERT OR IGNORE INTO care_review_schedule(id,organisation_id,client_id,record_type,record_id,due_date) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),org,p.client_id,'care_plan',p.id,p.review_date));
  }
  for(const r of risks.results||[]){
    if(r.severity==='High') statements.push(db.prepare(`INSERT OR IGNORE INTO care_delivery_alerts(id,organisation_id,client_id,risk_assessment_id,alert_type,severity,title,message,due_date) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),org,r.client_id,r.id,'high_risk','critical',`High risk: ${names[r.client_id]||'Client'}`,r.title,r.review_date));
    if(r.review_date&&r.review_date<=in30) statements.push(db.prepare(`INSERT OR IGNORE INTO care_delivery_alerts(id,organisation_id,client_id,risk_assessment_id,alert_type,severity,title,message,due_date) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),org,r.client_id,r.id,'risk_review',r.review_date<today?'critical':'warning',`Risk review ${r.review_date<today?'overdue':'due soon'}: ${names[r.client_id]||'Client'}`,r.title,r.review_date));
    if(r.review_date) statements.push(db.prepare(`INSERT OR IGNORE INTO care_review_schedule(id,organisation_id,client_id,record_type,record_id,due_date) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),org,r.client_id,'risk',r.id,r.review_date));
  }
  if(statements.length) await db.batch(statements);
}
async function careDeliveryDashboard(db,session){
  await refreshCareDeliveryAlerts(db,session); const org=session.organisation_id,today=new Date().toISOString().slice(0,10);
  const [plans,risks,alerts,reviews,visits]=await Promise.all([
    db.prepare(`SELECT cp.*,c.first_name||' '||c.last_name client_name FROM care_plans cp JOIN clients c ON c.id=cp.client_id WHERE cp.organisation_id=? ORDER BY cp.review_date`).bind(org).all(),
    db.prepare(`SELECT r.*,c.first_name||' '||c.last_name client_name FROM risk_assessments r JOIN clients c ON c.id=r.client_id WHERE r.organisation_id=? AND r.status='Active' ORDER BY CASE r.severity WHEN 'High' THEN 0 ELSE 1 END,r.review_date`).bind(org).all(),
    db.prepare(`SELECT a.*,c.first_name||' '||c.last_name client_name FROM care_delivery_alerts a LEFT JOIN clients c ON c.id=a.client_id WHERE a.organisation_id=? AND a.status='open' ORDER BY CASE a.severity WHEN 'critical' THEN 0 ELSE 1 END,a.due_date LIMIT 50`).bind(org).all(),
    db.prepare(`SELECT * FROM care_review_schedule WHERE organisation_id=? AND status='scheduled' ORDER BY due_date LIMIT 50`).bind(org).all(),
    db.prepare(`SELECT COUNT(*) total,COUNT(CASE WHEN rota_status='draft' THEN 1 END) draft FROM care_visits WHERE organisation_id=? AND date(scheduled_start)>=date('now')`).bind(org).first()
  ]);
  const active=(plans.results||[]).filter(x=>x.status==='Active'), pending=active.filter(x=>x.approval_status!=='approved').length, overdue=active.filter(x=>x.review_date&&x.review_date<today).length, high=(risks.results||[]).filter(x=>x.severity==='High').length;
  return json({metrics:{activePlans:active.length,pendingApproval:pending,overdueReviews:overdue,highRisks:high,openAlerts:(alerts.results||[]).length,futureVisits:Number(visits?.total||0),draftVisits:Number(visits?.draft||0)},alerts:alerts.results||[],reviews:reviews.results||[],plans:(plans.results||[]).map(r=>({...toCarePlan(r),clientName:r.client_name})),risks:risks.results||[]});
}
async function carePlanAction(request,db,session,id,action){
  if(!hasRole(session,['owner','manager','organisation_owner','organisation_admin','branch_manager']))return forbidden();
  const plan=await db.prepare(`SELECT * FROM care_plans WHERE id=? AND organisation_id=?`).bind(id,session.organisation_id).first(); if(!plan)return notFound('Care plan');
  if(action==='approve'){
    await db.batch([db.prepare(`UPDATE care_plans SET status='Active',approval_status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(session.user_id,id,session.organisation_id),db.prepare(`UPDATE client_onboarding_items SET status='completed',completed_at=CURRENT_TIMESTAMP,completed_by=?,updated_at=CURRENT_TIMESTAMP WHERE organisation_id=? AND client_id=? AND item_key='care_plan'`).bind(session.user_id,session.organisation_id,plan.client_id),auditStatement(db,session.organisation_id,session.user_id,'care_plan.approved','care_plan',id,{clientId:plan.client_id})]);
    return json({ok:true,status:'approved'});
  }
  if(plan.approval_status!=='approved')return json({error:{code:'APPROVAL_REQUIRED',message:'Approve the care plan before generating visits.'}},409);
  const reqs=await db.prepare(`SELECT * FROM client_visit_requirements WHERE organisation_id=? AND client_id=? AND status='active'`).bind(session.organisation_id,plan.client_id).all();
  if(!(reqs.results||[]).length)return json({error:{code:'NO_VISIT_REQUIREMENTS',message:'Add visit requirements to the client before generating visits.'}},409);
  const statements=[];let count=0;
  for(const r of reqs.results||[]){const requirement={visitType:r.visit_type,days:JSON.parse(r.days_json||'[]'),preferredTime:r.preferred_time,windowMinutes:r.window_minutes,durationMinutes:r.duration_minutes,carersRequired:r.carers_required,notes:r.notes,startDate:r.start_date,endDate:r.end_date};for(const date of generatedDates(requirement)){const day=date.toISOString().slice(0,10),start=new Date(`${day}T${requirement.preferredTime}:00`),end=new Date(start.getTime()+requirement.durationMinutes*60000);statements.push(db.prepare(`INSERT OR IGNORE INTO care_visits(id,organisation_id,client_id,staff_id,visit_type,scheduled_start,scheduled_end,status,rota_source,rota_status,recurrence_group_id,recurrence_pattern,requirement_id,requirement_occurrence_date,created_by,protected_time_rule,protected_time_reason,protected_window_minutes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,plan.client_id,null,requirement.visitType,start.toISOString(),end.toISOString(),'scheduled','care_plan','draft',r.id,'requirement',r.id,day,session.user_id,r.scheduling_rule||'flexible',r.time_critical_reason||'',Number(r.window_minutes)||0));count++;}}
  statements.push(db.prepare(`UPDATE care_plans SET visit_generation_status='generated',visits_generated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(id,session.organisation_id));statements.push(auditStatement(db,session.organisation_id,session.user_id,'care_plan.visits_generated','care_plan',id,{clientId:plan.client_id,attempted:count}));await db.batch(statements);return json({ok:true,visitsGenerated:count});
}
async function acknowledgeCareAlert(db,session,id){const result=await db.prepare(`UPDATE care_delivery_alerts SET status='acknowledged',acknowledged_by=?,acknowledged_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(session.user_id,id,session.organisation_id).run();if(!result.meta.changes)return notFound('Alert');return json({ok:true});}

async function carerDashboard(db,session){
  const isCarer=['carer','senior_carer'].includes(session.access_level);
  if(!isCarer)return forbidden();
  if(!session.staff_id)return json({linked:false,staffId:null,visits:[],history:[],metrics:{today:0,completed:0,inProgress:0,late:0},message:'Your CoreCare login is not linked to a staff record. Ask a manager to open your staff profile and link this login.'});

  // CoreCare service days run from 06:00 to 06:00. Build UTC boundaries in
  // application code rather than relying on SQLite localtime behaviour in D1.
  const now=new Date();
  const serviceStart=new Date(now);
  serviceStart.setHours(6,0,0,0);
  if(now<serviceStart)serviceStart.setDate(serviceStart.getDate()-1);
  const serviceEnd=new Date(serviceStart);serviceEnd.setDate(serviceEnd.getDate()+1);

  const base=`SELECT v.*,c.first_name||' '||c.last_name client_name,c.preferred_name client_preferred_name,c.address_line_1,c.address_line_2,c.town,c.postcode
    FROM care_visits v LEFT JOIN clients c ON c.id=v.client_id AND c.organisation_id=v.organisation_id
    WHERE v.organisation_id=? AND v.staff_id=?`;
  const [todayRows,historyRows]=await Promise.all([
    db.prepare(`${base} AND datetime(v.scheduled_start)>=datetime(?) AND datetime(v.scheduled_start)<datetime(?) AND COALESCE(v.rota_status,'')!='cancelled' AND v.status!='cancelled' ORDER BY datetime(v.scheduled_start)`).bind(session.organisation_id,session.staff_id,serviceStart.toISOString(),serviceEnd.toISOString()).all(),
    db.prepare(`${base} AND v.status='completed' AND datetime(v.scheduled_start)<datetime(?) ORDER BY datetime(COALESCE(v.actual_end,v.scheduled_end,v.scheduled_start)) DESC LIMIT 20`).bind(session.organisation_id,session.staff_id,serviceStart.toISOString()).all()
  ]);

  const visits=todayRows.results||[],history=historyRows.results||[];
  // Care records were introduced in a later migration. Keep the dashboard usable
  // even on an organisation whose migration is still pending.
  let recorded=new Set();
  try{
    const ids=[...visits,...history].map(v=>v.id);
    if(ids.length){
      const marks=ids.map(()=>'?').join(',');
      const rows=await db.prepare(`SELECT DISTINCT visit_id FROM visit_care_records WHERE organisation_id=? AND visit_id IN (${marks})`).bind(session.organisation_id,...ids).all();
      recorded=new Set((rows.results||[]).map(r=>r.visit_id));
    }
  }catch(error){console.warn('Carer dashboard care-record lookup skipped',String(error));}

  const clock=Date.now();
  for(const v of [...visits,...history]){
    v.has_care_record=recorded.has(v.id)?1:0;
    v.address=[v.address_line_1,v.address_line_2,v.town,v.postcode].filter(Boolean).join(', ');
  }
  for(const v of visits){
    const start=new Date(v.scheduled_start).getTime(),end=v.scheduled_end?new Date(v.scheduled_end).getTime():start+3600000;
    if(v.status==='scheduled'&&start+15*60000<clock)v.live_status='late';
    else if(v.status==='in_progress'&&end<clock)v.live_status='overrunning';
    else if(v.status==='scheduled'&&Math.abs(start-clock)<=15*60000)v.live_status='due';
    else v.live_status=v.status;
  }
  const active=visits.find(v=>v.status==='in_progress')||null,next=visits.find(v=>v.status==='scheduled')||null;
  return json({linked:true,staffId:session.staff_id,serviceDay:{start:serviceStart.toISOString(),end:serviceEnd.toISOString()},visits,history,activeVisitId:active?.id||null,nextVisitId:next?.id||null,metrics:{today:visits.length,completed:visits.filter(v=>v.status==='completed').length,inProgress:visits.filter(v=>v.status==='in_progress').length,late:visits.filter(v=>v.live_status==='late'||v.live_status==='overrunning').length}});
}

async function dashboardSummary(db, session) {
  const [clients, staff, plans, risks, auditRows] = await Promise.all([
    db.prepare("SELECT status,risk,next_review FROM clients WHERE organisation_id=?").bind(session.organisation_id).all(),
    db.prepare("SELECT status,dbs_expiry,training_expiry FROM staff WHERE organisation_id=?").bind(session.organisation_id).all(),
    db.prepare("SELECT status,review_date FROM care_plans WHERE organisation_id=?").bind(session.organisation_id).all(),
    db.prepare("SELECT status,severity,review_date FROM risk_assessments WHERE organisation_id=?").bind(session.organisation_id).all(),
    db.prepare(`SELECT a.action,a.entity_type,a.created_at,u.display_name AS user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id AND u.organisation_id=a.organisation_id WHERE a.organisation_id=? ORDER BY a.created_at DESC LIMIT 6`).bind(session.organisation_id).all()
  ]);
  const today = new Date().toISOString().slice(0,10);
  const in30 = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const activeClients = clients.results.filter(x => x.status === "Active").length;
  const reviewsDue = clients.results.filter(x => x.status === "Active" && x.next_review && x.next_review < today).length;
  const highRisk = clients.results.filter(x => x.status === "Active" && x.risk === "High").length;
  const activeStaff = staff.results.filter(x => x.status === "Active").length;
  const complianceDue = staff.results.filter(x => x.status === "Active" && ((x.dbs_expiry && x.dbs_expiry < today) || (x.training_expiry && x.training_expiry < today))).length;
  const carePlansDue = plans.results.filter(x => x.status === "Active" && x.review_date && x.review_date <= in30).length;
  const activeRisks = risks.results.filter(x => x.status === "Active" && x.severity === "High").length;
  return json({ metrics: { activeClients, reviewsDue, highRisk, activeStaff, totalStaff: staff.results.length, complianceDue, carePlansDue, activeRisks }, activity: auditRows.results });
}

const STAFF_COLUMNS = `s.id,s.first_name,s.last_name,s.preferred_name,s.job_title,s.employment_type,s.phone,s.email,s.start_date,s.status,s.dbs_expiry,s.training_expiry,s.notes,s.created_at,s.updated_at,
  u.id AS login_user_id,u.email AS login_email,u.access_level AS login_access_level,u.status AS login_status,u.must_change_password,u.last_login_at`;
async function listStaff(db, session, url) {
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const result = await db.prepare(`SELECT ${STAFF_COLUMNS} FROM staff s LEFT JOIN users u ON u.organisation_id=s.organisation_id AND u.staff_id=s.id WHERE s.organisation_id=? ${branchRestricted(session)?"AND s.branch_id=?":""} ${includeInactive ? "" : "AND s.status='Active'"} ORDER BY s.last_name COLLATE NOCASE,s.first_name COLLATE NOCASE`).bind(session.organisation_id,...(branchRestricted(session)?[activeBranch(session)]:[])).all();
  return json({ staff: result.results.map(toStaff) });
}
async function createStaff(request, db, session) {
  if (!hasRole(session,["owner","manager"])) return forbidden();
  const input = await readJson(request); const v = validateStaff(input); if (v.error) return json({error:{code:"VALIDATION_ERROR",message:v.error}},400);
  const createLogin = input.createLogin === true || clean(input.createLogin)==='on' || clean(input.createLogin)==='true';
  const loginEmail = clean(input.loginEmail || input.email).toLowerCase();
  const accessLevel = clean(input.loginAccessLevel)||'carer';
  const temporaryPassword = String(input.temporaryPassword||'');
  if(createLogin && (!loginEmail || !allowedAccessLevels().includes(accessLevel) || temporaryPassword.length<12)) return json({error:{code:'VALIDATION_ERROR',message:'Enter a login email, valid access level and temporary password of at least 12 characters.'}},400);
  if(createLogin){const limit=await enforceOrganisationSubscriptionLimit(db,session.organisation_id,'users');if(limit)return limit;}
  const id=crypto.randomUUID(), statements=[];
  statements.push(db.prepare(`INSERT INTO staff (id,organisation_id,branch_id,first_name,last_name,preferred_name,job_title,employment_type,phone,email,start_date,status,dbs_expiry,training_expiry,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,session.organisation_id,activeBranch(session),...v.values));
  if(createLogin){
    const secured=await hashPassword(temporaryPassword), userId=crypto.randomUUID(), displayName=`${v.values[0]} ${v.values[1]}`.trim();
    statements.push(db.prepare(`INSERT INTO users (id,organisation_id,staff_id,email,display_name,role,access_level,home_branch_id,password_hash,password_salt,password_iterations,status,must_change_password) VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',1)`).bind(userId,session.organisation_id,id,loginEmail,displayName,legacyRole(accessLevel),accessLevel,activeBranch(session),secured.hash,secured.salt,PASSWORD_ITERATIONS));
    statements.push(auditStatement(db,session.organisation_id,session.user_id,'staff.login_created','user',userId,{staffId:id,email:loginEmail,accessLevel}));
  }
  statements.push(auditStatement(db,session.organisation_id,session.user_id,"staff.created","staff",id,{name:`${v.values[0]} ${v.values[1]}`,loginCreated:createLogin}));
  try{await db.batch(statements);}catch(error){if(String(error).includes('UNIQUE'))return json({error:{code:'LOGIN_EXISTS',message:'That login email is already in use, or this staff member already has a login.'}},409);throw error;}
  const row=await db.prepare(`SELECT ${STAFF_COLUMNS} FROM staff s LEFT JOIN users u ON u.organisation_id=s.organisation_id AND u.staff_id=s.id WHERE s.id=? AND s.organisation_id=?`).bind(id,session.organisation_id).first(); return json({staff:toStaff(row)},201);
}
async function updateStaff(request, db, session, id) {
  if (!hasRole(session,["owner","manager"])) return forbidden();
  const input=await readJson(request); const v=validateStaff(input); if(v.error) return json({error:{code:"VALIDATION_ERROR",message:v.error}},400);
  const existing=await db.prepare(`SELECT s.id,u.id login_user_id FROM staff s LEFT JOIN users u ON u.organisation_id=s.organisation_id AND u.staff_id=s.id WHERE s.id=? AND s.organisation_id=?`).bind(id,session.organisation_id).first();
  if(!existing)return json({error:{code:'STAFF_NOT_FOUND',message:'Staff record not found.'}},404);
  const statements=[db.prepare(`UPDATE staff SET first_name=?,last_name=?,preferred_name=?,job_title=?,employment_type=?,phone=?,email=?,start_date=?,status=?,dbs_expiry=?,training_expiry=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(...v.values,id,session.organisation_id)];
  const createLogin=input.createLogin===true||clean(input.createLogin)==='on'||clean(input.createLogin)==='true';
  if(createLogin&&!existing.login_user_id){
    const loginEmail=clean(input.loginEmail||input.email).toLowerCase(),accessLevel=clean(input.loginAccessLevel)||'carer',temporaryPassword=String(input.temporaryPassword||'');
    if(!loginEmail||!allowedAccessLevels().includes(accessLevel)||temporaryPassword.length<12)return json({error:{code:'VALIDATION_ERROR',message:'Enter a login email, valid access level and temporary password of at least 12 characters.'}},400);
    const limit=await enforceOrganisationSubscriptionLimit(db,session.organisation_id,'users');if(limit)return limit;
    const secured=await hashPassword(temporaryPassword),userId=crypto.randomUUID(),displayName=`${v.values[0]} ${v.values[1]}`.trim();
    statements.push(db.prepare(`INSERT INTO users (id,organisation_id,staff_id,email,display_name,role,access_level,home_branch_id,password_hash,password_salt,password_iterations,status,must_change_password) VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',1)`).bind(userId,session.organisation_id,id,loginEmail,displayName,legacyRole(accessLevel),accessLevel,activeBranch(session),secured.hash,secured.salt,PASSWORD_ITERATIONS));
    statements.push(auditStatement(db,session.organisation_id,session.user_id,'staff.login_created','user',userId,{staffId:id,email:loginEmail,accessLevel}));
  } else if(existing.login_user_id){
    const loginStatus=v.values[8]==='Inactive'?'disabled':(clean(input.loginStatus)||'active');
    const accessLevel=allowedAccessLevels().includes(clean(input.loginAccessLevel))?clean(input.loginAccessLevel):null;
    if(accessLevel) statements.push(db.prepare(`UPDATE users SET display_name=?,role=?,access_level=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(`${v.values[0]} ${v.values[1]}`.trim(),legacyRole(accessLevel),accessLevel,loginStatus,existing.login_user_id,session.organisation_id));
    else statements.push(db.prepare(`UPDATE users SET display_name=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(`${v.values[0]} ${v.values[1]}`.trim(),loginStatus,existing.login_user_id,session.organisation_id));
    if(loginStatus==='disabled')statements.push(db.prepare('DELETE FROM sessions WHERE user_id=?').bind(existing.login_user_id));
  }
  statements.push(auditStatement(db,session.organisation_id,session.user_id,"staff.updated","staff",id,{status:v.values[8]}));
  try{await db.batch(statements);}catch(error){if(String(error).includes('UNIQUE'))return json({error:{code:'LOGIN_EXISTS',message:'That login email is already in use, or this staff member already has a login.'}},409);throw error;}
  const row=await db.prepare(`SELECT ${STAFF_COLUMNS} FROM staff s LEFT JOIN users u ON u.organisation_id=s.organisation_id AND u.staff_id=s.id WHERE s.id=? AND s.organisation_id=?`).bind(id,session.organisation_id).first(); return json({staff:toStaff(row)});
}
function validateStaff(input){
  const values=[clean(input.firstName),clean(input.lastName),clean(input.preferredName),clean(input.jobTitle)||"Carer",clean(input.employmentType)||"Employee",clean(input.phone),clean(input.email),clean(input.startDate),clean(input.status)||"Active",clean(input.dbsExpiry),clean(input.trainingExpiry),clean(input.notes)];
  if(!values[0]||!values[1]) return {error:"Enter the staff member's first and last name."};
  if(!["Active","Inactive"].includes(values[8])) return {error:"Choose a valid staff status."};
  return {values};
}
function toStaff(row){return {id:row.id,firstName:row.first_name,lastName:row.last_name,preferredName:row.preferred_name||"",jobTitle:row.job_title,employmentType:row.employment_type,phone:row.phone||"",email:row.email||"",startDate:row.start_date||"",status:row.status,dbsExpiry:row.dbs_expiry||"",trainingExpiry:row.training_expiry||"",notes:row.notes||"",loginUserId:row.login_user_id||"",loginEmail:row.login_email||"",loginAccessLevel:row.login_access_level||"carer",loginStatus:row.login_status||"",mustChangePassword:Boolean(row.must_change_password),lastLoginAt:row.last_login_at||"",createdAt:row.created_at,updatedAt:row.updated_at};}


async function ensureClient(db, session, clientId) {
  return db.prepare(`SELECT id,branch_id FROM clients WHERE id=? AND organisation_id=? ${branchRestricted(session)?"AND branch_id=?":""}`).bind(clientId, session.organisation_id,...(branchRestricted(session)?[activeBranch(session)]:[])).first();
}
function carePlanInput(input) {
  const keys=["title","status","effectiveDate","reviewDate","authorName","planType","planSummary","whatMatters","preferences","consentStatus","capacityStatus","decisionMaker","reviewNotes"];
  const v={}; for(const k of keys)v[k]=clean(input[k]);
  v.sections=Array.isArray(input.sections)?input.sections.map((section,index)=>({
    category:clean(section.category), title:clean(section.title)||clean(section.category), enabled:section.enabled===false?0:1,
    assessedNeeds:clean(section.assessedNeeds), desiredOutcomes:clean(section.desiredOutcomes), supportInstructions:clean(section.supportInstructions),
    risksControls:clean(section.risksControls), personalPreferences:clean(section.personalPreferences), reviewDate:clean(section.reviewDate), sortOrder:index
  })).filter(section=>section.category&&section.title):[];
  if(!v.title || !v.reviewDate) return {error:"Enter a care-plan title and review date."};
  if(!["Draft","Active","Under review","Archived"].includes(v.status)) v.status="Draft";
  if(!["Not recorded","Person consented","Representative consented","Best-interest decision","Consent declined"].includes(v.consentStatus)) v.consentStatus="Not recorded";
  if(!["Not assessed","Has capacity","Lacks capacity","Capacity varies","Assessment required"].includes(v.capacityStatus)) v.capacityStatus="Not assessed";
  return {v};
}
async function carePlanSections(db,organisationId,planIds){
  if(!planIds.length)return {};
  const marks=planIds.map(()=>'?').join(',');
  const rows=await db.prepare(`SELECT * FROM care_plan_sections WHERE organisation_id=? AND care_plan_id IN (${marks}) ORDER BY sort_order,title`).bind(organisationId,...planIds).all();
  const grouped={}; for(const row of rows.results||[])(grouped[row.care_plan_id]??=[]).push(toCarePlanSection(row)); return grouped;
}
function sectionStatements(db,session,planId,sections){
  const statements=[db.prepare("DELETE FROM care_plan_sections WHERE care_plan_id=? AND organisation_id=?").bind(planId,session.organisation_id)];
  for(const section of sections)statements.push(db.prepare(`INSERT INTO care_plan_sections(id,organisation_id,care_plan_id,category,title,enabled,assessed_needs,desired_outcomes,support_instructions,risks_controls,personal_preferences,review_date,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,planId,section.category,section.title,section.enabled,section.assessedNeeds,section.desiredOutcomes,section.supportInstructions,section.risksControls,section.personalPreferences,section.reviewDate||null,section.sortOrder));
  return statements;
}
function toCarePlanSection(r){return {id:r.id,category:r.category,title:r.title,enabled:Boolean(r.enabled),assessedNeeds:r.assessed_needs||"",desiredOutcomes:r.desired_outcomes||"",supportInstructions:r.support_instructions||"",risksControls:r.risks_controls||"",personalPreferences:r.personal_preferences||"",reviewDate:r.review_date||"",sortOrder:r.sort_order||0};}
async function listCarePlans(db, session, clientId){
  if(!await ensureClient(db,session,clientId)) return json({error:{code:"CLIENT_NOT_FOUND",message:"Client not found."}},404);
  const r=await db.prepare("SELECT * FROM care_plans WHERE organisation_id=? AND client_id=? ORDER BY CASE status WHEN 'Active' THEN 0 WHEN 'Under review' THEN 1 WHEN 'Draft' THEN 2 ELSE 3 END, review_date").bind(session.organisation_id,clientId).all();
  const sections=await carePlanSections(db,session.organisation_id,(r.results||[]).map(x=>x.id));
  return json({carePlans:r.results.map(row=>({...toCarePlan(row),sections:sections[row.id]||[]}))});
}

async function listAllCarePlans(db, session, url){
  const status=clean(url.searchParams.get("status"));
  const params=[session.organisation_id]; let where="cp.organisation_id=?";
  if(status && ["Draft","Active","Under review","Archived"].includes(status)){where+=" AND cp.status=?";params.push(status);}
  const result=await db.prepare(`SELECT cp.*, c.first_name, c.last_name, c.preferred_name FROM care_plans cp JOIN clients c ON c.id=cp.client_id AND c.organisation_id=cp.organisation_id WHERE ${where} ORDER BY CASE cp.status WHEN 'Active' THEN 0 WHEN 'Under review' THEN 1 WHEN 'Draft' THEN 2 ELSE 3 END,cp.review_date,c.last_name COLLATE NOCASE,c.first_name COLLATE NOCASE`).bind(...params).all();
  const sections=await carePlanSections(db,session.organisation_id,(result.results||[]).map(x=>x.id));
  return json({carePlans:result.results.map(row=>({...toCarePlan(row),sections:sections[row.id]||[],clientName:[row.preferred_name||row.first_name,row.last_name].filter(Boolean).join(" ")}))});
}
async function createCarePlan(request,db,session,clientId){
  if(!hasRole(session,["owner","manager","organisation_owner","organisation_admin","branch_manager","office_staff","senior_carer"])) return forbidden();
  if(!await ensureClient(db,session,clientId)) return json({error:{code:"CLIENT_NOT_FOUND",message:"Client not found."}},404);
  const parsed=carePlanInput(await readJson(request)); if(parsed.error)return json({error:{code:"VALIDATION_ERROR",message:parsed.error}},400); const v=parsed.v,id=crypto.randomUUID();
  const statements=[db.prepare(`INSERT INTO care_plans (id,organisation_id,branch_id,client_id,title,status,effective_date,review_date,author_name,plan_type,plan_summary,what_matters,preferences,consent_status,capacity_status,decision_maker,review_notes,approval_status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)`).bind(id,session.organisation_id,activeBranch(session),clientId,v.title,v.status==='Active'?'Draft':v.status,v.effectiveDate||null,v.reviewDate,v.authorName,v.planType||'Comprehensive care plan',v.planSummary,v.whatMatters,v.preferences,v.consentStatus,v.capacityStatus,v.decisionMaker,v.reviewNotes,session.user_id),...sectionStatements(db,session,id,v.sections),auditStatement(db,session.organisation_id,session.user_id,"care_plan.created","care_plan",id,{clientId,title:v.title,status:'Draft',sections:v.sections.length})];
  await db.batch(statements); const row=await db.prepare("SELECT * FROM care_plans WHERE id=? AND organisation_id=?").bind(id,session.organisation_id).first(); return json({carePlan:{...toCarePlan(row),sections:v.sections}},201);
}
async function updateCarePlan(request,db,session,id){
  if(!hasRole(session,["owner","manager","organisation_owner","organisation_admin","branch_manager","office_staff","senior_carer"])) return forbidden();
  const existing=await db.prepare("SELECT * FROM care_plans WHERE id=? AND organisation_id=?").bind(id,session.organisation_id).first(); if(!existing)return json({error:{code:"NOT_FOUND",message:"Care plan not found."}},404);
  const parsed=carePlanInput(await readJson(request)); if(parsed.error)return json({error:{code:"VALIDATION_ERROR",message:parsed.error}},400); const v=parsed.v,next=Number(existing.version||1)+1;
  const oldSections=await carePlanSections(db,session.organisation_id,[id]); const snapshot={...toCarePlan(existing),sections:oldSections[id]||[]};
  const statements=[db.prepare("INSERT INTO care_plan_versions (id,organisation_id,care_plan_id,version,snapshot_json,created_by) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),session.organisation_id,id,existing.version||1,JSON.stringify(snapshot),session.user_id),db.prepare(`UPDATE care_plans SET title=?,status=?,version=?,effective_date=?,review_date=?,author_name=?,plan_type=?,plan_summary=?,what_matters=?,preferences=?,consent_status=?,capacity_status=?,decision_maker=?,review_notes=?,approval_status='pending',approved_by=NULL,approved_at=NULL,submitted_by=?,submitted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(v.title,v.status==='Active'?'Under review':v.status,next,v.effectiveDate||null,v.reviewDate,v.authorName,v.planType||'Comprehensive care plan',v.planSummary,v.whatMatters,v.preferences,v.consentStatus,v.capacityStatus,v.decisionMaker,v.reviewNotes,session.user_id,id,session.organisation_id),...sectionStatements(db,session,id,v.sections),auditStatement(db,session.organisation_id,session.user_id,"care_plan.updated","care_plan",id,{version:next,status:v.status,sections:v.sections.length})];
  await db.batch(statements); return json({carePlan:{...toCarePlan(await db.prepare("SELECT * FROM care_plans WHERE id=? AND organisation_id=?").bind(id,session.organisation_id).first()),sections:v.sections}});
}
async function archiveCarePlan(db,session,id){if(!hasRole(session,["owner","manager","organisation_owner","organisation_admin","branch_manager"]))return forbidden();const r=await db.prepare("UPDATE care_plans SET status='Archived',updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?").bind(id,session.organisation_id).run();if(!r.meta.changes)return json({error:{code:"NOT_FOUND",message:"Care plan not found."}},404);await audit(db,session.organisation_id,session.user_id,"care_plan.archived","care_plan",id,{});return json({ok:true});}
function toCarePlan(r){return {id:r.id,clientId:r.client_id,title:r.title,status:r.status,version:r.version,effectiveDate:r.effective_date||"",reviewDate:r.review_date,authorName:r.author_name||"",planType:r.plan_type||"Comprehensive care plan",planSummary:r.plan_summary||"",whatMatters:r.what_matters||r.personal_details||"",preferences:r.preferences||"",consentStatus:r.consent_status||"Not recorded",capacityStatus:r.capacity_status||"Not assessed",decisionMaker:r.decision_maker||"",reviewNotes:r.review_notes||"",personalDetails:r.personal_details||"",medicalConditions:r.medical_conditions||"",communication:r.communication||"",mobility:r.mobility||"",nutritionHydration:r.nutrition_hydration||"",medicationSupport:r.medication_support||"",continence:r.continence||"",skinIntegrity:r.skin_integrity||"",mentalCapacity:r.mental_capacity||"",risks:r.risks||"",desiredOutcomes:r.desired_outcomes||"",approvalStatus:r.approval_status||"pending",approvedAt:r.approved_at||"",submittedAt:r.submitted_at||"",visitGenerationStatus:r.visit_generation_status||"not_generated",visitsGeneratedAt:r.visits_generated_at||"",createdAt:r.created_at,updatedAt:r.updated_at};}

function riskInput(input){const v={category:clean(input.category)||"General Risk",title:clean(input.title),severity:clean(input.severity)||"Medium",likelihood:clean(input.likelihood)||"Possible",controls:clean(input.controls),actions:clean(input.actions),status:clean(input.status)||"Active",reviewDate:clean(input.reviewDate)};if(!v.title||!v.reviewDate)return {error:"Enter a risk title and review date."};return {v};}
async function listRisks(db,session,clientId){if(!await ensureClient(db,session,clientId))return json({error:{code:"CLIENT_NOT_FOUND",message:"Client not found."}},404);const r=await db.prepare("SELECT * FROM risk_assessments WHERE organisation_id=? AND client_id=? ORDER BY CASE severity WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, review_date").bind(session.organisation_id,clientId).all();return json({risks:r.results.map(toRisk)});}
async function createRisk(request,db,session,clientId){if(!hasRole(session,["owner","manager","carer"]))return forbidden();const p=riskInput(await readJson(request));if(p.error)return json({error:{code:"VALIDATION_ERROR",message:p.error}},400);const v=p.v,id=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO risk_assessments (id,organisation_id,branch_id,client_id,category,title,severity,likelihood,controls,actions,status,review_date,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,session.organisation_id,activeBranch(session),clientId,v.category,v.title,v.severity,v.likelihood,v.controls,v.actions,v.status,v.reviewDate,session.user_id),auditStatement(db,session.organisation_id,session.user_id,"risk.created","risk",id,{clientId,title:v.title,severity:v.severity})]);return json({risk:toRisk(await db.prepare("SELECT * FROM risk_assessments WHERE id=?").bind(id).first())},201);}
async function updateRisk(request,db,session,id){if(!hasRole(session,["owner","manager","carer"]))return forbidden();const p=riskInput(await readJson(request));if(p.error)return json({error:{code:"VALIDATION_ERROR",message:p.error}},400);const v=p.v,r=await db.prepare("UPDATE risk_assessments SET category=?,title=?,severity=?,likelihood=?,controls=?,actions=?,status=?,review_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?").bind(v.category,v.title,v.severity,v.likelihood,v.controls,v.actions,v.status,v.reviewDate,id,session.organisation_id).run();if(!r.meta.changes)return json({error:{code:"NOT_FOUND",message:"Risk assessment not found."}},404);await audit(db,session.organisation_id,session.user_id,"risk.updated","risk",id,{severity:v.severity,status:v.status});return json({risk:toRisk(await db.prepare("SELECT * FROM risk_assessments WHERE id=?").bind(id).first())});}
function toRisk(r){return {id:r.id,clientId:r.client_id,category:r.category,title:r.title,severity:r.severity,likelihood:r.likelihood,controls:r.controls||"",actions:r.actions||"",status:r.status,reviewDate:r.review_date,createdAt:r.created_at,updatedAt:r.updated_at};}

function documentInput(input){const v={name:clean(input.name),documentType:clean(input.documentType)||"Other",documentDate:clean(input.documentDate),reviewDate:clean(input.reviewDate),referenceUrl:clean(input.referenceUrl),notes:clean(input.notes),status:clean(input.status)||"Current"};if(!v.name)return {error:"Enter a document name."};return {v};}
async function listDocuments(db,session,clientId){if(!await ensureClient(db,session,clientId))return json({error:{code:"CLIENT_NOT_FOUND",message:"Client not found."}},404);const r=await db.prepare("SELECT * FROM client_documents WHERE organisation_id=? AND client_id=? ORDER BY created_at DESC").bind(session.organisation_id,clientId).all();return json({documents:r.results.map(toDocument)});}
async function createDocument(request,db,session,clientId){if(!hasRole(session,["owner","manager","carer"]))return forbidden();const p=documentInput(await readJson(request));if(p.error)return json({error:{code:"VALIDATION_ERROR",message:p.error}},400);const v=p.v,id=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO client_documents (id,organisation_id,branch_id,client_id,name,document_type,document_date,review_date,reference_url,notes,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,session.organisation_id,activeBranch(session),clientId,v.name,v.documentType,v.documentDate||null,v.reviewDate||null,v.referenceUrl,v.notes,v.status,session.user_id),auditStatement(db,session.organisation_id,session.user_id,"document.added","document",id,{clientId,name:v.name,type:v.documentType})]);return json({document:toDocument(await db.prepare("SELECT * FROM client_documents WHERE id=?").bind(id).first())},201);}
async function archiveDocument(db,session,id){if(!hasRole(session,["owner","manager"]))return forbidden();const r=await db.prepare("UPDATE client_documents SET status='Archived',updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?").bind(id,session.organisation_id).run();if(!r.meta.changes)return json({error:{code:"NOT_FOUND",message:"Document not found."}},404);await audit(db,session.organisation_id,session.user_id,"document.archived","document",id,{});return json({ok:true});}
function toDocument(r){return {id:r.id,clientId:r.client_id,name:r.name,documentType:r.document_type,documentDate:r.document_date||"",reviewDate:r.review_date||"",referenceUrl:r.reference_url||"",notes:r.notes||"",status:r.status,createdAt:r.created_at};}

async function listUsers(db, session) {
  if (!hasRole(session, ["owner", "manager", "auditor"])) return forbidden();
  const result = await db.prepare("SELECT u.id,u.email,u.display_name,u.role,u.access_level,u.home_branch_id,u.status,u.must_change_password,u.last_login_at,u.created_at,ucr.role_id AS custom_role_id,cr.name AS custom_role_name FROM users u LEFT JOIN user_custom_roles ucr ON ucr.user_id=u.id AND ucr.organisation_id=u.organisation_id LEFT JOIN custom_roles cr ON cr.id=ucr.role_id WHERE u.organisation_id=? ORDER BY u.display_name COLLATE NOCASE").bind(session.organisation_id).all();
  return json({ users: result.results.map(toUser) });
}

async function createUser(request, db, session) {
  if (!await userHasPermission(db, session, "security.users.manage")) return forbidden();
  const input = await readJson(request);
  const email = clean(input.email).toLowerCase();
  const name = clean(input.displayName);
  const accessLevel = clean(input.accessLevel || input.role);
  const role = legacyRole(accessLevel);
  const branchId = clean(input.branchId) || null;
  const customRoleId = clean(input.customRoleId) || null;
  const password = String(input.temporaryPassword || "");
  if (!email || !name || !allowedAccessLevels().includes(accessLevel) || password.length < 12) return json({ error: { code: "VALIDATION_ERROR", message: "Enter a name, valid email, role and temporary password of at least 12 characters." } }, 400);
  const limit = await enforceOrganisationSubscriptionLimit(db, session.organisation_id, "users");
  if (limit) return limit;
  const secured = await hashPassword(password);
  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare("INSERT INTO users (id,organisation_id,email,display_name,role,access_level,home_branch_id,password_hash,password_salt,password_iterations,status,must_change_password) VALUES (?,?,?,?,?,?,?,?,?,?, 'active',1)").bind(id, session.organisation_id, email, name, role, accessLevel, branchId, secured.hash, secured.salt, PASSWORD_ITERATIONS),
      ...(customRoleId ? [db.prepare("INSERT INTO user_custom_roles(user_id,role_id,organisation_id,branch_id,assigned_by) SELECT ?,id,?,?,? FROM custom_roles WHERE id=? AND organisation_id=? AND is_active=1").bind(id,session.organisation_id,branchId,session.user_id,customRoleId,session.organisation_id)] : []),
      auditStatement(db, session.organisation_id, session.user_id, "user.created", "user", id, { email, role, accessLevel, branchId, customRoleId })
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ error: { code: "EMAIL_EXISTS", message: "A user with that email already exists." } }, 409);
    throw error;
  }
  return json({ user: { id, email, displayName: name, role, accessLevel, branchId, status: "active", mustChangePassword: true } }, 201);
}

async function updateUser(request, db, session, id) {
  if (!await userHasPermission(db, session, "security.users.manage")) return forbidden();
  if (id === session.user_id) return json({ error: { code: "SELF_EDIT_BLOCKED", message: "Use the password and profile controls for your own account." } }, 400);
  const input = await readJson(request);
  const name = clean(input.displayName);
  const accessLevel = clean(input.accessLevel || input.role);
  const role = legacyRole(accessLevel);
  const branchId = clean(input.branchId) || null;
  const status = clean(input.status);
  const customRoleId = clean(input.customRoleId) || null;
  if (!name || !allowedAccessLevels().includes(accessLevel) || !["active", "disabled"].includes(status)) return json({ error: { code: "VALIDATION_ERROR", message: "Enter a name, valid access level and status." } }, 400);
  const existing = await db.prepare("SELECT id,status FROM users WHERE id=? AND organisation_id=?").bind(id,session.organisation_id).first();
  if (!existing) return json({ error: { code: "USER_NOT_FOUND", message: "User account not found." } }, 404);
  if (existing.status !== "active" && status === "active") {
    const limit = await enforceOrganisationSubscriptionLimit(db, session.organisation_id, "users");
    if (limit) return limit;
  }
  const statements = [db.prepare("UPDATE users SET display_name=?,role=?,access_level=?,home_branch_id=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?").bind(name, role, accessLevel, branchId, status, id, session.organisation_id), db.prepare("DELETE FROM user_custom_roles WHERE user_id=? AND organisation_id=?").bind(id,session.organisation_id)];
  if(customRoleId) statements.push(db.prepare("INSERT INTO user_custom_roles(user_id,role_id,organisation_id,branch_id,assigned_by) SELECT ?,id,?,?,? FROM custom_roles WHERE id=? AND organisation_id=? AND is_active=1").bind(id,session.organisation_id,branchId,session.user_id,customRoleId,session.organisation_id));
  statements.push(auditStatement(db, session.organisation_id, session.user_id, "user.updated", "user", id, { role, accessLevel, branchId, customRoleId, status }));
  await db.batch(statements);
  if (status === "disabled") await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
  return json({ ok: true });
}

async function updateOrganisation(request, db, session) {
  if (!hasRole(session, ["owner"])) return forbidden();
  const input = await readJson(request), name = clean(input.name);
  if (name.length < 2) return json({ error: { code: "VALIDATION_ERROR", message: "Enter an organisation name." } }, 400);
  await db.batch([
    db.prepare("UPDATE organisations SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name, session.organisation_id),
    auditStatement(db, session.organisation_id, session.user_id, "organisation.updated", "organisation", session.organisation_id, { name })
  ]);
  return json({ organisation: { id: session.organisation_id, name } });
}

async function listAudit(db, session, url) {
  if (!hasRole(session, ["owner", "manager", "auditor"])) return forbidden();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const result = await db.prepare(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.detail_json,a.created_at,u.display_name AS user_name,u.email AS user_email FROM audit_log a LEFT JOIN users u ON u.id=a.user_id AND u.organisation_id=a.organisation_id WHERE a.organisation_id=? ORDER BY a.created_at DESC LIMIT ?`).bind(session.organisation_id, limit).all();
  return json({ events: result.results });
}

function developmentStatus(env, session) {
  return json({ database: { connected: Boolean(env.DB), binding: "DB" }, authentication: { mode: "D1 sessions", cookie: SESSION_COOKIE }, user: publicUser(session), organisation: { id: session.organisation_id, name: session.organisation_name }, deployment: { version: VERSION, checkedAt: new Date().toISOString() } });
}

function allowedRoles() { return ["owner", "manager", "carer", "auditor"]; }
function allowedAccessLevels(){return ["organisation_owner","organisation_admin","branch_manager","senior_carer","carer","office_staff","auditor","family"]; }
function legacyRole(level){return ({organisation_owner:"owner",organisation_admin:"owner",branch_manager:"manager",senior_carer:"carer",carer:"carer",office_staff:"manager",auditor:"auditor",family:"auditor"})[level]||"auditor";}
function hasRole(session, roles) { if (session.is_platform_user) return true; return roles.includes(session.role) || roles.includes(session.access_level); }
function requireManagementWorkspace(session) {
  if (session.is_platform_user) return null;
  const allowed = ['organisation_owner','organisation_admin','branch_manager','office_staff','auditor','owner','manager'];
  return allowed.includes(session.access_level) || allowed.includes(session.role) ? null : forbidden();
}
function forbidden() { return json({ error: { code: "FORBIDDEN", message: "Your account does not have permission to perform this action." } }, 403); }
function badRequest(message) { return json({ error: { code: "VALIDATION_ERROR", message } }, 400); }
async function permitted(db, session, permission, action) {
  if (!await userHasPermission(db, session, permission)) return forbidden();
  return action();
}
function unauthorised(message="Sign in to continue.",code="UNAUTHORISED") { return json({ error: { code, message } }, 401, { "set-cookie": expiredSessionCookie() }); }
function databaseRequired(message = "The D1 database binding named DB is not configured.") { return json({ error: { code: "DATABASE_NOT_CONFIGURED", message } }, 503); }
function methodNotAllowed(allow) { return json({ error: { code: "METHOD_NOT_ALLOWED", message: "This method is not allowed." } }, 405, { allow: allow.join(", ") }); }
function publicUser(row) { return { id: row.user_id || row.id, staffId: row.staff_id || null, organisationId: row.organisation_id, organisationName: row.organisation_name, branchId: row.active_branch_id || row.home_branch_id || null, branchName: row.branch_name || null, email: row.email, displayName: row.display_name, role: row.role, accessLevel: row.access_level || row.role, isPlatformUser: Boolean(row.is_platform_user), supportMode: Boolean(row.support_mode), supportOriginOrganisationId: row.support_origin_organisation_id || null, supportStartedAt: row.support_started_at || null, supportReason: row.support_reason || null, supportAccessMode: row.support_access_mode || null, mustChangePassword: Boolean(row.must_change_password) }; }
function toUser(row) { return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, accessLevel: row.access_level || row.role, branchId: row.home_branch_id || null, customRoleId: row.custom_role_id || null, customRoleName: row.custom_role_name || null, status: row.status, mustChangePassword: Boolean(row.must_change_password), lastLoginAt: row.last_login_at, createdAt: row.created_at }; }
function clean(value) { return String(value ?? "").trim(); }
async function readJson(request,maxBytes=MAX_JSON_BYTES) {
  const contentType=clean(request.headers.get("content-type")).toLowerCase();
  const declared=Number(request.headers.get("content-length")||0);
  if(Number.isFinite(declared)&&declared>maxBytes)throw new HttpError(413,"REQUEST_TOO_LARGE",`Request data must be ${Math.floor(maxBytes/1024)} KB or smaller.`);
  if(request.body&&!/^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|$)/i.test(contentType))throw new HttpError(415,"JSON_REQUIRED","Send request data as application/json.");
  if(!request.body)return {};
  const reader=request.body.getReader(),chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new HttpError(413,"REQUEST_TOO_LARGE",`Request data must be ${Math.floor(maxBytes/1024)} KB or smaller.`);}chunks.push(value);}
  if(total===0)return {};
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new HttpError(400,"INVALID_JSON","Request data is not valid JSON.")}
}
async function readResponseJson(response,maxBytes=512*1024){
  const declared=Number(response.headers.get("content-length")||0);
  if(Number.isFinite(declared)&&declared>maxBytes)throw new HttpError(502,"UPSTREAM_RESPONSE_TOO_LARGE","A connected product returned too much data.");
  if(!response.body)return {};
  const reader=response.body.getReader(),chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new HttpError(502,"UPSTREAM_RESPONSE_TOO_LARGE","A connected product returned too much data.");}chunks.push(value);}
  if(!total)return {};
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new HttpError(502,"INVALID_UPSTREAM_RESPONSE","A connected product returned invalid data.")}
}
async function audit(db, organisationId, userId, action, entityType, entityId, detail) { await auditStatement(db, organisationId, userId, action, entityType, entityId, detail).run(); }
function auditStatement(db, organisationId, userId, action, entityType, entityId, detail) { return db.prepare("INSERT INTO audit_log (id,organisation_id,user_id,action,entity_type,entity_id,detail_json) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), organisationId, userId || null, action, entityType, entityId || null, JSON.stringify(detail || {})); }
async function writeAudit(db, session, action, entityType, entityId, detail) { return audit(db, session.organisation_id, session.user_id, action, entityType, entityId, detail); }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function cookieValue(request, name) { const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return match ? decodeURIComponent(match[1]) : ""; }
function sessionCookie(token, expires) { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()}`; }
function expiredSessionCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`; }
async function hashPassword(password) { const salt = crypto.getRandomValues(new Uint8Array(16)); const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS); return { salt: base64(salt), hash: base64(hash) }; }
async function verifyPassword(password, saltBase64, expectedBase64, iterations) { const rounds=Math.max(100000,Math.min(Number(iterations)||PASSWORD_ITERATIONS,CLOUDFLARE_WORKERS_PBKDF2_MAX_ITERATIONS));const actual = await derivePassword(password, fromBase64(saltBase64), rounds); return timingSafeEqual(actual, fromBase64(expectedBase64)); }
async function dummyPasswordCheck(password) { const actual=await derivePassword(password,new Uint8Array(16),PASSWORD_ITERATIONS);return timingSafeEqual(actual,new Uint8Array(32))&&false; }
async function derivePassword(password, salt, iterations) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256); return new Uint8Array(bits); }
async function sha256Base64(value) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return base64(new Uint8Array(digest)); }
async function sha256BytesBase64(value) { const bytes=value instanceof Uint8Array?value:new Uint8Array(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return base64(new Uint8Array(digest)); }
async function secureEqualText(provided,expected){const encoder=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",encoder.encode(String(provided||""))),crypto.subtle.digest("SHA-256",encoder.encode(String(expected||"")))]);return timingSafeEqual(new Uint8Array(a),new Uint8Array(b));}
function timingSafeEqual(a, b) { if (a.length !== b.length) return false; if(typeof crypto.subtle.timingSafeEqual==="function")return crypto.subtle.timingSafeEqual(a,b);let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]; return diff === 0; }
function databaseTimestamp(value){if(!value)return null;const text=String(value),normalised=/[zZ]|[+-]\d\d:\d\d$/.test(text)?text:text.includes("T")?`${text}Z`:`${text.replace(" ","T")}Z`;const date=new Date(normalised);return Number.isNaN(date.getTime())?null:date;}
function base64(bytes) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function fromBase64(value) { const binary = atob(value); return Uint8Array.from(binary, char => char.charCodeAt(0)); }
function json(payload, status = 200, headers = {}) { return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "cross-origin-resource-policy": "same-origin", "permissions-policy": "camera=(), microphone=(), geolocation=()", "referrer-policy": "no-referrer", "strict-transport-security": "max-age=31536000", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow, noarchive", ...headers } }); }




async function ensureOrganisationClient(db,session,clientId){return db.prepare("SELECT id,first_name,last_name FROM clients WHERE id=? AND organisation_id=? AND status<>'Archived'").bind(clientId,session.organisation_id).first();}
async function listMedication(db,session,url){
  const clientId=clean(url.searchParams.get('clientId')); if(!clientId)return json({error:{code:'VALIDATION_ERROR',message:'Choose a client.'}},400);
  if(!await ensureOrganisationClient(db,session,clientId))return json({error:{code:'NOT_FOUND',message:'Client not found.'}},404);
  const [meds,mar,stock]=await Promise.all([
    db.prepare(`SELECT m.*,u.display_name AS created_by_name FROM medications m LEFT JOIN users u ON u.id=m.created_by AND u.organisation_id=m.organisation_id WHERE m.organisation_id=? AND m.client_id=? ORDER BY CASE m.status WHEN 'active' THEN 0 ELSE 1 END,m.name`).bind(session.organisation_id,clientId).all(),
    db.prepare(`SELECT a.*,m.name AS medication_name,m.strength,m.dose,m.is_prn,u.display_name AS recorded_by_name FROM medication_administrations a JOIN medications m ON m.id=a.medication_id AND m.organisation_id=a.organisation_id LEFT JOIN users u ON u.id=a.recorded_by AND u.organisation_id=a.organisation_id WHERE a.organisation_id=? AND a.client_id=? ORDER BY a.administered_at DESC LIMIT 250`).bind(session.organisation_id,clientId).all(),
    db.prepare(`SELECT t.*,m.name AS medication_name,u.display_name AS recorded_by_name FROM medication_stock_transactions t JOIN medications m ON m.id=t.medication_id AND m.organisation_id=t.organisation_id LEFT JOIN users u ON u.id=t.recorded_by AND u.organisation_id=t.organisation_id WHERE t.organisation_id=? AND t.client_id=? ORDER BY t.created_at DESC LIMIT 250`).bind(session.organisation_id,clientId).all()
  ]);
  return json({medications:(meds.results||[]).map(x=>({...x,scheduledTimes:safeJson(x.scheduled_times_json,[])})),administrations:mar.results||[],stockTransactions:stock.results||[]});
}
async function saveMedication(request,db,session){
  const i=await readJson(request),clientId=clean(i.clientId),name=clean(i.name),dose=clean(i.dose); if(!clientId||!name||!dose)return json({error:{code:'VALIDATION_ERROR',message:'Client, medication name and dose are required.'}},400);
  if(!await ensureOrganisationClient(db,session,clientId))return json({error:{code:'NOT_FOUND',message:'Client not found.'}},404);
  const id=clean(i.id)||crypto.randomUUID(),times=Array.isArray(i.scheduledTimes)?i.scheduledTimes.map(clean).filter(Boolean):clean(i.scheduledTimes).split(',').map(x=>x.trim()).filter(Boolean);
  const status=clean(i.status)||'active',discontinued=status==='discontinued';
  await db.prepare(`INSERT INTO medications(id,organisation_id,client_id,name,strength,form,route,dose,instructions,frequency,scheduled_times_json,start_date,end_date,is_prn,prn_protocol,min_interval_minutes,max_dose_24h,stock_quantity,stock_unit,low_stock_threshold,status,discontinued_reason,discontinued_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,strength=excluded.strength,form=excluded.form,route=excluded.route,dose=excluded.dose,instructions=excluded.instructions,frequency=excluded.frequency,scheduled_times_json=excluded.scheduled_times_json,start_date=excluded.start_date,end_date=excluded.end_date,is_prn=excluded.is_prn,prn_protocol=excluded.prn_protocol,min_interval_minutes=excluded.min_interval_minutes,max_dose_24h=excluded.max_dose_24h,stock_quantity=excluded.stock_quantity,stock_unit=excluded.stock_unit,low_stock_threshold=excluded.low_stock_threshold,status=excluded.status,discontinued_reason=excluded.discontinued_reason,discontinued_at=excluded.discontinued_at,updated_at=CURRENT_TIMESTAMP`).bind(id,session.organisation_id,clientId,name,clean(i.strength),clean(i.form),clean(i.route),dose,clean(i.instructions),clean(i.frequency),JSON.stringify(times),clean(i.startDate)||null,clean(i.endDate)||null,i.isPrn?1:0,clean(i.prnProtocol),nullableNumber(i.minIntervalMinutes),clean(i.maxDose24h),nullableNumber(i.stockQuantity),clean(i.stockUnit),nullableNumber(i.lowStockThreshold)??5,status,discontinued?clean(i.discontinuedReason):null,discontinued?new Date().toISOString():null,session.user_id).run();
  await audit(db,session.organisation_id,session.user_id,'medication.saved','medication',id,{clientId,name,status}); return json({ok:true,id},201);
}
function localDateString(value){const d=value?new Date(value):new Date();return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
async function administerMedication(request,db,session,id){
  const med=await db.prepare('SELECT * FROM medications WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first(); if(!med)return json({error:{code:'NOT_FOUND',message:'Medication not found.'}},404);
  const i=await readJson(request),outcome=clean(i.outcome); if(!outcome)return json({error:{code:'VALIDATION_ERROR',message:'Choose an administration outcome.'}},400);
  const allowed=['administered','prompted','refused','omitted','unavailable','hospitalised','asleep','missed']; if(!allowed.includes(outcome))return json({error:{code:'VALIDATION_ERROR',message:'Invalid administration outcome.'}},400);
  if(med.is_prn&&outcome==='administered'&&!clean(i.prnReason||i.reason))return json({error:{code:'VALIDATION_ERROR',message:'Record why the PRN medication was required.'}},400);
  const stockUsed=Math.max(0,Number(i.stockUsed)||0),stockChange=outcome==='administered'?-stockUsed:0,adminId=crypto.randomUUID(),administeredAt=clean(i.administeredAt)||new Date().toISOString(),scheduledAt=clean(i.scheduledAt)||null;
  const balance=med.stock_quantity===null?null:Math.max(0,Number(med.stock_quantity)+stockChange);
  const statements=[
    db.prepare(`INSERT INTO medication_administrations(id,organisation_id,medication_id,client_id,visit_id,scheduled_at,scheduled_date,administered_at,outcome,dose_given,reason,notes,stock_change,prn_reason,prn_effectiveness,effectiveness_reviewed_at,recorded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(adminId,session.organisation_id,id,med.client_id,clean(i.visitId)||null,scheduledAt,scheduledAt?localDateString(scheduledAt):localDateString(administeredAt),administeredAt,outcome,clean(i.doseGiven)||med.dose,clean(i.reason),clean(i.notes),stockChange,clean(i.prnReason),clean(i.prnEffectiveness),clean(i.prnEffectiveness)?new Date().toISOString():null,session.user_id),
    db.prepare(`UPDATE medications SET stock_quantity=CASE WHEN stock_quantity IS NULL THEN NULL ELSE MAX(0,stock_quantity+?) END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(stockChange,id,session.organisation_id),
    auditStatement(db,session.organisation_id,session.user_id,'medication.administered','medication_administration',adminId,{medicationId:id,outcome,clientId:med.client_id,scheduledAt})
  ];
  if(stockChange)statements.push(db.prepare(`INSERT INTO medication_stock_transactions(id,organisation_id,medication_id,client_id,transaction_type,quantity,balance_after,reason,administration_id,recorded_by) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,id,med.client_id,'administration',stockChange,balance,`eMAR: ${outcome}`,adminId,session.user_id));
  try{await db.batch(statements);}catch(e){if(String(e?.message||e).includes('UNIQUE'))return json({error:{code:'DUPLICATE_ENTRY',message:'This scheduled dose already has an eMAR outcome.'}},409);throw e;}
  return json({ok:true,id:adminId},201);
}
async function dailyMar(db,session,url){
  const clientId=clean(url.searchParams.get('clientId')),date=clean(url.searchParams.get('date'))||localDateString();
  if(!clientId)return json({error:{code:'VALIDATION_ERROR',message:'Choose a client.'}},400);
  if(!await ensureOrganisationClient(db,session,clientId))return json({error:{code:'NOT_FOUND',message:'Client not found.'}},404);
  const [meds,entries]=await Promise.all([
    db.prepare(`SELECT * FROM medications WHERE organisation_id=? AND client_id=? AND status='active' AND (start_date IS NULL OR start_date='' OR start_date<=?) AND (end_date IS NULL OR end_date='' OR end_date>=?) ORDER BY name`).bind(session.organisation_id,clientId,date,date).all(),
    db.prepare(`SELECT a.*,m.name AS medication_name,m.strength,m.dose,m.is_prn,u.display_name AS recorded_by_name FROM medication_administrations a JOIN medications m ON m.id=a.medication_id AND m.organisation_id=a.organisation_id LEFT JOIN users u ON u.id=a.recorded_by AND u.organisation_id=a.organisation_id WHERE a.organisation_id=? AND a.client_id=? AND (a.scheduled_date=? OR substr(COALESCE(a.scheduled_at,a.administered_at),1,10)=?) ORDER BY COALESCE(a.scheduled_at,a.administered_at)`).bind(session.organisation_id,clientId,date,date).all()
  ]);
  const rows=[];
  for(const m of meds.results||[]){
    const times=safeJson(m.scheduled_times_json,[]);
    if(m.is_prn){rows.push({kind:'prn',medication:m,scheduledAt:null,entry:null});continue;}
    for(const time of times){const scheduledAt=`${date}T${time.length===5?time+':00':time}`;const entry=(entries.results||[]).find(e=>e.medication_id===m.id&&e.scheduled_at===scheduledAt&&!e.is_void);rows.push({kind:'scheduled',medication:m,scheduledAt,entry:entry||null});}
    if(!times.length)rows.push({kind:'unscheduled',medication:m,scheduledAt:null,entry:null});
  }
  return json({date,rows,entries:entries.results||[]});
}
async function adjustMedicationStock(request,db,session,id){
  const med=await db.prepare('SELECT * FROM medications WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first();if(!med)return json({error:{code:'NOT_FOUND',message:'Medication not found.'}},404);
  const i=await readJson(request),quantity=Number(i.quantity),type=clean(i.transactionType)||'adjustment',reason=clean(i.reason);if(!Number.isFinite(quantity)||quantity===0)return json({error:{code:'VALIDATION_ERROR',message:'Enter a non-zero stock quantity.'}},400);if(!reason)return json({error:{code:'VALIDATION_ERROR',message:'Enter a reason for the stock change.'}},400);
  const current=Number(med.stock_quantity)||0,balance=Math.max(0,current+quantity),tid=crypto.randomUUID();
  await db.batch([db.prepare('UPDATE medications SET stock_quantity=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?').bind(balance,id,session.organisation_id),db.prepare(`INSERT INTO medication_stock_transactions(id,organisation_id,medication_id,client_id,transaction_type,quantity,balance_after,reason,recorded_by) VALUES(?,?,?,?,?,?,?,?,?)`).bind(tid,session.organisation_id,id,med.client_id,type,quantity,balance,reason,session.user_id),auditStatement(db,session.organisation_id,session.user_id,'medication.stock_adjusted','medication',id,{quantity,balance,reason,type})]);return json({ok:true,balance},201);
}
async function correctMedicationAdministration(request,db,session,id){
  const original=await db.prepare(`SELECT a.*,m.stock_quantity,m.client_id AS med_client_id FROM medication_administrations a JOIN medications m ON m.id=a.medication_id AND m.organisation_id=a.organisation_id WHERE a.id=? AND a.organisation_id=?`).bind(id,session.organisation_id).first();if(!original)return json({error:{code:'NOT_FOUND',message:'MAR entry not found.'}},404);if(original.is_void)return json({error:{code:'VALIDATION_ERROR',message:'This MAR entry has already been corrected.'}},400);
  const i=await readJson(request),reason=clean(i.correctionReason);if(!reason)return json({error:{code:'VALIDATION_ERROR',message:'Enter the reason for correction.'}},400);
  const replacementId=crypto.randomUUID(),outcome=clean(i.outcome)||original.outcome,stockUsed=Math.max(0,Number(i.stockUsed)||0),newChange=outcome==='administered'?-stockUsed:0,stockDelta=-Number(original.stock_change||0)+newChange,balance=original.stock_quantity===null?null:Math.max(0,Number(original.stock_quantity)+stockDelta);
  const statements=[db.prepare('UPDATE medication_administrations SET is_void=1,correction_reason=? WHERE id=? AND organisation_id=?').bind(reason,id,session.organisation_id),db.prepare(`INSERT INTO medication_administrations(id,organisation_id,medication_id,client_id,visit_id,scheduled_at,scheduled_date,administered_at,outcome,dose_given,reason,notes,stock_change,prn_reason,prn_effectiveness,effectiveness_reviewed_at,corrected_from_id,correction_reason,recorded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(replacementId,session.organisation_id,original.medication_id,original.client_id,original.visit_id,original.scheduled_at,original.scheduled_date,clean(i.administeredAt)||new Date().toISOString(),outcome,clean(i.doseGiven)||original.dose_given,clean(i.reason),clean(i.notes),newChange,clean(i.prnReason),clean(i.prnEffectiveness),clean(i.prnEffectiveness)?new Date().toISOString():null,id,reason,session.user_id),db.prepare('UPDATE medications SET stock_quantity=CASE WHEN stock_quantity IS NULL THEN NULL ELSE ? END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?').bind(balance,original.medication_id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'medication.administration_corrected','medication_administration',replacementId,{originalId:id,reason,outcome})];
  if(stockDelta)statements.push(db.prepare(`INSERT INTO medication_stock_transactions(id,organisation_id,medication_id,client_id,transaction_type,quantity,balance_after,reason,administration_id,recorded_by) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),session.organisation_id,original.medication_id,original.client_id,'correction',stockDelta,balance,reason,replacementId,session.user_id));
  await db.batch(statements);return json({ok:true,id:replacementId},201);
}
async function listBodyMap(db,session,url){
  const clientId=clean(url.searchParams.get('clientId')); if(!clientId)return json({error:{code:'VALIDATION_ERROR',message:'Choose a client.'}},400);
  if(!await ensureOrganisationClient(db,session,clientId))return json({error:{code:'NOT_FOUND',message:'Client not found.'}},404);
  const records=await db.prepare(`SELECT b.*,u.display_name AS created_by_name,(SELECT COUNT(*) FROM body_map_updates x WHERE x.body_map_record_id=b.id) AS update_count FROM body_map_records b LEFT JOIN users u ON u.id=b.created_by AND u.organisation_id=b.organisation_id WHERE b.organisation_id=? AND b.client_id=? ORDER BY CASE b.status WHEN 'open' THEN 0 ELSE 1 END,b.first_observed_at DESC`).bind(session.organisation_id,clientId).all();
  return json({records:records.results||[]});
}
async function createBodyMapRecord(request,db,session){
  const i=await readJson(request),clientId=clean(i.clientId),description=clean(i.description); if(!clientId||!description)return json({error:{code:'VALIDATION_ERROR',message:'Client and description are required.'}},400);
  if(!await ensureOrganisationClient(db,session,clientId))return json({error:{code:'NOT_FOUND',message:'Client not found.'}},404); const id=crypto.randomUUID();
  await db.batch([db.prepare(`INSERT INTO body_map_records(id,organisation_id,client_id,view,x_percent,y_percent,concern_type,body_location,description,size,appearance,severity,action_taken,monitoring_plan,status,first_observed_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,session.organisation_id,clientId,clean(i.view)||'front',Number(i.xPercent)||50,Number(i.yPercent)||50,clean(i.concernType)||'other',clean(i.bodyLocation),description,clean(i.size),clean(i.appearance),clean(i.severity)||'medium',clean(i.actionTaken),clean(i.monitoringPlan),'open',clean(i.firstObservedAt)||new Date().toISOString(),session.user_id),auditStatement(db,session.organisation_id,session.user_id,'body_map.created','body_map_record',id,{clientId,concernType:clean(i.concernType)})]); return json({ok:true,id},201);
}
async function updateBodyMapRecord(request,db,session,id){
  const row=await db.prepare('SELECT * FROM body_map_records WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first(); if(!row)return json({error:{code:'NOT_FOUND',message:'Body map concern not found.'}},404); const i=await readJson(request),note=clean(i.note); if(!note)return json({error:{code:'VALIDATION_ERROR',message:'Enter a progress note.'}},400); const status=clean(i.status)||row.status,uid=crypto.randomUUID();
  await db.batch([db.prepare(`INSERT INTO body_map_updates(id,organisation_id,body_map_record_id,note,appearance,action_taken,status,recorded_by) VALUES(?,?,?,?,?,?,?,?)`).bind(uid,session.organisation_id,id,note,clean(i.appearance),clean(i.actionTaken),status,session.user_id),db.prepare(`UPDATE body_map_records SET status=?,resolved_at=CASE WHEN ?='resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?`).bind(status,status,id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'body_map.updated','body_map_record',id,{status})]); return json({ok:true,id:uid},201);
}

async function platformSearch(db,session,url){
  if(!requirePlatform(session)) return forbidden();
  const q=clean(url.searchParams.get('q')).toLowerCase();
  if(q.length<2) return json({results:[]});
  const like=`%${q}%`;
  const [clients,staff,users]=await Promise.all([
    db.prepare(`SELECT c.id,c.first_name||' '||c.last_name AS name,'client' AS type,o.id AS organisation_id,o.name AS organisation_name,b.name AS branch_name FROM clients c JOIN organisations o ON o.id=c.organisation_id LEFT JOIN branches b ON b.id=c.branch_id WHERE c.status<>'Archived' AND (lower(c.first_name||' '||c.last_name) LIKE ? OR lower(COALESCE(c.nhs_number,'')) LIKE ?) LIMIT 20`).bind(like,like).all(),
    db.prepare(`SELECT s.id,s.first_name||' '||s.last_name AS name,'staff' AS type,o.id AS organisation_id,o.name AS organisation_name,b.name AS branch_name FROM staff s JOIN organisations o ON o.id=s.organisation_id LEFT JOIN branches b ON b.id=s.branch_id WHERE s.status<>'Archived' AND lower(s.first_name||' '||s.last_name) LIKE ? LIMIT 20`).bind(like).all(),
    db.prepare(`SELECT u.id,u.display_name AS name,'user' AS type,o.id AS organisation_id,o.name AS organisation_name,b.name AS branch_name FROM users u JOIN organisations o ON o.id=u.organisation_id LEFT JOIN branches b ON b.id=u.home_branch_id WHERE lower(u.display_name) LIKE ? OR lower(u.email) LIKE ? LIMIT 20`).bind(like,like).all()
  ]);
  return json({results:[...(clients.results||[]),...(staff.results||[]),...(users.results||[])].slice(0,40)});
}
async function platformAudit(db,session,url){
  if(!requirePlatform(session)) return forbidden();
  const configured=await readPlatformSettings(db),requestedLimit=Number(url.searchParams.get('limit'));
  const limit=Math.min(Math.max(Number.isFinite(requestedLimit)&&requestedLimit>0?Math.floor(requestedLimit):configured.settings.auditPageSize,1),250);
  const offset=Math.min(Math.max(Math.floor(Number(url.searchParams.get('offset'))||0),0),100000);
  const search=clean(url.searchParams.get('q')).slice(0,120).toLowerCase(),category=clean(url.searchParams.get('category')).toLowerCase(),period=clean(url.searchParams.get('period')).toLowerCase();
  const organisationId=clean(url.searchParams.get('organisationId')),conditions=[],bindings=[];
  if(search){conditions.push(`(lower(COALESCE(a.action,'')) LIKE ? OR lower(COALESCE(a.entity_type,'')) LIKE ? OR lower(COALESCE(a.entity_id,'')) LIKE ? OR lower(COALESCE(o.name,'')) LIKE ? OR lower(COALESCE(u.display_name,'')) LIKE ?)`);const like=`%${search}%`;bindings.push(like,like,like,like,like);}
  if(organisationId){conditions.push('a.organisation_id=?');bindings.push(organisationId);}
  const categoryClause=platformAuditCategoryClause(category);if(categoryClause)conditions.push(categoryClause);
  if(period==='24h')conditions.push("a.created_at>=datetime('now','-24 hours')");
  else if(period==='7d')conditions.push("a.created_at>=datetime('now','-7 days')");
  else if(period==='30d')conditions.push("a.created_at>=datetime('now','-30 days')");
  const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';
  const prepare=(sql,values)=>values.length?db.prepare(sql).bind(...values):db.prepare(sql);
  const [rows,count,summary]=await Promise.all([
    prepare(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.detail_json,a.created_at,o.name AS organisation_name,u.display_name AS user_name FROM audit_log a LEFT JOIN organisations o ON o.id=a.organisation_id LEFT JOIN users u ON u.id=a.user_id ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,[...bindings,limit,offset]).all(),
    prepare(`SELECT COUNT(*) AS total FROM audit_log a LEFT JOIN organisations o ON o.id=a.organisation_id LEFT JOIN users u ON u.id=a.user_id ${where}`,bindings).first(),
    db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN created_at>=datetime('now','-24 hours') THEN 1 ELSE 0 END) AS last_24h,
      SUM(CASE WHEN action LIKE '%support%' OR entity_type IN ('support_session','platform_support_session','support_ticket') THEN 1 ELSE 0 END) AS support_events,
      SUM(CASE WHEN action LIKE 'user.%' OR action LIKE 'auth.%' OR action LIKE '%security%' OR action LIKE '%access%' OR action LIKE '%login%' THEN 1 ELSE 0 END) AS security_events
      FROM audit_log`).first()
  ]);
  const total=Number(count?.total||0);
  return json({events:rows.results||[],total,summary:{total:Number(summary?.total||0),last24h:Number(summary?.last_24h||0),supportEvents:Number(summary?.support_events||0),securityEvents:Number(summary?.security_events||0)},pagination:{limit,offset,hasPrevious:offset>0,hasNext:offset+limit<total},filters:{q:search,category:category||'all',period:period||'all',organisationId}});
}
function platformAuditCategoryClause(category){
  if(category==='authentication')return "(a.action LIKE 'user.%' OR a.action LIKE 'auth.%' OR a.action LIKE '%login%')";
  if(category==='support')return "(a.action LIKE '%support%' OR a.entity_type IN ('support_session','platform_support_session','support_ticket'))";
  if(category==='products')return "(a.action LIKE 'platform.product%' OR a.entity_type IN ('platform_product','product','product_organisation'))";
  if(category==='organisations')return "(a.action LIKE '%organisation%' OR a.entity_type='organisation')";
  if(category==='settings')return "(a.action LIKE '%settings%' OR a.entity_type='platform_settings')";
  if(category==='security')return "(a.action LIKE '%security%' OR a.action LIKE '%access%' OR a.action LIKE '%permission%' OR a.action LIKE '%session%')";
  return '';
}

function boundedPlatformInteger(value,fallback,min,max){const number=Number(value);return Number.isFinite(number)?Math.min(Math.max(Math.round(number),min),max):fallback;}
function normalisePlatformSettings(input={}){
  const settings={
    defaultSupportDurationMinutes:boundedPlatformInteger(input.defaultSupportDurationMinutes,DEFAULT_PLATFORM_SETTINGS.defaultSupportDurationMinutes,15,240),
    maximumSupportDurationMinutes:boundedPlatformInteger(input.maximumSupportDurationMinutes,DEFAULT_PLATFORM_SETTINGS.maximumSupportDurationMinutes,15,240),
    warningErrorThreshold:boundedPlatformInteger(input.warningErrorThreshold,DEFAULT_PLATFORM_SETTINGS.warningErrorThreshold,1,1000),
    criticalErrorThreshold:boundedPlatformInteger(input.criticalErrorThreshold,DEFAULT_PLATFORM_SETTINGS.criticalErrorThreshold,1,1000),
    activeSupportWarningThreshold:boundedPlatformInteger(input.activeSupportWarningThreshold,DEFAULT_PLATFORM_SETTINGS.activeSupportWarningThreshold,1,100),
    auditPageSize:boundedPlatformInteger(input.auditPageSize,DEFAULT_PLATFORM_SETTINGS.auditPageSize,25,250),
    healthRetentionDays:boundedPlatformInteger(input.healthRetentionDays,DEFAULT_PLATFORM_SETTINGS.healthRetentionDays,30,365),
    auditCheckpointHours:boundedPlatformInteger(input.auditCheckpointHours,DEFAULT_PLATFORM_SETTINGS.auditCheckpointHours,1,168),
  };
  settings.maximumSupportDurationMinutes=Math.max(settings.maximumSupportDurationMinutes,settings.defaultSupportDurationMinutes);
  settings.criticalErrorThreshold=Math.max(settings.criticalErrorThreshold,settings.warningErrorThreshold);
  return settings;
}
async function readPlatformSettings(db){
  const row=await db.prepare(`SELECT ps.setting_value,ps.updated_at,u.display_name AS updated_by_name FROM platform_settings ps LEFT JOIN users u ON u.id=ps.updated_by WHERE ps.setting_key=?`).bind(PLATFORM_SETTINGS_KEY).first();
  return {settings:normalisePlatformSettings(safeJson(row?.setting_value,{})),updatedAt:row?.updated_at||null,updatedBy:row?.updated_by_name||null};
}
async function getPlatformSettings(db,session){
  if(!requirePlatform(session))return forbidden();
  const result=await readPlatformSettings(db);return json({...result,defaults:DEFAULT_PLATFORM_SETTINGS,canEdit:session.access_level==='platform_owner'});
}
async function updatePlatformSettings(request,db,session){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const before=await readPlatformSettings(db),settings=normalisePlatformSettings(await readJson(request,32*1024));
  await db.batch([
    db.prepare(`INSERT INTO platform_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(PLATFORM_SETTINGS_KEY,JSON.stringify(settings),session.user_id),
    auditStatement(db,session.organisation_id,session.user_id,'platform.settings_updated','platform_settings',PLATFORM_SETTINGS_KEY,{before:before.settings,after:settings})
  ]);
  const saved=await readPlatformSettings(db);return json({...saved,defaults:DEFAULT_PLATFORM_SETTINGS,canEdit:true});
}
async function platformNotifications(db,session){
  if(!requirePlatform(session)) return forbidden();
  const today=new Date();today.setHours(0,0,0,0);const soon=new Date(today);soon.setDate(soon.getDate()+30);
  const [trials,plans,dbs]=await Promise.all([
    db.prepare(`SELECT id,name,trial_ends_at FROM organisations WHERE status='active' AND trial_ends_at IS NOT NULL`).all(),
    db.prepare(`SELECT cp.id,cp.review_date,c.first_name||' '||c.last_name AS client_name,o.name AS organisation_name FROM care_plans cp JOIN clients c ON c.id=cp.client_id JOIN organisations o ON o.id=cp.organisation_id WHERE cp.status='Active' AND cp.review_date IS NOT NULL`).all(),
    db.prepare(`SELECT s.id,s.dbs_expiry,s.first_name||' '||s.last_name AS staff_name,o.name AS organisation_name FROM staff s JOIN organisations o ON o.id=s.organisation_id WHERE s.status='Active' AND s.dbs_expiry IS NOT NULL`).all()
  ]);
  const notices=[];
  for(const o of trials.results||[]){const d=new Date(o.trial_ends_at+'T00:00:00');if(d<=soon)notices.push({type:d<today?'danger':'warning',title:d<today?'Trial expired':'Trial ending',message:`${o.name} · ${o.trial_ends_at}`,organisationId:o.id});}
  for(const p of plans.results||[]){const d=new Date(p.review_date+'T00:00:00');if(d<=soon)notices.push({type:d<today?'danger':'warning',title:d<today?'Care plan overdue':'Care plan due',message:`${p.client_name} · ${p.organisation_name} · ${p.review_date}`});}
  for(const x of dbs.results||[]){const d=new Date(x.dbs_expiry+'T00:00:00');if(d<=soon)notices.push({type:d<today?'danger':'warning',title:d<today?'DBS expired':'DBS expiring',message:`${x.staff_name} · ${x.organisation_name} · ${x.dbs_expiry}`});}
  return json({notifications:notices.sort((a,b)=>a.type==='danger'?-1:1).slice(0,100)});
}
async function platformSystemHealth(db,session){
  if(!requirePlatform(session)) return forbidden();
  const {settings}=await readPlatformSettings(db);
  const [sessions,recentUsers,errors,auditCount,supportActive,support24h,errorRows,supportRows,jobs,incidents,hourlyAudit,hourlyErrors]=await Promise.all([
    db.prepare("SELECT COUNT(*) total FROM sessions WHERE datetime(expires_at)>CURRENT_TIMESTAMP").first(),
    db.prepare("SELECT COUNT(DISTINCT user_id) total FROM sessions WHERE last_seen_at>=datetime('now','-30 minutes') AND datetime(expires_at)>CURRENT_TIMESTAMP").first(),
    db.prepare("SELECT COUNT(*) total FROM api_error_log WHERE created_at>=datetime('now','-24 hours')").first(),
    db.prepare("SELECT COUNT(*) total FROM audit_log WHERE created_at>=datetime('now','-24 hours')").first(),
    db.prepare("SELECT COUNT(*) total FROM platform_support_sessions WHERE status='active' AND datetime(expires_at)>CURRENT_TIMESTAMP").first(),
    db.prepare("SELECT COUNT(*) total FROM platform_support_sessions WHERE started_at>=datetime('now','-24 hours')").first(),
    db.prepare(`SELECT e.id,e.route,e.method,e.error_message,e.created_at,o.name organisation_name,u.display_name user_name
      FROM api_error_log e LEFT JOIN organisations o ON o.id=e.organisation_id LEFT JOIN users u ON u.id=e.user_id
      ORDER BY e.created_at DESC LIMIT 12`).all(),
    db.prepare(`SELECT s.id,s.reason,s.access_mode,s.started_at,s.ended_at,o.name organisation_name,u.display_name platform_user_name
      FROM platform_support_sessions s JOIN organisations o ON o.id=s.organisation_id LEFT JOIN users u ON u.id=s.staff_user_id
      ORDER BY s.started_at DESC LIMIT 12`).all(),
    db.prepare("SELECT * FROM platform_jobs ORDER BY CASE status WHEN 'failed' THEN 0 WHEN 'warning' THEN 1 WHEN 'healthy' THEN 2 ELSE 3 END,name").all(),
    db.prepare("SELECT * FROM platform_incidents WHERE status<>'resolved' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,started_at DESC LIMIT 20").all(),
    db.prepare("SELECT strftime('%Y-%m-%d %H:00',created_at) hour,COUNT(*) total FROM audit_log WHERE created_at>=datetime('now','-24 hours') GROUP BY hour ORDER BY hour").all(),
    db.prepare("SELECT strftime('%Y-%m-%d %H:00',created_at) hour,COUNT(*) total FROM api_error_log WHERE created_at>=datetime('now','-24 hours') GROUP BY hour ORDER BY hour").all()
  ]);
  const [ownerState,checkpoint,maintenance,entitlementFailures]=await Promise.all([
    db.prepare(`SELECT COUNT(*) total FROM users WHERE status='active' AND access_level='platform_owner'`).first(),
    db.prepare(`SELECT id,checkpoint_hash,event_count,audit_max_created_at,export_key,created_at FROM platform_audit_checkpoints ORDER BY created_at DESC LIMIT 1`).first(),
    db.prepare(`SELECT id,status,checked_products,failed_products,health_rows_deleted,reports_deleted,error_message,started_at,completed_at FROM platform_maintenance_runs ORDER BY started_at DESC LIMIT 1`).first(),
    db.prepare(`SELECT COUNT(*) total FROM platform_entitlement_sync WHERE status='failed'`).first(),
  ]);
  const errorCount=Number(errors?.total||0),activeSessions=Number(sessions?.total||0),activeSupport=Number(supportActive?.total||0);
  const jobRows=jobs.results||[],failedJobs=jobRows.filter(x=>x.status==='failed').length,warningJobs=jobRows.filter(x=>x.status==='warning').length;
  const computedAlerts=[];
  if(errorCount>=settings.criticalErrorThreshold) computedAlerts.push({severity:'critical',title:`${errorCount} API errors in the last 24 hours`,description:'Review recent errors and affected routes immediately.',source:'API monitoring'});
  else if(errorCount>=settings.warningErrorThreshold) computedAlerts.push({severity:'warning',title:`${errorCount} API error${errorCount===1?'':'s'} in the last 24 hours`,description:'Review the recent error log for recurring patterns.',source:'API monitoring'});
  if(failedJobs) computedAlerts.push({severity:'critical',title:`${failedJobs} scheduled job${failedJobs===1?' has':'s have'} failed`,description:'Review scheduled automation and the latest job result.',source:'Job monitoring'});
  else if(warningJobs) computedAlerts.push({severity:'warning',title:`${warningJobs} scheduled job${warningJobs===1?' requires':'s require'} attention`,description:'A job completed with a warning state.',source:'Job monitoring'});
  if(activeSupport>=settings.activeSupportWarningThreshold) computedAlerts.push({severity:'warning',title:`${activeSupport} support sessions are currently active`,description:'Confirm all support access remains necessary and authorised.',source:'Support governance'});
  if(Number(ownerState?.total||0)<2)computedAlerts.push({severity:'warning',title:'A second Platform owner is required',description:'Add another trusted owner so account recovery does not depend on one person.',source:'Owner resilience'});
  if(Number(entitlementFailures?.total||0))computedAlerts.push({severity:'warning',title:`${Number(entitlementFailures.total)} feature delivery failure${Number(entitlementFailures.total)===1?'':'s'}`,description:'One or more products did not apply their latest owner-controlled feature contract.',source:'Feature delivery'});
  if(maintenance?.status==='failed')computedAlerts.push({severity:'critical',title:'Latest Platform maintenance failed',description:maintenance.error_message||'Review Worker logs and maintenance history.',source:'Platform maintenance'});
  const incidentRows=(incidents.results||[]).map(x=>({severity:x.severity,title:x.title,description:x.description,source:x.source,startedAt:x.started_at,id:x.id}));
  const alerts=[...incidentRows,...computedAlerts];
  const overall=alerts.some(x=>x.severity==='critical')?'Attention':alerts.some(x=>x.severity==='warning')?'Monitoring':'Healthy';
  const byHour={}; for(let i=23;i>=0;i--){const d=new Date(Date.now()-i*3600000);d.setMinutes(0,0,0);const key=d.toISOString().slice(0,13).replace('T',' ')+':00';byHour[key]={hour:key,label:new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}).format(d),audit:0,errors:0};}
  for(const row of hourlyAudit.results||[]) if(byHour[row.hour]) byHour[row.hour].audit=Number(row.total||0);
  for(const row of hourlyErrors.results||[]) if(byHour[row.hour]) byHour[row.hour].errors=Number(row.total||0);
  return json({
    overall,database:'healthy',authentication:'healthy',auditService:'healthy',workerVersion:VERSION,checkedAt:new Date().toISOString(),
    activeSessions,recentUsers:Number(recentUsers?.total||0),errors24h:errorCount,auditEvents24h:Number(auditCount?.total||0),
    supportSessions24h:Number(support24h?.total||0),activeSupportSessions:activeSupport,
    governance:{activePlatformOwners:Number(ownerState?.total||0),ownerResilience:Number(ownerState?.total||0)>=2?'ready':'action_required',latestAuditCheckpoint:checkpoint||null,latestMaintenance:maintenance||null,failedEntitlementDeliveries:Number(entitlementFailures?.total||0)},
    jobSummary:{total:jobRows.length,healthy:jobRows.filter(x=>x.status==='healthy').length,failed:failedJobs,warning:warningJobs},
    services:[
      {name:'Cloudflare Worker',status:'healthy',detail:`Version ${VERSION}`},
      {name:'D1 database',status:'healthy',detail:'Queries responding normally'},
      {name:'Authentication',status:'healthy',detail:`${activeSessions} active sessions`},
      {name:'Audit service',status:'healthy',detail:`${Number(auditCount?.total||0)} events in 24 hours`},
      {name:'Audit integrity',status:checkpoint?'healthy':'warning',detail:checkpoint?`${Number(checkpoint.event_count||0)} events sealed at ${checkpoint.audit_max_created_at}`:'Awaiting the first integrity checkpoint'},
      {name:'Owner resilience',status:Number(ownerState?.total||0)>=2?'healthy':'warning',detail:`${Number(ownerState?.total||0)} active Platform owner${Number(ownerState?.total||0)===1?'':'s'}`},
      {name:'API monitoring',status:errorCount>=settings.criticalErrorThreshold?'critical':errorCount>=settings.warningErrorThreshold?'warning':'healthy',detail:`${errorCount} errors in 24 hours`},
      {name:'Support governance',status:activeSupport>=settings.activeSupportWarningThreshold?'warning':'healthy',detail:`${activeSupport} active support sessions`}
    ],
    alerts,jobs:jobRows,recentErrors:errorRows.results||[],supportActivity:supportRows.results||[],activity:Object.values(byHour)
  });
}
function stripeMode(env){const key=clean(env?.STRIPE_SECRET_KEY);return key.startsWith('sk_live_')?'live':key.startsWith('sk_test_')?'test':'unconfigured';}
function stripeCoreCareStatus(status){
  if(status==='active')return 'active';
  if(status==='trialing')return 'trial';
  if(['canceled','incomplete_expired'].includes(status))return 'cancelled';
  return 'past_due';
}
function stripeTimestamp(value){const seconds=Number(value);return Number.isFinite(seconds)&&seconds>0?new Date(seconds*1000).toISOString():null;}
function stripePriceId(subscription){return clean(subscription?.items?.data?.[0]?.price?.id||subscription?.items?.data?.[0]?.plan?.id);}
function stripeSubscriptionId(value){return typeof value==='string'?value:clean(value?.id);}
function stripeCustomerId(value){return typeof value==='string'?value:clean(value?.id);}
function stripeReturnOrigin(request){return new URL(request.url).origin;}
function requireStripeKey(env){if(!clean(env?.STRIPE_SECRET_KEY))throw new HttpError(503,'STRIPE_NOT_CONFIGURED','Stripe test credentials have not been connected to this environment yet.');}

async function stripeApiRequest(env,path,{method='GET',params=null,idempotencyKey=''}={}){
  requireStripeKey(env);
  const headers={authorization:`Bearer ${env.STRIPE_SECRET_KEY}`};
  if(idempotencyKey)headers['idempotency-key']=idempotencyKey.slice(0,255);
  let body;
  if(params){body=params instanceof URLSearchParams?params:new URLSearchParams(params);headers['content-type']='application/x-www-form-urlencoded';}
  let response;
  try{response=await fetch(`${STRIPE_API_ORIGIN}${path}`,{method,headers,body,signal:AbortSignal.timeout(15000)});}catch(error){throw new HttpError(502,'STRIPE_UNAVAILABLE','Stripe could not be reached. Try again shortly.');}
  const payload=await readResponseJson(response,256*1024);
  if(!response.ok){
    const message=clean(payload?.error?.message)||'Stripe rejected the billing request.';
    throw new HttpError(502,'STRIPE_REQUEST_FAILED',message.slice(0,300));
  }
  return payload;
}

function hexBytes(value){
  const text=clean(value).toLowerCase();
  if(!/^[a-f0-9]+$/.test(text)||text.length%2)return null;
  const bytes=new Uint8Array(text.length/2);for(let index=0;index<bytes.length;index++)bytes[index]=Number.parseInt(text.slice(index*2,index*2+2),16);return bytes;
}
async function verifyStripeSignature(payload,signatureHeader,secret,nowMs=Date.now()){
  const parts=String(signatureHeader||'').split(',').map(part=>part.trim().split('='));
  const timestamp=Number(parts.find(([key])=>key==='t')?.[1]);
  const signatures=parts.filter(([key])=>key==='v1').map(([,value])=>hexBytes(value)).filter(Boolean);
  if(!Number.isFinite(timestamp)||!signatures.length||Math.abs(Math.floor(nowMs/1000)-timestamp)>STRIPE_SIGNATURE_TOLERANCE_SECONDS)return false;
  const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(String(secret||'')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`${timestamp}.${payload}`)));
  return signatures.some(signature=>timingSafeEqual(signature,expected));
}

async function platformBillingStatus(request,env,session){
  if(!requirePlatform(session))return forbidden();
  const [plans,events]=await Promise.all([
    env.DB.prepare("SELECT id,name,monthly_price_pence,stripe_product_id,stripe_price_id,status FROM subscription_plans WHERE id IN ('limited','unlimited') ORDER BY monthly_price_pence").all(),
    env.DB.prepare("SELECT id,event_type,livemode,organisation_id,status,error_message,received_at,processed_at FROM stripe_webhook_events ORDER BY received_at DESC LIMIT 20").all()
  ]);
  const rows=plans.results||[],secretConfigured=Boolean(clean(env.STRIPE_SECRET_KEY)),webhookConfigured=Boolean(clean(env.STRIPE_WEBHOOK_SECRET));
  return json({
    mode:stripeMode(env),secretConfigured,webhookConfigured,ready:secretConfigured&&webhookConfigured&&rows.length===2&&rows.every(plan=>plan.stripe_price_id),
    catalogueReady:rows.length===2&&rows.every(plan=>plan.stripe_price_id),automaticTaxEnabled:clean(env.STRIPE_AUTOMATIC_TAX).toLowerCase()==='true',
    webhookUrl:`${stripeReturnOrigin(request)}${STRIPE_WEBHOOK_PATH}`,accessBypassRequired:true,plans:rows,events:events.results||[],canManage:canManagePlatform(session)
  });
}

async function configureStripeCatalogue(env,session){
  if(!canManagePlatform(session))return forbidden();
  requireStripeKey(env);
  const result=await env.DB.prepare("SELECT id,name,monthly_price_pence,stripe_product_id,stripe_price_id FROM subscription_plans WHERE id IN ('limited','unlimited') AND status='active' ORDER BY monthly_price_pence").all();
  const plans=result.results||[];
  if(plans.length!==2)throw new HttpError(409,'BILLING_PLANS_MISSING','The Limited and Unlimited CoreCare plans must both be active before connecting Stripe.');
  const environment=clean(env.CORECARE_ENVIRONMENT)||'production';
  for(const plan of plans){
    let productId=clean(plan.stripe_product_id),priceId=clean(plan.stripe_price_id);
    if(productId)await stripeApiRequest(env,`/v1/products/${encodeURIComponent(productId)}`);
    else{
      const product=await stripeApiRequest(env,'/v1/products',{method:'POST',idempotencyKey:`corecare-${environment}-${plan.id}-product-v1`,params:new URLSearchParams([
        ['name',`CoreCare ${plan.name}`],['description',`${plan.name} access to the CoreCare software platform`],['metadata[corecare_plan_id]',plan.id],['metadata[corecare_environment]',environment]
      ])});
      productId=product.id;
    }
    if(priceId)await stripeApiRequest(env,`/v1/prices/${encodeURIComponent(priceId)}`);
    else{
      const price=await stripeApiRequest(env,'/v1/prices',{method:'POST',idempotencyKey:`corecare-${environment}-${plan.id}-gbp-monthly-v1`,params:new URLSearchParams([
        ['currency','gbp'],['unit_amount',String(Number(plan.monthly_price_pence)||0)],['recurring[interval]','month'],['product',productId],['nickname',`${plan.name} monthly`],['metadata[corecare_plan_id]',plan.id],['metadata[corecare_environment]',environment]
      ])});
      priceId=price.id;
    }
    await env.DB.prepare("UPDATE subscription_plans SET stripe_product_id=?,stripe_price_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(productId,priceId,plan.id).run();
  }
  await audit(env.DB,session.organisation_id,session.user_id,'platform.stripe_catalogue_configured','billing',null,{environment,mode:stripeMode(env)});
  return json({ok:true,mode:stripeMode(env)});
}

async function createStripeCheckout(request,env,session,organisationId){
  if(!canManagePlatform(session))return forbidden();
  requireStripeKey(env);
  const input=await readJson(request),organisation=await env.DB.prepare("SELECT id,name,contact_email,billing_email,subscription_plan,subscription_status,billing_provider,stripe_customer_id,stripe_subscription_id FROM organisations WHERE id=?").bind(organisationId).first();
  if(!organisation)throw new HttpError(404,'NOT_FOUND','Organisation not found.');
  if(organisation.stripe_subscription_id)throw new HttpError(409,'STRIPE_SUBSCRIPTION_EXISTS','This organisation already has a Stripe subscription. Open its billing portal instead.');
  const planId=clean(input.planId)||organisation.subscription_plan,plan=await env.DB.prepare("SELECT id,name,monthly_price_pence,stripe_price_id FROM subscription_plans WHERE id=? AND status='active'").bind(planId).first();
  if(!plan||!['limited','unlimited'].includes(plan.id))throw new HttpError(400,'INVALID_SUBSCRIPTION_PLAN','Choose the Limited or Unlimited plan.');
  if(!clean(plan.stripe_price_id))throw new HttpError(409,'STRIPE_CATALOGUE_NOT_READY','Connect the CoreCare plans to Stripe before starting Checkout.');
  let customerId=clean(organisation.stripe_customer_id);
  if(!customerId){
    const customerParams=new URLSearchParams([['name',organisation.name],['metadata[corecare_organisation_id]',organisation.id],['metadata[corecare_environment]',clean(env.CORECARE_ENVIRONMENT)||'production']]);
    const email=clean(input.billingEmail||organisation.billing_email||organisation.contact_email).toLowerCase();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))customerParams.set('email',email);
    const customer=await stripeApiRequest(env,'/v1/customers',{method:'POST',idempotencyKey:`corecare-customer-${organisation.id}`,params:customerParams});customerId=customer.id;
    await env.DB.prepare("UPDATE organisations SET stripe_customer_id=?,billing_email=COALESCE(?,billing_email),billing_provider='stripe',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(customerId,email||null,organisation.id).run();
  }
  const origin=stripeReturnOrigin(request),success=new URL(origin),cancel=new URL(origin);success.searchParams.set('stripe_checkout','success');success.searchParams.set('organisation',organisation.id);cancel.searchParams.set('stripe_checkout','cancelled');cancel.searchParams.set('organisation',organisation.id);
  const params=new URLSearchParams([
    ['mode','subscription'],['customer',customerId],['client_reference_id',organisation.id],['line_items[0][price]',plan.stripe_price_id],['line_items[0][quantity]','1'],['success_url',success.toString()],['cancel_url',cancel.toString()],
    ['billing_address_collection','required'],['customer_update[address]','auto'],['customer_update[name]','auto'],['tax_id_collection[enabled]','true'],['metadata[corecare_organisation_id]',organisation.id],['metadata[corecare_plan_id]',plan.id],['subscription_data[metadata][corecare_organisation_id]',organisation.id],['subscription_data[metadata][corecare_plan_id]',plan.id]
  ]);
  if(clean(env.STRIPE_AUTOMATIC_TAX).toLowerCase()==='true')params.set('automatic_tax[enabled]','true');
  const id=crypto.randomUUID(),checkout=await stripeApiRequest(env,'/v1/checkout/sessions',{method:'POST',idempotencyKey:`corecare-checkout-${id}`,params});
  await env.DB.batch([
    env.DB.prepare("INSERT INTO stripe_checkout_sessions(id,organisation_id,plan_id,stripe_session_id,created_by) VALUES(?,?,?,?,?)").bind(id,organisation.id,plan.id,checkout.id,session.user_id),
    env.DB.prepare("UPDATE organisations SET billing_provider='stripe',stripe_customer_id=?,stripe_checkout_session_id=?,stripe_price_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(customerId,checkout.id,plan.stripe_price_id,organisation.id),
    auditStatement(env.DB,session.organisation_id,session.user_id,'platform.stripe_checkout_created','organisation',organisation.id,{planId:plan.id,amountPence:plan.monthly_price_pence,mode:stripeMode(env)})
  ]);
  return json({url:checkout.url,sessionId:checkout.id,mode:stripeMode(env)},201);
}

async function createStripePortal(request,env,session,organisationId){
  if(!canManagePlatform(session))return forbidden();
  requireStripeKey(env);
  const organisation=await env.DB.prepare("SELECT id,name,stripe_customer_id FROM organisations WHERE id=?").bind(organisationId).first();
  if(!organisation)throw new HttpError(404,'NOT_FOUND','Organisation not found.');
  if(!clean(organisation.stripe_customer_id))throw new HttpError(409,'STRIPE_CUSTOMER_MISSING','Start Stripe Checkout for this organisation first.');
  const portal=await stripeApiRequest(env,'/v1/billing_portal/sessions',{method:'POST',params:new URLSearchParams([['customer',organisation.stripe_customer_id],['return_url',stripeReturnOrigin(request)]])});
  await audit(env.DB,session.organisation_id,session.user_id,'platform.stripe_portal_opened','organisation',organisation.id,{mode:stripeMode(env)});
  return json({url:portal.url});
}

async function findStripeOrganisation(db,object){
  const metadataId=clean(object?.metadata?.corecare_organisation_id),customerId=stripeCustomerId(object?.customer),subscriptionId=clean(object?.object)==='subscription'?clean(object.id):stripeSubscriptionId(object?.subscription);
  if(metadataId){const row=await db.prepare("SELECT * FROM organisations WHERE id=?").bind(metadataId).first();if(row)return row;}
  if(subscriptionId){const row=await db.prepare("SELECT * FROM organisations WHERE stripe_subscription_id=?").bind(subscriptionId).first();if(row)return row;}
  if(customerId)return db.prepare("SELECT * FROM organisations WHERE stripe_customer_id=?").bind(customerId).first();
  return null;
}

async function applyStripeSubscription(db,subscription,event={}){
  const organisation=await findStripeOrganisation(db,subscription);if(!organisation)return null;
  const eventAt=stripeTimestamp(event.created)||new Date().toISOString(),lastAt=databaseTimestamp(organisation.stripe_last_event_at);
  if(lastAt&&lastAt.getTime()>new Date(eventAt).getTime())return organisation.id;
  const priceId=stripePriceId(subscription),plan=priceId?await db.prepare("SELECT id FROM subscription_plans WHERE stripe_price_id=?").bind(priceId).first():null;
  const stripeStatus=clean(subscription.status)||'canceled',subscriptionStatus=stripeCoreCareStatus(stripeStatus),periodEnd=stripeTimestamp(subscription.current_period_end||subscription.items?.data?.[0]?.current_period_end),renewal=periodEnd?.slice(0,10)||null;
  await db.batch([
    db.prepare(`UPDATE organisations SET billing_provider='stripe',stripe_customer_id=COALESCE(?,stripe_customer_id),stripe_subscription_id=?,stripe_price_id=COALESCE(?,stripe_price_id),stripe_status=?,stripe_current_period_end=?,stripe_cancel_at_period_end=?,stripe_livemode=?,stripe_last_event_at=?,subscription_plan=COALESCE(?,subscription_plan),subscription_status=?,renewal_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(stripeCustomerId(subscription.customer)||null,subscription.id,priceId||null,stripeStatus,periodEnd,subscription.cancel_at_period_end?1:0,event.livemode?1:0,eventAt,plan?.id||null,subscriptionStatus,renewal,organisation.id),
    db.prepare(`INSERT INTO platform_entitlement_sync(product_id,organisation_id,status,error_message,updated_at) SELECT product_id,organisation_id,'pending',NULL,CURRENT_TIMESTAMP FROM platform_product_organisations WHERE organisation_id=? ON CONFLICT(product_id,organisation_id) DO UPDATE SET status='pending',acknowledged_at=NULL,applied_at=NULL,error_message=NULL,updated_at=CURRENT_TIMESTAMP`).bind(organisation.id),
    auditStatement(db,organisation.id,null,'billing.stripe_subscription_updated','organisation',organisation.id,{stripeStatus,subscriptionStatus,planId:plan?.id||organisation.subscription_plan,cancelAtPeriodEnd:Boolean(subscription.cancel_at_period_end),periodEnd,eventId:event.id||null})
  ]);
  return organisation.id;
}

async function applyStripeInvoice(db,invoice,event){
  const organisation=await findStripeOrganisation(db,invoice);if(!organisation)return null;
  const paid=event.type==='invoice.paid',paymentAt=paid?stripeTimestamp(invoice.status_transitions?.paid_at||event.created):null,amount=Number(invoice.amount_paid||0);
  const statements=[auditStatement(db,organisation.id,null,paid?'billing.stripe_invoice_paid':'billing.stripe_payment_failed','organisation',organisation.id,{eventId:event.id,invoiceId:invoice.id,amountPence:amount,currency:invoice.currency||'gbp'})];
  if(paid)statements.unshift(db.prepare("UPDATE organisations SET stripe_last_payment_at=?,stripe_last_payment_amount_pence=?,stripe_last_event_at=?,subscription_status=CASE WHEN subscription_status='past_due' THEN 'active' ELSE subscription_status END,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(paymentAt,amount,stripeTimestamp(event.created),organisation.id));
  else statements.unshift(db.prepare("UPDATE organisations SET subscription_status='past_due',stripe_last_event_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(stripeTimestamp(event.created),organisation.id));
  await db.batch(statements);return organisation.id;
}

async function processStripeEvent(env,event){
  const object=event?.data?.object||{};
  if(event.type==='checkout.session.completed'){
    const organisation=await findStripeOrganisation(env.DB,object);if(!organisation)return null;
    await env.DB.batch([
      env.DB.prepare("UPDATE organisations SET billing_provider='stripe',stripe_customer_id=COALESCE(?,stripe_customer_id),stripe_subscription_id=COALESCE(?,stripe_subscription_id),stripe_checkout_session_id=?,stripe_livemode=?,stripe_last_event_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(stripeCustomerId(object.customer)||null,stripeSubscriptionId(object.subscription)||null,object.id,event.livemode?1:0,stripeTimestamp(event.created),organisation.id),
      env.DB.prepare("UPDATE stripe_checkout_sessions SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE stripe_session_id=?").bind(object.id),
      auditStatement(env.DB,organisation.id,null,'billing.stripe_checkout_completed','organisation',organisation.id,{eventId:event.id,sessionId:object.id})
    ]);return organisation.id;
  }
  if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type))return applyStripeSubscription(env.DB,object,event);
  if(['invoice.paid','invoice.payment_failed'].includes(event.type))return applyStripeInvoice(env.DB,object,event);
  return null;
}

async function stripeWebhook(request,env){
  if(!env.DB)return databaseRequired();
  const secret=clean(env.STRIPE_WEBHOOK_SECRET);if(!secret)throw new HttpError(503,'STRIPE_WEBHOOK_NOT_CONFIGURED','The Stripe webhook secret is not configured.');
  const declared=Number(request.headers.get('content-length')||0);if(Number.isFinite(declared)&&declared>1024*1024)throw new HttpError(413,'REQUEST_TOO_LARGE','The Stripe event is too large.');
  const raw=await request.text();if(raw.length>1024*1024)throw new HttpError(413,'REQUEST_TOO_LARGE','The Stripe event is too large.');
  if(!await verifyStripeSignature(raw,request.headers.get('stripe-signature'),secret))throw new HttpError(400,'INVALID_STRIPE_SIGNATURE','The Stripe webhook signature is invalid.');
  let event;try{event=JSON.parse(raw)}catch{throw new HttpError(400,'INVALID_JSON','The Stripe event is not valid JSON.');}
  if(!clean(event?.id)||!clean(event?.type))throw new HttpError(400,'INVALID_STRIPE_EVENT','The Stripe event is incomplete.');
  const existing=await env.DB.prepare("SELECT status FROM stripe_webhook_events WHERE id=?").bind(event.id).first();if(existing?.status==='processed')return json({received:true,duplicate:true});
  await env.DB.prepare("INSERT OR IGNORE INTO stripe_webhook_events(id,event_type,livemode,stripe_created_at) VALUES(?,?,?,?)").bind(event.id,event.type,event.livemode?1:0,stripeTimestamp(event.created)).run();
  try{
    const organisationId=await processStripeEvent(env,event);
    await env.DB.prepare("UPDATE stripe_webhook_events SET organisation_id=?,status='processed',error_message=NULL,processed_at=CURRENT_TIMESTAMP WHERE id=?").bind(organisationId||null,event.id).run();
    return json({received:true});
  }catch(error){
    await env.DB.prepare("UPDATE stripe_webhook_events SET status='failed',error_message=? WHERE id=?").bind(clean(error?.message||error).slice(0,500),event.id).run();throw error;
  }
}

async function syncStripeSubscription(env,session,organisationId){
  if(!canManagePlatform(session))return forbidden();
  requireStripeKey(env);
  const organisation=await env.DB.prepare("SELECT id,stripe_subscription_id FROM organisations WHERE id=?").bind(organisationId).first();
  if(!organisation)throw new HttpError(404,'NOT_FOUND','Organisation not found.');
  if(!clean(organisation.stripe_subscription_id))throw new HttpError(409,'STRIPE_SUBSCRIPTION_MISSING','This organisation does not yet have a Stripe subscription.');
  const subscription=await stripeApiRequest(env,`/v1/subscriptions/${encodeURIComponent(organisation.stripe_subscription_id)}`),event={id:`manual-sync-${crypto.randomUUID()}`,created:Math.floor(Date.now()/1000),livemode:stripeMode(env)==='live'};
  await applyStripeSubscription(env.DB,subscription,event);await audit(env.DB,session.organisation_id,session.user_id,'platform.stripe_subscription_synced','organisation',organisationId,{mode:stripeMode(env)});
  return json({ok:true,status:stripeCoreCareStatus(subscription.status),stripeStatus:subscription.status});
}

function subscriptionLimitState(used,limit,additional=0){
  const usage=Math.max(0,Number(used)||0),parsedLimit=limit===null||limit===undefined||limit===''?null:Math.max(0,Number(limit)||0),requested=Math.max(0,Number(additional)||0);
  if(parsedLimit===null)return {used:usage,limit:null,remaining:null,percentage:null,status:'unlimited',allowed:true};
  const remaining=Math.max(0,parsedLimit-usage),percentage=parsedLimit===0?(usage?100:0):Math.round(usage/parsedLimit*100);
  return {used:usage,limit:parsedLimit,remaining,percentage,status:usage>parsedLimit?'over_limit':usage===parsedLimit?'at_limit':percentage>=80?'near_limit':'within_limit',allowed:usage+requested<=parsedLimit};
}
async function organisationSubscriptionSnapshot(db,organisationId){
  const row=await db.prepare(`SELECT o.id,o.status,o.subscription_plan,o.subscription_status,
    COALESCE(o.max_users,sp.max_users) AS effective_max_users,
    COALESCE(o.max_clients,sp.max_clients) AS effective_max_clients,
    COALESCE(sp.name,o.subscription_plan,'Unassigned') AS plan_name,
    COALESCE(sp.monthly_price_pence,0) AS monthly_price_pence,
    (SELECT COUNT(*) FROM users u WHERE u.organisation_id=o.id AND u.status='active' AND COALESCE(u.is_platform_user,0)=0) AS user_count,
    (SELECT COUNT(*) FROM clients c WHERE c.organisation_id=o.id AND c.status<>'Archived') AS client_count
    FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=?`).bind(organisationId).first();
  if(!row)return null;
  return {...row,users:subscriptionLimitState(row.user_count,row.effective_max_users),clients:subscriptionLimitState(row.client_count,row.effective_max_clients)};
}
async function enforceOrganisationSubscriptionLimit(db,organisationId,resource,additional=1){
  const subscription=await organisationSubscriptionSnapshot(db,organisationId),state=subscription?.[resource];
  if(!subscription||!state||state.allowed)return null;
  const noun=resource==='users'?'active users':'active clients',action=resource==='users'?'disable an existing user':'archive an existing client';
  return json({error:{code:'SUBSCRIPTION_LIMIT_REACHED',message:`${subscription.plan_name} allows up to ${state.limit} ${noun}. ${action[0].toUpperCase()+action.slice(1)} or upgrade the organisation to Unlimited.`,resource,planId:subscription.subscription_plan,used:state.used,limit:state.limit}},409);
}
async function listSubscriptionPlans(db,session){if(!requirePlatform(session))return forbidden();const r=await db.prepare("SELECT * FROM subscription_plans ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END,monthly_price_pence,name").all();return json({plans:r.results||[]});}
async function saveSubscriptionPlan(request,db,session){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();const i=await readJson(request),name=clean(i.name),id=clean(i.id)||name.toLowerCase().replace(/[^a-z0-9]+/g,'-');if(!name)return json({error:{code:'VALIDATION_ERROR',message:'Enter a plan name.'}},400);
  await db.prepare(`INSERT INTO subscription_plans(id,name,monthly_price_pence,max_users,max_clients,max_branches,storage_mb,feature_flags_json,status) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,monthly_price_pence=excluded.monthly_price_pence,max_users=excluded.max_users,max_clients=excluded.max_clients,max_branches=excluded.max_branches,storage_mb=excluded.storage_mb,feature_flags_json=excluded.feature_flags_json,status=excluded.status,updated_at=CURRENT_TIMESTAMP`).bind(id,name,Number(i.monthlyPricePence)||0,nullableNumber(i.maxUsers),nullableNumber(i.maxClients),nullableNumber(i.maxBranches),Number(i.storageMb)||1024,typeof i.featureFlags==='object'?JSON.stringify(i.featureFlags):'{}',clean(i.status)||'active').run();
  await audit(db,session.organisation_id,session.user_id,'platform.plan_saved','subscription_plan',id,{name});return json({ok:true,id},201);
}
const PLATFORM_ACCESS_LEVELS=new Set(['platform_owner','platform_admin','platform_developer','platform_implementation','platform_support','platform_read_only']);
function strongPassword(value){return value.length>=12&&value.length<=MAX_PASSWORD_LENGTH&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/[0-9]/.test(value);}
async function activePlatformOwnerCount(db,excludedUserId=''){
  const row=excludedUserId
    ?await db.prepare(`SELECT COUNT(*) total FROM users WHERE status='active' AND access_level='platform_owner' AND id<>?`).bind(excludedUserId).first()
    :await db.prepare(`SELECT COUNT(*) total FROM users WHERE status='active' AND access_level='platform_owner'`).first();
  return Number(row?.total||0);
}
async function listPlatformUsers(db,session){
  if(!requirePlatform(session))return forbidden();
  const r=await db.prepare(`SELECT u.id,u.email,u.display_name,u.access_level,u.status,u.last_login_at,u.must_change_password,u.created_at,
    o.name AS organisation_name,(SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND datetime(s.expires_at)>CURRENT_TIMESTAMP) active_sessions
    FROM users u JOIN organisations o ON o.id=u.organisation_id
    WHERE u.is_platform_user=1 OR u.access_level LIKE 'platform_%' ORDER BY CASE u.access_level WHEN 'platform_owner' THEN 0 ELSE 1 END,u.display_name`).all();
  const users=r.results||[],activeOwners=users.filter(user=>user.status==='active'&&user.access_level==='platform_owner').length;
  return json({users,summary:{activeOwners,activeUsers:users.filter(user=>user.status==='active').length,resilience:activeOwners>=2?'ready':'action_required',message:activeOwners>=2?'At least two active owners can recover the Platform.':'Add a second trusted Platform owner to remove the single-owner recovery risk.'},canManage:session.access_level==='platform_owner'});
}
async function createPlatformUser(request,db,session){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const input=await readJson(request),email=clean(input.email).toLowerCase(),displayName=clean(input.displayName||input.display_name),accessLevel=clean(input.accessLevel||input.access_level)||'platform_support',temporaryPassword=String(input.temporaryPassword||input.temporary_password||'');
  if(!email||!displayName||!email.includes('@'))return badRequest('Enter a display name and valid email address.');
  if(!PLATFORM_ACCESS_LEVELS.has(accessLevel))return badRequest('Choose a valid Platform access level.');
  if(!strongPassword(temporaryPassword))return badRequest('Use a temporary password of at least 12 characters with upper-case, lower-case and a number.');
  const duplicate=await db.prepare('SELECT id FROM users WHERE lower(email)=lower(?) LIMIT 1').bind(email).first();
  if(duplicate)return json({error:{code:'EMAIL_IN_USE',message:'That email address already belongs to a CoreCare user.'}},409);
  const secured=await hashPassword(temporaryPassword),id=crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO users(id,organisation_id,email,display_name,role,password_hash,password_salt,password_iterations,status,access_level,is_platform_user,must_change_password,password_changed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(id,session.organisation_id,email,displayName,'owner',secured.hash,secured.salt,PASSWORD_ITERATIONS,'active',accessLevel,1,1),
    auditStatement(db,session.organisation_id,session.user_id,'platform.user_created','user',id,{email,displayName,accessLevel}),
  ]);
  return json({ok:true,id},201);
}
async function updatePlatformUser(request,db,session,id){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const existing=await db.prepare(`SELECT id,email,display_name,access_level,status FROM users WHERE id=? AND (is_platform_user=1 OR access_level LIKE 'platform_%')`).bind(id).first();
  if(!existing)return notFound('Platform user');
  const input=await readJson(request),displayName=clean(input.displayName||input.display_name)||existing.display_name,accessLevel=clean(input.accessLevel||input.access_level)||existing.access_level,status=clean(input.status)||existing.status;
  if(!PLATFORM_ACCESS_LEVELS.has(accessLevel)||!['active','disabled'].includes(status))return badRequest('Choose a valid Platform role and status.');
  const removesOwner=existing.access_level==='platform_owner'&&(accessLevel!=='platform_owner'||status!=='active');
  if(removesOwner&&await activePlatformOwnerCount(db,id)<1)return json({error:{code:'LAST_PLATFORM_OWNER',message:'Add another active Platform owner before disabling or changing the final owner.'}},409);
  if(id===session.user_id&&status!=='active')return json({error:{code:'CURRENT_OWNER_LOCKOUT',message:'You cannot disable your own signed-in account.'}},409);
  await db.batch([
    db.prepare(`UPDATE users SET display_name=?,access_level=?,status=?,is_platform_user=1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(displayName,accessLevel,status,id),
    status==='disabled'?db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id):db.prepare('SELECT 1'),
    auditStatement(db,session.organisation_id,session.user_id,'platform.user_updated','user',id,{before:{displayName:existing.display_name,accessLevel:existing.access_level,status:existing.status},after:{displayName,accessLevel,status}}),
  ]);
  return json({ok:true});
}
async function resetPlatformUserPassword(request,db,session,id){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const target=await db.prepare(`SELECT id,email FROM users WHERE id=? AND (is_platform_user=1 OR access_level LIKE 'platform_%')`).bind(id).first();
  if(!target)return notFound('Platform user');
  const input=await readJson(request),temporaryPassword=String(input.temporaryPassword||input.temporary_password||'');
  if(!strongPassword(temporaryPassword))return badRequest('Use a temporary password of at least 12 characters with upper-case, lower-case and a number.');
  const secured=await hashPassword(temporaryPassword);
  await db.batch([
    db.prepare(`UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=1,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(secured.hash,secured.salt,PASSWORD_ITERATIONS,id),
    db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
    auditStatement(db,session.organisation_id,session.user_id,'platform.user_password_reset','user',id,{email:target.email}),
  ]);
  return json({ok:true});
}
async function revokePlatformUserSessions(db,session,id){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const target=await db.prepare(`SELECT id,email FROM users WHERE id=? AND (is_platform_user=1 OR access_level LIKE 'platform_%')`).bind(id).first();
  if(!target)return notFound('Platform user');
  if(id===session.user_id)return json({error:{code:'CURRENT_SESSION',message:'Use sign out to end your own current session.'}},409);
  await db.batch([db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),auditStatement(db,session.organisation_id,session.user_id,'platform.user_sessions_revoked','user',id,{email:target.email})]);
  return json({ok:true});
}



async function listWorkflows(db,session,url){
  if(!requirePlatform(session))return forbidden();
  const status=clean(url.searchParams.get('status'));
  const where=status&&status!=='all'?'WHERE w.status=?':'';
  const q=`SELECT w.*,o.name AS organisation_name,(SELECT COUNT(*) FROM workflow_runs r WHERE r.workflow_id=w.id) AS run_count,(SELECT status FROM workflow_runs r WHERE r.workflow_id=w.id ORDER BY r.started_at DESC LIMIT 1) AS last_run_status FROM workflow_definitions w LEFT JOIN organisations o ON o.id=w.organisation_id ${where} ORDER BY w.updated_at DESC`;
  const result=status&&status!=='all'?await db.prepare(q).bind(status).all():await db.prepare(q).all();
  return json({workflows:(result.results||[]).map(w=>({...w,conditions:safeJson(w.conditions_json,[]),actions:safeJson(w.actions_json,[])}))});
}
async function listWorkflowTemplates(db,session){if(!requirePlatform(session))return forbidden();const r=await db.prepare("SELECT * FROM workflow_templates WHERE status='active' ORDER BY category,name").all();return json({templates:(r.results||[]).map(x=>({...x,definition:safeJson(x.definition_json,{})}))});}
async function createWorkflow(request,db,session){
  if(!canManagePlatform(session))return forbidden();const i=await readJson(request);const name=clean(i.name),trigger=clean(i.triggerType);if(!name||!trigger)return json({error:{code:'VALIDATION_ERROR',message:'Enter a workflow name and select a trigger.'}},400);
  const id=crypto.randomUUID(),scope=clean(i.scope)==='organisation'?'organisation':'platform',orgId=scope==='organisation'?(clean(i.organisationId)||session.organisation_id):null,status=['draft','active','paused'].includes(clean(i.status))?clean(i.status):'draft';
  const conditions=Array.isArray(i.conditions)?i.conditions:[],actions=Array.isArray(i.actions)?i.actions:[];
  if(!actions.length)return json({error:{code:'VALIDATION_ERROR',message:'Add at least one workflow action.'}},400);
  await db.batch([db.prepare(`INSERT INTO workflow_definitions(id,organisation_id,name,description,scope,trigger_type,trigger_config_json,conditions_json,actions_json,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,orgId,name,clean(i.description),scope,trigger,JSON.stringify(i.triggerConfig||{}),JSON.stringify(conditions),JSON.stringify(actions),status,session.user_id),auditStatement(db,session.organisation_id,session.user_id,'platform.workflow_created','workflow',id,{name,trigger,status})]);
  return json({ok:true,id},201);
}
async function updateWorkflow(request,db,session,id){
  if(!canManagePlatform(session))return forbidden();const existing=await db.prepare('SELECT * FROM workflow_definitions WHERE id=?').bind(id).first();if(!existing)return notFound('Workflow');const i=await readJson(request),name=clean(i.name)||existing.name,trigger=clean(i.triggerType)||existing.trigger_type,status=['draft','active','paused'].includes(clean(i.status))?clean(i.status):existing.status,scope=clean(i.scope)==='organisation'?'organisation':'platform',orgId=scope==='organisation'?(clean(i.organisationId)||existing.organisation_id||session.organisation_id):null,conditions=Array.isArray(i.conditions)?i.conditions:safeJson(existing.conditions_json,[]),actions=Array.isArray(i.actions)?i.actions:safeJson(existing.actions_json,[]);
  await db.batch([db.prepare(`UPDATE workflow_definitions SET organisation_id=?,name=?,description=?,scope=?,trigger_type=?,trigger_config_json=?,conditions_json=?,actions_json=?,status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(orgId,name,clean(i.description)||existing.description,scope,trigger,JSON.stringify(i.triggerConfig||safeJson(existing.trigger_config_json,{})),JSON.stringify(conditions),JSON.stringify(actions),status,id),auditStatement(db,session.organisation_id,session.user_id,'platform.workflow_updated','workflow',id,{name,status})]);return json({ok:true,id});
}
async function deleteWorkflow(db,session,id){if(!canManagePlatform(session))return forbidden();const w=await db.prepare('SELECT name FROM workflow_definitions WHERE id=?').bind(id).first();if(!w)return notFound('Workflow');await db.batch([db.prepare('DELETE FROM workflow_queue WHERE workflow_id=?').bind(id),db.prepare('DELETE FROM workflow_runs WHERE workflow_id=?').bind(id),db.prepare('DELETE FROM workflow_definitions WHERE id=?').bind(id),auditStatement(db,session.organisation_id,session.user_id,'platform.workflow_deleted','workflow',id,{name:w.name})]);return json({ok:true});}
async function runWorkflow(request,db,session,id){
  if(!canManagePlatform(session))return forbidden();const w=await db.prepare('SELECT * FROM workflow_definitions WHERE id=?').bind(id).first();if(!w)return notFound('Workflow');const payload=await readJson(request),runId=crypto.randomUUID(),started=Date.now(),actions=safeJson(w.actions_json,[]),results=[];
  await db.prepare(`INSERT INTO workflow_runs(id,workflow_id,organisation_id,trigger_type,trigger_payload_json,status,actions_total,initiated_by) VALUES(?,?,?,?,?,'running',?,?)`).bind(runId,id,w.organisation_id,w.trigger_type,JSON.stringify(payload||{}),actions.length,session.user_id).run();
  try{for(const action of actions){const type=clean(action.type);if(type==='audit_entry')await audit(db,w.organisation_id||session.organisation_id,session.user_id,'workflow.action_executed','workflow',id,{runId,action:type});else if(type==='executive_alert')await db.prepare(`INSERT INTO platform_notifications(id,type,title,message,source,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(),'warning',`Workflow alert: ${w.name}`,clean(action.message)||`Workflow ${w.name} raised an executive alert.`,'workflow').run().catch(()=>null);results.push({type,status:'completed'});}
    const duration=Date.now()-started;await db.batch([db.prepare(`UPDATE workflow_runs SET status='completed',actions_completed=?,result_json=?,finished_at=CURRENT_TIMESTAMP,duration_ms=? WHERE id=?`).bind(actions.length,JSON.stringify({actions:results}),duration,runId),db.prepare('UPDATE workflow_definitions SET last_run_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(id),auditStatement(db,session.organisation_id,session.user_id,'platform.workflow_run','workflow',id,{runId,status:'completed'})]);return json({ok:true,runId,status:'completed',actionsCompleted:actions.length,durationMs:duration});
  }catch(error){const duration=Date.now()-started;await db.prepare(`UPDATE workflow_runs SET status='failed',error_message=?,finished_at=CURRENT_TIMESTAMP,duration_ms=? WHERE id=?`).bind(String(error.message||error).slice(0,500),duration,runId).run();return json({error:{code:'WORKFLOW_FAILED',message:'The workflow test run failed.'},runId},500);}
}
async function listWorkflowRuns(db,session,url){if(!requirePlatform(session))return forbidden();const workflowId=clean(url.searchParams.get('workflowId'));const limit=Math.min(100,Math.max(1,Number(url.searchParams.get('limit'))||30));const q=`SELECT r.*,w.name AS workflow_name,o.name AS organisation_name FROM workflow_runs r JOIN workflow_definitions w ON w.id=r.workflow_id LEFT JOIN organisations o ON o.id=r.organisation_id ${workflowId?'WHERE r.workflow_id=?':''} ORDER BY r.started_at DESC LIMIT ?`;const result=workflowId?await db.prepare(q).bind(workflowId,limit).all():await db.prepare(q).bind(limit).all();return json({runs:result.results||[]});}
function safeJson(value,fallback){try{return JSON.parse(value||'')}catch{return fallback}}

function requirePlatformIdentity(session) {
  return session.is_platform_user || session.access_level === "platform_owner" || session.access_level === "platform_admin";
}
function requirePlatform(session) {
  return !session.support_mode && requirePlatformIdentity(session);
}
function canManagePlatform(session){return requirePlatform(session)&&["platform_owner","platform_admin"].includes(clean(session.access_level));}
function allowedProductAccessModes(session){
  const role=clean(session.access_level);
  if(role==="platform_owner")return new Set(["read_only","support","implementation","developer"]);
  if(role==="platform_admin")return new Set(["read_only","support","implementation"]);
  if(role==="platform_developer")return new Set(["read_only","support","developer"]);
  if(role==="platform_implementation")return new Set(["read_only","support","implementation"]);
  if(role==="platform_support")return new Set(["read_only","support"]);
  return new Set(["read_only"]);
}

async function platformDashboard(db, session) {
  if(!requirePlatform(session)) return forbidden();
  const today=new Date(); today.setHours(0,0,0,0);
  const [orgs,users,activeUsers,activity,errors,sessions,openTickets,products] = await Promise.all([
    db.prepare(`SELECT o.id,o.name,o.slug,o.status,o.subscription_plan,o.subscription_status,o.trial_ends_at,o.renewal_date,o.created_at,
      sp.name AS plan_name,COALESCE(sp.monthly_price_pence,0) AS monthly_price_pence,
      COALESCE(o.max_users,sp.max_users) AS effective_max_users,COALESCE(o.max_clients,sp.max_clients) AS effective_max_clients,
      (SELECT COUNT(*) FROM users u WHERE u.organisation_id=o.id AND u.status='active' AND COALESCE(u.is_platform_user,0)=0) AS user_count,
      (SELECT COUNT(*) FROM clients c WHERE c.organisation_id=o.id AND c.status<>'Archived') AS client_count,
      (SELECT COUNT(*) FROM staff st WHERE st.organisation_id=o.id AND st.status='Active') AS staff_count,
      (SELECT COUNT(*) FROM branches b WHERE b.organisation_id=o.id AND b.status='active') AS branch_count,
      (SELECT COUNT(*) FROM users u WHERE u.organisation_id=o.id AND u.status='active' AND u.last_login_at>=datetime('now','-30 days')) AS active_users_30d,
      (SELECT COUNT(*) FROM platform_product_organisations po WHERE po.organisation_id=o.id AND po.access_status='ready') AS product_count,
      (SELECT COUNT(*) FROM platform_product_organisations po WHERE po.organisation_id=o.id AND (po.health_status NOT IN ('healthy','ok') OR po.integration_status='failed')) AS unhealthy_products,
      (SELECT COUNT(*) FROM platform_support_tickets t WHERE t.organisation_id=o.id AND t.status NOT IN ('resolved','closed')) AS open_ticket_count,
      (SELECT MAX(a.created_at) FROM audit_log a WHERE a.organisation_id=o.id) AS last_activity_at
      FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan ORDER BY o.name COLLATE NOCASE`).all(),
    db.prepare("SELECT COUNT(*) AS total FROM users u JOIN organisations o ON o.id=u.organisation_id WHERE u.status='active' AND o.status<>'archived'").first(),
    db.prepare("SELECT COUNT(DISTINCT s.user_id) AS total FROM sessions s JOIN organisations o ON o.id=s.organisation_id WHERE s.last_seen_at>=datetime('now','-30 days') AND o.status<>'archived'").first(),
    db.prepare(`SELECT a.action,a.entity_type,a.created_at,o.name AS organisation_name,u.display_name AS user_name FROM audit_log a JOIN organisations o ON o.id=a.organisation_id LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 18`).all(),
    db.prepare("SELECT COUNT(*) AS total FROM api_error_log WHERE created_at>=datetime('now','-1 day')").first(),
    db.prepare("SELECT COUNT(*) AS total FROM sessions WHERE datetime(expires_at)>CURRENT_TIMESTAMP").first(),
    db.prepare("SELECT COUNT(*) AS total FROM platform_support_tickets WHERE status NOT IN ('resolved','closed')").first(),
    db.prepare("SELECT COUNT(*) AS total FROM platform_products WHERE status='live' AND code<>'PLATFORM'").first(),
  ]);
  const orgRows=orgs.results||[];
  const enriched=orgRows.map(o=>{const last=databaseTimestamp(o.last_activity_at),daysInactive=last?Math.floor((Date.now()-last.getTime())/86400000):999,usersCount=Number(o.user_count||0),activeCount=Number(o.active_users_30d||0),adoption=usersCount?Math.round(activeCount/usersCount*100):0,userUsage=subscriptionLimitState(usersCount,o.effective_max_users),clientUsage=subscriptionLimitState(o.client_count,o.effective_max_clients);let score=100;if(o.status!=='active')score-=45;if(!Number(o.product_count||0))score-=25;if(Number(o.unhealthy_products||0))score-=Math.min(30,Number(o.unhealthy_products)*15);if(Number(o.open_ticket_count||0))score-=Math.min(20,Number(o.open_ticket_count)*4);if(daysInactive>30)score-=15;else if(daysInactive>14)score-=8;if(usersCount&&!activeCount)score-=10;if(userUsage.status==='over_limit'||clientUsage.status==='over_limit')score-=15;score=Math.max(0,Math.min(100,score));return {...o,health_score:score,days_inactive:daysInactive,adoption_score:adoption,overdue_plans:0,subscription_usage:{users:userUsage,clients:clientUsage},subscription_attention:['near_limit','at_limit','over_limit'].includes(userUsage.status)||['near_limit','at_limit','over_limit'].includes(clientUsage.status)};});
  const current=enriched.filter(o=>o.status!=='archived'),archivedOrganisations=enriched.filter(o=>o.status==='archived');
  const billable=current.filter(o=>o.status==='active'&&o.subscription_status!=='cancelled'); const mrrPence=billable.reduce((n,o)=>n+Number(o.monthly_price_pence||0),0); const avgHealth=current.length?current.reduce((n,o)=>n+o.health_score,0)/current.length:100; const atRisk=current.filter(o=>o.health_score<70||o.subscription_attention).sort((a,b)=>a.health_score-b.health_score).slice(0,8).map(o=>({...o,reason:o.subscription_attention?'Subscription usage needs attention':o.status!=='active'?'Account not active':o.days_inactive>14?`No activity for ${o.days_inactive} days`:o.overdue_plans?`${o.overdue_plans} overdue care plan review${o.overdue_plans===1?'':'s'}`:'Low adoption'}));
  const renewals=current.filter(o=>o.renewal_date).map(o=>{const d=Math.ceil((new Date(o.renewal_date+'T00:00:00')-today)/86400000);return {...o,days_until:d}}).filter(o=>o.days_until>=0&&o.days_until<=30).sort((a,b)=>a.days_until-b.days_until);
  const errorCount=Number(errors?.total||0);
  const briefingItems=[
    {icon:'£',title:`MRR is ${new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(mrrPence/100)}`,detail:`Annual run rate ${new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(mrrPence*12/100)}`,tone:'success'},
    {icon:'◆',title:`${billable.length} active customer organisation${billable.length===1?'':'s'}`,detail:`${Number(activeUsers?.total||0)} users active in the last 30 days`,tone:'neutral'},
    {icon:'!',title:atRisk.length?`${atRisk.length} organisation${atRisk.length===1?'':'s'} need attention`:'Customer portfolio is healthy',detail:atRisk.length?'Open Customer Success to review risk':'No immediate retention risks identified',tone:atRisk.length?'warning':'success'},
    {icon:'◷',title:renewals.length?`${renewals.length} renewal${renewals.length===1?'':'s'} due within 30 days`:'No imminent renewals',detail:renewals[0]?`${renewals[0].name} is next in ${renewals[0].days_until} days`:'Your renewal calendar is clear',tone:'neutral'},
    {icon:'✓',title:errorCount?`${errorCount} platform error${errorCount===1?'':'s'} recorded in 24 hours`:'No platform errors recorded',detail:`${Number(sessions?.total||0)} active sessions · Database healthy`,tone:errorCount?'warning':'success'}
  ];
  return json({summary:{organisations:current.length,archivedOrganisations:archivedOrganisations.length,activeOrganisations:current.filter(o=>o.status==='active').length,suspendedOrganisations:current.filter(o=>o.status==='suspended').length,branches:current.reduce((n,o)=>n+Number(o.branch_count||0),0),users:Number(users?.total||0),activeUsers30d:Number(activeUsers?.total||0),clients:current.reduce((n,o)=>n+Number(o.client_count||0),0),staff:current.reduce((n,o)=>n+Number(o.staff_count||0),0),connectedProducts:Number(products?.total||0),openTickets:Number(openTickets?.total||0),carePlansOverdue:0,highRisks:0},financials:{mrrPence,arrPence:mrrPence*12,averageRevenuePence:billable.length?Math.round(mrrPence/billable.length):0},customerSuccess:{averageHealth:avgHealth,needsAttention:atRisk.length,healthy:current.filter(o=>o.health_score>=80).length},operations:{overall:errorCount===0?'Healthy':errorCount<5?'Monitoring':'Attention',database:'Healthy',activeSessions:Number(sessions?.total||0),errors24h:errorCount},briefing:{headline:atRisk.length?`${atRisk.length} customer organisation${atRisk.length===1?' requires':'s require'} your attention today. Otherwise, the platform is operating normally.`:'Your customer portfolio and CoreCare platform are operating normally.',items:briefingItems},organisations:current,archivedOrganisations,atRiskOrganisations:atRisk,renewals,activity:activity.results||[]});
}

async function platformRevenue(db, session) {
  if(!requirePlatform(session)) return forbidden();
  const result=await db.prepare(`SELECT o.id,o.name,o.status,o.subscription_status,o.subscription_plan,o.created_at,o.renewal_date,
    COALESCE(sp.name,o.subscription_plan,'Unassigned') AS plan_name,COALESCE(sp.monthly_price_pence,0) AS monthly_price_pence
    FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan ORDER BY o.created_at,o.name`).all();
  const rows=result.results||[], now=new Date(), monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
  const isBillable=o=>o.status==='active'&&o.subscription_status!=='cancelled';
  const billable=rows.filter(isBillable), mrrPence=billable.reduce((n,o)=>n+Number(o.monthly_price_pence||0),0);
  const newMrrPence=billable.filter(o=>new Date(`${o.created_at}Z`)>=monthStart).reduce((n,o)=>n+Number(o.monthly_price_pence||0),0);
  const lostMrrPence=rows.filter(o=>o.subscription_status==='cancelled'||o.status==='suspended').reduce((n,o)=>n+Number(o.monthly_price_pence||0),0);
  const planMap={}; for(const o of billable){const key=o.plan_name||'Unassigned'; if(!planMap[key])planMap[key]={name:key,organisations:0,mrrPence:0};planMap[key].organisations++;planMap[key].mrrPence+=Number(o.monthly_price_pence||0)}
  const planBreakdown=Object.values(planMap).sort((a,b)=>b.mrrPence-a.mrrPence);
  const trend=[]; for(let offset=11;offset>=0;offset--){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-offset,1));const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));const activeAtEnd=rows.filter(o=>new Date(`${o.created_at}Z`)<end&&o.subscription_status!=='cancelled'&&o.status!=='suspended');trend.push({month:d.toISOString().slice(0,7),label:new Intl.DateTimeFormat('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}).format(d),mrrPence:activeAtEnd.reduce((n,o)=>n+Number(o.monthly_price_pence||0),0),organisations:activeAtEnd.length})}
  const renewals=rows.filter(o=>isBillable(o)&&o.renewal_date).map(o=>({...o,daysUntil:Math.ceil((new Date(`${o.renewal_date}T00:00:00Z`)-now)/86400000)})).filter(o=>o.daysUntil>=0).sort((a,b)=>a.daysUntil-b.daysUntil);
  const renewal30=renewals.filter(o=>o.daysUntil<=30), renewal90=renewals.filter(o=>o.daysUntil<=90);
  return json({generatedAt:new Date().toISOString(),metrics:{mrrPence,arrPence:mrrPence*12,newMrrPence,lostMrrPence,netMovementPence:newMrrPence-lostMrrPence,averageRevenuePence:billable.length?Math.round(mrrPence/billable.length):0,billableOrganisations:billable.length,renewal30Pence:renewal30.reduce((n,o)=>n+Number(o.monthly_price_pence||0),0),renewal90Pence:renewal90.reduce((n,o)=>n+Number(o.monthly_price_pence||0),0)},planBreakdown,trend,renewals:renewals.slice(0,25),organisations:rows.map(o=>({...o,billable:isBillable(o)}))});
}


async function platformCustomerSuccess(db, session) {
  if(!requirePlatform(session)) return forbidden();
  const [orgs,plans,risks,support,auditRows]=await Promise.all([
    db.prepare(`SELECT o.id,o.name,o.status,o.subscription_status,o.subscription_plan,o.created_at,o.renewal_date,
      COALESCE(sp.name,o.subscription_plan,'Unassigned') plan_name,COALESCE(sp.monthly_price_pence,0) monthly_price_pence,
      COUNT(DISTINCT u.id) user_count,COUNT(DISTINCT CASE WHEN u.last_login_at>=datetime('now','-30 days') THEN u.id END) active_users_30d,
      COUNT(DISTINCT b.id) branch_count,COUNT(DISTINCT c.id) client_count,MAX(a.created_at) last_activity_at
      FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan LEFT JOIN users u ON u.organisation_id=o.id
      LEFT JOIN branches b ON b.organisation_id=o.id LEFT JOIN clients c ON c.organisation_id=o.id LEFT JOIN audit_log a ON a.organisation_id=o.id
      WHERE o.status<>'archived'
      GROUP BY o.id ORDER BY o.name COLLATE NOCASE`).all(),
    db.prepare("SELECT organisation_id,review_date,status FROM care_plans WHERE status='Active'").all(),
    db.prepare("SELECT organisation_id,severity,status FROM risk_assessments WHERE status='Active'").all(),
    db.prepare("SELECT organisation_id,COUNT(*) total,MAX(started_at) last_support_at FROM support_sessions WHERE started_at>=datetime('now','-90 days') GROUP BY organisation_id").all(),
    db.prepare("SELECT organisation_id,action,created_at FROM audit_log WHERE created_at>=datetime('now','-90 days') ORDER BY created_at DESC").all()
  ]);
  const now=new Date(), byPlans={},byRisks={},bySupport={},byAudit={};
  for(const x of plans.results||[])(byPlans[x.organisation_id]??=[]).push(x);
  for(const x of risks.results||[])(byRisks[x.organisation_id]??=[]).push(x);
  for(const x of support.results||[])bySupport[x.organisation_id]=x;
  for(const x of auditRows.results||[])(byAudit[x.organisation_id]??=[]).push(x);
  const moduleName=a=>a.startsWith('client')?'Clients':a.startsWith('staff')?'Staff':a.startsWith('care_plan')?'Care Plans':a.startsWith('risk')?'Risks':a.startsWith('document')?'Documents':a.startsWith('security')||a.startsWith('auth')?'Security':a.startsWith('platform.support')?'Support':'Administration';
  const organisations=(orgs.results||[]).map(o=>{
    const activity=byAudit[o.id]||[], last=o.last_activity_at?new Date(o.last_activity_at+'Z'):null, daysInactive=last?Math.floor((now-last)/86400000):999;
    const overdue=(byPlans[o.id]||[]).filter(x=>x.review_date&&new Date(x.review_date+'T00:00:00Z')<now).length;
    const high=(byRisks[o.id]||[]).filter(x=>x.severity==='High').length, supportCount=Number(bySupport[o.id]?.total||0);
    const activeUsers=Number(o.active_users_30d||0), users=Number(o.user_count||0), adoption=users?Math.round(activeUsers/users*100):0;
    let score=100; const reasons=[];
    if(o.status!=='active'){score-=40;reasons.push('Account is not active')}
    if(o.subscription_status==='cancelled'){score-=35;reasons.push('Subscription is cancelled')}
    if(daysInactive>30){score-=25;reasons.push(`No activity for ${daysInactive} days`)} else if(daysInactive>14){score-=12;reasons.push(`Low activity for ${daysInactive} days`)}
    if(adoption<25){score-=20;reasons.push(`Only ${adoption}% of users active`)} else if(adoption<50){score-=10;reasons.push(`User adoption is ${adoption}%`)}
    if(overdue){score-=Math.min(20,overdue*4);reasons.push(`${overdue} overdue care plan review${overdue===1?'':'s'}`)}
    if(high){score-=Math.min(15,high*5);reasons.push(`${high} high risk${high===1?'':'s'} open`)}
    if(supportCount>=5){score-=10;reasons.push(`${supportCount} support sessions in 90 days`)}
    score=Math.max(0,Math.min(100,score));
    const modules={};for(const a of activity){const m=moduleName(a.action||'');modules[m]=(modules[m]||0)+1}
    const moduleUsage=Object.entries(modules).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
    const recommendations=[];
    if(daysInactive>14)recommendations.push('Arrange an engagement check-in with the organisation owner.');
    if(adoption<50)recommendations.push('Offer user adoption training and review inactive licences.');
    if(overdue)recommendations.push('Recommend a care-plan review workshop.');
    if(!modules.Risks)recommendations.push('Introduce the Risk Assessments module.');
    if(!modules.Documents)recommendations.push('Demonstrate document management and compliance storage.');
    if(supportCount>=5)recommendations.push('Review recurring support themes and create a success plan.');
    if(!recommendations.length)recommendations.push('Maintain regular success contact and identify expansion opportunities.');
    return {...o,health_score:score,health_band:score>=80?'healthy':score>=60?'attention':'risk',trend:daysInactive<=7?'up':daysInactive<=21?'steady':'down',days_inactive:daysInactive,adoption_score:adoption,overdue_plans:overdue,high_risks:high,support_90d:supportCount,reasons,recommendations,module_usage:moduleUsage};
  }).sort((a,b)=>a.health_score-b.health_score);
  const healthy=organisations.filter(o=>o.health_band==='healthy').length, attention=organisations.filter(o=>o.health_band==='attention').length, risk=organisations.filter(o=>o.health_band==='risk').length;
  const avg=organisations.length?Math.round(organisations.reduce((n,o)=>n+o.health_score,0)/organisations.length):100;
  return json({generatedAt:new Date().toISOString(),summary:{averageHealth:avg,healthy,attention,risk,averageAdoption:organisations.length?Math.round(organisations.reduce((n,o)=>n+o.adoption_score,0)/organisations.length):0,openRecommendations:organisations.reduce((n,o)=>n+o.recommendations.length,0)},organisations});
}

async function listOrganisations(db, session) {
  if (!requirePlatform(session)) return forbidden();
  const result = await db.prepare(`SELECT o.*,COALESCE(sp.name,o.subscription_plan,'Unassigned') plan_name,COALESCE(o.max_users,sp.max_users) effective_max_users,COALESCE(o.max_clients,sp.max_clients) effective_max_clients,COUNT(DISTINCT CASE WHEN b.status='active' THEN b.id END) branch_count,COUNT(DISTINCT CASE WHEN u.status='active' AND COALESCE(u.is_platform_user,0)=0 THEN u.id END) user_count,COUNT(DISTINCT CASE WHEN c.status<>'Archived' THEN c.id END) client_count FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan LEFT JOIN branches b ON b.organisation_id=o.id LEFT JOIN users u ON u.organisation_id=o.id LEFT JOIN clients c ON c.organisation_id=o.id GROUP BY o.id ORDER BY CASE o.status WHEN 'active' THEN 0 WHEN 'suspended' THEN 1 ELSE 2 END,o.name COLLATE NOCASE`).all();
  return json({organisations:result.results});
}
async function createOrganisation(request, db, session) {
  if (!canManagePlatform(session)) return forbidden();
  const input=await readJson(request), name=clean(input.name), plan=clean(input.subscriptionPlan)||"limited";
  if(!name) return json({error:{code:"VALIDATION_ERROR",message:"Enter an organisation name."}},400);
  const planRow=await db.prepare("SELECT id FROM subscription_plans WHERE id=? AND status='active'").bind(plan).first();
  if(!planRow)return json({error:{code:'INVALID_SUBSCRIPTION_PLAN',message:'Choose an active subscription plan.'}},400);
  const id=crypto.randomUUID(), branchId=crypto.randomUUID(), slug=(clean(input.slug)||name).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+id.slice(0,6);
  await db.batch([
    db.prepare("INSERT INTO organisations(id,name,slug,status,subscription_plan) VALUES(?,?,?,?,?)").bind(id,name,slug,"active",plan),
    db.prepare("INSERT INTO branches(id,organisation_id,name,code,status) VALUES(?,?,?,?,?)").bind(branchId,id,"Main Branch","MAIN","active"),
    auditStatement(db,session.organisation_id,session.user_id,"platform.organisation_created","organisation",id,{name})
  ]);
  return json({organisation:{id,name,slug,status:"active",subscription_plan:plan}},201);
}
async function updateOrganisationAdmin(request,db,session,id){
  if(!canManagePlatform(session)) return forbidden();
  const input=await readJson(request);
  const existing=await db.prepare("SELECT * FROM organisations WHERE id=?").bind(id).first();
  if(!existing) return json({error:{code:"NOT_FOUND",message:"Organisation not found."}},404);
  if(existing.billing_provider==='stripe'&&((input.subscriptionPlan!==undefined&&clean(input.subscriptionPlan)!==clean(existing.subscription_plan))||(input.subscriptionStatus!==undefined&&clean(input.subscriptionStatus)!==clean(existing.subscription_status))))return json({error:{code:'STRIPE_MANAGED_SUBSCRIPTION',message:'This subscription is managed by Stripe. Use the billing portal or sync it from Stripe.'}},409);
  const name=clean(input.name)||existing.name;
  const status=clean(input.status)||existing.status||"active";
  if(!["active","suspended","archived"].includes(status)) return json({error:{code:"VALIDATION_ERROR",message:"Choose a valid organisation status."}},400);
  const plan=clean(input.subscriptionPlan)||existing.subscription_plan||"development";
  const planRow=await db.prepare("SELECT id,status FROM subscription_plans WHERE id=?").bind(plan).first();
  if(!planRow||(plan!==existing.subscription_plan&&planRow.status!=='active'))return json({error:{code:'INVALID_SUBSCRIPTION_PLAN',message:'Choose an active subscription plan.'}},400);
  const subscriptionStatus=clean(input.subscriptionStatus)||existing.subscription_status||'trial';
  if(!['trial','active','past_due','cancelled'].includes(subscriptionStatus))return json({error:{code:'VALIDATION_ERROR',message:'Choose a valid subscription status.'}},400);
  const clearOverrides=input.clearLimitOverrides===true||clean(input.clearLimitOverrides)==='true'||plan!==existing.subscription_plan;
  const trialEndsAt=input.trialEndsAt===undefined?existing.trial_ends_at:(clean(input.trialEndsAt)||null),renewalDate=input.renewalDate===undefined?existing.renewal_date:(clean(input.renewalDate)||null),licenceReference=input.licenceReference===undefined?existing.licence_reference:(clean(input.licenceReference)||null);
  const flags=typeof input.featureFlags==='object'?JSON.stringify(input.featureFlags):(clean(input.featureFlagsJson)||existing.feature_flags_json||'{}');
  const statements=[db.prepare(`UPDATE organisations SET name=?,status=?,subscription_plan=?,subscription_status=?,trial_ends_at=?,renewal_date=?,licence_reference=?,max_users=?,max_clients=?,max_branches=?,storage_limit_mb=?,logo_url=?,primary_colour=?,contact_email=?,contact_phone=?,feature_flags_json=?,suspended_at=CASE WHEN ?='suspended' THEN COALESCE(suspended_at,CURRENT_TIMESTAMP) ELSE NULL END,archived_at=CASE WHEN ?='archived' THEN COALESCE(archived_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(
    name,status,plan,subscriptionStatus,trialEndsAt,renewalDate,licenceReference,
    clearOverrides?null:nullableNumber(input.maxUsers,existing.max_users),clearOverrides?null:nullableNumber(input.maxClients,existing.max_clients),clearOverrides?null:nullableNumber(input.maxBranches,existing.max_branches),clearOverrides?null:nullableNumber(input.storageLimitMb,existing.storage_limit_mb),
    clean(input.logoUrl)||existing.logo_url||null,clean(input.primaryColour)||existing.primary_colour||'#1f6f5f',clean(input.contactEmail)||existing.contact_email||null,clean(input.contactPhone)||existing.contact_phone||null,flags,status,status,id),
    db.prepare(`INSERT INTO platform_entitlement_sync(product_id,organisation_id,status,error_message,updated_at) SELECT product_id,organisation_id,'pending',NULL,CURRENT_TIMESTAMP FROM platform_product_organisations WHERE organisation_id=? ON CONFLICT(product_id,organisation_id) DO UPDATE SET status='pending',acknowledged_at=NULL,applied_at=NULL,error_message=NULL,updated_at=CURRENT_TIMESTAMP`).bind(id),
    auditStatement(db,session.organisation_id,session.user_id,"platform.organisation_updated","organisation",id,{before:{status:existing.status,plan:existing.subscription_plan,subscriptionStatus:existing.subscription_status},after:{name,status,plan,subscriptionStatus},planLimitsApplied:clearOverrides})
  ];
  if(status==='archived'&&existing.status!=='archived')statements.push(db.prepare("DELETE FROM sessions WHERE organisation_id=? AND COALESCE(switched_by_platform_user,0)=0").bind(id));
  await db.batch(statements);
  return json({ok:true});
}
function nullableNumber(value,fallback=null){if(value===undefined||value===null||value==='')return fallback===undefined?null:fallback;const n=Number(value);return Number.isFinite(n)?n:null;}
async function switchOrganisation(request,db,session){
  if(!requirePlatform(session)) return forbidden(); const input=await readJson(request),orgId=clean(input.organisationId),branchId=clean(input.branchId)||null,reason=clean(input.reason),requestedMode=clean(input.accessMode),accessMode=requestedMode==='read_only'?'read_only':'full';
  if(accessMode==='full'&&!canManagePlatform(session))return forbidden();
  if(!reason || reason.length<10) return json({error:{code:"SUPPORT_REASON_REQUIRED",message:"Enter a clear reason of at least 10 characters for entering Support Mode."}},400);
  const org=await db.prepare("SELECT id,name,status FROM organisations WHERE id=?").bind(orgId).first(); if(!org)return json({error:{code:"NOT_FOUND",message:"Organisation not found."}},404);
  if(org.status!=="active") return json({error:{code:"ORGANISATION_SUSPENDED",message:"This organisation is suspended."}},403);
  if(branchId){const branch=await db.prepare("SELECT id FROM branches WHERE id=? AND organisation_id=? AND status='active'").bind(branchId,orgId).first();if(!branch)return json({error:{code:"INVALID_BRANCH",message:"Branch does not belong to this organisation."}},400);}
  const origin=session.support_mode ? session.support_origin_organisation_id : session.organisation_id;
  const supportId=crypto.randomUUID();
  await db.batch([
    db.prepare("UPDATE sessions SET organisation_id=?,active_branch_id=?,switched_by_platform_user=1,support_mode=1,support_origin_organisation_id=?,support_started_at=CURRENT_TIMESTAMP,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(orgId,branchId,origin,session.session_id),
    db.prepare("INSERT INTO support_sessions(id,organisation_id,platform_user_id,reason,access_mode,session_id) VALUES(?,?,?,?,?,?)").bind(supportId,orgId,session.user_id,reason,accessMode,session.session_id),
    auditStatement(db,orgId,session.user_id,"platform.support_mode_entered","organisation",orgId,{from:session.organisation_id,branchId,reason,accessMode,supportId})
  ]);
  return json({ok:true,organisation:org,supportMode:true});
}
async function exitSupportMode(db,session){
  if(!requirePlatformIdentity(session)) return forbidden();
  if(!session.support_mode) return json({ok:true,supportMode:false});
  const origin=session.support_origin_organisation_id;
  const org=origin?await db.prepare("SELECT id,name,status FROM organisations WHERE id=?").bind(origin).first():null;
  const fallback=org||await db.prepare("SELECT id,name,status FROM organisations WHERE status='active' ORDER BY created_at LIMIT 1").first();
  if(!fallback)return json({error:{code:"NO_ORGANISATION",message:"No active platform organisation is available."}},409);
  await db.batch([
    db.prepare("UPDATE support_sessions SET ended_at=CURRENT_TIMESTAMP WHERE session_id=? AND ended_at IS NULL").bind(session.session_id),
    db.prepare("UPDATE sessions SET organisation_id=?,active_branch_id=NULL,support_mode=0,support_origin_organisation_id=NULL,support_started_at=NULL,last_seen_at=CURRENT_TIMESTAMP WHERE id=?").bind(fallback.id,session.session_id),
    auditStatement(db,session.organisation_id,session.user_id,"platform.support_mode_exited","organisation",session.organisation_id,{returnedTo:fallback.id})
  ]);
  return json({ok:true,supportMode:false,organisation:fallback});
}
async function getPlatformOrganisation(db,session,id){
  if(!requirePlatform(session)) return forbidden();
  const org=await db.prepare(`SELECT o.*,
    sp.name AS plan_name,sp.monthly_price_pence,sp.max_users AS plan_max_users,sp.max_clients AS plan_max_clients,sp.storage_mb AS plan_storage_mb,
    COALESCE(o.max_users,sp.max_users) AS effective_max_users,COALESCE(o.max_clients,sp.max_clients) AS effective_max_clients,COALESCE(o.storage_limit_mb,sp.storage_mb) AS effective_storage_mb,
    (SELECT COUNT(*) FROM branches b WHERE b.organisation_id=o.id) branch_count,
    (SELECT COUNT(*) FROM users u WHERE u.organisation_id=o.id AND COALESCE(u.is_platform_user,0)=0) user_count,
    (SELECT COUNT(*) FROM users u WHERE u.organisation_id=o.id AND u.status='active' AND COALESCE(u.is_platform_user,0)=0) active_user_count,
    (SELECT COUNT(*) FROM clients c WHERE c.organisation_id=o.id AND c.status<>'Archived') client_count,
    (SELECT COUNT(*) FROM staff st WHERE st.organisation_id=o.id AND st.status='Active') staff_count,
    (SELECT MAX(al.created_at) FROM audit_log al WHERE al.organisation_id=o.id) last_activity_at,
    (SELECT COUNT(*) FROM care_plans cp WHERE cp.organisation_id=o.id AND cp.status='Active') active_care_plans,
    (SELECT COUNT(*) FROM care_plans cp WHERE cp.organisation_id=o.id AND cp.status='Active' AND cp.review_date<date('now')) overdue_care_plans,
    (SELECT COUNT(*) FROM risk_assessments ra WHERE ra.organisation_id=o.id AND lower(COALESCE(ra.risk_level,'')) IN ('high','critical') AND lower(COALESCE(ra.status,'active')) NOT IN ('closed','archived')) high_risks,
    (SELECT COUNT(*) FROM client_documents cd WHERE cd.organisation_id=o.id) document_count
    FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=?`).bind(id).first();
  if(!org)return json({error:{code:"NOT_FOUND",message:"Organisation not found."}},404);
  const [support,branches,users,auditRows,notes,security,logins,revenue,plans]=await Promise.all([
    db.prepare(`SELECT ss.*,u.display_name FROM support_sessions ss LEFT JOIN users u ON u.id=ss.platform_user_id WHERE ss.organisation_id=? ORDER BY ss.started_at DESC LIMIT 20`).bind(id).all(),
    db.prepare(`SELECT b.*,(SELECT COUNT(*) FROM users u WHERE u.organisation_id=b.organisation_id AND u.home_branch_id=b.id) user_count,(SELECT COUNT(*) FROM clients c WHERE c.organisation_id=b.organisation_id AND c.branch_id=b.id AND c.status<>'Archived') client_count FROM branches b WHERE b.organisation_id=? ORDER BY b.status,b.name`).bind(id).all(),
    db.prepare(`SELECT u.id,u.display_name,u.email,u.access_level,u.status,u.last_login_at,b.name branch_name FROM users u LEFT JOIN branches b ON b.id=u.home_branch_id WHERE u.organisation_id=? ORDER BY CASE WHEN u.status='active' THEN 0 ELSE 1 END,u.display_name LIMIT 100`).bind(id).all(),
    db.prepare(`SELECT al.*,u.display_name user_name FROM audit_log al LEFT JOIN users u ON u.id=al.user_id WHERE al.organisation_id=? ORDER BY al.created_at DESC LIMIT 40`).bind(id).all(),
    db.prepare(`SELECT csn.*,u.display_name author_name FROM customer_success_notes csn LEFT JOIN users u ON u.id=csn.created_by WHERE csn.organisation_id=? ORDER BY csn.created_at DESC LIMIT 20`).bind(id).all(),
    db.prepare(`SELECT * FROM organisation_security_policies WHERE organisation_id=?`).bind(id).first(),
    db.prepare(`SELECT lh.*,u.display_name FROM login_history lh LEFT JOIN users u ON u.id=lh.user_id WHERE lh.organisation_id=? ORDER BY lh.created_at DESC LIMIT 20`).bind(id).all(),
    db.prepare(`SELECT * FROM revenue_events WHERE organisation_id=? ORDER BY occurred_at DESC LIMIT 20`).bind(id).all(),
    db.prepare(`SELECT id,name,monthly_price_pence,max_users,max_clients,status FROM subscription_plans WHERE status='active' OR id=? ORDER BY monthly_price_pence,name`).bind(org.subscription_plan).all()
  ]);
  const activeUsers30=Number((await db.prepare(`SELECT COUNT(DISTINCT user_id) total FROM audit_log WHERE organisation_id=? AND created_at>=datetime('now','-30 days')`).bind(id).first())?.total||0);
  const health=calculateOrganisationHealth({...org,active_users_30d:activeUsers30});
  const subscriptionUsage={users:subscriptionLimitState(org.active_user_count,org.effective_max_users),clients:subscriptionLimitState(org.client_count,org.effective_max_clients)};
  return json({
    organisation:{...normaliseOrganisation(org),health_score:health.score,health_band:health.band,health_reasons:health.reasons,active_users_30d:activeUsers30,subscription_usage:subscriptionUsage},
    supportHistory:support.results||[],branches:branches.results||[],users:users.results||[],activity:auditRows.results||[],successNotes:notes.results||[],securityPolicy:security?{...security,identity_provider:'Cloudflare Access',mfa_enforcement:'managed_externally',device_posture_enforcement:'managed_externally'}:null,loginHistory:logins.results||[],revenueEvents:revenue.results||[],plans:plans.results||[],canManage:canManagePlatform(session)
  });
}
function parseJson(value,fallback){try{return JSON.parse(value||'')}catch{return fallback}}
function normaliseOrganisation(org){return {...org,featureFlags:parseJson(org.feature_flags_json,{}),terminology:parseJson(org.terminology_json,{}),dashboardWidgets:parseJson(org.dashboard_widgets_json,["metrics","attention","activity","compliance"]),sidebarOrder:parseJson(org.sidebar_order_json,[])}}
async function getOrganisationProfile(db,session){
  const org=await db.prepare("SELECT * FROM organisations WHERE id=?").bind(session.organisation_id).first();
  if(!org)return json({error:{code:"NOT_FOUND",message:"Organisation not found."}},404);
  return json({organisation:normaliseOrganisation(org)});
}
async function updateOrganisationProfile(request,db,session){
  if(!hasRole(session,["owner","organisation_owner","organisation_admin"]))return forbidden();
  const i=await readJson(request),name=clean(i.name),colour=clean(i.primaryColour)||"#1f6f5f",secondary=clean(i.secondaryColour)||"#0f172a";
  if(!name)return json({error:{code:"VALIDATION_ERROR",message:"Enter an organisation name."}},400);
  const terminology=JSON.stringify(i.terminology||{}),widgets=JSON.stringify(i.dashboardWidgets||["metrics","attention","activity","compliance"]),sidebar=JSON.stringify(i.sidebarOrder||[]);
  await db.batch([
    db.prepare(`UPDATE organisations SET name=?,short_name=?,logo_url=?,primary_colour=?,secondary_colour=?,contact_email=?,contact_phone=?,website=?,email_sender_name=?,login_message=?,dashboard_welcome=?,document_header=?,document_footer=?,invoice_footer=?,timezone=?,currency=?,date_format=?,time_format=?,week_start=?,terminology_json=?,dashboard_widgets_json=?,sidebar_order_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(name,clean(i.shortName),clean(i.logoUrl),colour,secondary,clean(i.contactEmail),clean(i.contactPhone),clean(i.website),clean(i.emailSenderName),clean(i.loginMessage),clean(i.dashboardWelcome),clean(i.documentHeader),clean(i.documentFooter),clean(i.invoiceFooter),clean(i.timezone)||'Europe/London',clean(i.currency)||'GBP',clean(i.dateFormat)||'DD/MM/YYYY',clean(i.timeFormat)||'24h',clean(i.weekStart)||'monday',terminology,widgets,sidebar,session.organisation_id),
    auditStatement(db,session.organisation_id,session.user_id,"organisation.customisation_updated","organisation",session.organisation_id,{name,colour})
  ]);
  return getOrganisationProfile(db,session);
}
async function listBranches(db,session){const r=await db.prepare("SELECT * FROM branches WHERE organisation_id=? ORDER BY status,name COLLATE NOCASE").bind(session.organisation_id).all();return json({branches:r.results});}
async function createBranch(request,db,session){if(!hasRole(session,["owner","manager","organisation_owner","organisation_admin"]))return forbidden();const i=await readJson(request),name=clean(i.name);if(!name)return json({error:{code:"VALIDATION_ERROR",message:"Enter a branch name."}},400);const id=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO branches(id,organisation_id,name,code,address,phone,email,status) VALUES(?,?,?,?,?,?,?,?)").bind(id,session.organisation_id,name,clean(i.code),clean(i.address),clean(i.phone),clean(i.email),"active"),auditStatement(db,session.organisation_id,session.user_id,"branch.created","branch",id,{name})]);return json({branch:{id,name,status:"active"}},201);}
async function updateBranch(request,db,session,id){if(!hasRole(session,["owner","manager","organisation_owner","organisation_admin"]))return forbidden();const i=await readJson(request),name=clean(i.name),status=clean(i.status)||"active";if(!name)return json({error:{code:"VALIDATION_ERROR",message:"Enter a branch name."}},400);if(!["active","inactive"].includes(status))return json({error:{code:"VALIDATION_ERROR",message:"Choose a valid branch status."}},400);const existing=await db.prepare("SELECT id,name,code,address,phone,email,status FROM branches WHERE id=? AND organisation_id=? LIMIT 1").bind(id,session.organisation_id).first();if(!existing)return json({error:{code:"NOT_FOUND",message:"Branch not found."}},404);await db.batch([db.prepare("UPDATE branches SET name=?,code=?,address=?,phone=?,email=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?").bind(name,clean(i.code),clean(i.address),clean(i.phone),clean(i.email),status,id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,"branch.updated","branch",id,{before:existing,after:{name,code:clean(i.code),address:clean(i.address),phone:clean(i.phone),email:clean(i.email),status}})]);return json({ok:true});}
async function listFamilyAccess(db,session){if(!hasRole(session,["owner","manager","organisation_owner","organisation_admin","branch_manager"]))return forbidden();const r=await db.prepare(`SELECT f.*,u.display_name,u.email,c.first_name,c.last_name FROM family_client_access f JOIN users u ON u.id=f.user_id JOIN clients c ON c.id=f.client_id WHERE f.organisation_id=? ORDER BY u.display_name`).bind(session.organisation_id).all();return json({links:r.results});}
async function saveFamilyAccess(request,db,session){if(!hasRole(session,["owner","manager","organisation_owner","organisation_admin","branch_manager"]))return forbidden();const i=await readJson(request),userId=clean(i.userId),clientId=clean(i.clientId);const user=await db.prepare("SELECT id FROM users WHERE id=? AND organisation_id=? AND access_level='family'").bind(userId,session.organisation_id).first(),client=await db.prepare("SELECT id FROM clients WHERE id=? AND organisation_id=?").bind(clientId,session.organisation_id).first();if(!user||!client)return json({error:{code:"VALIDATION_ERROR",message:"Choose a family user and client from this organisation."}},400);const id=crypto.randomUUID();await db.prepare(`INSERT INTO family_client_access(id,organisation_id,user_id,client_id,can_view_profile,can_view_visits,can_view_care_updates,can_view_documents,can_view_medication,status) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,client_id) DO UPDATE SET can_view_profile=excluded.can_view_profile,can_view_visits=excluded.can_view_visits,can_view_care_updates=excluded.can_view_care_updates,can_view_documents=excluded.can_view_documents,can_view_medication=excluded.can_view_medication,status='active'`).bind(id,session.organisation_id,userId,clientId,i.canViewProfile!==false?1:0,i.canViewVisits!==false?1:0,i.canViewCareUpdates!==false?1:0,i.canViewDocuments?1:0,i.canViewMedication?1:0,"active").run();return json({ok:true},201);}


// Sprint 12 — completed enterprise security services
const STANDARD_PERMISSION_MAP = {
  organisation_owner: ['*'], organisation_admin: ['dashboard.view','operations.view','operations.manage','rota.view','rota.create','rota.edit','rota.publish','rota.cancel','rota.time_critical.override','visits.view','visits.clock','visits.override','medication.view','medication.manage','tasks.view','tasks.manage','incidents.view','incidents.manage','finance.view','finance.manage','family_portal.manage','organisation.settings.view','organisation.settings.manage','security.roles.view','security.roles.manage','security.users.view','security.users.manage','security.audit.view','security.sessions.manage','clients.view','clients.create','clients.edit','clients.archive','staff.view','staff.create','staff.edit','care_plans.view','care_plans.create','care_plans.edit','care_plans.archive','risks.view','risks.manage','documents.view','documents.manage','reports.view','data.export'],
  branch_manager: ['dashboard.view','operations.view','operations.manage','rota.view','rota.create','rota.edit','rota.publish','visits.view','visits.clock','medication.view','medication.manage','tasks.view','tasks.manage','incidents.view','incidents.manage','family_portal.manage','organisation.settings.view','security.roles.view','security.users.view','clients.view','clients.create','clients.edit','staff.view','staff.create','staff.edit','care_plans.view','care_plans.create','care_plans.edit','risks.view','risks.manage','documents.view','documents.manage','reports.view'],
  senior_carer: ['dashboard.view','operations.view','visits.view','visits.clock','medication.view','medication.manage','tasks.view','tasks.manage','incidents.view','incidents.manage','clients.view','clients.edit','staff.view','care_plans.view','care_plans.create','care_plans.edit','risks.view','risks.manage','documents.view','documents.manage'],
  carer: ['dashboard.view','visits.view','visits.clock','tasks.view','medication.view','clients.view','staff.view','care_plans.view','risks.view','documents.view'],
  office_staff: ['dashboard.view','operations.view','rota.view','rota.create','rota.edit','rota.publish','visits.view','tasks.view','tasks.manage','incidents.view','family_portal.manage','organisation.settings.view','clients.view','clients.create','clients.edit','staff.view','staff.create','staff.edit','reports.view'],
  auditor: ['dashboard.view','operations.view','rota.view','visits.view','medication.view','tasks.view','incidents.view','finance.view','organisation.settings.view','security.roles.view','security.users.view','security.audit.view','clients.view','staff.view','care_plans.view','risks.view','documents.view','reports.view'],
  family: ['clients.view'], platform_owner: ['*'], platform_admin: ['*']
};
function canManageSecurity(session){return session.is_platform_user || ['organisation_owner','organisation_admin'].includes(session.access_level) || session.role==='owner';}
async function userHasPermission(db,session,key){
  if(session.is_platform_user || ['platform_owner','organisation_owner'].includes(session.access_level)) return true;
  const overrides=await db.prepare(`SELECT permission_key,effect FROM user_permission_overrides WHERE organisation_id=? AND user_id=?`).bind(session.organisation_id,session.user_id).all();
  const direct=overrides.results||[];
  if(direct.some(r=>r.permission_key===key&&r.effect==='deny')) return false;
  if(direct.some(r=>r.permission_key===key&&r.effect==='allow')) return true;
  const assignments=await db.prepare(`SELECT crp.permission_key,crp.effect FROM user_custom_roles ucr JOIN custom_roles cr ON cr.id=ucr.role_id AND cr.is_active=1 JOIN custom_role_permissions crp ON crp.role_id=cr.id WHERE ucr.user_id=? AND ucr.organisation_id=? AND (ucr.valid_from IS NULL OR datetime(ucr.valid_from)<=CURRENT_TIMESTAMP) AND (ucr.valid_until IS NULL OR datetime(ucr.valid_until)>CURRENT_TIMESTAMP) AND (ucr.branch_id IS NULL OR ucr.branch_id=?)`).bind(session.user_id,session.organisation_id,session.active_branch_id||session.home_branch_id||'').all();
  const rows=assignments.results||[];
  if(rows.some(r=>r.permission_key===key&&r.effect==='deny')) return false;
  if(rows.some(r=>r.permission_key===key&&r.effect==='allow')) return true;
  const standard=STANDARD_PERMISSION_MAP[session.access_level]||STANDARD_PERMISSION_MAP[session.role]||[];
  return standard.includes('*')||standard.includes(key);
}
async function listPermissionCatalogue(db,session){if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.roles.view'))return forbidden();const r=await db.prepare('SELECT * FROM permission_catalog ORDER BY category,name').all();return json({permissions:r.results||[]});}
async function listCustomRoles(db,session){if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.roles.view'))return forbidden();const r=await db.prepare(`SELECT cr.*,(SELECT COUNT(*) FROM custom_role_permissions p WHERE p.role_id=cr.id) permission_count,(SELECT COUNT(*) FROM user_custom_roles u WHERE u.role_id=cr.id) user_count FROM custom_roles cr WHERE cr.organisation_id=? AND cr.is_active=1 ORDER BY cr.name`).bind(session.organisation_id).all();for(const role of r.results||[]){const p=await db.prepare('SELECT permission_key,effect FROM custom_role_permissions WHERE role_id=? ORDER BY permission_key').bind(role.id).all();role.permissions=p.results||[];}return json({roles:r.results||[]});}
async function saveRole(request,db,session,id){if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.roles.manage'))return forbidden();const i=await readJson(request),name=clean(i.name),description=clean(i.description),colour=clean(i.colour)||'#0f766e',permissions=Array.isArray(i.permissions)?[...new Set(i.permissions.map(clean).filter(Boolean))]:[];if(name.length<2)return json({error:{code:'VALIDATION_ERROR',message:'Enter a role name.'}},400);if(!id)id=crypto.randomUUID();const existing=await db.prepare('SELECT id FROM custom_roles WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first();const statements=[];if(existing)statements.push(db.prepare('UPDATE custom_roles SET name=?,description=?,colour=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?').bind(name,description,colour,id,session.organisation_id));else statements.push(db.prepare('INSERT INTO custom_roles(id,organisation_id,name,description,colour,created_by) VALUES(?,?,?,?,?,?)').bind(id,session.organisation_id,name,description,colour,session.user_id));statements.push(db.prepare('DELETE FROM custom_role_permissions WHERE role_id=? AND EXISTS (SELECT 1 FROM custom_roles r WHERE r.id=role_id AND r.organisation_id=?)').bind(id,session.organisation_id));for(const key of permissions)statements.push(db.prepare('INSERT OR IGNORE INTO custom_role_permissions(role_id,permission_key,effect) SELECT ?,permission_key,? FROM permission_catalog WHERE permission_key=?').bind(id,'allow',key));statements.push(auditStatement(db,session.organisation_id,session.user_id,existing?'security.role_updated':'security.role_created','custom_role',id,{name,permissions}));await db.batch(statements);return json({ok:true,id},existing?200:201);}
async function createCustomRole(request,db,session){return saveRole(request,db,session,null)}
async function updateCustomRole(request,db,session,id){return saveRole(request,db,session,id)}
async function deleteCustomRole(db,session,id){if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.roles.manage'))return forbidden();const role=await db.prepare('SELECT id,name FROM custom_roles WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first();if(!role)return json({error:{code:'NOT_FOUND',message:'Role not found.'}},404);await db.batch([db.prepare('DELETE FROM user_custom_roles WHERE role_id=? AND organisation_id=?').bind(id,session.organisation_id),db.prepare('UPDATE custom_roles SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organisation_id=?').bind(id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'security.role_deleted','custom_role',id,{name:role.name})]);return json({ok:true});}
async function securityOverview(db,session){if(!canManageSecurity(session))return forbidden();const r=await db.prepare(`SELECT (SELECT COUNT(*) FROM custom_roles WHERE organisation_id=? AND is_active=1) customRoles,(SELECT COUNT(*) FROM users WHERE organisation_id=? AND status='active') activeUsers,(SELECT COUNT(*) FROM sessions WHERE organisation_id=? AND datetime(expires_at)>CURRENT_TIMESTAMP) activeSessions,(SELECT COUNT(*) FROM audit_log WHERE organisation_id=? AND created_at>=datetime('now','-1 day') AND action LIKE 'security.%') securityEvents24h`).bind(session.organisation_id,session.organisation_id,session.organisation_id,session.organisation_id).first();return json(r||{});}
async function listActiveSessions(db,session){if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.sessions.manage'))return forbidden();const r=await db.prepare(`SELECT s.id,s.user_id,s.created_at,s.last_seen_at,s.expires_at,s.user_agent,s.ip_hint,u.display_name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.organisation_id=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP ORDER BY s.last_seen_at DESC`).bind(session.organisation_id).all();return json({sessions:r.results||[],currentSessionId:session.session_id});}
async function revokeSession(db,session,id){if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.sessions.manage'))return forbidden();if(id===session.session_id)return json({error:{code:'CURRENT_SESSION',message:'Use sign out to end your current session.'}},400);const target=await db.prepare('SELECT id,user_id FROM sessions WHERE id=? AND organisation_id=?').bind(id,session.organisation_id).first();if(!target)return json({error:{code:'NOT_FOUND',message:'Session not found.'}},404);await db.batch([db.prepare('DELETE FROM sessions WHERE id=? AND organisation_id=?').bind(id,session.organisation_id),auditStatement(db,session.organisation_id,session.user_id,'security.session_revoked','session',id,{targetUserId:target.user_id})]);return json({ok:true});}
async function getSecurityPolicy(db,session){if(!canManageSecurity(session))return forbidden();await db.prepare('INSERT OR IGNORE INTO organisation_security_policies(organisation_id) VALUES(?)').bind(session.organisation_id).run();const p=await db.prepare('SELECT * FROM organisation_security_policies WHERE organisation_id=?').bind(session.organisation_id).first();return json({policy:{...p,require_mfa:0,require_trusted_device:0,allow_password_login:1},identityEnforcement:{provider:'Cloudflare Access',mfa:'managed_externally',devicePosture:'managed_externally',workerPasswordLogin:true,message:'MFA, identity provider and trusted-device rules are enforced in Cloudflare Access before this application loads.'}});}
async function updateSecurityPolicy(request,db,session){if(!canManageSecurity(session))return forbidden();const i=await readJson(request),hours=Math.max(1,Math.min(168,Number(i.sessionHours)||12)),idle=Math.max(5,Math.min(1440,Number(i.idleTimeoutMinutes)||60));if(i.requireMfa||i.requireTrustedDevice||i.allowPasswordLogin===false)return json({error:{code:'ACCESS_POLICY_MANAGED_EXTERNALLY',message:'MFA, trusted-device and identity-provider rules must be changed in Cloudflare Access. CoreCare only manages session duration here.'}},409);await db.batch([db.prepare(`INSERT INTO organisation_security_policies(organisation_id,require_mfa,session_hours,idle_timeout_minutes,allow_password_login,require_trusted_device,updated_at) VALUES(?,0,?,?,1,0,CURRENT_TIMESTAMP) ON CONFLICT(organisation_id) DO UPDATE SET require_mfa=0,session_hours=excluded.session_hours,idle_timeout_minutes=excluded.idle_timeout_minutes,allow_password_login=1,require_trusted_device=0,updated_at=CURRENT_TIMESTAMP`).bind(session.organisation_id,hours,idle),auditStatement(db,session.organisation_id,session.user_id,'security.policy_updated','organisation_security_policy',session.organisation_id,{hours,idle,identityProvider:'Cloudflare Access'})]);return getSecurityPolicy(db,session);}
async function listLoginHistory(db,session){if(!canManageSecurity(session))return forbidden();const r=await db.prepare(`SELECT lh.*,u.display_name,u.email FROM login_history lh LEFT JOIN users u ON u.id=lh.user_id WHERE lh.organisation_id=? ORDER BY lh.created_at DESC LIMIT 100`).bind(session.organisation_id).all();return json({events:r.results||[]});}
async function effectiveAccess(db,session,url){if(!canManageSecurity(session))return forbidden();const userId=clean(url.searchParams.get('userId'));const user=await db.prepare('SELECT id,display_name,email,access_level,home_branch_id FROM users WHERE id=? AND organisation_id=?').bind(userId,session.organisation_id).first();if(!user)return json({error:{code:'NOT_FOUND',message:'User not found.'}},404);const catalog=await db.prepare('SELECT permission_key,category,name,risk_level FROM permission_catalog ORDER BY category,name').all();const fake={...session,user_id:user.id,access_level:user.access_level,home_branch_id:user.home_branch_id,is_platform_user:0};const permissions=[];for(const p of catalog.results||[])if(await userHasPermission(db,fake,p.permission_key))permissions.push(p);return json({user,permissions});}
async function updateEmergencyMode(request,db,session){if(!canManageSecurity(session))return forbidden();const i=await readJson(request),enabled=!!i.enabled,reason=clean(i.reason);if(enabled&&reason.length<8)return json({error:{code:'REASON_REQUIRED',message:'Enter a clear reason for enabling emergency mode.'}},400);await db.batch([db.prepare(`INSERT INTO organisation_security_policies(organisation_id,emergency_mode,emergency_reason,emergency_started_at,emergency_started_by) VALUES(?,?,?,?,?) ON CONFLICT(organisation_id) DO UPDATE SET emergency_mode=excluded.emergency_mode,emergency_reason=excluded.emergency_reason,emergency_started_at=excluded.emergency_started_at,emergency_started_by=excluded.emergency_started_by,updated_at=CURRENT_TIMESTAMP`).bind(session.organisation_id,enabled?1:0,enabled?reason:null,enabled?new Date().toISOString():null,enabled?session.user_id:null),auditStatement(db,session.organisation_id,session.user_id,enabled?'security.emergency_mode_enabled':'security.emergency_mode_disabled','organisation',session.organisation_id,{reason})]);return getSecurityPolicy(db,session);}

async function platformAssistantHistory(db, session) {
  if (!requirePlatform(session)) return forbidden();
  const conversation = await db.prepare("SELECT id FROM ai_conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 1").bind(session.user_id).first();
  if (!conversation) return json({ conversationId: null, messages: [] });
  const rows = await db.prepare("SELECT role,content,created_at FROM ai_messages WHERE conversation_id=? ORDER BY created_at,id LIMIT 60").bind(conversation.id).all();
  return json({ conversationId: conversation.id, messages: rows.results || [] });
}

async function platformAssistant(request, db, session) {
  if (!requirePlatform(session)) return forbidden();
  const input = await readJson(request);
  const question = clean(input.question).slice(0, 500);
  if (question.length < 2) return json({ error: { code: 'VALIDATION_ERROR', message: 'Enter a question.' } }, 400);

  let conversationId = clean(input.conversationId);
  if (conversationId) {
    const own = await db.prepare("SELECT id FROM ai_conversations WHERE id=? AND user_id=?").bind(conversationId, session.user_id).first();
    if (!own) conversationId = '';
  }
  if (!conversationId) {
    conversationId = crypto.randomUUID();
    await db.prepare("INSERT INTO ai_conversations(id,user_id,title) VALUES(?,?,?)").bind(conversationId, session.user_id, question.slice(0, 80)).run();
  }

  const [orgs, users, clients, carePlans, risks, errors, sessions, support, revenueEvents] = await Promise.all([
    db.prepare(`SELECT o.id,o.name,o.status,o.subscription_status,o.renewal_date,
      COALESCE(sp.name,o.subscription_plan,'Unassigned') plan_name,
      COALESCE(sp.monthly_price_pence,0) monthly_price_pence,
      MAX(a.created_at) last_activity_at,COUNT(DISTINCT u.id) user_count
      FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan
      LEFT JOIN users u ON u.organisation_id=o.id LEFT JOIN audit_log a ON a.organisation_id=o.id
      GROUP BY o.id ORDER BY o.name`).all(),
    db.prepare("SELECT COUNT(*) total,COUNT(CASE WHEN last_login_at>=datetime('now','-30 days') THEN 1 END) active30 FROM users").first(),
    db.prepare("SELECT COUNT(*) total FROM clients WHERE status<>'Archived'").first(),
    db.prepare("SELECT organisation_id,COUNT(*) total,COUNT(CASE WHEN review_date<date('now') AND status='Active' THEN 1 END) overdue FROM care_plans GROUP BY organisation_id").all(),
    db.prepare("SELECT organisation_id,COUNT(*) total,COUNT(CASE WHEN severity='High' AND status='Active' THEN 1 END) high FROM risk_assessments GROUP BY organisation_id").all(),
    db.prepare("SELECT COUNT(*) total FROM api_error_log WHERE created_at>=datetime('now','-1 day')").first(),
    db.prepare("SELECT COUNT(*) total FROM sessions WHERE datetime(expires_at)>CURRENT_TIMESTAMP").first(),
    db.prepare("SELECT COUNT(*) total FROM support_sessions WHERE ended_at IS NULL").first(),
    db.prepare("SELECT COALESCE(SUM(amount_pence),0) total FROM revenue_events WHERE occurred_at>=date('now','start of month')").first()
  ]);

  const planMap = Object.fromEntries((carePlans.results || []).map(x => [x.organisation_id, x]));
  const riskMap = Object.fromEntries((risks.results || []).map(x => [x.organisation_id, x]));
  const organisations = (orgs.results || []).map(o => {
    let score = 100;
    const daysInactive = o.last_activity_at ? Math.floor((Date.now() - new Date(o.last_activity_at + 'Z')) / 86400000) : 999;
    const overdue = Number(planMap[o.id]?.overdue || 0);
    const high = Number(riskMap[o.id]?.high || 0);
    if (o.status !== 'active') score -= 45;
    if (daysInactive > 30) score -= 25; else if (daysInactive > 14) score -= 12;
    if (overdue) score -= Math.min(25, overdue * 5);
    if (high) score -= 10;
    if (!o.user_count) score -= 15;
    return { ...o, daysInactive, overdue, high, health: Math.max(0, score) };
  });

  const billable = organisations.filter(o => o.status === 'active' && o.subscription_status !== 'cancelled');
  const mrr = billable.reduce((n, o) => n + Number(o.monthly_price_pence || 0), 0);
  const atRisk = organisations.filter(o => o.health < 70).sort((a, b) => a.health - b.health);
  const renewals = organisations.filter(o => o.renewal_date).map(o => ({ ...o, days: Math.ceil((new Date(o.renewal_date + 'T00:00:00Z') - new Date()) / 86400000) })).filter(o => o.days >= 0 && o.days <= 90).sort((a, b) => a.days - b.days);
  const q = question.toLowerCase();
  const money = p => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(p / 100);
  let answer = '';

  if (/revenue|mrr|arr|income|commercial/.test(q)) {
    answer = `Current MRR is ${money(mrr)} and annual run rate is ${money(mrr * 12)} across ${billable.length} billable organisation${billable.length === 1 ? '' : 's'}. Revenue events recorded this month total ${money(Number(revenueEvents?.total || 0))}. Average revenue per billable organisation is ${money(billable.length ? Math.round(mrr / billable.length) : 0)}.`;
  } else if (/risk|attention|health|inactive|customer/.test(q)) {
    answer = atRisk.length ? `${atRisk.length} organisation${atRisk.length === 1 ? ' needs' : 's need'} attention:\n${atRisk.slice(0, 8).map(o => `• ${o.name}: health ${o.health}%, ${o.status !== 'active' ? 'account not active' : o.daysInactive > 14 ? `inactive for ${o.daysInactive} days` : o.overdue ? `${o.overdue} overdue care-plan review${o.overdue === 1 ? '' : 's'}` : o.high ? `${o.high} high risk${o.high === 1 ? '' : 's'}` : 'low adoption'}`).join('\n')}` : 'No organisations currently score below the attention threshold. The customer portfolio is healthy.';
  } else if (/renewal|renew/.test(q)) {
    answer = renewals.length ? `${renewals.length} renewal${renewals.length === 1 ? ' is' : 's are'} due in the next 90 days:\n${renewals.slice(0, 10).map(o => `• ${o.name}: ${o.days} days, ${o.plan_name}, ${money(o.monthly_price_pence)}/month`).join('\n')}` : 'There are no organisation renewals due in the next 90 days.';
  } else if (/error|operation|system|platform|healthy|session/.test(q)) {
    answer = `Platform status is ${Number(errors?.total || 0) === 0 ? 'healthy' : 'being monitored'}. There ${Number(errors?.total || 0) === 1 ? 'has' : 'have'} been ${Number(errors?.total || 0)} API error${Number(errors?.total || 0) === 1 ? '' : 's'} in the last 24 hours, ${Number(sessions?.total || 0)} active session${Number(sessions?.total || 0) === 1 ? '' : 's'}, and ${Number(support?.total || 0)} active Support Mode session${Number(support?.total || 0) === 1 ? '' : 's'}.`;
  } else if (/care plan|review|compliance/.test(q)) {
    const overdue = organisations.reduce((n, o) => n + o.overdue, 0);
    answer = `There ${overdue === 1 ? 'is' : 'are'} ${overdue} overdue active care-plan review${overdue === 1 ? '' : 's'} across the platform. ${overdue ? organisations.filter(o => o.overdue).map(o => `${o.name}: ${o.overdue}`).join('; ') : 'No immediate care-plan review action is required.'}`;
  } else {
    answer = `Executive briefing:\n• ${organisations.length} organisations, of which ${billable.length} are active and billable.\n• MRR ${money(mrr)}; ARR ${money(mrr * 12)}.\n• ${atRisk.length} organisations need attention.\n• ${renewals.length} renewals are due within 90 days.\n• ${Number(users?.active30 || 0)} of ${Number(users?.total || 0)} users were active in the last 30 days.\n• ${Number(clients?.total || 0)} active clients are recorded.\n• ${Number(errors?.total || 0)} API errors were recorded in the last 24 hours.`;
  }

  await db.batch([
    db.prepare("INSERT INTO ai_messages(id,conversation_id,role,content) VALUES(?,?,?,?)").bind(crypto.randomUUID(), conversationId, 'user', question),
    db.prepare("INSERT INTO ai_messages(id,conversation_id,role,content) VALUES(?,?,?,?)").bind(crypto.randomUUID(), conversationId, 'assistant', answer),
    db.prepare("UPDATE ai_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(conversationId),
    auditStatement(db, session.organisation_id, session.user_id, 'platform.ai_question', 'ai_conversation', conversationId, { question: question.slice(0, 120) })
  ]);
  return json({ conversationId, answer, generatedAt: new Date().toISOString() });
}


async function listNotifications(db,session,url){
  if(!requirePlatform(session))return forbidden();
  const category=clean(url.searchParams.get('category')),status=clean(url.searchParams.get('status')),search=clean(url.searchParams.get('search'));
  const clauses=[],args=[];
  if(category&&category!=='all'){clauses.push('n.category=?');args.push(category)}
  if(status==='unread')clauses.push('n.read_at IS NULL AND n.archived_at IS NULL');
  if(status==='read')clauses.push('n.read_at IS NOT NULL AND n.archived_at IS NULL');
  if(status==='acknowledged')clauses.push('n.acknowledged_at IS NOT NULL');
  if(status==='archived')clauses.push('n.archived_at IS NOT NULL');
  if(search){clauses.push('(LOWER(n.title) LIKE ? OR LOWER(n.message) LIKE ?)');args.push(`%${search.toLowerCase()}%`,`%${search.toLowerCase()}%`)}
  const where=clauses.length?`WHERE ${clauses.join(' AND ')}`:'';
  const q=`SELECT n.*,o.name AS organisation_name FROM notifications n LEFT JOIN organisations o ON o.id=n.organisation_id ${where} ORDER BY CASE n.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,n.created_at DESC LIMIT 200`;
  const rows=await db.prepare(q).bind(...args).all();
  const stats=await db.prepare(`SELECT SUM(CASE WHEN read_at IS NULL AND archived_at IS NULL THEN 1 ELSE 0 END) unread,SUM(CASE WHEN priority='critical' AND archived_at IS NULL THEN 1 ELSE 0 END) critical,SUM(CASE WHEN date(created_at)=date('now') THEN 1 ELSE 0 END) today,SUM(CASE WHEN acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) acknowledged FROM notifications`).first();
  return json({notifications:rows.results||[],stats:stats||{}});
}
async function updateNotificationState(db,session,id,action){
  if(!requirePlatform(session))return forbidden();const row=await db.prepare('SELECT id,title FROM notifications WHERE id=?').bind(id).first();if(!row)return notFound('Notification');
  const column=action==='read'?'read_at':action==='acknowledge'?'acknowledged_at':'archived_at';
  await db.batch([db.prepare(`UPDATE notifications SET ${column}=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id),auditStatement(db,session.organisation_id,session.user_id,`platform.notification_${action}`,'notification',id,{title:row.title})]);
  return json({ok:true});
}
async function markAllNotificationsRead(db,session){if(!requirePlatform(session))return forbidden();await db.batch([db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE archived_at IS NULL'),auditStatement(db,session.organisation_id,session.user_id,'platform.notifications_mark_all_read','notification','all',{})]);return json({ok:true});}


const MODULE_PERMISSION_MAP = {
  dashboard:'dashboard.view', operations:'operations.view', clients:'clients.view', staff:'staff.view',
  family:'family_portal.manage', care:'care_plans.view', medication:'medication.view', visits:'visits.view',
  rota:'rota.view', tasks:'tasks.view', incidents:'incidents.view', finance:'finance.view', reports:'reports.view',
  settings:'organisation.settings.view'
};
async function buildAccessProfile(db,session){
  const catalog=await db.prepare('SELECT permission_key FROM permission_catalog ORDER BY permission_key').all();
  const permissions=[];
  for(const row of catalog.results||[]) if(await userHasPermission(db,session,row.permission_key)) permissions.push(row.permission_key);
  const moduleRows=await db.prepare('SELECT module_key,enabled FROM organisation_modules WHERE organisation_id=?').bind(session.organisation_id).all();
  const configured=Object.fromEntries((moduleRows.results||[]).map(x=>[x.module_key,Boolean(x.enabled)]));
  const modules={};
  for(const [module,key] of Object.entries(MODULE_PERMISSION_MAP)) modules[module]=(configured[module]!==false)&&permissions.includes(key);
  if(session.is_platform_user) for(const module of Object.keys(MODULE_PERMISSION_MAP)) modules[module]=configured[module]!==false;
  return {permissions,modules};
}
async function listOrganisationModules(db,session){
  if(!canManageSecurity(session)&&!await userHasPermission(db,session,'organisation.settings.view'))return forbidden();
  const rows=await db.prepare('SELECT module_key,enabled,updated_at FROM organisation_modules WHERE organisation_id=? ORDER BY module_key').bind(session.organisation_id).all();
  return json({modules:rows.results||[]});
}
async function updateOrganisationModules(request,db,session){
  if(!canManageSecurity(session)&&!await userHasPermission(db,session,'organisation.settings.manage'))return forbidden();
  const input=await readJson(request), modules=input.modules&&typeof input.modules==='object'?input.modules:{};
  const allowed=Object.keys(MODULE_PERMISSION_MAP), statements=[];
  for(const key of allowed){if(!(key in modules))continue;statements.push(db.prepare(`INSERT INTO organisation_modules(organisation_id,module_key,enabled,updated_by,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(organisation_id,module_key) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(session.organisation_id,key,modules[key]?1:0,session.user_id));}
  statements.push(auditStatement(db,session.organisation_id,session.user_id,'security.modules_updated','organisation',session.organisation_id,{modules}));
  await db.batch(statements);return json({ok:true});
}
async function getUserPermissionOverrides(db,session,userId){
  if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.users.manage'))return forbidden();
  const user=await db.prepare('SELECT id,display_name,email,access_level FROM users WHERE id=? AND organisation_id=?').bind(userId,session.organisation_id).first();
  if(!user)return notFound('User');
  const rows=await db.prepare('SELECT permission_key,effect FROM user_permission_overrides WHERE organisation_id=? AND user_id=? ORDER BY permission_key').bind(session.organisation_id,userId).all();
  return json({user,overrides:rows.results||[]});
}
async function updateUserPermissionOverrides(request,db,session,userId){
  if(!canManageSecurity(session)&&!await userHasPermission(db,session,'security.users.manage'))return forbidden();
  const user=await db.prepare('SELECT id FROM users WHERE id=? AND organisation_id=?').bind(userId,session.organisation_id).first();if(!user)return notFound('User');
  const input=await readJson(request),allow=Array.isArray(input.allow)?[...new Set(input.allow.map(clean).filter(Boolean))]:[],deny=Array.isArray(input.deny)?[...new Set(input.deny.map(clean).filter(Boolean))]:[];
  const statements=[db.prepare('DELETE FROM user_permission_overrides WHERE organisation_id=? AND user_id=?').bind(session.organisation_id,userId)];
  for(const key of allow.filter(x=>!deny.includes(x)))statements.push(db.prepare(`INSERT INTO user_permission_overrides(organisation_id,user_id,permission_key,effect,assigned_by) SELECT ?,?,permission_key,'allow',? FROM permission_catalog WHERE permission_key=?`).bind(session.organisation_id,userId,session.user_id,key));
  for(const key of deny)statements.push(db.prepare(`INSERT INTO user_permission_overrides(organisation_id,user_id,permission_key,effect,assigned_by) SELECT ?,?,permission_key,'deny',? FROM permission_catalog WHERE permission_key=?`).bind(session.organisation_id,userId,session.user_id,key));
  statements.push(auditStatement(db,session.organisation_id,session.user_id,'security.user_permissions_updated','user',userId,{allow,deny}));await db.batch(statements);return json({ok:true});
}


async function platformControlCentre(db, session) {
  if(!requirePlatform(session)) return forbidden();
  const [products,tickets,supportSessions,incidents,releases,staff,productOrganisations] = await Promise.all([
    db.prepare(`SELECT p.*,h.status AS health_status,h.response_ms,h.error_count_24h,h.last_check_at,h.database_status,h.auth_status,h.integration_status
      FROM platform_products p LEFT JOIN platform_product_health h ON h.id=(SELECT h2.id FROM platform_product_health h2 WHERE h2.product_id=p.id ORDER BY h2.last_check_at DESC LIMIT 1)
      ORDER BY p.sort_order,p.name`).all(),
    db.prepare(`SELECT t.*,p.name AS product_name,o.name AS organisation_name,u.display_name AS assigned_name
      FROM platform_support_tickets t LEFT JOIN platform_products p ON p.id=t.product_id LEFT JOIN organisations o ON o.id=t.organisation_id LEFT JOIN users u ON u.id=t.assigned_to
      ORDER BY CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,t.created_at DESC LIMIT 100`).all(),
    db.prepare(`SELECT s.*,p.name AS product_name,o.name AS organisation_name,u.display_name AS staff_name
      FROM platform_support_sessions s LEFT JOIN platform_products p ON p.id=s.product_id LEFT JOIN organisations o ON o.id=s.organisation_id LEFT JOIN users u ON u.id=s.staff_user_id
      ORDER BY s.started_at DESC LIMIT 50`).all(),
    db.prepare(`SELECT i.*,p.name AS product_name FROM platform_incidents i LEFT JOIN platform_products p ON p.id=i.product_id ORDER BY i.created_at DESC LIMIT 30`).all(),
    db.prepare(`SELECT r.*,p.name AS product_name FROM platform_releases r LEFT JOIN platform_products p ON p.id=r.product_id ORDER BY r.deployed_at DESC LIMIT 30`).all(),
    db.prepare(`SELECT id,display_name,email,access_level,status,last_login_at FROM users WHERE is_platform_user=1 OR access_level IN ('platform_owner','platform_admin') ORDER BY display_name`).all(),
    db.prepare(`SELECT po.*,p.code AS product_code,p.name AS product_name,o.name AS organisation_name,o.status AS organisation_status,o.subscription_plan,
      es.status AS entitlement_sync_status,es.contract_version AS entitlement_contract_version,es.requested_at AS entitlement_requested_at,
      es.acknowledged_at AS entitlement_acknowledged_at,es.applied_at AS entitlement_applied_at,es.product_version AS entitlement_product_version,es.error_message AS entitlement_sync_error,
      (SELECT COUNT(*) FROM users u WHERE u.organisation_id=o.id) AS user_count,
      (SELECT MAX(a.created_at) FROM audit_log a WHERE a.organisation_id=o.id) AS last_activity_at,
      (SELECT COUNT(*) FROM platform_support_tickets t WHERE t.product_id=po.product_id AND t.organisation_id=po.organisation_id AND t.status NOT IN ('resolved','closed')) AS open_ticket_count
      FROM platform_product_organisations po JOIN platform_products p ON p.id=po.product_id JOIN organisations o ON o.id=po.organisation_id
      LEFT JOIN platform_entitlement_sync es ON es.product_id=po.product_id AND es.organisation_id=po.organisation_id
      WHERE o.status<>'archived'
      ORDER BY p.sort_order,o.name COLLATE NOCASE`).all().catch(()=>({results:[]}))
  ]);
  const productRows=products.results||[], ticketRows=tickets.results||[], sessionRows=supportSessions.results||[];
  const currentProducts=productRows.filter(product=>product.status!=='retired'),archivedProducts=productRows.filter(product=>product.status==='retired');
  const open=ticketRows.filter(t=>!['resolved','closed'].includes(t.status));
  return json({
    summary:{products:currentProducts.length,archivedProducts:archivedProducts.length,healthy:currentProducts.filter(p=>p.health_status==='healthy').length,degraded:currentProducts.filter(p=>p.health_status==='degraded').length,offline:currentProducts.filter(p=>p.health_status==='offline').length,openTickets:open.length,criticalTickets:open.filter(t=>t.priority==='critical').length,activeSupportSessions:sessionRows.filter(s=>s.status==='active'&&databaseTimestamp(s.expires_at)>new Date()).length,openIncidents:(incidents.results||[]).filter(i=>i.status!=='resolved').length},
    products:productRows,archivedProducts,tickets:ticketRows,supportSessions:sessionRows,incidents:incidents.results||[],releases:releases.results||[],staff:staff.results||[],productOrganisations:productOrganisations.results||[]
  });
}

async function platformCustomerSuccessNeutral(db,session){
  if(!requirePlatform(session))return forbidden();
  const dashboardResponse=await platformDashboard(db,session),dashboard=await dashboardResponse.json(),organisations=(dashboard.organisations||[]).map(org=>{
    const reasons=[];
    if(org.status!=='active')reasons.push('Account is not active');
    if(!Number(org.product_count||0))reasons.push('No CoreCare products are connected');
    if(Number(org.unhealthy_products||0))reasons.push(`${Number(org.unhealthy_products)} product connection${Number(org.unhealthy_products)===1?' needs':'s need'} attention`);
    if(Number(org.open_ticket_count||0))reasons.push(`${Number(org.open_ticket_count)} open support ticket${Number(org.open_ticket_count)===1?'':'s'}`);
    if(Number(org.days_inactive||0)>30)reasons.push(`No Platform activity for ${Number(org.days_inactive)} days`);
    const recommendations=[];
    if(!Number(org.product_count||0))recommendations.push('Connect and provision the organisation in its first CoreCare product.');
    if(Number(org.unhealthy_products||0))recommendations.push('Review product health, authentication and integration status.');
    if(Number(org.open_ticket_count||0))recommendations.push('Review open support tickets and assign an owner.');
    if(Number(org.adoption_score||0)<50&&Number(org.user_count||0))recommendations.push('Review user adoption with the organisation owner.');
    if(!recommendations.length)recommendations.push('Maintain regular success contact and review expansion opportunities.');
    return {...org,health_band:org.health_score>=80?'healthy':org.health_score>=60?'attention':'risk',trend:Number(org.days_inactive||0)<=7?'up':Number(org.days_inactive||0)<=21?'steady':'down',reasons,recommendations,module_usage:[]};
  }).sort((a,b)=>a.health_score-b.health_score),healthy=organisations.filter(org=>org.health_band==='healthy').length,attention=organisations.filter(org=>org.health_band==='attention').length,risk=organisations.filter(org=>org.health_band==='risk').length;
  return json({generatedAt:new Date().toISOString(),summary:{averageHealth:Math.round(Number(dashboard.customerSuccess?.averageHealth||100)),healthy,attention,risk,averageAdoption:organisations.length?Math.round(organisations.reduce((total,org)=>total+Number(org.adoption_score||0),0)/organisations.length):0,openRecommendations:organisations.reduce((total,org)=>total+org.recommendations.length,0)},organisations});
}

async function createPlatformProduct(request,db,session){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const input=await readJson(request),name=clean(input.name),code=clean(input.code).toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,30),productionUrl=normaliseProductUrl(input.production_url||input.productionUrl),healthUrl=normaliseProductUrl(input.health_url||input.healthUrl);
  if(!name||!code)return badRequest('Enter a product name and code.');
  if((input.production_url||input.productionUrl)&&!productionUrl)return badRequest('Enter a valid HTTPS production URL.');
  if((input.health_url||input.healthUrl)&&!healthUrl)return badRequest('Enter a valid HTTPS health URL.');
  const id=crypto.randomUUID();
  try{
    await db.batch([db.prepare(`INSERT INTO platform_products(id,code,name,description,status,current_version,environment,repository_url,cloudflare_project,production_url,health_url,support_email,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,code,name,clean(input.description).slice(0,1000),clean(input.status)||'development',clean(input.current_version||input.currentVersion),clean(input.environment)||'production',clean(input.repository_url||input.repositoryUrl)||null,clean(input.cloudflare_project||input.cloudflareProject)||null,productionUrl||null,healthUrl||null,clean(input.support_email||input.supportEmail)||null,Number(input.sort_order||input.sortOrder)||100),auditStatement(db,session.organisation_id,session.user_id,'platform.product_created','platform_product',id,{code,name})]);
  }catch(error){if(String(error.message||error).toLowerCase().includes('unique'))return json({error:{code:'PRODUCT_CODE_EXISTS',message:'A product with this code already exists.'}},409);throw error}
  return json({product:{id,code,name,production_url:productionUrl||null}},201);
}
async function updatePlatformProduct(request,db,session,id){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const existing=await db.prepare('SELECT * FROM platform_products WHERE id=?').bind(id).first();if(!existing)return notFound('Product');
  const input=await readJson(request),productionUrl=normaliseProductUrl(input.production_url??input.productionUrl??existing.production_url),healthUrl=normaliseProductUrl(input.health_url??input.healthUrl??existing.health_url);
  if((input.production_url??input.productionUrl)&&!productionUrl)return badRequest('Enter a valid HTTPS production URL.');
  if((input.health_url??input.healthUrl)&&!healthUrl)return badRequest('Enter a valid HTTPS health URL.');
  const name=clean(input.name)||existing.name,status=clean(input.status)||existing.status,allowedStatuses=new Set(['planning','development','live','maintenance','retired']);
  if(!allowedStatuses.has(status))return badRequest('Choose a valid product status.');
  await db.batch([db.prepare(`UPDATE platform_products SET name=?,description=?,status=?,current_version=?,environment=?,repository_url=?,cloudflare_project=?,production_url=?,health_url=?,support_email=?,maintenance_mode=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(name,clean(input.description??existing.description),status,clean(input.current_version??input.currentVersion??existing.current_version),clean(input.environment??existing.environment)||'production',clean(input.repository_url??input.repositoryUrl??existing.repository_url)||null,clean(input.cloudflare_project??input.cloudflareProject??existing.cloudflare_project)||null,productionUrl||null,healthUrl||null,clean(input.support_email??input.supportEmail??existing.support_email)||null,input.maintenance_mode||input.maintenanceMode?1:0,id),auditStatement(db,session.organisation_id,session.user_id,'platform.product_updated','platform_product',id,{name,status,productionUrl,healthUrl})]);
  return json({ok:true,product:{id,name,status,production_url:productionUrl||null}});
}
const PRODUCT_SERVICE_BINDINGS={CARE:'CORECARE_CARE',POS:'CORECARE_POS',GARAGE:'CORECARE_GARAGE',CAMPSITE:'CORECARE_CAMPSITE',FINANCE:'CORECARE_FINANCE'};

function productService(env,code){
  const binding=PRODUCT_SERVICE_BINDINGS[clean(code).toUpperCase()];
  return binding?env?.[binding]:null;
}

async function productControlRequest(env,product,path,init={}){
  const code=clean(product.code).toUpperCase(),key=productAccessKey(env,code),service=productService(env,code);
  if(!key)throw new Error(`Product key is not configured for ${code}.`);
  const origin=normaliseProductUrl(product.production_url)||`https://${code.toLowerCase()}.corecare.internal`;
  const headers=new Headers(init.headers||{});
  headers.set('accept','application/json');
  headers.set('x-corecare-product-key',key);
  if(init.body)headers.set('content-type','application/json');
  const target=new URL(path,`${origin}/`).toString();
  const productRequest=new Request(target,{...init,headers,signal:AbortSignal.timeout(15000)});
  const response=service?.fetch?await service.fetch(productRequest):await fetch(productRequest);
  const payload=await readResponseJson(response,512*1024).catch(()=>({}));
  if(!response.ok){
    const message=clean(payload.error?.message||payload.error||payload.message)||`${product.name||code} returned HTTP ${response.status}.`;
    const error=new Error(message);error.status=response.status;throw error;
  }
  return payload;
}

async function provisionProductOrganisation(env,product,organisation,requestedExternalId=''){
  const externalId=clean(requestedExternalId)||organisation.id;
  const canAutomate=Boolean(productService(env,product.code)?.fetch||(normaliseProductUrl(product.production_url)&&productAccessKey(env,product.code)));
  if(!canAutomate)return {ok:true,provisioned:false,externalId,summary:null};
  const result=await productControlRequest(env,product,'/api/platform/organisations',{
    method:'POST',
    body:JSON.stringify({
      protocol:'corecare-platform-organisation/1',
      organisation:{id:organisation.id,external_id:externalId,name:organisation.name,status:organisation.status||'active',subscription_plan:organisation.subscription_plan||'limited'},
    }),
  });
  return {ok:true,provisioned:true,externalId:clean(result.organisation?.external_id)||externalId,summary:result.summary||null,result};
}

async function linkProductOrganisation(request,env,session,productId){
  if(!canManagePlatform(session))return forbidden();
  const db=env.DB,product=await db.prepare('SELECT id,code,name,production_url FROM platform_products WHERE id=?').bind(productId).first();
  if(!product)return notFound('Product');
  const input=await readJson(request);let organisationId=clean(input.organisation_id||input.organisationId),organisation,created=false;
  if(organisationId){
    organisation=await db.prepare('SELECT id,name,status,subscription_plan FROM organisations WHERE id=?').bind(organisationId).first();
    if(!organisation)return notFound('Organisation');
    if(organisation.status==='archived')return json({error:{code:'ORGANISATION_ARCHIVED',message:'Restore this organisation before connecting it to a product.'}},409);
  }else{
    const name=clean(input.name);if(!name)return badRequest('Choose an existing organisation or enter a new organisation name.');
    organisationId=crypto.randomUUID();created=true;
    const branchId=crypto.randomUUID(),slug=(clean(input.slug)||name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+organisationId.slice(0,6),plan=clean(input.subscription_plan||input.subscriptionPlan)||'limited';
    const planRow=await db.prepare("SELECT id FROM subscription_plans WHERE id=? AND status='active'").bind(plan).first();
    if(!planRow)return json({error:{code:'INVALID_SUBSCRIPTION_PLAN',message:'Choose an active subscription plan.'}},400);
    await db.batch([
      db.prepare('INSERT INTO organisations(id,name,slug,status,subscription_plan) VALUES(?,?,?,?,?)').bind(organisationId,name,slug,'active',plan),
      db.prepare('INSERT INTO branches(id,organisation_id,name,code,status) VALUES(?,?,?,?,?)').bind(branchId,organisationId,'Main Branch','MAIN','active'),
      auditStatement(db,session.organisation_id,session.user_id,'platform.organisation_created','organisation',organisationId,{name,source:'product_onboarding',productId}),
    ]);
    organisation={id:organisationId,name,status:'active',subscription_plan:plan};
  }
  let provision;
  try{
    provision=await provisionProductOrganisation(env,product,organisation,clean(input.external_organisation_id||input.externalOrganisationId));
  }catch(error){
    await db.prepare(`INSERT INTO platform_onboarding_events(id,product_id,organisation_id,external_organisation_id,status,detail_json,created_by) VALUES(?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),productId,organisationId,clean(input.external_organisation_id||input.externalOrganisationId)||null,'failed',JSON.stringify({error:clean(error?.message)}),session.user_id).run();
    return json({error:{code:'PRODUCT_PROVISIONING_FAILED',message:`The central organisation was saved, but ${product.name} could not be provisioned: ${clean(error?.message)}`},organisation:{id:organisationId,name:organisation.name,created}},502);
  }
  const externalId=provision.externalId||organisationId,summaryJson=provision.summary?JSON.stringify(provision.summary).slice(0,20000):null,provisioningStatus=provision.provisioned?'ready':'manual';
  await db.batch([
    db.prepare(`INSERT INTO platform_product_organisations
      (id,product_id,organisation_id,external_organisation_id,access_status,provisioning_status,health_status,database_status,auth_status,integration_status,provisioned_at,last_sync_at,product_summary_json)
      VALUES(?,?,?,?,?,?,'unknown','monitoring','monitoring',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?)
      ON CONFLICT(product_id,organisation_id) DO UPDATE SET external_organisation_id=excluded.external_organisation_id,access_status=excluded.access_status,
        provisioning_status=excluded.provisioning_status,provisioned_at=CURRENT_TIMESTAMP,last_sync_at=CURRENT_TIMESTAMP,last_sync_error=NULL,
        integration_status=excluded.integration_status,product_summary_json=COALESCE(excluded.product_summary_json,platform_product_organisations.product_summary_json),updated_at=CURRENT_TIMESTAMP`)
      .bind(crypto.randomUUID(),productId,organisationId,externalId,'ready',provisioningStatus,provision.provisioned?'connected':'manual',summaryJson),
    db.prepare(`INSERT INTO platform_onboarding_events(id,product_id,organisation_id,external_organisation_id,status,detail_json,created_by) VALUES(?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(),productId,organisationId,externalId,provisioningStatus,JSON.stringify({created,provisioned:provision.provisioned}),session.user_id),
    auditStatement(db,session.organisation_id,session.user_id,'platform.product_organisation_linked','organisation',organisationId,{productId,productCode:product.code,externalOrganisationId:externalId,created,provisioned:provision.provisioned}),
  ]);
  return json({ok:true,product,organisation:{...organisation,external_organisation_id:externalId,access_status:'ready',provisioning_status:provisioningStatus},productSummary:provision.summary||null},201);
}

async function createPlatformTicket(request,db,session){
  if(!requirePlatform(session)) return forbidden();
  const b=await readJson(request,256*1024),subject=clean(b.subject).slice(0,180),description=clean(b.description).slice(0,10000);
  if(!subject) return badRequest('Subject is required.');
  const allowedPriorities=new Set(['low','normal','high','critical']),priority=allowedPriorities.has(clean(b.priority))?clean(b.priority):'normal';
  const id=crypto.randomUUID(); const number=platformTicketNumber();
  await db.prepare(`INSERT INTO platform_support_tickets(id,ticket_number,product_id,organisation_id,subject,description,priority,category,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    .bind(id,number,clean(b.product_id)||null,clean(b.organisation_id)||null,subject,description,priority,clean(b.category).slice(0,80)||'general','new',session.user_id).run();
  await writeAudit(db,session,'platform.ticket.created','support_ticket',id,{ticket_number:number,subject});
  return json({ok:true,id,ticket_number:number},201);
}

function platformTicketNumber(){return `CC-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;}

function normaliseProductUrl(value){
  const raw=clean(value);if(!raw)return '';
  try{const url=new URL(raw);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return '';return url.origin+url.pathname.replace(/\/$/,'')}catch{return ''}
}

async function ingestProductTicket(request,env){
  if(!env.DB)return databaseRequired();
  const input=await readJson(request,256*1024),productCode=clean(input.product_code).toUpperCase(),suppliedKey=clean(request.headers.get('x-corecare-product-key')),configuredKey=productAccessKey(env,productCode);
  if(!productCode||!clean(input.organisation_id)||!clean(input.subject))return badRequest('product_code, organisation_id and subject are required.');
  if(!configuredKey)return json({error:{code:'PRODUCT_KEY_NOT_CONFIGURED',message:'Product ticket ingestion is not configured.'}},503);
  if(!suppliedKey||!await secureEqualText(suppliedKey,configuredKey))return json({error:{code:'INVALID_PRODUCT_CREDENTIALS',message:'Product credentials are invalid.'}},401);
  const product=await env.DB.prepare('SELECT id FROM platform_products WHERE code=?').bind(productCode).first();
  if(!product)return json({error:{code:'UNKNOWN_PRODUCT',message:'The CoreCare product is not registered.'}},404);
  const suppliedOrganisationId=clean(input.organisation_id),link=await env.DB.prepare(`SELECT organisation_id,external_organisation_id FROM platform_product_organisations
    WHERE product_id=? AND access_status='ready' AND (organisation_id=? OR external_organisation_id=?) LIMIT 1`).bind(product.id,suppliedOrganisationId,suppliedOrganisationId).first();
  if(!link)return json({error:{code:'PRODUCT_ORGANISATION_NOT_LINKED',message:'This organisation is not linked to the product.'}},409);
  const organisationId=link.organisation_id;
  const priorityMap={urgent:'critical',critical:'critical',high:'high',normal:'normal',low:'low'},priority=priorityMap[clean(input.priority).toLowerCase()]||'normal';
  const id=crypto.randomUUID(),number=platformTicketNumber(),subject=clean(input.subject).slice(0,160),requesterName=clean(input.contact?.name||input.contact_name).slice(0,160),requesterEmail=clean(input.contact?.email||input.contact_email).slice(0,320),externalReference=clean(input.id).slice(0,100);
  const description=clean(input.description).slice(0,10000),metadata={...(input.metadata&&typeof input.metadata==='object'&&!Array.isArray(input.metadata)?input.metadata:{}),product_organisation_id:link.external_organisation_id||suppliedOrganisationId};
  const accessRequested=input.access_request?.requested===true,accessRequestMode=accessRequested?clean(input.access_request?.mode||'request-only').slice(0,40):null,submittedAt=clean(input.submitted_at||input.created_at).slice(0,80)||null;
  if(externalReference){
    const existing=await env.DB.prepare('SELECT id,ticket_number FROM platform_support_tickets WHERE source_product=? AND external_reference=?').bind(productCode,externalReference).first();
    if(existing)return json({ok:true,id:existing.id,ticketId:existing.id,ticketNumber:existing.ticket_number,ticket_number:existing.ticket_number,deduplicated:true},200);
  }
  await env.DB.prepare(`INSERT INTO platform_support_tickets
    (id,ticket_number,product_id,organisation_id,subject,description,priority,category,status,
      requester_name,requester_email,external_reference,source_product,app_version,module,page_url,
      metadata_json,access_requested,access_request_mode,submitted_at,created_at,updated_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,'new',?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    .bind(id,number,product.id,organisationId,subject,description,priority,clean(input.category)||'general',requesterName||null,requesterEmail||null,externalReference||null,productCode,clean(input.version)||null,clean(input.module||metadata.module)||null,clean(input.page_url||metadata.page_url||metadata.origin)||null,JSON.stringify(metadata).slice(0,20000),accessRequested?1:0,accessRequestMode,submittedAt).run();
  try{const receiptAudit=auditStatement(env.DB,organisationId,null,'platform.product_ticket_received','support_ticket',id,{productCode,externalReference,productOrganisationId:link.external_organisation_id||suppliedOrganisationId});if(typeof receiptAudit.run==='function')await receiptAudit.run()}catch(error){console.warn(JSON.stringify({message:'Product ticket receipt audit unavailable',ticketId:id,error:clean(error?.message)}))}
  return json({ok:true,id,ticketId:id,ticketNumber:number,ticket_number:number},201);
}
function buildProductLaunchUrl(productionUrl,code,platformOrigin){
  const url=new URL('/platform-access',normaliseProductUrl(productionUrl));
  url.searchParams.set('code',code);url.searchParams.set('platform_origin',platformOrigin);
  return url.toString();
}
function productAccessKey(env,code){
  const direct=clean(env?.[`CORECARE_${clean(code).toUpperCase()}_PRODUCT_KEY`]);if(direct)return direct;
  try{const keys=JSON.parse(env?.CORECARE_PRODUCT_KEYS||'{}');return clean(keys?.[clean(code).toUpperCase()]||keys?.[clean(code).toLowerCase()])}catch{return ''}
}

function normaliseFeatureKey(value){
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80);
}

function parseFeatureDependencies(value){
  let source=value;
  if(typeof source==='string'){
    const trimmed=source.trim();
    if(!trimmed)return [];
    try{source=JSON.parse(trimmed)}catch{source=trimmed.split(',')}
  }
  if(!Array.isArray(source))return [];
  return [...new Set(source.map(normaliseFeatureKey).filter(Boolean))].slice(0,40);
}

function resolveFeatureEntitlements(features=[],overrides=[],context={}){
  const overrideByKey=new Map((overrides||[]).map(item=>[normaliseFeatureKey(item.feature_key),item]));
  const productAvailable=context.productStatus!=='retired'&&!Boolean(Number(context.maintenanceMode||0));
  const organisationAvailable=!context.organisationStatus||context.organisationStatus==='active';
  const linkAvailable=context.linkReady!==false;
  const globallyAvailable=productAvailable&&organisationAvailable&&linkAvailable;
  const unavailableReason=!productAvailable?'product_unavailable':!organisationAvailable?'organisation_inactive':!linkAvailable?'connection_not_ready':'';
  const resolved=(features||[]).filter(feature=>clean(feature.status||'active')==='active').map(feature=>{
    const key=normaliseFeatureKey(feature.feature_key),override=overrideByKey.get(key)||{},mandatory=Boolean(Number(feature.mandatory||0));
    const configuredState=['inherit','enabled','disabled'].includes(clean(override.state))?clean(override.state):'inherit';
    const organisationControl=clean(override.organisation_control)==='disable_only'&&Boolean(Number(feature.organisation_can_disable||0))?'disable_only':'owner';
    let enabled=false,source='default';
    if(!globallyAvailable){source=unavailableReason}
    else if(mandatory){enabled=true;source='mandatory'}
    else if(configuredState==='enabled'){enabled=true;source='owner_enabled'}
    else if(configuredState==='disabled'){enabled=false;source='owner_disabled'}
    else{enabled=Boolean(Number(feature.default_enabled??1));source='default'}
    return {
      key,name:clean(feature.name)||key,description:clean(feature.description),category:clean(feature.category)||'General',
      enabled,configuredState,source,mandatory,organisationControl,
      organisationCanDisable:Boolean(Number(feature.organisation_can_disable||0)),
      dependencies:parseFeatureDependencies(feature.dependencies_json),blockedBy:[],sortOrder:Number(feature.sort_order||0),
      updatedAt:clean(override.updated_at||feature.updated_at),reason:clean(override.reason),
    };
  });
  const byKey=new Map(resolved.map(item=>[item.key,item]));
  let changed=true,passes=0;
  while(changed&&passes<resolved.length){
    changed=false;passes+=1;
    for(const feature of resolved){
      if(!feature.enabled||feature.mandatory)continue;
      const blocked=feature.dependencies.filter(key=>!byKey.get(key)?.enabled);
      if(blocked.length){feature.enabled=false;feature.source='dependency';feature.blockedBy=blocked;changed=true}
    }
  }
  return resolved;
}

async function productFeatureContext(db,productId,organisationId){
  return db.prepare(`SELECT p.id product_id,p.code product_code,p.name product_name,p.status product_status,p.maintenance_mode,
    o.id organisation_id,o.name organisation_name,o.status organisation_status,
    po.external_organisation_id,po.access_status,po.provisioning_status
    FROM platform_products p
    JOIN platform_product_organisations po ON po.product_id=p.id
    JOIN organisations o ON o.id=po.organisation_id
    WHERE p.id=? AND o.id=?`).bind(productId,organisationId).first();
}

async function readProductFeatureRows(db,productId,organisationId='',includeRetired=false){
  const features=await db.prepare(`SELECT * FROM platform_product_features WHERE product_id=? ${includeRetired?'':"AND status='active'"} ORDER BY category,sort_order,name`).bind(productId).all();
  let overrides={results:[]};
  if(organisationId)overrides=await db.prepare(`SELECT * FROM platform_organisation_features WHERE product_id=? AND organisation_id=?`).bind(productId,organisationId).all();
  return {features:features.results||[],overrides:overrides.results||[]};
}

async function listPlatformProductFeatures(db,session,productId){
  if(!requirePlatform(session))return forbidden();
  const product=await db.prepare('SELECT id,code,name,status,maintenance_mode FROM platform_products WHERE id=?').bind(productId).first();
  if(!product)return notFound('Product');
  const {features}=await readProductFeatureRows(db,productId,'',true);
  const counts=await db.prepare(`SELECT feature_key,
    SUM(CASE WHEN state='enabled' THEN 1 ELSE 0 END) enabled_overrides,
    SUM(CASE WHEN state='disabled' THEN 1 ELSE 0 END) disabled_overrides,
    SUM(CASE WHEN organisation_control='disable_only' THEN 1 ELSE 0 END) delegated_organisations
    FROM platform_organisation_features WHERE product_id=? GROUP BY feature_key`).bind(productId).all();
  const countByKey=new Map((counts.results||[]).map(item=>[item.feature_key,item]));
  return json({product,ownerCanEdit:session.access_level==='platform_owner',features:features.map(feature=>({...feature,dependencies:parseFeatureDependencies(feature.dependencies_json),usage:countByKey.get(feature.feature_key)||{enabled_overrides:0,disabled_overrides:0,delegated_organisations:0}}))});
}

async function savePlatformProductFeature(request,db,session,productId){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const product=await db.prepare('SELECT id,code,name FROM platform_products WHERE id=?').bind(productId).first();
  if(!product)return notFound('Product');
  const input=await readJson(request,64*1024),featureKey=normaliseFeatureKey(input.feature_key||input.featureKey),name=clean(input.name).slice(0,120);
  if(!featureKey||!name)return badRequest('Enter a feature key and name.');
  if(!/^[a-z][a-z0-9_]{0,79}$/.test(featureKey))return badRequest('Feature keys must start with a letter and contain only letters, numbers and underscores.');
  const dependencies=parseFeatureDependencies(input.dependencies??input.dependencies_json);
  if(dependencies.includes(featureKey))return badRequest('A feature cannot depend on itself.');
  if(dependencies.length){
    const existing=await db.prepare(`SELECT feature_key FROM platform_product_features WHERE product_id=? AND status='active'`).bind(productId).all(),known=new Set((existing.results||[]).map(item=>item.feature_key)),missing=dependencies.filter(key=>!known.has(key));
    if(missing.length)return badRequest(`Unknown feature dependencies: ${missing.join(', ')}.`);
  }
  const inputFlag=value=>value===true||value===1||value==='1'||clean(value).toLowerCase()==='true';
  const status=clean(input.status)==='retired'?'retired':'active',mandatory=inputFlag(input.mandatory),defaultEnabled=mandatory||input.default_enabled===undefined||inputFlag(input.default_enabled),organisationCanDisable=!mandatory&&inputFlag(input.organisation_can_disable);
  const current=await db.prepare('SELECT id FROM platform_product_features WHERE product_id=? AND feature_key=?').bind(productId,featureKey).first(),id=current?.id||crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO platform_product_features(id,product_id,feature_key,name,description,category,default_enabled,mandatory,organisation_can_disable,dependencies_json,status,sort_order,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(product_id,feature_key) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,
      default_enabled=excluded.default_enabled,mandatory=excluded.mandatory,organisation_can_disable=excluded.organisation_can_disable,
      dependencies_json=excluded.dependencies_json,status=excluded.status,sort_order=excluded.sort_order,updated_at=CURRENT_TIMESTAMP`)
      .bind(id,productId,featureKey,name,clean(input.description).slice(0,1000),clean(input.category).slice(0,80)||'General',defaultEnabled?1:0,mandatory?1:0,organisationCanDisable?1:0,JSON.stringify(dependencies),status,Number(input.sort_order||0)),
    auditStatement(db,session.organisation_id,session.user_id,'platform.product_feature_saved','platform_product_feature',id,{productId,productCode:product.code,featureKey,name,status,mandatory,defaultEnabled,organisationCanDisable,dependencies}),
  ]);
  return json({ok:true,id,featureKey});
}

async function getOrganisationFeatureEntitlements(db,session,productId,organisationId){
  if(!requirePlatform(session))return forbidden();
  const context=await productFeatureContext(db,productId,organisationId);
  if(!context)return json({error:{code:'PRODUCT_ORGANISATION_NOT_LINKED',message:'This organisation is not connected to the selected product.'}},404);
  const {features,overrides}=await readProductFeatureRows(db,productId,organisationId);
  const entitlements=resolveFeatureEntitlements(features,overrides,{productStatus:context.product_status,maintenanceMode:context.maintenance_mode,organisationStatus:context.organisation_status,linkReady:context.access_status==='ready'});
  const sync=await db.prepare(`SELECT contract_version,contract_checksum,requested_at,acknowledged_at,applied_at,product_version,status,error_message,updated_at FROM platform_entitlement_sync WHERE product_id=? AND organisation_id=?`).bind(productId,organisationId).first();
  return json({
    product:{id:context.product_id,code:context.product_code,name:context.product_name,status:context.product_status,maintenanceMode:Boolean(Number(context.maintenance_mode||0))},
    organisation:{id:context.organisation_id,externalId:context.external_organisation_id,name:context.organisation_name,status:context.organisation_status,accessStatus:context.access_status,provisioningStatus:context.provisioning_status},
    ownerCanEdit:session.access_level==='platform_owner',features:entitlements,sync:sync||{status:'pending'},
    summary:{enabled:entitlements.filter(item=>item.enabled).length,disabled:entitlements.filter(item=>!item.enabled).length,mandatory:entitlements.filter(item=>item.mandatory).length,delegated:entitlements.filter(item=>item.organisationControl==='disable_only').length},
  });
}

async function updateOrganisationFeatureEntitlements(request,db,session,productId,organisationId){
  if(!requirePlatform(session)||session.access_level!=='platform_owner')return forbidden();
  const context=await productFeatureContext(db,productId,organisationId);
  if(!context)return json({error:{code:'PRODUCT_ORGANISATION_NOT_LINKED',message:'This organisation is not connected to the selected product.'}},404);
  const input=await readJson(request,128*1024),reason=clean(input.reason).slice(0,1000),updates=Array.isArray(input.features)?input.features:[];
  if(reason.length<10)return badRequest('Enter a clear reason of at least 10 characters for this entitlement change.');
  if(!updates.length)return badRequest('Choose at least one feature setting to save.');
  const {features}=await readProductFeatureRows(db,productId,organisationId),featureByKey=new Map(features.map(item=>[item.feature_key,item])),normalised=[];
  for(const update of updates){
    const key=normaliseFeatureKey(update.key||update.feature_key),feature=featureByKey.get(key),state=['inherit','enabled','disabled'].includes(clean(update.state))?clean(update.state):'';
    if(!feature||!state)return badRequest(`The feature setting for ${key||'this item'} is invalid.`);
    if(Boolean(Number(feature.mandatory||0))&&state==='disabled')return badRequest(`${feature.name} is mandatory and cannot be disabled.`);
    const requestedControl=clean(update.organisationControl||update.organisation_control),organisationControl=requestedControl==='disable_only'&&Boolean(Number(feature.organisation_can_disable||0))?'disable_only':'owner';
    normalised.push({key,state,organisationControl});
  }
  const statements=normalised.map(item=>db.prepare(`INSERT INTO platform_organisation_features(product_id,organisation_id,feature_key,state,organisation_control,reason,updated_by,updated_at)
    VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(product_id,organisation_id,feature_key) DO UPDATE SET state=excluded.state,organisation_control=excluded.organisation_control,
    reason=excluded.reason,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(productId,organisationId,item.key,item.state,item.organisationControl,reason,session.user_id));
  statements.push(auditStatement(db,session.organisation_id,session.user_id,'platform.organisation_features_updated','organisation',organisationId,{productId,productCode:context.product_code,reason,changes:normalised}));
  statements.push(db.prepare(`INSERT INTO platform_entitlement_sync(product_id,organisation_id,status,error_message,updated_at) VALUES(?,?,'pending',NULL,CURRENT_TIMESTAMP)
    ON CONFLICT(product_id,organisation_id) DO UPDATE SET status='pending',acknowledged_at=NULL,applied_at=NULL,error_message=NULL,updated_at=CURRENT_TIMESTAMP`).bind(productId,organisationId));
  await db.batch(statements);
  return getOrganisationFeatureEntitlements(db,session,productId,organisationId);
}

async function resolveProductEntitlements(request,env){
  if(!env.DB)return databaseRequired();
  const url=new URL(request.url),pathMatch=url.pathname.match(/^\/api\/platform\/organisations\/([^/]+)\/products\/([^/]+)\/entitlements$/),productCode=clean(url.searchParams.get('product_code')||(pathMatch&&decodeURIComponent(pathMatch[2]))).toUpperCase(),suppliedOrganisationId=clean(url.searchParams.get('organisation_id')||(pathMatch&&decodeURIComponent(pathMatch[1]))),configuredKey=productAccessKey(env,productCode),suppliedKey=clean(request.headers.get('x-corecare-product-key'));
  if(!productCode||!suppliedOrganisationId)return badRequest('product_code and organisation_id are required.');
  if(!configuredKey)return json({error:{code:'PRODUCT_KEY_NOT_CONFIGURED',message:'Platform entitlements are not configured for this product.'}},503);
  if(!suppliedKey||!await secureEqualText(suppliedKey,configuredKey))return json({error:{code:'INVALID_PRODUCT_CREDENTIALS',message:'Product credentials are invalid.'}},401);
  const context=await env.DB.prepare(`SELECT p.id product_id,p.code product_code,p.name product_name,p.status product_status,p.maintenance_mode,p.updated_at product_updated_at,
    o.id organisation_id,o.name organisation_name,o.status organisation_status,o.subscription_plan,o.subscription_status,o.updated_at organisation_updated_at,
    COALESCE(o.max_users,sp.max_users) effective_max_users,COALESCE(o.max_clients,sp.max_clients) effective_max_clients,COALESCE(sp.monthly_price_pence,0) monthly_price_pence,sp.updated_at plan_updated_at,
    po.external_organisation_id,po.access_status,po.provisioning_status,po.updated_at link_updated_at
    FROM platform_products p JOIN platform_product_organisations po ON po.product_id=p.id JOIN organisations o ON o.id=po.organisation_id LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan
    WHERE p.code=? AND (po.organisation_id=? OR po.external_organisation_id=?) LIMIT 1`).bind(productCode,suppliedOrganisationId,suppliedOrganisationId).first();
  if(!context)return json({error:{code:'PRODUCT_ORGANISATION_NOT_LINKED',message:'This organisation is not linked to the product.'}},404);
  const {features,overrides}=await readProductFeatureRows(env.DB,context.product_id,context.organisation_id);
  const entitlements=resolveFeatureEntitlements(features,overrides,{productStatus:context.product_status,maintenanceMode:context.maintenance_mode,organisationStatus:context.organisation_status,linkReady:context.access_status==='ready'}),featureMap=Object.fromEntries(entitlements.map(item=>[item.key,item.enabled]));
  const version=[context.product_updated_at,context.organisation_updated_at,context.plan_updated_at,context.link_updated_at,...features.map(item=>item.updated_at),...overrides.map(item=>item.updated_at)].filter(Boolean).sort().at(-1)||new Date().toISOString();
  const contract={
    protocol:'corecare-entitlements/1',version,
    product:{code:context.product_code,name:context.product_name,status:context.product_status,maintenanceMode:Boolean(Number(context.maintenance_mode||0))},
    organisation:{id:context.organisation_id,externalId:context.external_organisation_id||context.organisation_id,status:context.organisation_status},
    subscription:{planId:context.subscription_plan,status:context.subscription_status,monthlyPricePence:Number(context.monthly_price_pence||0),limits:{users:context.effective_max_users===null?null:Number(context.effective_max_users),clients:context.effective_max_clients===null?null:Number(context.effective_max_clients)}},
    features:featureMap,details:entitlements.map(({key,enabled,source,mandatory,organisationControl,dependencies,blockedBy})=>({key,enabled,source,mandatory,organisationControl,dependencies,blockedBy})),
  },checksum=await sha256Base64(JSON.stringify(contract));
  await env.DB.prepare(`INSERT INTO platform_entitlement_sync(product_id,organisation_id,contract_version,contract_checksum,requested_at,status,error_message,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP,'pending',NULL,CURRENT_TIMESTAMP)
    ON CONFLICT(product_id,organisation_id) DO UPDATE SET contract_version=excluded.contract_version,contract_checksum=excluded.contract_checksum,
      requested_at=CURRENT_TIMESTAMP,status=CASE WHEN platform_entitlement_sync.contract_checksum=excluded.contract_checksum AND platform_entitlement_sync.status IN ('acknowledged','applied') THEN platform_entitlement_sync.status ELSE 'pending' END,
      acknowledged_at=CASE WHEN platform_entitlement_sync.contract_checksum=excluded.contract_checksum THEN platform_entitlement_sync.acknowledged_at ELSE NULL END,
      applied_at=CASE WHEN platform_entitlement_sync.contract_checksum=excluded.contract_checksum THEN platform_entitlement_sync.applied_at ELSE NULL END,
      error_message=NULL,updated_at=CURRENT_TIMESTAMP`).bind(context.product_id,context.organisation_id,version,checksum).run();
  return json({...contract,checksum,generatedAt:new Date().toISOString(),acknowledgementUrl:'/api/platform/entitlements/acknowledge'});
}
async function acknowledgeProductEntitlements(request,env){
  if(!env.DB)return databaseRequired();
  const input=await readJson(request,64*1024),productCode=clean(input.product_code||input.productCode).toUpperCase(),suppliedOrganisationId=clean(input.organisation_id||input.organisationId),suppliedKey=clean(request.headers.get('x-corecare-product-key')),configuredKey=productAccessKey(env,productCode);
  if(!productCode||!suppliedOrganisationId||!clean(input.version)||!clean(input.checksum))return badRequest('product_code, organisation_id, version and checksum are required.');
  if(!configuredKey)return json({error:{code:'PRODUCT_KEY_NOT_CONFIGURED',message:'Platform entitlements are not configured for this product.'}},503);
  if(!suppliedKey||!await secureEqualText(suppliedKey,configuredKey))return json({error:{code:'INVALID_PRODUCT_CREDENTIALS',message:'Product credentials are invalid.'}},401);
  const context=await env.DB.prepare(`SELECT p.id product_id,po.organisation_id FROM platform_products p JOIN platform_product_organisations po ON po.product_id=p.id WHERE p.code=? AND (po.organisation_id=? OR po.external_organisation_id=?) LIMIT 1`).bind(productCode,suppliedOrganisationId,suppliedOrganisationId).first();
  if(!context)return json({error:{code:'PRODUCT_ORGANISATION_NOT_LINKED',message:'This organisation is not linked to the product.'}},404);
  const sync=await env.DB.prepare(`SELECT contract_version,contract_checksum FROM platform_entitlement_sync WHERE product_id=? AND organisation_id=?`).bind(context.product_id,context.organisation_id).first();
  if(!sync||sync.contract_version!==clean(input.version)||sync.contract_checksum!==clean(input.checksum))return json({error:{code:'ENTITLEMENT_CONTRACT_MISMATCH',message:'Fetch the current entitlement contract before acknowledging it.'}},409);
  const requestedStatus=clean(input.status).toLowerCase(),status=requestedStatus==='failed'?'failed':requestedStatus==='acknowledged'?'acknowledged':'applied',errorMessage=status==='failed'?clean(input.error||input.error_message).slice(0,1000):null,details=input.details&&typeof input.details==='object'&&!Array.isArray(input.details)?input.details:{};
  await env.DB.prepare(`UPDATE platform_entitlement_sync SET acknowledged_at=CURRENT_TIMESTAMP,applied_at=CASE WHEN ?='applied' THEN CURRENT_TIMESTAMP ELSE applied_at END,
    product_version=?,status=?,error_message=?,details_json=?,updated_at=CURRENT_TIMESTAMP WHERE product_id=? AND organisation_id=?`).bind(status,clean(input.product_version||input.productVersion).slice(0,80)||null,status,errorMessage,JSON.stringify(details).slice(0,10000),context.product_id,context.organisation_id).run();
  return json({ok:true,status,version:sync.contract_version,checksum:sync.contract_checksum});
}
async function createPlatformSupportSession(request,env,session){
  if(!requirePlatform(session)) return forbidden();
  const input=await readJson(request,32*1024),productId=clean(input.product_id),organisationId=clean(input.organisation_id),reason=clean(input.reason),requestedMode=clean(input.access_mode)||'read_only',allowedModes=allowedProductAccessModes(session);
  if(!allowedModes.has(requestedMode))return forbidden();
  const accessMode=requestedMode;
  if(!productId||!organisationId||reason.length<10)return badRequest('Choose a product and organisation and enter a clear access reason of at least 10 characters.');
  const connection=await env.DB.prepare(`SELECT p.id,p.code,p.name,p.status,p.production_url,o.name organisation_name,o.status organisation_status,po.external_organisation_id,po.access_status
    FROM platform_products p JOIN platform_product_organisations po ON po.product_id=p.id JOIN organisations o ON o.id=po.organisation_id
    WHERE p.id=? AND o.id=?`).bind(productId,organisationId).first();
  if(!connection)return json({error:{code:'PRODUCT_ORGANISATION_NOT_LINKED',message:'This organisation is not connected to the selected product.'}},409);
  if(connection.access_status!=='ready'||!clean(connection.external_organisation_id))return json({error:{code:'PRODUCT_ORGANISATION_NOT_READY',message:'Confirm the product-side organisation identifier before opening support access.'}},409);
  if(connection.organisation_status!=='active')return json({error:{code:'ORGANISATION_UNAVAILABLE',message:'This organisation is not active.'}},409);
  if(connection.status==='retired')return json({error:{code:'PRODUCT_UNAVAILABLE',message:'This product is retired and cannot issue support access.'}},409);
  const productionUrl=normaliseProductUrl(connection.production_url);
  if(!productionUrl)return json({error:{code:'PRODUCT_ACCESS_NOT_CONFIGURED',message:`Configure the production URL for ${connection.name} before opening an organisation.`}},409);
  const {settings}=await readPlatformSettings(env.DB),requestedMinutes=Number(input.duration_minutes||settings.defaultSupportDurationMinutes);
  const supportSessionId=crypto.randomUUID(),grantId=crypto.randomUUID(),code=randomToken(),codeHash=await sha256Base64(code),minutes=Math.min(Math.max(Number.isFinite(requestedMinutes)?requestedMinutes:settings.defaultSupportDurationMinutes,15),settings.maximumSupportDurationMinutes),platformOrigin=new URL(request.url).origin;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO platform_support_sessions(id,product_id,organisation_id,staff_user_id,access_mode,reason,status,started_at,expires_at) VALUES(?,?,?,?,?,?, 'active',CURRENT_TIMESTAMP,datetime('now',?))`).bind(supportSessionId,productId,organisationId,session.user_id,accessMode,reason.slice(0,1000),`+${minutes} minutes`),
    env.DB.prepare(`INSERT INTO platform_access_grants(id,support_session_id,product_id,organisation_id,code_hash,issued_by,access_mode,expires_at) VALUES(?,?,?,?,?,?,?,datetime('now','+5 minutes'))`).bind(grantId,supportSessionId,productId,organisationId,codeHash,session.user_id,accessMode),
    auditStatement(env.DB,session.organisation_id,session.user_id,'platform.support_session.started','support_session',supportSessionId,{product_id:productId,organisation_id:organisationId,access_mode:accessMode,reason,grant_id:grantId})
  ]);
  return json({ok:true,id:supportSessionId,grant_id:grantId,expires_in_minutes:minutes,launch_url:buildProductLaunchUrl(productionUrl,code,platformOrigin),product:{id:connection.id,code:connection.code,name:connection.name},organisation:{id:organisationId,external_id:connection.external_organisation_id||organisationId,name:connection.organisation_name}},201);
}
async function exchangePlatformAccess(request,env){
  if(!env.DB)return databaseRequired();
  const input=await readJson(request,16*1024),code=clean(input.code),productCode=clean(input.product_code).toUpperCase(),configuredKey=productAccessKey(env,productCode),suppliedKey=clean(request.headers.get('x-corecare-product-key'));
  if(!code||!productCode)return badRequest('code and product_code are required.');
  if(!configuredKey)return json({error:{code:'PRODUCT_KEY_NOT_CONFIGURED',message:'Platform access is not configured for this product.'}},503);
  if(!suppliedKey||!await secureEqualText(suppliedKey,configuredKey))return json({error:{code:'INVALID_PRODUCT_CREDENTIALS',message:'Product credentials are invalid.'}},401);
  const codeHash=await sha256Base64(code);
  const grant=await env.DB.prepare(`SELECT g.*,s.reason,s.status session_status,s.expires_at session_expires_at,p.code product_code,p.name product_name,o.name organisation_name,po.external_organisation_id,u.email platform_user_email,u.display_name platform_user_name
    FROM platform_access_grants g JOIN platform_support_sessions s ON s.id=g.support_session_id JOIN platform_products p ON p.id=g.product_id JOIN organisations o ON o.id=g.organisation_id JOIN platform_product_organisations po ON po.product_id=g.product_id AND po.organisation_id=g.organisation_id JOIN users u ON u.id=g.issued_by
    WHERE g.code_hash=? AND p.code=?`).bind(codeHash,productCode).first();
  if(!grant)return json({error:{code:'ACCESS_GRANT_NOT_FOUND',message:'The access grant is invalid.'}},404);
  if(grant.consumed_at||grant.revoked_at||grant.session_status!=='active'||new Date(`${grant.expires_at}Z`)<=new Date()||new Date(`${grant.session_expires_at}Z`)<=new Date())return json({error:{code:'ACCESS_GRANT_EXPIRED',message:'The access grant has expired or was already used.'}},410);
  const update=await env.DB.prepare(`UPDATE platform_access_grants SET consumed_at=CURRENT_TIMESTAMP WHERE id=? AND consumed_at IS NULL AND revoked_at IS NULL`).bind(grant.id).run();
  if(Number(update.meta?.changes||0)!==1)return json({error:{code:'ACCESS_GRANT_CONSUMED',message:'The access grant was already used.'}},410);
  return json({ok:true,protocol:'corecare-platform-access/1',support_session:{id:grant.support_session_id,access_mode:grant.access_mode,reason:grant.reason,expires_at:grant.session_expires_at},product:{code:grant.product_code,name:grant.product_name},organisation:{id:grant.organisation_id,external_id:grant.external_organisation_id||grant.organisation_id,name:grant.organisation_name},platform_user:{id:grant.issued_by,email:grant.platform_user_email,name:grant.platform_user_name}},200);
}


async function getPlatformTicket(db,session,id){
  if(!requirePlatform(session)) return forbidden();
  const ticket=await db.prepare(`SELECT t.*,p.name product_name,p.code product_code,o.name organisation_name,u.display_name assigned_name,c.display_name created_name
    FROM platform_support_tickets t LEFT JOIN platform_products p ON p.id=t.product_id LEFT JOIN organisations o ON o.id=t.organisation_id
    LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN users c ON c.id=t.created_by WHERE t.id=?`).bind(id).first();
  if(!ticket)return notFound('Ticket');
  const [messages,time,attachments,history]=await Promise.all([
    db.prepare(`SELECT m.*,u.display_name author_name FROM platform_ticket_messages m LEFT JOIN users u ON u.id=m.author_user_id WHERE m.ticket_id=? ORDER BY m.created_at`).bind(id).all(),
    db.prepare(`SELECT e.*,u.display_name staff_name FROM platform_ticket_time_entries e LEFT JOIN users u ON u.id=e.staff_user_id WHERE e.ticket_id=? ORDER BY e.created_at DESC`).bind(id).all(),
    db.prepare(`SELECT id,file_name,mime_type,size_bytes,created_at AS uploaded_at FROM platform_ticket_attachments WHERE ticket_id=? ORDER BY created_at`).bind(id).all(),
    db.prepare(`SELECT h.*,u.display_name changed_name FROM platform_ticket_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.ticket_id=? ORDER BY h.changed_at`).bind(id).all()
  ]);
  return json({ticket,messages:messages.results||[],timeEntries:time.results||[],attachments:attachments.results||[],history:history.results||[],totalMinutes:(time.results||[]).reduce((n,x)=>n+Number(x.minutes||0),0)});
}
async function updatePlatformTicket(request,db,session,id){
  if(!requirePlatform(session)) return forbidden();
  const current=await db.prepare('SELECT * FROM platform_support_tickets WHERE id=?').bind(id).first();if(!current)return notFound('Ticket');
  const b=await readJson(request), allowedStatus=['new','in_progress','waiting_customer','waiting_development','resolved','closed'],allowedPriority=['low','normal','high','critical'];
  const status=allowedStatus.includes(b.status)?b.status:current.status,priority=allowedPriority.includes(b.priority)?b.priority:current.priority;
  const assigned=b.assigned_to===undefined?current.assigned_to:(b.assigned_to||null),subject=clean(b.subject||current.subject).slice(0,180),category=clean(b.category||current.category).slice(0,80);
  await db.prepare(`UPDATE platform_support_tickets SET subject=?,category=?,priority=?,status=?,assigned_to=?,resolved_at=CASE WHEN ? IN ('resolved','closed') THEN COALESCE(resolved_at,CURRENT_TIMESTAMP) ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(subject,category,priority,status,assigned,status,id).run();
  await writeAudit(db,session,'platform.ticket.updated','support_ticket',id,{status,priority,assigned_to:assigned});return json({ok:true});
}
async function addPlatformTicketMessage(request,db,session,id){
  if(!requirePlatform(session)) return forbidden();const t=await db.prepare('SELECT id FROM platform_support_tickets WHERE id=?').bind(id).first();if(!t)return notFound('Ticket');
  const b=await readJson(request),body=clean(b.body).slice(0,8000),type=['internal_note','customer_reply'].includes(b.message_type)?b.message_type:'customer_reply';if(!body)return json({error:'Message is required.'},400);
  const mid=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO platform_ticket_messages(id,ticket_id,author_user_id,message_type,body) VALUES(?,?,?,?,?)').bind(mid,id,session.user_id,type,body),db.prepare('UPDATE platform_support_tickets SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(id),auditStatement(db,session.organisation_id,session.user_id,'platform.ticket.message_added','support_ticket',id,{message_type:type})]);return json({ok:true,id:mid},201);
}
async function addPlatformTicketTime(request,db,session,id){
  if(!requirePlatform(session)) return forbidden();const t=await db.prepare('SELECT id FROM platform_support_tickets WHERE id=?').bind(id).first();if(!t)return notFound('Ticket');
  const b=await readJson(request),minutes=Math.min(Math.max(Number(b.minutes||0),1),1440);if(!Number.isFinite(minutes))return json({error:'Valid minutes are required.'},400);
  const eid=crypto.randomUUID();await db.prepare('INSERT INTO platform_ticket_time_entries(id,ticket_id,staff_user_id,minutes,notes) VALUES(?,?,?,?,?)').bind(eid,id,session.user_id,minutes,clean(b.notes).slice(0,500)).run();await writeAudit(db,session,'platform.ticket.time_logged','support_ticket',id,{minutes});return json({ok:true,id:eid},201);
}
async function endPlatformSupportSession(db,session,id){
  if(!requirePlatform(session)) return forbidden();const row=await db.prepare('SELECT * FROM platform_support_sessions WHERE id=?').bind(id).first();if(!row)return notFound('Support session');
  await db.batch([db.prepare(`UPDATE platform_support_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id),db.prepare(`UPDATE platform_access_grants SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE support_session_id=? AND consumed_at IS NULL`).bind(id),auditStatement(db,session.organisation_id,session.user_id,'platform.support_session.ended','support_session',id,{})]);return json({ok:true});
}
async function platformOrganisationOperations(env,session,productId,organisationId){
  if(!requirePlatform(session)) return forbidden();
  const db=env.DB,[org,link,tickets,sessions,activity,users,product,onboarding,entitlementSync]=await Promise.all([
    db.prepare('SELECT id,name,status,subscription_plan,created_at FROM organisations WHERE id=?').bind(organisationId).first(),
    db.prepare('SELECT * FROM platform_product_organisations WHERE product_id=? AND organisation_id=?').bind(productId,organisationId).first(),
    db.prepare(`SELECT id,ticket_number,subject,priority,status,updated_at,source_product,external_reference,requester_name,requester_email,app_version FROM platform_support_tickets WHERE product_id=? AND organisation_id=? ORDER BY updated_at DESC LIMIT 30`).bind(productId,organisationId).all(),
    db.prepare(`SELECT s.*,u.display_name staff_name FROM platform_support_sessions s LEFT JOIN users u ON u.id=s.staff_user_id WHERE s.product_id=? AND s.organisation_id=? ORDER BY s.started_at DESC LIMIT 20`).bind(productId,organisationId).all(),
    db.prepare(`SELECT action,entity_type,created_at FROM audit_log WHERE organisation_id=? ORDER BY created_at DESC LIMIT 20`).bind(organisationId).all(),
    db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active FROM users WHERE organisation_id=?`).bind(organisationId).first(),
    db.prepare('SELECT id,code,name,production_url FROM platform_products WHERE id=?').bind(productId).first(),
    db.prepare('SELECT status,detail_json,created_at FROM platform_onboarding_events WHERE product_id=? AND organisation_id=? ORDER BY created_at DESC LIMIT 20').bind(productId,organisationId).all(),
    db.prepare('SELECT contract_version,contract_checksum,requested_at,acknowledged_at,applied_at,product_version,status,error_message,updated_at FROM platform_entitlement_sync WHERE product_id=? AND organisation_id=?').bind(productId,organisationId).first(),
  ]);
  if(!org)return notFound('Organisation');
  if(!link)return json({error:{code:'PRODUCT_ORGANISATION_NOT_LINKED',message:'This organisation is not connected to the selected product.'}},404);
  let productSummary=null,productSyncError=null,productSyncSucceeded=false;
  try{
    const remote=await productControlRequest(env,product,`/api/platform/organisations/${encodeURIComponent(link.external_organisation_id||organisationId)}`,{method:'GET'});
    productSummary=remote.summary||remote;
    await db.prepare(`UPDATE platform_product_organisations SET product_summary_json=?,last_sync_at=CURRENT_TIMESTAMP,last_sync_error=NULL,
      integration_status='connected',updated_at=CURRENT_TIMESTAMP WHERE product_id=? AND organisation_id=?`)
      .bind(JSON.stringify(productSummary).slice(0,20000),productId,organisationId).run();
    productSyncSucceeded=true;
  }catch(error){
    productSyncError=clean(error?.message).slice(0,500);
    try{await db.prepare(`UPDATE platform_product_organisations SET last_sync_at=CURRENT_TIMESTAMP,last_sync_error=?,integration_status='failed',updated_at=CURRENT_TIMESTAMP WHERE product_id=? AND organisation_id=?`).bind(productSyncError,productId,organisationId).run()}catch{}
    try{productSummary=link.product_summary_json?JSON.parse(link.product_summary_json):null}catch{}
  }
  return json({organisation:org,product,health:resolveProductOrganisationHealth(link,productSyncError,productSyncSucceeded),entitlementSync:entitlementSync||{status:'pending'},productSummary,tickets:tickets.results||[],supportSessions:sessions.results||[],activity:activity.results||[],users:users||{},onboarding:onboarding.results||[]});
}

function resolveProductOrganisationHealth(link,productSyncError='',productSyncSucceeded=false){
  return {
    ...link,
    integration_status:productSyncSucceeded?'connected':link?.integration_status,
    last_sync_error:productSyncSucceeded?null:(clean(productSyncError)||link?.last_sync_error||null),
  };
}
async function ingestPlatformHealth(request,env){
  if(!env.DB)return databaseRequired();const expected=env.PRODUCT_HEALTH_TOKEN;if(!expected)return json({error:'Product health ingestion is not configured.'},503);
  if(!await secureEqualText(request.headers.get('x-corecare-health-key'),expected))return json({error:'Unauthorised health report.'},401);
  const b=await readJson(request,256*1024),code=clean(b.product_code).toUpperCase(),reportedOrgId=clean(b.organisation_id)||null;if(!code)return json({error:'product_code is required.'},400);
  const product=await env.DB.prepare('SELECT id FROM platform_products WHERE code=?').bind(code).first();if(!product)return json({error:'Unknown product.'},404);
  let orgId=null;
  if(reportedOrgId){const link=await env.DB.prepare(`SELECT organisation_id FROM platform_product_organisations WHERE product_id=? AND (organisation_id=? OR external_organisation_id=?) LIMIT 1`).bind(product.id,reportedOrgId,reportedOrgId).first();orgId=link?.organisation_id||null}
  const id=crypto.randomUUID(),status=clean(b.status||'unknown').slice(0,30),details=JSON.stringify(b.details||{}).slice(0,20000);
  const statements=[env.DB.prepare(`INSERT INTO platform_health_reports(id,product_id,organisation_id,version,environment,status,response_ms,error_count_24h,database_status,auth_status,integration_status,failed_jobs,details_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,product.id,orgId,clean(b.version),clean(b.environment||'production'),status,Number(b.response_ms)||null,Number(b.error_count_24h)||0,clean(b.database_status),clean(b.auth_status),clean(b.integration_status),Number(b.failed_jobs)||0,details),env.DB.prepare(`INSERT INTO platform_product_health(id,product_id,status,response_ms,error_count_24h,database_status,auth_status,integration_status,details_json,last_check_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(),product.id,status,Number(b.response_ms)||null,Number(b.error_count_24h)||0,clean(b.database_status),clean(b.auth_status),clean(b.integration_status),details)];
  if(orgId)statements.push(env.DB.prepare(`UPDATE platform_product_organisations SET health_status=?,error_count_24h=?,database_status=?,auth_status=?,integration_status=?,last_health_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE product_id=? AND organisation_id=?`).bind(status,Number(b.error_count_24h)||0,clean(b.database_status||'unknown'),clean(b.auth_status||'unknown'),clean(b.integration_status||'unknown'),product.id,orgId));
  await env.DB.batch(statements);return json({ok:true,report_id:id},202);
}

function normalisePolledHealthState(value){
  if(value===true)return 'healthy';
  if(value===false)return 'not_connected';
  const state=clean(value).toLowerCase();
  if(['healthy','ok','operational','configured','connected','d1','available','ready'].includes(state))return 'healthy';
  if(['failed','error','unhealthy','unavailable','down'].includes(state))return 'failed';
  if(['disabled','not_configured','not-configured','not_connected','not-connected','missing'].includes(state))return 'not_connected';
  return state||'unknown';
}

function projectPolledProductHealth(responseOk,payload={},responseMs=0,errorMessage=''){
  const advertisedStatus=clean(payload.status).toLowerCase();
  const failedStatus=['failed','error','unhealthy','unavailable','down'].includes(advertisedStatus);
  const status=responseOk&&payload.ok!==false&&!failedStatus?'healthy':'failed';
  const databaseValue=payload.database_status??payload.databaseStatus??payload.database??payload.persistence??payload.services?.database;
  const authValue=payload.auth_status??payload.authStatus??payload.authentication??payload.services?.platformAuthentication;
  const integrationValue=payload.integration_status??payload.integrationStatus??payload.managementSuite??payload.platform?.configured;
  return {
    status,
    responseMs:Math.max(0,Number(responseMs)||0),
    databaseStatus:normalisePolledHealthState(databaseValue),
    authStatus:normalisePolledHealthState(authValue),
    integrationStatus:normalisePolledHealthState(integrationValue),
    version:clean(payload.version),
    details:{source:'platform_health_poll',reportedStatus:advertisedStatus||null,error:errorMessage||null,payload},
  };
}

async function pollPlatformProduct(env,product){
  const db=env.DB;
  const started=Date.now();let payload={},responseOk=false,errorMessage='';
  try{
    const service=productService(env,product.code),request=new Request(product.health_url,{headers:{accept:'application/json','user-agent':`corecare-platform/${VERSION}`},signal:AbortSignal.timeout(15000)});
    const response=service?.fetch?await service.fetch(request):await fetch(request);
    responseOk=response.ok;
    payload=await readResponseJson(response,512*1024).catch(()=>({status:response.ok?'ok':'failed'}));
    if(!response.ok)errorMessage=`HTTP ${response.status}`;
  }catch(error){errorMessage=clean(error?.message||'Health request failed').slice(0,500);}
  const health=projectPolledProductHealth(responseOk,payload,Date.now()-started,errorMessage);
  const details=JSON.stringify(health.details).slice(0,20000);
  const statements=[db.prepare(`INSERT INTO platform_product_health(id,product_id,status,response_ms,error_count_24h,database_status,auth_status,integration_status,details_json,last_check_at) VALUES(?,?,?,?,0,?,?,?,?,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(),product.id,health.status,health.responseMs,health.databaseStatus,health.authStatus,health.integrationStatus,details)];
  statements.push(db.prepare(`UPDATE platform_product_organisations SET health_status=?,
    database_status=CASE WHEN ?='unknown' THEN database_status ELSE ? END,
    auth_status=CASE WHEN ?='unknown' THEN auth_status ELSE ? END,
    integration_status=CASE WHEN ?='unknown' THEN integration_status ELSE ? END,
    last_health_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE product_id=?`)
    .bind(health.status,health.databaseStatus,health.databaseStatus,health.authStatus,health.authStatus,health.integrationStatus,health.integrationStatus,product.id));
  if(health.version)statements.push(db.prepare('UPDATE platform_products SET current_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(health.version,product.id));
  await db.batch(statements);
  return {code:product.code,...health};
}

async function pollPlatformProducts(env){
  if(!env.DB)return {ok:false,skipped:true,reason:'database_not_configured'};
  const products=await env.DB.prepare(`SELECT id,code,health_url,production_url FROM platform_products WHERE status!='retired' AND health_url IS NOT NULL AND trim(health_url)!='' ORDER BY sort_order,code`).all();
  const settled=await Promise.allSettled((products.results||[]).map(product=>pollPlatformProduct(env,product)));
  const failed=settled.filter(result=>result.status==='rejected');
  if(failed.length)console.error('Product health polling failed',failed.map(result=>clean(result.reason?.message||result.reason)));
  return {ok:failed.length===0,checked:settled.length,failed:failed.length};
}

async function expirePlatformSecurityState(db){
  if(!db)return {ok:false,skipped:true};
  await db.batch([
    db.prepare(`UPDATE platform_access_grants SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE consumed_at IS NULL AND revoked_at IS NULL AND (datetime(expires_at)<=CURRENT_TIMESTAMP OR support_session_id IN (SELECT id FROM platform_support_sessions WHERE status='active' AND datetime(expires_at)<=CURRENT_TIMESTAMP))`),
    db.prepare(`UPDATE platform_support_sessions SET status='expired',ended_at=COALESCE(ended_at,CURRENT_TIMESTAMP) WHERE status='active' AND datetime(expires_at)<=CURRENT_TIMESTAMP`),
    db.prepare(`DELETE FROM sessions WHERE datetime(expires_at)<=CURRENT_TIMESTAMP`),
    db.prepare(`DELETE FROM login_attempts WHERE datetime(COALESCE(locked_until,window_started_at))<datetime('now','-24 hours')`),
  ]);
  return {ok:true};
}

async function createAuditCheckpoint(env,checkpointHours=24){
  const db=env.DB,last=await db.prepare(`SELECT checkpoint_hash,last_event_id,audit_max_created_at,created_at FROM platform_audit_checkpoints ORDER BY created_at DESC LIMIT 1`).first();
  const lastCreated=databaseTimestamp(last?.created_at);
  if(lastCreated&&Date.now()-lastCreated.getTime()<checkpointHours*3600000)return {ok:true,skipped:true,id:null};
  let rows;
  if(last?.audit_max_created_at){
    rows=await db.prepare(`SELECT id,organisation_id,user_id,action,entity_type,entity_id,detail_json,created_at FROM audit_log
      WHERE created_at>? OR (created_at=? AND id>?) ORDER BY created_at,id LIMIT 5000`).bind(last.audit_max_created_at,last.audit_max_created_at,last.last_event_id||'').all();
  }else rows=await db.prepare(`SELECT id,organisation_id,user_id,action,entity_type,entity_id,detail_json,created_at FROM audit_log ORDER BY created_at,id LIMIT 5000`).all();
  const events=rows.results||[];
  if(!events.length)return {ok:true,skipped:true,id:null};
  const first=events[0],final=events.at(-1),previousHash=last?.checkpoint_hash||'',payload={protocol:'corecare-audit-checkpoint/1',previousCheckpointHash:previousHash||null,firstEventId:first.id,lastEventId:final.id,eventCount:events.length,auditMaxCreatedAt:final.created_at,events},checkpointHash=await sha256Base64(`${previousHash}\n${JSON.stringify(payload)}`),id=crypto.randomUUID();
  let exportKey=null;
  if(env.ATTACHMENTS){
    const date=new Date(),prefix=`${date.getUTCFullYear()}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${String(date.getUTCDate()).padStart(2,'0')}`;
    exportKey=`audit-checkpoints/${prefix}/${id}.json`;
    await env.ATTACHMENTS.put(exportKey,JSON.stringify({...payload,checkpointHash}),{httpMetadata:{contentType:'application/json'},customMetadata:{checkpointHash,eventCount:String(events.length)}});
  }
  await db.prepare(`INSERT INTO platform_audit_checkpoints(id,previous_checkpoint_hash,checkpoint_hash,first_event_id,last_event_id,event_count,audit_max_created_at,export_key) VALUES(?,?,?,?,?,?,?,?)`).bind(id,previousHash||null,checkpointHash,first.id,final.id,events.length,final.created_at,exportKey).run();
  return {ok:true,skipped:false,id,eventCount:events.length,checkpointHash,exportKey};
}

async function runPlatformMaintenance(env){
  if(!env.DB)return {ok:false,skipped:true,reason:'database_not_configured'};
  const runId=crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO platform_maintenance_runs(id,status) VALUES(?,'running')`).bind(runId).run();
  try{
    const {settings}=await readPlatformSettings(env.DB),security=await expirePlatformSecurityState(env.DB),poll=await pollPlatformProducts(env);
    const healthDelete=await env.DB.prepare(`DELETE FROM platform_product_health WHERE last_check_at<datetime('now',?)`).bind(`-${settings.healthRetentionDays} days`).run();
    const reportsDelete=await env.DB.prepare(`DELETE FROM platform_health_reports WHERE received_at<datetime('now',?)`).bind(`-${settings.healthRetentionDays} days`).run();
    const checkpoint=await createAuditCheckpoint(env,settings.auditCheckpointHours);
    await env.DB.prepare(`UPDATE platform_maintenance_runs SET status='succeeded',checked_products=?,failed_products=?,health_rows_deleted=?,reports_deleted=?,checkpoint_id=?,completed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(Number(poll.checked||0),Number(poll.failed||0),Number(healthDelete.meta?.changes||0),Number(reportsDelete.meta?.changes||0),checkpoint.id||null,runId).run();
    return {ok:true,runId,security,poll,checkpoint,healthRowsDeleted:Number(healthDelete.meta?.changes||0),reportsDeleted:Number(reportsDelete.meta?.changes||0)};
  }catch(error){
    const message=clean(error?.message||error).slice(0,1000);
    await env.DB.batch([
      env.DB.prepare(`UPDATE platform_maintenance_runs SET status='failed',error_message=?,completed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(message,runId),
      env.DB.prepare(`INSERT INTO notifications(id,category,priority,title,message,source,source_id) VALUES(?,'system','critical','Platform maintenance failed',?,'platform_maintenance',?)`).bind(crypto.randomUUID(),message,runId),
    ]).catch(()=>null);
    throw error;
  }
}

function attachmentEnvironment(value){return value?.DB?value:{DB:value,ATTACHMENTS:null};}
async function addPlatformTicketAttachment(request,target,session,id){
  const env=attachmentEnvironment(target),db=env.DB;
  if(!requirePlatform(session))return forbidden();
  const ticket=await db.prepare('SELECT id FROM platform_support_tickets WHERE id=?').bind(id).first();
  if(!ticket)return notFound('Ticket');
  const input=await readJson(request),dataUrl=String(input.data_url||input.dataBase64||''),fileName=(clean(input.file_name||input.fileName)||'attachment').replace(/[\\/\u0000-\u001f\u007f]/g,'_'),declaredMime=clean(input.mime_type||input.mimeType).toLowerCase();
  const match=dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);if(!match)return badRequest('Attachment data is invalid.');
  const mimeType=clean(match[1]).toLowerCase(),allowedMimeTypes=new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
  if(!allowedMimeTypes.has(mimeType)||declaredMime&&declaredMime!==mimeType)return badRequest('This attachment type is not allowed.');
  let bytes;try{bytes=Uint8Array.from(atob(match[2].replace(/\s/g,'')),character=>character.charCodeAt(0));}catch{return badRequest('Attachment data is invalid.');}
  const sizeBytes=bytes.byteLength;if(sizeBytes===0||sizeBytes>2097152)return badRequest('Attachment must be 2 MB or smaller.');
  const attachmentId=crypto.randomUUID(),checksum=await sha256BytesBase64(bytes),storageKey=env.ATTACHMENTS?`ticket-attachments/${id}/${attachmentId}`:null;
  if(env.ATTACHMENTS)await env.ATTACHMENTS.put(storageKey,bytes,{httpMetadata:{contentType:mimeType,contentDisposition:`attachment; filename="${fileName.slice(0,255).replace(/["\r\n]/g,'')}"`},customMetadata:{ticketId:id,checksum}});
  try{
    await db.prepare(`INSERT INTO platform_ticket_attachments(id,ticket_id,file_name,mime_type,size_bytes,data_url,uploaded_by,storage_key,checksum_sha256,storage_status) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(attachmentId,id,fileName.slice(0,255),mimeType.slice(0,120),sizeBytes,env.ATTACHMENTS?'':dataUrl,session.user_id,storageKey,checksum,env.ATTACHMENTS?'r2':'legacy_d1').run();
  }catch(error){if(storageKey)await env.ATTACHMENTS.delete(storageKey).catch(()=>null);throw error;}
  await writeAudit(db,session,'platform.ticket_attachment_added','platform_support_ticket',id,{attachmentId,fileName:fileName.slice(0,255),mimeType,sizeBytes,storage:env.ATTACHMENTS?'r2':'d1'});
  return json({ok:true,id:attachmentId,storage:env.ATTACHMENTS?'r2':'d1'},201);
}
async function getPlatformTicketAttachment(target,session,id){
  const env=attachmentEnvironment(target),db=env.DB;
  if(!requirePlatform(session))return forbidden();
  const attachment=await db.prepare('SELECT * FROM platform_ticket_attachments WHERE id=?').bind(id).first();
  if(!attachment)return notFound('Attachment');
  const fileName=String(attachment.file_name||'attachment').replace(/["\r\n]/g,'');
  if(attachment.storage_key&&env.ATTACHMENTS){
    const object=await env.ATTACHMENTS.get(attachment.storage_key);
    if(!object)return json({error:{code:'ATTACHMENT_OBJECT_MISSING',message:'The attachment record exists but its stored object is missing.'}},503);
    return new Response(object.body,{headers:{'content-type':attachment.mime_type||object.httpMetadata?.contentType||'application/octet-stream','content-disposition':`attachment; filename="${fileName}"`,'content-length':String(attachment.size_bytes||object.size||''),'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  }
  const match=String(attachment.data_url||'').match(/^data:([^;,]+);base64,(.+)$/s);
  if(!match)return json({error:{code:'INVALID_ATTACHMENT',message:'The stored attachment data is invalid.'}},422);
  const bytes=Uint8Array.from(atob(match[2]),character=>character.charCodeAt(0));
  return new Response(bytes,{headers:{'content-type':attachment.mime_type||match[1]||'application/octet-stream','content-disposition':`attachment; filename="${fileName}"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
async function deletePlatformTicketAttachment(target,session,id){
  const env=attachmentEnvironment(target),db=env.DB;
  if(!requirePlatform(session))return forbidden();
  const attachment=await db.prepare('SELECT id,ticket_id,file_name,storage_key FROM platform_ticket_attachments WHERE id=?').bind(id).first();
  if(!attachment)return notFound('Attachment');
  if(attachment.storage_key&&env.ATTACHMENTS)await env.ATTACHMENTS.delete(attachment.storage_key);
  await db.batch([db.prepare('DELETE FROM platform_ticket_attachments WHERE id=?').bind(id),auditStatement(db,session.organisation_id,session.user_id,'platform.ticket_attachment_deleted','platform_support_ticket',attachment.ticket_id,{fileName:attachment.file_name})]);
  return json({ok:true});
}

export { addPlatformTicketAttachment, getPlatformTicketAttachment, deletePlatformTicketAttachment };
export { buildProductLaunchUrl, productAccessKey, createPlatformSupportSession, exchangePlatformAccess, ingestProductTicket, createPlatformProduct, updatePlatformProduct, linkProductOrganisation, resolveProductOrganisationHealth };
export { pollPlatformProducts, projectPolledProductHealth, expirePlatformSecurityState, authenticatedRequestGuard, allowedProductAccessModes, readJson, secureEqualText };
export { CLOUDFLARE_WORKERS_PBKDF2_MAX_ITERATIONS };
export { DEFAULT_PLATFORM_SETTINGS, normalisePlatformSettings, platformAuditCategoryClause, readPlatformSettings, getPlatformSettings, updatePlatformSettings };
export { normaliseFeatureKey, parseFeatureDependencies, resolveFeatureEntitlements, listPlatformProductFeatures, savePlatformProductFeature, getOrganisationFeatureEntitlements, updateOrganisationFeatureEntitlements, resolveProductEntitlements, acknowledgeProductEntitlements };
export { createAuditCheckpoint, runPlatformMaintenance };
export { subscriptionLimitState };
export { stripeCoreCareStatus, verifyStripeSignature };
