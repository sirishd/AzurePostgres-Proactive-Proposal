// PostgreSQL to Azure Migration Proposal Generator
// Application Logic

// Azure Pricing Data (simplified - based on East US pricing)
const AZURE_PRICING = {
  // General Purpose tier pricing per vCore per month
  generalPurpose: {
    vCore: 73.73,
    storage: 0.115, // per GB
    backup: 0.095, // per GB
  },
  // Memory Optimized tier pricing per vCore per month
  memoryOptimized: {
    vCore: 147.46,
    storage: 0.115,
    backup: 0.095,
  },
  // Burstable tier pricing per vCore per month
  burstable: {
    vCore: 24.82,
    storage: 0.115,
    backup: 0.095,
  }
};

// Regional pricing multipliers
const REGION_MULTIPLIERS = {
  eastus: 1.0,
  eastus2: 1.0,
  westus: 1.0,
  westus2: 1.0,
  centralus: 1.0,
  northeurope: 1.02,
  westeurope: 1.02,
  southeastasia: 1.08,
  eastasia: 1.08,
};

// Form submission handler
document.getElementById('migrationForm').addEventListener('submit', function (e) {
  e.preventDefault();
  generateProposal();
});

// Main proposal generation function
function generateProposal() {
  // Collect form data
  const formData = {
    dbSize: parseInt(document.getElementById('dbSize').value),
    dbCount: parseInt(document.getElementById('dbCount').value),
    cpuCores: parseInt(document.getElementById('cpuCores').value),
    ramGB: parseInt(document.getElementById('ramGB').value),
    storageType: document.getElementById('storageType').value,
    avgIOPS: parseInt(document.getElementById('avgIOPS').value) || 0,
    currentMonthlyCost: parseFloat(document.getElementById('currentMonthlyCost').value) || 0,
    companyName: document.getElementById('companyName').value,
    industry: document.getElementById('industry').value,
    azureRegion: document.getElementById('azureRegion').value,
    migrationUrgency: document.getElementById('migrationUrgency').value,
  };

  // Calculate Azure recommendation
  const recommendation = calculateAzureRecommendation(formData);

  // Calculate costs
  const costs = calculateCosts(formData, recommendation);

  // Calculate migration timeline
  const timeline = calculateMigrationTimeline(formData);

  // Generate and display proposal
  displayProposal(formData, recommendation, costs, timeline);

  // Hide form, show proposal
  document.getElementById('assessmentForm').classList.add('hidden');
  document.getElementById('proposalOutput').classList.add('active');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Calculate Azure tier and specifications recommendation
function calculateAzureRecommendation(data) {
  let tier = 'generalPurpose';
  let vCores = data.cpuCores;
  let ramGB = data.ramGB;

  // Determine tier based on workload and RAM requirements
  const ramPerCore = data.ramGB / data.cpuCores;

  if (ramPerCore > 8) {
    tier = 'memoryOptimized';
    // Memory Optimized provides 8GB per vCore
    vCores = Math.max(2, Math.ceil(data.ramGB / 8));
    ramGB = vCores * 8;
  } else if (ramPerCore > 4) {
    tier = 'generalPurpose';
    // General Purpose provides 4GB per vCore
    vCores = Math.max(2, Math.ceil(data.ramGB / 4));
    ramGB = vCores * 4;
  } else if (data.dbSize < 100 && data.cpuCores <= 4) {
    tier = 'burstable';
    // Burstable provides 2GB per vCore
    vCores = Math.min(2, Math.max(1, Math.ceil(data.ramGB / 2)));
    ramGB = vCores * 2;
  } else {
    tier = 'generalPurpose';
    vCores = Math.max(2, Math.ceil(data.ramGB / 4));
    ramGB = vCores * 4;
  }

  // Calculate storage needs (add 20% buffer)
  const storageGB = Math.ceil(data.dbSize * 1.2);

  // Calculate backup storage (assume 7 days retention)
  const backupGB = Math.ceil(data.dbSize * 0.3);

  return {
    tier,
    tierName: getTierDisplayName(tier),
    vCores,
    ramGB,
    storageGB,
    backupGB,
    haEnabled: true,
    backupRetention: 7,
  };
}

// Get display name for tier
function getTierDisplayName(tier) {
  const names = {
    burstable: 'Burstable',
    generalPurpose: 'General Purpose',
    memoryOptimized: 'Memory Optimized',
  };
  return names[tier] || tier;
}

// Calculate costs
function calculateCosts(data, recommendation) {
  const region = data.azureRegion;
  const multiplier = REGION_MULTIPLIERS[region] || 1.0;
  const pricing = AZURE_PRICING[recommendation.tier];

  // Azure monthly costs
  const computeCost = pricing.vCore * recommendation.vCores * multiplier;
  const storageCost = pricing.storage * recommendation.storageGB * multiplier;
  const backupCost = pricing.backup * recommendation.backupGB * multiplier;
  const azureMonthlyCost = computeCost + storageCost + backupCost;

  // Annual costs
  const azureAnnualCost = azureMonthlyCost * 12;
  const currentAnnualCost = data.currentMonthlyCost * 12;

  // 3-year TCO
  const azure3YearTCO = azureAnnualCost * 3;
  const current3YearTCO = currentAnnualCost * 3;

  // Calculate savings
  const monthlySavings = data.currentMonthlyCost - azureMonthlyCost;
  const annualSavings = monthlySavings * 12;
  const threeYearSavings = annualSavings * 3;
  const savingsPercentage = data.currentMonthlyCost > 0
    ? ((monthlySavings / data.currentMonthlyCost) * 100).toFixed(1)
    : 0;

  return {
    azure: {
      monthly: azureMonthlyCost,
      annual: azureAnnualCost,
      threeYear: azure3YearTCO,
      breakdown: {
        compute: computeCost,
        storage: storageCost,
        backup: backupCost,
      }
    },
    current: {
      monthly: data.currentMonthlyCost,
      annual: currentAnnualCost,
      threeYear: current3YearTCO,
    },
    savings: {
      monthly: monthlySavings,
      annual: annualSavings,
      threeYear: threeYearSavings,
      percentage: savingsPercentage,
    }
  };
}

// Calculate migration timeline
function calculateMigrationTimeline(data) {
  const urgency = data.migrationUrgency || 'standard';
  const dbSize = data.dbSize;
  const dbCount = data.dbCount;

  // Base timeline in weeks
  let phases = {
    assessment: { weeks: 2, description: 'Infrastructure assessment, dependency mapping, and migration planning' },
    schema: { weeks: 2, description: 'Schema migration, stored procedures, and database objects conversion' },
    data: { weeks: 4, description: 'Data migration using Azure Database Migration Service' },
    testing: { weeks: 3, description: 'Performance testing, validation, and optimization' },
    cutover: { weeks: 1, description: 'Final sync, cutover execution, and go-live' },
  };

  // Adjust based on database size and complexity
  if (dbSize > 1000) {
    phases.data.weeks += 2;
    phases.testing.weeks += 1;
  }

  if (dbCount > 10) {
    phases.schema.weeks += 1;
    phases.data.weeks += 1;
  }

  // Adjust based on urgency
  if (urgency === 'accelerated') {
    Object.keys(phases).forEach(key => {
      phases[key].weeks = Math.ceil(phases[key].weeks * 0.7);
    });
  } else if (urgency === 'urgent') {
    Object.keys(phases).forEach(key => {
      phases[key].weeks = Math.ceil(phases[key].weeks * 0.5);
    });
  }

  // Calculate total
  const totalWeeks = Object.values(phases).reduce((sum, phase) => sum + phase.weeks, 0);

  return {
    phases,
    totalWeeks,
    totalMonths: Math.ceil(totalWeeks / 4),
  };
}

// Display the proposal
function displayProposal(data, recommendation, costs, timeline) {
  // Set proposal header
  document.getElementById('proposalTitle').textContent = `Migration Proposal for ${data.companyName}`;
  document.getElementById('proposalDate').textContent = `Generated on ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`;

  // Executive Summary
  const savingsText = costs.savings.monthly > 0
    ? `reduce costs by ${costs.savings.percentage}% (${formatCurrency(costs.savings.monthly)}/month)`
    : `invest ${formatCurrency(Math.abs(costs.savings.monthly))}/month for enhanced capabilities`;

  document.getElementById('executiveSummary').innerHTML = `
    <p>This proposal outlines a comprehensive migration strategy to move ${data.companyName}'s PostgreSQL databases to Azure Database for PostgreSQL. 
    The migration will modernize your database infrastructure, enhance security and reliability, and ${savingsText}.</p>
    <p>We recommend migrating to Azure Database for PostgreSQL <strong>${recommendation.tierName}</strong> tier, 
    which will provide ${recommendation.vCores} vCores and ${recommendation.ramGB}GB RAM to support your workload. 
    The estimated migration timeline is <strong>${timeline.totalMonths} months</strong>.</p>
  `;

  // Current State Stats
  document.getElementById('currentStateStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${data.dbSize} GB</div>
      <div class="stat-label">Total Database Size</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.dbCount}</div>
      <div class="stat-label">Databases</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.cpuCores} / ${data.ramGB}GB</div>
      <div class="stat-label">CPU / RAM</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.storageType.toUpperCase()}</div>
      <div class="stat-label">Storage Type</div>
    </div>
  `;

  // Azure Recommendation
  const regionName = document.getElementById('azureRegion').options[document.getElementById('azureRegion').selectedIndex].text;
  document.getElementById('azureRecommendation').innerHTML = `
    <p>Based on your current infrastructure and workload requirements, we recommend the following Azure Database for PostgreSQL configuration:</p>
    <div class="mt-lg">
      <span class="badge badge-info">${recommendation.tierName} Tier</span>
      <span class="badge badge-success">High Availability Enabled</span>
      <span class="badge badge-info">${regionName}</span>
    </div>
  `;

  document.getElementById('azureSpecs').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${recommendation.vCores}</div>
      <div class="stat-label">vCores</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${recommendation.ramGB} GB</div>
      <div class="stat-label">Memory</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${recommendation.storageGB} GB</div>
      <div class="stat-label">Storage</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${recommendation.backupRetention} Days</div>
      <div class="stat-label">Backup Retention</div>
    </div>
  `;

  // Cost Stats
  const savingsClass = costs.savings.monthly > 0 ? 'text-success' : 'text-warning';
  document.getElementById('costStats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(costs.azure.monthly)}</div>
      <div class="stat-label">Azure Monthly Cost</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${savingsClass}">${costs.savings.monthly > 0 ? '-' : '+'}${formatCurrency(Math.abs(costs.savings.monthly))}</div>
      <div class="stat-label">Monthly Savings</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${savingsClass}">${costs.savings.percentage}%</div>
      <div class="stat-label">Cost Reduction</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatCurrency(costs.savings.threeYear)}</div>
      <div class="stat-label">3-Year Savings</div>
    </div>
  `;

  // Cost Comparison Table
  const currentCostDisplay = data.currentMonthlyCost > 0 ? formatCurrency(data.currentMonthlyCost) : 'Not provided';
  const savingsDiff = costs.savings.monthly > 0
    ? `<span class="text-success">-${formatCurrency(costs.savings.monthly)}</span>`
    : `<span class="text-warning">+${formatCurrency(Math.abs(costs.savings.monthly))}</span>`;

  document.getElementById('costComparison').innerHTML = `
    <tr>
      <td>Monthly Infrastructure</td>
      <td>${currentCostDisplay}</td>
      <td>${formatCurrency(costs.azure.monthly)}</td>
      <td>${savingsDiff}</td>
    </tr>
    <tr>
      <td>Annual Cost</td>
      <td>${data.currentMonthlyCost > 0 ? formatCurrency(costs.current.annual) : 'Not provided'}</td>
      <td>${formatCurrency(costs.azure.annual)}</td>
      <td>${costs.savings.annual > 0 ? `<span class="text-success">-${formatCurrency(costs.savings.annual)}</span>` : `<span class="text-warning">+${formatCurrency(Math.abs(costs.savings.annual))}</span>`}</td>
    </tr>
    <tr class="highlight">
      <td><strong>3-Year TCO</strong></td>
      <td><strong>${data.currentMonthlyCost > 0 ? formatCurrency(costs.current.threeYear) : 'Not provided'}</strong></td>
      <td><strong>${formatCurrency(costs.azure.threeYear)}</strong></td>
      <td><strong>${costs.savings.threeYear > 0 ? `<span class="text-success">-${formatCurrency(costs.savings.threeYear)}</span>` : `<span class="text-warning">+${formatCurrency(Math.abs(costs.savings.threeYear))}</span>`}</strong></td>
    </tr>
  `;

  // Migration Timeline
  let timelineHTML = '';
  let weekCounter = 0;
  const phaseNames = {
    assessment: 'Assessment & Planning',
    schema: 'Schema Migration',
    data: 'Data Migration',
    testing: 'Testing & Validation',
    cutover: 'Cutover & Go-Live',
  };

  Object.keys(timeline.phases).forEach(key => {
    const phase = timeline.phases[key];
    const startWeek = weekCounter + 1;
    weekCounter += phase.weeks;
    const endWeek = weekCounter;

    timelineHTML += `
      <div class="timeline-item">
        <div class="timeline-title">${phaseNames[key]}</div>
        <p class="timeline-description">${phase.description}</p>
        <span class="timeline-duration">Weeks ${startWeek}-${endWeek} (${phase.weeks} weeks)</span>
      </div>
    `;
  });

  document.getElementById('migrationTimeline').innerHTML = timelineHTML;

  // Key Benefits
  document.getElementById('keyBenefits').innerHTML = `
    <div class="form-grid">
      <div>
        <h4>🔒 Enhanced Security</h4>
        <p class="text-muted">Built-in threat protection, encryption at rest and in transit, and advanced security features.</p>
      </div>
      <div>
        <h4>⚡ High Availability</h4>
        <p class="text-muted">99.99% SLA with automatic failover and zone-redundant deployment options.</p>
      </div>
      <div>
        <h4>📈 Elastic Scalability</h4>
        <p class="text-muted">Scale compute and storage independently without downtime to meet changing demands.</p>
      </div>
      <div>
        <h4>🔄 Automated Backups</h4>
        <p class="text-muted">Automated backups with point-in-time restore up to 35 days.</p>
      </div>
      <div>
        <h4>🛠️ Reduced Management</h4>
        <p class="text-muted">Fully managed service with automatic patching, updates, and maintenance.</p>
      </div>
      <div>
        <h4>🌍 Global Reach</h4>
        <p class="text-muted">Deploy across 60+ Azure regions worldwide for low-latency access.</p>
      </div>
    </div>
  `;

  // Next Steps
  document.getElementById('nextSteps').innerHTML = `
    <ol style="margin-left: var(--spacing-lg); color: var(--color-text-secondary);">
      <li style="margin-bottom: var(--spacing-sm);"><strong>Review & Approve:</strong> Review this proposal and provide feedback or approval.</li>
      <li style="margin-bottom: var(--spacing-sm);"><strong>Detailed Assessment:</strong> Conduct a detailed technical assessment of your databases.</li>
      <li style="margin-bottom: var(--spacing-sm);"><strong>Proof of Concept:</strong> Set up a PoC environment to validate performance and compatibility.</li>
      <li style="margin-bottom: var(--spacing-sm);"><strong>Migration Planning:</strong> Develop detailed migration runbooks and rollback procedures.</li>
      <li style="margin-bottom: var(--spacing-sm);"><strong>Execute Migration:</strong> Begin phased migration following the roadmap outlined above.</li>
    </ol>
  `;
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Download proposal as PDF
async function downloadPDF() {
  const button = event.target.closest('button');
  const originalText = button.innerHTML;

  // Show loading state
  button.innerHTML = '<span>⏳</span><span>Generating PDF...</span>';
  button.disabled = true;

  try {
    // Get the proposal output element
    const proposalElement = document.getElementById('proposalOutput');

    // Temporarily hide the button group for the PDF
    const buttonGroup = proposalElement.querySelector('.button-group');
    buttonGroup.style.display = 'none';

    // Create a temporary container with white background for better PDF rendering
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = 'position: absolute; left: -9999px; top: 0; background: white; padding: 40px; width: 1200px;';
    tempContainer.innerHTML = proposalElement.innerHTML;
    document.body.appendChild(tempContainer);

    // Remove button group from temp container
    const tempButtonGroup = tempContainer.querySelector('.button-group');
    if (tempButtonGroup) {
      tempButtonGroup.remove();
    }

    // Use html2canvas to convert the proposal to canvas
    const canvas = await html2canvas(tempContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
    });

    // Remove temporary container
    document.body.removeChild(tempContainer);

    // Show button group again
    buttonGroup.style.display = '';

    // Get canvas dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    // Initialize jsPDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    let position = 0;
    const imgData = canvas.toDataURL('image/png');

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Generate filename with company name and date
    const companyName = document.getElementById('companyName').value || 'Customer';
    const date = new Date().toISOString().split('T')[0];
    const filename = `PostgreSQL-Azure-Migration-Proposal-${companyName.replace(/\s+/g, '-')}-${date}.pdf`;

    // Download the PDF
    pdf.save(filename);

    // Reset button
    button.innerHTML = originalText;
    button.disabled = false;

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('There was an error generating the PDF. Please try using the Print button instead.');

    // Reset button
    button.innerHTML = originalText;
    button.disabled = false;
  }
}

// Reset form and show it again
function resetForm() {
  document.getElementById('migrationForm').reset();
  document.getElementById('assessmentForm').classList.remove('hidden');
  document.getElementById('proposalOutput').classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
