export const dashboardOrigin = new URL("https://cbcap.sozorockfoundation.org");

if (
  dashboardOrigin.protocol !== "https:" ||
  dashboardOrigin.username ||
  dashboardOrigin.password ||
  dashboardOrigin.pathname !== "/" ||
  dashboardOrigin.search ||
  dashboardOrigin.hash
) {
  throw new Error("Invalid canonical CB-CAP origin configuration");
}

export const dashboardUrl = dashboardOrigin.origin;
