const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
function setText(selector, value) { const node = $(selector); if (node) node.textContent = value; }

const loginView = $('#login-view');
const appView = $('#app-view');
const APP_EDITION = 'platform';
const CARE_URL = 'https://care.corecare.co.uk';
const loginForm = $('#login-form');
const loginError = $('#login-error');
const sidebar = $('.sidebar');
const menuButton = $('#menu-button');
const pageTitle = $('#page-title');
const pageKicker = $('#page-kicker');
const pages = $$('.page');
const clientDialog = $('#client-dialog');
const clientForm = $('#client-form');
const clientTableBody = $('#client-table-body');
const clientEmpty = $('#client-empty');
const clientSearch = $('#client-search');
const clientStatusFilter = $('#client-status-filter');
const passwordDialog = $('#password-dialog');
const passwordForm = $('#password-form');
const userDialog = $('#user-dialog');
const userForm = $('#user-form');
const staffDialog = $('#staff-dialog');
const staffForm = $('#staff-form');
const quickAddDialog = $('#quick-add-dialog');
const careClientPickerDialog = $('#care-client-picker-dialog');
let staff = [];
let carePlans = [];
let allCarePlans = [];
let clientRisks = [];
let clientDocuments = [];
const carePlanDomainDefinitions = [
  ['personal_care','Personal care','Washing, dressing, grooming, oral care and dignity.'],
  ['communication','Communication','How the person communicates, understands information and makes choices.'],
  ['mobility','Mobility & moving safely','Walking, transfers, equipment, positioning and manual handling.'],
  ['nutrition','Nutrition & hydration','Food, drinks, swallowing, dietary needs and monitoring.'],
  ['medication','Medication support','Prompts, administration, preferences, side effects and escalation.'],
  ['continence','Continence','Toileting routines, continence products, privacy and infection prevention.'],
  ['skin','Skin integrity','Pressure care, skin observations, repositioning and equipment.'],
  ['cognition','Cognition & mental health','Memory, orientation, emotional wellbeing, distress and reassurance.'],
  ['behaviour','Behaviour support','Triggers, early signs, prevention, de-escalation and least-restrictive support.'],
  ['falls','Falls prevention','Falls history, environmental risks, footwear, aids and response.'],
  ['sleep','Sleep & night support','Usual routine, night checks, comfort, safety and sleep preferences.'],
  ['social','Relationships & meaningful activity','Important relationships, community, interests, faith and occupation.']
];


const labels = {
  family: ['Family portal', 'Secure family access, updates and messaging will be introduced in a later milestone.'],
  medication: ['Medication', 'Medication profiles and electronic MAR.'],
  visits: ['Visits', 'Live visits, daily notes, outcomes and evidence of care will be managed here.'],
  rota: ['Rota', 'Scheduling, recurring calls, assignments, travel and availability will be managed here.'],
  tasks: ['Tasks', 'Operational tasks, reminders, ownership and escalation will be managed here.'],
  incidents: ['Incidents', 'Incident reporting, investigation, actions and audit history will be managed here.'],
  finance: ['Finance', 'Invoices, rates, funding arrangements and payment tracking will be built here.'],
  reports: ['Reports', 'Operational, quality, compliance and management reporting will be built here.']
};

let clients = [];
let currentUser = null;
let users = [];
let customRoles = [];
let permissionCatalogue = [];
let selectedClientId = null;
let branches = [];
let organisations = [];
let platformData = null;
let platformPlans = [];
let customerSuccessData = null;
// Shared live-visit state must be initialised before navigation can call loadVisitsBoard().
// Keeping this with the other application state prevents a temporal-dead-zone error during startup.
let visitsData = { visits: [], clients: [], staff: [], codes: [], stats: {} };

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (response.status === 401) {
    showLogin('Your session has expired. Sign in again.');
    throw new Error('Your session has expired.');
  }
  if (!response.ok) throw new Error(payload?.error?.message || 'CoreCare could not complete the request.');
  return payload;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function setDate() {
  pageKicker.textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

function initialsFromName(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'CC';
}

function roleLabel(role) {
  return ({ platform_owner:'Platform owner',platform_admin:'Platform admin',organisation_owner:'Organisation owner',organisation_admin:'Registered manager',branch_manager:'Branch manager',senior_carer:'Senior carer',carer:'Carer',office_staff:'Care coordinator',auditor:'Read-only auditor',family:'Family member',owner:'Organisation owner',manager:'Registered manager' })[role] || 'CoreCare user';
}


const WORKSPACE_CONFIG = {
  manager: {
    label: 'Manager workspace',
    roles: ['organisation_owner','organisation_admin','branch_manager','owner','manager'],
    pages: ['dashboard','operations','clients','staff','family','care','medication','visits','rota','tasks','incidents','finance','reports','settings']
  },
  coordinator: {
    label: 'Care coordinator workspace',
    roles: ['office_staff'],
    pages: ['dashboard','clients','staff','care','visits','rota','tasks','incidents']
  },
  senior: {
    label: 'Senior carer workspace',
    roles: ['senior_carer'],
    pages: ['dashboard','clients','care','medication','visits','tasks','incidents']
  },
  carer: {
    label: 'Carer workspace',
    roles: ['carer'],
    pages: ['dashboard']
  },
  family: {
    label: 'Family workspace',
    roles: ['family'],
    pages: ['dashboard','family']
  },
  auditor: {
    label: 'Audit workspace',
    roles: ['auditor'],
    pages: ['dashboard','operations','clients','staff','care','medication','visits','rota','tasks','incidents','finance','reports']
  }
};

const WORKSPACE_NAVIGATION = {
  manager: [
    ['Overview', [['dashboard','⌂','Organisation dashboard'],['operations','◆','Live operations']]],
    ['People', [['clients','◉','Clients'],['staff','◎','Staff'],['family','◇','Family portal']]],
    ['Care delivery', [['care','▤','Care plans'],['medication','✚','Medication'],['visits','◷','Visits']]],
    ['Operations', [['rota','▦','Rota'],['tasks','✓','Tasks'],['incidents','!','Incidents'],['finance','£','Finance'],['reports','▥','Reports'],['settings','⚙','Settings']]]
  ],
  coordinator: [
    ['Overview', [['dashboard','⌂','Coordinator dashboard']]],
    ['People', [['clients','◉','Clients'],['staff','◎','Staff']]],
    ['Care delivery', [['care','▤','Care plans'],['visits','◷','Visits']]],
    ['Planning', [['rota','▦','Rota'],['tasks','✓','Tasks'],['incidents','!','Incidents']]]
  ],
  senior: [
    ['Overview', [['dashboard','⌂','Senior dashboard']]],
    ['Care delivery', [['clients','◉','Clients'],['care','▤','Care plans'],['medication','✚','Medication'],['visits','◷','Visits']]],
    ['Team responsibilities', [['tasks','✓','Tasks'],['incidents','!','Incidents']]]
  ],
  carer: [
    ['Overview', [['dashboard','⌂','My visits']]]
  ],
  family: [
    ['Overview', [['dashboard','⌂','My relative'],['family','◇','Shared updates']]]
  ],
  auditor: [
    ['Overview', [['dashboard','⌂','Audit dashboard'],['operations','◆','Live operations']]],
    ['Records', [['clients','◉','Clients'],['staff','◎','Staff'],['care','▤','Care plans'],['medication','✚','Medication'],['visits','◷','Visits'],['rota','▦','Rota'],['tasks','✓','Tasks'],['incidents','!','Incidents'],['finance','£','Finance'],['reports','▥','Reports']]]
  ]
};

function moduleAllowsPage(page){
  if(page==='dashboard') return true;
  if(currentUser?.isPlatformUser && currentUser?.supportMode) return true;
  return currentUser?.modules?.[page]===true;
}

function renderWorkspaceNavigation(){
  const container=$('#organisation-navigation');
  if(!container||!currentUser)return;
  const platformWorkspace=isPlatformWorkspace();
  container.hidden=platformWorkspace;
  if(platformWorkspace){container.replaceChildren();return;}
  const key=workspaceKey();
  const groups=WORKSPACE_NAVIGATION[key]||WORKSPACE_NAVIGATION.manager;
  const fragment=document.createDocumentFragment();
  for(const [heading,items] of groups){
    const allowed=items.filter(([page])=>workspaceAllowsPage(page)&&moduleAllowsPage(page));
    if(!allowed.length)continue;
    const section=document.createElement('p');section.className='nav-section';section.textContent=heading;fragment.appendChild(section);
    for(const [page,icon,label] of allowed){
      const button=document.createElement('button');button.type='button';button.className='nav-item';button.dataset.page=page;
      button.innerHTML=`<span>${icon}</span>${escapeHtml(label)}`;
      if(document.querySelector('.page.active-page')?.id===(page==='dashboard'?'dashboard-page':`${page}-page`))button.classList.add('active');
      fragment.appendChild(button);
    }
  }
  container.replaceChildren(fragment);
}

function workspaceKey(){
  if(isPlatformWorkspace()) return 'platform';
  const role=currentUser?.accessLevel||currentUser?.role;
  return Object.entries(WORKSPACE_CONFIG).find(([,config])=>config.roles.includes(role))?.[0]||'manager';
}
function workspaceConfig(){return WORKSPACE_CONFIG[workspaceKey()]||WORKSPACE_CONFIG.manager;}
function workspaceAllowsPage(page){return page==='platform'?isPlatformWorkspace():workspaceConfig().pages.includes(page);}
function dashboardType(){return workspaceKey();}

function updateIdentity() {
  const name = currentUser?.displayName || 'CoreCare user';
  pageTitle.textContent = `Good afternoon, ${name.split(' ')[0]}`;
  $('#user-name').textContent = name;
  $('#user-role').textContent = roleLabel(currentUser?.accessLevel || currentUser?.role);
  $('#user-avatar').textContent = initialsFromName(name);
  $('#organisation-name').textContent = `${currentUser?.organisationName || 'Organisation'}${currentUser?.branchName ? ' · '+currentUser.branchName : ''}`;
  const platformUser = Boolean(currentUser?.isPlatformUser);
  const platformWorkspace = platformUser && !currentUser?.supportMode;
  const platformNavigation = $('#platform-navigation');
  if (platformNavigation) platformNavigation.hidden = !platformWorkspace;
  renderWorkspaceNavigation();
  $$('.organisation-workspace-action').forEach(item => item.hidden = platformWorkspace || !['manager','coordinator'].includes(workspaceKey()));
  const supportBanner=$('#support-mode-banner');
  if(supportBanner){
    const inSupport=platformUser&&currentUser?.supportMode;
    supportBanner.hidden=!inSupport;
    if(inSupport){
      $('#support-mode-org').textContent=currentUser?.organisationName||'organisation';
      $('#support-mode-user').textContent=currentUser?.displayName||'Platform user';
      $('#support-mode-access').textContent=currentUser?.supportAccessMode==='read_only'?'Read-only support':'Full support';
      $('#support-mode-reason').textContent=currentUser?.supportReason||'Support request';
      $('#support-mode-started').textContent=currentUser?.supportStartedAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${currentUser.supportStartedAt}Z`)):'Now';
    }
  }
  document.body.classList.toggle('platform-workspace', platformWorkspace);
  document.body.dataset.workspace=platformWorkspace?'platform':workspaceKey();
  const workspaceBadge=$('#workspace-label'); if(workspaceBadge) workspaceBadge.textContent=platformWorkspace?'Platform workspace':workspaceConfig().label;
}

const CORECARE_FALLBACK_VERSION = '1.11.0';

async function loadApplicationVersion() {
  let version = CORECARE_FALLBACK_VERSION;
  try {
    const payload = await api('/api/version');
    version = payload.version || version;
  } catch (error) {
    console.warn('CoreCare version endpoint unavailable', error);
  }
  $$('[data-app-version]').forEach(node => node.textContent = version);
  if ($('#dev-version')) $('#dev-version').textContent = `v${version}`;
}

const platformViewMeta = {
  'platform-page': { title: 'Executive dashboard', kicker: 'CoreCare owners & support' },
  'support-ticket-centre': { title: 'Support tickets', kicker: 'Support' },
  'support-session-centre': { title: 'Active support sessions', kicker: 'Support' },
  'product-monitor-centre': { title: 'Product monitoring', kicker: 'Products' },
  'platform-team-centre': { title: 'Platform owners & staff', kicker: 'Administration' },
  'platform-audit-centre': { title: 'Audit log', kicker: 'Administration' },
  'platform-settings-centre': { title: 'Platform settings', kicker: 'Administration' },
  'platform-notification-centre': { title: 'Notifications', kicker: 'Operations' },
  'revenue-centre': { title: 'Revenue centre', kicker: 'Commercial' }
};

const platformDedicatedTargets = [
  'support-ticket-centre','support-session-centre','product-monitor-centre','platform-team-centre','platform-audit-centre','platform-settings-centre','platform-notification-centre','revenue-centre'
];

function initialisePlatformViews() {
  const platformPage = document.getElementById('platform-page');
  if (!platformPage || platformPage.querySelector(':scope > .platform-view-host')) return;

  const host = document.createElement('div');
  host.className = 'platform-view-host';
  platformPage.appendChild(host);

  platformDedicatedTargets.forEach(id => {
    const node = document.getElementById(id);
    if (!node) return;
    const shell = document.createElement('section');
    shell.className = 'platform-dedicated-view';
    shell.dataset.platformView = id;
    shell.hidden = true;
    host.appendChild(shell);
    shell.appendChild(node);
    node.hidden = false;
    if (node.tagName === 'DETAILS') node.open = true;
  });
}

function showPlatformView(targetId = 'platform-page', updateHistory = true) {
  initialisePlatformViews();
  const platformPage = document.getElementById('platform-page');
  if (!platformPage) return;

  const commandChildren = Array.from(platformPage.children).filter(node =>
    node.classList.contains('executive-hero') || node.classList.contains('executive-kpis') || node.classList.contains('executive-grid')
  );
  commandChildren.forEach(node => node.hidden = targetId !== 'platform-page');

  const shells = Array.from(platformPage.querySelectorAll(':scope > .platform-view-host > .platform-dedicated-view'));
  shells.forEach(shell => { shell.hidden = shell.dataset.platformView !== targetId; });

  if (targetId !== 'platform-page' && !shells.some(shell => shell.dataset.platformView === targetId)) {
    targetId = 'platform-page';
    commandChildren.forEach(node => node.hidden = false);
  }

  const meta = platformViewMeta[targetId] || platformViewMeta['platform-page'];
  if (pageTitle) pageTitle.textContent = meta.title;
  if ($('#page-kicker')) $('#page-kicker').textContent = meta.kicker;
  $$('[data-platform-target]').forEach(button => button.classList.toggle('active', button.dataset.platformTarget === targetId));
  platformPage.dataset.activePlatformView = targetId;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (targetId !== 'platform-page') loadSimplifiedPortal(targetId).catch(showToastError);
  else loadExecutiveIncidents().catch(showToastError);
    if (updateHistory) history.pushState({ platformView: targetId }, '', targetId === 'platform-page' ? '#platform' : `#${targetId}`);
}

async function showApplication(user) {
  currentUser = user || currentUser;
  if (APP_EDITION === 'platform' && !currentUser?.isPlatformUser) {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    showLogin('CoreCare Platform is restricted to authorised platform administrators. Use CoreCare Care for organisation access.');
    return;
  }
  loginView.hidden = true;
  appView.hidden = false;
  setDate();
  updateIdentity();
  applyAccessVisibility();
  await loadApplicationVersion();
  if (currentUser?.mustChangePassword) {
    showPage('dashboard');
    setTimeout(() => openPasswordDialog(true), 50);
    return;
  }
  const platformWorkspace = currentUser?.isPlatformUser && !currentUser?.supportMode;
  if (platformWorkspace) {
    $$('.nav-item').forEach(item => item.classList.remove('active'));
    $('#platform-nav')?.classList.add('active');
    showPage('platform');
    showPlatformView(location.hash && location.hash !== '#platform' ? location.hash.slice(1) : 'platform-page', false);
  } else {
    const type=dashboardType();
    const jobs=[];
    if(['carer','senior'].includes(type)) jobs.push(loadCarerDashboard(type));
    else if(type==='family') jobs.push(loadFamilyDashboard());
    else if(type==='coordinator') jobs.push(loadCoordinatorDashboard());
    else jobs.push(loadManagerDashboard());
    if(!['carer','family'].includes(type)&&hasAccess('clients.view'))jobs.push(loadClients());
    if(['manager','coordinator','senior','auditor'].includes(type)&&hasAccess('staff.view'))jobs.push(loadStaff());
    await Promise.all(jobs);
    if(hasAccess('clients.view')&&!['carer','family'].includes(type))renderClients();
    if(hasAccess('staff.view')&&['manager','coordinator','senior','auditor'].includes(type))renderStaff();
    await loadDevelopmentStatus();
    showPage(canOpenPage('dashboard')?'dashboard':workspaceConfig().pages.find(canOpenPage)||'dashboard');
  }
  $('#main-content').focus();
}


function isPlatformWorkspace(){
  return Boolean(currentUser?.isPlatformUser && !currentUser?.supportMode);
}

function applyAccessVisibility(){
  if(!currentUser)return;
  renderWorkspaceNavigation();
  const platformWorkspace=isPlatformWorkspace();
  $$('.organisation-workspace-action').forEach(node=>{node.hidden=platformWorkspace || !['manager','coordinator'].includes(workspaceKey());});
  const visibility={
    '#add-client':'clients.create','#add-staff':'staff.create','#edit-profile-client':'clients.edit','#archive-profile-client':'clients.archive'
  };
  Object.entries(visibility).forEach(([selector,permission])=>{const node=$(selector);if(node)node.hidden=!hasAccess(permission);});
  $$('.quick-action[data-quick="client"]').forEach(node=>node.hidden=!hasAccess('clients.create'));
  $$('.quick-action[data-quick="staff"]').forEach(node=>node.hidden=!hasAccess('staff.create'));
}

function hasAccess(permission){return Boolean(currentUser?.isPlatformUser||(currentUser?.permissions||[]).includes(permission));}
function canOpenPage(page){
  if(currentUser?.isPlatformUser){
    if(isPlatformWorkspace()) return page==='platform';
    if(currentUser?.supportMode) return workspaceAllowsPage(page);
  }
  if(!isPlatformWorkspace() && page==='dashboard' && workspaceAllowsPage(page)) return true;
  return Boolean(!isPlatformWorkspace()&&workspaceAllowsPage(page)&&(currentUser?.modules||{})[page]===true);
}
function denyPage(){showToastError(new Error('You do not have permission to view this area.'));}

function showLogin(message = '') {
  currentUser = null;
  appView.hidden = true;
  loginView.hidden = false;
  if (message) {
    loginError.textContent = message;
    loginError.hidden = false;
  }
  $('#email').focus();
}

async function restoreSession() {
  try {
    const payload = await api('/api/auth/session');
    await showApplication(payload.user);
  } catch {
    showLogin();
  }
}

function activatePage(id) {
  pages.forEach(page => page.classList.remove('active-page'));
  const page = $(id);
  if (!page) throw new Error(`CoreCare page is unavailable: ${id}`);
  page.classList.add('active-page');
}

function setActiveWorkspaceNavigation(page){
  $$('#organisation-navigation .nav-item').forEach(item=>item.classList.toggle('active',item.dataset.page===page));
}

function showPage(page) {
  if(isPlatformWorkspace() && page!=='platform'){
    showToastError(new Error('Open an organisation through an authorised support session before accessing organisation records.'));
    showPage('platform');
    return;
  }
  if(page!=='platform'&&page!=='client-profile'&&!canOpenPage(page)){denyPage();return;}
  selectedClientId = page === 'client-profile' ? selectedClientId : null;
  if(page!=='client-profile')setActiveWorkspaceNavigation(page);
  if (page === 'platform') {
    if (!currentUser?.isPlatformUser) return showPage('dashboard');
    activatePage('#platform-page');
    pageKicker.textContent = 'Platform owner';
    pageTitle.textContent = 'Platform administration';
    loadPlatformWorkspace().catch(showToastError);
    return;
  }
  if (page === 'rota') {
    activatePage('#rota-page');
    loadRotaBoard();
    return;
  }
  if (page === 'medication') {
    activatePage('#medication-page'); pageKicker.textContent='Care delivery'; pageTitle.textContent='Medication'; loadMedicationModule().catch(showToastError); return;
  }
  if (page === 'visits') {
    activatePage('#visits-page');
    pageKicker.textContent = 'Electronic call monitoring';
    pageTitle.textContent = 'Visits';
    loadVisitsBoard().catch(showToastError);
    return;
  }
  if (page === 'operations') {
    activatePage('#operations-page');
    pageKicker.textContent = 'Care delivery';
    pageTitle.textContent = 'Live Operations Board';
    loadOperationsBoard().catch(showToastError);
    return;
  }
  if (page === 'dashboard') {
    activatePage('#dashboard-page');
    const type=dashboardType();
    if(type==='coordinator')loadCoordinatorDashboard().catch(showToastError);
    else if(type==='family')loadFamilyDashboard().catch(showToastError);
    else if(['carer','senior'].includes(type))loadCarerDashboard(type).catch(showToastError);
    else loadManagerDashboard().catch(showToastError);
    setDate();
    updateIdentity();
    return;
  }
  if (page === 'clients') {
    activatePage('#clients-page');
    pageKicker.textContent = 'People';
    pageTitle.textContent = 'Clients';
    loadClients().then(renderClients).catch(showToastError);
    return;
  }
  if (page === 'staff') {
    activatePage('#staff-page');
    pageKicker.textContent = 'Workforce';
    pageTitle.textContent = 'Staff';
    loadStaff().then(renderStaff).catch(showToastError);
    return;
  }
  if (page === 'care') {
    activatePage('#care-page');
    pageKicker.textContent = 'Care delivery';
    pageTitle.textContent = 'Care plans';
    Promise.all([loadAllCarePlans(),loadCareDeliveryDashboard()]).catch(showToastError);
    return;
  }
  if (page === 'settings') {
    activatePage('#settings-page');
    pageKicker.textContent = 'Administration';
    pageTitle.textContent = 'Settings';
    loadSettings();
    return;
  }
  activatePage('#placeholder-page');
  const [title, copy] = labels[page] || ['Module', 'This CoreCare module is planned for a future build.'];
  $('#placeholder-title').textContent = title;
  $('#placeholder-copy').textContent = copy;
  pageKicker.textContent = 'CoreCare module';
  pageTitle.textContent = title;
}

async function loadDevelopmentStatus() {
  try {
    const status = await api('/api/development/status');
    $('#dev-db').textContent = status.database.connected ? 'Connected' : 'Not connected';
    $('#dev-auth').textContent = status.authentication.mode;
    $('#dev-user').textContent = status.user.email;
    $('#dev-org').textContent = status.organisation.name;
    $('#dev-version').textContent = `v${status.deployment.version}`;
    $('#dev-checked').textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(status.deployment.checkedAt));
  } catch {
    $('#dev-db').textContent = 'Unavailable';
  }
}



async function loadPlatformWorkspace(){
  const modules = [
    ['Executive dashboard', '#executive-greeting', loadPlatformDashboard],
    ['Revenue Centre', '#revenue-centre', loadRevenueCentre],
    ['Customer Success Centre', '#customer-success-centre', loadCustomerSuccess],
    ['Notifications', '#platform-notifications', loadPlatformNotifications],
    ['AI Executive Assistant', '#platform-ai-assistant', loadAiAssistantHistory],
    ['Platform health', '#platform-health', loadPlatformHealth],
    ['Plans', '#platform-plans', loadPlatformPlans],
    ['Audit', '#platform-audit-table', loadPlatformAudit],
    ['Platform users', '#platform-users', loadPlatformUsers]
  ];
  const results = await Promise.allSettled(
    modules.filter(([, selector]) => Boolean($(selector))).map(async ([name,, loader]) => {
      try { await loader(); }
      catch (error) { error.message = `${name}: ${error.message}`; throw error; }
    })
  );
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    console.error('CoreCare platform module failures', failures.map(x => x.reason));
    showToastError(new Error(failures.map(x => x.reason?.message || 'Module failed').join(' · ')));
  }
}

async function loadPlatformDashboard(){
  const payload=await api('/api/platform/dashboard');
  platformData=payload;
  const s=payload.summary||{}, f=payload.financials||{}, c=payload.customerSuccess||{};
  const money=pence=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(pence||0)/100);
  const hour=new Date().getHours(), greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  $('#executive-greeting').textContent=`${greeting}, ${currentUser?.displayName?.split(' ')[0]||'Christopher'}`;
  $('#executive-briefing').textContent=payload.briefing?.headline||'Your CoreCare platform is ready.';
  $('#executive-mrr').textContent=money(f.mrrPence); $('#executive-arr').textContent=money(f.arrPence);
  $('#platform-org-count').textContent=s.organisations||0; $('#platform-active-orgs').textContent=s.activeOrganisations||0; $('#platform-suspended-orgs').textContent=s.suspendedOrganisations||0;
  $('#platform-user-count').textContent=s.users||0; $('#executive-active-users').textContent=s.activeUsers30d||0;
  $('#executive-customer-health').textContent=`${Math.round(c.averageHealth||0)}%`; $('#executive-attention-count').textContent=c.needsAttention||0;
  $('#executive-renewals-count').textContent=(payload.renewals||[]).length;
  $('#executive-health-score').textContent=(payload.operations?.overall||'Healthy'); $('#executive-health-copy').textContent=`${payload.operations?.errors24h||0} errors in the last 24 hours`;
  $('#executive-brief-list').innerHTML=(payload.briefing?.items||[]).map(x=>`<div class="brief-item ${escapeHtml(x.tone||'neutral')}"><span>${escapeHtml(x.icon||'•')}</span><div><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.detail||'')}</small></div></div>`).join('')||'<p class="muted">No briefing items.</p>';
  $('#executive-risk-badge').textContent=c.needsAttention||0;
  $('#executive-risk-list').innerHTML=(payload.atRiskOrganisations||[]).map(o=>`<div class="platform-result"><div><strong>${escapeHtml(o.name)}</strong><small>${escapeHtml(o.reason)} · Health ${o.health_score}%</small></div><button class="row-action" data-platform-manage-org="${escapeHtml(o.id)}">Review</button></div>`).join('')||'<p class="muted">No organisations currently need attention.</p>';
  $('#executive-renewals').innerHTML=(payload.renewals||[]).map(o=>`<div class="platform-result"><div><strong>${escapeHtml(o.name)}</strong><small>${escapeHtml(o.plan_name||o.subscription_plan)} · ${escapeHtml(o.renewal_date)}</small></div><span class="badge neutral">${o.days_until} days</span></div>`).join('')||'<p class="muted">No renewals in the next 30 days.</p>';
  $('#platform-activity').innerHTML=(payload.activity||[]).map(event=>`<div><span class="timeline-dot"></span><div><strong>${escapeHtml((event.action||'activity').replaceAll('.',' '))}</strong><p>${escapeHtml(event.organisation_name||'Organisation')} · ${escapeHtml(event.user_name||'System')}</p><time>${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${event.created_at}Z`))}</time></div></div>`).join('')||'<div><p>No platform activity yet.</p></div>';
  renderPlatformOrganisations();
  $$('[data-platform-manage-org]').forEach(button=>button.addEventListener('click',()=>managePlatformOrganisation(button.dataset.platformManageOrg)));
}


let revenueData=null;
const formatRevenueMoney=pence=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(pence||0)/100);
async function loadRevenueCentre(){
  if (!$('#revenue-centre')) return;
  const p=await api('/api/platform/revenue'); revenueData=p; const m=p.metrics||{};
  $('#revenue-mrr').textContent=formatRevenueMoney(m.mrrPence); $('#revenue-arr').textContent=formatRevenueMoney(m.arrPence); $('#revenue-new-mrr').textContent=formatRevenueMoney(m.newMrrPence); $('#revenue-lost-mrr').textContent=formatRevenueMoney(m.lostMrrPence); $('#revenue-arpo').textContent=formatRevenueMoney(m.averageRevenuePence); $('#revenue-renewal-value').textContent=formatRevenueMoney(m.renewal90Pence);
  const trend=p.trend||[], max=Math.max(1,...trend.map(x=>Number(x.mrrPence||0)));
  $('#revenue-trend').innerHTML=trend.map(x=>`<div class="revenue-bar-column"><div class="revenue-bar-value">${formatRevenueMoney(x.mrrPence)}</div><div class="revenue-bar-track"><div class="revenue-bar" style="height:${Math.max(4,Math.round(Number(x.mrrPence||0)/max*100))}%"></div></div><strong>${escapeHtml(x.label)}</strong><small>${x.organisations} org${x.organisations===1?'':'s'}</small></div>`).join('');
  const total=Math.max(1,Number(m.mrrPence||0)); $('#revenue-plan-mix').innerHTML=(p.planBreakdown||[]).map(x=>`<div class="plan-mix-row"><div><strong>${escapeHtml(x.name)}</strong><small>${x.organisations} organisation${x.organisations===1?'':'s'} · ${formatRevenueMoney(x.mrrPence)}</small></div><div class="mix-track"><span style="width:${Math.round(Number(x.mrrPence||0)/total*100)}%"></span></div></div>`).join('')||'<p class="muted">No billable plans yet.</p>';
  $('#revenue-renewals').innerHTML=(p.renewals||[]).map(o=>`<tr><td><strong>${escapeHtml(o.name)}</strong></td><td>${escapeHtml(o.plan_name||o.subscription_plan||'Unassigned')}</td><td>${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(`${o.renewal_date}T00:00:00Z`))}</td><td><span class="badge ${o.daysUntil<=30?'warning':'neutral'}">${o.daysUntil}</span></td><td>${formatRevenueMoney(o.monthly_price_pence)}</td></tr>`).join('')||'<tr><td colspan="5">No upcoming renewals recorded.</td></tr>';
  $('#revenue-commercial-summary').innerHTML=[['Billable organisations',m.billableOrganisations||0],['Net MRR movement',formatRevenueMoney(m.netMovementPence)],['Renewals within 30 days',formatRevenueMoney(m.renewal30Pence)],['Renewals within 90 days',formatRevenueMoney(m.renewal90Pence)],['Last calculated',new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(p.generatedAt))]].map(([k,v])=>`<div class="health-item"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
}
function exportRevenueCsv(){if(!revenueData)return;const lines=[['Organisation','Status','Subscription status','Plan','Monthly revenue','Renewal date'],...(revenueData.organisations||[]).map(o=>[o.name,o.status,o.subscription_status||'',o.plan_name||o.subscription_plan||'',(Number(o.monthly_price_pence||0)/100).toFixed(2),o.renewal_date||''])];const csv=lines.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`corecare-revenue-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);}



async function loadCustomerSuccess(){
  if (!$('#customer-success-centre')) return;
  const p=await api('/api/platform/customer-success');customerSuccessData=p;const s=p.summary||{};
  $('#success-average').textContent=`${s.averageHealth||0}%`;$('#success-healthy').textContent=s.healthy||0;$('#success-attention').textContent=s.attention||0;$('#success-risk').textContent=s.risk||0;$('#success-adoption').textContent=`${s.averageAdoption||0}%`;
  renderCustomerSuccess();
}
function renderCustomerSuccess(){
  if(!customerSuccessData)return;const filter=$('#success-filter')?.value||'all';const rows=(customerSuccessData.organisations||[]).filter(o=>filter==='all'||o.health_band===filter);
  $('#success-table').innerHTML=rows.map(o=>`<tr><td><strong>${escapeHtml(o.name)}</strong><small>${escapeHtml(o.plan_name||'Unassigned')}</small></td><td><span class="health-score ${o.health_band}">${o.health_score}%</span></td><td><span class="trend ${o.trend}">${o.trend==='up'?'↑ Improving':o.trend==='down'?'↓ Declining':'→ Stable'}</span></td><td>${o.adoption_score}%<small>${o.active_users_30d||0}/${o.user_count||0} active</small></td><td>${o.days_inactive>365?'Never':o.days_inactive+' days ago'}</td><td>${o.support_90d||0} / 90d</td><td><button class="row-action" data-success-org="${escapeHtml(o.id)}">Review</button></td></tr>`).join('')||'<tr><td colspan="7">No organisations match this filter.</td></tr>';
  $$('[data-success-org]').forEach(b=>b.addEventListener('click',()=>showCustomerSuccessDetail(b.dataset.successOrg)));
  if(rows[0])showCustomerSuccessDetail(rows[0].id);
}
function showCustomerSuccessDetail(id){const o=(customerSuccessData?.organisations||[]).find(x=>x.id===id);if(!o)return;$('#success-detail').innerHTML=`<div class="success-detail-head"><div><strong>${escapeHtml(o.name)}</strong><span class="health-score ${o.health_band}">${o.health_score}%</span></div><small>${escapeHtml(o.plan_name||'Unassigned')} · ${o.client_count||0} clients · ${o.branch_count||0} branches</small></div><h4>Risk signals</h4><ul>${(o.reasons||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>No immediate risk signals.</li>'}</ul><h4>Success recommendations</h4><ol>${(o.recommendations||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol><h4>Module adoption</h4><div class="module-tags">${(o.module_usage||[]).map(x=>`<span>${escapeHtml(x.name)} <b>${x.count}</b></span>`).join('')||'<span>No recent module activity</span>'}</div><button class="primary-button compact" data-platform-manage-org="${escapeHtml(o.id)}">Open Organisation 360</button>`;$('#success-detail [data-platform-manage-org]')?.addEventListener('click',()=>managePlatformOrganisation(o.id));}

async function loadPlatformNotifications(){const p=await api('/api/platform/notifications');const rows=p.notifications||[];$('#platform-notification-count').textContent=rows.length;$('#platform-notifications').innerHTML=rows.slice(0,8).map(n=>`<div class="platform-result ${escapeHtml(n.type||'')}"><div><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.message||'')}</small></div></div>`).join('')||'<p class="muted">No platform alerts.</p>';}
async function loadPlatformHealth(){
  const h=await api('/api/platform/system-health');
  const tone=status=>status==='critical'||status==='failed'?'danger':status==='warning'||status==='Monitoring'?'warning':'success';
  const fmtDate=value=>value?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${value}${String(value).endsWith('Z')?'':'Z'}`)):'Never';
  setText('#platform-health-badge',h.overall||'Healthy');
  const badge=$('#platform-health-badge'); if(badge) badge.className=`badge ${tone(h.overall)}`;
  setText('#ops-overall',h.overall||'Healthy');
  setText('#ops-checked',`Checked ${new Intl.DateTimeFormat('en-GB',{timeStyle:'short'}).format(new Date(h.checkedAt))}`);
  setText('#ops-sessions',h.activeSessions||0); setText('#ops-users-online',`${h.recentUsers||0} users active in the last 30 minutes`);
  setText('#ops-errors',h.errors24h||0); setText('#ops-error-rate',h.errors24h?`${h.errors24h} captured failures`:'No failures recorded');
  setText('#ops-audit',h.auditEvents24h||0); setText('#ops-audit-rate','Recorded platform activity');
  setText('#ops-support',h.supportSessions24h||0); setText('#ops-support-active',`${h.activeSupportSessions||0} currently active`);
  setText('#ops-job-health',`${h.jobSummary?.healthy||0}/${h.jobSummary?.total||0}`); setText('#ops-job-note',h.jobSummary?.failed?`${h.jobSummary.failed} failed job${h.jobSummary.failed===1?'':'s'}`:'Scheduled automation healthy');
  const health=$('#platform-health'); if(health) health.innerHTML=(h.services||[]).map(service=>`<div class="service-status ${tone(service.status)}"><span class="service-dot"></span><div><strong>${escapeHtml(service.name)}</strong><small>${escapeHtml(service.detail||'')}</small></div><b>${escapeHtml(service.status)}</b></div>`).join('')||'<p class="muted">No service status available.</p>';
  const alerts=h.alerts||[]; setText('#ops-alert-count',alerts.length);
  const alertCount=$('#ops-alert-count'); if(alertCount) alertCount.className=`badge ${alerts.some(x=>x.severity==='critical')?'danger':alerts.length?'warning':'success'}`;
  const alertList=$('#ops-alerts'); if(alertList) alertList.innerHTML=alerts.map(x=>`<div class="operations-row alert ${tone(x.severity)}"><span class="operations-icon">${x.severity==='critical'?'!':x.severity==='warning'?'△':'✓'}</span><div><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.description||'')} ${x.source?'· '+escapeHtml(x.source):''}</small></div></div>`).join('')||'<div class="operations-empty"><strong>No operational alerts</strong><span>All monitored services are operating normally.</span></div>';
  const jobs=$('#ops-jobs'); if(jobs) jobs.innerHTML=(h.jobs||[]).map(job=>`<tr><td><strong>${escapeHtml(job.name)}</strong><small class="table-subtext">${escapeHtml(job.description||'')}</small></td><td>${escapeHtml(job.schedule_label||'')}</td><td><span class="badge ${tone(job.status)}">${escapeHtml(job.status)}</span></td><td>${fmtDate(job.last_run_at)}${job.last_result?`<small class="table-subtext">${escapeHtml(job.last_result)}</small>`:''}</td><td>${fmtDate(job.next_run_at)}</td><td>${job.duration_ms?`${Number(job.duration_ms).toLocaleString('en-GB')} ms`:'—'}</td></tr>`).join('')||'<tr><td colspan="6">No scheduled jobs configured.</td></tr>';
  const errors=$('#ops-error-list'); if(errors) errors.innerHTML=(h.recentErrors||[]).map(x=>`<div class="operations-row"><span class="operations-icon danger">!</span><div><strong>${escapeHtml(`${x.method||''} ${x.route||'Unknown route'}`)}</strong><small>${escapeHtml(x.error_message||'Unknown error')} · ${escapeHtml(x.organisation_name||'Platform')} · ${fmtDate(x.created_at)}</small></div></div>`).join('')||'<div class="operations-empty"><strong>No recent errors</strong><span>No API errors have been recorded.</span></div>';
  const support=$('#ops-support-list'); if(support) support.innerHTML=(h.supportActivity||[]).map(x=>`<div class="operations-row"><span class="operations-icon">◆</span><div><strong>${escapeHtml(x.organisation_name||'Organisation')}</strong><small>${escapeHtml(x.platform_user_name||'Platform user')} · ${escapeHtml(x.reason||'Support')} · ${escapeHtml(x.access_mode||'full')} · ${fmtDate(x.started_at)}</small></div><span class="badge ${x.ended_at?'neutral':'success'}">${x.ended_at?'Ended':'Active'}</span></div>`).join('')||'<div class="operations-empty"><strong>No support activity</strong><span>No recent support sessions recorded.</span></div>';
  const chart=$('#ops-activity-chart'); if(chart){const points=h.activity||[],max=Math.max(1,...points.map(x=>Math.max(Number(x.audit||0),Number(x.errors||0))));chart.innerHTML=points.map((x,i)=>`<div class="operations-bar-group" title="${escapeHtml(x.label)} · ${x.audit||0} audit · ${x.errors||0} errors"><div class="operations-bars"><i class="audit" style="height:${Math.max(3,Math.round(Number(x.audit||0)/max*100))}%"></i><i class="errors" style="height:${Math.max(0,Math.round(Number(x.errors||0)/max*100))}%"></i></div>${i%3===0?`<small>${escapeHtml(x.label)}</small>`:'<small></small>'}</div>`).join('');}
}
function populateSubscriptionPlanSelects(){
  const active=platformPlans.filter(plan=>plan.status==='active');
  for(const selector of ['#organisation-plan-select','#product-organisation-plan']){
    const select=$(selector);if(!select)continue;const current=select.value;
    select.innerHTML=active.map(plan=>`<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} — ${Number(plan.monthly_price_pence||0)===0?'Internal':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(plan.monthly_price_pence)/100)+'/month'}</option>`).join('');
    select.value=active.some(plan=>plan.id===current)?current:(active.some(plan=>plan.id==='limited')?'limited':active[0]?.id||'');
  }
}
async function loadPlatformPlans(){const p=await api('/api/platform/plans');platformPlans=p.plans||[];populateSubscriptionPlanSelects();const commercial=platformPlans.filter(x=>x.status==='active'&&x.id!=='development');$('#platform-plans').innerHTML=commercial.map(x=>`<div class="plan-row"><div><strong>${escapeHtml(x.name)}</strong><small>${x.max_users??'Unlimited'} users · ${x.max_clients??'Unlimited'} clients</small></div><span class="plan-price">${Number(x.monthly_price_pence||0)===0?'Free':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(x.monthly_price_pence)/100)+'/mo'}</span></div>`).join('')||'<p class="muted">No commercial plans configured.</p>';}
async function loadPlatformAudit(){const p=await api('/api/platform/audit?limit=50');$('#platform-audit-table').innerHTML=(p.events||[]).map(e=>`<tr><td>${new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short'}).format(new Date(`${e.created_at}Z`))}</td><td>${escapeHtml(e.organisation_name||'')}</td><td>${escapeHtml(e.user_name||'System')}</td><td>${escapeHtml((e.action||'').replaceAll('.',' '))}</td><td>${escapeHtml(e.entity_type||'')}</td></tr>`).join('')||'<tr><td colspan="5">No audit activity.</td></tr>';}
async function loadPlatformUsers(){const p=await api('/api/platform/users');$('#platform-users').innerHTML=(p.users||[]).map(u=>`<div class="platform-result"><div><strong>${escapeHtml(u.display_name)}</strong><small>${escapeHtml(u.email)} · ${escapeHtml(roleLabel(u.access_level))}</small></div><span class="badge ${u.status==='active'?'success':'neutral'}">${escapeHtml(u.status)}</span></div>`).join('')||'<p class="muted">No platform users.</p>';}
let platformSearchTimer;
async function runPlatformSearch(){const q=$('#platform-global-search')?.value.trim()||'';if(q.length<2){$('#platform-search-results').innerHTML='<p class="muted">Enter at least 2 characters.</p>';return;}const p=await api(`/api/platform/search?q=${encodeURIComponent(q)}`);$('#platform-search-results').innerHTML=(p.results||[]).map(r=>`<div class="platform-result"><div><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.type)} · ${escapeHtml(r.organisation_name)}${r.branch_name?' · '+escapeHtml(r.branch_name):''}</small></div><button class="row-action" data-search-open-org="${escapeHtml(r.organisation_id)}">Open organisation</button></div>`).join('')||'<p class="muted">No matching records.</p>';$$('[data-search-open-org]').forEach(b=>b.addEventListener('click',()=>openPlatformOrganisation(b.dataset.searchOpenOrg)));}

function renderPlatformOrganisations(){
  const query=($('#platform-org-search')?.value||'').trim().toLowerCase();
  const status=$('#platform-org-status')?.value||'current';
  const source=status==='archived'?(platformData?.archivedOrganisations||[]):(platformData?.organisations||[]);
  const rows=source.filter(o=>(status==='current'||status==='archived'||o.status===status)&&`${o.name} ${o.subscription_plan}`.toLowerCase().includes(query));
  $('#platform-org-empty').hidden=rows.length>0;
  const money=p=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(p||0)/100);
  const usage=(value,label)=>{const state=value||{},limit=state.limit==null?'∞':state.limit,tone=['at_limit','over_limit'].includes(state.status)?'danger':state.status==='near_limit'?'warning':'neutral';return `<span class="subscription-usage ${tone}">${Number(state.used||0)}/${limit}</span><small>${escapeHtml(label)}</small>`};
  $('#platform-org-table').innerHTML=rows.map(o=>`<tr><td><strong>${escapeHtml(o.name)}</strong><div class="organisation-meta"><small class="table-subtext">${escapeHtml(o.slug||'')}</small><span class="status-chip ${o.status==='active'?'active':o.status==='archived'?'archived':'suspended'}">${escapeHtml(o.status||'active')}</span></div></td><td>${escapeHtml(o.plan_name||o.subscription_plan||'Development')}</td><td>${money(o.monthly_price_pence)}</td><td><span class="health-score ${o.health_score<60?'danger':o.health_score<80?'warning':'success'}">${o.health_score}%</span></td><td>${usage(o.subscription_usage?.users,'users')}</td><td>${usage(o.subscription_usage?.clients,'clients')}</td><td>${o.last_activity_at?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(`${o.last_activity_at}Z`)):'No activity'}</td><td><div class="row-actions"><button class="row-action" data-platform-manage-org="${escapeHtml(o.id)}">360°</button>${o.status==='active'?`<button class="row-action" data-platform-open-org="${escapeHtml(o.id)}">Support</button>`:''}</div></td></tr>`).join('');
  $$('[data-platform-open-org]').forEach(button=>button.addEventListener('click',()=>openPlatformOrganisation(button.dataset.platformOpenOrg)));
  $$('[data-platform-manage-org]').forEach(button=>button.addEventListener('click',()=>managePlatformOrganisation(button.dataset.platformManageOrg)));
}
let selectedPlatformOrganisationId=null;
async function openPlatformOrganisation(organisationId,accessMode='full'){
  const row=[...(platformData?.organisations||[]),...(platformData?.archivedOrganisations||[])].find(o=>o.id===organisationId);
  if(row?.status!=='active'){showToast('Restore or reactivate this organisation before entering support mode.');return;}
  const reason=prompt(`Enter the reason for accessing ${row?.name||'this organisation'}:`,'Customer support request');
  if(!reason) return;
  await api('/api/platform/switch-organisation',{method:'POST',body:JSON.stringify({organisationId,reason,accessMode})});
  location.reload();
}
async function managePlatformOrganisation(organisationId){
  const dialog=$('#platform-organisation-dialog'), profileName=$('#platform-org-profile-name'), profileContent=$('#platform-org-profile-content');
  if(!dialog||!profileName||!profileContent) throw new Error('Organisation 360 is unavailable in this deployment. Refresh the browser after deploying the latest public assets.');
  selectedPlatformOrganisationId=organisationId;
  const [p,billing]=await Promise.all([api(`/api/platform/organisations/${encodeURIComponent(organisationId)}`),api('/api/platform/billing')]),o=p.organisation;
  p.billing=billing;
  profileName.textContent=o.name;
  const flags=Object.entries(o.featureFlags||{}).filter(([,v])=>v).map(([k])=>k.replaceAll('_',' '));
  const healthTone=o.health_score<60?'danger':o.health_score<80?'warning':'success';
  const userUsage=o.subscription_usage?.users||{},clientUsage=o.subscription_usage?.clients||{};
  const usagePct=Math.min(100,Number(userUsage.percentage||0)),clientPct=Math.min(100,Number(clientUsage.percentage||0));
  const formatMoney=pence=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(pence||0)/100);
  const planOptions=(p.plans||[]).map(plan=>`<option value="${escapeHtml(plan.id)}" ${plan.id===o.subscription_plan?'selected':''}>${escapeHtml(plan.name)} — ${plan.max_users??'Unlimited'} users / ${plan.max_clients??'Unlimited'} clients</option>`).join('');
  const billingMode=billing.mode==='live'?'Live payments':billing.mode==='test'?'Test mode':'Not connected',billingTone=billing.mode==='live'?'success':billing.mode==='test'?'warning':'neutral';
  const selectedStripePlan=(billing.plans||[]).find(plan=>plan.id===o.subscription_plan),canStartCheckout=billing.catalogueReady&&Boolean(selectedStripePlan?.stripe_price_id)&&!o.stripe_subscription_id;
  const stripeActions=p.canManage?`${!billing.secretConfigured?'<p class="form-error">Add the Stripe test secret to Cloudflare before using billing.</p>':''}${billing.secretConfigured&&!billing.catalogueReady?'<button class="primary-button compact" type="button" data-stripe-catalogue>Connect £50 and £150 plans</button>':''}${canStartCheckout?'<button class="primary-button compact" type="button" data-stripe-checkout>Open secure Stripe Checkout</button>':''}${o.stripe_customer_id?'<button class="secondary-button compact" type="button" data-stripe-portal>Open billing portal</button>':''}${o.stripe_subscription_id?'<button class="secondary-button compact" type="button" data-stripe-sync>Sync from Stripe</button>':''}`:'';
  const activity=(p.activity||[]).map(x=>`<div class="org360-event"><span class="timeline-dot"></span><div><strong>${escapeHtml((x.action||'activity').replaceAll('.',' '))}</strong><small>${escapeHtml(x.user_name||'System')} · ${escapeHtml(x.entity_type||'record')}</small></div><time>${x.created_at?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${x.created_at}Z`)):''}</time></div>`).join('')||'<p class="muted">No recent activity.</p>';
  profileContent.innerHTML=`
  <section class="org360-hero span-two"><div class="org-brand-swatch" style="--org-colour:${escapeHtml(o.primary_colour||'#1f6f5f')}">${o.logo_url?`<img src="${escapeHtml(o.logo_url)}" alt="">`:initialsFromName(o.name)}</div><div class="org360-title"><div><span class="badge ${o.status==='active'?'success':o.status==='archived'?'neutral':'danger'}">${escapeHtml(o.status)}</span><span class="health-score ${healthTone}">${o.health_score}% health</span></div><h3>${escapeHtml(o.name)}</h3><p>${escapeHtml(o.contact_email||'No contact email')} · ${escapeHtml(o.contact_phone||'No phone')} ${o.website?'· '+escapeHtml(o.website):''}</p></div><div class="org360-commercial"><small>Monthly recurring revenue</small><strong>${formatMoney(o.monthly_price_pence||0)}</strong><span>${escapeHtml(o.plan_name||o.subscription_plan||'Development')} plan</span></div></section>
  <nav class="org360-tabs span-two" aria-label="Organisation 360 sections">${[['overview','Overview'],['people','People & branches'],['commercial','Commercial'],['security','Security'],['support','Support'],['activity','Activity']].map(([id,label],i)=>`<button type="button" class="${i===0?'active':''}" data-org360-tab="${id}">${label}</button>`).join('')}</nav>
  <div class="org360-panel span-two" data-org360-panel="overview">
    <section class="org-profile-stats"><div><span>Clients</span><strong>${o.client_count||0}</strong></div><div><span>Staff</span><strong>${o.staff_count||0}</strong></div><div><span>Users</span><strong>${o.user_count||0}</strong></div><div><span>Branches</span><strong>${o.branch_count||0}</strong></div><div><span>Care plans</span><strong>${o.active_care_plans||0}</strong></div><div><span>Documents</span><strong>${o.document_count||0}</strong></div></section>
    <div class="org360-grid"><section class="org-profile-detail"><h3>Customer health</h3><div class="org360-health"><strong class="health-score ${healthTone}">${o.health_score}%</strong><span>${escapeHtml(o.health_band||'healthy')}</span></div><ul>${(o.health_reasons||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>No immediate concerns detected.</li>'}</ul></section><section class="org-profile-detail"><h3>Operational attention</h3><div class="attention-metrics"><div><span>Overdue reviews</span><strong>${o.overdue_care_plans||0}</strong></div><div><span>High risks</span><strong>${o.high_risks||0}</strong></div><div><span>Active users (30d)</span><strong>${o.active_users_30d||0}</strong></div><div><span>Last activity</span><strong>${o.last_activity_at?formatDate(o.last_activity_at.slice(0,10)):'None'}</strong></div></div></section></div>
    <section class="org-profile-detail"><h3>Enabled modules</h3><div class="feature-chip-list">${flags.map(x=>`<span>${escapeHtml(x)}</span>`).join('')||'<span>Core modules</span>'}</div></section>
  </div>
  <div class="org360-panel span-two" data-org360-panel="people" hidden><div class="org360-grid"><section class="org-profile-detail"><h3>Branches</h3>${(p.branches||[]).map(b=>`<div class="support-history-row"><div><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(b.code||'No code')} · ${b.user_count||0} users · ${b.client_count||0} clients</small></div><span class="badge ${b.status==='active'?'success':'neutral'}">${escapeHtml(b.status)}</span></div>`).join('')||'<p>No branches.</p>'}</section><section class="org-profile-detail"><h3>Users</h3>${(p.users||[]).slice(0,20).map(u=>`<div class="support-history-row"><div><strong>${escapeHtml(u.display_name)}</strong><small>${escapeHtml(u.email)} · ${escapeHtml(roleLabel(u.access_level))}${u.branch_name?' · '+escapeHtml(u.branch_name):''}</small></div><span class="badge ${u.status==='active'?'success':'neutral'}">${escapeHtml(u.status)}</span></div>`).join('')||'<p>No users.</p>'}</section></div></div>
  <div class="org360-panel span-two" data-org360-panel="commercial" hidden><div class="org360-grid"><section class="org-profile-detail"><h3>Subscription usage</h3><p><b>${escapeHtml(o.plan_name||o.subscription_plan||'Development')}</b> · ${escapeHtml(o.subscription_status||'active')}</p><p>Renewal ${formatDate(o.renewal_date)||'Not set'}</p><div class="licence-meter ${userUsage.status||''}"><span>Active users ${userUsage.used||0}/${userUsage.limit??'∞'}</span><i><b style="width:${usagePct}%"></b></i><small>${userUsage.status==='near_limit'?'Approaching the plan limit':userUsage.status==='at_limit'?'Limit reached — new users are blocked':userUsage.status==='over_limit'?'Over limit — additions are blocked':'Plan allowance available'}</small></div><div class="licence-meter ${clientUsage.status||''}"><span>Active clients ${clientUsage.used||0}/${clientUsage.limit??'∞'}</span><i><b style="width:${clientPct}%"></b></i><small>${clientUsage.status==='near_limit'?'Approaching the plan limit':clientUsage.status==='at_limit'?'Limit reached — new clients are blocked':clientUsage.status==='over_limit'?'Over limit — additions are blocked':'Plan allowance available'}</small></div></section><section class="org-profile-detail"><h3>Owner subscription control</h3>${p.canManage?`<form class="subscription-control-form" data-organisation-subscription-form><label><span>Plan</span><select name="subscriptionPlan">${planOptions}</select></label><label><span>Billing status</span><select name="subscriptionStatus"><option value="trial" ${o.subscription_status==='trial'?'selected':''}>Trial</option><option value="active" ${o.subscription_status==='active'?'selected':''}>Active</option><option value="past_due" ${o.subscription_status==='past_due'?'selected':''}>Past due</option><option value="cancelled" ${o.subscription_status==='cancelled'?'selected':''}>Cancelled</option></select></label><button class="primary-button compact" type="submit">Save subscription</button><button class="secondary-button compact ${o.status==='archived'?'':'danger-text'}" type="button" data-organisation-archive-action="${o.status==='archived'?'restore':'archive'}">${o.status==='archived'?'Restore organisation':'Archive organisation'}</button><p class="field-help">Plan limits are owner-controlled. Archiving removes the organisation from current views without deleting its records.</p></form>`:'<p>Only an authorised Platform owner or administrator can change this subscription.</p>'}</section><section class="org-profile-detail span-two"><h3>Revenue history</h3>${(p.revenueEvents||[]).map(r=>`<div class="support-history-row"><div><strong>${escapeHtml((r.event_type||'event').replaceAll('_',' '))}</strong><small>${escapeHtml(r.description||'')}</small></div><span>${formatMoney(r.amount_pence||0)}</span></div>`).join('')||'<p>No revenue events recorded.</p>'}</section></div></div>
  <div class="org360-panel span-two" data-org360-panel="commercial" hidden><section class="org-profile-detail stripe-billing-card"><div class="subheading"><div><h3>Stripe Billing</h3><p>Hosted payment pages, invoices and verified subscription updates.</p></div><span class="badge ${billingTone}">${billingMode}</span></div><div class="stripe-billing-grid"><div><span>Stripe status</span><strong>${escapeHtml(o.stripe_status||'Not started')}</strong><small>${o.stripe_cancel_at_period_end?`Cancels at period end (${formatDate(o.stripe_current_period_end?.slice(0,10))})`:o.stripe_current_period_end?`Current period ends ${formatDate(o.stripe_current_period_end.slice(0,10))}`:'No Stripe subscription period recorded'}</small></div><div><span>Latest payment</span><strong>${o.stripe_last_payment_amount_pence!=null?formatMoney(o.stripe_last_payment_amount_pence):'None recorded'}</strong><small>${o.stripe_last_payment_at?formatDate(o.stripe_last_payment_at.slice(0,10)):'Waiting for a verified payment event'}</small></div><div><span>Webhook security</span><strong>${billing.webhookConfigured?'Signing secret connected':'Setup required'}</strong><small>${escapeHtml(billing.webhookUrl||'')}</small></div><div><span>Tax handling</span><strong>${billing.automaticTaxEnabled?'Stripe Tax enabled':'Address and tax ID collection'}</strong><small>${billing.automaticTaxEnabled?'Automatic tax calculations are active.':'Automatic Stripe Tax is off to avoid additional usage charges.'}</small></div></div><div class="record-card-actions">${stripeActions||'<span class="muted">Stripe controls will appear when this environment is connected.</span>'}</div>${billing.webhookConfigured?'<p class="field-help">Keep the exact webhook path publicly reachable through Cloudflare Access. Every event is still protected by Stripe signature verification.</p>':'<p class="field-help">After creating the webhook in Stripe, connect its signing secret and add a Cloudflare Access bypass for this exact webhook path only.</p>'}</section></div>
  <div class="org360-panel span-two" data-org360-panel="security" hidden><div class="org360-grid"><section class="org-profile-detail"><h3>Security policy</h3>${p.securityPolicy?`<div class="attention-metrics"><div><span>Identity and MFA</span><strong>Cloudflare Access</strong></div><div><span>Session timeout</span><strong>${p.securityPolicy.session_timeout_minutes||'Default'} min</strong></div><div><span>Password length</span><strong>${p.securityPolicy.minimum_password_length||'Default'}</strong></div><div><span>Emergency mode</span><strong>${p.securityPolicy.emergency_mode?'Active':'Off'}</strong></div></div><p class="field-help">MFA and trusted-device rules are managed in Cloudflare Access before this application opens.</p>`:'<p>No custom security policy.</p>'}</section><section class="org-profile-detail"><h3>Recent logins</h3>${(p.loginHistory||[]).slice(0,12).map(l=>`<div class="support-history-row"><div><strong>${escapeHtml(l.display_name||l.email||'User')}</strong><small>${escapeHtml(l.ip_address||'Unknown IP')} · ${escapeHtml(l.result||l.status||'attempt')}</small></div><time>${l.created_at?formatDate(l.created_at.slice(0,10)):''}</time></div>`).join('')||'<p>No login history.</p>'}</section></div></div>
  <div class="org360-panel span-two" data-org360-panel="support" hidden><div class="org360-grid"><section class="org-profile-detail"><h3>Support history</h3>${(p.supportHistory||[]).map(x=>`<div class="support-history-row"><div><strong>${escapeHtml(x.display_name||'Platform user')}</strong><small>${escapeHtml(x.reason)} · ${escapeHtml(x.access_mode)}</small></div><time>${formatDate(x.started_at?.slice(0,10))}</time></div>`).join('')||'<p>No support sessions recorded.</p>'}</section><section class="org-profile-detail"><h3>Customer success notes</h3>${(p.successNotes||[]).map(x=>`<div class="support-history-row"><div><strong>${escapeHtml(x.note_type||'Note')}</strong><small>${escapeHtml(x.note||x.content||'')} · ${escapeHtml(x.author_name||'Platform')}</small></div><time>${formatDate(x.created_at?.slice(0,10))}</time></div>`).join('')||'<p>No success notes recorded.</p>'}</section></div></div>
  <div class="org360-panel span-two" data-org360-panel="activity" hidden><section class="org-profile-detail"><h3>Recent organisation activity</h3><div class="org360-activity">${activity}</div></section></div>`;
  $$('[data-org360-tab]').forEach(button=>button.addEventListener('click',()=>{$$('[data-org360-tab]').forEach(x=>x.classList.toggle('active',x===button));$$('[data-org360-panel]').forEach(x=>x.hidden=x.dataset.org360Panel!==button.dataset.org360Tab);}));
  const manualSubscriptionForm=$('[data-organisation-subscription-form]');
  if(o.billing_provider==='stripe'&&manualSubscriptionForm){manualSubscriptionForm.querySelectorAll('select').forEach(select=>select.disabled=true);const save=manualSubscriptionForm.querySelector('[type="submit"]');if(save){save.disabled=true;save.textContent='Managed by Stripe'}manualSubscriptionForm.querySelector('.field-help').textContent='Stripe is the payment-status authority for this organisation. Use the billing portal or sync controls below; archiving remains available here.'}
  manualSubscriptionForm?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');if(o.billing_provider==='stripe')return;try{button.disabled=true;await api(`/api/platform/organisations/${encodeURIComponent(organisationId)}`,{method:'PUT',body:JSON.stringify({...Object.fromEntries(new FormData(form)),clearLimitOverrides:true})});showToast('Subscription updated and product entitlements queued for sync.');await Promise.all([loadPlatformDashboard(),loadOrganisations()]);await managePlatformOrganisation(organisationId)}catch(error){showToastError(error)}finally{button.disabled=false}});
  $('[data-stripe-catalogue]')?.addEventListener('click',async event=>{const button=event.currentTarget;try{button.disabled=true;button.textContent='Connecting plans…';await api('/api/platform/billing/catalogue',{method:'POST'});showToast('CoreCare plans connected to Stripe.');await managePlatformOrganisation(organisationId)}catch(error){showToastError(error)}finally{if(button.isConnected){button.disabled=false;button.textContent='Connect £50 and £150 plans'}}});
  $('[data-stripe-checkout]')?.addEventListener('click',async event=>{const button=event.currentTarget,checkoutWindow=window.open('about:blank','_blank');if(checkoutWindow)checkoutWindow.opener=null;try{button.disabled=true;const result=await api(`/api/platform/organisations/${encodeURIComponent(organisationId)}/billing/checkout`,{method:'POST',body:JSON.stringify({planId:o.subscription_plan,billingEmail:o.billing_email||o.contact_email||''})});if(checkoutWindow)checkoutWindow.location.replace(result.url);else window.location.assign(result.url);showToast(`${result.mode==='test'?'Test':'Live'} Stripe Checkout opened.`)}catch(error){checkoutWindow?.close();showToastError(error)}finally{button.disabled=false}});
  $('[data-stripe-portal]')?.addEventListener('click',async event=>{const button=event.currentTarget,portalWindow=window.open('about:blank','_blank');if(portalWindow)portalWindow.opener=null;try{button.disabled=true;const result=await api(`/api/platform/organisations/${encodeURIComponent(organisationId)}/billing/portal`,{method:'POST',body:'{}'});if(portalWindow)portalWindow.location.replace(result.url);else window.location.assign(result.url)}catch(error){portalWindow?.close();showToastError(error)}finally{button.disabled=false}});
  $('[data-stripe-sync]')?.addEventListener('click',async event=>{const button=event.currentTarget;try{button.disabled=true;await api(`/api/platform/organisations/${encodeURIComponent(organisationId)}/billing/sync`,{method:'POST',body:'{}'});showToast('Subscription refreshed from Stripe.');await Promise.all([loadPlatformDashboard(),loadOrganisations()]);await managePlatformOrganisation(organisationId)}catch(error){showToastError(error)}finally{if(button.isConnected)button.disabled=false}});
  $('[data-organisation-archive-action]')?.addEventListener('click',async event=>{const action=event.currentTarget.dataset.organisationArchiveAction,nextStatus=action==='restore'?'active':'archived';if(!confirm(action==='restore'?'Restore this organisation to the current workspace?':'Archive this organisation? It will leave current views and customer sessions will be revoked, but no records will be deleted.'))return;try{event.currentTarget.disabled=true;await api(`/api/platform/organisations/${encodeURIComponent(organisationId)}`,{method:'PUT',body:JSON.stringify({status:nextStatus})});dialog.close();showToast(action==='restore'?'Organisation restored.':'Organisation archived.');await Promise.all([loadPlatformDashboard(),loadOrganisations()]);}catch(error){showToastError(error);event.currentTarget.disabled=false}});
  const supportDisabled=o.status!=='active';for(const selector of ['#platform-org-support-full','#platform-org-support-readonly']){const button=$(selector);if(button){button.disabled=supportDisabled;button.title=supportDisabled?'Restore or reactivate the organisation before entering support mode.':''}}
  if(!dialog.open){if(typeof dialog.showModal==='function') dialog.showModal(); else dialog.setAttribute('open','');}
}

async function loadCareDeliveryDashboard(){
  const payload=await api('/api/care-delivery/dashboard'),m=payload.metrics||{};
  setText('#care-pending-approval',m.pendingApproval||0);setText('#care-high-risks',m.highRisks||0);setText('#care-open-alerts',m.openAlerts||0);setText('#care-future-visits',m.futureVisits||0);setText('#care-draft-visits',m.draftVisits||0);
  const alerts=$('#care-delivery-alerts');if(alerts)alerts.innerHTML=(payload.alerts||[]).map(a=>`<div class="care-alert-row"><div><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.message||'')} ${a.due_date?'· Due '+formatDate(a.due_date):''}</small></div><div class="care-plan-actions"><span class="badge ${a.severity==='critical'?'danger':'active'}">${escapeHtml(a.severity)}</span><button class="row-action care-plan-action" data-ack-care-alert="${escapeHtml(a.id)}">Acknowledge</button></div></div>`).join('')||'<div class="operations-empty"><strong>No open care alerts</strong><span>Care-plan and risk review monitoring is clear.</span></div>';
  const reviews=$('#care-review-schedule');if(reviews)reviews.innerHTML=(payload.reviews||[]).slice(0,12).map(r=>`<div class="care-review-row"><div><strong>${escapeHtml((r.record_type||'Review').replaceAll('_',' '))}</strong><small>${formatDate(r.due_date)}</small></div><span class="badge ${new Date(r.due_date+'T23:59:59')<new Date()?'danger':'neutral'}">${new Date(r.due_date+'T23:59:59')<new Date()?'Overdue':'Scheduled'}</span></div>`).join('')||'<div class="operations-empty"><strong>No reviews scheduled</strong><span>Review dates will appear when care plans and risks are saved.</span></div>';
  $$('[data-ack-care-alert]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await api(`/api/care-delivery/alerts/${encodeURIComponent(b.dataset.ackCareAlert)}/acknowledge`,{method:'POST'});await loadCareDeliveryDashboard();}catch(e){showToastError(e);b.disabled=false;}}));
}
async function runCarePlanAction(id,action){
  const label=action==='approve'?'approve this care plan':'generate the next eight weeks of draft visits from this client’s visit requirements';
  if(!confirm(`Are you sure you want to ${label}?`))return;
  try{const result=await api(`/api/care-plans/${encodeURIComponent(id)}/${action}`,{method:'POST'});if(action==='generate-visits')alert(`${result.visitsGenerated||0} visit occurrences were processed. Existing occurrences were not duplicated.`);await Promise.all([loadAllCarePlans(),loadCareDeliveryDashboard(),loadDashboard()]);}catch(e){showToastError(e);}
}

async function loadAllCarePlans() {
  const payload = await api('/api/care-plans');
  allCarePlans = payload.carePlans || [];
  renderAllCarePlans();
}

function carePlanDueState(date) {
  if (!date) return 'none';
  const today = new Date(); today.setHours(0,0,0,0);
  const review = new Date(`${date}T00:00:00`);
  const inThirty = new Date(today); inThirty.setDate(inThirty.getDate()+30);
  if (review < today) return 'overdue';
  if (review <= inThirty) return 'due';
  return 'current';
}

function renderAllCarePlans() {
  const query = ($('#care-search')?.value || '').trim().toLowerCase();
  const status = $('#care-status-filter')?.value || 'all';
  const visible = allCarePlans.filter(plan => (status === 'all' || plan.status === status) && `${plan.clientName} ${plan.title} ${plan.authorName}`.toLowerCase().includes(query));
  const active = allCarePlans.filter(plan => plan.status === 'Active');
  $('#care-active-count').textContent = active.length;
  $('#care-due-count').textContent = active.filter(plan => carePlanDueState(plan.reviewDate) === 'due').length;
  $('#care-overdue-count').textContent = active.filter(plan => carePlanDueState(plan.reviewDate) === 'overdue').length;
  const list = $('#care-overview-list');
  const empty = $('#care-overview-empty');
  empty.hidden = visible.length > 0;
  list.innerHTML = visible.map(plan => {
    const due = carePlanDueState(plan.reviewDate);
    const dueLabel = due === 'overdue' ? 'Overdue' : due === 'due' ? 'Due soon' : 'Current';
    return `<article class="care-overview-row ${plan.approvalStatus==='approved'?'care-plan-approved':'care-plan-pending'}">
      <button class="care-client-link" data-open-care-client="${escapeHtml(plan.clientId)}">
        <span class="person-avatar">${escapeHtml(initialsFromName(plan.clientName))}</span>
        <span><strong>${escapeHtml(plan.clientName)}</strong><small>${escapeHtml(plan.title)}</small></span>
      </button>
      <span><small>Status</small><strong>${escapeHtml(plan.status)}</strong></span>
      <span><small>Version</small><strong>${escapeHtml(plan.version)}</strong></span>
      <span><small>Review</small><strong class="${due === 'overdue' ? 'date-overdue' : ''}">${formatDate(plan.reviewDate)}</strong></span>
      <span class="badge ${plan.approvalStatus==='approved'?'success':'active'}">${plan.approvalStatus==='approved'?'Approved':'Approval pending'}</span>
      <div class="care-plan-actions">${plan.approvalStatus!=='approved'?`<button class="row-action care-plan-action" data-care-plan-approve="${escapeHtml(plan.id)}">Approve</button>`:`<button class="row-action care-plan-action" data-care-plan-generate="${escapeHtml(plan.id)}">Generate visits</button>`}<button class="row-action care-plan-action" data-open-care-client="${escapeHtml(plan.clientId)}">Open</button></div>
    </article>`;
  }).join('');
  $$('[data-open-care-client]').forEach(button => button.addEventListener('click', async () => {
    await openClientProfile(button.dataset.openCareClient);
    showClientTab('care-plans');
  }));
  $$('[data-care-plan-approve]').forEach(button=>button.addEventListener('click',()=>runCarePlanAction(button.dataset.carePlanApprove,'approve')));
  $$('[data-care-plan-generate]').forEach(button=>button.addEventListener('click',()=>runCarePlanAction(button.dataset.carePlanGenerate,'generate-visits')));
}

function renderCareClientPicker() {
  const term = ($('#care-client-picker-search')?.value || '').trim().toLowerCase();
  const activeClients = clients.filter(client => client.status === 'Active');
  const visible = activeClients.filter(client => {
    const haystack = `${client.firstName} ${client.lastName} ${client.preferredName || ''} ${client.nhsNumber || ''} ${client.dateOfBirth || ''} ${formatDate(client.dateOfBirth)}`.toLowerCase();
    return !term || haystack.includes(term);
  });
  const list = $('#care-client-picker-list');
  const empty = $('#care-client-picker-empty');
  empty.hidden = visible.length > 0;
  list.innerHTML = visible.map(client => `<button type="button" class="client-picker-row" data-select-care-client="${escapeHtml(client.id)}">
    <span class="person-avatar">${initialsFromName(`${client.firstName} ${client.lastName}`)}</span>
    <span class="client-picker-details"><strong>${escapeHtml(clientDisplayName(client))}</strong><small>DOB ${formatDate(client.dateOfBirth)} · NHS ${escapeHtml(client.nhsNumber || 'Not recorded')}</small></span>
    <span class="client-picker-action">Select</span>
  </button>`).join('');
  $$('[data-select-care-client]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    button.querySelector('.client-picker-action').textContent = 'Opening…';
    try {
      careClientPickerDialog.close();
      await openClientProfile(button.dataset.selectCareClient);
      showClientTab('care-plans');
      openCarePlanDialog();
    } catch (error) {
      showToastError(error);
    } finally {
      button.disabled = false;
    }
  }));
}

function openCareClientPicker() {
  $('#care-client-picker-search').value = '';
  renderCareClientPicker();
  careClientPickerDialog.showModal();
  setTimeout(() => $('#care-client-picker-search').focus(), 50);
}

async function loadClients() {
  const payload = await api('/api/clients?includeArchived=true');
  clients = Array.isArray(payload.clients) ? payload.clients : [];
}




function hideDashboardSections(){
  const dashboard=$('#dashboard-page');if(!dashboard)return;
  Array.from(dashboard.children).forEach(node=>node.hidden=true);
}
function ensureWorkspaceDashboard(id,html){
  let section=$(`#${id}`);
  if(!section){section=document.createElement('section');section.id=id;section.className='role-dashboard';section.innerHTML=html;$('#dashboard-page').appendChild(section);}
  section.hidden=false;return section;
}
function dashboardMetricCard(label,value,copy=''){return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(copy)}</small></article>`;}
async function loadManagerDashboard(){
  hideDashboardSections();
  const generic=[...$('#dashboard-page').children].filter(n=>!n.classList.contains('role-dashboard')&&n.id!=='carer-dashboard');generic.forEach(n=>n.hidden=false);
  await loadDashboard();
}
async function loadCoordinatorDashboard(){
  hideDashboardSections();
  const [dashboard,board]=await Promise.all([api('/api/dashboard'),api('/api/visits/board')]);
  const stats=board.stats||{},visits=board.visits||[],unallocated=visits.filter(v=>!v.staff_id&&v.status!=='completed').length;
  const section=ensureWorkspaceDashboard('coordinator-dashboard',`<div class="role-hero"><div><p class="eyebrow">Care coordinator workspace</p><h2>Today’s rota control</h2><p>Allocate visits, resolve gaps and keep care delivery moving.</p></div><button class="primary-button compact" data-page-link="rota">Open rota</button></div><section class="role-metrics" id="coordinator-metrics"></section><section class="role-grid"><article class="panel span-two"><div class="panel-heading"><div><p class="eyebrow">Scheduling priorities</p><h2>Visits needing attention</h2></div></div><div id="coordinator-priority" class="workspace-list"></div></article><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Quick actions</p><h2>Coordinate today</h2></div></div><div class="workspace-actions"><button data-page-link="rota">Allocate visits</button><button data-page-link="staff">Check staff availability</button><button data-page-link="visits">Open live visits</button><button data-page-link="tasks">Manage cover tasks</button></div></article></section>`);
  $('#coordinator-metrics').innerHTML=dashboardMetricCard('Visits today',visits.length,'scheduled care calls')+dashboardMetricCard('Unallocated',unallocated,'require allocation')+dashboardMetricCard('Late',stats.late||0,'need coordinator action')+dashboardMetricCard('In progress',stats.inProgress||0,'currently underway');
  const priority=visits.filter(v=>!v.staff_id||['late','overrunning'].includes(v.live_status)).slice(0,8);
  $('#coordinator-priority').innerHTML=priority.map(v=>`<div class="workspace-row"><div><strong>${escapeHtml(v.client_name||'Client')}</strong><span>${new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${escapeHtml(v.visit_type||'Care visit')}</span></div><span class="badge ${v.staff_id?'danger':'warning'}">${v.staff_id?escapeHtml(carerStatusLabel(v.live_status)):'Unallocated'}</span></div>`).join('')||'<div class="empty-state"><strong>No scheduling issues</strong><span>Today’s rota has no immediate allocation or timing warnings.</span></div>';
  bindPageLinks(section);
}
async function loadFamilyDashboard(){
  hideDashboardSections();
  const section=ensureWorkspaceDashboard('family-dashboard',`<div class="role-hero family-role-hero"><div><p class="eyebrow">Family workspace</p><h2>Care updates for your relative</h2><p>View only the information the care provider has chosen to share with you.</p></div></div><section class="role-metrics"><article><span>Next visit</span><strong>Scheduled</strong><small>Details will appear when family sharing is enabled</small></article><article><span>Recent updates</span><strong>0</strong><small>shared care notes</small></article><article><span>Messages</span><strong>0</strong><small>unread messages</small></article></section><section class="role-grid"><article class="panel span-two"><div class="panel-heading"><div><p class="eyebrow">Shared information</p><h2>Family updates</h2></div></div><div class="empty-state"><strong>No shared updates yet</strong><span>Your care provider controls which visits, notes and documents are visible here.</span></div></article><article class="panel"><div class="panel-heading"><div><p class="eyebrow">Privacy</p><h2>Read-only access</h2></div></div><p class="padded muted">Family accounts cannot access staff records, internal care plans, organisation management or other clients.</p></article></section>`);
}
function bindPageLinks(root=document){root.querySelectorAll('[data-page-link]').forEach(button=>{if(button.dataset.workspaceBound)return;button.dataset.workspaceBound='1';button.addEventListener('click',()=>showPage(button.dataset.pageLink));});}

function carerStatusLabel(status){return ({scheduled:'Upcoming',due:'Due now',late:'Late',in_progress:'In progress',overrunning:'Overrunning',completed:'Completed',missed:'Missed'})[status]||String(status||'').replaceAll('_',' ');}
function carerStatusTone(status){return ['late','overrunning','missed'].includes(status)?'danger':status==='completed'?'success':status==='in_progress'?'active':status==='due'?'active':'neutral';}
async function loadCarerDashboard(type='carer'){
  hideDashboardSections();
  const section=$('#carer-dashboard');if(!section)return;section.hidden=false;
  $('#carer-greeting').textContent=type==='senior'?'My visits and senior responsibilities':'Today’s visits';
  const eyebrow=section.querySelector('.carer-hero .eyebrow');if(eyebrow)eyebrow.textContent=type==='senior'?'Senior carer workspace':'My working day';
  const payload=await api('/api/carer/dashboard'),m=payload.metrics||{};
  $('#carer-total').textContent=m.today??0;$('#carer-completed').textContent=m.completed??0;$('#carer-progress').textContent=m.inProgress??0;$('#carer-late').textContent=m.late??0;
  const warning=$('#carer-link-warning');warning.hidden=payload.linked!==false;if(payload.linked===false)$('#carer-link-message').textContent=payload.message||'Ask a manager to link your login to your staff record.';
  const visits=payload.visits||[];$('#carer-summary').textContent=payload.linked===false?'Your account needs manager attention.':visits.length?`${m.completed||0} of ${visits.length} visits completed today.`:'You have no allocated visits today.';
  const list=$('#carer-visit-list');list.innerHTML=visits.map(v=>{const live=v.live_status||v.status,start=new Date(v.scheduled_start),end=v.scheduled_end?new Date(v.scheduled_end):null;const canRecord=v.status==='in_progress'||v.status==='completed';return `<article class="carer-visit-card ${escapeHtml(live)}"><div class="carer-visit-time"><strong>${start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</strong><span>${end?end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):''}</span></div><div class="carer-visit-copy"><div><span class="badge ${carerStatusTone(live)}">${escapeHtml(carerStatusLabel(live))}</span>${v.has_care_record?'<span class="badge success">Record saved</span>':''}</div><h3>${escapeHtml(v.client_preferred_name||v.client_name||'Client')}</h3><p>${escapeHtml(v.visit_type||'Care visit')}</p><small>${escapeHtml(v.address||'Address not recorded')}</small></div><div class="carer-visit-actions">${canRecord?`<button class="secondary-button compact" data-carer-record="${escapeHtml(v.id)}">${v.status==='completed'?'View record':'Record care'}</button>`:''}${v.status==='scheduled'?'<button class="primary-button compact" data-carer-clock>Clock in</button>':''}${v.status==='in_progress'?'<button class="primary-button compact" data-carer-clock>Clock out</button>':''}</div></article>`;}).join('')||'<div class="empty-state"><strong>No visits allocated today</strong><span>Your manager can allocate visits from the rota.</span></div>';
  const history=$('#carer-history');history.innerHTML=(payload.history||[]).map(v=>`<button class="carer-history-row" data-carer-record="${escapeHtml(v.id)}"><span>${new Date(v.scheduled_start).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span><div><strong>${escapeHtml(v.client_preferred_name||v.client_name||'Client')}</strong><small>${escapeHtml(v.visit_type||'Care visit')}</small></div><em>View</em></button>`).join('')||'<p class="muted">No previous completed visits yet.</p>';
  document.querySelectorAll('[data-carer-record]').forEach(b=>b.addEventListener('click',()=>openVisitCareRecord(b.dataset.carerRecord)));
  document.querySelectorAll('[data-carer-clock]').forEach(b=>b.addEventListener('click',()=>$('#visit-clock-dialog')?.showModal()));
}

async function loadDashboard() {
  const payload = await api('/api/dashboard');
  const m = payload.metrics || {};
  $('#dash-active-clients').textContent = m.activeClients ?? 0;
  $('#dash-reviews-due').textContent = m.reviewsDue ?? 0;
  $('#dash-high-risk').textContent = `${m.highRisk ?? 0} high risk`;
  $('#dash-active-staff').textContent = m.activeStaff ?? 0;
  $('#dash-total-staff').textContent = m.totalStaff ?? 0;
  $('#dash-compliance-due').textContent = m.complianceDue ?? 0;
  $('#dash-care-plans-due').textContent = m.carePlansDue ?? 0;
  $('#dash-active-risks').textContent = m.activeRisks ?? 0;
  const activity = payload.activity || [];
  $('#dashboard-activity').innerHTML = activity.length ? activity.map(event => {
    const when = new Date(event.created_at);
    const label = String(event.action || '').replaceAll('.', ' ');
    return `<div><span>${new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(when)}</span><i class="timeline-dot"></i><p><strong>${escapeHtml(label)}</strong>${event.user_name ? ` by ${escapeHtml(event.user_name)}` : ''}.</p></div>`;
  }).join('') : '<div><p>No recorded activity yet.</p></div>';
}

async function loadStaff() {
  const payload = await api('/api/staff?includeInactive=true');
  staff = Array.isArray(payload.staff) ? payload.staff : [];
}
function isPast(value){ return Boolean(value) && new Date(`${value}T23:59:59`) < new Date(); }
function staffName(item){ return `${item.firstName || ''} ${item.lastName || ''}`.trim(); }
function renderStaff() {
  const term = ($('#staff-search')?.value || '').trim().toLowerCase();
  const status = $('#staff-status-filter')?.value || 'all';
  const filtered = staff.filter(item => {
    const haystack = `${item.firstName} ${item.lastName} ${item.preferredName} ${item.jobTitle} ${item.phone} ${item.email}`.toLowerCase();
    return (!term || haystack.includes(term)) && (status === 'all' || item.status === status);
  });
  $('#staff-table-body').innerHTML = filtered.map(item => `<tr><td><div class="client-person"><span class="person-avatar">${initialsFromName(staffName(item))}</span><div><strong>${escapeHtml(staffName(item))}</strong><span>${escapeHtml(item.preferredName ? `Known as ${item.preferredName}` : item.employmentType)}</span></div></div></td><td>${escapeHtml(item.jobTitle)}</td><td>${escapeHtml(item.phone || item.email || 'Not recorded')}</td><td class="${isPast(item.dbsExpiry) ? 'date-overdue' : ''}">${formatDate(item.dbsExpiry)}${isPast(item.dbsExpiry) ? ' · overdue' : ''}</td><td class="${isPast(item.trainingExpiry) ? 'date-overdue' : ''}">${formatDate(item.trainingExpiry)}${isPast(item.trainingExpiry) ? ' · overdue' : ''}</td><td><span class="badge ${item.status === 'Active' ? 'success' : 'neutral'}">${escapeHtml(item.status)}</span>${item.loginUserId?`<small class="table-subline">Login: ${escapeHtml(item.loginStatus||'active')}</small>`:'<small class="table-subline">No login</small>'}</td><td>${hasAccess('staff.edit')?`<button class="row-action" data-edit-staff="${escapeHtml(item.id)}">Edit</button>`:'<span class="muted">View only</span>'}</td></tr>`).join('');
  $('#staff-empty').hidden = filtered.length > 0;
  $('#staff-active-count').textContent = staff.filter(x => x.status === 'Active').length;
  $('#staff-dbs-count').textContent = staff.filter(x => x.status === 'Active' && isPast(x.dbsExpiry)).length;
  $('#staff-training-count').textContent = staff.filter(x => x.status === 'Active' && isPast(x.trainingExpiry)).length;
  $$('[data-edit-staff]').forEach(button => button.addEventListener('click', () => openStaffDialog(button.dataset.editStaff)));
}
function toggleStaffLoginFields(){const checked=$('#staff-create-login')?.checked;const fields=$('#staff-login-fields');if(fields)fields.hidden=!checked;}
function openStaffDialog(id = '') {
  if(!hasAccess(id?'staff.edit':'staff.create')){denyPage();return;}
  staffForm.reset(); $('#staff-form-error').hidden = true; staffForm.elements.id.value = id;
  $('#staff-dialog-title').textContent = id ? 'Edit staff' : 'Add staff';
  const item = staff.find(x => x.id === id);
  if (item) Object.entries(item).forEach(([key,value]) => { const field=staffForm.elements.namedItem(key); if(field) field.value=value ?? ''; });
  const hasLogin=Boolean(item?.loginUserId); $('#staff-create-login').checked=hasLogin; $('#staff-create-login').disabled=hasLogin; toggleStaffLoginFields();
  const temp=$('#staff-temp-password-field'),statusField=$('#staff-login-status-field'),summary=$('#staff-login-summary'); if(temp)temp.hidden=hasLogin;if(statusField)statusField.hidden=!hasLogin;
  if(hasLogin){staffForm.elements.loginStatus.value=item.loginStatus||'active';summary.hidden=false;summary.innerHTML=`<strong>Linked login</strong><span>${escapeHtml(item.loginEmail)} · ${escapeHtml((item.loginAccessLevel||'carer').replaceAll('_',' '))}</span><small>${item.lastLoginAt?`Last login ${new Date(item.lastLoginAt).toLocaleString('en-GB')}`:'Has not logged in yet'}${item.mustChangePassword?' · Password change required':''}</small>`;}else{summary.hidden=true;staffForm.elements.loginEmail.value=item?.email||'';}
  staffDialog.showModal();
}
async function saveStaff(event) {
  event.preventDefault(); const data=Object.fromEntries(new FormData(staffForm)); const error=$('#staff-form-error'); error.hidden=true;
  const submit=staffForm.querySelector('[type="submit"]'); submit.disabled=true; submit.textContent='Saving…';
  try { const id=data.id; await api(id ? `/api/staff/${encodeURIComponent(id)}` : '/api/staff',{method:id?'PUT':'POST',body:JSON.stringify(data)}); await loadStaff(); renderStaff(); await loadDashboard(); staffDialog.close(); }
  catch(exception){ error.textContent=exception.message; error.hidden=false; }
  finally{ submit.disabled=false; submit.textContent='Save staff member'; }
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function reviewDue(client) {
  return client.status === 'Active' && new Date(`${client.nextReview}T23:59:59`) < new Date();
}

function clientDisplayName(client) {
  const full = `${client.firstName || ''} ${client.lastName || ''}`.trim();
  return client.preferredName ? `${full} (${client.preferredName})` : full;
}

function renderClients() {
  const term = clientSearch.value.trim().toLowerCase();
  const status = clientStatusFilter.value;
  const filtered = clients.filter(client => {
    const haystack = `${client.firstName} ${client.lastName} ${client.preferredName} ${client.town} ${client.postcode} ${client.nhsNumber}`.toLowerCase();
    const matchesStatus = status === 'all' ? client.status !== 'Archived' : client.status === status;
    return (!term || haystack.includes(term)) && matchesStatus;
  });

  clientTableBody.innerHTML = filtered.map(client => `
    <tr>
      <td><button class="client-link" data-view-client="${escapeHtml(client.id)}"><span class="person-avatar">${initialsFromName(`${client.firstName} ${client.lastName}`)}</span><span><strong>${escapeHtml(clientDisplayName(client))}</strong><small>DOB ${formatDate(client.dateOfBirth)} · NHS ${escapeHtml(client.nhsNumber || 'Not recorded')}</small></span></button></td>
      <td>${escapeHtml([client.town, client.postcode].filter(Boolean).join(', ') || 'Not recorded')}</td>
      <td>${escapeHtml(client.carePackage || 'Not set')}</td>
      <td><span class="review-date ${reviewDue(client) ? 'overdue' : ''}">${formatDate(client.nextReview)}${reviewDue(client) ? ' · overdue' : ''}</span></td>
      <td><span class="badge ${client.status === 'Active' ? 'success' : client.status === 'Paused' ? 'active' : 'neutral'}">${escapeHtml(client.status)}</span>${client.risk === 'High' ? '<span class="risk-tag">High risk</span>' : ''}</td>
      <td>${hasAccess('clients.edit')?`<button class="row-action" data-edit-client="${escapeHtml(client.id)}">Edit</button>`:'<span class="muted">View only</span>'}</td>
    </tr>`).join('');

  clientEmpty.hidden = filtered.length > 0;
  $('#client-active-count').textContent = clients.filter(client => client.status === 'Active').length;
  $('#client-review-count').textContent = clients.filter(reviewDue).length;
  $('#client-risk-count').textContent = clients.filter(client => client.status === 'Active' && client.risk === 'High').length;

  $$('[data-view-client]').forEach(button => button.addEventListener('click', () => openClientProfile(button.dataset.viewClient)));
  $$('[data-edit-client]').forEach(button => button.addEventListener('click', () => openClientDialog(button.dataset.editClient)));
}


const visitDayLabels=[['1','Mon'],['2','Tue'],['3','Wed'],['4','Thu'],['5','Fri'],['6','Sat'],['0','Sun']];
function visitRequirementRow(value={}){
  const days=Array.isArray(value.days)?value.days.map(String):['1','2','3','4','5','6','0'];
  return `<article class="visit-requirement-row">
    <label><span>Visit type</span><select data-requirement="visitType"><option>Personal care</option><option>Medication</option><option>Welfare / Domestic</option><option>Companionship</option><option>Meal support</option><option>Other</option></select></label>
    <label><span>Required time</span><input data-requirement="preferredTime" type="time" value="${escapeHtml(value.preferredTime||'08:00')}"></label>
    <label><span>Scheduling rule</span><select data-requirement="schedulingRule"><option value="flexible">Flexible</option><option value="window">Time window</option><option value="fixed">Fixed time — protected</option></select></label>
    <label><span>Allowed window</span><select data-requirement="windowMinutes"><option value="0">Exact time</option><option value="15">± 15 mins</option><option value="30">± 30 mins</option><option value="60" selected>± 1 hour</option><option value="120">± 2 hours</option></select></label>
    <label class="wide"><span>Time-critical reason</span><input data-requirement="timeCriticalReason" value="${escapeHtml(value.timeCriticalReason||'')}" placeholder="e.g. Insulin, medication or district nurse coordination"></label>
    <label><span>Duration</span><select data-requirement="durationMinutes"><option value="15">15 mins</option><option value="30" selected>30 mins</option><option value="45">45 mins</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label>
    <label><span>Carers required</span><select data-requirement="carersRequired"><option value="1">1 carer</option><option value="2">2 carers</option><option value="3">3 carers</option></select></label>
    <label><span>Visit notes</span><input data-requirement="notes" value="${escapeHtml(value.notes||'')}" placeholder="Skills, preferences or instructions"></label>
    <button class="icon-button visit-requirement-remove" type="button" aria-label="Remove visit requirement">×</button>
    <div class="visit-requirement-days">${visitDayLabels.map(([n,label])=>`<label><input type="checkbox" data-requirement-day value="${n}" ${days.includes(n)?'checked':''}> ${label}</label>`).join('')}</div>
  </article>`;
}
function addVisitRequirement(value={}){
  const list=$('#client-visit-requirements');if(!list)return;
  list.insertAdjacentHTML('beforeend',visitRequirementRow(value));
  const row=list.lastElementChild;
  row.querySelector('[data-requirement="visitType"]').value=value.visitType||'Personal care';
  row.querySelector('[data-requirement="schedulingRule"]').value=value.schedulingRule||((value.windowMinutes??60)===0?'fixed':'flexible');
  row.querySelector('[data-requirement="windowMinutes"]').value=String(value.windowMinutes??60);
  row.querySelector('[data-requirement="durationMinutes"]').value=String(value.durationMinutes??30);
  row.querySelector('[data-requirement="carersRequired"]').value=String(value.carersRequired??1);
  row.querySelector('.visit-requirement-remove').addEventListener('click',()=>row.remove());
}
function collectVisitRequirements(){return [...document.querySelectorAll('.visit-requirement-row')].map(row=>({visitType:row.querySelector('[data-requirement="visitType"]').value,preferredTime:row.querySelector('[data-requirement="preferredTime"]').value,windowMinutes:Number(row.querySelector('[data-requirement="windowMinutes"]').value),durationMinutes:Number(row.querySelector('[data-requirement="durationMinutes"]').value),carersRequired:Number(row.querySelector('[data-requirement="carersRequired"]').value),notes:row.querySelector('[data-requirement="notes"]').value,schedulingRule:row.querySelector('[data-requirement="schedulingRule"]').value,timeCriticalReason:row.querySelector('[data-requirement="timeCriticalReason"]').value,days:[...row.querySelectorAll('[data-requirement-day]:checked')].map(x=>Number(x.value))})).filter(r=>r.preferredTime&&r.days.length);}

let activeClientVerification=null;
async function loadClientVerification(clientId){const section=$('#client-verification-section');if(!section)return;section.hidden=!clientId;if(!clientId)return;const payload=await api('/api/visits/client-code',{method:'POST',body:JSON.stringify({clientId})});activeClientVerification={...payload,clientId};renderClientVerification(payload);}
function renderClientVerification(payload){setVisitText('#client-verification-code',payload.code||'—');setVisitText('#client-verification-created',payload.createdAt?`Created ${new Date(payload.createdAt).toLocaleString('en-GB')}`:'');const el=$('#client-qr-code');if(!el)return;el.innerHTML='';if(window.QRCode)new QRCode(el,{text:payload.code,width:196,height:196,correctLevel:QRCode.CorrectLevel.H});else el.innerHTML='<div class="qr-fallback">QR library unavailable<br><strong>'+escapeHtml(payload.code||'')+'</strong></div>';}
function printClientQr(){if(!activeClientVerification)return;const qr=$('#client-qr-code')?.innerHTML||'',name=activeClientVerification.clientName||'Client',code=activeClientVerification.code||'';const w=window.open('','_blank','width=760,height=900');if(!w)return;w.document.write(`<!doctype html><html><head><title>${escapeHtml(name)} QR code</title><style>body{font-family:Arial,sans-serif;padding:48px;text-align:center;color:#10212a}.sheet{border:2px solid #173b43;border-radius:18px;padding:42px;max-width:560px;margin:auto}h1{margin:0 0 8px}.qr{display:flex;justify-content:center;margin:30px}.code{font-size:24px;font-weight:700;letter-spacing:2px;background:#eef7f5;padding:14px;border-radius:10px}.note{margin-top:28px;font-size:14px;line-height:1.5}@media print{button{display:none}}</style></head><body><div class="sheet"><p>CoreCare visit verification</p><h1>${escapeHtml(name)}</h1><div class="qr">${qr}</div><div class="code">${escapeHtml(code)}</div><p class="note">Care workers: scan this code when arriving and leaving. Keep this sheet securely inside the client’s home.</p><button onclick="window.print()">Print</button></div></body></html>`);w.document.close();setTimeout(()=>w.print(),350);}
async function openClientDialog(id = '') {
  if(!hasAccess(id?'clients.edit':'clients.create')){denyPage();return;}
  clientForm.reset();
  $('#client-form-error').hidden = true;
  const requirementsList=$('#client-visit-requirements');if(requirementsList)requirementsList.innerHTML='';
  const startField=$('#client-visit-start-date');if(startField)startField.value=new Date().toISOString().slice(0,10);
  $('#client-id').value = '';
  $('#client-dialog-title').textContent = id ? 'Edit client' : 'Add client';
  if (id) {
    await loadClientVerification(id);
    const client = clients.find(item => item.id === id);
    if (client) {
      Object.entries(client).forEach(([key, value]) => {
        const field = clientForm.elements.namedItem(key);
        if (field) field.value = value ?? '';
      });
    }
    try {
      const payload=await api(`/api/clients/${encodeURIComponent(id)}/visit-requirements`);
      const requirements=payload.requirements||[];
      requirements.forEach(r=>addVisitRequirement({visitType:r.visit_type,preferredTime:r.preferred_time,windowMinutes:r.window_minutes,durationMinutes:r.duration_minutes,carersRequired:r.carers_required,notes:r.notes,schedulingRule:r.scheduling_rule,timeCriticalReason:r.time_critical_reason,days:r.days}));
      if(startField&&requirements[0]?.start_date)startField.value=requirements[0].start_date;
    } catch(error) {
      console.warn('Visit requirements could not be loaded',error);
    }
  } else { addVisitRequirement(); const section=$('#client-verification-section'); if(section)section.hidden=true; activeClientVerification=null; }
  clientDialog.showModal();
}

async function saveClient(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(clientForm));
  const error = $('#client-form-error');
  error.hidden = true;
  if (!data.firstName.trim() || !data.lastName.trim() || !data.town.trim() || !data.dateOfBirth || !data.nextReview) {
    error.textContent = 'Complete all required fields before saving.';
    error.hidden = false;
    return;
  }
  const submit = clientForm.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Saving…';
  try {
    const id = data.id;
    data.visitRequirements=collectVisitRequirements();
    if(!id&&!data.visitRequirements.length){throw new Error('Add at least one visit requirement so CoreCare can create the allocation queue.');}
    const payload = await api(id ? `/api/clients/${encodeURIComponent(id)}` : '/api/clients', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    await loadClients();
    renderClients();
    clientDialog.close();
    if (selectedClientId === payload.client.id) renderClientProfile(payload.client);
  } catch (saveError) {
    error.textContent = saveError.message;
    error.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Save client';
  }
}

async function openClientProfile(id) {
  selectedClientId = id;
  try {
    const payload = await api(`/api/clients/${encodeURIComponent(id)}`);
    renderClientProfile(payload.client);
    await loadClientWorkspace(id);
    showClientTab('overview');
    activatePage('#client-profile-page');
    pageKicker.textContent = 'Client record';
    pageTitle.textContent = clientDisplayName(payload.client);
  } catch (error) {
    showToastError(error);
  }
}

function detailRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || 'Not recorded')}</dd></div>`;
}

function noteCard(label, value, alert = false) {
  return `<section class="note-card ${alert ? 'alert-note' : ''}"><span>${escapeHtml(label)}</span><p>${escapeHtml(value || 'Nothing recorded')}</p></section>`;
}

function renderClientProfile(client) {
  selectedClientId = client.id;
  $('#profile-avatar').textContent = initialsFromName(`${client.firstName} ${client.lastName}`);
  $('#profile-name').textContent = clientDisplayName(client);
  $('#profile-subtitle').textContent = client.carePackage || 'Care package not yet recorded';
  $('#profile-badges').innerHTML = `<span class="badge ${client.status === 'Active' ? 'success' : client.status === 'Paused' ? 'active' : 'neutral'}">${escapeHtml(client.status)}</span><span class="badge neutral">NHS ${escapeHtml(client.nhsNumber || 'not recorded')}</span>`;
  $('#profile-review').textContent = `${formatDate(client.nextReview)}${reviewDue(client) ? ' · overdue' : ''}`;
  $('#profile-risk').textContent = client.risk;
  $('#profile-personal').innerHTML = [
    detailRow('Full name', `${client.firstName} ${client.lastName}`),
    detailRow('Preferred name', client.preferredName),
    detailRow('Date of birth', formatDate(client.dateOfBirth)),
    detailRow('NHS number', client.nhsNumber),
    detailRow('Status', client.status)
  ].join('');
  $('#profile-contact').innerHTML = [
    detailRow('Address', [client.addressLine1, client.addressLine2, client.town, client.postcode].filter(Boolean).join(', ')),
    detailRow('Phone', client.phone),
    detailRow('Email', client.email)
  ].join('');
  $('#profile-people').innerHTML = [
    detailRow('GP', [client.gpName, client.gpPractice].filter(Boolean).join(' · ')),
    detailRow('GP phone', client.gpPhone),
    detailRow('Next of kin', [client.nextOfKinName, client.nextOfKinRelationship].filter(Boolean).join(' · ')),
    detailRow('Next of kin phone', client.nextOfKinPhone),
    detailRow('Emergency contact', client.emergencyContactName),
    detailRow('Emergency phone', client.emergencyContactPhone)
  ].join('');
  $('#profile-care').innerHTML = [
    noteCard('Allergies', client.allergies, Boolean(client.allergies)),
    noteCard('Communication needs', client.communicationNeeds),
    noteCard('Capacity notes', client.capacityNotes),
    noteCard('Important notes', client.importantNotes)
  ].join('');
  $('#archive-profile-client').hidden = client.status === 'Archived' || !['owner', 'manager'].includes(currentUser?.role);
}


function showClientTab(name){
  $$('[data-client-tab]').forEach(b=>b.classList.toggle('active',b.dataset.clientTab===name));
  $$('.client-tab-panel').forEach(p=>p.classList.remove('active-tab-panel'));
  $(`#client-tab-${name}`)?.classList.add('active-tab-panel');
  if(name==='body-map') loadBodyMap().catch(showToastError);
}
async function loadClientWorkspace(id){
  const encoded=encodeURIComponent(id);
  const [plans,risks,documents]=await Promise.all([api(`/api/clients/${encoded}/care-plans`),api(`/api/clients/${encoded}/risks`),api(`/api/clients/${encoded}/documents`)]);
  carePlans=plans.carePlans||[]; clientRisks=risks.risks||[]; clientDocuments=documents.documents||[];
  renderCarePlans(); renderRisks(); renderDocuments();
}
function dueClass(date){return date && new Date(`${date}T23:59:59`)<new Date()?'date-overdue':'';}
function renderCarePlans(){
 const el=$('#care-plan-list'); if(!el)return;
 el.innerHTML=carePlans.length?carePlans.map(p=>`<article class="record-card"><header><div><p class="eyebrow">Version ${p.version}</p><h3>${escapeHtml(p.title)}</h3></div><span class="badge ${p.status==='Active'?'success':p.status==='Draft'?'active':'neutral'}">${escapeHtml(p.status)}</span></header><div class="record-meta"><span>Review: <strong class="${dueClass(p.reviewDate)}">${formatDate(p.reviewDate)}</strong></span><span>Author: ${escapeHtml(p.authorName||'Not recorded')}</span></div><p>${escapeHtml(p.planSummary||p.whatMatters||p.desiredOutcomes||'No plan summary recorded.')}</p><div class="care-plan-card-meta"><span>${(p.sections||[]).length} active domains</span><span class="badge ${p.approvalStatus==='approved'?'success':'active'}">${p.approvalStatus==='approved'?'Approved':'Approval pending'}</span></div><div class="record-actions"><button class="row-action" data-edit-plan="${escapeHtml(p.id)}">Open care plan</button></div></article>`).join(''):'<div class="empty-records">No care plans have been created for this client.</div>';
 $$('[data-edit-plan]').forEach(b=>b.addEventListener('click',()=>openCarePlanDialog(b.dataset.editPlan)));
}
function renderCarePlanDomains(sections=[]){
  const byCategory=Object.fromEntries((sections||[]).map(section=>[section.category,section]));
  const list=$('#care-plan-domain-list'); if(!list)return;
  list.innerHTML=carePlanDomainDefinitions.map(([category,title,description],index)=>{const section=byCategory[category]||{};const enabled=section.enabled!==false;return `<article class="care-plan-domain ${enabled?'enabled':'not-included'}" data-care-domain="${category}"><header><button type="button" class="care-domain-toggle" data-domain-toggle role="switch" aria-checked="${enabled?'true':'false'}" aria-label="${enabled?'Exclude':'Include'} ${escapeHtml(title)}"><span></span></button><button type="button" class="care-domain-heading" data-domain-expand><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><b>${enabled?'Included':'Not included'}</b></button></header><div class="care-domain-fields" aria-disabled="${enabled?'false':'true'}"${enabled?'':' style="display:none"'}><div class="form-grid"><label class="wide"><span>Assessed needs</span><textarea data-domain-field="assessedNeeds" rows="3" placeholder="What support is needed, why it is needed and the person's current level of independence.">${escapeHtml(section.assessedNeeds||'')}</textarea></label><label class="wide"><span>Desired outcomes</span><textarea data-domain-field="desiredOutcomes" rows="3" placeholder="What the person wants to achieve, maintain or avoid.">${escapeHtml(section.desiredOutcomes||'')}</textarea></label><label class="wide"><span>Staff support instructions</span><textarea data-domain-field="supportInstructions" rows="5" placeholder="Clear step-by-step guidance: what staff must do, when, how and when to escalate.">${escapeHtml(section.supportInstructions||'')}</textarea></label><label class="wide"><span>Risks and controls</span><textarea data-domain-field="risksControls" rows="3" placeholder="Known risks, preventative controls, warning signs and escalation action.">${escapeHtml(section.risksControls||'')}</textarea></label><label class="wide"><span>Personal preferences</span><textarea data-domain-field="personalPreferences" rows="3" placeholder="Choices, routines, preferred approach and things staff must avoid.">${escapeHtml(section.personalPreferences||'')}</textarea></label><label><span>Domain review date</span><input data-domain-field="reviewDate" type="date" value="${escapeHtml(section.reviewDate||'')}"></label></div></div></article>`}).join('');
  $$('#care-plan-domain-list [data-care-domain]').forEach(card=>{
    const enabled=card.querySelector('[data-domain-toggle]')?.getAttribute('aria-checked')!=='false';
    card.querySelectorAll('[data-domain-field]').forEach(field=>field.disabled=!enabled);
  });
  updateCarePlanProgress();
}
function updateCarePlanProgress(){const enabled=$$('#care-plan-domain-list [data-domain-toggle][aria-checked="true"]').length;setText('#care-plan-progress-count',`${enabled} / ${carePlanDomainDefinitions.length}`);}
function collectCarePlanSections(){return $$('#care-plan-domain-list [data-care-domain]').map((card,index)=>{const value=name=>card.querySelector(`[data-domain-field="${name}"]`)?.value||'';return {category:card.dataset.careDomain,title:card.querySelector('.care-domain-heading strong')?.textContent||card.dataset.careDomain,enabled:card.querySelector('[data-domain-toggle]')?.getAttribute('aria-checked')!=='false',assessedNeeds:value('assessedNeeds'),desiredOutcomes:value('desiredOutcomes'),supportInstructions:value('supportInstructions'),risksControls:value('risksControls'),personalPreferences:value('personalPreferences'),reviewDate:value('reviewDate'),sortOrder:index};}).filter(section=>section.enabled);}
function openCarePlanModal(){
  const modal=$('#care-plan-dialog');
  if(!modal)return;
  modal.hidden=false;
  document.body.classList.add('care-plan-modal-open');
}
function closeCarePlanModal(){
  const modal=$('#care-plan-dialog');
  if(!modal)return;
  modal.hidden=true;
  document.body.classList.remove('care-plan-modal-open');
}
function openCarePlanDialog(id=''){
  const form=$('#care-plan-form');form.reset();form.elements.id.value=id;$('#care-plan-error').hidden=true;const item=carePlans.find(x=>x.id===id);
  $('#care-plan-dialog-title').textContent=id?'Review structured care plan':'Create structured care plan';
  if(item)Object.entries(item).forEach(([k,v])=>{const f=form.elements.namedItem(k);if(f&&!Array.isArray(v))f.value=v??'';});
  else {form.elements.title.value='Comprehensive care and support plan';form.elements.planType.value='Comprehensive care plan';form.elements.authorName.value=currentUser?.displayName||'';const d=new Date();form.elements.effectiveDate.value=d.toISOString().slice(0,10);d.setMonth(d.getMonth()+6);form.elements.reviewDate.value=d.toISOString().slice(0,10);}
  renderCarePlanDomains(item?.sections||[]);openCarePlanModal();setTimeout(()=>form.elements.title.focus(),50);
}
async function saveCarePlan(e){e.preventDefault();const form=e.currentTarget,data=Object.fromEntries(new FormData(form)),error=$('#care-plan-error');data.sections=collectCarePlanSections();error.hidden=true;if(!data.sections.length){error.textContent='Enable and complete at least one care and support domain.';error.hidden=false;return;}try{await api(data.id?`/api/care-plans/${encodeURIComponent(data.id)}`:`/api/clients/${encodeURIComponent(selectedClientId)}/care-plans`,{method:data.id?'PUT':'POST',body:JSON.stringify(data)});closeCarePlanModal();await loadClientWorkspace(selectedClientId);await Promise.all([loadDashboard(),loadAllCarePlans().catch(()=>{})]);}catch(x){error.textContent=x.message;error.hidden=false;}}

function renderRisks(){const el=$('#risk-list');if(!el)return;el.innerHTML=clientRisks.length?clientRisks.map(r=>`<article class="record-card risk-${r.severity.toLowerCase()}"><header><div><p class="eyebrow">${escapeHtml(r.category)}</p><h3>${escapeHtml(r.title)}</h3></div><span class="badge ${r.severity==='High'?'danger':r.severity==='Medium'?'active':'success'}">${escapeHtml(r.severity)}</span></header><div class="record-meta"><span>${escapeHtml(r.likelihood)} likelihood</span><span class="${dueClass(r.reviewDate)}">Review ${formatDate(r.reviewDate)}</span><span>${escapeHtml(r.status)}</span></div><p><strong>Controls:</strong> ${escapeHtml(r.controls||'None recorded')}</p><div class="record-actions"><button class="row-action" data-edit-risk="${escapeHtml(r.id)}">Edit</button></div></article>`).join(''):'<div class="empty-records">No risk assessments have been recorded.</div>';$$('[data-edit-risk]').forEach(b=>b.addEventListener('click',()=>openRiskDialog(b.dataset.editRisk)));}
function openRiskDialog(id=''){const form=$('#risk-form');form.reset();form.elements.id.value=id;$('#risk-error').hidden=true;const item=clientRisks.find(x=>x.id===id);$('#risk-dialog-title').textContent=id?'Edit risk':'Add risk';if(item)Object.entries(item).forEach(([k,v])=>{const f=form.elements.namedItem(k);if(f)f.value=v??'';});$('#risk-dialog').showModal();}
async function saveRisk(e){e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget)),error=$('#risk-error');error.hidden=true;try{await api(data.id?`/api/risks/${encodeURIComponent(data.id)}`:`/api/clients/${encodeURIComponent(selectedClientId)}/risks`,{method:data.id?'PUT':'POST',body:JSON.stringify(data)});$('#risk-dialog').close();await loadClientWorkspace(selectedClientId);await loadDashboard();}catch(x){error.textContent=x.message;error.hidden=false;}}
function renderDocuments(){const el=$('#document-list');if(!el)return;el.innerHTML=clientDocuments.length?clientDocuments.map(d=>`<article class="record-card"><header><div><p class="eyebrow">${escapeHtml(d.documentType)}</p><h3>${escapeHtml(d.name)}</h3></div><span class="badge ${d.status==='Current'?'success':'neutral'}">${escapeHtml(d.status)}</span></header><div class="record-meta"><span>Dated ${formatDate(d.documentDate)}</span>${d.reviewDate?`<span class="${dueClass(d.reviewDate)}">Review ${formatDate(d.reviewDate)}</span>`:''}</div><p>${escapeHtml(d.notes||'No notes recorded.')}</p><div class="record-actions">${d.referenceUrl?`<a class="row-action" href="${escapeHtml(d.referenceUrl)}" target="_blank" rel="noopener">Open reference</a>`:''}${['owner','manager'].includes(currentUser?.role)?`<button class="row-action" data-archive-document="${escapeHtml(d.id)}">Archive</button>`:''}</div></article>`).join(''):'<div class="empty-records">No document records have been added.</div>';$$('[data-archive-document]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Archive this document record?')){await api(`/api/documents/${encodeURIComponent(b.dataset.archiveDocument)}`,{method:'DELETE'});await loadClientWorkspace(selectedClientId);}}));}
async function saveDocument(e){e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget)),error=$('#document-error');error.hidden=true;try{await api(`/api/clients/${encodeURIComponent(selectedClientId)}/documents`,{method:'POST',body:JSON.stringify(data)});$('#document-dialog').close();e.currentTarget.reset();await loadClientWorkspace(selectedClientId);}catch(x){error.textContent=x.message;error.hidden=false;}}

async function archiveSelectedClient() {
  const client = clients.find(item => item.id === selectedClientId);
  if (!client) return;
  if (!window.confirm(`Archive ${client.firstName} ${client.lastName}? The record will remain available under the Archived filter.`)) return;
  try {
    await api(`/api/clients/${encodeURIComponent(selectedClientId)}`, { method: 'DELETE' });
    await loadClients();
    renderClients();
    showPage('clients');
  } catch (error) {
    showToastError(error);
  }
}

function showToast(message, type = 'success') {
  const text = String(message || 'Done.');
  let toast = document.querySelector('#corecare-action-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'corecare-action-toast';
    toast.className = 'corecare-error-toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<strong></strong><span></span><button type="button" aria-label="Dismiss">×</button>';
    document.body.appendChild(toast);
    toast.querySelector('button')?.addEventListener('click', () => toast.classList.remove('visible'));
  }
  toast.classList.toggle('success', type !== 'error');
  const heading = toast.querySelector('strong');
  const copy = toast.querySelector('span');
  if (heading) heading.textContent = type === 'error' ? 'CoreCare could not complete the request' : 'CoreCare';
  if (copy) copy.textContent = text;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast?.classList.remove('visible'), 6000);
}

function showToastError(error) {
  const message = error?.message || 'CoreCare could not complete the request.';
  console.error(error);
  let toast = $('#corecare-error-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'corecare-error-toast';
    toast.className = 'corecare-error-toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = '<strong>CoreCare could not complete part of the request</strong><span></span><button type="button" aria-label="Dismiss">×</button>';
    document.body.appendChild(toast);
    toast.querySelector('button')?.addEventListener('click', () => toast.remove());
  }
  const copy = toast.querySelector('span');
  if (copy) copy.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToastError.timer);
  showToastError.timer = setTimeout(() => toast?.classList.remove('visible'), 9000);
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.hidden = true;
  const data = new FormData(loginForm);
  const submit = loginForm.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  try {
    const payload = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: String(data.get('email') || '').trim().toLowerCase(), password: String(data.get('password') || '') }) });
    await showApplication(payload.user);
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Sign in to CoreCare';
  }
});

$('#toggle-password').addEventListener('click', event => {
  const field = $('#password');
  const reveal = field.type === 'password';
  field.type = reveal ? 'text' : 'password';
  event.currentTarget.textContent = reveal ? 'Hide' : 'Show';
});

$('#sign-out').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  showLogin();
});

menuButton.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});

document.querySelector('.sidebar nav')?.addEventListener('click', event => {
  const button=event.target.closest('.nav-item');
  if(!button)return;
  $$('.nav-item').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  sidebar.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  if(button.dataset.page)showPage(button.dataset.page);
});

$$('[data-page-link]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.pageLink)));
$('[data-return-dashboard]').addEventListener('click', () => showPage('dashboard'));
$('#add-client')?.addEventListener('click', () => openClientDialog());
$('#add-staff')?.addEventListener('click', () => openStaffDialog());
$('#close-staff-dialog').addEventListener('click', () => staffDialog.close());
$('#cancel-staff').addEventListener('click', () => staffDialog.close());
$('#staff-search').addEventListener('input', renderStaff);
$('#staff-status-filter').addEventListener('change', renderStaff);
staffForm.addEventListener('submit', saveStaff);
$('#staff-create-login')?.addEventListener('change',toggleStaffLoginFields);
$('#quick-add').addEventListener('click', () => quickAddDialog.showModal());
$('#close-quick-add').addEventListener('click', () => quickAddDialog.close());
$$('[data-quick]').forEach(button => button.addEventListener('click', () => {
  quickAddDialog.close();
  if (button.dataset.quick === 'client') { $('[data-page="clients"]').click(); openClientDialog(); }
  if (button.dataset.quick === 'staff') { $('[data-page="staff"]').click(); openStaffDialog(); }
}));
$('#close-client-dialog').addEventListener('click', () => clientDialog.close());
$('#cancel-client').addEventListener('click', () => clientDialog.close());
$('#client-print-qr')?.addEventListener('click',printClientQr);
$('#client-regenerate-code')?.addEventListener('click',async()=>{if(!activeClientVerification||!confirm('Regenerate this client code? Every previously printed QR code will stop working.'))return;const payload=await api('/api/visits/client-code',{method:'POST',body:JSON.stringify({clientId:activeClientVerification.clientId,regenerate:true})});activeClientVerification={...payload,clientId:activeClientVerification.clientId};renderClientVerification(payload);});
clientSearch.addEventListener('input', renderClients);
clientStatusFilter.addEventListener('change', renderClients);
clientForm.addEventListener('submit', saveClient);
$('#care-search').addEventListener('input', renderAllCarePlans);
$('#care-status-filter').addEventListener('change', renderAllCarePlans);
$('#care-open-clients').addEventListener('click', openCareClientPicker);
$('#close-care-client-picker').addEventListener('click', () => careClientPickerDialog.close());
$('#cancel-care-client-picker').addEventListener('click', () => careClientPickerDialog.close());
$('#care-client-picker-search').addEventListener('input', renderCareClientPicker);
$('#back-to-clients').addEventListener('click', () => $('[data-page="clients"]').click());
$('#edit-profile-client').addEventListener('click', () => openClientDialog(selectedClientId));
$('#archive-profile-client').addEventListener('click', archiveSelectedClient);

$$('[data-client-tab]').forEach(button => button.addEventListener('click', () => showClientTab(button.dataset.clientTab)));
$('#add-care-plan').addEventListener('click', () => openCarePlanDialog());
document.addEventListener('click',event=>{const toggle=event.target.closest?.('[data-domain-toggle]');if(!toggle)return;event.preventDefault();event.stopPropagation();const card=toggle.closest('[data-care-domain]');if(!card)return;const enabled=toggle.getAttribute('aria-checked')!=='true';toggle.setAttribute('aria-checked',enabled?'true':'false');toggle.setAttribute('aria-label',`${enabled?'Exclude':'Include'} ${card.querySelector('.care-domain-heading strong')?.textContent||'section'}`);const badge=card.querySelector('.care-domain-heading b');if(badge)badge.textContent=enabled?'Included':'Not included';const fields=card.querySelector('.care-domain-fields');if(fields){fields.style.display=enabled?'':'none';fields.setAttribute('aria-disabled',enabled?'false':'true');}updateCarePlanProgress();});
document.addEventListener('click',event=>{const heading=event.target.closest?.('[data-domain-expand]');if(heading){event.preventDefault();heading.closest('[data-care-domain]')?.querySelector('[data-domain-field]:not(:disabled)')?.focus();}const jump=event.target.closest?.('[data-plan-jump]');if(jump){event.preventDefault();$('#'+jump.dataset.planJump)?.scrollIntoView({behavior:'smooth',block:'start'});}});
$('#close-care-plan-dialog').addEventListener('click', closeCarePlanModal);
$('#cancel-care-plan').addEventListener('click', closeCarePlanModal);
$('#care-plan-form').addEventListener('submit', saveCarePlan);
$('#add-risk').addEventListener('click', () => openRiskDialog());
$('#close-risk-dialog').addEventListener('click', () => $('#risk-dialog').close());
$('#cancel-risk').addEventListener('click', () => $('#risk-dialog').close());
$('#risk-form').addEventListener('submit', saveRisk);
$('#add-document').addEventListener('click', () => $('#document-dialog').showModal());
$('#close-document-dialog').addEventListener('click', () => $('#document-dialog').close());
$('#cancel-document').addEventListener('click', () => $('#document-dialog').close());
$('#document-form').addEventListener('submit', saveDocument);

function openPasswordDialog(required = false) {
  passwordForm.reset();
  $('#password-error').hidden = true;
  passwordDialog.dataset.required = required ? 'true' : 'false';
  $('#cancel-password').hidden = required;
  passwordDialog.showModal();
}

$('#open-password').addEventListener('click', () => openPasswordDialog(false));
$('#cancel-password').addEventListener('click', () => passwordDialog.close());
passwordDialog.addEventListener('cancel', event => { if (passwordDialog.dataset.required === 'true') event.preventDefault(); });
passwordForm.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(passwordForm));
  const error = $('#password-error');
  error.hidden = true;
  if (data.newPassword !== data.confirmPassword) {
    error.textContent = 'The new passwords do not match.';
    error.hidden = false;
    return;
  }
  try {
    await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data) });
    currentUser.mustChangePassword = false;
    passwordDialog.close();
    await showApplication(currentUser);
  } catch (exception) {
    error.textContent = exception.message;
    error.hidden = false;
  }
});

function applyOrganisationBranding(org){
  if(!org)return;
  if(org.primary_colour)document.documentElement.style.setProperty('--brand',org.primary_colour);
  const name=org.name||currentUser?.organisationName;
  if(name)document.title=`${name} · CoreCare`;
}
async function loadOrganisationProfile(){
  const payload=await api('/api/organisation/profile'); const o=payload.organisation||{};
  $('#organisation-input').value=o.name||''; $('#organisation-logo').value=o.logo_url||''; $('#organisation-colour').value=o.primary_colour||'#1f6f5f'; $('#organisation-contact-email').value=o.contact_email||''; $('#organisation-contact-phone').value=o.contact_phone||''; applyOrganisationBranding(o);
}
async function loadSettings() {
  if (!currentUser) return;
  await loadOrganisationProfile();
  const canAdmin = ['platform_owner','platform_admin','organisation_owner','organisation_admin'].includes(currentUser.accessLevel) || (['platform_owner','organisation_owner','organisation_admin'].includes(currentUser.accessLevel) || currentUser.role === 'owner');
  $('#add-user').hidden = !canAdmin;
  $('#add-branch').hidden = !canAdmin;
  $('#platform-admin-panel').hidden = !currentUser.isPlatformUser || currentUser.supportMode;
  try {
    const [userPayload, branchPayload] = await Promise.all([api('/api/users'), api('/api/branches')]);
    users = userPayload.users || [];
    branches = branchPayload.branches || [];
    renderUsers(); renderBranches(); populateBranchSelect();
    await loadEnterpriseSecurity();
    if(currentUser.isPlatformUser && !currentUser.supportMode) await loadOrganisations();
    await loadAudit();
  await loadOrganisationCustomisation();
  } catch (error) {
    $('#user-table-body').innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderUsers() {
  const own = currentUser?.id;
  $('#user-table-body').innerHTML = users.map(user => `<tr><td><div class="client-person"><span class="person-avatar">${initialsFromName(user.displayName)}</span><div><strong>${escapeHtml(user.displayName)}</strong><span>${escapeHtml(user.email)}${user.mustChangePassword ? ' · password change required' : ''}</span></div></div></td><td>${escapeHtml(roleLabel(user.accessLevel || user.role))}</td><td>${user.customRoleName?`<span class="role-pill"><i style="--role-colour:${escapeHtml(customRoles.find(r=>r.id===user.customRoleId)?.colour||'#0f766e')}"></i>${escapeHtml(user.customRoleName)}</span>`:'<span class="muted">Standard permissions</span>'}</td><td><span class="badge ${user.status === 'active' ? 'success' : 'neutral'}">${escapeHtml(user.status)}</span></td><td>${user.lastLoginAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(user.lastLoginAt)) : 'Never'}</td><td>${(['platform_owner','organisation_owner','organisation_admin'].includes(currentUser.accessLevel) || currentUser.role === 'owner') && user.id !== own ? `<button class="row-action" data-edit-user="${escapeHtml(user.id)}">Edit</button>` : ''}</td></tr>`).join('');
  $$('[data-edit-user]').forEach(button => button.addEventListener('click', () => openUserDialog(button.dataset.editUser)));
}

function openUserDialog(id = '') {
  userForm.reset();
  $('#user-form-error').hidden = true;
  userForm.elements.id.value = id;
  const editing = Boolean(id);
  const user = users.find(item => item.id === id);
  $('#user-dialog-title').textContent = editing ? 'Edit user' : 'Add user';
  userForm.elements.email.disabled = editing;
  userForm.elements.status.disabled = !editing;
  $('#temporary-password-label').hidden = editing;
  if (user) {
    userForm.elements.displayName.value = user.displayName;
    userForm.elements.email.value = user.email;
    userForm.elements.accessLevel.value = user.accessLevel || user.role;
    userForm.elements.branchId.value = user.branchId || "";
    userForm.elements.customRoleId.value = user.customRoleId || "";
    userForm.elements.status.value = user.status;
  }
  userDialog.showModal();
}

$('#add-user').addEventListener('click', () => openUserDialog());
$('#close-user-dialog').addEventListener('click', () => userDialog.close());
$('#cancel-user').addEventListener('click', () => userDialog.close());
userForm.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(userForm));
  const error = $('#user-form-error');
  error.hidden = true;
  try {
    if (data.id) await api(`/api/users/${encodeURIComponent(data.id)}`, { method: 'PUT', body: JSON.stringify(data) });
    else await api('/api/users', { method: 'POST', body: JSON.stringify(data) });
    userDialog.close();
    await loadSettings();
  } catch (exception) {
    error.textContent = exception.message;
    error.hidden = false;
  }
});

function updateBrandingPreview(){
  const primary=$('#organisation-colour')?.value||'#1f6f5f',secondary=$('#organisation-secondary-colour')?.value||'#0f172a';
  const preview=$('#branding-preview');if(!preview)return;preview.style.setProperty('--preview-primary',primary);preview.style.setProperty('--preview-secondary',secondary);
  $('#preview-name').textContent=$('#organisation-input')?.value||'Organisation';$('#preview-short').textContent=$('#organisation-short-name')?.value||'Care management';$('#preview-welcome').textContent=$('#organisation-welcome')?.value||'Welcome to your care operations workspace';$('#preview-clients').textContent=($('#term-client')?.value||'Client')+'s';$('#preview-staff').textContent=($('#term-carer')?.value||'Carer')+'s';
  $('#preview-logo').textContent=initialsFromName($('#organisation-input')?.value||'CoreCare');
}
async function loadOrganisationCustomisation(){
  const p=await api('/api/organisation/profile'),o=p.organisation||{};
  const set=(id,v)=>{const e=$(id);if(e)e.value=v||''};set('#organisation-input',o.name);set('#organisation-short-name',o.short_name);set('#organisation-logo',o.logo_url);set('#organisation-colour',o.primary_colour||'#1f6f5f');set('#organisation-secondary-colour',o.secondary_colour||'#0f172a');set('#organisation-contact-email',o.contact_email);set('#organisation-contact-phone',o.contact_phone);set('#organisation-website',o.website);set('#organisation-welcome',o.dashboard_welcome);set('#organisation-timezone',o.timezone||'Europe/London');set('#organisation-week-start',o.week_start||'monday');set('#organisation-time-format',o.time_format||'24h');set('#organisation-document-footer',o.document_footer);set('#organisation-invoice-footer',o.invoice_footer);set('#term-client',o.terminology?.client||'Client');set('#term-carer',o.terminology?.carer||'Carer');set('#term-branch',o.terminology?.branch||'Branch');
  $$('input[name="dashboardWidget"]').forEach(x=>x.checked=(o.dashboardWidgets||[]).includes(x.value));updateBrandingPreview();applyOrganisationBranding(o);
}
function applyPortalBranding(o){document.documentElement.style.setProperty('--organisation-primary',o.primary_colour||'#1f6f5f');document.documentElement.style.setProperty('--organisation-secondary',o.secondary_colour||'#0f172a');const brand=document.querySelector('.sidebar-brand strong');if(brand)brand.textContent=o.short_name||o.name||'CoreCare';}
$('#organisation-form').addEventListener('input',updateBrandingPreview);
$('#organisation-form').addEventListener('submit',async event=>{event.preventDefault();const f=new FormData(event.currentTarget),data=Object.fromEntries(f);data.terminology={client:data.termClient,carer:data.termCarer,branch:data.termBranch};data.dashboardWidgets=f.getAll('dashboardWidget');const message=$('#organisation-message');message.hidden=true;try{const payload=await api('/api/organisation/profile',{method:'PUT',body:JSON.stringify(data)});currentUser.organisationName=payload.organisation.name;applyPortalBranding(payload.organisation);updateIdentity();message.textContent='Portal customisation saved.';message.hidden=false;}catch(error){message.textContent=error.message;message.hidden=false;}});


function populateCustomRoleSelect(){const select=$('#user-custom-role-select');if(!select)return;const current=select.value;select.innerHTML='<option value="">Use standard access level</option>'+customRoles.filter(r=>r.is_active!==0).map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');select.value=current;}
async function loadEnterpriseSecurity(){
  const canSee=['platform_owner','platform_admin','organisation_owner','organisation_admin'].includes(currentUser?.accessLevel);
  const panel=$('.enterprise-security-panel');if(panel)panel.hidden=!canSee;if(!canSee)return;
  const [overview,roles,permissions,policy,sessions]=await Promise.all([api('/api/security/overview'),api('/api/security/roles'),api('/api/security/permissions'),api('/api/security/policy'),api('/api/security/sessions')]);
  customRoles=roles.roles||[];permissionCatalogue=permissions.permissions||[];
  $('#security-role-count').textContent=overview.customRoles||0;$('#security-user-count').textContent=overview.activeUsers||0;$('#security-session-count').textContent=overview.activeSessions||0;$('#security-event-count').textContent=overview.securityEvents24h||0;
  renderCustomRoles();populateCustomRoleSelect();renderActiveSessions(sessions);fillSecurityPolicy(policy.policy||{});renderUsers();populatePermissionUserSelect();await loadOrganisationModules();loadRoutingSettings();
}
function renderCustomRoles(){const el=$('#custom-role-list');if(!el)return;el.innerHTML=customRoles.length?customRoles.map(r=>`<article class="role-card" data-edit-role="${escapeHtml(r.id)}"><div class="role-card-icon" style="--role-colour:${escapeHtml(r.colour||'#0f766e')}">${initialsFromName(r.name)}</div><div><strong>${escapeHtml(r.name)}</strong><p>${escapeHtml(r.description||'No description')}</p><small>${r.permission_count||0} permissions · ${r.user_count||0} users</small></div><button class="row-action">Manage</button></article>`).join(''):'<div class="empty-state"><strong>No custom roles yet</strong><span>Create a role for job-specific access without changing the built-in access levels.</span></div>';$$('[data-edit-role]').forEach(x=>x.addEventListener('click',()=>openRoleDialog(x.dataset.editRole)));}
function renderPermissionGroups(selected=[]){const query=($('#permission-search')?.value||'').toLowerCase();const groups={};permissionCatalogue.filter(p=>!query||`${p.category} ${p.name} ${p.description}`.toLowerCase().includes(query)).forEach(p=>(groups[p.category]??=[]).push(p));$('#permission-groups').innerHTML=Object.entries(groups).map(([category,items])=>`<fieldset class="permission-group"><legend>${escapeHtml(category)} <span>${items.length}</span></legend>${items.map(p=>`<label class="permission-item ${p.risk_level}"><input type="checkbox" name="permission" value="${escapeHtml(p.permission_key)}" ${selected.includes(p.permission_key)?'checked':''}><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.description||'')}</small></span><em>${escapeHtml(p.risk_level)}</em></label>`).join('')}</fieldset>`).join('')||'<p class="muted">No permissions match your search.</p>';}
const roleDialog=$('#role-dialog'),roleForm=$('#role-form');
function openRoleDialog(id=''){roleForm.reset();roleForm.elements.id.value=id;$('#role-form-error').hidden=true;const role=customRoles.find(r=>r.id===id);$('#role-dialog-title').textContent=role?'Edit custom role':'Create custom role';$('#delete-role').hidden=!role;if(role){roleForm.elements.name.value=role.name;roleForm.elements.description.value=role.description||'';roleForm.elements.colour.value=role.colour||'#0f766e';}renderPermissionGroups(role?.permissions?.filter(p=>p.effect==='allow').map(p=>p.permission_key)||[]);roleDialog.showModal();}
$('#add-custom-role')?.addEventListener('click',()=>openRoleDialog());$('#close-role-dialog')?.addEventListener('click',()=>roleDialog.close());$('#cancel-role')?.addEventListener('click',()=>roleDialog.close());
$('#permission-search')?.addEventListener('input',()=>{const selected=[...roleForm.querySelectorAll('input[name="permission"]:checked')].map(x=>x.value);renderPermissionGroups(selected)});
$('#clear-permissions')?.addEventListener('click',()=>$$('#permission-groups input[type="checkbox"]').forEach(x=>x.checked=false));
$('#select-safe-permissions')?.addEventListener('click',()=>$$('#permission-groups .permission-item:not(.critical) input').forEach(x=>x.checked=true));
roleForm?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(roleForm),data=Object.fromEntries(f);data.permissions=f.getAll('permission');try{if(data.id)await api(`/api/security/roles/${encodeURIComponent(data.id)}`,{method:'PUT',body:JSON.stringify(data)});else await api('/api/security/roles',{method:'POST',body:JSON.stringify(data)});roleDialog.close();await loadEnterpriseSecurity();}catch(error){$('#role-form-error').textContent=error.message;$('#role-form-error').hidden=false;}});
$('#delete-role')?.addEventListener('click',async()=>{const id=roleForm.elements.id.value;if(!id||!confirm('Delete this custom role? Users will return to their standard access level.'))return;try{await api(`/api/security/roles/${encodeURIComponent(id)}`,{method:'DELETE'});roleDialog.close();await loadEnterpriseSecurity();}catch(error){$('#role-form-error').textContent=error.message;$('#role-form-error').hidden=false;}});
function fillSecurityPolicy(p){const f=$('#security-policy-form');if(!f)return;f.elements.sessionHours.value=String(p.session_hours||12);f.elements.idleTimeoutMinutes.value=String(p.idle_timeout_minutes||60);}
$('#security-policy-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,data={sessionHours:Number(f.elements.sessionHours.value),idleTimeoutMinutes:Number(f.elements.idleTimeoutMinutes.value)},m=$('#security-policy-message');try{await api('/api/security/policy',{method:'PUT',body:JSON.stringify(data)});m.textContent='Session policy saved. Cloudflare Access continues to enforce identity and MFA.';m.hidden=false;}catch(error){m.textContent=error.message;m.hidden=false;}});
function renderActiveSessions(payload){const el=$('#active-session-list');if(!el)return;el.innerHTML=(payload.sessions||[]).map(s=>`<article class="session-row"><div class="session-device"><span>${/Mobile|Android|iPhone/i.test(s.user_agent||'')?'▯':'▣'}</span><div><strong>${escapeHtml(s.display_name)}</strong><small>${escapeHtml(s.email)} · ${escapeHtml((s.user_agent||'Unknown device').slice(0,90))}</small></div></div><div><b>${s.id===payload.currentSessionId?'Current session':'Active'}</b><small>${escapeHtml(s.ip_hint||'IP unavailable')} · last seen ${new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short'}).format(new Date(`${s.last_seen_at||s.created_at}Z`))}</small></div>${s.id===payload.currentSessionId?'<span class="badge success">This device</span>':`<button class="row-action danger-text" data-revoke-session="${escapeHtml(s.id)}">Revoke</button>`}</article>`).join('')||'<p class="muted">No active sessions.</p>';$$('[data-revoke-session]').forEach(x=>x.addEventListener('click',async()=>{if(!confirm('Revoke this session immediately?'))return;await api(`/api/security/sessions/${encodeURIComponent(x.dataset.revokeSession)}`,{method:'DELETE'});await refreshActiveSessions();}));}
async function refreshActiveSessions(){const p=await api('/api/security/sessions');renderActiveSessions(p);$('#security-session-count').textContent=(p.sessions||[]).length;}
$('#refresh-sessions')?.addEventListener('click',refreshActiveSessions);

async function loadAudit() {
  const payload = await api('/api/audit?limit=30');
  $('#audit-list').innerHTML = (payload.events || []).map(event => `<div><time>${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(`${event.created_at}Z`))}</time><div><strong>${escapeHtml(event.action.replaceAll('.', ' '))}</strong><span>${escapeHtml(event.user_name || event.user_email || 'System')} · ${escapeHtml(event.entity_type)}</span></div></div>`).join('') || '<p>No audit events yet.</p>';
}

$('#refresh-audit').addEventListener('click', loadAudit);

function populateBranchSelect(){
  const select=$('#user-branch-select'); if(!select)return;
  const current=select.value;
  select.innerHTML='<option value="">Organisation-wide</option>'+branches.filter(b=>b.status==='active').map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('');
  select.value=current;
}
function renderBranches(){
  const list=$('#branch-list'); if(!list)return;
  list.innerHTML=branches.map(b=>`<article class="record-card"><div class="record-card-heading"><div><p class="eyebrow">${escapeHtml(b.code||'Branch')}</p><h3>${escapeHtml(b.name)}</h3></div><span class="badge ${b.status==='active'?'success':'neutral'}">${escapeHtml(b.status)}</span></div><p>${escapeHtml(b.address||'No address recorded')}</p><small>${escapeHtml(b.phone||'')} ${escapeHtml(b.email||'')}</small><div class="record-card-actions"><button type="button" class="secondary-button compact" data-edit-branch="${escapeHtml(b.id)}">Edit branch</button></div></article>`).join('')||'<div class="empty-state"><strong>No branches found</strong></div>';
  $$('[data-edit-branch]').forEach(button=>button.addEventListener('click',()=>openBranchDialog(button.dataset.editBranch)));
}
async function loadOrganisations(){const p=await api('/api/platform/organisations');organisations=p.organisations||[];renderOrganisations();}
function renderOrganisations(){
  const list=$('#organisation-admin-list');if(!list)return;const current=organisations.filter(o=>o.status!=='archived'),archived=organisations.filter(o=>o.status==='archived');
  const cards=rows=>rows.map(o=>`<article class="record-card"><div class="record-card-heading"><div><p class="eyebrow">${escapeHtml(o.plan_name||o.subscription_plan||'development')}</p><h3>${escapeHtml(o.name)}</h3></div><span class="badge ${o.status==='active'?'success':o.status==='archived'?'neutral':'danger'}">${escapeHtml(o.status)}</span></div><p>${o.branch_count||0} branches · ${o.user_count||0}/${o.effective_max_users??'∞'} users · ${o.client_count||0}/${o.effective_max_clients??'∞'} clients</p><div class="record-card-actions"><button class="secondary-button" data-platform-manage-org="${escapeHtml(o.id)}">Organisation 360</button>${o.status==='active'?`<button class="secondary-button" data-platform-open-org="${escapeHtml(o.id)}">Support</button>`:''}</div></article>`).join('');
  list.innerHTML=cards(current)||'<div class="empty-state"><strong>No current organisations</strong></div>';
  if(archived.length)list.insertAdjacentHTML('beforeend',`<details class="archived-records"><summary>Archived organisations (${archived.length})</summary><div class="record-grid">${cards(archived)}</div></details>`);
  $$('[data-platform-manage-org]').forEach(button=>button.addEventListener('click',()=>managePlatformOrganisation(button.dataset.platformManageOrg)));
  $$('[data-platform-open-org]').forEach(button=>button.addEventListener('click',()=>openPlatformOrganisation(button.dataset.platformOpenOrg)));
}
const branchDialog=$('#branch-dialog'),branchForm=$('#branch-form'),organisationDialog=$('#organisation-dialog'),organisationAdminForm=$('#organisation-admin-form');
function openBranchDialog(branchId=''){
  if(!branchForm||!branchDialog)return;
  branchForm.reset();
  $('#branch-form-error').hidden=true;
  const branch=branches.find(item=>item.id===branchId);
  branchForm.elements.id.value=branch?.id||'';
  branchForm.elements.name.value=branch?.name||'';
  branchForm.elements.code.value=branch?.code||'';
  branchForm.elements.address.value=branch?.address||'';
  branchForm.elements.phone.value=branch?.phone||'';
  branchForm.elements.email.value=branch?.email||'';
  branchForm.elements.status.value=branch?.status||'active';
  $('#branch-dialog-title').textContent=branch?'Edit branch':'Add branch';
  $('#branch-submit').textContent=branch?'Save changes':'Create branch';
  branchDialog.showModal();
}
$('#add-branch')?.addEventListener('click',()=>openBranchDialog());
$('#close-branch-dialog')?.addEventListener('click',()=>branchDialog.close());$('#cancel-branch')?.addEventListener('click',()=>branchDialog.close());
branchForm?.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(branchForm)),id=data.id;delete data.id;try{await api(id?`/api/branches/${encodeURIComponent(id)}`:'/api/branches',{method:id?'PUT':'POST',body:JSON.stringify(data)});branchDialog.close();const p=await api('/api/branches');branches=p.branches||[];renderBranches();populateBranchSelect();}catch(x){$('#branch-form-error').textContent=x.message;$('#branch-form-error').hidden=false;}});
$('#add-organisation')?.addEventListener('click',()=>{organisationAdminForm.reset();populateSubscriptionPlanSelects();if(organisationAdminForm.elements.subscriptionPlan)organisationAdminForm.elements.subscriptionPlan.value=platformPlans.some(plan=>plan.id==='limited'&&plan.status==='active')?'limited':organisationAdminForm.elements.subscriptionPlan.value;$('#organisation-admin-error').hidden=true;organisationDialog.showModal();});
$('#close-organisation-dialog')?.addEventListener('click',()=>organisationDialog.close());$('#cancel-organisation')?.addEventListener('click',()=>organisationDialog.close());
organisationAdminForm?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/platform/organisations',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(organisationAdminForm)))});organisationDialog.close();await loadOrganisations();}catch(x){$('#organisation-admin-error').textContent=x.message;$('#organisation-admin-error').hidden=false;}});

$$('[data-platform-target]').forEach(button => button.addEventListener('click', event => {
  event.preventDefault();
  showPage('platform');
  if(button.dataset.productCode) selectedPortalProductCode=button.dataset.productCode;
  showPlatformView(button.dataset.platformTarget || 'platform-page');
  if(button.dataset.platformTarget==='platform-workflow-engine') loadWorkflowEngine().catch(error=>alert(error.message));
  if(button.dataset.platformTarget==='platform-notification-centre') loadNotifications().catch(error=>alert(error.message));
}));
window.addEventListener('popstate', event => {
  if (currentUser?.isPlatformUser && !currentUser?.supportMode) {
    showPage('platform');
    showPlatformView(event.state?.platformView || (location.hash && location.hash !== '#platform' ? location.hash.slice(1) : 'platform-page'), false);
  }
});

$('#platform-org-search')?.addEventListener('input',renderPlatformOrganisations);
$('#platform-org-status')?.addEventListener('change',renderPlatformOrganisations);
$('#platform-add-organisation')?.addEventListener('click',()=>$('#add-organisation')?.click());



let workflowData=[];
async function loadWorkflowEngine(){
  if(!$('#workflow-list'))return;const status=$('#workflow-status-filter')?.value||'all';
  const [wf,runs]=await Promise.all([api(`/api/platform/workflows?status=${encodeURIComponent(status)}`),api('/api/platform/workflows/runs?limit=40')]);
  workflowData=wf.workflows||[];renderWorkflowList();renderWorkflowRuns(runs.runs||[]);
}
function renderWorkflowList(){
  const list=$('#workflow-list');if(!list)return;const active=workflowData.filter(x=>x.status==='active').length;
  $('#workflow-total').textContent=workflowData.length;$('#workflow-active').textContent=active;
  list.innerHTML=workflowData.map(w=>`<article class="workflow-card" data-workflow-edit="${escapeHtml(w.id)}"><div class="workflow-card-head"><div><strong>${escapeHtml(w.name)}</strong><small>${escapeHtml((w.trigger_type||'').replaceAll('_',' '))}</small></div><span class="badge ${w.status==='active'?'success':w.status==='paused'?'warning':'neutral'}">${escapeHtml(w.status)}</span></div><small>${escapeHtml(w.scope==='organisation'?(w.organisation_name||'Organisation'):'Platform-wide')} · v${w.version||1} · ${w.run_count||0} runs</small><div class="workflow-card-actions"><button class="row-action" data-workflow-run="${escapeHtml(w.id)}">Test run</button><button class="row-action danger-text" data-workflow-delete="${escapeHtml(w.id)}">Delete</button></div></article>`).join('')||'<div class="empty-state"><strong>No workflows yet</strong><span>Create your first automation using the builder.</span></div>';
  $$('[data-workflow-edit]').forEach(x=>x.addEventListener('click',e=>{if(e.target.closest('button'))return;editWorkflow(x.dataset.workflowEdit)}));
  $$('[data-workflow-run]').forEach(x=>x.addEventListener('click',async e=>{e.stopPropagation();x.disabled=true;try{await api(`/api/platform/workflows/${encodeURIComponent(x.dataset.workflowRun)}/run`,{method:'POST',body:'{}'});await loadWorkflowEngine();}catch(err){alert(err.message)}finally{x.disabled=false}}));
  $$('[data-workflow-delete]').forEach(x=>x.addEventListener('click',async e=>{e.stopPropagation();if(!confirm('Delete this workflow and its run history?'))return;await api(`/api/platform/workflows/${encodeURIComponent(x.dataset.workflowDelete)}`,{method:'DELETE'});resetWorkflowForm();await loadWorkflowEngine();}));
}
function renderWorkflowRuns(rows){
  const today=new Date().toISOString().slice(0,10);$('#workflow-runs-today').textContent=rows.filter(x=>(x.started_at||'').slice(0,10)===today).length;$('#workflow-failed').textContent=rows.filter(x=>x.status==='failed').length;
  $('#workflow-runs').innerHTML=rows.map(r=>`<tr><td><strong>${escapeHtml(r.workflow_name)}</strong><small>${escapeHtml((r.trigger_type||'').replaceAll('_',' '))}</small></td><td>${escapeHtml(r.organisation_name||'Platform')}</td><td><span class="badge ${r.status==='completed'?'success':r.status==='failed'?'danger':'warning'}">${escapeHtml(r.status)}</span></td><td>${new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short'}).format(new Date(`${r.started_at}${String(r.started_at).endsWith('Z')?'':'Z'}`))}</td><td>${r.duration_ms==null?'—':Number(r.duration_ms).toLocaleString('en-GB')+' ms'}</td><td>${r.actions_completed||0}/${r.actions_total||0}</td></tr>`).join('')||'<tr><td colspan="6">No workflow runs recorded.</td></tr>';
}
function resetWorkflowForm(){const f=$('#workflow-form');if(!f)return;f.reset();f.elements.id.value='';$('#workflow-builder-title').textContent='Create workflow';$('#workflow-form-message').hidden=true;}
function editWorkflow(id){const w=workflowData.find(x=>x.id===id),f=$('#workflow-form');if(!w||!f)return;f.elements.id.value=w.id;f.elements.name.value=w.name||'';f.elements.description.value=w.description||'';f.elements.scope.value=w.scope||'platform';f.elements.status.value=w.status||'draft';f.elements.triggerType.value=w.trigger_type||'manual';const c=(w.conditions||[])[0]||{};$('#workflow-condition-field').value=c.field||'';$('#workflow-condition-operator').value=c.operator||'less_than';$('#workflow-condition-value').value=c.value||'';Array.from(f.querySelectorAll('[name="actions"]')).forEach(cb=>cb.checked=(w.actions||[]).some(a=>a.type===cb.value));$('#workflow-builder-title').textContent='Edit workflow';f.scrollIntoView({behavior:'smooth',block:'start'});}
$('#workflow-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,msg=$('#workflow-form-message'),id=f.elements.id.value,field=$('#workflow-condition-field').value,actions=Array.from(f.querySelectorAll('[name="actions"]:checked')).map(x=>({type:x.value,label:x.parentElement.textContent.trim()})),payload={name:f.elements.name.value,description:f.elements.description.value,scope:f.elements.scope.value,status:f.elements.status.value,triggerType:f.elements.triggerType.value,conditions:field?[{field,operator:$('#workflow-condition-operator').value,value:$('#workflow-condition-value').value}]:[],actions};try{await api(id?`/api/platform/workflows/${encodeURIComponent(id)}`:'/api/platform/workflows',{method:id?'PUT':'POST',body:JSON.stringify(payload)});msg.textContent='Workflow saved successfully.';msg.className='form-message success';msg.hidden=false;resetWorkflowForm();await loadWorkflowEngine();}catch(err){msg.textContent=err.message;msg.className='form-message error';msg.hidden=false;}});
$('#workflow-new')?.addEventListener('click',()=>{resetWorkflowForm();$('#workflow-form')?.scrollIntoView({behavior:'smooth'})});
$('#workflow-reset')?.addEventListener('click',resetWorkflowForm);$('#workflow-refresh')?.addEventListener('click',loadWorkflowEngine);$('#workflow-status-filter')?.addEventListener('change',loadWorkflowEngine);

restoreSession();

$('#exit-support-mode')?.addEventListener('click',async()=>{try{await api('/api/platform/exit-support',{method:'POST'});location.reload();}catch(error){alert(error.message);}});

$('#platform-global-search')?.addEventListener('input',()=>{clearTimeout(platformSearchTimer);platformSearchTimer=setTimeout(runPlatformSearch,300);});

$('#close-platform-org-profile')?.addEventListener('click',()=>$('#platform-organisation-dialog').close());
$('#platform-org-support-full')?.addEventListener('click',()=>{if(selectedPlatformOrganisationId)openPlatformOrganisation(selectedPlatformOrganisationId,'full')});
$('#platform-org-support-readonly')?.addEventListener('click',()=>{if(selectedPlatformOrganisationId)openPlatformOrganisation(selectedPlatformOrganisationId,'read_only')});

// Sprint 12 security completion UI
function populateEffectiveAccessUsers(){const s=$('#effective-access-user');if(!s)return;const current=s.value;s.innerHTML='<option value="">Select a user</option>'+users.filter(u=>u.status==='active').map(u=>`<option value="${escapeHtml(u.id)}">${escapeHtml(u.displayName)} · ${escapeHtml(roleLabel(u.accessLevel||u.role))}</option>`).join('');s.value=current;}
async function loadLoginHistory(){const el=$('#login-history-list');if(!el)return;try{const p=await api('/api/security/login-history');el.innerHTML=(p.events||[]).map(e=>`<article class="session-row"><div class="session-device"><span>${e.outcome==='success'?'✓':'!'}</span><div><strong>${escapeHtml(e.display_name||e.email||'Unknown user')}</strong><small>${escapeHtml(e.reason||e.outcome)} · ${escapeHtml((e.user_agent||'Unknown device').slice(0,80))}</small></div></div><div><b>${escapeHtml(e.outcome)}</b><small>${escapeHtml(e.ip_hint||'IP unavailable')} · ${new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short'}).format(new Date(`${e.created_at}Z`))}</small></div></article>`).join('')||'<p class="muted">No login history has been recorded yet.</p>';}catch(error){el.innerHTML=`<p class="muted">${escapeHtml(error.message)}</p>`;}}
$('#refresh-login-history')?.addEventListener('click',loadLoginHistory);
$('#test-effective-access')?.addEventListener('click',async()=>{const userId=$('#effective-access-user')?.value,result=$('#effective-access-result');if(!userId){result.innerHTML='<p class="muted">Select a user first.</p>';return;}try{const p=await api(`/api/security/effective-access?userId=${encodeURIComponent(userId)}`),groups={};(p.permissions||[]).forEach(x=>(groups[x.category]??=[]).push(x));result.innerHTML=`<div class="effective-access-heading"><strong>${escapeHtml(p.user.display_name)}</strong><span>${p.permissions.length} permissions</span></div>`+Object.entries(groups).map(([g,items])=>`<details><summary>${escapeHtml(g)} <span>${items.length}</span></summary><div class="effective-permission-list">${items.map(x=>`<span class="permission-chip ${escapeHtml(x.risk_level)}">${escapeHtml(x.name)}</span>`).join('')}</div></details>`).join('')||'<p class="muted">No effective permissions.</p>';}catch(error){result.innerHTML=`<p class="muted">${escapeHtml(error.message)}</p>`;}});
let emergencyModeEnabled=false;
function updateEmergencyUI(policy={}){emergencyModeEnabled=Boolean(policy.emergency_mode);const badge=$('#emergency-mode-badge'),button=$('#toggle-emergency-mode'),reason=$('#emergency-mode-reason');if(badge){badge.textContent=emergencyModeEnabled?'Active':'Off';badge.className=`badge ${emergencyModeEnabled?'danger':'neutral'}`;}if(button){button.textContent=emergencyModeEnabled?'Disable emergency mode':'Enable emergency mode';}if(reason&&policy.emergency_reason)reason.value=policy.emergency_reason;}
$('#toggle-emergency-mode')?.addEventListener('click',async()=>{const reason=$('#emergency-mode-reason')?.value||'';if(!emergencyModeEnabled&&!confirm('Enable emergency mode? This records a critical security event.'))return;if(emergencyModeEnabled&&!confirm('Disable emergency mode and return to normal operation?'))return;try{const p=await api('/api/security/emergency-mode',{method:'PUT',body:JSON.stringify({enabled:!emergencyModeEnabled,reason})});updateEmergencyUI(p.policy||{});}catch(error){alert(error.message);}});
const originalFillSecurityPolicy=fillSecurityPolicy;fillSecurityPolicy=function(p){originalFillSecurityPolicy(p);updateEmergencyUI(p);populateEffectiveAccessUsers();loadLoginHistory();};

$('#executive-refresh')?.addEventListener('click',()=>loadPlatformWorkspace());
$('#operations-refresh')?.addEventListener('click',loadPlatformHealth);
$('#open-revenue-centre')?.addEventListener('click',()=>showPlatformView('revenue-centre'));
$('#revenue-refresh')?.addEventListener('click',loadRevenueCentre);
$('#revenue-export')?.addEventListener('click',exportRevenueCsv);

$('#success-refresh')?.addEventListener('click',loadCustomerSuccess);
$('#success-filter')?.addEventListener('change',renderCustomerSuccess);


let aiConversationId = null;
function aiMessage(role, content, meta = '') {
  const chat = $('#ai-chat'); if (!chat) return;
  const node = document.createElement('div'); node.className = `ai-message ${role}`;
  node.innerHTML = `<div class="ai-avatar">${role === 'assistant' ? '✦' : escapeHtml((currentUser?.displayName||'You').slice(0,1))}</div><div><strong>${role === 'assistant' ? 'CoreCare Assistant' : escapeHtml(currentUser?.displayName||'You')}</strong><p>${escapeHtml(content).replaceAll('\n','<br>')}</p>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</div>`;
  chat.appendChild(node); chat.scrollTop = chat.scrollHeight;
}
async function loadAiAssistantHistory(){
  if (!$('#platform-ai-assistant')) return;
  try {
    const p = await api('/api/platform/assistant/history');
    aiConversationId = p.conversationId || null;
    if ((p.messages||[]).length) {
      $('#ai-chat').innerHTML = '';
      p.messages.forEach(m => aiMessage(m.role, m.content, m.created_at ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${m.created_at}Z`)) : ''));
    }
  } catch (error) { console.warn('Assistant history unavailable', error); }
}
async function askAiAssistant(question){
  aiMessage('user', question);
  const send=$('#ai-send'), input=$('#ai-question'); if(send) send.disabled=true; if(input) input.disabled=true;
  const typing=document.createElement('div'); typing.id='ai-typing'; typing.className='ai-message assistant typing'; typing.innerHTML='<div class="ai-avatar">✦</div><div><strong>CoreCare Assistant</strong><p>Analysing live platform data…</p></div>'; $('#ai-chat')?.appendChild(typing);
  try {
    const p=await api('/api/platform/assistant',{method:'POST',body:JSON.stringify({question,conversationId:aiConversationId})});
    aiConversationId=p.conversationId||aiConversationId; typing.remove(); aiMessage('assistant',p.answer,p.generatedAt?'Generated from live data':'');
  } catch(error){ typing.remove(); aiMessage('assistant',`I could not complete that analysis: ${error.message}`); }
  finally { if(send) send.disabled=false; if(input){input.disabled=false;input.focus();} }
}

$('#ai-form')?.addEventListener('submit',e=>{e.preventDefault();const q=$('#ai-question')?.value.trim();if(!q)return;$('#ai-question').value='';askAiAssistant(q);});
$$('[data-ai-question]').forEach(b=>b.addEventListener('click',()=>askAiAssistant(b.dataset.aiQuestion)));
$('#ai-new-conversation')?.addEventListener('click',async()=>{aiConversationId=null;const chat=$('#ai-chat');if(chat)chat.innerHTML='<div class="ai-message assistant"><div class="ai-avatar">✦</div><div><strong>CoreCare Assistant</strong><p>New conversation started. What would you like to know?</p></div></div>';});


let notificationData=[];
async function loadNotifications(){
  if(!$('#notification-list'))return;
  const category=$('#notification-category-filter')?.value||'all',status=$('#notification-status-filter')?.value||'all',search=$('#notification-search')?.value||'';
  const p=await api(`/api/platform/notifications?category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`);
  notificationData=p.notifications||[];renderNotifications(p.stats||{});
}
function renderNotifications(stats={}){
  $('#notification-unread-count').textContent=stats.unread||0;$('#notification-critical-count').textContent=stats.critical||0;$('#notification-today-count').textContent=stats.today||0;$('#notification-ack-count').textContent=stats.acknowledged||0;
  setText('#notification-badge',Number(stats.unread||0));
  const list=$('#notification-list');if(!list)return;
  list.innerHTML=notificationData.map(n=>`<article class="notification-item ${n.read_at?'':'unread'}"><span class="notification-priority ${escapeHtml(n.priority||'information')}"></span><div class="notification-body"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.message)}</p><small>${escapeHtml(n.category||'system')} · ${new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(`${n.created_at}${String(n.created_at).endsWith('Z')?'':'Z'}`))}${n.organisation_name?' · '+escapeHtml(n.organisation_name):''}</small></div><div class="notification-actions">${!n.read_at?`<button class="row-action" data-notification-read="${escapeHtml(n.id)}">Read</button>`:''}${!n.acknowledged_at?`<button class="row-action" data-notification-ack="${escapeHtml(n.id)}">Acknowledge</button>`:''}<button class="row-action" data-notification-archive="${escapeHtml(n.id)}">Archive</button></div></article>`).join('')||'<div class="empty-state"><strong>No notifications found</strong><span>Change the filters or wait for new platform events.</span></div>';
  $$('[data-notification-read]').forEach(b=>b.addEventListener('click',async()=>{await api(`/api/platform/notifications/${encodeURIComponent(b.dataset.notificationRead)}/read`,{method:'POST',body:'{}'});await loadNotifications();}));
  $$('[data-notification-ack]').forEach(b=>b.addEventListener('click',async()=>{await api(`/api/platform/notifications/${encodeURIComponent(b.dataset.notificationAck)}/acknowledge`,{method:'POST',body:'{}'});await loadNotifications();}));
  $$('[data-notification-archive]').forEach(b=>b.addEventListener('click',async()=>{await api(`/api/platform/notifications/${encodeURIComponent(b.dataset.notificationArchive)}/archive`,{method:'POST',body:'{}'});await loadNotifications();}));
}
$('#notifications-refresh')?.addEventListener('click',loadNotifications);$('#notification-category-filter')?.addEventListener('change',loadNotifications);$('#notification-status-filter')?.addEventListener('change',loadNotifications);$('#notification-search')?.addEventListener('input',()=>{clearTimeout(window.notificationSearchTimer);window.notificationSearchTimer=setTimeout(loadNotifications,250)});$('#notifications-mark-all')?.addEventListener('click',async()=>{await api('/api/platform/notifications/mark-all-read',{method:'POST',body:'{}'});await loadNotifications();});
$('.notification-button')?.addEventListener('click',()=>isPlatformWorkspace()?showPlatformView('platform-notification-centre'):showPage('notifications'));


let operationsData={tasks:[],incidents:[],handovers:[],clients:[],staff:[],timeline:[],stats:{}};
function opFmt(value){if(!value)return 'No due time';try{return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(String(value).endsWith('Z')?value:value+'Z'))}catch{return value}}
async function loadOperationsBoard(){operationsData=await api('/api/operations/board');renderOperationsBoard();}
function renderOperationsBoard(){const s=operationsData.stats||{};setText('#op-open',s.open||0);setText('#op-overdue',s.overdue||0);setText('#op-escalated',s.escalated||0);setText('#op-incidents',s.incidentsOpen||0);setText('#op-high-incidents',s.incidentsHigh||0);setText('#op-handovers',s.handoversUnread||0);setText('#op-compliance',(s.careDue||0)+(s.riskDue||0));
  const filter=$('#operations-task-filter')?.value||'active';let tasks=operationsData.tasks||[];if(filter==='active')tasks=tasks.filter(x=>x.status!=='completed');if(filter==='completed')tasks=tasks.filter(x=>x.status==='completed');
  $('#operations-task-list').innerHTML=tasks.map(t=>`<article class="operations-row priority-${escapeHtml(t.priority||'normal')}"><div class="operations-row-status ${escapeHtml(t.status)}"></div><div><strong>${escapeHtml(t.title)}</strong><p>${escapeHtml(t.description||'No description')}</p><small>${escapeHtml(t.client_name||'General operation')} · ${escapeHtml(t.staff_name||'Unassigned')} · ${opFmt(t.due_at)}</small></div><span class="badge ${t.status==='completed'?'success':t.status==='escalated'?'danger':t.status==='overdue'?'warning':'neutral'}">${escapeHtml(t.status)}</span><div class="operations-row-actions">${t.status!=='completed'?`<button data-op-complete="${escapeHtml(t.id)}">Complete</button>`:''}${!['completed','escalated'].includes(t.status)?`<button data-op-escalate="${escapeHtml(t.id)}">Escalate</button>`:''}</div></article>`).join('')||'<div class="empty-state"><strong>No tasks in this view</strong><span>Create a task to begin coordinating today’s work.</span></div>';
  $('#operations-incident-list').innerHTML=(operationsData.incidents||[]).filter(x=>x.status!=='closed').map(i=>`<article class="mini-operation"><div><strong>${escapeHtml(i.title)}</strong><small>${escapeHtml(i.severity)} · ${escapeHtml(i.client_name||'No client')} · ${opFmt(i.occurred_at||i.created_at)}</small></div><button data-op-review="${escapeHtml(i.id)}">Review</button></article>`).join('')||'<p class="muted">No open incidents.</p>';
  $('#operations-handover-list').innerHTML=(operationsData.handovers||[]).slice(0,5).map(h=>`<article class="mini-operation"><div><strong>${escapeHtml(h.shift)} handover</strong><p>${escapeHtml(h.summary)}</p><small>${opFmt(h.created_at)}</small></div>${h.acknowledged_at?'<span class="badge success">Acknowledged</span>':`<button data-op-ack="${escapeHtml(h.id)}">Acknowledge</button>`}</article>`).join('')||'<p class="muted">No handovers recorded.</p>';
  $('#operations-timeline').innerHTML=(operationsData.timeline||[]).map(x=>`<div><span class="timeline-dot"></span><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.detail||'')}</p><time>${opFmt(x.created_at)}</time></div></div>`).join('')||'<p class="muted">No operational activity yet.</p>';
  const clientOptions='<option value="">No client</option>'+(operationsData.clients||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.preferred_name||x.first_name)} ${escapeHtml(x.last_name)}</option>`).join(''); const staffOptions='<option value="">Unassigned</option>'+(operationsData.staff||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.preferred_name||x.first_name)} ${escapeHtml(x.last_name)} · ${escapeHtml(x.job_title||'Staff')}</option>`).join(''); if($('#operations-task-client'))$('#operations-task-client').innerHTML=clientOptions;if($('#operations-incident-client'))$('#operations-incident-client').innerHTML=clientOptions;if($('#operations-task-staff'))$('#operations-task-staff').innerHTML=staffOptions;
  $$('[data-op-complete]').forEach(b=>b.onclick=async()=>{await api(`/api/operations/tasks/${encodeURIComponent(b.dataset.opComplete)}/complete`,{method:'POST',body:'{}'});await loadOperationsBoard();});$$('[data-op-escalate]').forEach(b=>b.onclick=async()=>{await api(`/api/operations/tasks/${encodeURIComponent(b.dataset.opEscalate)}/escalate`,{method:'POST',body:'{}'});await loadOperationsBoard();});$$('[data-op-review]').forEach(b=>b.onclick=async()=>{const review=prompt('Manager review note:','Reviewed and closed.');if(review===null)return;await api(`/api/operations/incidents/${encodeURIComponent(b.dataset.opReview)}/review`,{method:'POST',body:JSON.stringify({review})});await loadOperationsBoard();});$$('[data-op-ack]').forEach(b=>b.onclick=async()=>{await api(`/api/operations/handovers/${encodeURIComponent(b.dataset.opAck)}/acknowledge`,{method:'POST',body:'{}'});await loadOperationsBoard();});
}
$('#operations-refresh-board')?.addEventListener('click',loadOperationsBoard);$('#operations-task-filter')?.addEventListener('change',renderOperationsBoard);$('#operations-new-task')?.addEventListener('click',()=>$('#operations-task-dialog')?.showModal());$('#operations-record-incident')?.addEventListener('click',()=>$('#operations-incident-dialog')?.showModal());$('#operations-add-handover')?.addEventListener('click',()=>$('#operations-handover-dialog')?.showModal());$$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.closeDialog)?.close()));
async function submitOperationsForm(form, endpoint, dialogId, submitButtonId) {
  const errorNode = form.querySelector('.form-error');
  const submitButton = document.getElementById(submitButtonId);
  if (errorNode) { errorNode.hidden = true; errorNode.textContent = ''; }
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Saving…'; }
  try {
    const values = Object.fromEntries(new FormData(form).entries());
    await api(endpoint, { method: 'POST', body: JSON.stringify(values) });
    form.reset();
    document.getElementById(dialogId)?.close();
    await loadOperationsBoard();
  } catch (error) {
    console.error(`CoreCare ${dialogId} submit failed`, error);
    if (errorNode) { errorNode.textContent = error.message || 'CoreCare could not save this record.'; errorNode.hidden = false; }
    showErrorToast?.(error.message || 'CoreCare could not save this record.');
  } finally {
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Create task'; }
  }
}

$('#operations-task-form')?.addEventListener('submit', e => {
  e.preventDefault();
  e.stopPropagation();
  submitOperationsForm(e.currentTarget, '/api/operations/tasks', 'operations-task-dialog', 'operations-task-submit');
});
$('#operations-incident-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await api('/api/operations/incidents',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});e.currentTarget.reset();$('#operations-incident-dialog').close();await loadOperationsBoard();});$('#operations-handover-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await api('/api/operations/handovers',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});e.currentTarget.reset();$('#operations-handover-dialog').close();await loadOperationsBoard();});


/* Electronic Call Monitoring 1.5.1 */

function mondayOf(value = new Date()) {
  const d = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d.toISOString().slice(0, 10);
}

let rotaData={visits:[],clients:[],staff:[],workingPatterns:[],requirements:[],preferredAssignments:[],stats:{}};
let rotaOptimiseSuggestions=[];
let rotaView='board';
let rotaSelected=new Set(),rotaClipboard=null,rotaUndoStack=[],rotaRedoStack=[],rotaContextVisitId=null;
const ROTA_START_HOUR=6, ROTA_END_HOUR=30, ROTA_HOUR_WIDTH=96;
function rotaServiceDayKey(value){const d=new Date(value);d.setHours(d.getHours()-ROTA_START_HOUR);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function rotaDisplayHour(date){const d=new Date(date),h=d.getHours()+d.getMinutes()/60;return h<ROTA_START_HOUR?h+24:h;}
function rotaHourLabel(hour){return ((hour%24)+24)%24;}
function setRotaSelectedServiceDay(day){const target=new Date(`${day}T12:00:00`),m=new Date(target),shift=(m.getDay()+6)%7;m.setDate(m.getDate()-shift);if($('#rota-week'))$('#rota-week').value=m.toISOString().slice(0,10);if($('#rota-day'))$('#rota-day').value=day;}
function rotaIsoLocal(date){const d=new Date(date),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function rotaDayDates(){const base=new Date(($('#rota-week')?.value||mondayOf())+'T12:00:00');return Array.from({length:7},(_,i)=>new Date(base.getTime()+i*86400000));}
function selectedRotaDay(){return $('#rota-day')?.value||rotaDayDates()[0].toISOString().slice(0,10);}
async function loadRotaBoard(){const week=$('#rota-week');if(week&&!week.value)week.value=mondayOf();const from=week?.value||mondayOf(),to=new Date(new Date(from+'T12:00:00').getTime()+6*86400000).toISOString().slice(0,10);rotaData=await api(`/api/rota?from=${from}&to=${to}`);renderRotaBoard();}
function rotaStatus(v){return v.live_status||v.status||'scheduled';}

function rotaDayRows(day=selectedRotaDay()){return (rotaData.visits||[]).filter(v=>rotaServiceDayKey(v.scheduled_start)===day&&rotaStatus(v)!=='cancelled');}
function staffNameById(id){const x=(rotaData.staff||[]).find(s=>s.id===id);return x?`${x.preferred_name||x.first_name} ${x.last_name}`:'Unallocated';}
function staffPatternFor(staffId,date){const d=new Date(date),dow=((d.getDay()+6)%7)+1;return (rotaData.workingPatterns||[]).filter(p=>p.staff_id===staffId&&Number(p.day_of_week)===dow);}
function withinWorkingPattern(staffId,start,end){const patterns=staffPatternFor(staffId,start);if(!patterns.length)return true;const a=new Date(start),b=new Date(end),hm=x=>x.getHours()*60+x.getMinutes();return patterns.some(p=>{const [sh,sm]=p.start_time.split(':').map(Number),[eh,em]=p.end_time.split(':').map(Number);return hm(a)>=sh*60+sm&&hm(b)<=eh*60+em;});}
function calculateRotaIntelligence(day=selectedRotaDay()){
 const rows=rotaDayRows(day),byStaff=new Map(),warnings=[];let clashes=0,travel=0,availability=0,totalMinutes=0,overtimeMinutes=0,continuityGood=0,continuityTotal=0;
 rows.forEach(v=>{if(v.staff_id){if(!byStaff.has(v.staff_id))byStaff.set(v.staff_id,[]);byStaff.get(v.staff_id).push(v);totalMinutes+=rotaVisitDuration(v);if(!withinWorkingPattern(v.staff_id,v.scheduled_start,v.scheduled_end)){availability++;warnings.push({tone:'warning',visitId:v.id,text:`${v.staff_name||staffNameById(v.staff_id)} is outside their working pattern for ${v.client_name}.`});}const preferred=(rotaData.preferredAssignments||[]).filter(a=>a.client_id===v.client_id).map(a=>a.staff_id);const familiar=(rotaData.visits||[]).some(x=>x.client_id===v.client_id&&x.staff_id===v.staff_id&&x.id!==v.id);if(preferred.length||familiar){continuityTotal++;if(preferred.includes(v.staff_id)||familiar)continuityGood++;}}else warnings.push({tone:'danger',visitId:v.id,text:`${v.client_name} at ${new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} is unallocated.`});if(v.travel_conflict){travel++;warnings.push({tone:'danger',visitId:v.id,text:`${v.staff_name||'Care worker'} has a ${Number(v.travel_conflict_minutes||0)} minute travel shortfall before ${v.client_name}.`});}});
 byStaff.forEach((list,staffId)=>{list.sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));for(let i=1;i<list.length;i++){if(new Date(list[i].scheduled_start)<new Date(list[i-1].scheduled_end)){clashes++;warnings.push({tone:'danger',visitId:list[i].id,text:`${staffNameById(staffId)} has overlapping visits: ${list[i-1].client_name} and ${list[i].client_name}.`});}}const worked=list.reduce((n,v)=>n+rotaVisitDuration(v)+Number(v.travel_before_minutes||0),0);const patterns=staffPatternFor(staffId,day+'T12:00:00'),planned=patterns.reduce((n,p)=>{const [sh,sm]=p.start_time.split(':').map(Number),[eh,em]=p.end_time.split(':').map(Number);return n+Math.max(0,(eh*60+em)-(sh*60+sm));},0);if(planned&&worked>planned){overtimeMinutes+=worked-planned;warnings.push({tone:'warning',staffId,text:`${staffNameById(staffId)} is ${Math.round((worked-planned)/60*10)/10} hours over their planned day.`});}});
 const unallocated=rows.filter(v=>!v.staff_id).length,continuity=continuityTotal?Math.round(continuityGood/continuityTotal*100):100,penalty=unallocated*12+clashes*15+travel*10+availability*7+Math.ceil(overtimeMinutes/60)*5,score=Math.max(0,100-penalty);
 return {rows,clashes,travel,availability,overtimeMinutes,continuity,score,warnings,unallocated};
}
function focusRotaIssue(visitId,staffId){
 if(visitId){const card=document.querySelector(`[data-rota-open="${CSS.escape(visitId)}"]`);card?.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});card?.classList.add('rota-focus-pulse');setTimeout(()=>card?.classList.remove('rota-focus-pulse'),1800);}
 else if(staffId){const lane=document.querySelector(`.scheduler-lane[data-staff-id="${CSS.escape(staffId)}"]`);lane?.scrollIntoView({behavior:'smooth',block:'center'});lane?.closest('.scheduler-row')?.classList.add('rota-focus-pulse');setTimeout(()=>lane?.closest('.scheduler-row')?.classList.remove('rota-focus-pulse'),1800);}
}
function renderRotaIntelligence(){
 const a=calculateRotaIntelligence();setVisitText('#rota-health-score',`${a.score}%`);setVisitText('#rota-clashes',a.clashes);setVisitText('#rota-travel-risks',a.travel);setVisitText('#rota-availability-risks',a.availability);setVisitText('#rota-continuity',`${a.continuity}%`);setVisitText('#rota-overtime',`${Math.round(a.overtimeMinutes/6)/10}h`);setVisitText('#rota-health-label',a.score>=90?'Healthy rota':a.score>=70?'Needs attention':'Action required');
 const scoreCard=$('.rota-health-score-card');if(scoreCard){scoreCard.style.setProperty('--health-score',`${a.score}%`);let tips=scoreCard.querySelector('.health-improvement-tips');if(!tips){tips=document.createElement('div');tips.className='health-improvement-tips';scoreCard.appendChild(tips);}const unallocated=a.rows.filter(v=>!v.staff_id).length;const gains=[];if(unallocated)gains.push(`+${Math.min(36,unallocated*12)} allocate all visits`);if(a.travel)gains.push(`+${Math.min(30,a.travel*10)} resolve travel`);if(a.clashes)gains.push(`+${Math.min(30,a.clashes*15)} remove clashes`);if(a.availability)gains.push(`+${Math.min(21,a.availability*7)} match availability`);tips.innerHTML=gains.slice(0,3).map(x=>`<small>${escapeHtml(x)}</small>`).join('')||'<small>Excellent — no immediate score improvements needed.</small>';}
 const summary=$('#rota-conflict-summary');if(summary)summary.innerHTML=`<b>${a.warnings.length} issue${a.warnings.length===1?'':'s'}</b><span>${a.unallocated} unallocated · ${a.clashes} clashes · ${a.travel} travel risks · ${a.availability} availability warnings</span>`;const el=$('#rota-intelligence-warnings');if(el)el.innerHTML=a.warnings.slice(0,8).map(w=>`<button type="button" class="planner-warning ${w.tone}" data-health-visit="${escapeHtml(w.visitId||'')}" data-health-staff="${escapeHtml(w.staffId||'')}"><span>${w.tone==='danger'?'⚠':'●'}</span><p>${escapeHtml(w.text)}</p><b>Show</b></button>`).join('')||'<div class="planner-warning success"><span>✓</span><p>No immediate planning risks detected for the selected day.</p></div>';
}



function plannerHours(minutes){return `${Math.round(Number(minutes||0)/6)/10}h`;}
function plannerStaffDaySummary(day=selectedRotaDay()){
 const rows=rotaDayRows(day), result=[];
 (rotaData.staff||[]).forEach(st=>{
  const visits=rows.filter(v=>v.staff_id===st.id).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));
  const patterns=staffPatternFor(st.id,day+'T12:00:00');
  const available=patterns.reduce((n,p)=>{const [sh,sm]=p.start_time.split(':').map(Number),[eh,em]=p.end_time.split(':').map(Number);return n+Math.max(0,(eh*60+em)-(sh*60+sm));},0)||480;
  const care=visits.reduce((n,v)=>n+rotaVisitDuration(v),0),travel=visits.reduce((n,v)=>n+Number(v.travel_before_minutes||0),0),booked=care+travel;
  result.push({staff:st,visits,available,care,travel,booked,spare:Math.max(0,available-booked),overtime:Math.max(0,booked-available)});
 });
 return result.sort((a,b)=>b.spare-a.spare);
}
function renderPlannerCommandCentre(){
 const panel=$('#planner-command-centre');if(!panel)return;
 const day=selectedRotaDay(),analysis=calculateRotaIntelligence(day),staff=plannerStaffDaySummary(day),rows=analysis.rows;
 const available=staff.reduce((n,x)=>n+x.available,0),booked=staff.reduce((n,x)=>n+x.care,0),travel=staff.reduce((n,x)=>n+x.travel,0),util=available?Math.round((booked+travel)/available*100):0;
 setVisitText('#planner-capacity-available',plannerHours(available));setVisitText('#planner-capacity-booked',plannerHours(booked));setVisitText('#planner-capacity-utilisation',`${util}%`);setVisitText('#planner-capacity-travel',plannerHours(travel));
 const capStatus=$('#planner-capacity-status');if(capStatus){capStatus.textContent=util>100?'Over capacity':util>85?'High use':util>60?'Balanced':'Capacity available';capStatus.className=`badge ${util>100?'danger':util>85?'warning':util>60?'success':'active'}`;}
 const capList=$('#planner-capacity-list');if(capList)capList.innerHTML=staff.slice(0,5).map(x=>`<button type="button" data-health-staff="${escapeHtml(x.staff.id)}"><span>${escapeHtml((x.staff.preferred_name||x.staff.first_name)+' '+x.staff.last_name)}</span><strong>${x.overtime?`${plannerHours(x.overtime)} overtime`:`${plannerHours(x.spare)} spare`}</strong></button>`).join('')||'<p>No carers available.</p>';
 const clients=new Map();rows.forEach(v=>{if(!clients.has(v.client_id))clients.set(v.client_id,{name:v.client_name,visits:[],good:0});const c=clients.get(v.client_id);c.visits.push(v);if(v.staff_id){const pref=(rotaData.preferredAssignments||[]).some(a=>a.client_id===v.client_id&&a.staff_id===v.staff_id),familiar=(rotaData.visits||[]).some(x=>x.client_id===v.client_id&&x.staff_id===v.staff_id&&x.id!==v.id);if(pref||familiar)c.good++;}});
 const continuity=[...clients.values()].map(c=>({...c,score:c.visits.length?Math.round(c.good/c.visits.length*100):0})).sort((a,b)=>a.score-b.score);
 const contStatus=$('#planner-continuity-status');if(contStatus){contStatus.textContent=`${analysis.continuity}%`;contStatus.className=`badge ${analysis.continuity>=90?'success':analysis.continuity>=70?'warning':'danger'}`;}
 const contList=$('#planner-continuity-list');if(contList)contList.innerHTML=continuity.slice(0,5).map(c=>`<div><span>${escapeHtml(c.name||'Client')}</span><strong>${c.score}%</strong><small>${c.score>=90?'Regular or preferred carer':c.score>=60?'Mixed continuity':'Needs review'}</small></div>`).join('')||'<p>No visits on the selected day.</p>';
 const travelList=$('#planner-travel-list');if(travelList)travelList.innerHTML=staff.filter(x=>x.visits.length).slice(0,5).map(x=>`<button type="button" data-health-staff="${escapeHtml(x.staff.id)}"><span>${escapeHtml((x.staff.preferred_name||x.staff.first_name)+' '+x.staff.last_name)}</span><strong>${x.visits.length} calls · ${x.travel} min</strong><small>${x.visits.map(v=>new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})).join(' → ')}</small></button>`).join('')||'<p>No allocated routes.</p>';
 const suggestions=[];analysis.warnings.slice(0,4).forEach(w=>suggestions.push({text:w.text,visitId:w.visitId,staffId:w.staffId}));if(!suggestions.length&&analysis.score>=90)suggestions.push({text:'The selected day is healthy. No immediate changes are recommended.'});
 const sug=$('#planner-suggestions-list');if(sug)sug.innerHTML=suggestions.map(x=>`<button type="button" data-health-visit="${escapeHtml(x.visitId||'')}" data-health-staff="${escapeHtml(x.staffId||'')}"><span>${x.visitId||x.staffId?'Suggestion':'✓'}</span><p>${escapeHtml(x.text)}</p>${x.visitId||x.staffId?'<b>Show</b>':''}</button>`).join('');
}
function runPlannerAssistant(question){
 const q=String(question||'').toLowerCase(),answer=$('#planner-assistant-answer'),day=selectedRotaDay(),rows=rotaDayRows(day),staff=plannerStaffDaySummary(day);if(!answer)return;
 let html='';
 if(q.includes('med')){const found=rows.filter(v=>/med|mar/i.test(v.visit_type||''));html=found.length?`<strong>${found.length} medication-related visit${found.length===1?'':'s'}</strong>${found.map(v=>`<button data-health-visit="${escapeHtml(v.id)}">${new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${escapeHtml(v.client_name)} · ${escapeHtml(v.staff_name||'Unallocated')}</button>`).join('')}`:'<strong>No medication-related visits found.</strong>';}
 else if(q.includes('capacity')||q.includes('spare')){html=`<strong>Carers with the most spare capacity</strong>${staff.slice(0,5).map(x=>`<button data-health-staff="${escapeHtml(x.staff.id)}">${escapeHtml((x.staff.preferred_name||x.staff.first_name)+' '+x.staff.last_name)} · ${plannerHours(x.spare)} spare</button>`).join('')}`;}
 else if(q.includes('late')){const found=rows.filter(v=>rotaStatus(v)==='late'||rotaStatus(v)==='overrunning');html=found.length?`<strong>${found.length} late or overrunning visit${found.length===1?'':'s'}</strong>${found.map(v=>`<button data-health-visit="${escapeHtml(v.id)}">${escapeHtml(v.client_name)} · ${escapeHtml(rotaStatus(v).replaceAll('_',' '))}</button>`).join('')}`:'<strong>No late or overrunning visits.</strong>';}
 else if(q.includes('travel')||q.includes('route')){const found=rows.filter(v=>v.travel_conflict);html=found.length?`<strong>${found.length} travel risk${found.length===1?'':'s'}</strong>${found.map(v=>`<button data-health-visit="${escapeHtml(v.id)}">${escapeHtml(v.staff_name||'Care worker')} before ${escapeHtml(v.client_name)}</button>`).join('')}`:'<strong>No travel conflicts detected.</strong>';}
 else {const a=calculateRotaIntelligence(day);html=`<strong>Selected-day summary</strong><span>${a.rows.length} visits · ${a.unallocated} unallocated · ${a.clashes} clashes · ${a.travel} travel risks · ${a.continuity}% continuity.</span>`;}
 answer.innerHTML=html;
}

function candidateScoreDetailed(visit,staffId){
 const rows=rotaDayRows(String(visit.scheduled_start).slice(0,10)).filter(v=>v.staff_id===staffId&&v.id!==visit.id).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));
 const start=new Date(visit.scheduled_start),end=new Date(visit.scheduled_end||new Date(start.getTime()+rotaVisitDuration(visit)*60000));
 const reasons=[];let score=50;
 const overlap=rows.some(v=>start<new Date(v.scheduled_end)&&end>new Date(v.scheduled_start));
 if(overlap)return {score:0,blocked:true,reasons:[{tone:'danger',text:'Overlaps another visit'}]};
 if(!withinWorkingPattern(staffId,start,end))return {score:0,blocked:true,reasons:[{tone:'danger',text:'Outside normal working pattern'}]};
 reasons.push({tone:'success',text:'Within normal working pattern'});
 const preferred=(rotaData.preferredAssignments||[]).some(a=>a.client_id===visit.client_id&&a.staff_id===staffId);
 const familiarCount=(rotaData.visits||[]).filter(v=>v.client_id===visit.client_id&&v.staff_id===staffId&&v.id!==visit.id).length;
 if(preferred){score+=30;reasons.push({tone:'success',text:'Preferred care worker'});} else if(familiarCount){const gain=Math.min(20,familiarCount*4);score+=gain;reasons.push({tone:'success',text:`Continuity: ${familiarCount} previous visit${familiarCount===1?'':'s'}`});} else {score-=8;reasons.push({tone:'warning',text:'No previous continuity recorded'});}
 const worked=rows.reduce((n,v)=>n+rotaVisitDuration(v)+Number(v.travel_before_minutes||0),0);
 if(worked+rotaVisitDuration(visit)>480){score-=15;reasons.push({tone:'warning',text:'May create overtime'});} else reasons.push({tone:'success',text:'Within standard daily hours'});
 const prev=[...rows].reverse().find(v=>new Date(v.scheduled_end)<=start),next=rows.find(v=>new Date(v.scheduled_start)>=end);
 const gapBefore=prev?(start-new Date(prev.scheduled_end))/60000:null,gapAfter=next?(new Date(next.scheduled_start)-end)/60000:null;
 if(prev){const needed=Number(visit.travel_before_minutes||0);if(needed&&gapBefore<needed){score-=25;reasons.push({tone:'danger',text:`Travel shortfall: ${Math.ceil(needed-gapBefore)} minutes`});}else if(gapBefore<=30){score+=8;reasons.push({tone:'success',text:`Efficient ${Math.round(gapBefore)} minute gap before`});}else{score-=Math.min(10,Math.round((gapBefore-30)/15));reasons.push({tone:'warning',text:`${Math.round(gapBefore)} minute gap before visit`});}}
 if(next&&gapAfter!=null){if(gapAfter<0){score-=30;reasons.push({tone:'danger',text:'Conflicts with next visit'});}else if(gapAfter<=30){score+=5;reasons.push({tone:'success',text:`Efficient ${Math.round(gapAfter)} minute gap after`});}}
 if(/med/i.test(visit.visit_type||'')){const staff=(rotaData.staff||[]).find(x=>x.id===staffId)||{};const text=JSON.stringify(staff).toLowerCase();if(text.includes('medication')||text.includes('mar')){score+=8;reasons.push({tone:'success',text:'Medication competency indicated'});}else reasons.push({tone:'warning',text:'Medication competency not recorded'});}
 if(visit.protected_time_rule&&visit.protected_time_rule!=='flexible')reasons.push({tone:'success',text:'Protected visit time preserved'});
 return {score:Math.max(0,Math.min(100,Math.round(score))),blocked:false,reasons};
}
function suitabilityForVisit(v){return v.staff_id?candidateScoreDetailed(v,v.staff_id):{score:0,blocked:true,reasons:[{tone:'danger',text:'Visit is unallocated'}]};}
function suitabilityTone(score){return score>=85?'excellent':score>=70?'good':score>=50?'attention':'poor';}
function openSuitabilityDialog(visitId){
 const v=(rotaData.visits||[]).find(x=>x.id===visitId);if(!v)return;
 const current=suitabilityForVisit(v),alternatives=(rotaData.staff||[]).map(st=>({st,result:candidateScoreDetailed(v,st.id)})).filter(x=>!x.result.blocked).sort((a,b)=>b.result.score-a.result.score).slice(0,4);
 setVisitText('#suitability-client',`${v.client_name||'Client'} · ${new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`);
 const score=$('#suitability-score');if(score){score.textContent=`${current.score}%`;score.className=`suitability-big-score ${suitabilityTone(current.score)}`;}
 const reasons=$('#suitability-reasons');if(reasons)reasons.innerHTML=current.reasons.map(r=>`<li class="${r.tone}">${r.tone==='success'?'✓':r.tone==='danger'?'⚠':'●'} ${escapeHtml(r.text)}</li>`).join('');
 const alt=$('#suitability-alternatives');if(alt)alt.innerHTML=alternatives.map(x=>`<article><div><strong>${escapeHtml(x.st.preferred_name||x.st.first_name)} ${escapeHtml(x.st.last_name)}</strong><small>${escapeHtml(x.st.job_title||'Care worker')}</small></div><b class="suitability-chip ${suitabilityTone(x.result.score)}">${x.result.score}%</b></article>`).join('')||'<p class="muted">No conflict-free alternatives found.</p>';
 $('#suitability-dialog')?.showModal();
}
function candidateScore(visit,staffId){const result=candidateScoreDetailed(visit,staffId);return result.blocked?-9999:result.score;}
function buildOptimiseSuggestions(){const intelligence=calculateRotaIntelligence(),targets=intelligence.rows.filter(v=>!v.staff_id||v.travel_conflict||!withinWorkingPattern(v.staff_id,v.scheduled_start,v.scheduled_end));const suggestions=[];targets.forEach(v=>{const ranked=(rotaData.staff||[]).map(st=>({staff:st,score:candidateScore(v,st.id)})).filter(x=>x.score>-100).sort((a,b)=>b.score-a.score);const best=ranked[0];if(best&&best.staff.id!==v.staff_id)suggestions.push({visit:v,staffId:best.staff.id,staffName:`${best.staff.preferred_name||best.staff.first_name} ${best.staff.last_name}`,score:Math.round(best.score),reason:!v.staff_id?'Best safe allocation using continuity, availability and workload':v.travel_conflict?'Reduce travel or route conflict':'Move inside availability'});});return suggestions;}
function openRotaOptimiser(){rotaOptimiseSuggestions=buildOptimiseSuggestions();const summary=$('#rota-optimise-summary'),list=$('#rota-optimise-list'),apply=$('#rota-optimise-apply');if(summary)summary.innerHTML=`<strong>${rotaOptimiseSuggestions.length} recommendation${rotaOptimiseSuggestions.length===1?'':'s'}</strong><span>Nothing changes until you apply the preview.</span>`;if(list)list.innerHTML=rotaOptimiseSuggestions.map((s,i)=>`<label class="optimise-card"><input type="checkbox" data-optimise-index="${i}" checked><div><strong>${escapeHtml(s.visit.client_name)} · ${new Date(s.visit.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</strong><span>${escapeHtml(s.visit.staff_name||'Unallocated')} → ${escapeHtml(s.staffName)}</span><small>${escapeHtml(s.reason)} · suitability score ${s.score}</small></div></label>`).join('')||'<div class="empty-state"><strong>No safe changes recommended</strong><span>The selected day is already well allocated, or CoreCare could not find a conflict-free alternative.</span></div>';if(apply)apply.disabled=!rotaOptimiseSuggestions.length;$('#rota-optimise-dialog')?.showModal();}
async function applyRotaOptimiser(){const chosen=[...document.querySelectorAll('[data-optimise-index]:checked')].map(x=>rotaOptimiseSuggestions[Number(x.dataset.optimiseIndex)]).filter(Boolean),btn=$('#rota-optimise-apply'),err=$('#rota-optimise-error');if(err)err.hidden=true;if(btn){btn.disabled=true;btn.textContent='Applying…';}try{for(const s of chosen){const v=s.visit;await patchRotaVisit(v.id,{clientId:v.client_id,staffId:s.staffId,visitType:v.visit_type,scheduledStart:v.scheduled_start,scheduledEnd:v.scheduled_end,scope:'single',reason:'Smart planner optimisation',plannerNotes:v.planner_notes||'',plannerLocked:Boolean(Number(v.planner_locked)),travelOverrideReason:'Smart planner recommendation'});}$('#rota-optimise-dialog')?.close();await loadRotaBoard();}catch(ex){if(err){err.textContent=ex.message;err.hidden=false;}}finally{if(btn){btn.disabled=false;btn.textContent='Apply recommendations';}}}

function rotaVisitDuration(v){const a=new Date(v.scheduled_start),b=v.scheduled_end?new Date(v.scheduled_end):new Date(a.getTime()+30*60000);return Math.max(15,Math.round((b-a)/60000));}
function rotaFilteredRows(){const status=$('#rota-status-filter')?.value||'all',staffFilter=$('#rota-staff-filter')?.value||'all';let rows=rotaData.visits||[];if(staffFilter!=='all')rows=rows.filter(v=>v.staff_id===staffFilter);if(status==='unallocated')rows=rows.filter(v=>!v.staff_id);else if(status!=='all')rows=rows.filter(v=>rotaStatus(v)===status);return rows;}
function setupRotaDaySelect(){const sel=$('#rota-day');if(!sel)return;const previous=sel.value,days=rotaDayDates();sel.innerHTML=days.map(d=>`<option value="${d.toISOString().slice(0,10)}">${d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</option>`).join('');sel.value=days.some(d=>d.toISOString().slice(0,10)===previous)?previous:days[0].toISOString().slice(0,10);}

function setupRotaStaffFilter(){const sel=$('#rota-staff-filter');if(!sel)return;const prev=sel.value||'all';sel.innerHTML='<option value="all">All staff</option>'+(rotaData.staff||[]).map(st=>`<option value="${escapeHtml(st.id)}">${escapeHtml(st.preferred_name||st.first_name)} ${escapeHtml(st.last_name)}</option>`).join('');sel.value=[...sel.options].some(o=>o.value===prev)?prev:'all';}
function updateRotaDateHeading(){const el=$('#rota-selected-date'),day=selectedRotaDay();if(el)el.textContent=new Date(day+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
function changeRotaDay(offset){const d=new Date(selectedRotaDay()+'T12:00:00');d.setDate(d.getDate()+offset);const monday=new Date(d);const day=(monday.getDay()+6)%7;monday.setDate(monday.getDate()-day);const week=monday.toISOString().slice(0,10);if($('#rota-week').value!==week){$('#rota-week').value=week;loadRotaBoard().then(()=>{$('#rota-day').value=d.toISOString().slice(0,10);renderRotaVisualBoard();});}else{$('#rota-day').value=d.toISOString().slice(0,10);renderRotaVisualBoard();}}
function renderRotaBoard(){const s=rotaData.stats||{};setVisitText('#rota-total',s.total);setVisitText('#rota-unallocated',s.unallocated);setVisitText('#rota-late',s.late);setVisitText('#rota-progress',s.inProgress);setVisitText('#rota-completed',s.completed);const co='<option value="">Select client</option>'+(rotaData.clients||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.preferred_name||x.first_name)} ${escapeHtml(x.last_name)}</option>`).join(''),so='<option value="">Unallocated</option>'+(rotaData.staff||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.preferred_name||x.first_name)} ${escapeHtml(x.last_name)}</option>`).join('');if($('#rota-client'))$('#rota-client').innerHTML=co;if($('#rota-staff'))$('#rota-staff').innerHTML=so;setupRotaDaySelect();setupRotaStaffFilter();renderRotaVisualBoard();renderRotaIntelligence();renderPlannerCommandCentre();renderRotaWeek();renderRotaList();const has=(rotaData.visits||[]).length>0;if($('#rota-empty'))$('#rota-empty').hidden=has;}
function rotaVisitTypeClass(v){const t=String(v.visit_type||'').toLowerCase();if(t.includes('med'))return 'visit-type-medication';if(t.includes('compan'))return 'visit-type-companionship';if(t.includes('welfare')||t.includes('domestic')||t.includes('meal'))return 'visit-type-welfare';if(t.includes('personal'))return 'visit-type-personal';return 'visit-type-other';}
function rotaTimeHeader(cornerTitle,cornerSubtitle,hours){return `<div class="scheduler-header"><div class="scheduler-corner"><span>${escapeHtml(cornerTitle)}</span><small>${escapeHtml(cornerSubtitle)}</small></div>${hours.map(raw=>{const h=rotaHourLabel(raw),period=h<6?'Night':h<12?'Morning':h<17?'Afternoon':h<22?'Evening':'Night';return `<div class="scheduler-hour"><strong>${String(h).padStart(2,'0')}:00</strong><span>${period}</span></div>`;}).join('')}</div>`;}
function allocateUnallocatedLanes(visits){const lanes=[];return [...visits].sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start)).map(v=>{const start=new Date(v.scheduled_start).getTime(),end=start+rotaVisitDuration(v)*60000;let lane=lanes.findIndex(lastEnd=>start>=lastEnd);if(lane<0){lane=lanes.length;lanes.push(end);}else lanes[lane]=end;return {v,lane};});}
function recommendedAllocationHeight(count,laneCount){if(!count)return 260;const byRows=150+Math.max(1,laneCount)*74;const byVolume=count>30?500:count>15?410:count>6?330:280;return Math.min(580,Math.max(byRows,byVolume));}
function applyAllocationPanelHeight(height,manual=false){const panel=$('#rota-unallocated-panel'),label=$('#rota-allocation-size-label');if(!panel)return;const safe=Math.max(240,Math.min(650,Math.round(height)));panel.style.height=`${safe}px`;panel.dataset.manual=manual?'true':'false';if(label)label.textContent=manual?`Custom height · ${safe}px`:`Adaptive height · ${safe}px`;}
function rotaSnapMinutes(){return Math.max(5,Number($('#rota-snap')?.value||localStorage.getItem('corecare_rota_snap')||15));}
function rotaSnapshot(v){return {id:v.id,clientId:v.client_id,staffId:v.staff_id||'',visitType:v.visit_type,scheduledStart:v.scheduled_start,scheduledEnd:v.scheduled_end,plannerNotes:v.planner_notes||'',plannerLocked:Number(v.planner_locked)||0};}
function updatePlannerActionState(){const count=rotaSelected.size,selection=$('#rota-selection-count');if(selection){selection.hidden=!count;selection.textContent=`${count} selected`;}if($('#rota-copy'))$('#rota-copy').disabled=count!==1;if($('#rota-paste'))$('#rota-paste').disabled=!rotaClipboard;if($('#rota-undo'))$('#rota-undo').disabled=!rotaUndoStack.length;if($('#rota-redo'))$('#rota-redo').disabled=!rotaRedoStack.length;}
function selectRotaVisit(id,add=false){if(!add)rotaSelected.clear();if(add&&rotaSelected.has(id))rotaSelected.delete(id);else rotaSelected.add(id);document.querySelectorAll('[data-rota-drag]').forEach(el=>el.classList.toggle('is-selected',rotaSelected.has(el.dataset.rotaDrag)));updatePlannerActionState();}
function hideRotaContextMenu(){const menu=$('#rota-context-menu');if(menu)menu.hidden=true;rotaContextVisitId=null;}
function showRotaContextMenu(e,id){e.preventDefault();selectRotaVisit(id,e.ctrlKey||e.metaKey);rotaContextVisitId=id;const menu=$('#rota-context-menu');if(!menu)return;menu.hidden=false;menu.style.left=`${Math.min(e.clientX,window.innerWidth-250)}px`;menu.style.top=`${Math.min(e.clientY,window.innerHeight-330)}px`;const v=(rotaData.visits||[]).find(x=>x.id===id),lock=menu.querySelector('[data-rota-action="lock"]');if(lock)lock.textContent=Number(v?.planner_locked)?'Unlock visit':'Lock visit';}

function openRotaRecurrence(id){hideRotaContextMenu();const v=(rotaData.visits||[]).find(x=>x.id===id);if(!v)return;const f=$('#rota-recurrence-form');f.reset();f.elements.visitId.value=id;f.elements.action.value=v.template_id||v.recurrence_group_id?'update':'create';f.elements.keepCarer.checked=true;const start=new Date(v.scheduled_start),day=((start.getDay()+6)%7)+1;f.elements.effectiveFrom.value=start.toISOString().slice(0,10);f.querySelectorAll('input[name="days"]').forEach(x=>x.checked=Number(x.value)===day);$('#rota-recurrence-title').textContent=f.elements.action.value==='update'?'Change recurring visit':'Make this visit recurring';$('#rota-recurrence-summary').textContent=`${v.client_name||'Client'} · ${v.visit_type||'Care visit'} · ${start.toLocaleDateString('en-GB',{weekday:'long'})} ${start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${v.staff_name||'Unallocated'}`;f.querySelector('button[type="submit"]').textContent=f.elements.action.value==='update'?'Update recurrence':'Create recurring visit';$('#rota-recurrence-error').hidden=true;updateRecurrenceEndFields();$('#rota-recurrence-dialog').showModal();}
function updateRecurrenceEndFields(){const f=$('#rota-recurrence-form');if(!f)return;const mode=f.elements.endMode.value;const date=f.querySelector('[data-recurrence-end-date]'),count=f.querySelector('[data-recurrence-end-count]');if(date)date.hidden=mode!=='date';if(count)count.hidden=mode!=='count';}
async function recurrenceQuickAction(id,action){const message=action==='pause'?'Pause this recurring schedule? Future weeks will not be generated until it is resumed.':action==='resume'?'Resume this recurring schedule?':'Stop this recurring schedule after this visit?';if(!confirm(message))return;await api(`/api/rota/${id}/recurrence`,{method:'POST',body:JSON.stringify({action,effectiveTo:new Date((rotaData.visits||[]).find(x=>x.id===id)?.scheduled_start||Date.now()).toISOString().slice(0,10)})});await loadRotaBoard();if(typeof loadRotaTemplates==='function')loadRotaTemplates();}
function updateEditTimeLabel(){const input=$('#rota-edit-start'),label=$('#rota-edit-time-label');if(input&&label&&input.value)label.textContent=new Date(input.value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});}
function setVisitEditorTab(name){document.querySelectorAll('[data-visit-tab]').forEach(b=>b.classList.toggle('active',b.dataset.visitTab===name));document.querySelectorAll('[data-visit-panel]').forEach(p=>p.hidden=p.dataset.visitPanel!==name);}
function renderVisitEditorContext(v){const f=$('#rota-edit-form');if(!f||!v)return;const staffId=f.elements.staffId.value||v.staff_id||'',start=new Date(f.elements.scheduledStart.value||v.scheduled_start),duration=Number(f.elements.duration.value||rotaVisitDuration(v));const staffVisits=(rotaData.visits||[]).filter(x=>x.id!==v.id&&(x.staff_id||'')===staffId).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));const previous=[...staffVisits].reverse().find(x=>new Date(x.scheduled_end||x.scheduled_start)<=start),next=staffVisits.find(x=>new Date(x.scheduled_start)>=new Date(start.getTime()+duration*60000));const travel=$('#rota-edit-travel');if(travel)travel.innerHTML=`<strong>Current travel allowance</strong><span>${Number(v.travel_before_minutes||0)} minutes before${v.travel_before_miles?` · ${Number(v.travel_before_miles).toFixed(1)} miles`:''}</span>${v.travel_conflict?'<em class="form-error">⚠ Current route has a travel shortfall.</em>':'<small>No current travel warning recorded.</small>'}`;const route=$('#rota-edit-route');if(route){const step=(icon,title,item,empty)=>item?`<div class="route-step"><span class="route-icon">${icon}</span><div><strong>${title}: ${escapeHtml(item.client_name||'Client')}</strong><span>${new Date(item.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${escapeHtml(item.visit_type||'Care visit')}</span><small>${escapeHtml(item.staff_name||'Selected care worker')}</small></div></div>`:`<div class="route-step"><span class="route-icon">${icon}</span><div><strong>${title}</strong><small>${empty}</small></div></div>`;route.innerHTML=step('←','Previous visit',previous,'No earlier visit for this care worker that day.')+`<div class="route-step"><span class="route-icon">●</span><div><strong>Current visit: ${escapeHtml(v.client_name||'Client')}</strong><span>${start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${duration} minutes</span><small>Travel will be recalculated on save.</small></div></div>`+step('→','Next visit',next,'No later visit for this care worker that day.');}const history=$('#rota-edit-history');if(history)history.innerHTML=`<div class="history-row"><span>Visit status</span><strong>${escapeHtml(rotaStatus(v))}</strong></div><div class="history-row"><span>Planning source</span><strong>${v.template_id||v.recurrence_group_id?'Recurring template':'One-off planner visit'}</strong></div><div class="history-row"><span>Template status</span><strong>${escapeHtml(v.recurrence_status||((v.template_id||v.recurrence_group_id)?'active':'not recurring'))}</strong></div><div class="history-row"><span>Planner protection</span><strong>${Number(v.planner_locked)?'Locked':'Editable'}</strong></div><div class="history-row"><span>Travel state</span><strong>${v.travel_conflict?'Travel warning':'No travel warning'}</strong></div><div class="history-row"><span>Operational note</span><strong>${escapeHtml(v.planner_notes||'No planner note')}</strong></div>`;}
function updateEditRecurrenceVisibility(){const f=$('#rota-edit-form'),on=f?.elements.recurring?.checked,fields=$('#rota-edit-recurrence-fields');if(fields)fields.hidden=!on;const mode=f?.elements.templateEndMode?.value,date=f?.querySelector('[data-edit-recurrence-end-date]'),count=f?.querySelector('[data-edit-recurrence-end-count]');if(date)date.hidden=!on||mode!=='date';if(count)count.hidden=!on||mode!=='count';}
function suitabilityLabel(score){return score>=85?'Excellent':score>=70?'Good':score>=50?'Needs review':'Poor';}
function renderVisitEditorSuitability(v){
 const current=suitabilityForVisit(v);
 const score=$('#rota-edit-suitability-score');
 if(score){score.textContent=`${current.score}%`;score.className=`suitability-big-score compact ${suitabilityTone(current.score)}`;}
 const status=$('#rota-edit-suitability-status');
 if(status){status.textContent=`${suitabilityLabel(current.score)} allocation`;status.className=`suitability-status ${suitabilityTone(current.score)}`;}
 const reasons=$('#rota-edit-suitability-reasons');
 if(reasons)reasons.innerHTML=current.reasons.map(r=>`<li class="${r.tone}">${r.tone==='success'?'✓':r.tone==='danger'?'⚠':'●'} ${escapeHtml(r.text)}</li>`).join('')||'<li class="warning">No suitability factors are available.</li>';
 const alternatives=(rotaData.staff||[]).map(st=>({st,result:candidateScoreDetailed(v,st.id)})).filter(x=>!x.result.blocked).sort((a,b)=>b.result.score-a.result.score);
 const alt=$('#rota-edit-suitability-alternatives');
 if(alt)alt.innerHTML=alternatives.map(x=>{const currentStaff=String(x.st.id)===String(v.staff_id||'');return `<article class="suitability-alternative ${currentStaff?'current':''}"><div><strong>${escapeHtml(x.st.preferred_name||x.st.first_name)} ${escapeHtml(x.st.last_name)}</strong><small>${escapeHtml(x.st.job_title||'Care worker')}</small></div><span class="suitability-chip ${suitabilityTone(x.result.score)}">${x.result.score}%</span>${currentStaff?'<b class="badge success">Current</b>':`<button type="button" class="secondary-button compact" data-editor-reallocate="${escapeHtml(x.st.id)}" data-visit-id="${escapeHtml(v.id)}">Reallocate</button>`}</article>`;}).join('')||'<p class="muted">No conflict-free alternative carers found.</p>';
}
function openRotaEdit(id){hideRotaContextMenu();const v=(rotaData.visits||[]).find(x=>x.id===id);if(!v)return;const f=$('#rota-edit-form');f.reset();f.elements.id.value=v.id;f.elements.scheduledStart.value=rotaIsoLocal(v.scheduled_start);f.elements.duration.value=rotaVisitDuration(v);f.elements.plannerNotes.value=v.planner_notes||'';f.elements.plannerLocked.checked=Number(v.planner_locked)===1;const staff=$('#rota-edit-staff');staff.innerHTML='<option value="">Unallocated</option>'+(rotaData.staff||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.preferred_name||x.first_name)} ${escapeHtml(x.last_name)}</option>`).join('');staff.value=v.staff_id||'';const recurring=Boolean(v.template_id||v.recurrence_group_id);f.elements.recurring.checked=recurring;f.elements.intervalWeeks.value=String(Number(v.recurrence_interval_weeks||1));f.elements.effectiveFrom.value=v.recurrence_effective_from||new Date(v.scheduled_start).toISOString().slice(0,10);f.elements.effectiveTo.value=v.recurrence_effective_to||'';f.elements.endAfterOccurrences.value=Number(v.recurrence_end_after_occurrences||12)||12;f.elements.keepCarer.checked=v.recurrence_keep_carer!==0;const endMode=v.recurrence_end_after_occurrences?'count':v.recurrence_effective_to?'date':'never';f.elements.templateEndMode.value=endMode;const protectedRule=v.protected_time_rule||'flexible',protectedStart=protectedRule!=='flexible';f.dataset.protectedRule=protectedRule;f.dataset.originalStart=v.scheduled_start;const startInput=f.elements.scheduledStart;if(startInput){startInput.title=protectedStart?'Protected client time — manager authorisation is required to change it.':'';}document.querySelectorAll('[data-edit-nudge]').forEach(b=>{b.disabled=protectedStart;b.title=protectedStart?'Protected time':'';});const selectedDays=String(v.recurrence_days||'').split(',').map(Number).filter(Boolean),fallbackDay=((new Date(v.scheduled_start).getDay()+6)%7)+1;f.querySelectorAll('input[name="templateDays"]').forEach(x=>x.checked=(selectedDays.length?selectedDays:[fallbackDay]).includes(Number(x.value)));const state=$('#rota-edit-recurrence-state');state.textContent=!recurring?'One-off visit':v.recurrence_status==='paused'?'Paused template':'Recurring template';state.className=`badge ${!recurring?'neutral':v.recurrence_status==='paused'?'warning':'success'}`;const actions=$('#rota-edit-series-actions'),pause=actions?.querySelector('[data-series-action="pause"]'),resume=actions?.querySelector('[data-series-action="resume"]');if(actions)actions.hidden=!recurring;if(pause)pause.hidden=!recurring||v.recurrence_status==='paused';if(resume)resume.hidden=!recurring||v.recurrence_status!=='paused';$('#rota-edit-summary').innerHTML=`<strong>${escapeHtml(v.client_name||'Client')}</strong><span>${escapeHtml(v.visit_type||'Care visit')} · ${rotaVisitDuration(v)} minutes${recurring?' · Recurring template':''}</span>`;$('#rota-edit-travel').innerHTML=`Travel before: <strong>${Number(v.travel_before_minutes||0)} minutes</strong>${v.travel_before_miles?` · ${Number(v.travel_before_miles).toFixed(1)} miles`:''}. Travel will be recalculated when saved.`;$('#rota-edit-error').hidden=true;updateEditRecurrenceVisibility();updateEditTimeLabel();setVisitEditorTab('general');renderVisitEditorContext(v);renderVisitEditorSuitability(v);const dialog=$('#rota-edit-dialog');if(dialog&&!dialog.open)dialog.showModal();}
function requestProtectedVisitAuthorisation(message){return new Promise(resolve=>{const dialog=$('#protected-visit-dialog'),form=$('#protected-visit-form'),error=form?.querySelector('.form-error');if(!dialog||!form){resolve(null);return;}form.reset();if(error){error.hidden=true;error.textContent='';}const finish=value=>{form.onsubmit=null;dialog.querySelector('[data-protected-cancel]').onclick=null;if(dialog.open)dialog.close();resolve(value);};form.onsubmit=e=>{e.preventDefault();const values=Object.fromEntries(new FormData(form));if(!values.managerEmail||!values.managerPassword||String(values.managerOverrideReason||'').trim().length<5){error.textContent='Enter the manager email, password and a clear reason.';error.hidden=false;return;}finish(values);};dialog.querySelector('[data-protected-cancel]').onclick=()=>finish(null);dialog.showModal();});}
async function patchRotaVisit(id,payload,{recordUndo=true}={}){const current=(rotaData.visits||[]).find(x=>x.id===id);if(!current)return;const before=rotaSnapshot(current);try{await api(`/api/rota/${id}`,{method:'PATCH',body:JSON.stringify(payload)});if(recordUndo){rotaUndoStack.push({before,after:{...before,...payload,id}});rotaRedoStack=[];}await loadRotaBoard();await loadVisitsBoardNoSync();updatePlannerActionState();}catch(e){if(!payload.travelOverrideReason&&e.message.includes('Travel time requires')){const reason=prompt(`${e.message}\n\nEnter an authorised override reason, or press Cancel to leave the visit unchanged:`);if(reason?.trim())return patchRotaVisit(id,{...payload,travelOverrideReason:reason.trim()},{recordUndo});}throw e;}}
async function nudgeRotaVisits(minutes,ids=[...rotaSelected]){for(const id of ids){const v=(rotaData.visits||[]).find(x=>x.id===id);if(!v||Number(v.planner_locked))continue;const start=new Date(v.scheduled_start);start.setMinutes(start.getMinutes()+minutes);const end=new Date(start.getTime()+rotaVisitDuration(v)*60000);await patchRotaVisit(id,{clientId:v.client_id,staffId:v.staff_id||'',visitType:v.visit_type,scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),scope:'single',reason:`Planner nudge ${minutes>0?'+':''}${minutes} minutes`,plannerNotes:v.planner_notes||'',plannerLocked:false});}}
async function copySelectedRota(){const id=[...rotaSelected][0],v=(rotaData.visits||[]).find(x=>x.id===id);if(!v)return;rotaClipboard=rotaSnapshot(v);updatePlannerActionState();}
async function pasteRotaVisit(){if(!rotaClipboard)return;const day=selectedRotaDay(),source=new Date(rotaClipboard.scheduledStart),start=new Date(`${day}T${String(source.getHours()).padStart(2,'0')}:${String(source.getMinutes()).padStart(2,'0')}:00`),duration=Math.max(15,(new Date(rotaClipboard.scheduledEnd)-source)/60000||30),end=new Date(start.getTime()+duration*60000);await api('/api/rota',{method:'POST',body:JSON.stringify({clientId:rotaClipboard.clientId,staffId:rotaClipboard.staffId,visitType:rotaClipboard.visitType,scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),recurrence:'none'})});await loadRotaBoard();}
async function undoRota(){const action=rotaUndoStack.pop();if(!action)return;rotaRedoStack.push(action);const b=action.before;await patchRotaVisit(b.id,{clientId:b.clientId,staffId:b.staffId,visitType:b.visitType,scheduledStart:b.scheduledStart,scheduledEnd:b.scheduledEnd,scope:'single',reason:'Planner undo',plannerNotes:b.plannerNotes,plannerLocked:Boolean(b.plannerLocked),unlockRequested:true},{recordUndo:false});updatePlannerActionState();}
async function redoRota(){const action=rotaRedoStack.pop();if(!action)return;rotaUndoStack.push(action);const a=action.after;await patchRotaVisit(a.id,{clientId:a.clientId,staffId:a.staffId,visitType:a.visitType,scheduledStart:a.scheduledStart,scheduledEnd:a.scheduledEnd,scope:'single',reason:'Planner redo',plannerNotes:a.plannerNotes||'',plannerLocked:Boolean(a.plannerLocked),unlockRequested:true},{recordUndo:false});updatePlannerActionState();}
function renderRotaVisualBoard(){updateRotaDateHeading();const day=selectedRotaDay(),rows=rotaFilteredRows().filter(v=>rotaServiceDayKey(v.scheduled_start)===day),unallocated=rows.filter(v=>!v.staff_id),hours=Array.from({length:ROTA_END_HOUR-ROTA_START_HOUR},(_,i)=>ROTA_START_HOUR+i);if($('#rota-queue-count'))$('#rota-queue-count').textContent=String(unallocated.length);
 const unallocatedScheduler=$('#rota-unallocated-scheduler');if(unallocatedScheduler){const placed=allocateUnallocatedLanes(unallocated),laneCount=Math.max(1,...placed.map(x=>x.lane+1));const subtitle=new Date(day+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});const cards=placed.map(({v,lane})=>{const d=new Date(v.scheduled_start),left=(rotaDisplayHour(d)-ROTA_START_HOUR)*ROTA_HOUR_WIDTH,width=Math.max(52,rotaVisitDuration(v)/60*ROTA_HOUR_WIDTH);return `<article class="unallocated-timeline-visit ${rotaVisitTypeClass(v)}" draggable="${Number(v.planner_locked)?'false':'true'}" data-rota-drag="${v.id}" data-rota-open="${v.id}" style="left:${Math.max(0,left)}px;top:${12+lane*68}px;width:${Math.max(88,width)}px" title="${escapeHtml(v.client_name||'Client')} – ${rotaVisitDuration(v)} minutes"><span class="scheduler-visit-time">${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span><strong class="visit-client-name">${escapeHtml(v.client_name||'Client')}</strong><span class="visit-card-meta">${escapeHtml(v.visit_type||'Care visit')} · ${rotaVisitDuration(v)} min</span></article>`;}).join('');const empty=!unallocated.length?'<div class="unallocated-empty-state"><span>✓</span><strong>No visits waiting for allocation</strong><small>New unassigned visits will appear at their required time.</small></div>':'';unallocatedScheduler.innerHTML=rotaTimeHeader('Unallocated','Required visit times',hours)+`<div class="unallocated-drop-lane" style="height:${Math.max(110,laneCount*68+24)}px">${cards}${empty}</div>`;
  const saved=Number(localStorage.getItem('corecare_rota_allocation_height')||0),manual=saved>=240;if(manual)applyAllocationPanelHeight(saved,true);else applyAllocationPanelHeight(recommendedAllocationHeight(unallocated.length,laneCount),false);
 }
 const scheduler=$('#rota-scheduler');if(!scheduler)return;const staff=rotaData.staff||[];const header=rotaTimeHeader('Care worker',new Date(day+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}),hours);if(!staff.length){const placeholders=Array.from({length:4},(_,i)=>`<div class="scheduler-row scheduler-placeholder-row"><button class="scheduler-staff scheduler-add-staff" type="button" data-page-link="staff"><span class="staff-avatar">+</span><div><strong>${i===0?'Add care workers':'Available staff row'}</strong><small>${i===0?'Create active staff records to start allocating':'Waiting for an active care worker'}</small></div></button><div class="scheduler-lane scheduler-placeholder-lane"></div></div>`).join('');scheduler.innerHTML=header+placeholders+`<div class="scheduler-empty-overlay"><strong>Your planning grid is ready</strong><span>Add active care workers and visits to begin building the rota.</span><button type="button" class="primary-button compact" data-page-link="staff">Add care worker</button></div>`;scheduler.querySelectorAll('[data-page-link]').forEach(b=>b.addEventListener('click',()=>navigateTo('staff')));wireRotaDragging();wireRotaScrollSync();wireAllocationSplitter();return;}scheduler.innerHTML=header+staff.map(st=>{const visits=rows.filter(v=>v.staff_id===st.id),minutes=visits.reduce((sum,v)=>sum+rotaVisitDuration(v),0),travelMinutes=visits.reduce((sum,v)=>sum+Number(v.travel_before_minutes||0),0),util=Math.min(100,Math.round(minutes/480*100)),continuityVisits=visits.filter(v=>(rotaData.preferredAssignments||[]).some(a=>a.client_id===v.client_id&&a.staff_id===st.id)||(rotaData.visits||[]).some(x=>x.client_id===v.client_id&&x.staff_id===st.id&&x.id!==v.id)),continuity=visits.length?Math.round(continuityVisits.length/visits.length*100):100,late=visits.filter(v=>['late','overrunning'].includes(rotaStatus(v))).length;return `<div class="scheduler-row"><div class="scheduler-staff"><span class="staff-avatar">${escapeHtml(((st.preferred_name||st.first_name||'?')[0]+(st.last_name||'')[0]).toUpperCase())}</span><div class="scheduler-staff-copy"><strong>${escapeHtml(st.preferred_name||st.first_name)} ${escapeHtml(st.last_name)}</strong><small>${escapeHtml(st.job_title||'Care worker')} · ${visits.length} visit${visits.length===1?'':'s'}</small><span class="staff-utilisation"><i style="width:${util}%"></i></span><em>${Math.floor(minutes/60)}h ${minutes%60}m care · ${travelMinutes}m travel</em><span class="staff-mini-metrics"><b>${continuity}% continuity</b><b>${late} late</b><b>${util>100?'Overtime':'No overtime'}</b></span></div></div><div class="scheduler-lane" data-staff-id="${st.id}">${visits.map(renderSchedulerVisit).join('')}</div></div>`}).join('');
 const now=new Date();if(rotaServiceDayKey(now)===day){const x=(rotaDisplayHour(now)-ROTA_START_HOUR)*ROTA_HOUR_WIDTH;scheduler.querySelectorAll('.scheduler-lane').forEach(l=>l.insertAdjacentHTML('beforeend',`<i class="scheduler-now" style="left:${x}px"></i>`));unallocatedScheduler?.querySelector('.unallocated-drop-lane')?.insertAdjacentHTML('beforeend',`<i class="scheduler-now" style="left:${x}px"></i>`);}
 wireRotaDragging();wireRotaResize();wireRotaScrollSync();wireAllocationSplitter();}
function wireRotaScrollSync(){const a=$('#rota-unallocated-scroll'),b=$('#rota-worker-scroll');if(!a||!b)return;let syncing=false;const sync=(from,to)=>{if(syncing)return;syncing=true;to.scrollLeft=from.scrollLeft;requestAnimationFrame(()=>syncing=false);};a.onscroll=()=>sync(a,b);b.onscroll=()=>sync(b,a);}
function wireAllocationSplitter(){const splitter=$('#rota-board-splitter'),panel=$('#rota-unallocated-panel');if(!splitter||!panel||splitter.dataset.wired==='true')return;splitter.dataset.wired='true';const resizeTo=y=>{const top=panel.getBoundingClientRect().top;applyAllocationPanelHeight(y-top,true);localStorage.setItem('corecare_rota_allocation_height',String(Math.round(Math.max(240,Math.min(650,y-top)))));};splitter.addEventListener('pointerdown',e=>{e.preventDefault();splitter.setPointerCapture?.(e.pointerId);document.body.classList.add('resizing-rota-allocation');const move=ev=>resizeTo(ev.clientY);const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.body.classList.remove('resizing-rota-allocation');};document.addEventListener('pointermove',move);document.addEventListener('pointerup',up,{once:true});});splitter.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const current=panel.getBoundingClientRect().height,next=current+(e.key==='ArrowDown'?30:-30);applyAllocationPanelHeight(next,true);localStorage.setItem('corecare_rota_allocation_height',String(Math.round(next)));});$('#rota-allocation-reset')?.addEventListener('click',()=>{localStorage.removeItem('corecare_rota_allocation_height');renderRotaVisualBoard();});}
function rotaVisitBadges(v){const badges=[];if(v.protected_time_rule&&v.protected_time_rule!=='flexible')badges.push('<i title="Time-critical visit — the time is protected, but the carer can still be changed">⏱</i>');if(v.template_id||v.recurrence_group_id)badges.push('<i title="Recurring">🔄</i>');if(/med/i.test(v.visit_type||''))badges.push('<i title="Medication">💊</i>');if(Number(v.required_staff||v.staff_required||1)>1||v.double_up)badges.push('<i title="Double-up">👥</i>');if(v.travel_conflict)badges.push('<i title="Travel risk">🚗</i>');if(v.planner_notes)badges.push('<i title="Planner note">📝</i>');return badges.length?`<span class="visit-card-badges">${badges.join('')}</span>`:'';}
function rotaVisitHoverCard(v){const start=new Date(v.scheduled_start),duration=rotaVisitDuration(v),end=new Date(start.getTime()+duration*60000),flags=[];if(v.protected_time_rule&&v.protected_time_rule!=='flexible')flags.push('Time protected');if(v.template_id||v.recurrence_group_id)flags.push('Recurring');if(/med/i.test(v.visit_type||''))flags.push('Medication');if(Number(v.required_staff||v.staff_required||1)>1||v.double_up)flags.push('Double-up');if(v.travel_conflict)flags.push('Travel warning');return `<span class="visit-hover-card"><strong>${escapeHtml(v.client_name||'Client')}</strong><span>${start.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}–${end.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span><span>${escapeHtml(v.visit_type||'Care visit')} · ${duration} min</span><span>${escapeHtml(v.staff_name||'Unallocated')}</span>${flags.length?`<small>${escapeHtml(flags.join(' · '))}</small>`:''}<em>Double-click to edit</em></span>`;}
function renderSchedulerVisit(v){const d=new Date(v.scheduled_start),mins=(rotaDisplayHour(d)-ROTA_START_HOUR)*ROTA_HOUR_WIDTH,duration=rotaVisitDuration(v),width=Math.max(88,duration/60*ROTA_HOUR_WIDTH),travel=Number(v.travel_before_minutes||0),travelWidth=travel/60*ROTA_HOUR_WIDTH,travelLeft=Math.max(0,mins-travelWidth);const travelBlock=travel>0?`<span class="scheduler-travel ${v.travel_conflict?'conflict':''}" style="left:${travelLeft}px;width:${Math.max(18,travelWidth)}px" title="${travel} minutes travel${v.travel_before_miles?` · ${Number(v.travel_before_miles).toFixed(1)} miles`:''}"><b>🚗 ${travel}m</b></span>`:'';const locked=Number(v.planner_locked)===1,protectedTime=Boolean(v.protected_time_rule&&v.protected_time_rule!=='flexible'),suitability=suitabilityForVisit(v),routeOrder=rotaDayRows(rotaServiceDayKey(v.scheduled_start)).filter(x=>x.staff_id===v.staff_id).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start)).findIndex(x=>x.id===v.id)+1;return `${travelBlock}<article class="scheduler-visit ${escapeHtml(rotaStatus(v))} ${rotaVisitTypeClass(v)} ${v.travel_conflict?'travel-risk':''} ${locked?'is-locked':''} ${protectedTime?'has-protected-time':''} ${v.planner_notes?'has-notes':''}" draggable="${locked?'false':'true'}" data-rota-drag="${v.id}" data-rota-open="${v.id}" style="left:${Math.max(0,mins)}px;width:${width}px" title="${escapeHtml(v.client_name||'Client')} – ${duration} minutes${protectedTime?' · Time protected; carer may still be changed':''}${travel?` · ${travel} minutes travel before`:''}${v.planner_notes?` · Note: ${escapeHtml(v.planner_notes)}`:''}"><span class="scheduler-visit-time">${d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span><span class="suitability-chip ${suitabilityTone(suitability.score)}" title="Allocation suitability — double-click the visit and open Suitability">${suitability.score}%</span><i class="route-order" title="Route order">${routeOrder}</i><strong class="visit-client-name">${escapeHtml(v.client_name||'Client')}</strong><span class="visit-card-meta">${escapeHtml(v.visit_type||'Care visit')} · ${duration} min</span>${v.travel_conflict?'<em>⚠ Travel shortfall</em>':''}${rotaVisitBadges(v)}${(v.template_id||v.recurrence_group_id)?'<i class="recurrence-badge legacy-badge" title="Recurring visit">🔄</i>':''}${protectedTime?`<i class="recurrence-badge protected-time-badge" title="${escapeHtml(v.protected_time_reason||'Time-critical visit: time protected, carer allocation remains editable')}">⏱</i>`:''}${locked?'<i class="recurrence-badge planner-lock-badge" title="Planner locked">🔒</i>':''}${locked||protectedTime?'':`<i class="scheduler-resize" data-rota-resize="${v.id}"></i>`}</article>`;}
function renderRotaWeek(){const grid=$('#rota-week-grid');if(!grid)return;const rows=rotaFilteredRows();grid.innerHTML=rotaDayDates().map(d=>{const day=d.toISOString().slice(0,10),items=rows.filter(v=>rotaServiceDayKey(v.scheduled_start)===day);return `<section class="rota-week-day"><header><strong>${d.toLocaleDateString('en-GB',{weekday:'long'})}</strong><br><small>${d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</small></header>${items.map(v=>`<article class="rota-week-card"><strong>${new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} ${escapeHtml(v.client_name||'Client')}</strong><small>${escapeHtml(v.staff_name||'Unallocated')} · ${escapeHtml(rotaStatus(v).replaceAll('_',' '))}</small></article>`).join('')||'<p class="rota-drop-message">No visits</p>'}</section>`}).join('');}
function renderRotaList(){const rows=rotaFilteredRows(),groups={};rows.forEach(v=>{const day=rotaServiceDayKey(v.scheduled_start);(groups[day]??=[]).push(v)});const grid=$('#rota-grid');if(grid)grid.innerHTML=Object.entries(groups).map(([day,items])=>`<section class="rota-day"><header><strong>${new Date(day+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long'})}</strong><span>${new Date(day+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span></header>${items.map(v=>`<article class="rota-visit"><time>${new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</time><div><strong>${escapeHtml(v.client_name||'Client')}</strong><span>${escapeHtml(v.visit_type)} · ${escapeHtml(v.staff_name||'Unallocated')}</span></div><span class="badge ${rotaStatus(v)==='late'||rotaStatus(v)==='overrunning'?'danger':v.status==='completed'?'success':v.status==='in_progress'?'active':'neutral'}">${escapeHtml(rotaStatus(v).replaceAll('_',' '))}</span>${v.status==='scheduled'?`<button class="text-button" data-rota-cancel="${v.id}">Cancel</button>`:''}</article>`).join('')}</section>`).join('');document.querySelectorAll('[data-rota-cancel]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Cancel this rota visit?'))return;await api(`/api/rota/${b.dataset.rotaCancel}/cancel`,{method:'POST',body:JSON.stringify({reason:'Cancelled by manager'})});await loadRotaBoard();await loadVisitsBoardNoSync();}));}
async function moveRotaVisit(id,staffId,startDate,duration,travelOverrideReason=''){const v=(rotaData.visits||[]).find(x=>x.id===id);if(!v)return;if(Number(v.planner_locked))return alert('This visit is planner locked. Open it and unlock it before moving.');const start=new Date(startDate),timeChanged=start.getTime()!==new Date(v.scheduled_start).getTime(),protectedTime=v.protected_time_rule&&v.protected_time_rule!=='flexible';if(protectedTime&&timeChanged)return showErrorToast?.('This visit time is protected. A manager must authorise any time change in the visit editor.');const end=new Date(start.getTime()+(duration||rotaVisitDuration(v))*60000),payload={clientId:v.client_id,staffId:staffId||'',visitType:v.visit_type,scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),scope:'single',reason:'Planner drag-and-drop adjustment',travelOverrideReason,plannerNotes:v.planner_notes||'',plannerLocked:false};try{await patchRotaVisit(id,payload);}catch(e){alert(e.message);}}
function rotaDropTime(lane,event){const rect=lane.getBoundingClientRect(),raw=(event.clientX-rect.left)/ROTA_HOUR_WIDTH+ROTA_START_HOUR,rounded=Math.round((raw*60)/rotaSnapMinutes())*rotaSnapMinutes()/60,start=new Date(`${selectedRotaDay()}T00:00:00`);start.setHours(Math.floor(rounded),Math.round((rounded%1)*60),0,0);return start;}
function allocationDropStart(visit,targetStaffId,lane,event){const original=new Date(visit.scheduled_start),staffChanged=(visit.staff_id||'')!==(targetStaffId||'');if(staffChanged)return original;return rotaDropTime(lane,event);}
function wireRotaDragging(){document.querySelectorAll('[data-rota-drag]').forEach(el=>{el.addEventListener('dragstart',e=>{const pv=(rotaData.visits||[]).find(v=>v.id===el.dataset.rotaDrag);if(Number(pv?.planner_locked)===1){e.preventDefault();showErrorToast?.('This visit is planner locked. Open the visit editor and unlock it before moving.');return;}e.dataTransfer.setData('text/rota-id',el.dataset.rotaDrag);e.dataTransfer.effectAllowed='move';document.body.classList.add('rota-is-dragging');});el.addEventListener('dragend',()=>document.body.classList.remove('rota-is-dragging'));});document.querySelectorAll('.scheduler-lane').forEach(lane=>{lane.addEventListener('dragover',e=>{e.preventDefault();lane.classList.add('drag-over')});lane.addEventListener('dragleave',()=>lane.classList.remove('drag-over'));lane.addEventListener('drop',async e=>{e.preventDefault();lane.classList.remove('drag-over');const id=e.dataTransfer.getData('text/rota-id'),v=(rotaData.visits||[]).find(x=>x.id===id);if(!v)return;const targetStaffId=lane.dataset.staffId||'',start=allocationDropStart(v,targetStaffId,lane,e),timeChanged=new Date(start).getTime()!==new Date(v.scheduled_start).getTime(),protectedTime=v.protected_time_rule&&v.protected_time_rule!=='flexible';if(protectedTime&&timeChanged){showErrorToast?.('This visit time is protected. Drag it to another carer without changing its time, or use the visit editor for manager authorisation.');return;}await moveRotaVisit(id,targetStaffId,start);});});document.querySelectorAll('.unallocated-drop-lane').forEach(lane=>{lane.addEventListener('dragover',e=>{e.preventDefault();lane.classList.add('drag-over')});lane.addEventListener('dragleave',()=>lane.classList.remove('drag-over'));lane.addEventListener('drop',async e=>{e.preventDefault();lane.classList.remove('drag-over');const id=e.dataTransfer.getData('text/rota-id'),v=(rotaData.visits||[]).find(x=>x.id===id);if(!v)return;const start=allocationDropStart(v,'',lane,e),timeChanged=new Date(start).getTime()!==new Date(v.scheduled_start).getTime(),protectedTime=v.protected_time_rule&&v.protected_time_rule!=='flexible';if(protectedTime&&timeChanged){showErrorToast?.('This visit time is protected. Unallocate it without changing the time, or use the visit editor for manager authorisation.');return;}await moveRotaVisit(id,'',start);});});}
function wireRotaResize(){document.querySelectorAll('[data-rota-resize]').forEach(handle=>{handle.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();const id=handle.dataset.rotaResize,v=(rotaData.visits||[]).find(x=>x.id===id),card=handle.closest('.scheduler-visit'),startX=e.clientX,startWidth=card.offsetWidth;const move=ev=>{card.style.width=Math.max(42,startWidth+ev.clientX-startX)+'px'};const up=async ev=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);const mins=Math.max(15,Math.round(((startWidth+ev.clientX-startX)/ROTA_HOUR_WIDTH*60)/rotaSnapMinutes())*rotaSnapMinutes());await moveRotaVisit(id,v.staff_id,new Date(v.scheduled_start),mins)};document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);});});}
function setRotaView(view){rotaView=view;document.querySelectorAll('[data-rota-view]').forEach(b=>b.classList.toggle('active',b.dataset.rotaView===view));$('#rota-board-view').hidden=view!=='board';$('#rota-week-view').hidden=view!=='week';$('#rota-list-view').hidden=view!=='list';$('#rota-day-label').hidden=view!=='board';}
function setRotaPlanningMode(enabled){const page=$('#rota-page');if(!page)return;page.classList.toggle('planning-board-mode',enabled);if(enabled){document.title='CoreCare · Full planning board';setTimeout(()=>$('.rota-planner-panel')?.scrollIntoView({block:'start'}),50);}else document.title='CoreCare';}
$('#rota-open-planner')?.addEventListener('click',()=>setRotaPlanningMode(true));
$('#rota-return-overview')?.addEventListener('click',()=>{setRotaPlanningMode(false);window.scrollTo({top:0,behavior:'smooth'});});
if(location.hash==='#rota-planning'){setTimeout(()=>{document.querySelector('[data-page="rota"]')?.click();setRotaPlanningMode(true);},300);}
$('#rota-new')?.addEventListener('click',async()=>{if(!rotaData.clients?.length)await loadRotaBoard();$('#rota-form')?.reset();$('#rota-dialog')?.showModal();});$('#rota-refresh')?.addEventListener('click',loadRotaBoard);$('#rota-week')?.addEventListener('change',loadRotaBoard);$('#rota-day')?.addEventListener('change',()=>{renderRotaVisualBoard();renderRotaIntelligence();renderPlannerCommandCentre();});$('#rota-status-filter')?.addEventListener('change',renderRotaBoard);$('#rota-staff-filter')?.addEventListener('change',renderRotaVisualBoard);$('#rota-prev-day')?.addEventListener('click',()=>changeRotaDay(-1));$('#rota-next-day')?.addEventListener('click',()=>changeRotaDay(1));$('#rota-today')?.addEventListener('click',()=>{const today=new Date(),m=new Date(today),d=(m.getDay()+6)%7;m.setDate(m.getDate()-d);$('#rota-week').value=m.toISOString().slice(0,10);loadRotaBoard().then(()=>{$('#rota-day').value=today.toISOString().slice(0,10);renderRotaVisualBoard();});});document.querySelectorAll('[data-rota-view]').forEach(b=>b.addEventListener('click',()=>setRotaView(b.dataset.rotaView)));
$('#rota-optimise')?.addEventListener('click',openRotaOptimiser);$('#rota-optimise-apply')?.addEventListener('click',applyRotaOptimiser);
$('#rota-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,err=$('#rota-form-error');if(err)err.hidden=true;try{const payload=Object.fromEntries(new FormData(form));const localStart=payload.scheduledStart;if(payload.scheduledStart)payload.scheduledStart=new Date(payload.scheduledStart).toISOString();if(payload.scheduledEnd)payload.scheduledEnd=new Date(payload.scheduledEnd).toISOString();const serviceDay=rotaServiceDayKey(payload.scheduledStart);const r=await api('/api/rota',{method:'POST',body:JSON.stringify(payload)});form.reset();$('#rota-dialog')?.close();if($('#rota-status-filter'))$('#rota-status-filter').value='all';if($('#rota-staff-filter'))$('#rota-staff-filter').value='all';setRotaSelectedServiceDay(serviceDay);await loadRotaBoard();if($('#rota-day'))$('#rota-day').value=serviceDay;renderRotaBoard();await loadVisitsBoardNoSync();const created=(rotaData.visits||[]).find(v=>v.id===r.id);if(created){requestAnimationFrame(()=>focusRotaItem(created.id));}else{throw new Error(`The visit was saved for ${new Date(localStart).toLocaleString('en-GB')}, but could not be found in the refreshed rota.`);}if(r.created>1)alert(`${r.created} weekly visits published.`);}catch(ex){if(err){err.textContent=ex.message;err.hidden=false;}}});

document.addEventListener('click',e=>{const card=e.target.closest?.('[data-rota-open]');if(card&&!e.target.closest('[data-rota-resize]'))selectRotaVisit(card.dataset.rotaOpen,e.ctrlKey||e.metaKey);if(!e.target.closest?.('#rota-context-menu'))hideRotaContextMenu();});
document.addEventListener('dblclick',e=>{const card=e.target.closest?.('[data-rota-open]');if(card)openRotaEdit(card.dataset.rotaOpen);});
document.addEventListener('contextmenu',e=>{const card=e.target.closest?.('[data-rota-open]');if(card)showRotaContextMenu(e,card.dataset.rotaOpen);});
$('#rota-snap')?.addEventListener('change',e=>localStorage.setItem('corecare_rota_snap',e.target.value));if($('#rota-snap'))$('#rota-snap').value=localStorage.getItem('corecare_rota_snap')||'15';
$('#rota-copy')?.addEventListener('click',copySelectedRota);$('#rota-paste')?.addEventListener('click',pasteRotaVisit);$('#rota-undo')?.addEventListener('click',undoRota);$('#rota-redo')?.addEventListener('click',redoRota);
document.querySelectorAll('[data-edit-nudge]').forEach(b=>b.addEventListener('click',()=>{const input=$('#rota-edit-start');if(!input.value)return;const d=new Date(input.value);d.setMinutes(d.getMinutes()+Number(b.dataset.editNudge));input.value=rotaIsoLocal(d);updateEditTimeLabel();}));$('#rota-edit-start')?.addEventListener('change',updateEditTimeLabel);
document.querySelectorAll('[data-visit-tab]').forEach(b=>b.addEventListener('click',()=>setVisitEditorTab(b.dataset.visitTab)));['rota-edit-start','rota-edit-duration','rota-edit-staff'].forEach(id=>$('#'+id)?.addEventListener('change',()=>{const visit=(rotaData.visits||[]).find(x=>x.id===$('#rota-edit-form')?.elements.id.value);if(visit){const preview={...visit,staff_id:$('#rota-edit-staff')?.value||'',scheduled_start:$('#rota-edit-start')?.value?new Date($('#rota-edit-start').value).toISOString():visit.scheduled_start,scheduled_end:$('#rota-edit-start')?.value?new Date(new Date($('#rota-edit-start').value).getTime()+Number($('#rota-edit-duration')?.value||rotaVisitDuration(visit))*60000).toISOString():visit.scheduled_end};renderVisitEditorContext(preview);renderVisitEditorSuitability(preview);}}));
$('#rota-edit-recurring')?.addEventListener('change',updateEditRecurrenceVisibility);$('#rota-edit-form')?.elements.templateEndMode?.addEventListener('change',updateEditRecurrenceVisibility);
$('#rota-edit-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,id=f.elements.id.value,v=(rotaData.visits||[]).find(x=>x.id===id),start=new Date(f.elements.scheduledStart.value),end=new Date(start.getTime()+Number(f.elements.duration.value)*60000),err=$('#rota-edit-error'),wasRecurring=Boolean(v.template_id||v.recurrence_group_id),makeRecurring=f.elements.recurring.checked;err.hidden=true;try{await patchRotaVisit(id,{clientId:v.client_id,staffId:f.elements.staffId.value,visitType:v.visit_type,scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),scope:f.elements.scope.value,reason:f.elements.reason.value,plannerNotes:f.elements.plannerNotes.value,plannerLocked:f.elements.plannerLocked.checked,unlockRequested:Number(v.planner_locked)===1&&!f.elements.plannerLocked.checked});if(makeRecurring){const days=[...f.querySelectorAll('input[name="templateDays"]:checked')].map(x=>Number(x.value));if(!days.length)throw new Error('Select at least one day for the recurring template.');const mode=f.elements.templateEndMode.value;await api(`/api/rota/${id}/recurrence`,{method:'POST',body:JSON.stringify({action:wasRecurring?'update':'create',days,intervalWeeks:Number(f.elements.intervalWeeks.value),effectiveFrom:f.elements.effectiveFrom.value,keepCarer:f.elements.keepCarer.checked,effectiveTo:mode==='date'?f.elements.effectiveTo.value:'',endAfterOccurrences:mode==='count'?Number(f.elements.endAfterOccurrences.value):0})});}else if(wasRecurring){await api(`/api/rota/${id}/recurrence`,{method:'POST',body:JSON.stringify({action:'stop',detachVisit:true,effectiveTo:new Date(start).toISOString().slice(0,10)})});}$('#rota-edit-dialog').close();await loadRotaBoard();if(typeof loadRotaTemplates==='function')loadRotaTemplates();}catch(ex){if(ex.code==='TIME_CRITICAL_AUTH_REQUIRED'||ex.code==='MANAGER_AUTH_FAILED'||ex.code==='MANAGER_AUTH_FORBIDDEN'){const authorisation=await requestProtectedVisitAuthorisation(ex.message);if(!authorisation)return;try{await patchRotaVisit(id,{clientId:v.client_id,staffId:f.elements.staffId.value,visitType:v.visit_type,scheduledStart:start.toISOString(),scheduledEnd:end.toISOString(),scope:f.elements.scope.value,reason:f.elements.reason.value,plannerNotes:f.elements.plannerNotes.value,plannerLocked:f.elements.plannerLocked.checked,...authorisation});$('#rota-edit-dialog').close();await loadRotaBoard();}catch(authError){err.textContent=authError.message;err.hidden=false;}return;}err.textContent=ex.message;err.hidden=false;}});
$('#rota-edit-series-actions')?.addEventListener('click',async e=>{const action=e.target.dataset.seriesAction;if(!action)return;const f=$('#rota-edit-form'),id=f.elements.id.value;if(action==='stop'){if(!confirm('Stop this recurring template and keep this visit as a one-off visit?'))return;f.elements.recurring.checked=false;updateEditRecurrenceVisibility();return;}try{await recurrenceQuickAction(id,action);openRotaEdit(id);}catch(ex){const err=$('#rota-edit-error');err.textContent=ex.message;err.hidden=false;}});

$('#rota-recurrence-form')?.elements.endMode?.addEventListener('change',updateRecurrenceEndFields);
$('#rota-recurrence-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,err=$('#rota-recurrence-error'),days=[...f.querySelectorAll('input[name="days"]:checked')].map(x=>Number(x.value));if(!days.length){err.textContent='Select at least one day.';err.hidden=false;return;}const mode=f.elements.endMode.value,payload={action:f.elements.action.value,days,intervalWeeks:Number(f.elements.intervalWeeks.value),effectiveFrom:f.elements.effectiveFrom.value,keepCarer:f.elements.keepCarer.checked,effectiveTo:mode==='date'?f.elements.effectiveTo.value:'',endAfterOccurrences:mode==='count'?Number(f.elements.endAfterOccurrences.value):0};try{await api(`/api/rota/${f.elements.visitId.value}/recurrence`,{method:'POST',body:JSON.stringify(payload)});$('#rota-recurrence-dialog').close();await loadRotaBoard();if(typeof loadRotaTemplates==='function')loadRotaTemplates();}catch(ex){err.textContent=ex.message;err.hidden=false;}});
$('#rota-context-menu')?.addEventListener('click',async e=>{const action=e.target.dataset.rotaAction;if(!action||!rotaContextVisitId)return;const id=rotaContextVisitId,v=(rotaData.visits||[]).find(x=>x.id===id);hideRotaContextMenu();try{if(action==='edit')return openRotaEdit(id);if(action==='copy'){selectRotaVisit(id);return copySelectedRota();}if(action.startsWith('nudge-')){const mins=action.includes('back')?-Number(action.split('-').pop()):Number(action.split('-').pop());return nudgeRotaVisits(mins,[id]);}if(action==='duplicate'){rotaClipboard=rotaSnapshot(v);return pasteRotaVisit();}if(action==='lock'){return patchRotaVisit(id,{clientId:v.client_id,staffId:v.staff_id||'',visitType:v.visit_type,scheduledStart:v.scheduled_start,scheduledEnd:v.scheduled_end,scope:'single',reason:Number(v.planner_locked)?'Visit unlocked':'Visit locked',plannerNotes:v.planner_notes||'',plannerLocked:!Number(v.planner_locked),unlockRequested:true});}if(action==='split'){const total=rotaVisitDuration(v);if(total<30)return alert('Visits shorter than 30 minutes cannot be split.');const first=Math.round((total/2)/5)*5,second=total-first,start=new Date(v.scheduled_start),mid=new Date(start.getTime()+first*60000),end=new Date(v.scheduled_end);await patchRotaVisit(id,{clientId:v.client_id,staffId:v.staff_id||'',visitType:v.visit_type,scheduledStart:start.toISOString(),scheduledEnd:mid.toISOString(),scope:'single',reason:'Visit split by planner',plannerNotes:v.planner_notes||'',plannerLocked:false});await api('/api/rota',{method:'POST',body:JSON.stringify({clientId:v.client_id,staffId:v.staff_id||'',visitType:`${v.visit_type} (part 2)`,scheduledStart:mid.toISOString(),scheduledEnd:end.toISOString(),recurrence:'none'})});return loadRotaBoard();}}catch(ex){alert(ex.message);}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoRota():undoRota();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'&&rotaSelected.size===1&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();copySelectedRota();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'&&rotaClipboard&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();pasteRotaVisit();}if(e.key==='Escape')hideRotaContextMenu();});
updatePlannerActionState();

const VISIT_QUEUE_KEY='corecare_visit_event_queue_v1';
function visitQueue(){try{return JSON.parse(localStorage.getItem(VISIT_QUEUE_KEY)||'[]')}catch{return[]}}
function saveVisitQueue(q){localStorage.setItem(VISIT_QUEUE_KEY,JSON.stringify(q));renderSyncStatus();}
function setVisitText(sel,val){const n=$(sel);if(n)n.textContent=String(val??0)}
async function loadVisitsBoard(){visitsData=await api('/api/visits/board');renderVisitsBoard();await syncPendingVisitEvents();}
function renderVisitsBoard(){const s=visitsData.stats||{};setVisitText('#visit-scheduled',s.scheduled);setVisitText('#visit-progress',s.inProgress);setVisitText('#visit-late',s.late);setVisitText('#visit-completed',s.completed);setVisitText('#visit-overrunning',s.overrunning);
 const list=$('#visits-live-list');if(list)list.innerHTML=(visitsData.visits||[]).map(v=>`<article class="operations-row visit-live-row visit-openable" data-visit-open="${escapeHtml(v.id)}" tabindex="0" role="button" aria-label="Open care record for ${escapeHtml(v.client_name||'client')}"><div class="operations-row-status ${escapeHtml(v.live_status||v.status)}"></div><div><strong>${escapeHtml(v.client_name||'Client')}</strong><p>${escapeHtml(v.visit_type||'Care visit')}</p><small>${opFmt(v.scheduled_start)} · ${escapeHtml(v.staff_name||'Unallocated')}</small></div><span class="badge ${v.live_status==='late'||v.live_status==='overrunning'?'danger':v.status==='completed'?'success':v.status==='in_progress'?'active':'neutral'}">${escapeHtml((v.live_status||v.status).replaceAll('_',' '))}</span><button type="button" class="secondary-button compact" data-visit-record="${escapeHtml(v.id)}">${v.status==='completed'?'View record':v.status==='in_progress'?'Record care':'Open visit'}</button></article>`).join('')||'<div class="empty-state"><strong>No visits today</strong><span>Schedule a visit to begin live monitoring.</span></div>';
 document.querySelectorAll('[data-visit-record]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openVisitCareRecord(b.dataset.visitRecord);}));
 document.querySelectorAll('[data-visit-open]').forEach(row=>{row.addEventListener('click',()=>openVisitCareRecord(row.dataset.visitOpen));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openVisitCareRecord(row.dataset.visitOpen);}});});
 const co='<option value="">Select client</option>'+(visitsData.clients||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.preferred_name||x.first_name)} ${escapeHtml(x.last_name)}</option>`).join('');const so='<option value="">Unallocated</option>'+(visitsData.staff||[]).map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.preferred_name||x.first_name)} ${escapeHtml(x.last_name)}</option>`).join('');if($('#visit-client'))$('#visit-client').innerHTML=co;if($('#visit-code-client'))$('#visit-code-client').innerHTML=co;if($('#visit-staff'))$('#visit-staff').innerHTML=so;renderSyncStatus();}
function renderSyncStatus(){const q=visitQueue(),n=$('#visit-sync-status');if(n)n.innerHTML=q.length?`<strong>${q.length} event${q.length===1?'':'s'} saved offline</strong><span>CoreCare will retry automatically. <button id="visit-sync-now" class="text-button">Sync now</button></span>`:'<strong>All visit events synced</strong><span>No offline records waiting.</span>';$('#visit-sync-now')?.addEventListener('click',syncPendingVisitEvents);}
async function queueVisitEvent(type,code){const event={eventId:crypto.randomUUID(),type,code:code.trim(),deviceTime:new Date().toISOString(),source:navigator.onLine?'online':'offline'};const q=visitQueue();q.push(event);saveVisitQueue(q);await syncPendingVisitEvents();}
async function syncPendingVisitEvents(){const q=visitQueue();if(!q.length||!navigator.onLine)return;try{const response=await api('/api/visits/sync',{method:'POST',body:JSON.stringify({events:q})});const ok=new Set((response.results||[]).filter(x=>x.ok).map(x=>x.eventId));saveVisitQueue(q.filter(x=>!ok.has(x.eventId)));if(ok.size)await loadVisitsBoardNoSync();}catch(e){console.warn('Visit sync deferred',e);renderSyncStatus();}}
async function loadVisitsBoardNoSync(){visitsData=await api('/api/visits/board');renderVisitsBoard();}
$('#visits-refresh')?.addEventListener('click',loadVisitsBoard);$('#visit-new')?.addEventListener('click',()=>$('#visit-dialog')?.showModal());$('#visit-clock')?.addEventListener('click',()=>$('#visit-clock-dialog')?.showModal());$('#visit-code')?.addEventListener('click',()=>$('#visit-code-dialog')?.showModal());
$('#visit-form')?.addEventListener('submit',async e=>{e.preventDefault();await api('/api/visits',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});e.currentTarget.reset();$('#visit-dialog')?.close();await loadVisitsBoard();});
$('#visit-code-form')?.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));const r=await api('/api/visits/client-code',{method:'POST',body:JSON.stringify(data)});$('#visit-code-result').textContent=r.code;$('#visit-code-result-wrap').hidden=false;});
$('#visit-clock-form')?.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));await queueVisitEvent(data.type,data.code);$('#visit-clock-dialog')?.close();e.currentTarget.reset();});
window.addEventListener('online',syncPendingVisitEvents);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncPendingVisitEvents()});setInterval(syncPendingVisitEvents,60000);renderSyncStatus();


function populatePermissionUserSelect(){const s=$('#permission-user');if(!s)return;const value=s.value;s.innerHTML='<option value="">Select a user</option>'+users.filter(u=>u.status==='active').map(u=>`<option value="${escapeHtml(u.id)}">${escapeHtml(u.displayName)} · ${escapeHtml(roleLabel(u.accessLevel||u.role))}</option>`).join('');s.value=value;}
async function loadRoutingSettings(){const form=$('#routing-settings-form');if(!form)return;try{const p=await api('/api/routing/settings'),s=p.settings||{};form.provider.value=s.provider||'manual';form.defaultTravelMinutes.value=s.default_travel_minutes??15;form.parkingBufferMinutes.value=s.parking_buffer_minutes??5;form.cacheDays.value=s.cache_days??90;form.blockConflicts.checked=s.block_conflicts!==0;setText('#routing-provider-status',p.mapboxConfigured?'Mapbox key configured':'Mapbox key not configured — manual fallback remains active');}catch(e){setText('#routing-provider-status',e.message);}}
$('#routing-settings-form')?.addEventListener('submit',async e=>{e.preventDefault();const msg=$('#routing-settings-message');try{await api('/api/routing/settings',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});msg.textContent='Travel settings saved.';msg.hidden=false;await loadRoutingSettings();}catch(ex){msg.textContent=ex.message;msg.hidden=false;}});
async function loadOrganisationModules(){const el=$('#organisation-module-list');if(!el)return;try{const p=await api('/api/security/modules');const labels={dashboard:'Dashboard',operations:'Live operations',clients:'Clients',staff:'Staff',family:'Family portal',care:'Care plans',medication:'Medication',visits:'Visits',rota:'Scheduling & rota',tasks:'Tasks',incidents:'Incidents',finance:'Finance',reports:'Reports',settings:'Settings'};el.innerHTML=(p.modules||[]).map(m=>`<label class="module-toggle ${m.enabled?'is-enabled':'is-disabled'}"><span class="module-icon">${({dashboard:'⌂',operations:'◆',clients:'●',staff:'◉',family:'◇',care:'▤',medication:'✚',visits:'◷',rota:'▦',tasks:'✓',incidents:'!',finance:'£',reports:'▥',settings:'⚙'})[m.module_key]||'•'}</span><span class="module-copy"><b>${escapeHtml(labels[m.module_key]||m.module_key)}</b><small>${m.enabled?'Visible to users with permission':'Hidden for everyone in this organisation'}</small></span><span class="switch-control"><input type="checkbox" data-module-key="${escapeHtml(m.module_key)}" ${m.enabled?'checked':''}><i></i></span></label>`).join('');el.querySelectorAll('[data-module-key]').forEach(x=>x.addEventListener('change',()=>x.closest('.module-toggle')?.classList.toggle('is-enabled',x.checked)));}catch(e){el.innerHTML=`<p class="muted">${escapeHtml(e.message)}</p>`;}}
$('#save-organisation-modules')?.addEventListener('click',async()=>{const modules={};$$('[data-module-key]').forEach(x=>modules[x.dataset.moduleKey]=x.checked);const m=$('#module-save-message');try{await api('/api/security/modules',{method:'PUT',body:JSON.stringify({modules})});m.textContent='Organisation modules updated. Users will see the change next time they sign in.';m.hidden=false;}catch(e){m.textContent=e.message;m.hidden=false;}});
$('#load-user-permissions')?.addEventListener('click',async()=>{const userId=$('#permission-user')?.value,el=$('#user-permission-editor');if(!userId){el.innerHTML='<p class="muted">Select a user first.</p>';return;}try{const p=await api(`/api/security/users/${encodeURIComponent(userId)}/permissions`),state=Object.fromEntries((p.overrides||[]).map(x=>[x.permission_key,x.effect]));el.innerHTML=`<div class="effective-access-heading"><strong>${escapeHtml(p.user.display_name)}</strong><span>Individual overrides</span></div><div class="permission-override-grid">${permissionCatalogue.map(x=>`<div class="permission-override-row"><span><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.category)} · ${escapeHtml(x.description||'')}</small></span><div class="permission-segment"><label class="permission-state"><input type="radio" name="override-${escapeHtml(x.permission_key)}" value="inherit" ${!state[x.permission_key]?'checked':''}><span>Inherit</span></label><label class="permission-state allow"><input type="radio" name="override-${escapeHtml(x.permission_key)}" value="allow" ${state[x.permission_key]==='allow'?'checked':''}><span>Allow</span></label><label class="permission-state deny"><input type="radio" name="override-${escapeHtml(x.permission_key)}" value="deny" ${state[x.permission_key]==='deny'?'checked':''}><span>Deny</span></label></div></div>`).join('')}</div><button id="save-user-permissions" class="primary-button compact" type="button">Save user access</button><p id="user-permission-message" class="form-message" hidden></p>`;$('#save-user-permissions').addEventListener('click',async()=>{const allow=[],deny=[];permissionCatalogue.forEach(x=>{const checked=el.querySelector(`input[name="override-${CSS.escape(x.permission_key)}"]:checked`);if(checked?.value==='allow')allow.push(x.permission_key);if(checked?.value==='deny')deny.push(x.permission_key);});const msg=$('#user-permission-message');try{await api(`/api/security/users/${encodeURIComponent(userId)}/permissions`,{method:'PUT',body:JSON.stringify({allow,deny})});msg.textContent='User-specific access saved.';msg.hidden=false;}catch(e){msg.textContent=e.message;msg.hidden=false;}});}catch(e){el.innerHTML=`<p class="muted">${escapeHtml(e.message)}</p>`;}});

$('#add-visit-requirement')?.addEventListener('click',()=>addVisitRequirement());


// CoreCare 1.14.0 — Planner Intelligence
let rotaTemplates={visitTemplates:[],workingPatterns:[],exceptions:[],runs:[],clients:[],staff:[]};
const templateDays=['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function templateName(x){return x.preferred_name||[x.first_name,x.last_name].filter(Boolean).join(' ')}
function templateDate(v){if(!v)return 'Open ended';try{return new Date(v).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:v.includes?.('T')?'short':undefined})}catch{return v}}
function templateOptions(rows,blank){return `${blank?`<option value="">${blank}</option>`:''}${rows.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(templateName(x))}</option>`).join('')}`}
async function loadRotaTemplates(){const target=$('#template-visit-list');if(!target)return;try{rotaTemplates=await api('/api/rota/templates');populateTemplateSelects();renderRotaTemplates()}catch(e){target.innerHTML=`<p class="form-error">${escapeHtml(e.message)}</p>`}}
function populateTemplateSelects(){const clients=templateOptions(rotaTemplates.clients||[],'Select client'),staff=templateOptions(rotaTemplates.staff||[],'Any suitable carer');['template-visit-client','template-exception-client'].forEach(id=>{const e=$('#'+id);if(e)e.innerHTML=clients});['template-preferred-staff','template-backup-staff','template-pattern-staff','template-exception-staff','template-replacement-staff'].forEach(id=>{const e=$('#'+id);if(e)e.innerHTML=staff})}
function renderRotaTemplates(){
 const visits=$('#template-visit-list'),patterns=$('#template-pattern-list'),exceptions=$('#template-exception-list'),runs=$('#template-run-list');
 if(visits)visits.innerHTML=(rotaTemplates.visitTemplates||[]).map(x=>`<article class="template-card" data-template-edit="visit" data-id="${x.id}" tabindex="0" title="Double-click to edit"><div><span class="badge active">${templateDays[x.day_of_week]} ${escapeHtml(x.preferred_time)}</span><h3>${escapeHtml(x.client_name||'Client')}</h3><p>${escapeHtml(x.visit_type)} · ${x.duration_minutes} minutes</p><small>Preferred: ${escapeHtml(x.preferred_staff_name||'Any suitable carer')}${x.backup_staff_name?` · Backup: ${escapeHtml(x.backup_staff_name)}`:''}</small></div><button class="icon-button" data-template-delete="visit" data-id="${x.id}" title="Delete">×</button></article>`).join('')||'<div class="empty-state"><strong>No recurring visits yet</strong><span>Add the client’s regular weekly calls.</span></div>';
 if(patterns)patterns.innerHTML=(rotaTemplates.workingPatterns||[]).map(x=>`<article class="template-card" data-template-edit="pattern" data-id="${x.id}" tabindex="0" title="Double-click to edit"><div><span class="badge neutral">Week ${x.week_number} of ${x.cycle_weeks}</span><h3>${escapeHtml(x.staff_name||'Carer')}</h3><p>${templateDays[x.day_of_week]} · ${escapeHtml(x.start_time)}–${escapeHtml(x.end_time)}</p><small>${escapeHtml(x.name)}</small></div><button class="icon-button" data-template-delete="working-pattern" data-id="${x.id}">×</button></article>`).join('')||'<div class="empty-state"><strong>No working patterns yet</strong><span>Add normal hours for each carer.</span></div>';
 if(exceptions)exceptions.innerHTML=(rotaTemplates.exceptions||[]).map(x=>`<article class="template-card" data-template-edit="exception" data-id="${x.id}" tabindex="0" title="Double-click to edit"><div><span class="badge warning">${escapeHtml(x.exception_type)}</span><h3>${escapeHtml(x.staff_name||x.client_name||'Organisation-wide exception')}</h3><p>${templateDate(x.start_at)}${x.end_at?` – ${templateDate(x.end_at)}`:''}</p><small>${escapeHtml(x.reason||x.action)}</small></div><button class="icon-button" data-template-delete="exception" data-id="${x.id}">×</button></article>`).join('')||'<div class="empty-state"><strong>No current exceptions</strong><span>Holidays and one-off changes appear here.</span></div>';
 if(runs)runs.innerHTML=(rotaTemplates.runs||[]).map(x=>`<article class="template-card generation-card"><div><span class="badge success">${escapeHtml(x.week_commencing)}</span><h3>${x.visits_created} visits generated</h3><p>${x.visits_unallocated} unallocated · ${x.visits_skipped} skipped</p><small>${templateDate(x.generated_at)}</small></div></article>`).join('')||'<div class="empty-state"><strong>No generated weeks yet</strong><span>Use Generate week when templates are ready.</span></div>';
}
function openTemplateDialog(id){const d=$('#'+id);d?.querySelector('form')?.reset();d?.showModal()}
document.querySelectorAll('[data-template-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-template-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.template-panel').forEach(x=>x.classList.toggle('active',x.id===`template-${b.dataset.templateTab}`))}));
$('#template-refresh')?.addEventListener('click',loadRotaTemplates);$('#template-add-visit')?.addEventListener('click',()=>openTemplateDialog('template-visit-dialog'));$('#template-add-pattern')?.addEventListener('click',()=>openTemplateDialog('template-pattern-dialog'));$('#template-add-exception')?.addEventListener('click',()=>openTemplateDialog('template-exception-dialog'));$('#template-generate-open')?.addEventListener('click',()=>{openTemplateDialog('template-generate-dialog');const w=$('#rota-week')?.value;if(w)$('#template-generate-form').elements.weekCommencing.value=w});
async function submitTemplateForm(e,path){e.preventDefault();const f=e.currentTarget,err=f.querySelector('.form-error');try{await api(path,{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(f)))});f.closest('dialog').close();await loadRotaTemplates()}catch(ex){err.textContent=ex.message;err.hidden=false}}
$('#template-visit-form')?.addEventListener('submit',e=>submitTemplateForm(e,'/api/rota/templates/visit'));$('#template-pattern-form')?.addEventListener('submit',e=>submitTemplateForm(e,'/api/rota/templates/working-pattern'));$('#template-exception-form')?.addEventListener('submit',e=>submitTemplateForm(e,'/api/rota/templates/exception'));
$('#template-generate-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,err=f.querySelector('.form-error'),result=$('#template-generate-result');try{const r=await api('/api/rota/templates/generate',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(f)))});result.hidden=false;result.innerHTML=`<strong>${r.created} visits created</strong><span>${r.unallocated} left in the allocation queue · ${r.skipped} skipped</span>${r.warnings?.length?`<small>${r.warnings.slice(0,5).map(escapeHtml).join('<br>')}</small>`:''}`;await Promise.all([loadRotaTemplates(),loadRotaBoard()])}catch(ex){err.textContent=ex.message;err.hidden=false}});
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-template-delete]');if(!b)return;if(!confirm('Delete this template item?'))return;try{await api(`/api/rota/templates/${b.dataset.templateDelete}/${b.dataset.id}`,{method:'DELETE'});await loadRotaTemplates()}catch(ex){alert(ex.message)}});
const originalLoadRotaBoard=loadRotaBoard;loadRotaBoard=async function(){const r=await originalLoadRotaBoard.apply(this,arguments);if($('#template-visit-list')&&!rotaTemplates.clients.length)await loadRotaTemplates();return r};

$('#care-delivery-refresh')?.addEventListener('click',()=>Promise.all([loadAllCarePlans(),loadCareDeliveryDashboard()]).catch(showToastError));


// CoreCare 1.15.7 — rota runtime repair.
// Uses delegated capture-phase events so controls remain active after any rota re-render.
(function initialiseRotaInteractionController(){
  if (window.__corecareRotaControllerInitialised) return;
  window.__corecareRotaControllerInitialised = true;

  function activateTemplateTab(name){
    document.querySelectorAll('[data-template-tab]').forEach(button=>button.classList.toggle('active',button.dataset.templateTab===name));
    document.querySelectorAll('.template-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`template-${name}`));
  }
  function openNamedDialog(id){
    const dialog=document.getElementById(id);
    if(!dialog) return;
    const form=dialog.querySelector('form');
    form?.reset();
    form?.querySelector('.form-error')?.setAttribute('hidden','');
    if(!dialog.open) dialog.showModal();
  }
  function fillForm(form,row,map){
    Object.entries(map).forEach(([field,key])=>{const element=form?.elements?.[field];if(element) element.value=row?.[key]??'';});
  }
  function editTemplate(kind,id){
    let row,dialog,form;
    if(kind==='visit'){
      row=(rotaTemplates.visitTemplates||[]).find(x=>String(x.id)===String(id)); dialog=$('#template-visit-dialog'); form=$('#template-visit-form');
      if(!row||!dialog||!form)return;
      form.reset(); fillForm(form,row,{id:'id',clientId:'client_id',name:'name',dayOfWeek:'day_of_week',preferredTime:'preferred_time',durationMinutes:'duration_minutes',windowMinutes:'window_minutes',visitType:'visit_type',carersRequired:'carers_required',preferredStaffId:'preferred_staff_id',backupStaffId:'backup_staff_id',effectiveFrom:'effective_from',effectiveTo:'effective_to',notes:'notes'});
    }else if(kind==='pattern'){
      row=(rotaTemplates.workingPatterns||[]).find(x=>String(x.id)===String(id)); dialog=$('#template-pattern-dialog'); form=$('#template-pattern-form');
      if(!row||!dialog||!form)return;
      form.reset(); fillForm(form,row,{id:'id',staffId:'staff_id',name:'name',cycleWeeks:'cycle_weeks',weekNumber:'week_number',dayOfWeek:'day_of_week',startTime:'start_time',endTime:'end_time'});
    }else{
      row=(rotaTemplates.exceptions||[]).find(x=>String(x.id)===String(id)); dialog=$('#template-exception-dialog'); form=$('#template-exception-form');
      if(!row||!dialog||!form)return;
      form.reset(); fillForm(form,row,{id:'id',exceptionType:'exception_type',action:'action',staffId:'staff_id',clientId:'client_id',startAt:'start_at',endAt:'end_at',replacementStaffId:'replacement_staff_id',reason:'reason'});
    }
    form.querySelector('.form-error')?.setAttribute('hidden','');
    if(!dialog.open)dialog.showModal();
  }

  document.addEventListener('click',async event=>{
    const tab=event.target.closest?.('[data-template-tab]');
    if(tab){event.preventDefault();activateTemplateTab(tab.dataset.templateTab);return;}
    const target=event.target.closest?.('button, [role="button"]');
    if(!target)return;
    try{
      switch(target.id){
        case 'template-refresh': event.preventDefault(); await loadRotaTemplates(); break;
        case 'template-add-visit': event.preventDefault(); openNamedDialog('template-visit-dialog'); break;
        case 'template-add-pattern': event.preventDefault(); openNamedDialog('template-pattern-dialog'); break;
        case 'template-add-exception': event.preventDefault(); openNamedDialog('template-exception-dialog'); break;
        case 'template-generate-open':
          event.preventDefault(); openNamedDialog('template-generate-dialog');
          if($('#rota-week')?.value) $('#template-generate-form').elements.weekCommencing.value=$('#rota-week').value;
          break;
        case 'rota-optimise': event.preventDefault(); openRotaOptimiser(); break;
        case 'rota-refresh': event.preventDefault(); await loadRotaBoard(); break;
        case 'rota-new': event.preventDefault(); if(!rotaData.clients?.length)await loadRotaBoard(); $('#rota-form')?.reset(); $('#rota-dialog')?.showModal(); break;
      }
    }catch(error){console.error('Rota interaction failed',target.id,error); showToastError?.(error);}
  },true);

  document.addEventListener('dblclick',event=>{
    const visit=event.target.closest?.('[data-rota-open]');
    if(visit){event.preventDefault();event.stopPropagation();openRotaEdit(visit.dataset.rotaOpen);return;}
    const template=event.target.closest?.('[data-template-edit]');
    if(template&&!event.target.closest('[data-template-delete]')){event.preventDefault();editTemplate(template.dataset.templateEdit,template.dataset.id);}
  },true);

  document.addEventListener('keydown',event=>{
    const template=event.target.closest?.('[data-template-edit]');
    if(template&&(event.key==='Enter'||event.key===' ')){event.preventDefault();editTemplate(template.dataset.templateEdit,template.dataset.id);}
  });
})();


// CoreCare 1.16.4 — Compact Visit Card Correction.
(function initialisePlannerProfessional(){
 if(window.__corecarePlannerProfessional)return;window.__corecarePlannerProfessional=true;
 const savedKey='corecare_planner_saved_view';
 function ensureToolbar(){const filters=$('.rota-filters');if(!filters||$('#planner-save-view'))return;filters.insertAdjacentHTML('beforeend',`<div class="planner-saved-view"><button id="planner-save-view" type="button" class="secondary-button compact">Save view</button><button id="planner-load-view" type="button" class="secondary-button compact">Load view</button><button id="planner-route-view" type="button" class="secondary-button compact">Route view</button></div>`);}
 function saveView(){localStorage.setItem(savedKey,JSON.stringify({week:$('#rota-week')?.value,day:$('#rota-day')?.value,status:$('#rota-status-filter')?.value,staff:$('#rota-staff-filter')?.value,view:document.querySelector('[data-rota-view].active')?.dataset.rotaView||'board',snap:$('#rota-snap')?.value}));showSuccessToast?.('Planner view saved.');}
 async function loadView(){const v=JSON.parse(localStorage.getItem(savedKey)||'null');if(!v)return showErrorToast?.('No saved planner view yet.');if($('#rota-week'))$('#rota-week').value=v.week||$('#rota-week').value;await loadRotaBoard();[['#rota-day','day'],['#rota-status-filter','status'],['#rota-staff-filter','staff'],['#rota-snap','snap']].forEach(([sel,key])=>{if($(sel)&&v[key]!=null)$(sel).value=v[key]});if(v.view)setRotaView(v.view);renderRotaVisualBoard();renderRotaIntelligence();}
 function routeView(){const staffId=$('#rota-staff-filter')?.value;const rows=rotaDayRows().filter(v=>v.staff_id&&(staffId==='all'||!staffId||v.staff_id===staffId)).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));if(!rows.length)return showErrorToast?.('Choose a care worker with allocated visits first.');const grouped={};rows.forEach(v=>(grouped[v.staff_id]??=[]).push(v));const html=Object.entries(grouped).map(([id,list])=>`<section class="route-overview-group"><h3>${escapeHtml(staffNameById(id))}</h3>${list.map((v,i)=>`<div class="route-overview-step"><span>${i+1}</span><div><strong>${new Date(v.scheduled_start).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${escapeHtml(v.client_name||'Client')}</strong><small>${rotaVisitDuration(v)}m care${v.travel_before_minutes?` · ${Number(v.travel_before_minutes)}m / ${Number(v.travel_before_miles||0).toFixed(1)}mi travel before`:''}</small></div></div>`).join('')}</section>`).join('');let d=$('#planner-route-dialog');if(!d){document.body.insertAdjacentHTML('beforeend','<dialog id="planner-route-dialog" class="large-dialog"><div class="dialog-heading"><div><p class="eyebrow">Route visualisation</p><h2>Selected day routes</h2></div><button type="button" class="icon-button" data-close-dialog>×</button></div><div id="planner-route-content" class="route-overview"></div></dialog>');d=$('#planner-route-dialog');}$('#planner-route-content').innerHTML=html;d.showModal();}
 document.addEventListener('click',e=>{const warning=e.target.closest?.('[data-health-visit],[data-health-staff]');if(warning){focusRotaIssue(warning.dataset.healthVisit,warning.dataset.healthStaff);return;}if(e.target.closest?.('#planner-save-view'))saveView();if(e.target.closest?.('#planner-load-view'))loadView();if(e.target.closest?.('#planner-route-view'))routeView();});
 const observer=new MutationObserver(()=>ensureToolbar());observer.observe(document.body,{childList:true,subtree:true});ensureToolbar();
})();


// CoreCare 1.18.0 — Intelligent Planner
if(!window.__corecareEditorSuitabilityEvents){window.__corecareEditorSuitabilityEvents=true;document.addEventListener('click',async e=>{const button=e.target.closest?.('[data-editor-reallocate]');if(!button)return;e.preventDefault();const visit=(rotaData.visits||[]).find(v=>String(v.id)===String(button.dataset.visitId));const staff=(rotaData.staff||[]).find(st=>String(st.id)===String(button.dataset.editorReallocate));if(!visit||!staff)return;const staffName=`${staff.preferred_name||staff.first_name} ${staff.last_name}`.trim();if(!confirm(`Reallocate ${visit.client_name||'this visit'} to ${staffName}?\n\nThe visit time and scheduling rules will not change.`))return;button.disabled=true;button.textContent='Reallocating…';try{await moveRotaVisit(visit.id,staff.id,new Date(visit.scheduled_start),rotaVisitDuration(visit));const updated=(rotaData.visits||[]).find(v=>String(v.id)===String(visit.id));if(updated){const select=$('#rota-edit-staff');if(select)select.value=updated.staff_id||staff.id;renderVisitEditorSuitability(updated);renderVisitEditorContext(updated);}}catch(error){showToastError?.(error);alert(error.message);}finally{button.disabled=false;button.textContent='Reallocate';}});}
if(!window.__corecareSuitabilityEvents){window.__corecareSuitabilityEvents=true;document.addEventListener('click',e=>{const chip=e.target.closest('[data-suitability]');if(chip){e.preventDefault();e.stopPropagation();openSuitabilityDialog(chip.dataset.suitability);}});}


if(!window.__corecarePlannerCommandEvents){window.__corecarePlannerCommandEvents=true;
 document.addEventListener('click',e=>{const q=e.target.closest?.('[data-planner-question]');if(q){e.preventDefault();runPlannerAssistant(q.dataset.plannerQuestion);}const target=e.target.closest?.('#planner-command-refresh');if(target){e.preventDefault();renderRotaIntelligence();renderPlannerCommandCentre();}if(e.target.closest?.('#planner-assistant-run')){e.preventDefault();runPlannerAssistant($('#planner-assistant-query')?.value);}if(e.target.closest?.('#planner-open-optimiser')){e.preventDefault();openRotaOptimiser();}if(e.target.closest?.('#planner-open-route')){e.preventDefault();const btn=document.querySelector('[data-rota-view="board"]');btn?.click();document.querySelector('#rota-scheduler')?.scrollIntoView({behavior:'smooth',block:'start'});}});
 $('#planner-assistant-query')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runPlannerAssistant(e.currentTarget.value);}});
}

// CoreCare 1.18.0 — Planner Command Centre

async function openVisitCareRecord(visitId){
 const data=await api(`/api/visits/${encodeURIComponent(visitId)}/care-record`),f=$('#visit-record-form'),v=data.visit,r=data.record||{};f.reset();f.visitId.value=visitId;$('#visit-record-title').textContent=r.id?'View or update care record':'Record visit care';$('#visit-record-meta').textContent=`${v.client_name||'Client'} · ${opFmt(v.scheduled_start)} · ${v.staff_name||'Unallocated'}`;
 for(const [name,value] of Object.entries({mood:r.mood,wellbeing:r.wellbeing,careNotes:r.care_notes,fluidIntakeMl:r.fluid_intake_ml,nutrition:r.nutrition,toileting:r.toileting,mobilitySupport:r.mobility_support,skinObservation:r.skin_observation,bodyMapNotes:r.body_map_notes,followUpNotes:r.follow_up_notes})){if(f.elements[name]&&value!==undefined&&value!==null)f.elements[name].value=value;}
 f.followUpRequired.checked=Boolean(r.follow_up_required);const done=new Set((data.tasks||[]).filter(x=>x.status==='completed').map(x=>x.task_key));f.querySelectorAll('input[name="task"]').forEach(x=>x.checked=done.has(x.value));const med=(data.medication||[])[0];if(med){f.medicationOutcome.value=med.outcome;f.medicationName.value=med.medication_name;f.medicationReason.value=med.reason;}
 $('#visit-record-error').hidden=true;$('#visit-record-dialog')?.showModal();
}
$('#visit-record-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,err=$('#visit-record-error');err.hidden=true;const fd=new FormData(f),tasks=[...f.querySelectorAll('input[name="task"]:checked')].map(x=>({key:x.value,label:x.dataset.label,status:'completed'}));const medication=[{name:fd.get('medicationName'),outcome:fd.get('medicationOutcome'),reason:fd.get('medicationReason')}];const payload=Object.fromEntries(fd);payload.tasks=tasks;payload.medication=medication;payload.followUpRequired=f.followUpRequired.checked;payload.incidentRequired=f.incidentRequired.checked;payload.completeVisit=true;try{await api(`/api/visits/${encodeURIComponent(fd.get('visitId'))}/care-record`,{method:'POST',body:JSON.stringify(payload)});$('#visit-record-dialog')?.close();if(['carer','senior_carer'].includes(currentUser?.accessLevel))await loadCarerDashboard();else await loadVisitsBoardNoSync();}catch(ex){err.textContent=ex.message;err.hidden=false;}});

$('#carer-refresh')?.addEventListener('click',()=>loadCarerDashboard().catch(showToastError));$('#carer-open-clock')?.addEventListener('click',()=>$('#visit-clock-dialog')?.showModal());


const CORECARE_MEDICINE_CATALOGUE = [
  {name:'Paracetamol',forms:['Tablet','Capsule','Oral suspension','Soluble tablet'],strengths:['500 mg','120 mg/5 ml','250 mg/5 ml'],route:'Oral'},
  {name:'Ibuprofen',forms:['Tablet','Capsule','Oral suspension','Gel'],strengths:['200 mg','400 mg','100 mg/5 ml','5%'],route:'Oral'},
  {name:'Aspirin',forms:['Dispersible tablet','Gastro-resistant tablet'],strengths:['75 mg','300 mg'],route:'Oral'},
  {name:'Amoxicillin',forms:['Capsule','Oral suspension'],strengths:['250 mg','500 mg','125 mg/5 ml','250 mg/5 ml'],route:'Oral'},
  {name:'Atorvastatin',forms:['Tablet'],strengths:['10 mg','20 mg','40 mg','80 mg'],route:'Oral'},
  {name:'Amlodipine',forms:['Tablet'],strengths:['5 mg','10 mg'],route:'Oral'},
  {name:'Bisoprolol',forms:['Tablet'],strengths:['1.25 mg','2.5 mg','5 mg','10 mg'],route:'Oral'},
  {name:'Ramipril',forms:['Capsule','Tablet'],strengths:['1.25 mg','2.5 mg','5 mg','10 mg'],route:'Oral'},
  {name:'Lisinopril',forms:['Tablet'],strengths:['2.5 mg','5 mg','10 mg','20 mg'],route:'Oral'},
  {name:'Losartan',forms:['Tablet'],strengths:['25 mg','50 mg','100 mg'],route:'Oral'},
  {name:'Furosemide',forms:['Tablet','Oral solution'],strengths:['20 mg','40 mg','50 mg/5 ml'],route:'Oral'},
  {name:'Omeprazole',forms:['Gastro-resistant capsule','Dispersible tablet'],strengths:['10 mg','20 mg','40 mg'],route:'Oral'},
  {name:'Lansoprazole',forms:['Gastro-resistant capsule','Orodispersible tablet'],strengths:['15 mg','30 mg'],route:'Oral'},
  {name:'Metformin',forms:['Tablet','Modified-release tablet','Oral solution'],strengths:['500 mg','850 mg','1 g'],route:'Oral'},
  {name:'Gliclazide',forms:['Tablet','Modified-release tablet'],strengths:['40 mg','80 mg','30 mg','60 mg'],route:'Oral'},
  {name:'Levothyroxine',forms:['Tablet','Oral solution'],strengths:['25 micrograms','50 micrograms','75 micrograms','100 micrograms'],route:'Oral'},
  {name:'Sertraline',forms:['Tablet'],strengths:['50 mg','100 mg'],route:'Oral'},
  {name:'Citalopram',forms:['Tablet','Oral drops'],strengths:['10 mg','20 mg','40 mg'],route:'Oral'},
  {name:'Mirtazapine',forms:['Tablet','Orodispersible tablet'],strengths:['15 mg','30 mg','45 mg'],route:'Oral'},
  {name:'Gabapentin',forms:['Capsule','Tablet','Oral solution'],strengths:['100 mg','300 mg','400 mg','600 mg'],route:'Oral'},
  {name:'Pregabalin',forms:['Capsule','Oral solution'],strengths:['25 mg','50 mg','75 mg','100 mg','150 mg','300 mg'],route:'Oral'},
  {name:'Codeine phosphate',forms:['Tablet','Oral solution'],strengths:['15 mg','30 mg','25 mg/5 ml'],route:'Oral'},
  {name:'Morphine sulfate',forms:['Oral solution','Modified-release tablet','Immediate-release tablet'],strengths:['10 mg/5 ml','20 mg/ml','5 mg','10 mg','30 mg'],route:'Oral'},
  {name:'Co-codamol',forms:['Tablet','Effervescent tablet'],strengths:['8 mg/500 mg','15 mg/500 mg','30 mg/500 mg'],route:'Oral'},
  {name:'Senna',forms:['Tablet','Syrup'],strengths:['7.5 mg','7.5 mg/5 ml'],route:'Oral'},
  {name:'Lactulose',forms:['Oral solution'],strengths:['3.1–3.7 g/5 ml'],route:'Oral'},
  {name:'Macrogol 3350 with electrolytes',forms:['Powder for oral solution'],strengths:['13.8 g sachet'],route:'Oral'},
  {name:'Salbutamol',forms:['Inhaler','Nebuliser solution'],strengths:['100 micrograms/dose','2.5 mg/2.5 ml','5 mg/2.5 ml'],route:'Inhaled'},
  {name:'Beclometasone dipropionate',forms:['Inhaler'],strengths:['50 micrograms/dose','100 micrograms/dose','200 micrograms/dose'],route:'Inhaled'},
  {name:'Tiotropium',forms:['Inhalation capsule','Inhaler'],strengths:['18 micrograms','2.5 micrograms/dose'],route:'Inhaled'},
  {name:'Apixaban',forms:['Tablet'],strengths:['2.5 mg','5 mg'],route:'Oral'},
  {name:'Rivaroxaban',forms:['Tablet'],strengths:['2.5 mg','10 mg','15 mg','20 mg'],route:'Oral'},
  {name:'Warfarin',forms:['Tablet'],strengths:['0.5 mg','1 mg','3 mg','5 mg'],route:'Oral'},
  {name:'Clopidogrel',forms:['Tablet'],strengths:['75 mg'],route:'Oral'},
  {name:'Donepezil',forms:['Tablet','Orodispersible tablet'],strengths:['5 mg','10 mg'],route:'Oral'},
  {name:'Memantine',forms:['Tablet','Oral solution'],strengths:['5 mg','10 mg','15 mg','20 mg'],route:'Oral'},
  {name:'Carbamazepine',forms:['Tablet','Modified-release tablet','Oral suspension'],strengths:['100 mg','200 mg','400 mg','100 mg/5 ml'],route:'Oral'},
  {name:'Sodium valproate',forms:['Tablet','Modified-release tablet','Oral solution'],strengths:['100 mg','200 mg','300 mg','500 mg'],route:'Oral'},
  {name:'Insulin glargine',forms:['Solution for injection'],strengths:['100 units/ml','300 units/ml'],route:'Subcutaneous'},
  {name:'Insulin aspart',forms:['Solution for injection'],strengths:['100 units/ml'],route:'Subcutaneous'},
  {name:'Hydrocortisone',forms:['Cream','Ointment','Tablet'],strengths:['1%','10 mg','20 mg'],route:'Topical'},
  {name:'Clotrimazole',forms:['Cream','Solution'],strengths:['1%'],route:'Topical'},
  {name:'Chloramphenicol',forms:['Eye drops','Eye ointment'],strengths:['0.5%','1%'],route:'Ocular'}
];
const MEDICATION_ALIASES = {
  'Paracetamol':['acetaminophen','panadol','calpol','paracetomol','paracetamol'],
  'Ibuprofen':['nurofen','brufen'],
  'Co-codamol':['cocodamol','co codamol'],
  'Salbutamol':['ventolin'],
  'Omeprazole':['losec'],
  'Lansoprazole':['zoton'],
  'Furosemide':['frusemide'],
  'Morphine sulfate':['oramorph','mst continus'],
  'Macrogol 3350 with electrolytes':['movicol','laxido'],
  'Insulin glargine':['lantus','toujeo'],
  'Insulin aspart':['novorapid']
};
function normaliseMedicineSearch(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function medicineEditDistance(a,b){a=normaliseMedicineSearch(a);b=normaliseMedicineSearch(b);const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length];}
function medicineSearchTerms(m){return [m.name,...(MEDICATION_ALIASES[m.name]||[])];}
function searchMedicationCatalogue(query){const q=normaliseMedicineSearch(query);if(q.length<2)return[];return CORECARE_MEDICINE_CATALOGUE.map(m=>{const terms=medicineSearchTerms(m).map(normaliseMedicineSearch);let score=999;for(const term of terms){if(term===q)score=Math.min(score,0);else if(term.startsWith(q))score=Math.min(score,1);else if(term.includes(q))score=Math.min(score,2);else if(q.length>=4){const d=medicineEditDistance(q,term.slice(0,Math.max(q.length,Math.min(term.length,q.length+2))));if(d<=2)score=Math.min(score,3+d/10);}}return{m,score};}).filter(x=>x.score<999).sort((a,b)=>a.score-b.score||a.m.name.localeCompare(b.m.name)).slice(0,8).map(x=>x.m);}
function initialiseMedicationCatalogue(){renderMedicationSearchResults('');}
function applyMedicationCatalogueSelection(form,match){if(!form||!match)return;form.elements.name.value=match.name;if(!form.elements.form.value)form.elements.form.value=match.forms[0]||'';if(!form.elements.route.value)form.elements.route.value=match.route||'';if(!form.elements.strength.value&&match.strengths.length===1)form.elements.strength.value=match.strengths[0];form.elements.strength.placeholder=match.strengths.length?'Common strengths: '+match.strengths.join(', '):'e.g. 500 mg';renderMedicationSearchResults('');form.elements.name.setAttribute('aria-expanded','false');}
function applyMedicationCatalogueMatch(form){const value=normaliseMedicineSearch(form?.elements?.name?.value);if(!value)return;const match=CORECARE_MEDICINE_CATALOGUE.find(m=>medicineSearchTerms(m).some(t=>normaliseMedicineSearch(t)===value));if(match)applyMedicationCatalogueSelection(form,match);}
function renderMedicationSearchResults(query){const box=$('#medication-search-results'),input=$('#medication-form')?.elements?.name;if(!box||!input)return;const results=searchMedicationCatalogue(query);if(normaliseMedicineSearch(query).length<2){box.hidden=true;box.innerHTML='';input.setAttribute('aria-expanded','false');return;}box.innerHTML=results.length?results.map((m,i)=>`<button type="button" role="option" data-medication-result="${escapeHtml(m.name)}" class="medication-search-option"><strong>${escapeHtml(m.name)}</strong><small>${escapeHtml(m.forms.slice(0,3).join(' · '))}${m.strengths.length?' · '+escapeHtml(m.strengths.slice(0,3).join(', ')):''}</small></button>`).join(''):'<div class="medication-search-empty">No catalogue match. You can still enter the prescribed medicine manually.</div>';box.hidden=false;input.setAttribute('aria-expanded','true');}


let medicationData={medications:[],administrations:[]};
let bodyMapData={records:[]};
function populateMedicationClients(){const el=$('#medication-client');if(!el)return;const chosen=el.value;el.innerHTML='<option value="">Choose a client</option>'+clients.filter(x=>x.status!=='Archived').map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(clientDisplayName(x)||'Unnamed client')}</option>`).join('');if(chosen)el.value=chosen;}
async function loadMedicationModule(){if(!clients.length)await loadClients();populateMedicationClients();const id=$('#medication-client')?.value;if(id)await loadMedicationForClient(id);else renderMedication();}
async function loadMedicationForClient(clientId){medicationData=await api('/api/medication?clientId='+encodeURIComponent(clientId));renderMedication();}
function renderMedication(){const list=$('#medication-list'),mar=$('#mar-list'),summary=$('#medication-summary');if(!list)return;const meds=medicationData.medications||[],entries=medicationData.administrations||[];if(summary)summary.innerHTML=[['Active medicines',meds.filter(x=>x.status==='active').length],['PRN medicines',meds.filter(x=>x.is_prn).length],['MAR entries',entries.length],['Low stock',meds.filter(x=>x.stock_quantity!==null&&Number(x.stock_quantity)<=5).length]].map(x=>`<article><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join('');list.innerHTML=meds.length?meds.map(m=>`<article class="record-card medication-card"><div class="record-card-heading"><div><span class="badge ${m.status==='active'?'active':'neutral'}">${escapeHtml(m.status)}</span><h3>${escapeHtml(m.name)} ${escapeHtml(m.strength||'')}</h3></div><span class="badge ${m.is_prn?'warning':'neutral'}">${m.is_prn?'PRN':'Regular'}</span></div><p><strong>${escapeHtml(m.dose)}</strong> · ${escapeHtml(m.route||'Route not recorded')}</p><p class="muted">${escapeHtml((m.scheduledTimes||[]).join(', ')||m.frequency||'No schedule recorded')}</p><p>${escapeHtml(m.instructions||'')}</p><p><b>Stock:</b> ${m.stock_quantity===null?'Not tracked':escapeHtml(String(m.stock_quantity))+' '+escapeHtml(m.stock_unit||'')}</p>${m.is_prn&&m.prn_protocol?`<div class="notice-banner small-notice"><div><strong>PRN protocol</strong><span>${escapeHtml(m.prn_protocol)}</span></div></div>`:''}<div class="record-actions"><button class="primary-button compact" data-administer-medication="${escapeHtml(m.id)}">Record administration</button><button class="secondary-button compact" data-edit-medication="${escapeHtml(m.id)}">Edit</button></div></article>`).join(''):'<p class="muted">No medications recorded for this client.</p>';mar.innerHTML=entries.length?entries.map(e=>`<div class="mar-entry"><div><strong>${escapeHtml(e.medication_name)}</strong><small>${new Date(e.administered_at).toLocaleString('en-GB')}</small></div><div><span class="mar-outcome">${escapeHtml(e.outcome)}</span><small>${escapeHtml(e.reason||e.notes||'No additional notes')}</small></div><div><small>${escapeHtml(e.recorded_by_name||'Recorded user')}</small></div></div>`).join(''):'<p class="muted">No MAR entries recorded.</p>';$$('[data-administer-medication]').forEach(b=>b.onclick=()=>openAdministration(b.dataset.administerMedication));$$('[data-edit-medication]').forEach(b=>b.onclick=()=>openMedicationDialog(meds.find(x=>x.id===b.dataset.editMedication)));}
function openMedicationDialog(m=null){const clientId=$('#medication-client')?.value;if(!clientId)return showToastError(new Error('Choose a client first.'));const f=$('#medication-form');f.reset();const error=$('#medication-error');if(error){error.hidden=true;error.textContent='';}initialiseMedicationCatalogue();f.elements.id.value=m?.id||'';for(const k of ['name','strength','form','route','dose','frequency','startDate','endDate','stockQuantity','stockUnit','status','instructions','prnProtocol','minIntervalMinutes','maxDose24h'])if(f.elements[k]&&m)f.elements[k].value=m[k.replace(/[A-Z]/g,x=>'_'+x.toLowerCase())]??m[k]??'';f.elements.scheduledTimes.value=(m?.scheduledTimes||[]).join(', ');f.elements.isPrn.checked=!!m?.is_prn;$('#medication-dialog').showModal();setTimeout(()=>f.elements.name?.focus(),50);}
function openAdministration(id){const m=(medicationData.medications||[]).find(x=>x.id===id),f=$('#administration-form');f.reset();f.elements.medicationId.value=id;f.elements.doseGiven.value=m?.dose||'';f.elements.administeredAt.value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);$('#administration-title').textContent='Record '+(m?.name||'medication');$('#administration-dialog').showModal();}
async function loadBodyMap(){if(!selectedClientId)return;bodyMapData=await api('/api/body-map?clientId='+encodeURIComponent(selectedClientId));renderBodyMap();}
function renderBodyMap(){const list=$('#body-map-list'),canvas=$('#body-map-canvas');if(!list||!canvas)return;canvas.querySelectorAll('.body-marker').forEach(x=>x.remove());const current=canvas.dataset.view||'front',records=bodyMapData.records||[];records.filter(x=>x.view===current).forEach((r,i)=>{const b=document.createElement('button');b.className='body-marker';b.style.left=r.x_percent+'%';b.style.top=r.y_percent+'%';b.title=r.concern_type+': '+r.body_location;b.textContent=String(i+1);b.onclick=e=>{e.stopPropagation();openBodyMapUpdate(r.id)};canvas.appendChild(b)});list.innerHTML=records.length?records.map(r=>`<article class="record-card body-map-record" data-severity="${escapeHtml(r.severity)}"><div class="record-card-heading"><div><span class="badge ${r.status==='resolved'?'active':r.severity==='high'||r.severity==='critical'?'danger':'warning'}">${escapeHtml(r.status)}</span><h3>${escapeHtml(r.concern_type)} · ${escapeHtml(r.body_location||r.view)}</h3></div><span>${new Date(r.first_observed_at).toLocaleDateString('en-GB')}</span></div><p>${escapeHtml(r.description)}</p><p class="muted">${escapeHtml(r.size||'Size not recorded')} · ${escapeHtml(r.appearance||'Appearance not recorded')}</p><p><b>Action:</b> ${escapeHtml(r.action_taken||'None recorded')}</p><button class="secondary-button compact" data-body-update="${escapeHtml(r.id)}">Add progress update</button></article>`).join(''):'<p class="muted">No body-map concerns recorded.</p>';$$('[data-body-update]').forEach(b=>b.onclick=()=>openBodyMapUpdate(b.dataset.bodyUpdate));}
function openBodyMapAt(x=50,y=50){if(!selectedClientId)return;const f=$('#body-map-form');f.reset();f.elements.view.value=$('#body-map-canvas')?.dataset.view||'front';f.elements.xPercent.value=x;f.elements.yPercent.value=y;$('#body-map-dialog').showModal();}
function openBodyMapUpdate(id){const f=$('#body-map-update-form');f.reset();f.elements.recordId.value=id;$('#body-map-update-dialog').showModal();}



$('#medication-client')?.addEventListener('change',e=>e.target.value?loadMedicationForClient(e.target.value).catch(showToastError):(medicationData={medications:[],administrations:[]},renderMedication()));
$('#add-medication')?.addEventListener('click',()=>openMedicationDialog());
$('#medication-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,el=$('#medication-error'),submit=f.querySelector('[type=submit]');if(el){el.hidden=true;el.textContent='';}const d=Object.fromEntries(new FormData(f));d.clientId=$('#medication-client')?.value||'';d.isPrn=f.elements.isPrn.checked;d.scheduledTimes=String(d.scheduledTimes||'').split(',').map(x=>x.trim()).filter(Boolean);if(!d.clientId){if(el){el.textContent='Choose a client before saving medication.';el.hidden=false;}return;}try{if(submit){submit.disabled=true;submit.textContent='Saving…';}await api('/api/medication',{method:'POST',body:JSON.stringify(d)});$('#medication-dialog')?.close();await loadMedicationForClient(d.clientId)}catch(err){if(el){el.textContent=err.message||'Medication could not be saved.';el.hidden=false;}else showToastError(err);}finally{if(submit){submit.disabled=false;submit.textContent='Save medication';}}});
$('#administration-form')?.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{await api('/api/medication/'+encodeURIComponent(d.medicationId)+'/administer',{method:'POST',body:JSON.stringify(d)});$('#administration-dialog').close();await loadMedicationForClient($('#medication-client').value);}catch(err){const el=$('#administration-error');el.textContent=err.message;el.hidden=false;}});
$('#add-body-map')?.addEventListener('click',()=>openBodyMapAt());
$('#body-map-canvas')?.addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect();openBodyMapAt(Math.round((e.clientX-r.left)/r.width*1000)/10,Math.round((e.clientY-r.top)/r.height*1000)/10)});
$$('[data-body-view]').forEach(b=>b.addEventListener('click',()=>{$$('[data-body-view]').forEach(x=>x.classList.toggle('active',x===b));$('#body-map-canvas').dataset.view=b.dataset.bodyView;renderBodyMap()}));
$('#body-map-form')?.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));d.clientId=selectedClientId;try{await api('/api/body-map',{method:'POST',body:JSON.stringify(d)});$('#body-map-dialog').close();await loadBodyMap();}catch(err){const el=$('#body-map-error');el.textContent=err.message;el.hidden=false;}});
$('#body-map-update-form')?.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{await api('/api/body-map/'+encodeURIComponent(d.recordId)+'/update',{method:'POST',body:JSON.stringify(d)});$('#body-map-update-dialog').close();await loadBodyMap();}catch(err){const el=$('#body-map-update-error');el.textContent=err.message;el.hidden=false;}});
$$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.closeDialog)?.close()));

// v1.24.1 stability: delegated dialog controls remain reliable even after dynamic rendering.
document.addEventListener('click',event=>{const button=event.target.closest('[data-close-dialog]');if(!button)return;event.preventDefault();const dialog=document.getElementById(button.dataset.closeDialog);if(dialog?.open)dialog.close();});
// v1.24.3: delegated medication search events avoid stale or missing field bindings.
function medicationSearchInput(){return document.querySelector('#medication-form input[name="name"]');}
document.addEventListener('input',event=>{const input=event.target.closest?.('#medication-form input[name="name"]');if(!input)return;renderMedicationSearchResults(input.value);});
document.addEventListener('change',event=>{const input=event.target.closest?.('#medication-form input[name="name"]');if(!input)return;applyMedicationCatalogueMatch(input.form);});
document.addEventListener('keydown',event=>{const input=event.target.closest?.('#medication-form input[name="name"]');if(input){if(event.key==='Escape'){renderMedicationSearchResults('');return;}if(event.key==='ArrowDown'){const first=document.querySelector('#medication-search-results [data-medication-result]');if(first){event.preventDefault();first.focus();}}return;}const option=event.target.closest?.('[data-medication-result]');if(!option)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();option.click();}else if(event.key==='ArrowDown'){event.preventDefault();option.nextElementSibling?.focus();}else if(event.key==='ArrowUp'){event.preventDefault();(option.previousElementSibling||medicationSearchInput())?.focus();}});
document.addEventListener('click',event=>{const option=event.target.closest?.('[data-medication-result]');if(option){event.preventDefault();const match=CORECARE_MEDICINE_CATALOGUE.find(m=>m.name===option.dataset.medicationResult);applyMedicationCatalogueSelection(document.querySelector('#medication-form'),match);medicationSearchInput()?.focus();return;}if(!event.target.closest?.('.medication-search-wrap'))renderMedicationSearchResults('');});
initialiseMedicationCatalogue();


async function loadEcosystemControlCentre(){
  const d=await api('/api/platform/control-centre'),s=d.summary||{};
  $('#control-products').textContent=s.products||0; $('#control-healthy').textContent=s.healthy||0; $('#control-tickets').textContent=s.openTickets||0;
  $('#control-critical').textContent=s.criticalTickets||0; $('#control-sessions').textContent=s.activeSupportSessions||0; $('#control-incidents').textContent=s.openIncidents||0;
  $('#control-product-grid').innerHTML=(d.products||[]).map(p=>`<article class="product-health-card"><div class="product-card-head"><div><span class="product-code">${escapeHtml(p.code)}</span><h3>${escapeHtml(p.name)}</h3></div><span class="badge ${p.health_status==='healthy'?'success':p.health_status==='offline'?'danger':'neutral'}">${escapeHtml(p.health_status||p.status||'unknown')}</span></div><p>${escapeHtml(p.description||'')}</p><dl><div><dt>Version</dt><dd>${escapeHtml(p.current_version||'Not set')}</dd></div><div><dt>Environment</dt><dd>${escapeHtml(p.environment||'production')}</dd></div><div><dt>Response</dt><dd>${p.response_ms?`${p.response_ms} ms`:'Not connected'}</dd></div><div><dt>Errors 24h</dt><dd>${Number(p.error_count_24h||0)}</dd></div></dl><div class="product-actions"><button class="secondary-button compact" data-product-detail="${p.id}">View product</button><button class="primary-button compact" data-support-product="${p.id}">Secure access</button></div></article>`).join('')||'<p class="muted">No products registered.</p>';
  $('#control-ticket-list').innerHTML=(d.tickets||[]).slice(0,8).map(t=>`<div class="control-row"><div><strong>${escapeHtml(t.ticket_number)} · ${escapeHtml(t.subject)}</strong><small>${escapeHtml(t.product_name||'Platform')} · ${escapeHtml(t.organisation_name||'Internal')} · ${escapeHtml(t.status)}</small></div><span class="badge ${t.priority==='critical'?'danger':t.priority==='high'?'warning':'neutral'}">${escapeHtml(t.priority)}</span></div>`).join('')||'<div class="empty-state compact"><strong>No support tickets</strong><span>Tickets raised from every product will appear here.</span></div>';
  $('#control-session-list').innerHTML=(d.supportSessions||[]).slice(0,8).map(x=>`<div class="control-row"><div><strong>${escapeHtml(x.staff_name||'Platform staff')} → ${escapeHtml(x.organisation_name||'Organisation')}</strong><small>${escapeHtml(x.product_name||'Product')} · ${escapeHtml(x.access_mode)} · ${escapeHtml(x.reason)}</small></div><span class="badge ${x.status==='active'?'warning':'neutral'}">${escapeHtml(x.status)}</span></div>`).join('')||'<div class="empty-state compact"><strong>No active sessions</strong><span>Temporary audited access will appear here.</span></div>';
  $('#control-incident-list').innerHTML=(d.incidents||[]).slice(0,6).map(i=>`<div class="control-row"><div><strong>${escapeHtml(i.title)}</strong><small>${escapeHtml(i.product_name||'Platform')} · ${escapeHtml(i.status)}</small></div><span class="badge ${i.severity==='critical'?'danger':'warning'}">${escapeHtml(i.severity)}</span></div>`).join('')||'<div class="empty-state compact"><strong>No open incidents</strong><span>Platform operations are clear.</span></div>';
  $('#control-release-list').innerHTML=(d.releases||[]).slice(0,6).map(r=>`<div class="control-row"><div><strong>${escapeHtml(r.product_name)} ${escapeHtml(r.version)}</strong><small>${escapeHtml(r.environment)} · ${escapeHtml(r.status)}</small></div><span class="badge success">Deployed</span></div>`).join('')||'<div class="empty-state compact"><strong>No release records</strong><span>Future Cloudflare and GitHub releases will be recorded here.</span></div>';
  $('#control-staff-grid').innerHTML=(d.staff||[]).map(u=>`<article><div class="avatar">${escapeHtml((u.display_name||'CC').split(' ').map(x=>x[0]).join('').slice(0,2))}</div><div><strong>${escapeHtml(u.display_name)}</strong><small>${escapeHtml(u.email)} · ${escapeHtml(roleLabel(u.access_level))}</small></div><span class="badge ${u.status==='active'?'success':'neutral'}">${escapeHtml(u.status)}</span></article>`).join('')||'<p class="muted">No platform staff found.</p>';
}
$('#control-refresh')?.addEventListener('click',()=>loadEcosystemControlCentre().catch(showToastError));
$('#new-platform-ticket')?.addEventListener('click',()=>showToast('Ticket creation form foundation is installed. Customer-facing ticket capture is the next connection step.'));


// CoreCare Platform 1.2.1 simplified owners and support portal
let simplifiedPortalData=null;
let portalAuditData=null,portalAuditOffset=0,platformSettingsData=null;
let selectedPortalProductCode='CARE';
const portalOpenStatuses=new Set(['new','in_progress','waiting_customer','waiting_development']);
function portalBadge(status){const s=String(status||'unknown').toLowerCase();return s==='healthy'||s==='active'||s==='resolved'?'success':s==='critical'||s==='offline'||s==='failed'?'danger':s==='degraded'||s==='warning'||s==='investigating'?'warning':'neutral'}
async function ensureSimplifiedPortalData(force=false){if(simplifiedPortalData&&!force)return simplifiedPortalData;const [control,dashboard]=await Promise.all([api('/api/platform/control-centre'),api('/api/platform/dashboard')]);simplifiedPortalData={...control,dashboard};return simplifiedPortalData}
async function loadSimplifiedPortal(target){if(target==='platform-audit-centre')return loadPortalAudit({reset:true});if(target==='platform-settings-centre')return loadPlatformSettings();if(target==='platform-notification-centre')return loadNotifications();if(target==='revenue-centre')return loadRevenueCentre();const d=await ensureSimplifiedPortalData(true);populatePortalProductFilter(d.products||[]);if(target==='support-ticket-centre')renderPortalTickets();if(target==='support-session-centre')renderPortalSessions();if(target==='product-monitor-centre')renderProductMonitor();if(target==='platform-team-centre')return loadPortalStaff()}
function populatePortalProductFilter(products){const el=$('#ticket-product-filter');if(!el)return;const current=el.value||'all',customerProducts=(products||[]).filter(p=>p.code!=='PLATFORM');el.innerHTML='<option value="all">All CoreCare products</option>'+customerProducts.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');el.value=[...el.options].some(o=>o.value===current)?current:'all'}
function populateTicketAssigneeFilter(){const el=$('#ticket-assignee-filter');if(!el)return;const current=el.value||'all';el.innerHTML='<option value="all">All assignees</option><option value="unassigned">Unassigned</option>'+(simplifiedPortalData?.staff||[]).map(u=>`<option value="${escapeHtml(u.id)}">${escapeHtml(u.display_name)}</option>`).join('');el.value=[...el.options].some(o=>o.value===current)?current:'all'}
function renderPortalTickets(){
  const d=simplifiedPortalData||{},all=Array.isArray(d.tickets)?d.tickets:[];
  const q=($('#ticket-search')?.value||'').toLowerCase();
  const product=$('#ticket-product-filter')?.value||'all';
  const status=$('#ticket-status-filter')?.value||'all';
  const priority=$('#ticket-priority-filter')?.value||'all';
  const assignee=$('#ticket-assignee-filter')?.value||'all';
  populateTicketAssigneeFilter();
  const open=all.filter(t=>portalOpenStatuses.has(t.status));
  setText('#ticket-kpi-open',open.length);
  setText('#ticket-kpi-critical',open.filter(t=>t.priority==='critical').length);
  setText('#ticket-kpi-unassigned',open.filter(t=>!t.assigned_to).length);
  setText('#ticket-kpi-waiting',open.filter(t=>String(t.status||'').startsWith('waiting_')).length);
  const today=new Date().toISOString().slice(0,10);
  setText('#ticket-kpi-resolved',all.filter(t=>['resolved','closed'].includes(t.status)&&String(t.resolved_at||t.updated_at||'').slice(0,10)===today).length);
  const rows=all.filter(t=>(!q||`${t.ticket_number||''} ${t.subject||''} ${t.organisation_name||''} ${t.assigned_name||''} ${t.requester_name||''} ${t.requester_email||''} ${t.external_reference||''}`.toLowerCase().includes(q))&&(product==='all'||t.product_id===product)&&(status==='all'||t.status===status)&&(priority==='all'||t.priority===priority)&&(assignee==='all'||(assignee==='unassigned'?!t.assigned_to:t.assigned_to===assignee)));
  const table=$('#portal-ticket-table');
  if(!table)return;
  table.innerHTML=rows.map(t=>{
    const overdue=t.due_at&&new Date(t.due_at)<new Date()&&portalOpenStatuses.has(t.status);
    return `<tr><td><strong>${escapeHtml(t.ticket_number||'Pending')}</strong><small>${escapeHtml(t.subject||'Untitled ticket')}</small></td><td>${escapeHtml(t.product_name||'Platform')}</td><td>${escapeHtml(t.organisation_name||'Internal')}</td><td><span class="badge ${portalBadge(t.priority)}">${escapeHtml(t.priority||'normal')}</span></td><td>${escapeHtml(String(t.status||'new').replaceAll('_',' '))}${overdue?'<small class="danger-text">Overdue</small>':''}</td><td>${formatDateTime(t.updated_at)}<small>${escapeHtml(t.assigned_name||'Unassigned')}</small></td><td><button class="secondary-button compact" data-ticket-open="${escapeHtml(t.id||'')}">Open</button></td></tr>`
  }).join('')||'<tr><td colspan="7"><div class="empty-state"><strong>No matching tickets</strong><span>New support requests from all products will appear here.</span></div></td></tr>';
}
function renderPortalSessions(){const rows=simplifiedPortalData?.supportSessions||[];$('#portal-session-list').innerHTML=rows.map(x=>`<article class="portal-info-card"><div class="subheading"><div><h3>${escapeHtml(x.organisation_name||'Organisation')}</h3><p>${escapeHtml(x.product_name||'Product')}</p></div><span class="badge ${portalBadge(x.status)}">${escapeHtml(x.status)}</span></div><dl><div><dt>Staff</dt><dd>${escapeHtml(x.staff_name||'Platform staff')}</dd></div><div><dt>Access</dt><dd>${escapeHtml(String(x.access_mode||'read_only').replaceAll('_',' '))}</dd></div><div><dt>Reason</dt><dd>${escapeHtml(x.reason||'Support')}</dd></div><div><dt>Expires</dt><dd>${formatDateTime(x.expires_at)}</dd></div></dl></article>`).join('')||'<div class="empty-state"><strong>No active sessions</strong><span>Controlled support access will appear here.</span></div>'}
function renderPortalIncidents(){const rows=simplifiedPortalData?.incidents||[];$('#portal-incident-list').innerHTML=rows.map(i=>`<article class="portal-info-card"><div class="subheading"><div><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.product_name||'CoreCare Platform')}</p></div><span class="badge ${portalBadge(i.severity)}">${escapeHtml(i.severity)}</span></div><p>${escapeHtml(i.public_message||'Internal operational incident.')}</p><small>${escapeHtml(i.status)} · Started ${formatDateTime(i.started_at)}</small></article>`).join('')||'<div class="empty-state"><strong>No incidents</strong><span>All monitored products are clear.</span></div>'}
async function loadExecutiveIncidents(){const list=$('#executive-incident-list');if(!list)return;const d=await ensureSimplifiedPortalData(true);const rows=(d.incidents||[]).filter(i=>!['resolved','closed'].includes(String(i.status||'').toLowerCase()));const badge=$('#executive-incident-badge');if(badge){badge.textContent=String(rows.length);badge.className=`badge ${rows.some(i=>['critical','high'].includes(String(i.severity||'').toLowerCase()))?'danger':rows.length?'warning':'success'}`;}list.innerHTML=rows.slice(0,5).map(i=>`<article class="platform-result-item"><div><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.product_name||'CoreCare product')} · ${escapeHtml(i.status||'open')}</span></div><span class="badge ${portalBadge(i.severity)}">${escapeHtml(i.severity||'normal')}</span></article>`).join('')||'<div class="empty-state compact"><strong>No active incidents</strong><span>All monitored CoreCare products are operating normally.</span></div>'}
function organisationsForProduct(product){const links=simplifiedPortalData?.productOrganisations||[];const linked=links.filter(x=>x.product_id===product.id);if(linked.length)return linked;return product.code==='CARE'?(simplifiedPortalData?.dashboard?.organisations||[]).map(o=>({...o,product_id:product.id,organisation_id:o.id,organisation_name:o.name,health_status:o.health_score>=80?'healthy':o.health_score>=60?'warning':'critical',user_count:o.user_count||0,error_count_24h:0,open_ticket_count:(simplifiedPortalData.tickets||[]).filter(t=>t.product_id===product.id&&t.organisation_id===o.id&&portalOpenStatuses.has(t.status)).length,last_activity_at:o.last_activity_at})):[]}
function renderProductMonitor(){
 const d=simplifiedPortalData||{},lifecycle=$('#product-lifecycle-filter')?.value||'current',customerProducts=(d.products||[]).filter(p=>p.code!=='PLATFORM'&&(lifecycle==='archived'?p.status==='retired':p.status!=='retired')),product=customerProducts.find(p=>p.code===selectedPortalProductCode)||customerProducts[0],select=$('#product-monitor-select');
 if(select){select.innerHTML=customerProducts.map(p=>`<option value="${escapeHtml(p.code)}">${escapeHtml(p.name)}</option>`).join('');select.disabled=!customerProducts.length}
 if(!product){selectedPortalProductCode='';$('#product-monitor-code').textContent=lifecycle==='archived'?'ARCHIVE':'PRODUCTS';$('#product-monitor-name').textContent=lifecycle==='archived'?'No archived products':'No current products';$('#product-monitor-description').textContent=lifecycle==='archived'?'Products moved to Archived will remain recoverable here.':'Add a CoreCare product to begin monitoring.';$('#product-monitor-status').textContent='Empty';$('#product-monitor-status').className='badge neutral';['#product-org-count','#product-user-count','#product-ticket-count','#product-error-count'].forEach(selector=>setText(selector,0));setText('#product-response-time','—');setText('#product-version','—');renderProductOrganisationRows([]);return}
 selectedPortalProductCode=product.code;if(select)select.value=product.code;const orgs=organisationsForProduct(product),tickets=(d.tickets||[]).filter(t=>t.product_id===product.id&&portalOpenStatuses.has(t.status));$('#product-monitor-code').textContent=product.code;$('#product-monitor-name').textContent=product.name;$('#product-monitor-description').textContent=product.description||'Product monitoring';const status=product.status==='retired'?'archived':product.health_status||product.status||'unknown';$('#product-monitor-status').textContent=status;$('#product-monitor-status').className=`badge ${portalBadge(status)}`;$('#product-org-count').textContent=orgs.length;$('#product-user-count').textContent=orgs.reduce((n,o)=>n+Number(o.user_count||0),0);$('#product-ticket-count').textContent=tickets.length;$('#product-error-count').textContent=Number(product.error_count_24h||0)+orgs.reduce((n,o)=>n+Number(o.error_count_24h||0),0);$('#product-response-time').textContent=product.response_ms?`${product.response_ms} ms`:'Not connected';$('#product-version').textContent=product.current_version||'Not set';renderProductOrganisationRows(orgs)
}
function renderProductOrganisationRows(orgs=organisationsForProduct((simplifiedPortalData?.products||[]).find(p=>p.code===selectedPortalProductCode)||{})){
 const q=($('#product-org-search')?.value||'').toLowerCase(),rows=orgs.filter(o=>!q||`${o.organisation_name||o.name||''} ${o.external_organisation_id||''}`.toLowerCase().includes(q));
 $('#product-organisation-table').innerHTML=rows.map(o=>{const ready=o.access_status==='ready'&&['ready','manual',undefined,null].includes(o.provisioning_status),health=o.health_status||'unknown',entitlementStatus=o.entitlement_sync_status||'pending';return `<tr><td><strong>${escapeHtml(o.organisation_name||o.name)}</strong><small>${escapeHtml(o.external_organisation_id||'Product ID not assigned')} · ${escapeHtml(o.subscription_plan||'CoreCare customer')} · Features: ${escapeHtml(entitlementStatus)}</small></td><td><span class="badge ${portalBadge(ready?health:'warning')}">${escapeHtml(ready?health:(o.provisioning_status||'pending'))}</span></td><td>${Number(o.user_count||0)}</td><td>${Number(o.error_count_24h||0)}</td><td>${Number(o.open_ticket_count||0)}</td><td>${o.entitlement_sync_error?`<span class="danger-text">${escapeHtml(o.entitlement_sync_error)}</span>`:o.last_sync_error?`<span class="danger-text">${escapeHtml(o.last_sync_error)}</span>`:o.entitlement_applied_at?`Features applied ${formatDateTime(o.entitlement_applied_at)}`:o.last_sync_at?formatDateTime(o.last_sync_at):o.last_activity_at?formatDateTime(o.last_activity_at):'Awaiting first sync'}</td><td><button class="secondary-button compact" data-monitor-org="${escapeHtml(o.organisation_id||o.id)}">Open</button></td></tr>`}).join('')||'<tr><td colspan="7"><div class="empty-state"><strong>No organisations connected</strong><span>Use Add organisation to create or connect one in this product.</span></div></td></tr>'
}
function openOrganisationMonitor(id){
 const product=(simplifiedPortalData.products||[]).find(p=>p.code===selectedPortalProductCode),o=organisationsForProduct(product).find(x=>(x.organisation_id||x.id)===id);if(!o)return;
 $('#organisation-monitor-name').textContent=o.organisation_name||o.name;
 const tickets=(simplifiedPortalData.tickets||[]).filter(t=>t.organisation_id===id&&t.product_id===product.id&&portalOpenStatuses.has(t.status)),accessReady=Boolean(product.production_url&&o.access_status==='ready'&&o.external_organisation_id);
 $('#organisation-monitor-content').innerHTML=`<p class="field-help">Central ID: ${escapeHtml(id)} · Product ID: ${escapeHtml(o.external_organisation_id||'not assigned')}</p><section class="organisation-health-grid"><article><span>Application</span><strong>${escapeHtml(o.health_status||'unknown')}</strong></article><article><span>Database</span><strong>${escapeHtml(o.database_status||product.database_status||'monitoring')}</strong></article><article><span>Authentication</span><strong>${escapeHtml(o.auth_status||product.auth_status||'monitoring')}</strong></article><article><span>Integrations</span><strong>${escapeHtml(o.integration_status||product.integration_status||'monitoring')}</strong></article><article><span>Users</span><strong>${Number(o.user_count||0)}</strong></article><article><span>Open tickets</span><strong>${tickets.length}</strong></article></section>${accessReady?'':`<p class="form-error">This organisation is not fully provisioned for ${escapeHtml(product.name)}. Check its product ID and connection status.</p>`}<div class="organisation-support-actions"><button class="secondary-button" data-start-access="read_only" data-org-id="${id}" ${accessReady?'':'disabled'}>Read-only access</button><button class="primary-button" data-start-access="support" data-org-id="${id}" ${accessReady?'':'disabled'}>Open product</button><button class="secondary-button" data-start-access="implementation" data-org-id="${id}" ${accessReady?'':'disabled'}>Implementation access</button><button class="secondary-button" data-start-access="developer" data-org-id="${id}" ${accessReady?'':'disabled'}>Developer diagnostics</button></div><div class="monitor-issues"><h4>Current issues</h4>${tickets.length?tickets.map(t=>`<div class="control-row"><div><strong>${escapeHtml(t.ticket_number)} · ${escapeHtml(t.subject)}</strong><small>${escapeHtml(t.status)}</small></div><span class="badge ${portalBadge(t.priority)}">${escapeHtml(t.priority)}</span></div>`).join(''):'<p class="muted">No open tickets or known issues.</p>'}</div>`;
 $('#organisation-monitor-drawer').hidden=false;$('#organisation-monitor-drawer').scrollIntoView({behavior:'smooth',block:'start'})
}
let platformUsersData={users:[],summary:{},canManage:false};
async function loadPortalStaff(){platformUsersData=await api('/api/platform/users');renderPortalStaff()}
function renderPortalStaff(){
  const rows=platformUsersData.users||[],summary=platformUsersData.summary||{},resilience=$('#platform-owner-resilience');
  const ownerCount=rows.filter(user=>user.access_level==='platform_owner'&&user.status==='active').length;
  if(resilience){resilience.classList.toggle('warning',summary.resilience!=='ready');resilience.innerHTML=`<div><strong>${summary.resilience==='ready'?'Owner recovery is ready':'Add a second Platform owner'}</strong><span>${escapeHtml(summary.message||'')}</span>${!platformUsersData.canManage?'<small>Only a signed-in Platform owner can add or change Platform personnel.</small>':''}</div>${platformUsersData.canManage&&ownerCount<2?'<button class="primary-button compact" type="button" data-add-platform-owner>Add second owner</button>':''}`}
  const addButton=$('#add-platform-user');if(addButton){addButton.hidden=false;addButton.disabled=!platformUsersData.canManage;addButton.title=platformUsersData.canManage?'Add a Platform owner or staff member':'Only a Platform owner can add personnel'}
  $('#portal-staff-grid').innerHTML=rows.map(u=>`<article><div class="avatar">${escapeHtml((u.display_name||'CC').split(' ').map(x=>x[0]).join('').slice(0,2))}</div><div><strong>${escapeHtml(u.display_name)}</strong><small>${escapeHtml(u.email)} · ${escapeHtml(roleLabel(u.access_level))} · ${Number(u.active_sessions||0)} active session${Number(u.active_sessions||0)===1?'':'s'}</small>${u.must_change_password?'<small>Temporary password change required</small>':''}</div><span class="badge ${portalBadge(u.status)}">${escapeHtml(u.status)}</span>${platformUsersData.canManage?`<div class="row-actions"><button class="secondary-button compact" data-platform-user-reset="${escapeHtml(u.id)}">Reset password</button>${Number(u.active_sessions||0)?`<button class="secondary-button compact" data-platform-user-revoke="${escapeHtml(u.id)}">Revoke sessions</button>`:''}<button class="secondary-button compact" data-platform-user-status="${escapeHtml(u.id)}" data-next-status="${u.status==='active'?'disabled':'active'}">${u.status==='active'?'Disable':'Enable'}</button></div>`:''}</article>`).join('')||'<div class="empty-state"><strong>No platform staff</strong></div>';
}
function openPlatformUserDialog(accessLevel='platform_owner'){if(!platformUsersData.canManage)return;const form=$('#platform-user-form');form.reset();form.elements.accessLevel.value=accessLevel;$('#platform-user-error').hidden=true;$('#platform-user-dialog').showModal()}
$('#add-platform-user')?.addEventListener('click',()=>openPlatformUserDialog('platform_owner'));
document.addEventListener('click',event=>{if(event.target.closest?.('[data-add-platform-owner]'))openPlatformUserDialog('platform_owner')});
$('#platform-user-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,error=$('#platform-user-error'),button=form.querySelector('[type=submit]');error.hidden=true;try{button.disabled=true;await api('/api/platform/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});$('#platform-user-dialog').close();showToast('Platform user created. Share the temporary password securely.');await loadPortalStaff()}catch(exception){error.textContent=exception.message;error.hidden=false}finally{button.disabled=false}});
document.addEventListener('click',async event=>{const reset=event.target.closest?.('[data-platform-user-reset]'),revoke=event.target.closest?.('[data-platform-user-revoke]'),status=event.target.closest?.('[data-platform-user-status]');if(reset){const user=(platformUsersData.users||[]).find(item=>item.id===reset.dataset.platformUserReset),form=$('#platform-user-password-form');form.reset();form.elements.userId.value=reset.dataset.platformUserReset;setText('#platform-user-password-person',user?.display_name||'Platform user');$('#platform-user-password-error').hidden=true;$('#platform-user-password-dialog').showModal();return}if(revoke){if(!confirm('Revoke every active session for this user?'))return;await api(`/api/platform/users/${encodeURIComponent(revoke.dataset.platformUserRevoke)}/revoke-sessions`,{method:'POST',body:'{}'});showToast('Sessions revoked.');await loadPortalStaff();return}if(status){const next=status.dataset.nextStatus;if(!confirm(`${next==='disabled'?'Disable':'Enable'} this Platform account?`))return;await api(`/api/platform/users/${encodeURIComponent(status.dataset.platformUserStatus)}`,{method:'PUT',body:JSON.stringify({status:next})});showToast(`Platform account ${next}.`);await loadPortalStaff()}},true);
$('#platform-user-password-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,error=$('#platform-user-password-error'),data=Object.fromEntries(new FormData(form)),button=form.querySelector('[type=submit]');error.hidden=true;try{button.disabled=true;await api(`/api/platform/users/${encodeURIComponent(data.userId)}/reset-password`,{method:'POST',body:JSON.stringify({temporaryPassword:data.temporaryPassword})});$('#platform-user-password-dialog').close();showToast('Temporary password set and existing sessions revoked.');await loadPortalStaff()}catch(exception){error.textContent=exception.message;error.hidden=false}finally{button.disabled=false}});

function platformAuditDate(value){if(!value)return '-';const text=String(value),normalised=/[zZ]|[+-]\d\d:\d\d$/.test(text)?text:`${text.replace(' ','T')}Z`;return formatDateTime(normalised)}
function platformAuditLabel(value){return String(value||'Activity').replaceAll('.',' ').replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
function platformAuditTone(event){const value=`${event.action||''} ${event.entity_type||''}`.toLowerCase();return value.includes('login')||value.includes('auth')||value.includes('access')||value.includes('security')?'security':value.includes('support')||value.includes('ticket')?'support':value.includes('setting')?'settings':'activity'}
function platformAuditDetail(value){let detail={};try{detail=JSON.parse(value||'{}')||{}}catch{return ''}const blocked=/password|secret|token|code|key/i;const values=Object.entries(detail).filter(([key,item])=>!blocked.test(key)&&['string','number','boolean'].includes(typeof item)&&String(item).trim()).slice(0,4).map(([key,item])=>`${platformAuditLabel(key)}: ${String(item)}`);return values.join(' - ')}
async function loadPortalAudit({reset=false}={}){
  if(reset)portalAuditOffset=0;
  const list=$('#portal-audit-list');if(list)list.innerHTML='<div class="empty-state compact"><strong>Loading audit activity</strong><span>Reading the Platform audit service.</span></div>';
  const params=new URLSearchParams(),search=$('#portal-audit-search')?.value.trim(),category=$('#portal-audit-category')?.value,period=$('#portal-audit-period')?.value;
  if(search)params.set('q',search);if(category&&category!=='all')params.set('category',category);if(period&&period!=='all')params.set('period',period);params.set('offset',String(portalAuditOffset));
  try{portalAuditData=await api(`/api/platform/audit?${params}`);portalAuditOffset=Number(portalAuditData.pagination?.offset||0);renderPortalAudit()}catch(error){if(list)list.innerHTML=`<div class="empty-state compact danger-text"><strong>Audit activity could not be loaded</strong><span>${escapeHtml(error.message||'Please try again.')}</span></div>`;showToast(error.message||'Unable to load audit activity.','error')}
}
function renderPortalAudit(){
  const data=portalAuditData||{},events=data.events||[],summary=data.summary||{},pagination=data.pagination||{},limit=Number(pagination.limit||events.length||1),total=Number(data.total||0),start=total?Number(pagination.offset||0)+1:0,end=Math.min(Number(pagination.offset||0)+events.length,total);
  setText('#audit-kpi-total',Number(summary.total||0).toLocaleString('en-GB'));setText('#audit-kpi-day',Number(summary.last24h||0).toLocaleString('en-GB'));setText('#audit-kpi-support',Number(summary.supportEvents||0).toLocaleString('en-GB'));setText('#audit-kpi-security',Number(summary.securityEvents||0).toLocaleString('en-GB'));
  setText('#portal-audit-result-summary',total?`Showing ${start}-${end} of ${total.toLocaleString('en-GB')} matching events`:'No events match the selected filters');
  const list=$('#portal-audit-list');if(list)list.innerHTML=events.map(event=>{const detail=platformAuditDetail(event.detail_json);return `<article class="audit-event-card"><span class="audit-event-marker ${platformAuditTone(event)}"></span><div class="audit-event-main"><div class="audit-event-title"><strong>${escapeHtml(platformAuditLabel(event.action))}</strong><time>${escapeHtml(platformAuditDate(event.created_at))}</time></div><p>${escapeHtml(event.organisation_name||'Platform')} - ${escapeHtml(event.user_name||'System')}</p><small>${escapeHtml(platformAuditLabel(event.entity_type||'record'))}${event.entity_id?` - ${escapeHtml(event.entity_id)}`:''}</small>${detail?`<span class="audit-event-detail">${escapeHtml(detail)}</span>`:''}</div></article>`}).join('')||'<div class="empty-state compact"><strong>No audit activity found</strong><span>Change the search, category or period to broaden the results.</span></div>';
  const page=Math.floor(Number(pagination.offset||0)/limit)+1,pages=Math.max(1,Math.ceil(total/limit));setText('#portal-audit-page',`Page ${page} of ${pages}`);const previous=$('#portal-audit-previous'),next=$('#portal-audit-next');if(previous)previous.disabled=!pagination.hasPrevious;if(next)next.disabled=!pagination.hasNext;
}
function applyPlatformSupportSettings(settings){const select=$('#platform-access-form')?.elements.duration_minutes;if(!select||!settings)return;const maximum=Number(settings.maximumSupportDurationMinutes||240),preferred=Number(settings.defaultSupportDurationMinutes||60);[...select.options].forEach(option=>{const unavailable=Number(option.value)>maximum;option.disabled=unavailable;option.hidden=unavailable});const available=[...select.options].filter(option=>!option.disabled);select.value=available.some(option=>Number(option.value)===preferred)?String(preferred):String(available.at(-1)?.value||60)}
async function ensurePlatformSettings(){if(platformSettingsData)return platformSettingsData;platformSettingsData=await api('/api/platform/settings');applyPlatformSupportSettings(platformSettingsData.settings);return platformSettingsData}
async function loadPlatformSettings(){
  const message=$('#platform-settings-message');if(message)message.textContent='Loading saved settings...';
  try{platformSettingsData=await api('/api/platform/settings');renderPlatformSettings();applyPlatformSupportSettings(platformSettingsData.settings)}catch(error){if(message){message.textContent=error.message||'Platform settings could not be loaded.';message.classList.add('error')}showToast(error.message||'Unable to load platform settings.','error')}
}
function renderPlatformSettings(){const data=platformSettingsData||{},settings=data.settings||{},form=$('#platform-settings-form');if(!form)return;Object.entries(settings).forEach(([name,value])=>{if(form.elements[name])form.elements[name].value=String(value)});[...form.elements].forEach(control=>{if(control.name||control.type==='submit')control.disabled=data.canEdit===false});const message=$('#platform-settings-message');if(message){message.classList.remove('error');message.textContent=data.updatedAt?`Last saved ${platformAuditDate(data.updatedAt)}${data.updatedBy?` by ${data.updatedBy}`:''}.`:'Recommended settings are active. Save them to create the Platform configuration record.'}}
$('#portal-audit-filters')?.addEventListener('submit',event=>{event.preventDefault();loadPortalAudit({reset:true})});
$('#portal-audit-refresh')?.addEventListener('click',()=>loadPortalAudit());
$('#portal-audit-previous')?.addEventListener('click',()=>{portalAuditOffset=Math.max(0,portalAuditOffset-Number(portalAuditData?.pagination?.limit||100));loadPortalAudit()});
$('#portal-audit-next')?.addEventListener('click',()=>{portalAuditOffset+=Number(portalAuditData?.pagination?.limit||100);loadPortalAudit()});
$('#platform-settings-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=$('#platform-settings-save'),message=$('#platform-settings-message');if(Number(form.elements.criticalErrorThreshold.value)<Number(form.elements.warningErrorThreshold.value)){message.textContent='The critical error threshold must be equal to or above the warning threshold.';message.classList.add('error');form.elements.criticalErrorThreshold.focus();return}if(Number(form.elements.maximumSupportDurationMinutes.value)<Number(form.elements.defaultSupportDurationMinutes.value)){message.textContent='The maximum support duration must be equal to or above the default duration.';message.classList.add('error');form.elements.maximumSupportDurationMinutes.focus();return}try{button.disabled=true;button.textContent='Saving...';platformSettingsData=await api('/api/platform/settings',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(form)))});renderPlatformSettings();applyPlatformSupportSettings(platformSettingsData.settings);showToast('Platform settings saved and audited.')}catch(error){message.textContent=error.message||'Platform settings could not be saved.';message.classList.add('error');showToast(error.message||'Unable to save platform settings.','error')}finally{button.disabled=platformSettingsData?.canEdit===false;button.textContent='Save platform settings'}});
$('#platform-settings-reset')?.addEventListener('click',()=>{const form=$('#platform-settings-form'),defaults=platformSettingsData?.defaults||{};Object.entries(defaults).forEach(([name,value])=>{if(form?.elements[name])form.elements[name].value=String(value)});const message=$('#platform-settings-message');if(message){message.classList.remove('error');message.textContent='Recommended values are ready. Select Save platform settings to apply them.'}});
$('#settings-open-products')?.addEventListener('click',()=>showPlatformView('product-monitor-centre'));
$('#settings-open-team')?.addEventListener('click',()=>showPlatformView('platform-team-centre'));
$('#platform-open-owners')?.addEventListener('click',()=>showPlatformView('platform-team-centre'));
$('#settings-open-audit')?.addEventListener('click',()=>showPlatformView('platform-audit-centre'));
document.addEventListener('click',event=>{if(event.target.closest?.('[data-start-access]'))ensurePlatformSettings().catch(()=>{})},true);
['ticket-search','ticket-product-filter','ticket-status-filter','ticket-priority-filter','ticket-assignee-filter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='ticket-search'?'input':'change',renderPortalTickets));$('#product-org-search')?.addEventListener('input',()=>renderProductOrganisationRows());$('#close-organisation-monitor')?.addEventListener('click',()=>$('#organisation-monitor-drawer').hidden=true);document.addEventListener('click',e=>{const org=e.target.closest?.('[data-monitor-org]');if(org){openOrganisationMonitor(org.dataset.monitorOrg);return}});


// CoreCare Platform 1.4.2 ticket queue return usability
let activePlatformTicketId=null,activeMonitorProductId=null,activeMonitorOrganisationId=null;
function portalOptions(){const d=simplifiedPortalData||{};return {products:(d.products||[]).filter(p=>p.code!=='PLATFORM'),organisations:d.dashboard?.organisations||[]}}
function openNewPlatformTicket(){const {products,organisations}=portalOptions();$('#new-ticket-product').innerHTML=products.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');$('#new-ticket-organisation').innerHTML='<option value="">Internal / not selected</option>'+organisations.map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`).join('');$('#platform-ticket-form').reset();$('#platform-ticket-dialog').showModal()}
$('#portal-new-ticket')?.addEventListener('click',openNewPlatformTicket);
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.closeDialog)?.close()));
$('#platform-ticket-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]'),f=new FormData(form);try{if(button){button.disabled=true;button.textContent='Creating…';}const r=await api('/api/platform/support-tickets',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});$('#platform-ticket-dialog').close();showToast(`Ticket ${r.ticket_number} created.`);simplifiedPortalData=null;await loadSimplifiedPortal('support-ticket-centre');renderPortalTickets()}catch(err){showToast(err.message||'Unable to create ticket.','error')}finally{if(button){button.disabled=false;button.textContent='Create ticket';}}});
async function openPlatformTicket(id){activePlatformTicketId=id;try{const d=await api(`/api/platform/support-tickets/${encodeURIComponent(id)}`),t=d.ticket;$('#ticket-detail-number').textContent=t.ticket_number;$('#ticket-detail-title').textContent=t.subject;const staff=(simplifiedPortalData?.staff||[]),incidents=(simplifiedPortalData?.incidents||[]);$('#ticket-detail-body').innerHTML=`<section class="ticket-summary-card"><div class="form-grid"><label><span>Status</span><select id="ticket-edit-status">${['new','in_progress','waiting_customer','waiting_development','resolved','closed'].map(x=>`<option value="${x}" ${x===t.status?'selected':''}>${x.replaceAll('_',' ')}</option>`).join('')}</select></label><label><span>Priority</span><select id="ticket-edit-priority">${['low','normal','high','critical'].map(x=>`<option value="${x}" ${x===t.priority?'selected':''}>${x}</option>`).join('')}</select></label><label><span>Assigned to</span><select id="ticket-edit-assigned"><option value="">Unassigned</option>${staff.map(u=>`<option value="${u.id}" ${u.id===t.assigned_to?'selected':''}>${escapeHtml(u.display_name)}</option>`).join('')}</select></label><label><span>Category</span><input id="ticket-edit-category" value="${escapeHtml(t.category||'general')}"></label><label><span>Linked incident</span><select id="ticket-edit-incident"><option value="">None</option>${incidents.map(i=>`<option value="${i.id}" ${i.id===t.incident_id?'selected':''}>${escapeHtml(i.title)}</option>`).join('')}</select></label><label><span>Target response date</span><input id="ticket-edit-due" type="datetime-local" value="${t.due_at?String(t.due_at).replace(' ','T').slice(0,16):''}"></label></div><p>${escapeHtml(t.description||'No description supplied.')}</p><div class="ticket-meta"><span>${escapeHtml(t.product_name||'CoreCare')}</span><span>${escapeHtml(t.organisation_name||'Internal')}</span><span>${d.totalMinutes||0} minutes logged</span>${d.incident?`<span>Incident: ${escapeHtml(d.incident.title)}</span>`:''}</div><div class="dialog-actions ticket-actions"><button id="save-ticket-changes" class="primary-button compact">Save ticket</button>${['resolved','closed'].includes(t.status)?'<button id="reopen-ticket" class="secondary-button compact">Reopen ticket</button>':'<button id="resolve-ticket" class="secondary-button compact">Mark resolved</button>'}</div></section><section><div class="subheading"><div><h3>Conversation and notes</h3><p>Customer replies are visible externally; internal notes remain within CoreCare support.</p></div></div><div class="ticket-thread">${(d.messages||[]).map(m=>`<article class="ticket-message ${m.message_type==='internal_note'?'internal':''}"><div><strong>${escapeHtml(m.author_name||'CoreCare staff')}</strong><span>${m.message_type==='internal_note'?'Internal note':'Customer reply'} · ${formatDateTime(m.created_at)}</span></div><p>${escapeHtml(m.body)}</p></article>`).join('')||'<p class="muted">No replies or notes yet.</p>'}</div><form id="ticket-message-form" class="ticket-composer"><select name="message_type"><option value="customer_reply">Customer reply</option><option value="internal_note">Internal note</option></select><textarea name="body" rows="3" required placeholder="Write a reply or internal note"></textarea><button class="primary-button compact">Add message</button></form></section><section><div class="subheading"><div><h3>Attachments</h3><p>Add screenshots, PDFs or other evidence up to 2 MB per file.</p></div></div><div class="ticket-attachment-list">${(d.attachments||[]).map(a=>`<div class="control-row"><div><strong><a href="/api/platform/support-attachments/${encodeURIComponent(a.id)}" download="${escapeHtml(a.file_name)}">${escapeHtml(a.file_name)}</a></strong><small>${Math.max(1,Math.round(Number(a.size_bytes||0)/1024))} KB · ${formatDateTime(a.uploaded_at||a.created_at)}</small></div><button class="secondary-button compact" data-delete-ticket-attachment="${a.id}">Remove</button></div>`).join('')||'<p class="muted">No attachments.</p>'}</div><form id="ticket-attachment-form" class="inline-form"><input id="ticket-attachment-file" type="file" accept="image/*,.pdf,.txt,.doc,.docx" required><button class="secondary-button compact">Upload</button></form></section><section><div class="subheading"><div><h3>Time log</h3><p>Record time spent investigating and resolving this ticket.</p></div></div><div class="ticket-time-list">${(d.timeEntries||[]).map(x=>`<div class="control-row"><div><strong>${x.minutes} minutes · ${escapeHtml(x.staff_name||'Support')}</strong><small>${escapeHtml(x.notes||'Support work')} · ${formatDateTime(x.created_at)}</small></div></div>`).join('')||'<p class="muted">No time logged.</p>'}</div><form id="ticket-time-form" class="inline-form"><input name="minutes" type="number" min="1" max="1440" value="15" required><input name="notes" placeholder="Work completed"><button class="secondary-button compact">Log time</button></form></section>`;$('#platform-ticket-detail-dialog').showModal();$('#save-ticket-changes').onclick=savePlatformTicket;$('#resolve-ticket')?.addEventListener('click',()=>quickTicketStatus('resolved'));$('#reopen-ticket')?.addEventListener('click',()=>quickTicketStatus('in_progress'));$('#ticket-message-form').onsubmit=addPlatformTicketMessage;$('#ticket-time-form').onsubmit=addPlatformTicketTime;$('#ticket-attachment-form').onsubmit=addPlatformTicketAttachment}catch(err){showToast(err.message||'Unable to load ticket.')}}
async function savePlatformTicket(){const button=$('#save-ticket-changes');if(button){button.disabled=true;button.textContent='Saving…'}try{await api(`/api/platform/support-tickets/${activePlatformTicketId}`,{method:'PUT',body:JSON.stringify({status:$('#ticket-edit-status').value,priority:$('#ticket-edit-priority').value,assigned_to:$('#ticket-edit-assigned').value,category:$('#ticket-edit-category').value,incident_id:$('#ticket-edit-incident').value,due_at:$('#ticket-edit-due').value})});$('#platform-ticket-detail-dialog')?.close();activePlatformTicketId=null;simplifiedPortalData=null;await loadSimplifiedPortal('support-ticket-centre');showToast('Ticket saved.')}catch(err){showToast(err.message||'Unable to save ticket.');if(button){button.disabled=false;button.textContent='Save ticket'}}}
async function addPlatformTicketMessage(e){e.preventDefault();const f=new FormData(e.currentTarget);await api(`/api/platform/support-tickets/${activePlatformTicketId}/messages`,{method:'POST',body:JSON.stringify(Object.fromEntries(f))});await openPlatformTicket(activePlatformTicketId)}
async function addPlatformTicketTime(e){e.preventDefault();const f=new FormData(e.currentTarget);await api(`/api/platform/support-tickets/${activePlatformTicketId}/time`,{method:'POST',body:JSON.stringify(Object.fromEntries(f))});await openPlatformTicket(activePlatformTicketId)}
async function quickTicketStatus(status){$('#ticket-edit-status').value=status;await savePlatformTicket()}
async function addPlatformTicketAttachment(e){e.preventDefault();const file=$('#ticket-attachment-file').files?.[0];if(!file)return;if(file.size>2097152){showToast('Attachment must be 2 MB or smaller.');return}const data_url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});await api(`/api/platform/support-tickets/${activePlatformTicketId}/attachments`,{method:'POST',body:JSON.stringify({file_name:file.name,mime_type:file.type,size_bytes:file.size,data_url})});showToast('Attachment uploaded.');await openPlatformTicket(activePlatformTicketId)}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-delete-ticket-attachment]');if(!b)return;e.preventDefault();api(`/api/platform/ticket-attachments/${encodeURIComponent(b.dataset.deleteTicketAttachment)}`,{method:'DELETE'}).then(()=>{showToast('Attachment removed.');openPlatformTicket(activePlatformTicketId)}).catch(showToastError)},true);
function ticketSourceDetails(t){let metadata={};try{metadata=JSON.parse(t.metadata_json||'{}')||{}}catch{}const rows=[['Requester',[t.requester_name,t.requester_email].filter(Boolean).join(' · ')||'Not supplied'],['Source',t.source_product||t.product_code||'Platform'],['Product reference',t.external_reference||'Not supplied'],['Product organisation',metadata.product_organisation_id||'Not supplied'],['App version',t.app_version||'Not supplied'],['Module / page',[t.module,t.page_url].filter(Boolean).join(' · ')||'Not supplied'],['Submitted',formatDateTime(t.submitted_at||t.created_at)],['Access requested',t.access_requested?String(t.access_request_mode||'requested').replaceAll('_',' '):'No'],['Environment',metadata.environment||'Not supplied'],['Instance',metadata.instance_id||'Not supplied']];return `<section data-ticket-source-details><div class="subheading"><div><h3>Request information</h3><p>Identity, source application and diagnostics supplied with this ticket.</p></div></div><section class="organisation-health-grid">${rows.map(([label,value])=>`<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}</section></section>`}
const ticketDetailDialog=$('#platform-ticket-detail-dialog');if(ticketDetailDialog)new MutationObserver(async()=>{if(!ticketDetailDialog.open||!activePlatformTicketId||ticketDetailDialog.querySelector('[data-ticket-source-details]'))return;try{const detail=await api(`/api/platform/support-tickets/${encodeURIComponent(activePlatformTicketId)}`);$('#ticket-detail-body')?.insertAdjacentHTML('beforeend',ticketSourceDetails(detail.ticket||{}))}catch{}}).observe(ticketDetailDialog,{attributes:true,attributeFilter:['open']});
// Replace ticket open placeholder with working detail
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-ticket-open]');if(b){e.preventDefault();openPlatformTicket(b.dataset.ticketOpen)}});
const originalOpenOrganisationMonitor=openOrganisationMonitor;
function productSummaryCards(summary){if(!summary)return '<p class="muted">The product has not returned an organisation summary yet.</p>';const labels={users:'Users',activeUsers:'Active users',sites:'Sites',activeSites:'Active sites',locations:'Locations',branches:'Branches',activeBranches:'Active branches',units:'Units',availableUnits:'Available units',bookings:'Bookings',confirmedBookings:'Confirmed bookings',openBookings:'Open bookings',guests:'Guests',clients:'Clients',activeClients:'Active clients',staff:'Staff',activeStaff:'Active staff',carePlans:'Care plans',activeCarePlans:'Active care plans',jobs:'Jobs',activeJobs:'Active jobs',openJobs:'Open jobs',accounts:'Accounts',activeAccounts:'Active accounts',journalEntries:'Journal entries',postedJournalEntries:'Posted entries',orders:'Orders',openOrders:'Open orders',supportTickets:'Support tickets',openSupportTickets:'Open support tickets',queuedSupportTickets:'Queued tickets',tasks:'Open tasks',customers:'Customers',vehicles:'Vehicles'};const entries=Object.entries(summary.metrics||summary).filter(([key,value])=>labels[key]&&['number','string'].includes(typeof value));return entries.length?`<section class="organisation-health-grid">${entries.map(([key,value])=>`<article><span>${labels[key]}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}</section>`:'<p class="muted">The product is connected but has no operational totals to show yet.</p>'}
openOrganisationMonitor=async function(id){originalOpenOrganisationMonitor(id);const product=(simplifiedPortalData.products||[]).find(p=>p.code===selectedPortalProductCode);activeMonitorProductId=product?.id;activeMonitorOrganisationId=id;if(!product)return;try{const d=await api(`/api/platform/products/${encodeURIComponent(product.id)}/organisations/${encodeURIComponent(id)}/operations`),box=$('#organisation-monitor-content');box.insertAdjacentHTML('beforeend',`<section><div class="subheading"><div><h3>Live product information</h3><p>Current organisation totals reported by ${escapeHtml(product.name)}.</p></div><span class="badge ${d.health?.last_sync_error?'danger':'success'}">${d.health?.last_sync_error?'Sync failed':'Connected'}</span></div>${productSummaryCards(d.productSummary)}${d.health?.last_sync_error?`<p class="form-error">${escapeHtml(d.health.last_sync_error)}</p>`:''}</section><section class="monitor-operations-grid"><article><h4>Support history</h4>${(d.supportSessions||[]).map(s=>`<div class="control-row"><div><strong>${escapeHtml(s.access_mode)} · ${escapeHtml(s.staff_name||'CoreCare staff')}</strong><small>${escapeHtml(s.status)} · ${formatDateTime(s.started_at)}</small></div>${s.status==='active'?`<button class="secondary-button compact" data-end-support-session="${s.id}">End</button>`:''}</div>`).join('')||'<p class="muted">No support sessions.</p>'}</article><article><h4>Recent organisation activity</h4>${(d.activity||[]).slice(0,8).map(x=>`<div class="control-row"><div><strong>${escapeHtml(x.action)}</strong><small>${escapeHtml(x.entity_type||'record')} · ${formatDateTime(x.created_at)}</small></div></div>`).join('')||'<p class="muted">No recent activity.</p>'}</article></section>`) }catch(err){showToast(err.message||'Unable to load organisation operations.')}};
document.addEventListener('click',e=>{const access=e.target.closest?.('[data-start-access]');if(access){e.preventDefault();const f=$('#platform-access-form');f.elements.product_id.value=activeMonitorProductId||'';f.elements.organisation_id.value=access.dataset.orgId;f.elements.access_mode.value=access.dataset.startAccess;f.elements.reason.value='';$('#platform-access-dialog').showModal()}const end=e.target.closest?.('[data-end-support-session]');if(end){api(`/api/platform/support-sessions/${end.dataset.endSupportSession}/end`,{method:'POST'}).then(()=>{showToast('Support session ended.');openOrganisationMonitor(activeMonitorOrganisationId)})}} ,true);
$('#platform-access-form')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,payload=Object.fromEntries(new FormData(form));payload.reason=String(payload.reason||'').trim();if(!payload.product_id||!payload.organisation_id||payload.reason.length<10){showToast('Open an organisation and enter a reason of at least 10 characters.','error');form.elements.reason.focus();return}const launchWindow=window.open('about:blank','_blank');if(launchWindow)launchWindow.opener=null;try{const result=await api('/api/platform/support-sessions',{method:'POST',body:JSON.stringify(payload)});$('#platform-access-dialog').close();showToast('Audited support session started. Opening the product…');if(launchWindow)launchWindow.location.replace(result.launch_url);else window.location.assign(result.launch_url);simplifiedPortalData=null}catch(err){launchWindow?.close();showToast(err.message||'Unable to start support session.','error')}});

function currentMonitorProduct(){return (simplifiedPortalData?.products||[]).find(product=>product.code===selectedPortalProductCode)}
let productFeatureCatalogue=[];

function featureStateLabel(feature){if(feature.source==='dependency')return `Blocked by ${feature.blockedBy.join(', ')}`;if(feature.source==='mandatory')return 'Mandatory';if(feature.source==='product_unavailable')return 'Product unavailable';if(feature.source==='organisation_inactive')return 'Organisation inactive';if(feature.source==='connection_not_ready')return 'Connection not ready';return feature.enabled?'Enabled':'Disabled'}

async function openProductFeatureCatalogue(){
  const product=currentMonitorProduct();if(!product)return;
  const dialog=$('#product-feature-catalogue-dialog'),list=$('#product-feature-catalogue-list');
  $('#product-feature-catalogue-title').textContent=`${product.name} features`;
  $('#product-feature-catalogue-summary').textContent='Loading feature catalogue…';list.innerHTML='';if(!dialog.open)dialog.showModal();
  try{
    const data=await api(`/api/platform/products/${encodeURIComponent(product.id)}/features`);productFeatureCatalogue=data.features||[];
    $('#add-product-feature').hidden=!data.ownerCanEdit;
    const active=productFeatureCatalogue.filter(feature=>feature.status==='active'),mandatory=active.filter(feature=>Number(feature.mandatory)).length;
    $('#product-feature-catalogue-summary').textContent=`${active.length} active features · ${mandatory} mandatory · owner-managed by default`;
    list.innerHTML=productFeatureCatalogue.map(feature=>`<article class="feature-catalogue-card ${feature.status==='retired'?'is-retired':''}"><div><span class="feature-category">${escapeHtml(feature.category||'General')}</span><h3>${escapeHtml(feature.name)}</h3><p>${escapeHtml(feature.description||feature.feature_key)}</p><small>Key: ${escapeHtml(feature.feature_key)}${(feature.dependencies||[]).length?` · Requires ${escapeHtml(feature.dependencies.join(', '))}`:''}</small></div><div class="feature-catalogue-meta"><span class="badge ${Number(feature.mandatory)?'warning':feature.status==='active'?'success':'neutral'}">${Number(feature.mandatory)?'Mandatory':escapeHtml(feature.status)}</span><small>${Number(feature.default_enabled)?'On':'Off'} by default</small><small>${Number(feature.organisation_can_disable)?'Delegation available':'Owner only'}</small>${data.ownerCanEdit?`<button type="button" class="secondary-button compact" data-edit-product-feature="${escapeHtml(feature.feature_key)}">Edit</button>`:''}</div></article>`).join('')||'<div class="empty-state"><strong>No features registered</strong><span>Add the first module for this product.</span></div>';
  }catch(error){list.innerHTML=`<p class="form-error">${escapeHtml(error.message||'Unable to load the feature catalogue.')}</p>`}
}

function openProductFeatureForm(feature=null){
  const form=$('#product-feature-form');form.reset();$('#product-feature-error').hidden=true;$('#product-feature-dialog-title').textContent=feature?'Edit feature':'Add feature';
  form.elements.id.value=feature?.id||'';form.elements.feature_key.value=feature?.feature_key||'';form.elements.feature_key.readOnly=Boolean(feature);form.elements.name.value=feature?.name||'';form.elements.category.value=feature?.category||'';form.elements.status.value=feature?.status||'active';form.elements.description.value=feature?.description||'';form.elements.dependencies.value=(feature?.dependencies||[]).join(', ');form.elements.sort_order.value=feature?.sort_order||0;form.elements.default_enabled.checked=feature?Boolean(Number(feature.default_enabled)):true;form.elements.mandatory.checked=Boolean(Number(feature?.mandatory||0));form.elements.organisation_can_disable.checked=Boolean(Number(feature?.organisation_can_disable||0));
  $('#product-feature-dialog').showModal();
}

async function loadOrganisationFeatureControls(productId,organisationId){
  const data=await api(`/api/platform/products/${encodeURIComponent(productId)}/organisations/${encodeURIComponent(organisationId)}/features`),box=$('#organisation-monitor-content'),summary=data.summary||{};
  const grouped=(data.features||[]).reduce((groups,feature)=>{(groups[feature.category||'General']??=[]).push(feature);return groups},{});
  const sync=data.sync||{status:'pending'},syncCopy=sync.status==='applied'&&sync.applied_at?`Applied by ${data.product.name} ${formatDateTime(sync.applied_at)}`:sync.status==='failed'?`Delivery failed: ${sync.error_message||'product reported an error'}`:sync.status==='acknowledged'?`Acknowledged ${formatDateTime(sync.acknowledged_at)}`:'Awaiting product acknowledgement';
  box.insertAdjacentHTML('beforeend',`<section class="feature-entitlement-panel"><div class="subheading"><div><h3>Features &amp; modules</h3><p>Owner-controlled access for this organisation in ${escapeHtml(data.product.name)}. ${escapeHtml(syncCopy)}</p></div><span class="badge ${sync.status==='applied'?'success':sync.status==='failed'?'danger':'warning'}">${escapeHtml(sync.status||'pending')}</span></div><div class="feature-entitlement-summary"><span>${Number(summary.enabled||0)} enabled</span><span>${Number(summary.disabled||0)} disabled</span><span>${Number(summary.mandatory||0)} mandatory</span><span>${Number(summary.delegated||0)} delegated</span></div><form id="organisation-feature-form"><div class="feature-entitlement-groups">${Object.entries(grouped).map(([category,features])=>`<section><h4>${escapeHtml(category)}</h4>${features.map(feature=>`<div class="feature-entitlement-row"><div><strong>${escapeHtml(feature.name)}</strong><small>${escapeHtml(feature.description||feature.key)}</small>${feature.blockedBy?.length?`<small class="danger-text">Requires ${escapeHtml(feature.blockedBy.join(', '))}</small>`:''}</div><span class="badge ${feature.enabled?'success':'neutral'}">${escapeHtml(featureStateLabel(feature))}</span><label><span>Owner setting</span><select data-feature-state="${escapeHtml(feature.key)}" ${!data.ownerCanEdit?'disabled':''}><option value="inherit" ${feature.configuredState==='inherit'?'selected':''}>Use product default</option><option value="enabled" ${feature.configuredState==='enabled'?'selected':''}>Enabled</option><option value="disabled" ${feature.configuredState==='disabled'?'selected':''} ${feature.mandatory?'disabled':''}>Disabled</option></select></label><label><span>Organisation control</span><select data-feature-control="${escapeHtml(feature.key)}" ${!data.ownerCanEdit||!feature.organisationCanDisable?'disabled':''}><option value="owner" ${feature.organisationControl==='owner'?'selected':''}>Owner only</option><option value="disable_only" ${feature.organisationControl==='disable_only'?'selected':''}>May disable</option></select></label></div>`).join('')}</section>`).join('')}</div>${data.ownerCanEdit?`<div class="feature-entitlement-save"><label><span>Reason for change *</span><textarea name="reason" rows="2" minlength="10" required placeholder="Explain why these organisation features are being changed"></textarea></label><button class="primary-button compact" type="submit">Save organisation features</button></div>`:'<p class="field-help">Only the CoreCare platform owner can change organisation feature access.</p>'}</form></section>`);
}

const openOrganisationMonitorWithOperations=openOrganisationMonitor;
openOrganisationMonitor=async function(id){await openOrganisationMonitorWithOperations(id);const product=currentMonitorProduct();if(!product)return;try{await loadOrganisationFeatureControls(product.id,id)}catch(error){$('#organisation-monitor-content')?.insertAdjacentHTML('beforeend',`<section class="feature-entitlement-panel"><h3>Features &amp; modules</h3><p class="form-error">${escapeHtml(error.message||'Unable to load feature controls.')}</p></section>`)}};

$('#manage-platform-features')?.addEventListener('click',openProductFeatureCatalogue);
$('#add-product-feature')?.addEventListener('click',()=>openProductFeatureForm());
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-edit-product-feature]');if(!button)return;openProductFeatureForm(productFeatureCatalogue.find(feature=>feature.feature_key===button.dataset.editProductFeature))});
$('#product-feature-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,error=$('#product-feature-error'),product=currentMonitorProduct();if(!product)return;const data=Object.fromEntries(new FormData(form));data.default_enabled=form.elements.default_enabled.checked;data.mandatory=form.elements.mandatory.checked;data.organisation_can_disable=form.elements.organisation_can_disable.checked;data.dependencies=String(data.dependencies||'').split(',').map(value=>value.trim()).filter(Boolean);error.hidden=true;try{await api(`/api/platform/products/${encodeURIComponent(product.id)}/features`,{method:'POST',body:JSON.stringify(data)});$('#product-feature-dialog').close();showToast('Product feature saved.');await openProductFeatureCatalogue()}catch(exception){error.textContent=exception.message;error.hidden=false}});
document.addEventListener('submit',async event=>{if(event.target.id!=='organisation-feature-form')return;event.preventDefault();const form=event.target,reason=form.elements.reason?.value?.trim()||'';if(reason.length<10){showToast('Enter a reason of at least 10 characters.','error');return}const features=[...form.querySelectorAll('[data-feature-state]')].map(select=>({key:select.dataset.featureState,state:select.value,organisationControl:form.querySelector(`[data-feature-control="${CSS.escape(select.dataset.featureState)}"]`)?.value||'owner'}));const button=form.querySelector('[type=submit]');try{button.disabled=true;button.textContent='Saving…';await api(`/api/platform/products/${encodeURIComponent(activeMonitorProductId)}/organisations/${encodeURIComponent(activeMonitorOrganisationId)}/features`,{method:'PUT',body:JSON.stringify({reason,features})});showToast('Organisation features saved and audited.');await openOrganisationMonitor(activeMonitorOrganisationId)}catch(exception){showToast(exception.message||'Unable to save organisation features.','error')}finally{if(button?.isConnected){button.disabled=false;button.textContent='Save organisation features'}}});
$('#product-monitor-select')?.addEventListener('change',event=>{selectedPortalProductCode=event.currentTarget.value;$('#organisation-monitor-drawer').hidden=true;renderProductMonitor()});
$('#product-lifecycle-filter')?.addEventListener('change',()=>{selectedPortalProductCode='';$('#organisation-monitor-drawer').hidden=true;renderProductMonitor()});
$('#configure-platform-product')?.addEventListener('click',()=>openPlatformProductDialog(currentMonitorProduct()));
$('#new-platform-product')?.addEventListener('click',()=>openPlatformProductDialog());
function openPlatformProductDialog(product=null){const dialog=$('#platform-product-dialog'),form=$('#platform-product-form');form.reset();$('#platform-product-error').hidden=true;$('#platform-product-dialog-title').textContent=product?'Configure product':'Register CoreCare product';form.elements.id.value=product?.id||'';form.elements.name.value=product?.name||'';form.elements.code.value=product?.code||'';form.elements.code.disabled=Boolean(product);form.elements.status.value=product?.status||'development';form.elements.current_version.value=product?.current_version||'';form.elements.description.value=product?.description||'';form.elements.production_url.value=product?.production_url||'';form.elements.health_url.value=product?.health_url||'';form.elements.repository_url.value=product?.repository_url||'';dialog.showModal()}
$('#platform-product-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,error=$('#platform-product-error'),data=Object.fromEntries(new FormData(form)),id=form.elements.id.value;error.hidden=true;try{const result=await api(id?`/api/platform/products/${encodeURIComponent(id)}`:'/api/platform/products',{method:id?'PUT':'POST',body:JSON.stringify(data)});$('#platform-product-dialog').close();simplifiedPortalData=null;selectedPortalProductCode=result.product?.code||selectedPortalProductCode;await loadSimplifiedPortal('product-monitor-centre');showToast(id?'Product configuration saved.':'Product registered.')}catch(exception){error.textContent=exception.message;error.hidden=false}});
$('#add-product-organisation')?.addEventListener('click',async()=>{const product=currentMonitorProduct(),form=$('#product-organisation-form'),error=$('#product-organisation-error');if(!product||product.status==='retired')return;form.reset();populateSubscriptionPlanSelects();form.elements.product_id.value=product.id;error.hidden=true;try{const result=await api('/api/platform/organisations'),linked=new Set(organisationsForProduct(product).map(item=>item.organisation_id||item.id));form.elements.organisation_id.innerHTML='<option value="">Create a new organisation</option>'+(result.organisations||[]).filter(org=>org.status!=='archived'&&!linked.has(org.id)).map(org=>`<option value="${escapeHtml(org.id)}">${escapeHtml(org.name)}</option>`).join('');$('#product-organisation-dialog').showModal()}catch(exception){showToast(exception.message||'Unable to load organisations.')}});
$('#product-organisation-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,error=$('#product-organisation-error'),data=Object.fromEntries(new FormData(form)),productId=data.product_id;error.hidden=true;try{await api(`/api/platform/products/${encodeURIComponent(productId)}/organisations`,{method:'POST',body:JSON.stringify(data)});$('#product-organisation-dialog').close();simplifiedPortalData=null;await loadSimplifiedPortal('product-monitor-centre');showToast('Organisation connected to product.')}catch(exception){error.textContent=exception.message;error.hidden=false}});
