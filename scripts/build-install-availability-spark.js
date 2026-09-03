const fs = require("fs");

const users = require("./install-availability-users.spark.js");

const sourcePath = "install-availability.html";
const securePath = "install-availability-secure.html";
const rulesPath = "database.install-availability.spark.rules.json";

// Normalize to LF before any matching. Windows checkouts get CRLF via
// core.autocrlf, but the replacement patterns below are written with \n, so
// without this the regexes silently fail to match and the build aborts on the
// "still contains old PIN" guard. Normalizing here also means Windows and
// Linux produce byte-identical output.
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");

function ruleOr(emails) {
  return emails
    .map(email => `auth.token.email == '${email}'`)
    .join(" || ");
}

const approvedEmails = users.map(user => user.email);
const adminEmails = users
  .filter(user => user.role === "ADMIN")
  .map(user => user.email);

const approvedRule = `(auth != null && (${ruleOr(approvedEmails)}))`;
const adminRule = `(auth != null && (${ruleOr(adminEmails)}))`;

const rules = {
  rules: {
    ".read": false,
    ".write": false,

    cmh_schedule: {
      ".read": approvedRule,
      ".write": adminRule
    },

    cmh_availability: {
      ".read": approvedRule,
      ".write": approvedRule
    },

    cmh_edit_locks: {
      ".read": approvedRule,
      ".write": approvedRule
    },

    cmh_audit_logs: {
      ".read": adminRule,
      "$entryId": {
        ".write": `${approvedRule} && !data.exists()`
      }
    }
  }
};

let output = source;

output = output.replace(
  'import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";',
  'import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";'
);

output = output.replace(
  /const ADMIN_PINS = \{[\s\S]*?\};\n\nconst HCA_PINS = \{[\s\S]*?\};/,
  `const INSTALL_USERS = ${JSON.stringify(users, null, 2)};`
);

output = output.replace(
  /signInAnonymously\(auth\)\n  \.then\(\(\) => \{ startListeners\(\); \}\)\n  \.catch\(err => console\.error\("❌ Firebase auth error:", err\)\);/,
  `let listenersStarted = false;

function normalizeAuthEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function findInstallUserByEmail(email) {
  const target = normalizeAuthEmail(email);
  return INSTALL_USERS.find(user => normalizeAuthEmail(user.email) === target) || null;
}

function findInstallUserByName(input) {
  const target = String(input || "").trim().toLowerCase();
  if (!target) return null;

  const exact = INSTALL_USERS.find(user => user.name.toLowerCase() === target);
  if (exact) return exact;

  const matches = INSTALL_USERS.filter(user => user.name.toLowerCase().startsWith(target));
  return matches.length === 1 ? matches[0] : null;
}

function buildFirebasePassword(pin) {
  return \`CMH-\${String(pin || "").replace(/\\D/g, "")}!\`;
}

function updateAdminButton() {
  const btn = document.getElementById("btnAdmin");
  if (!btn) return;

  btn.classList.toggle("active", !!currentEditor);
  btn.textContent = currentEditor
    ? \`EXIT — \${currentEditor.role}: \${currentEditor.name}\`
    : "ADMIN / HCA EDIT";
}

async function loginWithNameAndPin() {
  const name = prompt("Enter your name:");
  if (name === null) return;

  const user = findInstallUserByName(name);
  if (!user) {
    alert("Name not recognized. Try first name, exactly as listed.");
    return;
  }

  const pin = prompt(\`Enter PIN for \${user.name}:\`);
  if (pin === null) return;

  try {
    await signInWithEmailAndPassword(auth, user.email, buildFirebasePassword(pin));
  } catch (err) {
    console.error("Firebase login error:", err);
    alert("Incorrect PIN or Firebase Auth user not created yet.");
  }
}

onAuthStateChanged(auth, user => {
  const installUser = user ? findInstallUserByEmail(user.email) : null;

  if (!installUser) {
    adminMode = false;
    currentEditor = null;
    updateAdminButton();
    badge("○ LOGIN REQUIRED", "#dc2626");

    if (user) {
      signOut(auth).catch(err => console.error("Firebase sign out error:", err));
    }

    return;
  }

  currentEditor = {
    role: installUser.role,
    name: installUser.name,
    email: installUser.email
  };

  adminMode = true;
  updateAdminButton();
  startListeners();

  if (currentEditor.role === "ADMIN") {
    const modal = document.getElementById("adminWelcomeModal");
    if (modal) modal.classList.add("visible");
  }
});

document.addEventListener("DOMContentLoaded", updateAdminButton);`
);

output = output.replace(
  "function startListeners() {\n",
  `function startListeners() {
  if (!auth.currentUser || !currentEditor) {
    badge("○ LOGIN REQUIRED", "#dc2626");
    return;
  }

  if (listenersStarted) return;
  listenersStarted = true;

`
);

output = output.replace(
  /window\.toggleAdmin = \(\) => \{[\s\S]*?\n\};\n\nwindow\.closeNoSlotsModal/,
  `window.toggleAdmin = async () => {
  if (auth.currentUser || currentEditor) {
    const label = currentEditor ? \`\${currentEditor.role}: \${currentEditor.name}\` : "current user";
    if (!confirm(\`Exit edit mode for \${label}?\`)) return;

    try {
      await signOut(auth);
    } catch (err) {
      console.error("Firebase sign out error:", err);
    }

    window.location.reload();
    return;
  }

  await loginWithNameAndPin();
};

window.closeNoSlotsModal`
);

if (output.includes("ADMIN_PINS") || output.includes("HCA_PINS") || output.includes("signInAnonymously")) {
  throw new Error("Secure output still contains old PIN or anonymous-auth code.");
}

if (output.includes("@install-availability.cmheating.com")) {
  throw new Error("Secure output still contains placeholder install-availability emails.");
}

if (!output.includes("kmcalister@cmheating.com")) {
  throw new Error("Secure output missing corrected Kyle email.");
}

if (!output.includes("signInWithEmailAndPassword")) {
  throw new Error("Secure output does not contain Firebase Email/Password login.");
}

fs.writeFileSync(securePath, output);
fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2) + "\n");

console.log(`Wrote ${securePath}`);
console.log(`Wrote ${rulesPath}`);
console.log(`Approved users: ${users.length}`);
console.log(`Admins: ${adminEmails.length}`);
console.log(`HCA: ${users.length - adminEmails.length}`);
