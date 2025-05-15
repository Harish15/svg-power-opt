import { execSync } from "child_process";
import readline from "readline";

/**
 * Create a readline interface to handle interactive user input
 * from the terminal (stdin/stdout).
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Bumps the npm package version according to the specified version type.
 * Uses `npm version` command which updates package.json, creates a git commit
 * and tag automatically unless configured otherwise.
 * 
 * @param {"patch" | "minor" | "major"} type - The type of version bump to perform.
 */
const bumpVersion = (type) => {
  console.log(`\n🔄 Bumping version (${type})...`);
  
  // Execute the npm version bump command synchronously,
  // forwarding stdio to the parent process to show progress in terminal.
  execSync(`npm version ${type}`, { stdio: "inherit" });
};

/**
 * Publishes the package to the npm registry with public access.
 * Runs `npm publish` synchronously and closes the readline interface
 * after completion.
 */
const publish = () => {
  console.log("\n🚀 Publishing to npm...");
  
  // Execute npm publish synchronously,
  // forwarding stdio to display publish logs in terminal.
  execSync("npm publish --access public", { stdio: "inherit" });

  // Close the readline interface to end the program.
  rl.close();
};

/**
 * Prompt the user via CLI to choose the type of version bump: patch, minor, or major.
 * Validates input, performs version bump and publishes if valid, else exits with error message.
 */
rl.question("Choose version bump (patch, minor, major): ", (answer) => {
  // Define valid version bump types as per npm semantic versioning
  const valid = ["patch", "minor", "major"];
  
  // If user input is invalid, notify and exit
  if (!valid.includes(answer)) {
    console.log("❌ Invalid input. Use patch, minor, or major.");
    rl.close();
    return;
  }

  // Perform version bump based on valid input
  bumpVersion(answer);

  // Publish the package to npm after version bump
  publish();
});
