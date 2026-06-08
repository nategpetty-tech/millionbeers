const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath), "utf8"));
}

const appConfig = readJson("app.json").expo;
const easConfig = fs.existsSync(path.join(process.cwd(), "eas.json")) ? readJson("eas.json") : {};
const productionProfile = easConfig.build?.production;

const releaseInfo = {
  appName: appConfig.name,
  appVersion: appConfig.version,
  slug: appConfig.slug,
  scheme: appConfig.scheme,
  iosBundleIdentifier: appConfig.ios?.bundleIdentifier,
  iosBuildNumber: appConfig.ios?.buildNumber,
  easProjectId: appConfig.extra?.eas?.projectId,
  easProductionProfile: productionProfile
    ? {
        iosDistribution: productionProfile.ios?.distribution,
        autoIncrement: productionProfile.autoIncrement,
        envKeys: Object.keys(productionProfile.env ?? {})
      }
    : null
};

console.log(JSON.stringify(releaseInfo, null, 2));
