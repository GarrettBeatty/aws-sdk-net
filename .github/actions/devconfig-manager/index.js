const core = require('@actions/core');
const github = require('@actions/github');
const DevConfigGenerator = require('./lib/devconfig-generator');
const FileAnalyzer = require('./lib/file-analyzer');
const GitHubApi = require('./lib/github-api');
const FileOperations = require('./lib/file-operations');

async function run() {
  try {
    // Get inputs
    const prTitle = core.getInput('pr-title', { required: true });
    const prNumber = core.getInput('pr-number', { required: true });
    const githubToken = core.getInput('github-token', { required: true });
    const branchName = core.getInput('branch-name', { required: true });

    core.info('Running DevConfig validation...');

    // Initialize components
    const fileAnalyzer = new FileAnalyzer();
    const devConfigGenerator = new DevConfigGenerator();
    const githubApi = new GitHubApi(githubToken);
    const fileOps = new FileOperations();

    await handleValidate({
      prTitle,
      prNumber,
      branchName,
      fileAnalyzer,
      devConfigGenerator,
      githubApi,
      fileOps
    });

    core.info('DevConfig validation completed successfully');
  } catch (error) {
    core.setFailed(`DevConfig validation failed: ${error.message}`);
    core.debug(error.stack);
  }
}

async function handleValidate({
  prTitle,
  prNumber,
  branchName,
  fileAnalyzer,
  devConfigGenerator,
  githubApi,
  fileOps
}) {
  core.info('Validating DevConfig requirements...');

  // Skip validation for specific branches
  const excludedBranches = ['main', 'development', 'aws-sdk-net-v3.7', 'aws-sdk-net-v3.7-development'];
  if (excludedBranches.includes(branchName)) {
    core.info(`Branch ${branchName} is excluded from DevConfig validation`);
    core.setOutput('needs-devconfig', 'false');
    return;
  }

  // Check for existing DevConfig files
  const hasDevConfig = await fileOps.hasExistingDevConfig();
  core.setOutput('has-devconfig', hasDevConfig.toString());

  if (hasDevConfig) {
    core.info('DevConfig files already exist in this PR');
    core.setOutput('needs-devconfig', 'false');
    return;
  }

  // Analyze changes
  const changes = await fileAnalyzer.analyzeChanges();
  const needsDevConfig = changes.coreChanges > 0 || changes.serviceChanges.length > 0;

  core.setOutput('needs-devconfig', needsDevConfig.toString());

  if (needsDevConfig) {
    core.info(`Changes detected - Core: ${changes.coreChanges}, Services: ${changes.serviceChanges.length}`);
    
    // Generate preview DevConfig
    const devConfigContent = await devConfigGenerator.generate(prTitle, changes);
    core.setOutput('devconfig-content', devConfigContent);

    // Post comment with preview
    await githubApi.postDevConfigPreviewComment(prNumber, devConfigContent);
  } else {
    core.info('No changes detected, DevConfig is not needed');
  }
}


// Self-executing function
if (require.main === module) {
  run();
}

module.exports = { run };
