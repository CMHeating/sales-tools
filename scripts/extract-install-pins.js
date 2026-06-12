const fs = require("fs");

const sourcePath = "install-availability.html";
const outputPath = "pin-config.private.json";

const html = fs.readFileSync(sourcePath, "utf8");

function extractObjectBlock(constName) {
  const startToken = `const ${constName} = {`;
  const start = html.indexOf(startToken);
  if (start === -1) {
    throw new Error(`Could not find ${constName}`);
  }

  let i = start + startToken.length - 1;
  let depth = 0;
  let end = -1;

  for (; i < html.length; i++) {
    const ch = html[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Could not parse ${constName}`);
  }

  return html.slice(start + `const ${constName} = `.length, end);
}

function parsePinMap(block, label) {
  const result = {};
  const pairRegex = /"([^"]+)"\s*:\s*"([^"]+)"/g;
  let match;

  while ((match = pairRegex.exec(block)) !== null) {
    const pin = String(match[1]).trim();
    const name = String(match[2]).trim();

    if (!/^\d{4,12}$/.test(pin)) {
      throw new Error(`${label} has invalid PIN format for ${name}`);
    }

    if (!name) {
      throw new Error(`${label} has empty name for PIN ${pin}`);
    }

    result[pin] = name;
  }

  if (Object.keys(result).length === 0) {
    throw new Error(`${label} parsed zero PINs`);
  }

  return result;
}

const admin = parsePinMap(extractObjectBlock("ADMIN_PINS"), "ADMIN_PINS");
const hca = parsePinMap(extractObjectBlock("HCA_PINS"), "HCA_PINS");

const config = {
  admin,
  hca
};

fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });

console.log(`Wrote ${outputPath}`);
console.log(`Admin PIN count: ${Object.keys(admin).length}`);
console.log(`HCA PIN count: ${Object.keys(hca).length}`);
console.log("Do not commit pin-config.private.json.");
