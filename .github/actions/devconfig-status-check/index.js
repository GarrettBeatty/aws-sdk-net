const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    core.info('Starting DevConfig status check...');

    const context = github.context;

    // Ensure we're in a PR context
    if (!context.payload.pull_request) {
      core.info('Not a pull request context - skipping status check');
      return;
    }

    // Get PR data
    const prNumber = context.payload.pull_request.number;
    const labels = context.payload.pull_request.labels.map(label => label.name);

    core.info(`Checking DevConfig status for PR #${prNumber}`);
    core.info(`PR labels: ${labels.join(', ')}`);

    // Check for maintainer override - this takes precedence
    if (labels.includes('devconfig-not-needed')) {
      core.info('✅ Maintainer override: DevConfig not needed (devconfig-not-needed label found)');
      return;
    }

    // Check if DevConfig is required but missing
    if (labels.includes('devconfig-required')) {
      core.setFailed('❌ DevConfig file is required but missing. Please add a DevConfig file or ask a maintainer to add the "devconfig-not-needed" label if this PR does not require a DevConfig.');
      return;
    }

    // If we get here, either no DevConfig is needed or it's already satisfied
    core.info('✅ DevConfig status check passed - no enforcement needed');
  } catch (error) {
    core.setFailed(`DevConfig status check failed: ${error.message}`);
    core.debug(error.stack);
  }
}

// Self-executing function
if (require.main === module) {
  run();
}

module.exports = { run };
