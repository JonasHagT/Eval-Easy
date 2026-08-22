// Pure budget-pacing math. No I/O so it can be unit-tested directly.

const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseDate(d) {
  // Treat dates as UTC midnight so day math is DST-proof.
  return new Date(`${d}T00:00:00Z`)
}

function inclusiveDays(startStr, endStr) {
  const start = parseDate(startStr)
  const end = parseDate(endStr)
  return Math.round((end - start) / MS_PER_DAY) + 1
}

function round(n, dp = 2) {
  const f = 10 ** dp
  return Math.round((n + Number.EPSILON) * f) / f
}

/**
 * Compute pacing metrics for a single campaign as of a reference date.
 * A pacing index > 1 means the campaign is spending faster than plan.
 */
export function computePacing(campaign, asOfDate) {
  const totalDays = inclusiveDays(campaign.flightStart, campaign.flightEnd)

  const rawElapsed =
    Math.round((parseDate(asOfDate) - parseDate(campaign.flightStart)) / MS_PER_DAY) + 1
  const elapsedDays = Math.max(0, Math.min(totalDays, rawElapsed))
  const daysRemaining = Math.max(0, totalDays - elapsedDays)

  const elapsedFraction = totalDays > 0 ? elapsedDays / totalDays : 0
  const idealSpendToDate = campaign.budget * elapsedFraction
  const remainingBudget = campaign.budget - campaign.spendToDate

  const pacingIndex = idealSpendToDate > 0 ? campaign.spendToDate / idealSpendToDate : 0

  const currentDailyRate = elapsedDays > 0 ? campaign.spendToDate / elapsedDays : 0
  const projectedEndSpend = campaign.spendToDate + currentDailyRate * daysRemaining
  const projectedVariance = projectedEndSpend - campaign.budget

  // Daily budget needed for the rest of the flight to land exactly on budget.
  const recommendedDailyBudget = daysRemaining > 0 ? remainingBudget / daysRemaining : 0

  let status
  if (pacingIndex > 1.1) status = 'over-pacing'
  else if (pacingIndex < 0.9) status = 'under-pacing'
  else status = 'on-track'

  return {
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    budget: campaign.budget,
    spendToDate: campaign.spendToDate,
    flightStart: campaign.flightStart,
    flightEnd: campaign.flightEnd,
    totalDays,
    elapsedDays,
    daysRemaining,
    elapsedFraction: round(elapsedFraction, 4),
    idealSpendToDate: round(idealSpendToDate),
    remainingBudget: round(remainingBudget),
    pacingIndex: round(pacingIndex, 3),
    status,
    currentDailyRate: round(currentDailyRate),
    projectedEndSpend: round(projectedEndSpend),
    projectedVariance: round(projectedVariance),
    recommendedDailyBudget: round(recommendedDailyBudget),
  }
}

/** Roll every campaign's pacing up into an account-level summary. */
export function computeAccountSummary(campaigns, asOfDate) {
  const rows = campaigns.map(c => computePacing(c, asOfDate))
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const totalSpend = rows.reduce((s, r) => s + r.spendToDate, 0)
  const totalIdeal = rows.reduce((s, r) => s + r.idealSpendToDate, 0)
  const totalProjected = rows.reduce((s, r) => s + r.projectedEndSpend, 0)

  return {
    asOfDate,
    campaignCount: rows.length,
    totalBudget: round(totalBudget),
    totalSpendToDate: round(totalSpend),
    totalIdealSpendToDate: round(totalIdeal),
    accountPacingIndex: totalIdeal > 0 ? round(totalSpend / totalIdeal, 3) : 0,
    projectedEndSpend: round(totalProjected),
    projectedVariance: round(totalProjected - totalBudget),
    overPacing: rows.filter(r => r.status === 'over-pacing').map(r => r.id),
    underPacing: rows.filter(r => r.status === 'under-pacing').map(r => r.id),
    onTrack: rows.filter(r => r.status === 'on-track').map(r => r.id),
  }
}
