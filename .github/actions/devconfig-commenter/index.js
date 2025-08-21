const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs').promises;
const { execSync } = require('child_process');

async function run() {
  try {
    // Get inputs
    const workflowRunId = core.getInput('workflow-run-id', { required: true });
    const githubToken = core.getInput('github-token', { required: true });

    core.info('Starting DevConfig commenter...');

    // Initialize GitHub client
    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    // Download and process artifacts
    await downloadAndProcessArtifacts(octokit, context, workflowRunId);

    core.info('DevConfig commenter completed successfully');
  } catch (error) {
    core.setFailed(`DevConfig commenter failed: ${error.message}`);
    core.debug(error.stack);
  }
}

async function downloadAndProcessArtifacts(octokit, context, workflowRunId) {
  core.info(`Downloading artifacts from workflow run: ${workflowRunId}`);

  try {
    // List artifacts from the workflow run
    const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: parseInt(workflowRunId),
    });

    // Find DevConfig results artifact
    const devConfigArtifact = artifacts.data.artifacts.find(artifact => 
      artifact.name.startsWith('devconfig-results-')
    );

    if (!devConfigArtifact) {
      core.info('No DevConfig artifacts found - no comments needed');
      return;
    }

    core.info(`Found DevConfig artifact: ${devConfigArtifact.name}`);

    // Download the artifact
    const download = await octokit.rest.actions.downloadArtifact({
      owner: context.repo.owner,
      repo: context.repo.repo,
      artifact_id: devConfigArtifact.id,
      archive_format: 'zip',
    });

    // Save and extract the artifact
    await fs.writeFile('results.zip', Buffer.from(download.data));
    execSync('unzip -q results.zip');

    // Read and process results
    const resultsContent = await fs.readFile('devconfig-results.json', 'utf8');
    const results = JSON.parse(resultsContent);

    core.info(`Processing results for PR #${results.prNumber}`);

    // Generate and post comment
    await postDevConfigComment(octokit, context, results);

  } catch (error) {
    if (error.message.includes('Not Found')) {
      core.info('No DevConfig artifacts found - no comments needed');
    } else {
      throw error;
    }
  }
}

async function postDevConfigComment(octokit, context, results) {
  let commentBody;

  if (results.validation && !results.validation.isValid) {
    // Validation error comment
    commentBody = generateValidationErrorComment(results);
  } else {
    // Preview comment
    commentBody = generatePreviewComment(results);
  }

  try {
    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: results.prNumber,
      body: commentBody
    });

    core.info(`DevConfig comment posted successfully to PR #${results.prNumber}`);

    // Add devconfig-required label if DevConfig is needed
    if (results.needsDevConfig && !results.hasDevConfig) {
      await addDevConfigRequiredLabel(octokit, context, results.prNumber);
    } else if (results.validation && !results.validation.isValid) {
      await addDevConfigRequiredLabel(octokit, context, results.prNumber);
    }

  } catch (error) {
    core.error(`Failed to post comment: ${error.message}`);
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

async function addDevConfigRequiredLabel(octokit, context, prNumber) {
  try {
    core.info(`Adding devconfig-required label to PR #${prNumber}`);
    
    await octokit.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      labels: ['devconfig-required']
    });

    core.info('devconfig-required label added successfully');
  } catch (error) {
    core.warning(`Failed to add devconfig-required label: ${error.message}`);
    // Don't throw - labeling is not critical
  }
}

function generateValidationErrorComment(results) {
  let errorDetails = '';
  
  if (results.validation.missingServices && results.validation.missingServices.length > 0) {
    errorDetails += `**Missing Services:** ${results.validation.missingServices.join(', ')}\n`;
  }
  
  if (results.validation.missingCore) {
    errorDetails += `**Missing Core Section:** Core changes detected but no core section in DevConfig\n`;
  }

  if (results.validation.error) {
    errorDetails += `**Error:** ${results.validation.error}\n`;
  }

  const configuredServices = results.validation.configuredServices || [];
  let configuredText = '';
  if (configuredServices.length > 0) {
    configuredText = `**Currently Configured Services:** ${configuredServices.join(', ')}\n`;
  }
  
  return `## DevConfig Validation Failed ❌

Your PR includes a DevConfig file, but it doesn't cover all the changes in this PR.

${errorDetails}
${configuredText}

**Corrected DevConfig:**

\`\`\`json
${results.devConfigContent}
\`\`\`

**To fix this:**

1. Update your DevConfig file with the corrected content above
2. Make sure all changed services and core components are included
3. Commit and push the updated file

For more information about DevConfig files, see the [DevConfig Files](https://github.com/aws/aws-sdk-net/blob/main/README.md#devconfig-files) section in the README.md.`;
}

function generatePreviewComment(results) {
  return `## DevConfig File Needed

This PR requires a DevConfig file. Here's the suggested DevConfig:

\`\`\`json
${results.devConfigContent}
\`\`\`

**To add this DevConfig:**

1. Create the file \`./generator/.DevConfigs/pr-${results.prNumber}.json\`
2. Copy the JSON above into the file
3. Commit and push the file to your PR

For more information about DevConfig files, see the [DevConfig Files](https://github.com/aws/aws-sdk-net/blob/main/README.md#devconfig-files) section in the README.md.`;
}

// Self-executing function
if (require.main === module) {
  run();
}

module.exports = { run };
