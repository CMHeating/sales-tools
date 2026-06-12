const fs = require("fs");

const users = require("./install-availability-users.spark.js");

const source = fs.readFileSync("install-availability.html", "utf8");
const pinConfig = JSON.parse(fs.readFileSync("pin-config.private.json", "utf8"));

const apiKeyMatch = source.match(/apiKey:\s*"([^"]+)"/);
if (!apiKeyMatch) {
  throw new Error("Could not find Firebase apiKey in install-availability.html");
}

const apiKey = apiKeyMatch[1];

const emailByName = new Map(users.map(user => [user.name, user.email]));
const roleByName = new Map(users.map(user => [user.name, user.role]));

function buildAuthUsers(group, expectedRole) {
  return Object.entries(group).map(([pin, name]) => {
    const email = emailByName.get(name);
    const role = roleByName.get(name);

    if (!email) {
      throw new Error(`No email mapping for ${name}`);
    }

    if (role !== expectedRole) {
      throw new Error(`Role mismatch for ${name}: expected ${expectedRole}, got ${role}`);
    }

    return {
      role,
      name,
      email,
      password: `CMH-${pin}!`
    };
  });
}

const authUsers = [
  ...buildAuthUsers(pinConfig.admin || {}, "ADMIN"),
  ...buildAuthUsers(pinConfig.hca || {}, "HCA")
];

async function postIdentityToolkit(endpoint, body) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (!res.ok) {
    const code = json && json.error && json.error.message ? json.error.message : `HTTP_${res.status}`;
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  return json;
}

async function createOrVerifyUser(user) {
  try {
    await postIdentityToolkit("accounts:signUp", {
      email: user.email,
      password: user.password,
      returnSecureToken: false
    });

    return "CREATED";
  } catch (err) {
    if (err.code === "EMAIL_EXISTS") {
      try {
        await postIdentityToolkit("accounts:signInWithPassword", {
          email: user.email,
          password: user.password,
          returnSecureToken: false
        });

        return "EXISTS_OK";
      } catch {
        return "EXISTS_PASSWORD_MISMATCH";
      }
    }

    if (err.code === "OPERATION_NOT_ALLOWED") {
      return "EMAIL_PASSWORD_PROVIDER_DISABLED";
    }

    return `ERROR_${err.code || err.message}`;
  }
}

(async () => {
  console.log(`Firebase Auth user target count: ${authUsers.length}`);
  console.log("No PINs will be printed.");

  const results = [];

  for (const user of authUsers) {
    const status = await createOrVerifyUser(user);
    results.push({ role: user.role, name: user.name, email: user.email, status });
    console.log(`${status.padEnd(32)} ${user.role.padEnd(5)} ${user.name.padEnd(8)} ${user.email}`);
  }

  fs.writeFileSync(
    "install-auth-users.spark.private.json",
    JSON.stringify(results, null, 2) + "\n",
    { mode: 0o600 }
  );

  const disabled = results.filter(result => result.status === "EMAIL_PASSWORD_PROVIDER_DISABLED");
  const mismatches = results.filter(result => result.status === "EXISTS_PASSWORD_MISMATCH");
  const errors = results.filter(result => result.status.startsWith("ERROR_"));

  if (disabled.length) {
    console.error("");
    console.error("Email/Password provider is disabled.");
    console.error("Enable it in Firebase Console → Authentication → Sign-in method → Email/Password.");
    process.exit(2);
  }

  if (mismatches.length) {
    console.error("");
    console.error("Some users already exist but do not match the expected PIN password.");
    console.error("Reset those users in Firebase Authentication, or delete and recreate them.");
    process.exit(3);
  }

  if (errors.length) {
    console.error("");
    console.error("Some user creation calls failed. Review install-auth-users.spark.private.json.");
    process.exit(4);
  }

  console.log("");
  console.log("Auth users ready.");
})();
