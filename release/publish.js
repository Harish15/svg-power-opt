import { execSync } from "child_process";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const bumpVersion = (type) => {
  console.log(`\n🔄 Bumping version (${type})...`);
  execSync(`npm version ${type}`, { stdio: "inherit" });
};

const publish = () => {
  console.log("\n🚀 Publishing to npm...");
  execSync("npm publish --access public", { stdio: "inherit" });
  rl.close();
};

rl.question("Choose version bump (patch, minor, major): ", (answer) => {
  const valid = ["patch", "minor", "major"];
  if (!valid.includes(answer)) {
    console.log("❌ Invalid input. Use patch, minor, or major.");
    rl.close();
    return;
  }
  bumpVersion(answer);
  publish();
});
