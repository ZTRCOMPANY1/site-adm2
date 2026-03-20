const WORKER_BASE_URL = "https://ztr-monitor-api.ztrcompany.workers.dev/";

const SECURITY_DOMAINS = [
  "siteofcastronomia.site",
  "ztrcompany.site"
];

const navButtons = document.querySelectorAll(".nav-btn");
const contents = document.querySelectorAll(".content");
const sectionTitle = document.getElementById("sectionTitle");
const sectionSubtitle = document.getElementById("sectionSubtitle");
const refreshBtn = document.getElementById("refreshBtn");
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");

const sectionMeta = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Dados reais de monitoramento"
  },
  monitoramento: {
    title: "Monitoramento",
    subtitle: "Status real via Cloudflare Worker"
  },
  seguranca: {
    title: "Segurança",
    subtitle: "Análise real de headers e SSL"
  },
  integracoes: {
    title: "Integrações",
    subtitle: "Cloudflare Worker conectado ao painel"
  }
};

function switchSection(sectionId) {
  contents.forEach(section => section.classList.remove("active"));
  navButtons.forEach(btn => btn.classList.remove("active"));

  const selectedSection = document.getElementById(sectionId);
  const selectedButton = document.querySelector(`[data-section="${sectionId}"]`);

  if (selectedSection) selectedSection.classList.add("active");
  if (selectedButton) selectedButton.classList.add("active");

  if (sectionMeta[sectionId]) {
    sectionTitle.textContent = sectionMeta[sectionId].title;
    sectionSubtitle.textContent = sectionMeta[sectionId].subtitle;
  }

  if (window.innerWidth <= 860) {
    sidebar.classList.remove("open");
  }
}

function startClock() {
  const clock = document.getElementById("liveClock");

  function updateClock() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString("pt-BR");
  }

  updateClock();
  setInterval(updateClock, 1000);
}

function formatNumber(num) {
  return new Intl.NumberFormat("pt-BR").format(num);
}

function getStatusInfo(statusCode) {
  if (statusCode === 2) {
    return {
      text: "🟢 Online",
      className: "online"
    };
  }

  return {
    text: "🔴 Offline",
    className: "offline"
  };
}

function calculateAverage(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((acc, num) => acc + num, 0) / numbers.length;
}

function renderDashboardCards(monitors) {
  const online = monitors.filter(m => m.status === 2).length;
  const offline = monitors.length - online;

  const responseTimes = monitors
    .map(m => Number(m.average_response_time || 0))
    .filter(n => n > 0);

  const uptimeRatios = monitors
    .map(m => Number(m.all_time_uptime_ratio || 0))
    .filter(n => !Number.isNaN(n) && n > 0);

  const avgResponse = responseTimes.length
    ? `${Math.round(calculateAverage(responseTimes))}ms`
    : "—";

  const avgUptime = uptimeRatios.length
    ? `${calculateAverage(uptimeRatios).toFixed(2)}%`
    : "—";

  document.getElementById("onlineCount").textContent = online;
  document.getElementById("offlineCount").textContent = offline;
  document.getElementById("avgResponse").textContent = avgResponse;
  document.getElementById("avgUptime").textContent = avgUptime;
}

function renderSiteList(monitors) {
  const siteList = document.getElementById("siteList");

  if (!monitors.length) {
    siteList.innerHTML = `
      <div class="event-item">
        <strong>Nenhum monitor encontrado</strong>
        <div>Verifique sua conta da UptimeRobot e a chave da API.</div>
      </div>
    `;
    return;
  }

  siteList.innerHTML = monitors.map(monitor => {
    const status = getStatusInfo(monitor.status);

    return `
      <div class="site-item">
        <div class="site-item-top">
          <strong>${escapeHtml(monitor.friendly_name || "Sem nome")}</strong>
          <span class="status ${status.className}">${status.text}</span>
        </div>

        <div class="site-meta">
          <span class="chip">⚡ ${monitor.average_response_time ? `${monitor.average_response_time}ms` : "—"}</span>
          <span class="chip">🕒 ${monitor.all_time_uptime_ratio ? `${monitor.all_time_uptime_ratio}%` : "—"}</span>
          <span class="chip">🔗 ${escapeHtml(monitor.url || "—")}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderMonitorTable(monitors) {
  const monitorTable = document.getElementById("monitorTable");

  if (!monitors.length) {
    monitorTable.innerHTML = `
      <tr>
        <td colspan="5">Nenhum monitor encontrado.</td>
      </tr>
    `;
    return;
  }

  monitorTable.innerHTML = monitors.map(monitor => {
    const status = getStatusInfo(monitor.status);

    return `
      <tr>
        <td>${escapeHtml(monitor.friendly_name || "Sem nome")}</td>
        <td><span class="status ${status.className}">${status.text}</span></td>
        <td>${monitor.type === 1 ? "HTTP(s)" : escapeHtml(String(monitor.type || "—"))}</td>
        <td>${monitor.average_response_time ? `${monitor.average_response_time}ms` : "—"}</td>
        <td>${monitor.all_time_uptime_ratio ? `${monitor.all_time_uptime_ratio}%` : "—"}</td>
      </tr>
    `;
  }).join("");
}

function renderMonitorError(message) {
  document.getElementById("onlineCount").textContent = "—";
  document.getElementById("offlineCount").textContent = "—";
  document.getElementById("avgResponse").textContent = "—";
  document.getElementById("avgUptime").textContent = "—";

  document.getElementById("siteList").innerHTML = `
    <div class="event-item">
      <strong>Erro no monitoramento</strong>
      <div>${escapeHtml(message)}</div>
    </div>
  `;

  document.getElementById("monitorTable").innerHTML = `
    <tr>
      <td colspan="5">${escapeHtml(message)}</td>
    </tr>
  `;
}

async function loadUptimeData() {
  try {
    const response = await fetch(`${WORKER_BASE_URL}/api/status`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao consultar /api/status");
    }

    if (!data.monitors || !Array.isArray(data.monitors)) {
      throw new Error("A resposta do Worker não trouxe os monitores.");
    }

    renderDashboardCards(data.monitors);
    renderSiteList(data.monitors);
    renderMonitorTable(data.monitors);
  } catch (error) {
    console.error("Erro no monitoramento:", error);
    renderMonitorError(error.message || "Erro ao carregar dados reais.");
  }
}

async function loadSecurityData() {
  const securityList = document.getElementById("securityList");

  securityList.innerHTML = "";

  if (!SECURITY_DOMAINS.length) {
    securityList.innerHTML = `
      <div class="event-item">
        <strong>Nenhum domínio configurado</strong>
        <div>Adicione seus domínios no array SECURITY_DOMAINS no app.js.</div>
      </div>
    `;
    return;
  }

  for (const domain of SECURITY_DOMAINS) {
    const card = document.createElement("div");
    card.className = "site-item";
    card.innerHTML = `
      <div class="site-item-top">
        <strong>${escapeHtml(domain)}</strong>
        <span class="chip">Carregando...</span>
      </div>
    `;
    securityList.appendChild(card);

    try {
      const response = await fetch(
        `${WORKER_BASE_URL}/api/security?domain=${encodeURIComponent(domain)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Falha ao consultar segurança de ${domain}`);
      }

      const grade = data.grade || "—";
      const hasHsts = !!(data.headers && data.headers["strict-transport-security"]);
      const hasReferrerPolicy = !!(data.headers && data.headers["referrer-policy"]);
      const hasCsp = !!(data.headers && data.headers["content-security-policy"]);

      card.innerHTML = `
        <div class="site-item-top">
          <strong>${escapeHtml(domain)}</strong>
          <span class="chip">Nota ${escapeHtml(String(grade))}</span>
        </div>

        <div class="site-meta">
          <span class="chip">SSL/HSTS: ${hasHsts ? "Ativo" : "Ausente"}</span>
          <span class="chip">Referrer-Policy: ${hasReferrerPolicy ? "OK" : "Ausente"}</span>
          <span class="chip">CSP: ${hasCsp ? "OK" : "Ausente"}</span>
        </div>
      `;
    } catch (error) {
      console.error(`Erro ao carregar segurança de ${domain}:`, error);

      card.innerHTML = `
        <div class="site-item-top">
          <strong>${escapeHtml(domain)}</strong>
          <span class="chip">Falha</span>
        </div>

        <div class="site-meta">
          <span class="chip">${escapeHtml(error.message || "Erro ao consultar segurança.")}</span>
        </div>
      `;
    }
  }
}

function renderIntegrationsInfo() {
  const integrationSection = document.querySelector("#integracoes .panel");

  if (!integrationSection) return;

  const domainsList = SECURITY_DOMAINS.length
    ? SECURITY_DOMAINS.map(domain => `<code>${escapeHtml(domain)}</code>`).join(", ")
    : "<code>Nenhum domínio definido</code>";

  integrationSection.innerHTML = `
    <div class="panel-header">
      <h3>Configuração atual</h3>
    </div>

    <div class="event-item">
      <strong>Worker Base URL</strong>
      <div><code>${escapeHtml(WORKER_BASE_URL)}</code></div>
    </div>

    <div class="event-item">
      <strong>Domínios monitorados na segurança</strong>
      <div>${domainsList}</div>
    </div>

    <div class="event-item">
      <strong>Rota de monitoramento</strong>
      <div><code>${escapeHtml(WORKER_BASE_URL)}/api/status</code></div>
    </div>

    <div class="event-item">
      <strong>Rota de segurança</strong>
      <div><code>${escapeHtml(WORKER_BASE_URL)}/api/security?domain=seudominio.com</code></div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupEvents() {
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchSection(btn.dataset.section);
    });
  });

  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Atualizando...";

    await Promise.all([
      loadUptimeData(),
      loadSecurityData()
    ]);

    refreshBtn.disabled = false;
    refreshBtn.textContent = "Atualizar";
  });
}

async function init() {
  startClock();
  setupEvents();
  renderIntegrationsInfo();

  await Promise.all([
    loadUptimeData(),
    loadSecurityData()
  ]);
}

window.addEventListener("load", init);