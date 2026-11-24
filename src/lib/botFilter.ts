/* ------------------------------------------------------------------ */
/*  Bot- & crawler-detektion (server + klient)                         */
/* ------------------------------------------------------------------ */

const BOT_UA_PATTERN =
  /headlesschrome|phantomjs|slimerjs|playwright|puppeteer|selenium|webdriver|cypress|lighthouse|chrome-lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|datadogsynthetics|newrelicpinger|googlebot|adsbot|mediapartners-google|apis-google|inspectiontool|bingbot|adidxbot|msnbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|facebookexternalhit|ia_archiver|twitterbot|discordbot|slackbot|telegrambot|whatsapp|linkedinbot|applebot|pinterestbot|redditbot|embedly|quora link preview|outbrain|vkshare|w3c_validator|ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|screaming frog|petalbot|bytespider|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|ccbot|perplexitybot|amazonbot|cenysinspect|zgrab|masscan|nmap|nikto|sqlmap|curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/|okhttp|axios\/|node-fetch|undici|got\(|libwww-perl|scrapy/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 12) return true;
  return BOT_UA_PATTERN.test(ua);
}

export function isAutomatedBrowser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  if (navigator.webdriver) return true;
  if (isBotUserAgent(navigator.userAgent)) return true;

  const w = window as unknown as Record<string, unknown>;
  if (
    w._phantom ||
    w.__nightmare ||
    w.callPhantom ||
    w.__playwright ||
    w.__pw_manual ||
    w.Cypress ||
    w.domAutomation ||
    w.domAutomationController
  ) {
    return true;
  }

  /* Headless Chrome uden sprog eller med 0×0 vindue */
  if ((!navigator.languages || navigator.languages.length === 0) && !navigator.language) {
    return true;
  }
  if (window.outerWidth === 0 && window.outerHeight === 0) {
    return true;
  }

  return false;
}
